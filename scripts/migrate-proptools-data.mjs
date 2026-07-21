#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   Migración de datos: PropTools (base vieja) → Noduus.

   Copia usuarios (recreándolos en el auth de Noduus), firmas,
   plantillas, tarjetas, rótulos, avalúos, calendarios, eventos,
   equipos y reservas, remapeando tenant y auth ids.

   USO:
     OLD_URL=https://zsldwaiwcvziqfajcmph.supabase.co \
     OLD_SERVICE_KEY=eyJ... \
     NEW_URL=https://neuzltjlezogxmhbceco.supabase.co \
     NEW_SERVICE_KEY=eyJ... \
     TARGET_TENANT_ID=<uuid del tenant en Noduus> \
     node scripts/migrate-proptools-data.mjs

   Opcional: DRY_RUN=1 (muestra qué haría sin escribir nada)

   Notas:
   - Las contraseñas NO se pueden copiar entre proyectos de Supabase.
     Los usuarios se crean con email confirmado y contraseña aleatoria;
     entran con "Olvidé mi contraseña" desde /admin/login.
   - Idempotente: reejecutar no duplica (ignora conflictos por id).
   - Las invitaciones pendientes NO se migran (los links viejos ya
     apuntan al dominio anterior — reenviarlas desde /tools/admin/).
══════════════════════════════════════════════════════════════ */

const OLD_URL  = process.env.OLD_URL || 'https://zsldwaiwcvziqfajcmph.supabase.co'
const NEW_URL  = process.env.NEW_URL || 'https://neuzltjlezogxmhbceco.supabase.co'
const OLD_KEY  = process.env.OLD_SERVICE_KEY
const NEW_KEY  = process.env.NEW_SERVICE_KEY
const TENANT   = process.env.TARGET_TENANT_ID
const DRY      = process.env.DRY_RUN === '1'

if (!OLD_KEY || !NEW_KEY || !TENANT) {
  console.error('Faltan variables: OLD_SERVICE_KEY, NEW_SERVICE_KEY, TARGET_TENANT_ID')
  process.exit(1)
}

// Columnas del esquema NUEVO por tabla (payloads se filtran a esto;
// columnas extra de la base vieja se descartan con aviso).
const COLS = {
  users: ['id','auth_id','tenant_id','name','email','role','job_title','phone','whatsapp','instagram','facebook','linkedin','tiktok','photo_url','created_at'],
  tenant_templates: ['id','tenant_id','name','html','config','active','sort_order','created_at','template_id','logo_url','extra_website'],
  signatures: ['id','tenant_id','user_id','save_name','template','photo_url','name','role','email','phone','whatsapp','facebook','instagram','linkedin','tiktok','created_at','updated_at'],
  tarjetas: ['id','tenant_id','user_id','save_name','template','photo_url','name','whatsapp','email','instagram','created_at','updated_at'],
  rotulos: ['id','tenant_id','user_id','save_name','orientacion','template','texto_rojo','name','whatsapp','email','created_at','updated_at'],
  avaluos: ['id','tenant_id','user_id','referencia','obra','fecha_avaluo','provincia','canton','distrito','ubicacion','notas','tipo_principal','tipo_segunda','area_construccion','anios_construccion','pct_remodelacion','anios_remodelacion','vida_util','estado_conservacion','area_lote','val_mt2_lote','anio_mapa','tipo_cambio','complementarias','resultado_terreno_col','resultado_const_base_col','resultado_const_depr_col','resultado_compl_col','resultado_total_col','resultado_total_usd','created_at','updated_at'],
  calendarios: ['id','tenant_id','nombre','color','created_at'],
  eventos_calendario: ['id','tenant_id','calendario_id','titulo','fecha','hora_inicio','hora_fin','descripcion','todo_dia','user_auth_id','creado_por','created_at'],
  equipos: ['id','tenant_id','nombre','tipo','marca','modelo','estado','created_at'],
  reservas: ['id','tenant_id','user_auth_id','fecha_inicio','fecha_fin','motivo','estado','created_at'],
  reserva_equipos: ['id','reserva_id','equipo_id'],
}

async function rest(base, key, path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function fetchAll(table) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const page = await rest(OLD_URL, OLD_KEY, `/rest/v1/${table}?select=*`, {
      headers: { Range: `${from}-${from + 999}`, Prefer: 'count=exact' },
    }).catch(e => { console.warn(`  ⚠ ${table}: ${e.message}`); return null })
    if (!page) return rows
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}

function pick(row, table, extra = {}) {
  const out = {}
  const allowed = COLS[table]
  const dropped = []
  for (const [k, v] of Object.entries({ ...row, ...extra })) {
    if (allowed.includes(k)) out[k] = v
    else dropped.push(k)
  }
  if (dropped.length && !pick._warned?.[table]) {
    pick._warned = pick._warned || {}
    pick._warned[table] = true
    console.log(`  ℹ ${table}: columnas de la base vieja descartadas: ${dropped.join(', ')}`)
  }
  return out
}

