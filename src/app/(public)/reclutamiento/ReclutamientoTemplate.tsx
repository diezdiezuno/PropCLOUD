'use client'

import { useState, useRef } from 'react'
import { track } from '@/lib/gtag'
import { createClient } from '@/lib/supabase-browser'
import type { ReclutamientoContent } from '@/types'

// Defaults genericos: el copy y las zonas de cada oficina viven en la base
// (pages_config.settings.reclutamiento_content), no en el componente.
const D = {
  heroTitle:  'Tu carrera en',
  heroAccent: 'bienes raíces',
  heroTail:   'empieza aquí.',
  heroText:   'Sumate a nuestro equipo y desarrollá tu carrera en bienes raíces con acompañamiento profesional.',
  benefitsEyebrow: 'Por qué nosotros',
  benefitsTitle:   'Todo el respaldo que necesitás para vender y crecer.',
  benefits: [] as { id: string; icon: string; title: string; desc: string }[],
  // Las zonas no pueden faltar: el campo es obligatorio para enviar, así que
  // un select vacío deja el formulario imposible de completar. Las provincias
  // sirven de mínimo razonable hasta que la oficina cargue sus zonas.
  zoneGroups: [
    { label: 'Provincia', items: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón', 'Otra zona'] },
  ] as { label: string; items: string[] }[],
  successTitle: '¡Aplicación recibida!',
  successText:  'Gracias por tu interés. Te contactaremos en las próximas 24 horas.',
}

export default function ReclutamientoClient({ content = {} }: { content?: ReclutamientoContent }) {
  const heroTitle  = content.hero?.title  || D.heroTitle
  const heroAccent = content.hero?.accent || D.heroAccent
  const heroTail   = content.hero?.tail   || D.heroTail
  const heroText   = content.hero?.text   || D.heroText
  const benefitsEyebrow = content.benefits?.eyebrow || D.benefitsEyebrow
  const benefitsTitle   = content.benefits?.title   || D.benefitsTitle
  const BENEFITS = content.benefits?.items?.length ? content.benefits.items : D.benefits
  const zoneGroups = content.zones?.groups?.length ? content.zones.groups : D.zoneGroups
  const successTitle = content.success?.title || D.successTitle
  const successText  = content.success?.text  || D.successText
  const [nombre,     setNombre]     = useState('')
  const [apellido,   setApellido]   = useState('')
  const [telefono,   setTelefono]   = useState('')
  const [email,      setEmail]      = useState('')
  const [zona,       setZona]       = useState('')
  const [perfil,     setPerfil]     = useState('')
  const [ocupacion,  setOcupacion]  = useState('')
  const [motivacion, setMotivacion] = useState('')
  const [cvFile,     setCvFile]     = useState<File | null>(null)
  const [linkedin,   setLinkedin]   = useState('')
  const cvInputRef = useRef<HTMLInputElement>(null)
  const [zonaOtra,   setZonaOtra]   = useState('')
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)
  const [error,      setError]      = useState('')

  // Hover states
  const [hoveredBenefit, setHoveredBenefit] = useState<string | null>(null)
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null)

  const isOtherZona = zona === 'Otra zona del este' || zona === 'Otra zona' || !zona
  const finalZona   = zonaOtra.trim() ? zonaOtra.trim() : zona
  const canSubmit   = nombre.trim() && apellido.trim() && email.trim() && telefono.trim() && (zona || zonaOtra.trim()) && perfil

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSending(true)
    setError('')
    track('contact_form_submit', { source: 'reclutamiento', perfil })
    try {
      // Upload CV file if provided
      let cvLink = ''
      if (cvFile) {
        const supabase = createClient()
        const ext = cvFile.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('cv-uploads')
          .upload(path, cvFile, { upsert: false })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('cv-uploads').getPublicUrl(path)
          cvLink = urlData.publicUrl
        }
      }

      const res = await fetch('/api/recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, apellido, telefono, email, zona: finalZona, perfil, ocupacion, motivacion, cv_link: cvLink, linkedin }),
      })
      if (!res.ok) throw new Error()
      setSent(true)
    } catch {
      setError('Hubo un error al enviar. Por favor intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', fontFamily: 'var(--font-body,system-ui,sans-serif)' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center',
        padding: 'clamp(36px,4vw,56px) clamp(24px,3vw,48px) clamp(44px,5vw,68px)',
        maxWidth: 1440, margin: '0 auto',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(54px,7.5vw,96px)',
          fontWeight: 900, lineHeight: .93,
          letterSpacing: '-.03em', marginBottom: 28,
        }}>
          {heroTitle}{' '}
          <span style={{
            background: 'linear-gradient(90deg,var(--primary,#6b2fa0),#D44E2A,#E8920A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>{heroAccent}</span><br />
          {heroTail}
        </h1>

        <p style={{
          fontSize: 'clamp(16px,1.8vw,20px)', fontWeight: 300,
          color: '#888480', maxWidth: 720, lineHeight: 1.65, marginBottom: 44,
        }}>
          {heroText}
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 64 }}>
          <a href="#aplicar" style={{
            background: '#111', color: '#fff', fontSize: 15, fontWeight: 500,
            padding: '16px 36px', borderRadius: 100, textDecoration: 'none', display: 'inline-block',
          }}>Quiero unirme</a>
          <a href="#beneficios" style={{
            background: 'transparent', color: '#111', fontSize: 15, fontWeight: 400,
            padding: '16px 36px', borderRadius: 100, border: '1.5px solid #e8e4df',
            textDecoration: 'none', display: 'inline-block',
          }}>Conocé más</a>
        </div>

        <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { num: '+30',  label: 'Agentes activos' },
            { num: '#1',   label: 'Oficina en el GAM' },
            { num: '100%', label: 'Apoyo y entrenamiento' },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-heading,serif)',
                fontSize: 44, fontWeight: 700, lineHeight: 1,
                letterSpacing: '-.02em', color: '#111',
              }}>{num}</div>
              <div style={{ fontSize: 12, color: '#888480', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 6 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFICIOS ───────────────────────────────────────── */}
      <section id="beneficios" style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14, textAlign: 'center', width: '100%' }}>
          {benefitsEyebrow}
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 52, textAlign: 'center', width: '100%',
        }}>
          {benefitsTitle}
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
          gap: 1, background: '#e8e4df',
          border: '1px solid #e8e4df', borderRadius: 20, overflow: 'hidden',
        }}>
          {BENEFITS.map(({ id, icon, title, desc }) => {
            const isHov = hoveredBenefit === id
            return (
              <div
                key={id}
                onMouseEnter={() => setHoveredBenefit(id)}
                onMouseLeave={() => setHoveredBenefit(null)}
                style={{
                  background: isHov ? '#f7f6f4' : '#fff',
                  padding: '36px 32px',
                  position: 'relative', overflow: 'hidden',
                  transition: 'background .25s',
                }}
              >
                <span style={{ fontSize: 28, marginBottom: 18, display: 'block' }}>{icon}</span>
                <div style={{
                  fontFamily: 'var(--font-heading,serif)',
                  fontSize: 18, fontWeight: 700, marginBottom: 10, letterSpacing: '-.01em',
                }}>{title}</div>
                <p style={{ fontSize: 14, color: '#888480', lineHeight: 1.7, margin: 0 }}>{desc}</p>
                {/* Gradient bottom bar */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                  background: 'linear-gradient(90deg,var(--primary,#6b2fa0),#D44E2A,#E8920A,#F0C830)',
                  transform: isHov ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform .3s',
                }} />
              </div>
            )
          })}
        </div>
      </section>

      {/* ── PERFILES ─────────────────────────────────────────── */}
      <section id="perfiles" style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14 }}>
          ¿Para quién es esto?
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 52,
        }}>
          Buscamos agentes del este de San José y zonas aledañas.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Sin experiencia — featured dark */}
          <div
            onMouseEnter={() => setHoveredProfile('nuevo')}
            onMouseLeave={() => setHoveredProfile(null)}
            style={{
              background: '#111', borderRadius: 20, padding: '40px 36px', color: '#fff',
              transition: 'box-shadow .2s',
              boxShadow: hoveredProfile === 'nuevo' ? '0 12px 48px rgba(0,0,0,.18)' : '0 2px 12px rgba(0,0,0,.06)',
            }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase',
              padding: '5px 12px', borderRadius: 100, marginBottom: 20,
              background: 'rgba(232,146,10,.15)', color: '#E8920A',
              border: '1px solid rgba(232,146,10,.25)',
            }}>Sin experiencia</span>
            <h3 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 26, fontWeight: 700, marginBottom: 14, lineHeight: 1.2, letterSpacing: '-.02em' }}>
              Nuevo en bienes raíces
            </h3>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.5)', lineHeight: 1.65, marginBottom: 24 }}>
              No necesitás saber nada del sector. Con el apoyo del Team Leader y el Broker, te enseñamos todo desde el principio.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
              {[
                'Personas que quieren cambiar de carrera',
                'Profesionales que buscan independencia económica',
                'Estudiantes o recién graduados con ambición',
                'Emprendedores que buscan nuevas fuentes de ingresos',
              ].map(item => (
                <li key={item} style={{ fontSize: 14, color: 'rgba(255,255,255,.55)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#E8920A', flexShrink: 0 }}>→</span>{item}
                </li>
              ))}
            </ul>
          </div>

          {/* Con experiencia */}
          <div
            onMouseEnter={() => setHoveredProfile('exp')}
            onMouseLeave={() => setHoveredProfile(null)}
            style={{
              border: `1.5px solid ${hoveredProfile === 'exp' ? '#111' : '#e8e4df'}`,
              borderRadius: 20, padding: '40px 36px', background: '#fff',
              transition: 'border-color .2s, box-shadow .2s',
              boxShadow: hoveredProfile === 'exp' ? '0 8px 40px rgba(0,0,0,.06)' : 'none',
            }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 11, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase',
              padding: '5px 12px', borderRadius: 100, marginBottom: 20,
              background: 'rgba(107,63,160,.08)', color: 'var(--primary,#6b2fa0)',
              border: '1px solid rgba(107,63,160,.18)',
            }}>Con experiencia</span>
            <h3 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 26, fontWeight: 700, marginBottom: 14, lineHeight: 1.2, letterSpacing: '-.02em', color: '#111' }}>
              Agente inmobiliario activo
            </h3>
            <p style={{ fontSize: 15, color: '#888480', lineHeight: 1.65, marginBottom: 24 }}>
              Ya trabajás en el sector y querés el respaldo de un team líder especializado en tu misma zona.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 0, margin: 0 }}>
              {[
                'Agentes del este de San José y zonas aledañas',
                'Independientes que quieren crecer con equipo y oficina',
                'Agentes de otras franquicias que buscan más resultados',
                'Profesionales con cartera de clientes propia',
              ].map(item => (
                <li key={item} style={{ fontSize: 14, color: '#888480', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: 'var(--primary,#6b2fa0)', flexShrink: 0 }}>→</span>{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FORMULARIO ───────────────────────────────────────── */}
      <section id="aplicar" style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px) clamp(60px,6vw,80px)',
        maxWidth: 1100, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14 }}>
            Aplicá ahora
          </p>
          <h2 style={{
            fontFamily: 'var(--font-heading,serif)',
            fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700,
            letterSpacing: '-.02em', marginBottom: 14, lineHeight: 1.1,
          }}>
            Da el primer paso hoy.
          </h2>
          <p style={{ fontSize: 17, color: '#888480', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
            Llenás el formulario, te contactamos personalmente y conversamos sin ningún compromiso.
          </p>
        </div>

        {sent ? (
          <div style={{
            background: 'linear-gradient(135deg,#f5f0fa 0%,#faf5eb 50%,#f0f5fa 100%)',
            border: '1px solid #e8e4df',
            borderRadius: 24, padding: 'clamp(40px,6vw,60px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center', gap: 18,
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: '#fff', border: '1.5px solid #e8e4df',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
            }}>🌅</div>
            <h3 style={{ fontFamily: 'var(--font-heading,serif)', fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>
              {successTitle}
            </h3>
            <p style={{ fontSize: 15, color: '#888480', maxWidth: 380, lineHeight: 1.65, margin: 0 }}>
              {successText}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{
            background: 'linear-gradient(135deg,#f5f0fa 0%,#faf5eb 50%,#f0f5fa 100%)',
            border: '1px solid #e8e4df',
            borderRadius: 24, padding: 'clamp(32px,4vw,48px)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Fila 1 — Nombre | Apellido | WhatsApp | Email */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
                <FInp label="Nombre *"            value={nombre}   onChange={setNombre}   placeholder="Tu nombre" />
                <FInp label="Apellido *"           value={apellido} onChange={setApellido} placeholder="Tu apellido" />
                <FInp label="WhatsApp *"           value={telefono} onChange={setTelefono} placeholder="+506 8888 8888" type="tel" />
                <FInp label="Correo electrónico *" value={email}    onChange={setEmail}    placeholder="tu@correo.com" type="email" />
              </div>

              {/* Fila 2 — Zona dropdown + campo libre */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18 }}>
                <div>
                  <label style={labelSt}>Zona donde vivís *</label>
                  <select value={zona} onChange={e => setZona(e.target.value)} style={inpSt}>
                    <option value="" disabled>Seleccioná tu zona</option>
                    {zoneGroups.map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map(z => <option key={z} value={z}>{z}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <FInp
                  label="Otra zona (si no está en la lista)"
                  value={zonaOtra} onChange={setZonaOtra}
                  placeholder="Ej: Sabanilla, Alajuelita…"
                />
              </div>

              {/* Fila 3a — Perfil (fila completa, opciones en horizontal) */}
              <div>
                <label style={labelSt}>¿Cuál es tu perfil? *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    { value: 'nuevo',       label: 'Nuevo en bienes raíces' },
                    { value: 'experiencia', label: 'Agente con experiencia' },
                    { value: 'otro',        label: 'Explorando opciones' },
                  ].map(opt => (
                    <label key={opt.value} style={{
                      display: 'block', textAlign: 'center',
                      padding: '11px 14px', cursor: 'pointer',
                      border: `1.5px solid ${perfil === opt.value ? '#111' : '#e8e4df'}`,
                      borderRadius: 12,
                      fontSize: 13, fontWeight: perfil === opt.value ? 500 : 400,
                      color: perfil === opt.value ? '#111' : '#888480',
                      background: '#fff', textTransform: 'none',
                    }}>
                      <input type="radio" name="perfil" value={opt.value} checked={perfil === opt.value} onChange={() => setPerfil(opt.value)} style={{ display: 'none' }} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Fila 3b — Ocupación (fila completa) */}
              <FInp label="¿A qué te dedicás actualmente?" value={ocupacion} onChange={setOcupacion} placeholder="Ej: vendedor, administrador, estudiante..." />

              {/* Fila 4 — Motivación */}
              <div>
                <label style={labelSt}>¿Por qué te interesa el mundo inmobiliario?</label>
                <textarea value={motivacion} onChange={e => setMotivacion(e.target.value)}
                  placeholder="Contanos un poco sobre tus motivaciones..."
                  rows={4} style={{ ...inpSt, resize: 'vertical', lineHeight: 1.6, minHeight: 108 }} />
              </div>

              {/* Fila 5 — CV | LinkedIn */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                {/* CV file upload */}
                <div>
                  <label style={labelSt}>CV (opcional)</label>
                  <input
                    ref={cvInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={e => setCvFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => cvInputRef.current?.click()}
                    style={{
                      ...inpSt, width: '100%', cursor: 'pointer', textAlign: 'left',
                      color: cvFile ? '#111' : '#aaa',
                      display: 'flex', alignItems: 'center', gap: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <span style={{ fontSize: 15 }}>📎</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {cvFile ? cvFile.name : 'Adjuntar archivo PDF o Word…'}
                    </span>
                    {cvFile && (
                      <span
                        onClick={e => { e.stopPropagation(); setCvFile(null); if (cvInputRef.current) cvInputRef.current.value = '' }}
                        style={{ fontSize: 16, color: '#bbb', lineHeight: 1, flexShrink: 0 }}
                      >×</span>
                    )}
                  </button>
                  <p style={{ fontSize: 11, color: '#aaa', margin: '5px 0 0' }}>PDF, DOC o DOCX · máx. 5 MB</p>
                </div>
                <FInp label="LinkedIn (opcional)" value={linkedin} onChange={setLinkedin} placeholder="linkedin.com/in/tu-perfil" type="url" />
              </div>

              {/* Submit */}
              <div style={{ height: 1, background: '#e8e4df', margin: '4px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                {error && <p style={{ fontSize: 13, color: '#e53e3e', margin: 0 }}>{error}</p>}
                <button type="submit" disabled={sending || !canSubmit} style={{
                  width: '100%', background: '#111', color: '#fff',
                  fontSize: 16, fontWeight: 500,
                  padding: 18, borderRadius: 100, border: 'none',
                  cursor: (sending || !canSubmit) ? 'not-allowed' : 'pointer',
                  opacity: (sending || !canSubmit) ? 0.6 : 1,
                  fontFamily: 'inherit', letterSpacing: '.02em',
                }}>
                  {sending ? 'Enviando…' : 'Enviar mi aplicación →'}
                </button>
                <p style={{ fontSize: 12, color: '#888480', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                  Tu información es confidencial. Te contactaremos pronto.
                </p>
              </div>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function FInp({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={labelSt}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inpSt} />
    </div>
  )
}

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, letterSpacing: '.1em',
  textTransform: 'uppercase', color: '#888480', display: 'block', marginBottom: 7,
}
const inpSt: React.CSSProperties = {
  background: '#fff', border: '1.5px solid #e8e4df', borderRadius: 12,
  padding: '13px 16px', fontFamily: 'inherit',
  fontSize: 15, fontWeight: 300, color: '#111',
  outline: 'none', width: '100%', boxSizing: 'border-box', WebkitAppearance: 'none',
}
