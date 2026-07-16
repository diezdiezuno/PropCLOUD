'use client'

/* ══════════════════════════════════════════════════════════════
   Próximos eventos — agenda unificada del dashboard.

   Las tres fuentes (calendario, cumpleaños, contratos) se normalizan
   a UpcomingItem antes de pintar nada: cada provider devuelve
   UpcomingItem[], se hace merge + sort por fecha y se agrupa por día.
   Agregar una fuente nueva = un provider más, sin tocar el layout.
══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Icon, type IconName } from '@/lib/icons'

type Kind = 'evento' | 'cumple' | 'contrato'

interface UpcomingItem {
  id: string
  kind: Kind
  date: Date              // ocurrencia ya resuelta (cumpleaños = próxima)
  title: string
  subtitle?: string
  timeLabel?: string      // hora del evento / días restantes
  urgent?: boolean
  href?: string           // a dónde lleva el click (si no abre vCard)
  contactId?: string      // para abrir la vCard
  phone?: string | null
  phoneCountry?: string | null
  email?: string | null
  photoUrl?: string | null
  initials?: string
}

const KIND_META: Record<Kind, { label: string; icon: IconName; color: string; bg: string }> = {
  evento:   { label: 'Calendario', icon: 'calendar', color: '#1B6EF3', bg: '#EEF4FF' },
  cumple:   { label: 'Cumpleaños', icon: 'cake',     color: '#D4537E', bg: '#FBEAF0' },
  contrato: { label: 'Contratos',  icon: 'file',     color: '#B45309', bg: '#FEF3C7' },
}

/* ── Helpers de fecha ─────────────────────────────────────────── */
function midnight(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseDateOnly(s: string) {
  // 'YYYY-MM-DD' → mediodía local, evita corrimientos por zona horaria
  return new Date(s + 'T12:00:00')
}
function daysBetween(from: Date, to: Date) {
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86400000)
}
function dayLabel(d: Date, today: Date) {
  const diff = daysBetween(today, d)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  const fecha = d.toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' })
  return `En ${diff} días · ${fecha}`
}
// Próxima ocurrencia de un cumpleaños: mismo mes/día, este año o el siguiente.
function nextBirthday(birth: string, today: Date): { date: Date; turning: number } | null {
  const m = birth.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const [, y, mo, da] = m
  const bornYear = Number(y)
  let occ = new Date(today.getFullYear(), Number(mo) - 1, Number(da))
  if (midnight(occ) < midnight(today)) occ = new Date(today.getFullYear() + 1, Number(mo) - 1, Number(da))
  return { date: occ, turning: occ.getFullYear() - bornYear }
}
function initialsOf(name: string, last: string | null) {
  return ((name?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?'
}
function openWhatsapp(phone: string | null | undefined, country: string | null | undefined) {
  if (!phone) return
  const num = phone.replace(/[^0-9]/g, '')
  const dial = country === 'US' ? '1' : country === 'MX' ? '52' : '506'
  window.open(`https://wa.me/${num.length <= 8 ? dial + num : num}`, '_blank')
}

/* ── Providers ────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadEventos(sb: any, authId: string, from: Date, to: Date): Promise<UpcomingItem[]> {
  const ini = toISO(from), fin = toISO(to)
  const [{ data: privados }, { data: oficina }] = await Promise.all([
    // Privados: sin calendario y míos
    sb.from('eventos_calendario').select('id,titulo,fecha,hora_inicio,todo_dia,calendarios(nombre,color)')
      .is('calendario_id', null).eq('user_auth_id', authId).gte('fecha', ini).lte('fecha', fin),
    // Oficina: con calendario, para mí o para todos
    sb.from('eventos_calendario').select('id,titulo,fecha,hora_inicio,todo_dia,calendarios(nombre,color)')
      .not('calendario_id', 'is', null).gte('fecha', ini).lte('fecha', fin)
      .or(`user_auth_id.is.null,user_auth_id.eq.${authId}`),
  ])
  const seen = new Set<string>()
  const rows = [...(privados ?? []), ...(oficina ?? [])]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.filter((e: any) => !seen.has(e.id) && seen.add(e.id)).map((e: any) => ({
    id: `ev-${e.id}`,
    kind: 'evento' as const,
    date: parseDateOnly(e.fecha),
    title: e.titulo,
    subtitle: e.calendarios?.nombre ?? 'Mi calendario',
    timeLabel: e.todo_dia ? 'Todo el día' : (e.hora_inicio ?? undefined),
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadCumples(sb: any, userId: string, from: Date, to: Date): Promise<UpcomingItem[]> {
  // Solo mis contactos asignados. birth_date es recurrente: se filtra en
  // cliente calculando la próxima ocurrencia (no sirve un between por fecha).
  const { data } = await sb.from('crm_contact_agents')
    .select('crm_contacts(id,name,last_name,birth_date,photo_url,phone,phone_country,email,active)')
    .eq('user_id', userId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contacts = ((data ?? []) as any[]).map(r => r.crm_contacts).filter(Boolean)
  const out: UpcomingItem[] = []
  for (const c of contacts) {
    if (!c.birth_date || c.active === false) continue
    const nb = nextBirthday(c.birth_date, from)
    if (!nb || nb.date < midnight(from) || nb.date > to) continue
    out.push({
      id: `cu-${c.id}`,
      kind: 'cumple',
      date: nb.date,
      title: `${[c.name, c.last_name].filter(Boolean).join(' ')} cumple años`,
      subtitle: `Cumple ${nb.turning}`,
      contactId: c.id,
      phone: c.phone, phoneCountry: c.phone_country, email: c.email,
      photoUrl: c.photo_url, initials: initialsOf(c.name, c.last_name),
    })
  }
  return out
}

// Contratos por vencer. Ventana propia y más larga que la del resto: un
// contrato necesita más anticipación que un cumpleaños, así que mira al
// menos 60 días aunque el selector esté en 7 o 30.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadContratos(sb: any, from: Date, to: Date): Promise<UpcomingItem[]> {
  const hasta = new Date(Math.max(to.getTime(), from.getTime() + 60 * 86400000))
  const { data } = await sb.from('contracts')
    .select('id,end_date,kind,property_id,properties(title),crm_contacts(name,last_name)')
    .eq('status', 'vigente').eq('active', true)
    .gte('end_date', toISO(from)).lte('end_date', toISO(hasta))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(c => {
    const date = parseDateOnly(c.end_date)
    const dias = daysBetween(from, date)
    const dueño = c.crm_contacts ? [c.crm_contacts.name, c.crm_contacts.last_name].filter(Boolean).join(' ') : null
    const tipo  = c.kind ? c.kind[0].toUpperCase() + c.kind.slice(1) : 'Contrato'
    return {
      id: `co-${c.id}`,
      kind: 'contrato' as const,
      date,
      title: `Vence ${c.kind ?? 'contrato'} — ${c.properties?.title || 'Sin título'}`,
      subtitle: [tipo, dueño].filter(Boolean).join(' · '),
      timeLabel: dias === 0 ? 'Hoy' : `${dias} días`,
      urgent: dias <= 15,
      href: `/admin/propiedades/${c.property_id}?tab=4`,
    }
  })
}

/* ── Componente ───────────────────────────────────────────────── */
export default function ProximosEventos({ userId, onOpenContact, cardStyle, titleStyle }: {
  userId: string
  onOpenContact: (id: string) => void
  cardStyle: React.CSSProperties
  titleStyle: React.CSSProperties
}) {
  const [items,   setItems]   = useState<UpcomingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [days,    setDays]    = useState(30)
  const [filter,  setFilter]  = useState<Kind | null>(null)
  const [showAll, setShowAll] = useState(false)

  const CAP = 6   // la agenda no puede crecer sin tope: se muestran 6 y "ver todos"

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }
    const today = new Date()
    const to = new Date(); to.setDate(to.getDate() + days)
    const [ev, cu, co] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadEventos(sb as any, user.id, today, to),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadCumples(sb as any, userId, today, to),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loadContratos(sb as any, today, to),
    ])
    setItems([...ev, ...cu, ...co].sort((a, b) => a.date.getTime() - b.date.getTime()))
    setLoading(false)
  }, [userId, days])
  useEffect(() => { load() }, [load])

  const counts: Record<Kind, number> = {
    evento:   items.filter(i => i.kind === 'evento').length,
    cumple:   items.filter(i => i.kind === 'cumple').length,
    contrato: items.filter(i => i.kind === 'contrato').length,
  }
  const filtered = filter ? items.filter(i => i.kind === filter) : items
  const shown  = showAll ? filtered : filtered.slice(0, CAP)
  const hidden = filtered.length - shown.length

  // Agrupar por día conservando el orden cronológico
  const today = new Date()
  const groups: { label: string; items: UpcomingItem[] }[] = []
  for (const it of shown) {
    const label = dayLabel(it.date, today)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(it)
    else groups.push({ label, items: [it] })
  }

  const chip = (active: boolean, color: string, bg: string): React.CSSProperties => ({
    fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
    border: `1px solid ${active ? color : '#e2e5ea'}`,
    background: active ? bg : '#fff',
    color: active ? color : '#5a6070',
  })

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <h2 style={{ ...titleStyle, margin: 0 }}>Próximos eventos</h2>
        <select value={days} onChange={e => { setDays(Number(e.target.value)); setShowAll(false) }}
          style={{ height: 32, padding: '0 10px', border: '1px solid #e2e5ea', borderRadius: 8, fontSize: 13, background: '#fff', color: '#0d0f12', fontFamily: 'inherit', cursor: 'pointer' }}>
          <option value={7}>7 días</option>
          <option value={30}>30 días</option>
          <option value={90}>90 días</option>
        </select>
      </div>

      {/* Chips = contadores + filtro */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => { setFilter(null); setShowAll(false) }} style={chip(filter === null, '#0d0f12', '#F4F5F7')}>
          Todos · {items.length}
        </button>
        {(Object.keys(KIND_META) as Kind[]).map(k => (
          <button key={k} onClick={() => { setFilter(filter === k ? null : k); setShowAll(false) }} style={chip(filter === k, KIND_META[k].color, KIND_META[k].bg)}>
            <Icon name={KIND_META[k].icon} size={13} />
            {KIND_META[k].label} · {counts[k]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Cargando…</p>
      ) : shown.length === 0 ? (
        <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Nada próximo en los siguientes {days} días.</p>
      ) : (
        groups.map(g => (
          <div key={g.label}>
            <div style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 4px', fontWeight: 600 }}>{g.label}</div>
            {g.items.map(it => {
              const meta = KIND_META[it.kind]
              return (
                <div key={it.id}
                  onClick={() => {
                    if (it.contactId) onOpenContact(it.contactId)
                    else if (it.href) window.open(it.href, '_blank')
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderTop: '1px solid #eef0f2',
                    cursor: (it.contactId || it.href) ? 'pointer' : 'default',
                    ...(it.urgent ? { borderLeft: '3px solid #DC2626', paddingLeft: 10, background: '#FEF2F2' } : {}),
                  }}>
                  {/* Avatar (cumpleaños) o tile del tipo */}
                  {it.kind === 'cumple' ? (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: it.photoUrl ? 'transparent' : meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {it.photoUrl ? <img src={it.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : it.initials}
                    </div>
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={meta.icon} size={17} />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                    {it.subtitle && <div style={{ fontSize: 12, color: '#5a6070' }}>{it.subtitle}</div>}
                  </div>

                  {/* Cumpleaños: felicitar sin salir del dashboard */}
                  {it.kind === 'cumple' ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {it.phone && (
                        <button title="WhatsApp" onClick={() => openWhatsapp(it.phone, it.phoneCountry)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#25D366', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="message" size={15} color="#fff" />
                        </button>
                      )}
                      {it.email && (
                        <a href={`mailto:${it.email}`} title="Email"
                          style={{ width: 30, height: 30, borderRadius: 8, background: '#EA4335', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                          <Icon name="mail" size={15} color="#fff" />
                        </a>
                      )}
                    </div>
                  ) : it.timeLabel ? (
                    <span style={{ fontSize: 13, color: '#5a6070', flexShrink: 0, whiteSpace: 'nowrap' }}>{it.timeLabel}</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        ))
      )}

      {(hidden > 0 || showAll) && (
        <div style={{ borderTop: '1px solid #eef0f2', marginTop: 10, paddingTop: 10, textAlign: 'center' }}>
          <button onClick={() => setShowAll(!showAll)}
            style={{ fontSize: 12, fontWeight: 600, color: '#5a6070', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            {showAll ? 'Ver menos' : `Ver todos (${hidden} más)`}
          </button>
        </div>
      )}

      <div style={{ borderTop: '1px solid #eef0f2', marginTop: 12, paddingTop: 12, textAlign: 'center' }}>
        <a href="/admin/tools/calendario" style={{ fontSize: 13, fontWeight: 600, color: '#5a6070', textDecoration: 'none' }}>
          Ver calendario completo →
        </a>
      </div>
    </div>
  )
}