async function insertRows(table, rows) {
  if (rows.length === 0) { console.log(`  ${table}: 0 filas`); return }
  if (DRY) { console.log(`  [DRY] ${table}: insertaría ${rows.length} filas`); return }
  for (let i = 0; i < rows.length; i += 500) {
    await rest(NEW_URL, NEW_KEY, `/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      // merge: si la fila ya existe (re-ejecución) actualiza sus columnas
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(rows.slice(i, i + 500)),
    })
  }
  console.log(`  ✓ ${table}: ${rows.length} filas`)
}

// ── Auth: recrear usuarios en el proyecto nuevo ────────────────
async function listNewAuthUsers() {
  const byEmail = {}
  for (let page = 1; ; page++) {
    const data = await rest(NEW_URL, NEW_KEY, `/auth/v1/admin/users?page=${page}&per_page=1000`)
    const users = data.users || []
    for (const u of users) if (u.email) byEmail[u.email.toLowerCase()] = u.id
    if (users.length < 1000) break
  }
  return byEmail
}

async function createAuthUser(email) {
  const pwd = crypto.randomUUID() + 'Aa1!'
  const data = await rest(NEW_URL, NEW_KEY, '/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: pwd, email_confirm: true }),
  })
  return data.id
}

// ── Main ───────────────────────────────────────────────────────
const main = async () => {
  console.log(`Migrando datos → tenant ${TENANT}${DRY ? '  [DRY RUN]' : ''}\n`)

  // 1. Usuarios: crear en auth nuevo y armar mapa old_auth_id → new_auth_id
  console.log('1) Usuarios')
  const oldUsers = await fetchAll('users')
  const existing = DRY ? {} : await listNewAuthUsers()
  const authMap = {}   // old auth_id → new auth_id

  const userRows = []
  for (const u of oldUsers) {
    const email = (u.email || '').toLowerCase()
    if (!email) { console.warn(`  ⚠ usuario ${u.id} sin email — omitido`); continue }
    let newAuthId = existing[email]
    if (!newAuthId) {
      if (DRY) { console.log(`  [DRY] crearía auth user ${email}`); newAuthId = 'dry-' + u.auth_id }
      else { newAuthId = await createAuthUser(email); console.log(`  + auth: ${email}`) }
    }
    authMap[u.auth_id] = newAuthId
    userRows.push(pick(u, 'users', { tenant_id: TENANT, auth_id: newAuthId }))
  }
  await insertRows('users', userRows)

  const remapAuth = id => (id && authMap[id]) || id

  // Mapas para validar user_id (FK a users.id): ids migrados y
  // auth_id viejo → users.id (por si la tabla guardó el auth id).
  const migratedUserIds = new Set(userRows.map(u => u.id))
  const oldAuthToUserId = {}
  for (const u of oldUsers) if (u.auth_id && migratedUserIds.has(u.id)) oldAuthToUserId[u.auth_id] = u.id
  const fixUserId = id => migratedUserIds.has(id) ? id : (oldAuthToUserId[id] ?? null)

  // 2. Tablas de herramientas
  console.log('\n2) Herramientas')
  for (const t of ['tenant_templates', 'calendarios', 'equipos']) {
    const rows = (await fetchAll(t)).map(r => {
      // tenant_templates: la base vieja usaba `label`, la nueva usa `name`
      const extra = { tenant_id: TENANT }
      if (t === 'tenant_templates' && !r.name && r.label) extra.name = r.label
      return pick(r, t, extra)
    })
    await insertRows(t, rows)
  }

  // signatures/tarjetas/rotulos: user_id referencia users(id) —
  // remapear si guardó el auth id viejo, omitir huérfanos con aviso.
  for (const t of ['signatures', 'tarjetas', 'rotulos']) {
    const all = await fetchAll(t)
    const rows = []
    for (const r of all) {
      const uid = fixUserId(r.user_id)
      if (!uid) { console.warn(`  ⚠ ${t} ${r.id}: user_id ${r.user_id} sin usuario migrado — omitido`); continue }
      rows.push(pick(r, t, { tenant_id: TENANT, user_id: uid }))
    }
    await insertRows(t, rows)
  }

  // avaluos: user_id es un auth id → remap
  const avaluos = (await fetchAll('avaluos')).map(r =>
    pick(r, 'avaluos', { tenant_id: TENANT, user_id: remapAuth(r.user_id) }))
  await insertRows('avaluos', avaluos)

  // eventos: user_auth_id y creado_por → remap
  const eventos = (await fetchAll('eventos_calendario')).map(r =>
    pick(r, 'eventos_calendario', { tenant_id: TENANT, user_auth_id: remapAuth(r.user_auth_id), creado_por: remapAuth(r.creado_por) }))
  await insertRows('eventos_calendario', eventos)

  // reservas: user_auth_id → remap; luego reserva_equipos tal cual
  const reservas = (await fetchAll('reservas')).map(r =>
    pick(r, 'reservas', { tenant_id: TENANT, user_auth_id: remapAuth(r.user_auth_id) }))
  await insertRows('reservas', reservas)

  const re = (await fetchAll('reserva_equipos')).map(r => pick(r, 'reserva_equipos'))
  await insertRows('reserva_equipos', re)

  console.log(`\nListo.${DRY ? ' (dry run — nada escrito)' : ''}`)
  if (!DRY) console.log('Recordatorio: los usuarios migrados deben restablecer su contraseña ("Olvidé mi contraseña" en /admin/login).')
}

main().catch(e => { console.error('\n✗ Error:', e.message); process.exit(1) })
