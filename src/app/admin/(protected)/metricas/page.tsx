'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

interface Lead {
  id: string
  created_at: string
  source: string | null
  name: string | null
  email: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  contacto:      'Contacto',
  listar:        'Listar propiedad',
  reclutamiento: 'Reclutamiento',
  propiedad:     'Propiedad',
  whatsapp:      'WhatsApp',
}

function sourceLabel(s: string | null) {
  if (!s) return 'Sin fuente'
  return SOURCE_LABELS[s] ?? s
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })
}

function groupByDay(leads: Lead[]): { date: string; count: number }[] {
  const map: Record<string, number> = {}
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    map[d.toISOString().slice(0, 10)] = 0
  }
  for (const l of leads) {
    const day = l.created_at.slice(0, 10)
    if (day in map) map[day] = (map[day] ?? 0) + 1
  }
  return Object.entries(map).map(([date, count]) => ({ date, count }))
}

function groupBySource(leads: Lead[]): { source: string; count: number }[] {
  const map: Record<string, number> = {}
  for (const l of leads) {
    const s = l.source ?? 'Sin fuente'
    map[s] = (map[s] ?? 0) + 1
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count }))
}

export default function MetricasPage() {
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [gaId, setGaId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: adminRec } = await supabase
        .from('tenant_admins').select('tenant_id').eq('user_id', user.id).single()
      if (!adminRec) return

      const since = new Date()
      since.setDate(since.getDate() - 30)

      const [{ data: leadData }, { data: cfg }] = await Promise.all([
        supabase
          .from('leads')
          .select('id, created_at, source, name, email')
          .eq('tenant_id', adminRec.tenant_id)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('tenant_config')
          .select('ga_id')
          .eq('tenant_id', adminRec.tenant_id)
          .single(),
      ])

      setLeads((leadData as Lead[]) ?? [])
      setGaId((cfg as Record<string, string | null> | null)?.ga_id ?? null)
      setLoading(false)
    })
  }, [])

  const byDay = groupByDay(leads)
  const bySource = groupBySource(leads)
  const maxDay = Math.max(...byDay.map(d => d.count), 1)

  if (loading) return <div style={{ padding: 40, color: '#aaa', fontSize: 14 }}>Cargando…</div>

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 6px' }}>Métricas</h1>
        <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Últimos 30 días</p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <KpiCard value={leads.length} label="Leads totales" color="#6b2fa0" />
        <KpiCard value={leads.filter(l => l.source === 'contacto').length} label="Desde Contacto" color="#0A66C2" />
        <KpiCard value={leads.filter(l => l.source === 'listar').length} label="Listar propiedad" color="#38a169" />
      </div>

      {/* GA banner */}
      {gaId ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>📈</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>Google Analytics conectado</div>
            <div style={{ fontSize: 12, color: '#4ade80', fontFamily: 'monospace' }}>{gaId}</div>
          </div>
          <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer"
            style={{ padding: '8px 16px', background: '#166534', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Abrir Google Analytics →
          </a>
        </div>
      ) : (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div style={{ flex: 1, fontSize: 13, color: '#92400e' }}>
            Configurá tu Measurement ID en <strong>General → Analíticas</strong> para activar Google Analytics en tu sitio.
          </div>
          <a href="/admin/general"
            style={{ padding: '7px 14px', background: '#92400e', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            Configurar →
          </a>
        </div>
      )}

      {/* Chart */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', marginBottom: 16, border: '1px solid #ebebeb' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Leads por día
        </div>
        {leads.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#ccc', padding: '32px 0', fontSize: 14 }}>Sin datos en los últimos 30 días</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
            {byDay.map(({ date, count }) => (
              <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
                title={`${fmtDate(date)}: ${count} lead${count !== 1 ? 's' : ''}`}>
                <div style={{
                  width: '100%', minHeight: 3,
                  height: `${Math.max((count / maxDay) * 100, count > 0 ? 8 : 0)}%`,
                  background: count > 0 ? 'var(--primary,#6b2fa0)' : '#f0f0f0',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height .3s',
                }} />
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#ccc' }}>
          <span>{fmtDate(byDay[0]?.date ?? '')}</span>
          <span>Hoy</span>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12 }}>

        {/* By source */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', border: '1px solid #ebebeb' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Por fuente
          </div>
          {bySource.length === 0 ? (
            <div style={{ color: '#ccc', fontSize: 13 }}>Sin datos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bySource.map(({ source, count }) => (
                <div key={source} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 13, color: '#444', flex: 1 }}>{sourceLabel(source)}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', minWidth: 24, textAlign: 'right' }}>{count}</div>
                  <div style={{ width: 80, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / leads.length) * 100}%`, height: '100%', background: 'var(--primary,#6b2fa0)', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent leads */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', border: '1px solid #ebebeb' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Últimos leads
          </div>
          {leads.length === 0 ? (
            <div style={{ color: '#ccc', fontSize: 13 }}>Sin leads aún</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {leads.slice(0, 8).map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#f0e6ff,#c4b5fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6b2fa0', flexShrink: 0 }}>
                    {(l.name ?? '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name ?? 'Sin nombre'}</div>
                    <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.email ?? ''}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{fmtDate(l.created_at)}</div>
                    <div style={{ fontSize: 10, color: '#ccc' }}>{sourceLabel(l.source)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function KpiCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', border: '1px solid #ebebeb' }}>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#aaa', fontWeight: 500 }}>{label}</div>
    </div>
  )
}
