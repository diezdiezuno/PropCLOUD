'use client'

import { useState } from 'react'
import { track } from '@/lib/gtag'
import type { ContactoContent } from '@/types'

// Defaults genericos: el copy de cada oficina vive en la base
// (pages_config.settings.contacto_content), no en el componente.
const D = {
  heroTitle:  'Hablemos.',
  heroAccent: 'Estamos aquí.',
  heroText:   'Ya sea para comprar, vender, alquilar o simplemente conocer el mercado — un agente te atiende personalmente.',
  formTitle:  'Mandanos tu consulta y te respondemos hoy.',
  formText:   'Completá el formulario y un asesor se pondrá en contacto con vos a la brevedad.',
}

interface Props {
  content?: ContactoContent
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

export default function ContactoClientSunrise({ content = {}, whatsapp, email, address, instagram, facebook, linkedin, youtube, tiktok, twitter }: Props) {
  const heroTitle  = content.hero?.title  || D.heroTitle
  const heroAccent = content.hero?.accent || D.heroAccent
  const heroText   = content.hero?.text   || D.heroText
  const formTitle  = content.form?.title  || D.formTitle
  const formText   = content.form?.text   || D.formText
  const [name,      setName]      = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [phone,     setPhone]     = useState('')
  const [message,   setMessage]   = useState('')
  const [sent,      setSent]      = useState(false)
  const [sending,   setSending]   = useState(false)

  const socials = { instagram, facebook, linkedin, youtube, tiktok, twitter }
  const hasSocials = SOCIAL.some(s => !!socials[s.key])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !formEmail.trim()) return
    setSending(true)
    track('contact_form_submit', { source: 'contacto' })
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: formEmail, phone, message, source: 'contacto' }),
    }).catch(() => {})
    setSending(false)
    setSent(true)
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', fontFamily: 'var(--font-body,system-ui,sans-serif)' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(36px,4vw,56px) clamp(24px,3vw,48px) clamp(44px,5vw,68px)',
        maxWidth: 1440, margin: '0 auto',
      }}>
        <div style={{ maxWidth: 760 }}>
          <h1 style={{
            fontFamily: 'var(--font-heading,serif)',
            fontSize: 'clamp(52px,7vw,88px)',
            fontWeight: 900, lineHeight: .93,
            letterSpacing: '-.03em', marginBottom: 28,
          }}>
            {heroTitle}{' '}
            <span style={{
              background: 'linear-gradient(90deg,var(--primary,#6b2fa0),#D44E2A,#E8920A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>{heroAccent}</span>
          </h1>
          <p style={{
            fontSize: 'clamp(16px,1.8vw,20px)', fontWeight: 300,
            color: '#888480', lineHeight: 1.65, maxWidth: 580,
          }}>
            {heroText}
          </p>
        </div>
      </section>

      {/* ── CANALES DE CONTACTO ───────────────────────────────── */}
      {(whatsapp || email || address) && (
        <section style={{
          padding: '0 clamp(24px,3vw,48px) clamp(44px,5vw,60px)',
          maxWidth: 1440, margin: '0 auto',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${[whatsapp, email, address].filter(Boolean).length}, 1fr)`,
            gap: 2, background: '#e8e4df',
            border: '1px solid #e8e4df', borderRadius: 20, overflow: 'hidden',
          }}>
            {whatsapp && (
              <HoverCard href={`https://wa.me/${whatsapp.replace(/\D/g,'')}`}>
                <ContactCard icon="💬" label="WhatsApp" value={`+${whatsapp.replace(/^\+/,'')}`} cta="Escribir ahora →" />
              </HoverCard>
            )}
            {email && (
              <HoverCard href={`mailto:${email}`}>
                <ContactCard icon="✉️" label="Email" value={email} cta="Enviar correo →" />
              </HoverCard>
            )}
            {address && (
              <div style={{ background: '#fff', padding: 'clamp(24px,3vw,40px)' }}>
                <ContactCard icon="📍" label="Oficina" value={address} cta={null} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── FORMULARIO + REDES ───────────────────────────────── */}
      <section style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px) clamp(64px,6vw,88px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 'clamp(32px,5vw,72px)', alignItems: 'start' }}>

          {/* Left — label + socials */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 16, marginTop: 0 }}>
              Formulario de contacto
            </p>
            <h2 style={{
              fontFamily: 'var(--font-heading,serif)',
              fontSize: 'clamp(24px,2.8vw,38px)', fontWeight: 700,
              lineHeight: 1.15, letterSpacing: '-.02em',
              color: '#111', margin: '0 0 20px',
            }}>
              {formTitle}
            </h2>
            <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7, margin: '0 0 36px' }}>
              {formText}
            </p>

            {/* Social */}
            {hasSocials && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Seguinos
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SOCIAL.map(s => {
                    const href = socials[s.key]
                    if (!href) return null
                    return (
                      <a key={s.key} href={href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                        style={{
                          width: 42, height: 42, borderRadius: 10,
                          border: '1.5px solid #e8e4df', background: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#888', textDecoration: 'none', transition: 'color .15s, border-color .15s, background .15s',
                        }}
                        onMouseEnter={e => {
                          const el = e.currentTarget as HTMLAnchorElement
                          el.style.color = s.color
                          el.style.borderColor = s.color
                          el.style.background = `${s.color}10`
                        }}
                        onMouseLeave={e => {
                          const el = e.currentTarget as HTMLAnchorElement
                          el.style.color = '#888'
                          el.style.borderColor = '#e8e4df'
                          el.style.background = '#fff'
                        }}
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
          <div style={{
            background: 'linear-gradient(135deg,#f5f0fa 0%,#faf5eb 50%,#f0f5fa 100%)',
            border: '1px solid #e8e4df',
            borderRadius: 20, padding: 'clamp(28px,4vw,44px)',
          }}>
            {sent ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', textAlign: 'center', gap: 16, padding: '32px 0',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: '#fff', border: '1.5px solid #e8e4df',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                }}>✅</div>
                <h3 style={{
                  fontFamily: 'var(--font-heading,serif)',
                  fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0,
                }}>¡Mensaje enviado!</h3>
                <p style={{ fontSize: 14, color: '#888480', margin: 0, lineHeight: 1.6 }}>
                  Nos pondremos en contacto con vos a la brevedad.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Inp label="Nombre *"   value={name}      onChange={setName}      placeholder="Tu nombre" />
                  <Inp label="Email *"    value={formEmail} onChange={setFormEmail} placeholder="tu@email.com" type="email" />
                </div>
                <Inp label="Teléfono" value={phone} onChange={setPhone} placeholder="+506 8888-8888" type="tel" />
                <div>
                  <label style={labelSt}>Mensaje</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    placeholder="¿En qué podemos ayudarte?"
                    style={{ ...inpSt, resize: 'vertical', lineHeight: 1.6 }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !name.trim() || !formEmail.trim()}
                  style={{
                    padding: '14px 28px', borderRadius: 100,
                    background: '#111', color: '#fff',
                    border: 'none', fontSize: 14, fontWeight: 600,
                    cursor: (sending || !name.trim() || !formEmail.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (sending || !name.trim() || !formEmail.trim()) ? 0.5 : 1,
                    fontFamily: 'inherit', transition: 'opacity .15s',
                    alignSelf: 'flex-start',
                  }}
                >
                  {sending ? 'Enviando…' : 'Enviar mensaje →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────── */

function HoverCard({ href, children }: { href: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#111' : '#fff',
        padding: 'clamp(24px,3vw,40px)',
        textDecoration: 'none', display: 'block',
        transition: 'background .2s',
        color: hovered ? '#fff' : '#111',
      }}
      data-hovered={hovered}
    >
      {children}
    </a>
  )
}

function ContactCard({ icon, label, value, cta }: { icon: string; label: string; value: string; cta: string | null }) {
  // Inherit color from parent HoverCard via currentColor
  return (
    <div>
      <div style={{ fontSize: 28, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, color: 'inherit', opacity: .6 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'inherit', marginBottom: cta ? 12 : 0, lineHeight: 1.4 }}>
        {value}
      </div>
      {cta && (
        <div style={{ fontSize: 12, fontWeight: 500, color: 'inherit', opacity: .75 }}>{cta}</div>
      )}
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
