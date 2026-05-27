'use client'

import { useState } from 'react'

interface Props {
  positions: string[]
  intro: string
  submissionWhatsapp: string | null
}

export default function ReclutamientoClient({ positions, intro, submissionWhatsapp }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSending(true)

    const details = [
      position && `Posición: ${position}`,
      phone && `Teléfono: ${phone}`,
      message && `Mensaje: ${message}`,
    ].filter(Boolean).join('\n')

    const fullMsg = `Solicitud de reclutamiento.\n\n${details}`

    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, message: fullMsg, source: 'reclutamiento' }),
    }).catch(() => {})

    if (submissionWhatsapp) {
      const text = `Hola, me interesa unirme al equipo.\n\nNombre: ${name}\nEmail: ${email}${position ? `\nPosición: ${position}` : ''}${phone ? `\nTeléfono: ${phone}` : ''}${message ? `\n\n${message}` : ''}`
      window.open(`https://wa.me/${submissionWhatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank')
    }

    setSending(false)
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh', background: '#f9f9fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 8 }}>¡Solicitud enviada!</div>
          <p style={{ color: '#888' }}>Revisaremos tu perfil y nos pondremos en contacto.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh', background: '#f9f9fb' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 700, color: 'var(--dark,#111)', marginBottom: 8 }}>
          Únete al equipo
        </h1>
        {intro ? (
          <p style={{ color: '#666', fontSize: 15, marginBottom: 36, lineHeight: 1.7 }}>{intro}</p>
        ) : (
          <p style={{ color: '#888', fontSize: 15, marginBottom: 36 }}>Completá el formulario y nos pondremos en contacto.</p>
        )}

        <form onSubmit={submit} style={{ background: '#fff', borderRadius: 16, padding: '32px', border: '1px solid #ebebeb', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Inp label="Nombre *" value={name} onChange={setName} placeholder="Tu nombre" />
            <Inp label="Email *" value={email} onChange={setEmail} placeholder="tu@email.com" type="email" />
          </div>

          <Inp label="Teléfono" value={phone} onChange={setPhone} placeholder="+506 8888-8888" type="tel" />

          {positions.length > 0 && (
            <div>
              <label style={labelSt}>Posición de interés</label>
              <select value={position} onChange={e => setPosition(e.target.value)} style={inpSt}>
                <option value="">Seleccionar…</option>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelSt}>Mensaje o presentación</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              placeholder="Contanos un poco sobre vos y tu experiencia…"
              style={{ ...inpSt, resize: 'none' }} />
          </div>

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
