'use client'

import type { NosotrosContent } from '@/types'

// Valores por defecto deliberadamente genéricos: sirven de andamio para una
// oficina que todavía no cargó su texto. El copy de cada oficina vive en la
// base (pages_config.settings.nosotros_content), no acá.
const D = {
  heroTitle:  'Bienes raíces',
  heroAccent: 'de personas.',
  heroText:   'Acompañamos a nuestros clientes en cada etapa del proceso de compra, venta o alquiler, con conocimiento real del mercado y atención cercana.',
  stats: [] as { num: string; label: string }[],
  workEyebrow: 'Cómo trabajamos',
  workTitle:   'Proceso, claridad y acompañamiento.',
  workParagraphs: [
    'Combinamos experiencia inmobiliaria, mercadeo digital y fotografía profesional para posicionar cada propiedad de forma efectiva.',
  ],
  purposeEyebrow: 'Propósito',
  purposeTitle:   'Lo que nos mueve.',
  mission: 'Brindar un servicio inmobiliario profesional, estratégico y humano en cada etapa del proceso.',
  vision:  'Ser una inmobiliaria reconocida por su profesionalismo, innovación y excelencia en el servicio.',
  pillarsEyebrow: 'Nuestros pilares',
  pillarsTitle:   'Lo que nos define.',
  pillars: [] as { icon: string; label: string }[],
}

export default function NosotrosTemplate({ content = {} }: { content?: NosotrosContent }) {
  const heroTitle  = content.hero?.title  || D.heroTitle
  const heroAccent = content.hero?.accent || D.heroAccent
  const heroText   = content.hero?.text   || D.heroText
  const stats      = content.stats?.length ? content.stats : D.stats
  const workEyebrow = content.work?.eyebrow || D.workEyebrow
  const workTitle   = content.work?.title   || D.workTitle
  const workParagraphs = content.work?.paragraphs?.length ? content.work.paragraphs : D.workParagraphs
  const purposeEyebrow = content.purpose?.eyebrow || D.purposeEyebrow
  const purposeTitle   = content.purpose?.title   || D.purposeTitle
  const mission = content.purpose?.mission || D.mission
  const vision  = content.purpose?.vision  || D.vision
  const pillarsEyebrow = content.pillars?.eyebrow || D.pillarsEyebrow
  const pillarsTitle   = content.pillars?.title   || D.pillarsTitle
  const pillars = content.pillars?.items?.length ? content.pillars.items : D.pillars

  return (
    <div style={{ paddingTop: 'var(--nav-h,68px)', fontFamily: 'var(--font-body,system-ui,sans-serif)' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(36px,4vw,56px) clamp(24px,3vw,48px) clamp(44px,5vw,68px)',
        maxWidth: 1440, margin: '0 auto',
      }}>
        <div style={{ maxWidth: 860 }}>
            <h1 style={{
            fontFamily: 'var(--font-heading,serif)',
            fontSize: 'clamp(52px,7vw,88px)',
            fontWeight: 900, lineHeight: .93,
            letterSpacing: '-.03em', marginBottom: 36,
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
            color: '#888480', lineHeight: 1.7, marginBottom: 0, maxWidth: 780,
          }}>
            {heroText}
          </p>
        </div>

        {/* Stats */}
        {stats.length > 0 && <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap', marginTop: 56, paddingTop: 44, borderTop: '1px solid #e8e4df' }}>
          {stats.map(({ num, label }) => (
            <div key={label}>
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
        </div>}
      </section>

      {/* ── DESCRIPCIÓN ──────────────────────────────────────── */}
      <section style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(32px,5vw,80px)', alignItems: 'start' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 16, marginTop: 0 }}>
              {workEyebrow}
            </p>
            <h2 style={{
              fontFamily: 'var(--font-heading,serif)',
              fontSize: 'clamp(26px,3vw,40px)', fontWeight: 700,
              lineHeight: 1.15, letterSpacing: '-.02em', color: '#111',
              margin: '0 0 24px',
            }}>
              {workTitle}
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {workParagraphs.map((t, i) => (
              <p key={i} style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: 0 }}>{t}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISIÓN & VISIÓN ──────────────────────────────────── */}
      <section style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14, textAlign: 'center', marginTop: 0 }}>
          {purposeEyebrow}
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 48, textAlign: 'center', marginTop: 0,
        }}>
          {purposeTitle}
        </h2>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 2, background: '#e8e4df',
          border: '1px solid #e8e4df', borderRadius: 20, overflow: 'hidden',
        }}>
          {/* Misión */}
          <div style={{ background: '#111', padding: 'clamp(32px,4vw,52px)' }}>
            <div style={{
              fontFamily: 'var(--font-heading,serif)',
              fontSize: 'clamp(52px,6vw,72px)', fontWeight: 900, lineHeight: .9,
              letterSpacing: '-.03em', color: 'rgba(255,255,255,.08)',
              marginBottom: 24,
            }}>Misión</div>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.75)', lineHeight: 1.75, margin: 0 }}>
              {mission}
            </p>
          </div>

          {/* Visión */}
          <div style={{ background: '#fff', padding: 'clamp(32px,4vw,52px)' }}>
            <div style={{
              fontFamily: 'var(--font-heading,serif)',
              fontSize: 'clamp(52px,6vw,72px)', fontWeight: 900, lineHeight: .9,
              letterSpacing: '-.03em', color: 'rgba(0,0,0,.05)',
              marginBottom: 24,
            }}>Visión</div>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.75, margin: 0 }}>
              {vision}
            </p>
          </div>
        </div>
      </section>

      {/* ── PILARES ──────────────────────────────────────────── */}
      {pillars.length > 0 && <section style={{
        padding: 'clamp(44px,5vw,68px) clamp(24px,3vw,48px) clamp(64px,6vw,88px)',
        maxWidth: 1440, margin: '0 auto',
        borderTop: '1px solid #e8e4df',
      }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--primary,#6b2fa0)', marginBottom: 14, textAlign: 'center', marginTop: 0 }}>
          {pillarsEyebrow}
        </p>
        <h2 style={{
          fontFamily: 'var(--font-heading,serif)',
          fontSize: 'clamp(28px,3.5vw,46px)', fontWeight: 700,
          lineHeight: 1.1, letterSpacing: '-.02em',
          marginBottom: 48, textAlign: 'center', marginTop: 0,
        }}>
          {pillarsTitle}
        </h2>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {pillars.map(({ icon, label }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff', border: '1.5px solid #e8e4df',
              borderRadius: 100, padding: '14px 24px',
            }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{
                fontFamily: 'var(--font-heading,serif)',
                fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: '-.01em',
              }}>{label}</span>
            </div>
          ))}
        </div>
      </section>}

    </div>
  )
}
