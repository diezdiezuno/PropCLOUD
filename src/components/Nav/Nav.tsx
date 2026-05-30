'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useFilters, USD_STEPS, CRC_STEPS, stepToPrice, fmtPrice } from '@/contexts/FilterContext'
import type { ZoneCenter } from '@/contexts/FilterContext'
import { useLang, useUI } from '@/contexts/LanguageContext'
import type { UIStrings } from '@/contexts/LanguageContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Tenant, ZoneConfigItem, PageConfig } from '@/types'

// All predefined zones with optional fixed center [lng, lat, zoom]
const ALL_ZONES: [string, string, ZoneCenter?][] = [
  ['Curridabat', 'Curridabat'],
  ['Tres Ríos', 'La union'],
  ['San Pedro', 'Montes de Oca'],
  ['Escalante', 'Escalante', [-84.06344934624333, 9.936704621817613, 15]],
  ['Tibás', 'Tibas'],
  ['Moravia', 'Moravia'],
  ['Coronado', 'Coronado'],
  ['Escazú', 'Escazu'],
  ['Santa Ana', 'Santa Ana'],
  ['Rohrmoser', 'Pavas'],
  ['Nunciatura', 'Nunciatura', [-84.10319412103462, 9.936022992526121, 15]],
  ['La Garita', 'La Garita'],
  ['Cartago', 'Cartago'],
  ['Heredia', 'Heredia'],
  ['Alajuela', 'Alajuela'],
]

interface NavProps {
  tenant: Tenant | null
  zones?: ZoneConfigItem[] | null      // null = show all predefined zones
  pagesConfig?: PageConfig[] | null    // null = use defaults
}

// Default page link slugs / hrefs — labels are resolved from t at render time
const DEFAULT_LINK_DEFS = [
  { href: '/nosotros',      slug: 'nosotros',       defaultVisible: true },
  { href: '/agentes',       slug: 'agentes',        defaultVisible: false },
  { href: '/listar',        slug: 'listar',         defaultVisible: true },
  { href: '/reclutamiento', slug: 'reclutamiento',  defaultVisible: false },
  { href: '/contacto',      slug: 'contacto',       defaultVisible: true },
]

function getPageLinks(pagesConfig: PageConfig[] | null | undefined, t: UIStrings) {
  const slugLabel: Record<string, string> = {
    nosotros: t.navAbout,
    agentes: 'Agentes',
    listar: t.navListProperty,
    reclutamiento: t.navCareers,
    contacto: t.navContact,
  }
  const fixed = [
    { href: '/', label: t.navMap },
    { href: '/listings', label: t.navProperties },
  ]

  // Predefined configurable links — filter by visibility, sort by saved order
  const configurable = DEFAULT_LINK_DEFS
    .filter(link => {
      if (!pagesConfig) return link.defaultVisible
      const match = pagesConfig.find(p => p.slug === link.slug)
      return match ? match.visible : link.defaultVisible
    })
    .map(link => {
      const match = pagesConfig?.find(p => p.slug === link.slug)
      return {
        href: link.href,
        label: slugLabel[link.slug] ?? link.slug,
        order: match?.order ?? 99,
      }
    })

  // Custom pages — visible only, respect saved order
  const customs = (pagesConfig ?? [])
    .filter(p => p.custom && p.visible)
    .map(p => ({ href: `/${p.slug}`, label: p.title, order: p.order }))

  const sorted = [...configurable, ...customs].sort((a, b) => a.order - b.order)

  return [...fixed, ...sorted.map(({ href, label }) => ({ href, label }))]
}

// Parse user-typed price string: "2M" → 2000000, "500K" → 500000
function parseUserPrice(str: string): number {
  const s = str.toLowerCase().replace(/[$₡,\s]/g, '')
  if (s.endsWith('m')) return Math.round(parseFloat(s) * 1_000_000)
  if (s.endsWith('k')) return Math.round(parseFloat(s) * 1_000)
  return Math.round(parseFloat(s)) || 0
}

function formatForEdit(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K'
  return String(v)
}

