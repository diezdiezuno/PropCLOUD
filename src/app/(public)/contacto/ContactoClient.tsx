'use client'

import { useState } from 'react'

interface Props {
  whatsapp: string | null
  email: string | null
  address: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  youtube: string | null
  tiktok: string | null
  twitter: string | null
}

const SOCIAL = [
  { key: 'instagram', label: 'Instagram', color: '#E4405F', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".5" fill="currentColor"/></svg> },
  { key: 'facebook',  label: 'Facebook',  color: '#1877F2', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  { key: 'linkedin',  label: 'LinkedIn',  color: '#0A66C2', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { key: 'youtube',   label: 'YouTube',   color: '#FF0000', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
  { key: 'tiktok',    label: 'TikTok',    color: '#010101', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.28 8.28 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z"/></svg> },
  { key: 'twitter',   label: 'X',         color: '#000000', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.261 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg> },
] as const

export default function ContactoClient({ whatsapp, email, address, instagram, facebook, linkedin, youtube, tiktok, twitter }: Props) {
  const [name, setName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const socials = { instagram, facebook, linkedin, youtube, tiktok, twitter }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !formEmail.trim()) return
    setSending(true)
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: formEmail, phone, message, source: 'contacto' }),
    }).catch(() => {})
    setSending(false)
    setSent(true)
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', minHeight: '100vh', background: '#f9f9fb' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 700, color: 'var(--dark,#111)', marginBottom: 8 }}>
          Contacto
        </h1>
        <p style={{ color: '#888', fontSize: 15, marginBottom: 48 }}>Estamos para ayudarte.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)', gap: 40, alignItems: 'start' }}>

          {/* Left — info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {whatsapp && (
              <InfoRow icon="💬" label="WhatsApp">
                <a href={`https://wa.me/${whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--primary,#6b2fa0)', textDecoration: 'none', fontWeight: 500 }}>
                  +{whatsapp.replace(/^\+/,'')}
                </a>
              </InfoRow>
            )}
            {email && (
              <InfoRow icon="✉️" label="Email">
                <a href={`mailto:${email}`} style={{ color: 'var(--primary,#6b2fa0)', textDecoration: 'none', fontWeight: 500 }}>
                  {email}
                </a>
              </InfoRow>
            )}
            {address && (
              <InfoRow icon="📍" label="Dirección">
                <span style={{ color: '#555' }}>{address}</span>
              </InfoRow>
            )}

            {/* Social links */}
            {SOCIAL.some(s => !!socials[s.key]) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                  Redes sociales
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SOCIAL.map(s => {
                    const href = socials[s.key]
                    if (!href) return null
                    return (
                      <a key={s.key} href={href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                        style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', textDecoration: 'none', transition: 'color .15s, border-color .15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = s.color; (e.currentTarget as HTMLAnchorElement).style.borderColor = s.color }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#888'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e0e0e0' }}
                      >
                        {s.icon}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right — form */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', border: '1px solid #ebebeb' }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#111', marginBottom: 8 }}>¡Mensaje enviado!</div>
                <p style={{ color: '#888', fontSize: 14 }}>Nos pondremos en contacto a la brevedad.</p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 20 }}>Envianos un mensaje</div>
                <Inp label="Nombre *" value={name} onChange={setName} placeholder="Tu nombre" />
                <Inp label="Email *" value={formEmail} onChange={setFormEmail} placeholder="tu@email.com" type="email" />
                <Inp label="Teléfono" value={phone} onChange={setPhone} placeholder="+506 8888-8888" type="tel" />
                <div style={{ marginBottom: 16 }}>
                  <label style={labelSt}>Mensaje</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                    placeholder="¿En qué podemos ayudarte?"
                    style={{ ...inpSt, resize: 'none' }} />
                </div>
                <button type="submit" disabled={sending || !name.trim() || !formEmail.trim()}
                  style={{ width: '100%', padding: '13px', borderRadius: 10, background: 'var(--primary,#6b2fa0)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (sending || !name.trim() || !formEmail.trim()) ? 0.6 : 1 }}>
                  {sending ? 'Enviando…' : 'Enviar mensaje'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 15 }}>{children}</div>
      </div>
    </div>
  )
}

function Inp({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelSt}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inpSt} />
    </div>
  )
}

const labelSt: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }
const inpSt: React.CSSProperties = { width: '100%', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
