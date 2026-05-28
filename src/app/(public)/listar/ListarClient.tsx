'use client'

import { useState } from 'react'
import { track } from '@/lib/gtag'

interface Props {
  fields: string[]
  intro: string
  submissionWhatsapp: string | null
}

const FIELD_LABELS: Record<string, string> = {
  phone:       'Teléfono',
  type:        'Tipo de propiedad',
  transaction: 'Tipo de transacción',
  price:       'Precio estimado',
  area:        'Área (m²)',
  lot:         'Lote (m²)',
  address:     'Dirección o zona',
  bedrooms:    'Habitaciones',
  bathrooms:   'Baños',
  description: 'Descripción',
}

const PROPERTY_TYPES = ['Casa', 'Apartamento', 'Local comercial', 'Oficina', 'Lote', 'Finca', 'Otro']

export default function ListarClient({ fields, intro, submissionWhatsapp }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  function set(key: string, val: string) { setValues(p => ({ ...p, [key]: val })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSending(true)
    track('contact_form_submit', { source: 'listar' })

    const details = Object.entries(values)
      .filter(([, v]) => v)
      .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`)
      .join('\n')
    const fullMsg = `Quiero listar mi propiedad.\n\n${details}`

    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone: values.phone ?? '', message: fullMsg, source: 'listar' }),
    }).catch(() => {})

    if (submissionWhatsapp) {
      const msg = encodeURIComponent(`Hola, quiero listar mi propiedad.\n\nNombre: ${name}\nEmail: ${email}\n${details}`)
      window.open(`https://wa.me/${submissionWhatsapp.replace(/\D/g,'')}?text=${msg}`, '_blank')
    }

    setSending(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh', background: '#f9f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>¡Solicitud enviada!</div>
          <p style={{ color: '#888' }}>Nos pondremos en contacto para continuar con el proceso.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh', background: '#f9f9fb' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 700, color: 'var(--dark,#111)', marginBottom: 8 }}>
          Listá tu propiedad
        </h1>
        {intro ? (
          <p style={{ color: '#666', fontSize: 15, marginBottom: 36, lineHeight: 1.7 }}>{intro}</p>
        ) : (
          <p style={{ color: '#888', fontSize: 15, marginBottom: 36 }}>Completá el formulario y un agente se comunicará con vos.</p>
        )}

        <form onSubmit={submit} style={{ background: '#fff', borderRadius: 16, padding: '32px', border: '1px solid #ebebeb', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Required */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Inp label="Nombre *" value={name} onChange={setName} placeholder="Tu nombre" />
            <Inp label="Email *" value={email} onChange={setEmail} placeholder="tu@email.com" type="email" />
          </div>

          {/* Optional fields */}
          {fields.includes('phone') && (
            <Inp label="Teléfono" value={values.phone??''} onChange={v => set('phone',v)} placeholder="+506 8888-8888" type="tel" />
          )}
          {fields.includes('type') && (
            <div>
              <label style={labelSt}>Tipo de propiedad</label>
              <select value={values.type??''} onChange={e => set('type',e.target.value)} style={inpSt}>
                <option value="">Seleccionar…</option>
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {fields.includes('transaction') && (
            <div>
              <label style={labelSt}>Tipo de transacción</label>
              <select value={values.transaction??''} onChange={e => set('transaction',e.target.value)} style={inpSt}>
                <option value="">Seleccionar…</option>
                <option value="Venta">Venta</option>
                <option value="Alquiler">Alquiler</option>
              </select>
            </div>
          )}
          {(fields.includes('area') || fields.includes('bedrooms') || fields.includes('bathrooms')) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {fields.includes('area') && <Inp label="Área (m²)" value={values.area??''} onChange={v => set('area',v)} placeholder="120" type="number" />}
              {fields.includes('bedrooms') && <Inp label="Habitaciones" value={values.bedrooms??''} onChange={v => set('bedrooms',v)} placeholder="3" type="number" />}
              {fields.includes('bathrooms') && <Inp label="Baños" value={values.bathrooms??''} onChange={v => set('bathrooms',v)} placeholder="2" type="number" />}
            </div>
          )}
          {fields.includes('price') && (
            <Inp label="Precio estimado" value={values.price??''} onChange={v => set('price',v)} placeholder="$250,000" />
          )}
          {fields.includes('address') && (
            <Inp label="Dirección o zona" value={values.address??''} onChange={v => set('address',v)} placeholder="Ej: Escazú, San Rafael" />
          )}
          {fields.includes('description') && (
            <div>
              <label style={labelSt}>Descripción</label>
              <textarea value={values.description??''} onChange={e => set('description',e.target.value)} rows={4}
                placeholder="Describí brevemente la propiedad…"
                style={{ ...inpSt, resize: 'none' }} />
            </div>
          )}

          <button type="submit" disabled={sending || !name.trim() || !email.trim()}
            style={{ padding: '13px', borderRadius: 10, background: 'var(--primary,#6b2fa0)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (sending || !name.trim() || !email.trim()) ? 0.6 : 1, marginTop: 4 }}>
            {sending ? 'Enviando…' : submissionWhatsapp ? '📲 Enviar por WhatsApp' : 'Enviar solicitud'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Inp({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={labelSt}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inpSt} />
    </div>
  )
}

const labelSt: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }
const inpSt: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }
