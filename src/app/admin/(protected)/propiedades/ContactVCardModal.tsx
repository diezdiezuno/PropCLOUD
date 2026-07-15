'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { glassScrim } from '@/lib/theme'
import { Icon, type IconName } from '@/lib/icons'

/* ── Types ───────────────────────────────────────────────────── */
interface DocUrl { path: string; name: string; size: number; uploaded_at: string }
interface ContactFull {
  id: string; name: string; last_name: string | null; photo_url: string | null
  cedula: string | null; cedula_tipo: string; birth_date: string | null
  phone: string | null; phone_country: string | null
  phone_alt: string | null; phone_alt_country: string | null
  email: string | null; notes: string | null; doc_urls: DocUrl[] | null
  instagram: string | null; linkedin: string | null; facebook: string | null
  tiktok: string | null; youtube: string | null; x: string | null
  crm_contact_types: { contact_types: { id?: string; name: string; color: string } | null }[] | null
  contact_sources: { name: string } | null
  crm_contact_companies: { crm_companies: { id: string; name: string; trade_name: string | null; cedula_juridica: string | null } | null }[] | null
  referred_by_user?: { name: string } | null
  referred_by_contact?: { name: string; last_name: string | null } | null
  referred_to_user?: { name: string } | null
  referred_to_contact?: { name: string; last_name: string | null } | null
}
function refName(u?: { name: string } | null, c?: { name: string; last_name: string | null } | null): string | null {
  if (u) return u.name
  if (c) return [c.name, c.last_name].filter(Boolean).join(' ')
  return null
}
interface CompanyFull {
  id: string; name: string; trade_name: string | null; cedula_juridica: string | null
}
interface LinkedContact {
  id: string; name: string; last_name: string | null; cedula: string | null; photo_url: string | null
}
interface OwnedProperty { id: string; title: string | null; crm_status: string | null; status: string | null }

export type VCardViewType = { type: 'contact' | 'company'; id: string }

/* ── Helpers ─────────────────────────────────────────────────── */
const AVATAR_PALETTE = [
  '#5B7FFF', '#E85D75', '#F59E0B', '#10B981',
  '#8B5CF6', '#EF4444', '#06B6D4', '#F97316',
  '#84CC16', '#EC4899', '#14B8A6', '#6366F1',
]
function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}
function getInitials(name: string, lastName: string | null) {
  return ((name?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?'
}
function coInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
function formatDateEsCR(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return dateStr }
}
function openWhatsapp(phone: string | null, country: string | null) {
  if (!phone) return
  const num = phone.replace(/[^0-9]/g, '')
  const dialCode = country === 'US' ? '1' : country === 'MX' ? '52' : '506'
  const full = num.length <= 8 ? dialCode + num : num
  window.open(`https://wa.me/${full}`, '_blank')
}

// ── Social icons ──────────────────────────────────────────────
const IgIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id="ig2" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#f09433"/><stop offset="50%" stopColor="#dc2743"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs>
    <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig2)" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4.5" stroke="url(#ig2)" strokeWidth="2"/>
    <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig2)"/>
  </svg>
)
const FbIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
const TkIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="#0d0f12"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.85a8.29 8.29 0 004.83 1.53V6.95a4.84 4.84 0 01-1.06-.26z"/></svg>
const LiIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
const YtIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
const XIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#000"/><path d="M17.75 4h-2.3L12 8.5 8.8 4H4l5.25 7L4 20h2.3L10 15l3.5 5H18l-5.5-7.5L17.75 4z" fill="#fff"/></svg>
const WaGlyph = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-2.9-.4-4.2-1.1l-.3-.18-2.85.89.9-2.78-.2-.32A8.2 8.2 0 1 1 12 20.2Zm4.6-6.13c-.25-.13-1.48-.73-1.71-.82-.23-.08-.4-.12-.56.13-.17.25-.64.81-.79.98-.14.16-.29.18-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.66-1.25-1.48-1.4-1.73-.14-.25-.01-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.03 0 1.2.87 2.36.99 2.52.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.48-.6 1.69-1.19.21-.58.21-1.08.14-1.19-.06-.11-.22-.17-.47-.29Z"/></svg>

