// Normaliza los teléfonos ya guardados en crm_contacts.
//
// El formulario guarda el número NACIONAL y el país aparte, pero durante un
// tiempo guardó el campo crudo: hay filas con "+506 8888-8888" o "50688888888"
// dentro del número. Esto los deja todos en formato nacional, coherentes con
// lo que ya escribe el formulario.
//
// Uso:
//   node --env-file=.env.local scripts/normalizar-telefonos.mjs           (dry-run)
//   node --env-file=.env.local scripts/normalizar-telefonos.mjs --apply   (escribe)
//
// Reglas de seguridad:
//   - Solo toca filas donde el número se puede interpretar Y el resultado
//     cambia. Lo que no parsea se deja intacto y se lista aparte.
//   - Si el número resulta ser de otro país, corrige también phone_country.
//   - Con --apply escribe antes un respaldo JSON con los valores previos.
//
// Solo crm_contacts: crm_companies.phone y users.phone no tienen columna de
// país, así que normalizarlos exigiría adivinarlo. Se dejan como están.

import { createClient } from '@supabase/supabase-js'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

/** Devuelve {phone, country} normalizados, o null si no hay nada que cambiar. */
function normalizar(phone, country) {
  if (!phone || !phone.trim()) return null
  const iso = (country || 'CR').toUpperCase()
  let p
  try { p = parsePhoneNumberFromString(phone, iso) } catch { return null }
  if (!p?.isValid()) return null
  const nacional = p.formatNational()
  const paisNuevo = p.country ?? iso
  if (nacional === phone && paisNuevo === country) return null
  return { phone: nacional, country: paisNuevo }
}

const { data, error } = await sb
  .from('crm_contacts')
  .select('id,name,last_name,phone,phone_country,phone_alt,phone_alt_country')
if (error) { console.error('No se pudo leer:', error.message); process.exit(1) }

const cambios = []
const ilegibles = []

for (const c of data) {
  const patch = {}
  const antes = {}
  for (const [campoTel, campoPais] of [['phone', 'phone_country'], ['phone_alt', 'phone_alt_country']]) {
    const valor = c[campoTel]
    if (!valor || !valor.trim()) continue
    const n = normalizar(valor, c[campoPais])
    if (!n) {
      // Solo se reporta como ilegible si de verdad no parsea (no si ya estaba bien).
      const iso = (c[campoPais] || 'CR').toUpperCase()
      let p; try { p = parsePhoneNumberFromString(valor, iso) } catch { p = null }
      if (!p?.isValid()) ilegibles.push({ id: c.id, campo: campoTel, valor, pais: c[campoPais] })
      continue
    }
    antes[campoTel] = valor; antes[campoPais] = c[campoPais]
    patch[campoTel] = n.phone; patch[campoPais] = n.country
  }
  if (Object.keys(patch).length) {
    cambios.push({ id: c.id, nombre: [c.name, c.last_name].filter(Boolean).join(' '), antes, patch })
  }
}

console.log(`\nContactos leídos: ${data.length}`)
console.log(`A normalizar:     ${cambios.length}`)
console.log(`Ilegibles:        ${ilegibles.length}  (se dejan intactos)\n`)

for (const c of cambios.slice(0, 40)) {
  for (const k of Object.keys(c.patch)) {
    if (k.endsWith('_country')) continue
    const paisK = k === 'phone' ? 'phone_country' : 'phone_alt_country'
    const paisCambia = c.antes[paisK] !== c.patch[paisK] ? `  [país ${c.antes[paisK]} → ${c.patch[paisK]}]` : ''
    console.log(`  ${c.nombre.padEnd(28).slice(0, 28)} ${k.padEnd(9)} "${c.antes[k]}" → "${c.patch[k]}"${paisCambia}`)
  }
}
if (cambios.length > 40) console.log(`  … y ${cambios.length - 40} más`)

if (ilegibles.length) {
  console.log('\nNo se pudieron interpretar (quedan como están):')
  for (const i of ilegibles.slice(0, 20)) console.log(`  ${i.campo} "${i.valor}" [${i.pais}]`)
  if (ilegibles.length > 20) console.log(`  … y ${ilegibles.length - 20} más`)
}

if (!APPLY) {
  console.log('\nDRY-RUN: no se escribió nada. Repetir con --apply para aplicar.\n')
  process.exit(0)
}

if (!cambios.length) { console.log('\nNada que aplicar.\n'); process.exit(0) }

const respaldo = `respaldo-telefonos-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(respaldo, JSON.stringify(cambios, null, 2))
console.log(`\nRespaldo de los valores previos: ${respaldo}`)

let ok = 0, fallos = 0
for (const c of cambios) {
  const { error } = await sb.from('crm_contacts').update(c.patch).eq('id', c.id)
  if (error) { fallos++; console.error(`  ✗ ${c.nombre}: ${error.message}`) } else ok++
}
console.log(`\nActualizados: ${ok}   Fallidos: ${fallos}\n`)