function priceToStep(price: number, steps: number[]): number {
  let best = 0, minDiff = Infinity
  steps.forEach((p, i) => {
    const d = Math.abs(p - price)
    if (d < minDiff) { minDiff = d; best = Math.round(i * 100 / (steps.length - 1)) }
  })
  return best
}

export default function Nav({ tenant, zones, pagesConfig }: NavProps) {
  const pathname = usePathname()
  const isMap = pathname === '/'
  const isListings = pathname === '/listings'
  // sec-nav: all pages except map and listings (includes detail pages)
  const isSecNav = !isMap && !isListings

  const f = useFilters()
  const { lang, setLang, isPending } = useLang()
  const t = useUI()
  const isMobile = useIsMobile(768)
  const [advOpen, setAdvOpen] = useState(false)
  const [advAnimate, setAdvAnimate] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Price inline editing
  const [editingMin, setEditingMin] = useState(false)
  const [editingMax, setEditingMax] = useState(false)
  const [editVal, setEditVal] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const steps = f.currency === 'CRC' ? CRC_STEPS : USD_STEPS
  const pMin = stepToPrice(f.priceMinStep, steps)
  const pMax = stepToPrice(f.priceMaxStep, steps)
  const isMax = f.isMaxPrice()
  const maxLabel = f.currency === 'CRC' ? '₡1B+' : '$5M+'

  // Translated property types (computed from t)
  const PROPERTY_TYPES = [
    { value: '', label: t.ptAll },
    { value: 'Casa', label: t.ptHouse },
    { value: 'Apto', label: t.ptApt },
    { value: 'Lote', label: t.ptLand },
    { value: 'Multifamiliar', label: t.ptMultifamily },
    { value: 'Comercial', label: t.ptCommercial },
    { value: 'Oficina', label: t.ptOffice },
    { value: 'Bodega', label: t.ptWarehouse },
  ]

  // Zones to display: use rich ZoneConfigItem[] if provided, else fall back to ALL_ZONES
  const ZONES: { label: string; key: string; center?: ZoneCenter }[] = zones
    ? zones.filter(z => z.enabled).map(z => ({ label: z.label, key: z.key, center: z.center as ZoneCenter | undefined }))
    : ALL_ZONES.map(([label, key, center]) => ({ label, key, center }))

  const activeFilters = [
    f.tab !== 'sale',
    f.priceMinStep > 0,
    f.priceMaxStep < 100,
    f.minBeds > 0,
    f.minBaths > 0,
    f.propertyType !== '',
    f.keyword !== '',
    f.zone !== '',
    f.minConstruction > 0,
    f.minLot > 0,
  ].filter(Boolean).length

  // Update --nav-h via ResizeObserver
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const update = () => document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px')
    update()
    const ro = new ResizeObserver(update)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [])

  // Close menu on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Close mobile filter on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileFilterOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Auto-open advanced panel on listings page, close on map page
  useEffect(() => {
    if (isListings) { setAdvAnimate(true); setAdvOpen(true) }
    if (isMap) { setAdvAnimate(false); setAdvOpen(false) }
  }, [isListings, isMap])

  // Focus price input when editing starts
  useEffect(() => {
    if ((editingMin || editingMax) && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingMin, editingMax])

  function handleMin(v: number) {
    f.setPriceRange(Math.min(v, f.priceMaxStep - 1), f.priceMaxStep)
  }
  function handleMax(v: number) {
    f.setPriceRange(f.priceMinStep, Math.max(v, f.priceMinStep + 1))
  }

  function startEditMin() {
    setEditVal(formatForEdit(pMin))
    setEditingMin(true)
    setEditingMax(false)
  }
  function startEditMax() {
    setEditVal(formatForEdit(isMax ? stepToPrice(100, steps) : pMax))
    setEditingMax(true)
    setEditingMin(false)
  }
  function commitEdit(which: 'min' | 'max') {
    const parsed = Math.max(0, parseUserPrice(editVal))
    const step = priceToStep(parsed, steps)
    if (which === 'min') {
      f.setPriceRange(Math.min(step, f.priceMaxStep - 1), f.priceMaxStep)
    } else {
      f.setPriceRange(f.priceMinStep, Math.max(step, f.priceMinStep + 1))
    }
    setEditingMin(false)
    setEditingMax(false)
  }
  function cancelEdit() {
    setEditingMin(false)
    setEditingMax(false)
  }

  // ── SEC-NAV (static pages + detail: about, contact, listar, listings/[id], etc.) ────────────────────
  if (isSecNav) {
    const pageLinks = getPageLinks(pagesConfig, t)
    return (
      <>
        <nav ref={navRef} style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          background: '#fff', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center',
          height: 60, padding: '0 24px', gap: 6,
        }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: 8 }}>
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant?.name} style={{ height: 32, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontWeight: 800, fontSize: 16, color: '#111', letterSpacing: '-.02em' }}>{tenant?.name ?? 'PropCLOUD'}</span>
            )}
          </Link>

          <div style={{ flex: 1 }} />

          {/* Desktop: page links + lang toggle at the end */}
          {!isMobile && (
            <>
              {pageLinks.map(link => (
                <Link key={link.href} href={link.href}
                  style={{
                    fontSize: 13, fontWeight: pathname === link.href ? 600 : 400,
                    color: pathname === link.href ? '#111' : '#666',
                    textDecoration: 'none', padding: '8px 12px', borderRadius: 8,
                    background: pathname === link.href ? '#f5f5f7' : 'transparent',
                    transition: 'background .15s, color .15s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (pathname !== link.href) (e.currentTarget as HTMLAnchorElement).style.background = '#f5f5f7' }}
                  onMouseLeave={e => { if (pathname !== link.href) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                >{link.label}</Link>
              ))}
              <LangToggle lang={lang} setLang={setLang} isPending={isPending} />
            </>
          )}

          {/* Mobile: hamburger + lang toggle */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LangToggle lang={lang} setLang={setLang} isPending={isPending} />
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button onClick={() => setMenuOpen(o => !o)} style={{ width: 36, height: 36, background: '#fff', border: '1px solid #ddd', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15 }}>
                  ☰
                </button>
                {menuOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', minWidth: 200, zIndex: 10001, padding: 8 }}>
                    {pageLinks.map(link => (
                      <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                        style={{
                          display: 'block', padding: '12px 16px', textDecoration: 'none',
                          color: pathname === link.href ? '#111' : '#444', fontSize: 14,
                          fontWeight: pathname === link.href ? 600 : 500, borderRadius: 8,
                          background: pathname === link.href ? '#f5f5f7' : 'transparent',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={e => { if (pathname !== link.href) (e.currentTarget as HTMLAnchorElement).style.background = '#f7f7f7' }}
                        onMouseLeave={e => { if (pathname !== link.href) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                      >{link.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
        <style>{`@keyframes dropdownFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
      </>
    )
  }

  // ── MOBILE NAV (map page only) ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <nav ref={navRef} style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
          background: '#fff', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', height: 56,
        }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} style={{ height: 30, objectFit: 'contain' }} />
            ) : (
              <span style={{ fontWeight: 800, fontSize: 16, color: '#111', letterSpacing: '-.02em' }}>{tenant?.name ?? 'PropCLOUD'}</span>
            )}
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LangToggle lang={lang} setLang={setLang} isPending={isPending} />
            <button onClick={() => setMobileFilterOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: activeFilters > 0 ? '#1a1a1a' : '#fff',
              border: `1px solid ${activeFilters > 0 ? '#1a1a1a' : '#ddd'}`,
              borderRadius: 22, padding: '7px 14px', fontSize: 13,
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              color: activeFilters > 0 ? '#fff' : '#333',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {t.filters}
              {activeFilters > 0 && (
                <span style={{ background: 'var(--accent,#f5a623)', color: '#111', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}>
                  {activeFilters}
                </span>
              )}
            </button>

            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(o => !o)} style={{ width: 36, height: 36, background: '#fff', border: '1px solid #ddd', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15 }}>
                ☰
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', minWidth: 200, zIndex: 10001, padding: 8 }}>
                  {getPageLinks(pagesConfig, t).map(link => (
                    <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'block', padding: '12px 16px', textDecoration: 'none',
                        color: pathname === link.href ? '#111' : '#444', fontSize: 14,
                        fontWeight: pathname === link.href ? 600 : 500, borderRadius: 8,
                        background: pathname === link.href ? '#f5f5f7' : 'transparent',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => { if (pathname !== link.href) (e.currentTarget as HTMLAnchorElement).style.background = '#f7f7f7' }}
                      onMouseLeave={e => { if (pathname !== link.href) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                    >{link.label}</Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Mobile filter drawer */}
        {mobileFilterOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setMobileFilterOpen(false)}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: '0 0 32px', maxHeight: '90vh', overflowY: 'auto', animation: 'slideUp .25s cubic-bezier(0.4,0,0.2,1)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 16px', borderBottom: '1px solid #f0f0f0', marginTop: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{t.filters}</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {activeFilters > 0 && <button onClick={f.resetFilters} style={{ fontSize: 12, color: '#999', background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>{t.clearFilters}</button>}
                  <button onClick={() => setMobileFilterOpen(false)} style={{ fontSize: 12, fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit' }}>{t.applyFilters}</button>
                </div>
              </div>

              <div style={{ padding: '20px 20px 0' }}>
                <div style={{ marginBottom: 24 }}>
                  <FilterLabel>{t.transactionType}</FilterLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: 'sale', l: t.buy }, { v: 'rent', l: t.rent }].map(tab => (
                      <button key={tab.v} onClick={() => f.setTab(tab.v as 'sale' | 'rent')} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${f.tab === tab.v ? '#1a1a1a' : '#e0e0e0'}`, background: f.tab === tab.v ? '#1a1a1a' : '#fff', color: f.tab === tab.v ? '#fff' : '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{tab.l}</button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <FilterLabel>{t.price}</FilterLabel>
                    <CurrencyToggle currency={f.currency} onChange={f.setCurrency} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 10, textAlign: 'center' }}>
                    {fmtPrice(pMin, f.currency)} — {isMax ? maxLabel : fmtPrice(pMax, f.currency)}
                  </div>
                  <SliderTrack minStep={f.priceMinStep} maxStep={f.priceMaxStep} onMin={handleMin} onMax={handleMax} />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <FilterLabel>{t.keyword}</FilterLabel>
                  <input value={f.keyword} onChange={e => f.setKeyword(e.target.value)} placeholder={t.keywordPlaceholder} style={mobileInputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div>
                    <FilterLabel>{t.minBeds}</FilterLabel>
                    <select value={f.minBeds} onChange={e => f.setMinBeds(Number(e.target.value))} style={mobileInputStyle}>
                      <option value={0}>{t.any}</option>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+</option>)}
                    </select>
                  </div>
                  <div>
                    <FilterLabel>{t.minBaths}</FilterLabel>
                    <select value={f.minBaths} onChange={e => f.setMinBaths(Number(e.target.value))} style={mobileInputStyle}>
                      <option value={0}>{t.any}</option>
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}
                    </select>
                  </div>
                  <div>
                    <FilterLabel>{t.minBuiltMobile}</FilterLabel>
                    <input type="number" value={f.minConstruction || ''} onChange={e => f.setMinConstruction(Number(e.target.value) || 0)} placeholder="100" min={0} style={mobileInputStyle} />
                  </div>
                  <div>
                    <FilterLabel>{t.minLotMobile}</FilterLabel>
                    <input type="number" value={f.minLot || ''} onChange={e => f.setMinLot(Number(e.target.value) || 0)} placeholder="200" min={0} style={mobileInputStyle} />
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <FilterLabel>{t.propertyTypeLabel}</FilterLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PROPERTY_TYPES.map(type => (
                      <PillBtn key={type.value} active={f.propertyType === type.value} onClick={() => f.setPropertyType(type.value)}>{type.label}</PillBtn>
                    ))}
                  </div>
                </div>

                {ZONES.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <FilterLabel>{t.zoneLabel}</FilterLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {ZONES.map(({ label, key, center }) => (
                        <PillBtn key={key} active={f.zone === key} onClick={() => f.setZone(f.zone === key ? '' : key, f.zone === key ? undefined : center)}>{label}</PillBtn>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
      </>
    )
  }

  // ── DESKTOP NAV ─────────────────────────────────────────────────────────────
  return (
    <nav
      ref={navRef}
      id="main-nav"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
        background: '#fff', borderBottom: '1px solid #e0e0e0',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        flexWrap: 'wrap', alignContent: 'flex-start',
        padding: '8px 16px 0',
        columnGap: 8, rowGap: 0,
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', padding: '0 20px 0 8px', flexShrink: 0, alignSelf: 'center', textDecoration: 'none', minWidth: 120 }}>
        {tenant?.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} style={{ height: 34, objectFit: 'contain' }} />
        ) : (
          <span style={{ fontWeight: 800, fontSize: 16, color: '#111', letterSpacing: '-.02em' }}>{tenant?.name ?? 'PropCLOUD'}</span>
        )}
      </Link>

      {/* Center */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <NavTab active={f.tab === 'sale'} onClick={() => f.setTab('sale')} icon={<HouseIcon />} label={t.buy} />
          <NavTab active={f.tab === 'rent'} onClick={() => f.setTab('rent')} icon={<KeyIcon />} label={t.rent} />
        </div>

        <NavSep />

        {/* Price slider */}
        <div style={{ minWidth: 160, maxWidth: 300, flex: 1, padding: '0 12px', marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.price}</span>
              <CurrencyToggle currency={f.currency} onChange={f.setCurrency} />
            </div>
            {/* Editable price labels */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {editingMin ? (
                <input
                  ref={editInputRef}
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={() => commitEdit('min')}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit('min'); if (e.key === 'Escape') cancelEdit() }}
                  style={{ fontSize: 12, fontWeight: 700, color: '#111', border: 'none', borderBottom: '1px solid var(--accent,#f5a623)', background: 'transparent', width: 52, outline: 'none', padding: '0 2px', fontFamily: 'inherit' }}
                />
              ) : (
                <span
                  onClick={startEditMin}
                  title="Min"
                  style={{ fontSize: 12, fontWeight: 700, color: '#111', cursor: 'pointer', borderBottom: '1px dashed #ccc', padding: '0 2px', lineHeight: 1.4, transition: 'border-color .2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'var(--accent,#f5a623)'}
                  onMouseLeave={e => (e.currentTarget as HTMLSpanElement).style.borderBottomColor = '#ccc'}
                >
                  {fmtPrice(pMin, f.currency)}
                </span>
              )}
              <span style={{ color: '#ccc', fontSize: 11, margin: '0 2px' }}>—</span>
              {editingMax ? (
                <input
                  ref={editingMax ? editInputRef : undefined}
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={() => commitEdit('max')}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit('max'); if (e.key === 'Escape') cancelEdit() }}
                  style={{ fontSize: 12, fontWeight: 700, color: '#111', border: 'none', borderBottom: '1px solid var(--accent,#f5a623)', background: 'transparent', width: 52, outline: 'none', padding: '0 2px', fontFamily: 'inherit' }}
                />
              ) : (
                <span
                  onClick={startEditMax}
                  title="Max"
                  style={{ fontSize: 12, fontWeight: 700, color: '#111', cursor: 'pointer', borderBottom: '1px dashed #ccc', padding: '0 2px', lineHeight: 1.4, transition: 'border-color .2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'var(--accent,#f5a623)'}
                  onMouseLeave={e => (e.currentTarget as HTMLSpanElement).style.borderBottomColor = '#ccc'}
                >
                  {isMax ? maxLabel : fmtPrice(pMax, f.currency)}
                </span>
              )}
            </div>
          </div>
          <SliderTrack minStep={f.priceMinStep} maxStep={f.priceMaxStep} onMin={handleMin} onMax={handleMax} />
        </div>

        <NavSep />

        {/* Filtros */}
        <button
          onClick={() => setAdvOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#fff', border: '1px solid #ddd', borderRadius: 22,
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', marginLeft: 4,
            boxShadow: advOpen ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {t.filters} <span style={{ fontSize: 10 }}>{advOpen ? '▴' : '▾'}</span>
          {activeFilters > 0 && (
            <span style={{ background: 'var(--accent,#f5a623)', color: '#111', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Right: lang + menu */}
      <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative', justifyContent: 'flex-end' }}>
        <LangToggle lang={lang} setLang={setLang} isPending={isPending} />
        <button onClick={() => setMenuOpen(o => !o)} style={{ width: 40, height: 40, background: '#fff', border: '1px solid #ddd', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>
          ☰
        </button>
        {menuOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', minWidth: 220, zIndex: 10001, padding: 8, animation: 'dropdownFade .18s ease' }}>
            {getPageLinks(pagesConfig, t).map(link => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block', padding: '12px 16px', textDecoration: 'none',
                  color: pathname === link.href ? '#111' : '#444', fontSize: 14,
                  fontWeight: pathname === link.href ? 600 : 500, borderRadius: 8,
                  background: pathname === link.href ? '#f5f5f7' : 'transparent',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { if (pathname !== link.href) (e.currentTarget as HTMLAnchorElement).style.background = '#f7f7f7' }}
                onMouseLeave={e => { if (pathname !== link.href) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              >{link.label}</Link>
            ))}
          </div>
        )}
      </div>

      {/* Advanced search panel */}
      <div style={{
        flexBasis: '100%', width: '100%', order: 10,
        background: '#fafafa',
        maxHeight: advOpen ? 600 : 0,
        overflow: 'hidden',
        padding: advOpen ? '16px 24px' : '0 24px',
        borderTop: advOpen ? '1px solid #ebebeb' : '0px solid #ebebeb',
        transition: advAnimate ? 'max-height .35s cubic-bezier(0.4,0,0.2,1), padding .35s' : 'none',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 12 }}>
          <AdvField label={t.keyword}>
            <input value={f.keyword} onChange={e => f.setKeyword(e.target.value)} placeholder={t.keywordPlaceholder} style={advInputStyle} />
          </AdvField>
          <AdvField label={t.rooms}>
            <select value={f.minBeds} onChange={e => f.setMinBeds(Number(e.target.value))} style={advInputStyle}>
              <option value={0}>{t.any}</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+</option>)}
            </select>
          </AdvField>
          <AdvField label={t.bathrooms}>
            <select value={f.minBaths} onChange={e => f.setMinBaths(Number(e.target.value))} style={advInputStyle}>
              <option value={0}>{t.any}</option>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}
            </select>
          </AdvField>
          <AdvField label={t.minBuiltLabel}>
            <input type="number" value={f.minConstruction || ''} onChange={e => f.setMinConstruction(Number(e.target.value) || 0)} placeholder="100" min={0} style={advInputStyle} />
          </AdvField>
          <AdvField label={t.minLotLabel}>
            <input type="number" value={f.minLot || ''} onChange={e => f.setMinLot(Number(e.target.value) || 0)} placeholder="200" min={0} style={advInputStyle} />
          </AdvField>
          <button
            onClick={f.resetFilters}
            style={{ padding: '8px 12px', background: 'none', border: '1px solid #ddd', borderRadius: 5, fontSize: 12, color: '#999', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', alignSelf: 'flex-end', height: 35 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary,#6b2fa0)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary,#6b2fa0)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#ddd'; (e.currentTarget as HTMLButtonElement).style.color = '#999' }}
          >
            {t.clearFilters}
          </button>
        </div>

        {/* Property types */}
        <div style={{ paddingTop: 10, borderTop: '1px solid #f0f0f0', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>{t.propertyTypeLabel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PROPERTY_TYPES.map(type => (
              <PillBtn key={type.value} active={f.propertyType === type.value} onClick={() => f.setPropertyType(type.value)}>{type.label}</PillBtn>
            ))}
          </div>
        </div>

        {/* Zone pills */}
        {ZONES.length > 0 && (
          <div style={{ paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: 8 }}>{t.zoneLabel}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ZONES.map(({ label, key, center }) => (
                <PillBtn key={key} active={f.zone === key} onClick={() => f.setZone(f.zone === key ? '' : key, f.zone === key ? undefined : center)}>{label}</PillBtn>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>{children}</div>
}

function NavSep() {
  return <div style={{ width: 1, height: 36, background: '#e0e0e0', flexShrink: 0, margin: '0 4px' }} />
}

function NavTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      padding: '14px 26px',
      background: 'none', border: 'none',
      borderBottom: `1px solid ${active ? '#aaa' : 'transparent'}`,
      cursor: 'pointer', color: active ? '#1a1a1a' : '#bbb',
      fontFamily: 'inherit', outline: 'none',
      transition: 'color .25s',
    }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#666' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#bbb' }}
    >
      {icon}
      <span style={{ fontSize: '9.5px', fontWeight: 400, letterSpacing: '0.22em', textTransform: 'uppercase' }}>{label}</span>
    </button>
  )
}

function AdvField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#999', marginBottom: 5, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px',
      background: active ? '#1a1a1a' : '#f7f7f7',
      border: `1px solid ${active ? '#1a1a1a' : '#e8e8e8'}`,
      borderRadius: 24, fontSize: 13, fontFamily: 'inherit',
      color: active ? '#fff' : '#444',
      cursor: 'pointer', fontWeight: active ? 500 : 400,
      transition: 'all .2s',
    }}>
      {children}
    </button>
  )
}

function CurrencyToggle({ currency, onChange }: { currency: 'USD' | 'CRC'; onChange: (c: 'USD' | 'CRC') => void }) {
  return (
    <div style={{ display: 'flex', background: '#efefef', borderRadius: 10, padding: 2, gap: 1 }}>
      {(['USD', 'CRC'] as const).map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          padding: '1px 7px', border: 'none',
          background: currency === c ? '#fff' : 'transparent',
          borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer',
          color: currency === c ? '#111' : '#999', fontFamily: 'inherit',
          boxShadow: currency === c ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          transition: 'all .15s',
        }}>
          {c === 'USD' ? 'USD $' : 'CRC ₡'}
        </button>
      ))}
    </div>
  )
}

function SliderTrack({ minStep, maxStep, onMin, onMax }: { minStep: number; maxStep: number; onMin: (v: number) => void; onMax: (v: number) => void }) {
  return (
    <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: '#ddd', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: minStep + '%', width: (maxStep - minStep) + '%', height: 3, background: 'linear-gradient(90deg, var(--accent, #f5a623), var(--primary, #6b2fa0))', borderRadius: 2 }} />
      <input type="range" min={0} max={100} value={minStep} onChange={e => onMin(Number(e.target.value))} style={{ position: 'absolute', width: '100%' }} />
      <input type="range" min={0} max={100} value={maxStep} onChange={e => onMax(Number(e.target.value))} style={{ position: 'absolute', width: '100%' }} />
    </div>
  )
}

const advInputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '1px solid #ddd', borderRadius: 5,
  fontSize: 13, fontFamily: 'inherit', background: '#fafafa', outline: 'none', color: '#111',
}

const mobileInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: '#fafafa', outline: 'none', boxSizing: 'border-box',
}

function HouseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M11 15.5h9" />
      <path d="M17 12.5V9l-3 2.5" />
      <path d="M20 12.5V9" />
    </svg>
  )
}

function LangToggle({ lang, setLang, isPending }: { lang: string; setLang: (l: 'es' | 'en') => void; isPending?: boolean }) {
  return (
    <div style={{
      display: 'flex', background: '#f0f0f0', borderRadius: 20, padding: 2, gap: 1,
      opacity: isPending ? 0.55 : 1, transition: 'opacity .2s',
    }}>
      {(['es', 'en'] as const).map(l => (
        <button key={l} onClick={() => !isPending && setLang(l)} style={{
          padding: '3px 9px', borderRadius: 18, border: 'none',
          cursor: isPending ? 'default' : 'pointer',
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', letterSpacing: '0.04em',
          background: lang === l ? '#111' : 'transparent',
          color: lang === l ? (isPending ? '#aaa' : '#fff') : '#888',
          transition: 'background .15s, color .15s',
        }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