/* ── Main component ───────────────────────────────────────────── */
export default function ContactVCardModal({ view, onClose }: { view: VCardViewType; onClose: () => void }) {
  const [contactData,  setContactData]  = useState<ContactFull | null>(null)
  const [companyData,  setCompanyData]  = useState<CompanyFull | null>(null)
  const [compContacts, setCompContacts] = useState<LinkedContact[]>([])
  const [properties,   setProperties]   = useState<OwnedProperty[]>([])
  const [loading,      setLoading]      = useState(true)
  const [docSignedUrls, setDocSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const sb = createClient()
    if (view.type === 'contact') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(sb as any).from('crm_contacts')
        .select('*, crm_contact_types(contact_types(id,name,color)), contact_sources(name), crm_contact_companies(crm_companies(id,name,trade_name,cedula_juridica)), referred_by_user:users!referred_by_user_id(name), referred_by_contact:crm_contacts!referred_by_contact_id(name,last_name), referred_to_user:users!referred_to_user_id(name), referred_to_contact:crm_contacts!referred_to_contact_id(name,last_name)')
        .eq('id', view.id).single()
        .then(({ data }: { data: ContactFull }) => { setContactData(data); setLoading(false) })
      // Propiedades donde el contacto es dueño/vendedor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(sb as any).from('properties')
        .select('id,title,crm_status,status,features')
        .ilike('features->>owners', `%"type":"contact","id":"${view.id}"%`)
        .then(({ data }: { data: OwnedProperty[] | null }) => setProperties(data ?? []))
    } else {
      Promise.all([
        sb.from('crm_companies').select('id,name,trade_name,cedula_juridica').eq('id', view.id).single(),
        sb.from('crm_contact_companies').select('crm_contacts(id,name,last_name,cedula,photo_url)').eq('company_id', view.id),
      ]).then(([{ data: co }, { data: links }]) => {
        setCompanyData(co as CompanyFull)
        setCompContacts((links as unknown as { crm_contacts: LinkedContact | null }[]).map(r => r.crm_contacts).filter(Boolean) as LinkedContact[])
        setLoading(false)
      })
    }
  }, [view.id, view.type])

  // Load signed URLs for docs
  useEffect(() => {
    if (!contactData?.doc_urls?.length) { setDocSignedUrls({}); return }
    const sb = createClient()
    Promise.all(
      contactData.doc_urls.map(async doc => {
        const { data } = await sb.storage.from('contact-docs').createSignedUrl(doc.path, 3600)
        return [doc.path, data?.signedUrl ?? ''] as [string, string]
      })
    ).then(results => setDocSignedUrls(Object.fromEntries(results)))
  }, [contactData])

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onClose])

  const avatarColor = contactData
    ? nameToColor(contactData.name + (contactData.last_name ?? ''))
    : companyData ? nameToColor(companyData.trade_name || companyData.name) : '#5a6070'

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, ...glassScrim, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{
        width: 400, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)',
        position: 'relative', paddingTop: 54, display: 'flex', flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Avatar (sobresale del cuadro) */}
        {!loading && (contactData || companyData) && (
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3,
            width: 108, height: 108, borderRadius: 30, overflow: 'hidden',
            background: contactData?.photo_url ? '#fff' : avatarColor + '22',
            border: '4px solid #fff', boxShadow: '0 8px 22px rgba(0,0,0,.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {contactData?.photo_url
              ? <img src={contactData.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 38, fontWeight: 800, color: avatarColor, letterSpacing: '-1px' }}>
                  {contactData ? getInitials(contactData.name, contactData.last_name) : coInitials(companyData!.trade_name || companyData!.name)}
                </span>}
          </div>
        )}

        {/* Cerrar */}
        <button onClick={onClose}
          style={{ position: 'absolute', top: 66, right: 14, zIndex: 4, width: 30, height: 30, borderRadius: '50%', border: '1px solid #E2E5EA', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#5a6070' }}>
          ✕
        </button>

        {/* Cuadro blanco */}
        <div style={{ background: '#fff', borderRadius: 22, boxShadow: '0 20px 60px rgba(0,0,0,.18)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ minHeight: 220, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14 }}>Cargando…</div>

          ) : view.type === 'contact' && contactData ? (
            <div style={{ overflowY: 'auto', padding: '64px 24px 22px' }}>
              {/* Cabecera centrada */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 23, fontWeight: 800, color: '#0d0f12', letterSpacing: '-.4px' }}>
                  {contactData.name}{contactData.last_name ? ' ' + contactData.last_name : ''}
                </div>
                {(() => {
                  const cTypes = (contactData.crm_contact_types ?? []).map(r => r.contact_types).filter(Boolean) as { id?: string; name: string; color: string }[]
                  if (cTypes.length === 0) return null
                  return (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                      {cTypes.map((t, i) => (
                        <span key={t.id ?? i} style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: (t.color || '#1B6EF3') + '22', color: t.color || '#1B6EF3' }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )
                })()}
                {(() => {
                  const cos = (contactData.crm_contact_companies ?? []).map(r => r.crm_companies).filter(Boolean)
                  if (!cos.length) return null
                  return (
                    <div style={{ marginTop: 8 }}>
                      {cos.map(co => (
                        <div key={co!.id} style={{ fontSize: 13, fontWeight: 600, color: '#5a6070' }}>{co!.trade_name || co!.name}</div>
                      ))}
                    </div>
                  )
                })()}

                {/* Botones de contacto (íconos a color) */}
                {(contactData.phone || contactData.email) && (
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
                    {contactData.phone && (
                      <button onClick={() => openWhatsapp(contactData.phone, contactData.phone_country)} title="WhatsApp"
                        style={actionBtnStyle('#25D366')}>
                        <WaGlyph />
                      </button>
                    )}
                    {contactData.phone && (
                      <a href={`tel:${contactData.phone}`} title="Llamar" style={actionBtnStyle('#0EA5E9')}>
                        <Icon name="phone" size={20} color="#fff" />
                      </a>
                    )}
                    {contactData.email && (
                      <a href={`mailto:${contactData.email}`} title="Email" style={actionBtnStyle('#EA4335')}>
                        <Icon name="mail" size={20} color="#fff" />
                      </a>
                    )}
                  </div>
                )}

                {/* Redes sociales */}
                {(() => {
                  const socials = [
                    { field: contactData.instagram, Ico: IgIcon, label: 'Instagram' },
                    { field: contactData.linkedin,  Ico: LiIcon, label: 'LinkedIn'  },
                    { field: contactData.facebook,  Ico: FbIcon, label: 'Facebook'  },
                    { field: contactData.tiktok,    Ico: TkIcon, label: 'TikTok'    },
                    { field: contactData.youtube,   Ico: YtIcon, label: 'YouTube'   },
                    { field: contactData.x,         Ico: XIcon,  label: 'X'         },
                  ].filter(s => !!s.field)
                  if (!socials.length) return null
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                      {socials.map(({ field, Ico, label }) => (
                        <a key={label} href={field!} target="_blank" rel="noreferrer" title={label}
                          style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid #e2e5ea', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                          <Ico />
                        </a>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Información */}
              <div style={{ height: 1, background: '#E2E5EA', margin: '20px 0 16px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contactData.cedula && (
                  <VCardRow icon="idCard" color="#5a6070" label="Cédula">
                    {contactData.cedula}
                    {contactData.cedula_tipo && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{contactData.cedula_tipo}</span>}
                  </VCardRow>
                )}
                {contactData.birth_date && (
                  <VCardRow icon="cake" color="#D97706" label="Nacimiento">{formatDateEsCR(contactData.birth_date)}</VCardRow>
                )}
                {contactData.phone && (
                  <VCardRow icon="smartphone" color="#128C48" label="Teléfono">{contactData.phone}</VCardRow>
                )}
                {contactData.phone_alt && (
                  <VCardRow icon="phone" color="#16A34A" label="Teléfono alternativo">{contactData.phone_alt}</VCardRow>
                )}
                {contactData.email && (
                  <VCardRow icon="mail" color="#1B6EF3" label="Email">
                    <a href={`mailto:${contactData.email}`} style={{ fontSize: 14, color: '#1B6EF3', textDecoration: 'none' }}>{contactData.email}</a>
                  </VCardRow>
                )}
                {(contactData.crm_contact_companies ?? []).map(r => r.crm_companies).filter(Boolean).map(co => (
                  <VCardRow key={co!.id} icon="building" color="#8a7a4a" label="Empresa">
                    <div>{co!.trade_name || co!.name}</div>
                    {co!.trade_name && <div style={{ fontSize: 12, color: '#5a6070' }}>{co!.name}</div>}
                    {co!.cedula_juridica && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{co!.cedula_juridica}</div>}
                  </VCardRow>
                ))}
                {contactData.contact_sources?.name && (
                  <VCardRow icon="broadcast" color="#D97706" label="Fuente">{contactData.contact_sources.name}</VCardRow>
                )}
                {refName(contactData.referred_by_user, contactData.referred_by_contact) && (
                  <VCardRow icon="user" color="#8B5CF6" label="Referido por">{refName(contactData.referred_by_user, contactData.referred_by_contact)}</VCardRow>
                )}
                {refName(contactData.referred_to_user, contactData.referred_to_contact) && (
                  <VCardRow icon="user" color="#EC4899" label="Referido a">{refName(contactData.referred_to_user, contactData.referred_to_contact)}</VCardRow>
                )}
              </div>

              {properties.length > 0 && (
                <>
                  <div style={{ height: 1, background: '#E2E5EA', margin: '16px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Propiedades ({properties.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {properties.map(p => (
                      <a key={p.id} href={`/admin/propiedades/${p.id}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #e2e5ea', textDecoration: 'none' }}>
                        <span style={{ flexShrink: 0, color: '#5a6070', display: 'flex' }}><Icon name="home" /></span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'Sin título'}</div>
                        <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{p.crm_status || p.status}</span>
                      </a>
                    ))}
                  </div>
                </>
              )}

              {contactData.notes && (
                <>
                  <div style={{ height: 1, background: '#E2E5EA', margin: '16px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Comentarios</div>
                  <div style={{ fontSize: 14, color: '#0d0f12', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{contactData.notes}</div>
                </>
              )}

              {contactData.doc_urls && contactData.doc_urls.length > 0 && (
                <>
                  <div style={{ height: 1, background: '#E2E5EA', margin: '16px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Documentos ({contactData.doc_urls.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {contactData.doc_urls.map(doc => {
                      const isPdf   = doc.name.toLowerCase().endsWith('.pdf')
                      const isImage = /\.(jpe?g|png|webp|gif|bmp|svg|heic|heif)$/i.test(doc.name)
                      const signedUrl = docSignedUrls[doc.path]
                      return (
                        <div key={doc.path}
                          onClick={async () => {
                            const sb = createClient()
                            const { data } = await sb.storage.from('contact-docs').createSignedUrl(doc.path, 3600)
                            if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                          }}
                          style={{ border: '1px solid #E2E5EA', borderRadius: 10, cursor: 'pointer', overflow: 'hidden' }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 10px rgba(0,0,0,.1)'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}
                        >
                          <div style={{ height: 100, background: isPdf ? '#FEE2E2' : '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {isImage && signedUrl
                              ? <img src={signedUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <><Icon name={isPdf ? 'file' : 'image'} size={28} color={isPdf ? '#DC2626' : '#5a6070'} />{isPdf && <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginLeft: 6 }}>PDF</span>}</>
                            }
                          </div>
                          <div style={{ padding: '6px 10px', fontSize: 12, color: '#5a6070', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <a href={`/admin/contactos?id=${view.id}`} target="_blank"
                  style={{ fontSize: 13, fontWeight: 600, color: '#5a6070', textDecoration: 'none' }}>Abrir en CRM ↗</a>
              </div>
            </div>

          ) : view.type === 'company' && companyData ? (
            <div style={{ overflowY: 'auto', padding: '64px 24px 22px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 23, fontWeight: 800, color: '#0d0f12', letterSpacing: '-.4px' }}>
                  {companyData.trade_name || companyData.name}
                </div>
                {companyData.trade_name && (
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{companyData.name}</div>
                )}
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: '#F59E0B22', color: '#D97706' }}>Jurídico</span>
                </div>
              </div>

              <div style={{ height: 1, background: '#E2E5EA', margin: '20px 0 16px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {companyData.cedula_juridica && (
                  <VCardRow icon="idCard" color="#5a6070" label="Cédula jurídica">{companyData.cedula_juridica}</VCardRow>
                )}
              </div>

              {compContacts.length > 0 && (
                <>
                  <div style={{ height: 1, background: '#E2E5EA', margin: '16px 0' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Personas físicas ({compContacts.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {compContacts.map(c => {
                      const cac  = nameToColor(c.name + (c.last_name ?? ''))
                      const init = getInitials(c.name, c.last_name)
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e2e5ea' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: c.photo_url ? 'transparent' : cac + '22', border: `2px solid ${cac}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: cac, flexShrink: 0 }}>
                            {c.photo_url ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : init}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#0d0f12' }}>{[c.name, c.last_name].filter(Boolean).join(' ')}</div>
                            {c.cedula && <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{c.cedula}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <a href={`/admin/empresas?id=${view.id}`} target="_blank"
                  style={{ fontSize: 13, fontWeight: 600, color: '#5a6070', textDecoration: 'none' }}>Abrir en CRM ↗</a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function actionBtnStyle(bg: string): React.CSSProperties {
  return { width: 46, height: 46, borderRadius: 14, background: bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', boxShadow: `0 4px 12px ${bg}55` }
}

function VCardRow({ icon, color, label, children }: { icon: IconName; color: string; bg?: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ display: 'flex', flexShrink: 0, color, marginTop: 1 }}><Icon name={icon} size={18} /></span>
      <div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{label}</div>
        <div style={{ fontSize: 14, color: '#0d0f12' }}>{children}</div>
      </div>
    </div>
  )
}
