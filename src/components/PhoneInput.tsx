'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { COUNTRIES, isoToFlag, type Country } from '@/data/countries'
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

interface Props {
  phoneValue: string
  countryIso: string
  onPhoneChange: (value: string) => void
  onCountryChange: (iso: string) => void
  placeholder?: string
}

export default function PhoneInput({
  phoneValue,
  countryIso,
  onPhoneChange,
  onCountryChange,
  placeholder = '8888-1234',
}: Props) {
  const [open,    setOpen]    = useState(false)
  const [search,  setSearch]  = useState('')
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef  = useRef<HTMLInputElement>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  const country  = COUNTRIES.find(c => c.iso === countryIso) ?? COUNTRIES[0]
  const filtered = search.trim().length > 0
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search.replace(/\s/g, ''))
      )
    : COUNTRIES

  // Required for createPortal (SSR safety)
  useEffect(() => setMounted(true), [])

  function openDropdown() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, left: rect.left })
    }
    setSearch('')
    setOpen(true)
  }

  function select(c: Country) {
    onCountryChange(c.iso)
    setOpen(false)
  }

  // El campo guarda el número NACIONAL y el país va aparte, pero nada impedía
  // escribir "+506 8888-8888" acá adentro: eso se guardaba tal cual y por eso
  // el listado mostraba unos con código y otros sin él.
  //
  // Al salir del campo se normaliza, y solo si el número es válido —así no
  // pelea con lo que se está tecleando ni rompe un número a medio escribir.
  // Si pegaron uno internacional de otro país, además se mueve el dropdown.
  function normalizar() {
    if (!phoneValue.trim()) return
    const p = parsePhoneNumberFromString(phoneValue, countryIso as CountryCode)
    if (!p?.isValid()) return
    if (p.country && p.country !== countryIso) onCountryChange(p.country)
    const nacional = p.formatNational()
    if (nacional !== phoneValue) onPhoneChange(nacional)
  }

  // Auto-focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  // Close on outside click (mousedown on anything outside trigger + portal)
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      const portal = document.getElementById('phone-dropdown-portal')
      if (portal?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div style={{ display: 'flex', width: '100%' }}>

      {/* Country selector button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={e => { e.stopPropagation(); openDropdown() }}
        style={{
          height: 38, padding: '0 10px',
          border: '1px solid #e2e5ea', borderRight: 'none',
          borderRadius: '8px 0 0 8px', background: '#f4f5f7',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          gap: 5, fontFamily: 'inherit', whiteSpace: 'nowrap',
          flexShrink: 0, transition: 'background .1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#eaecf0')}
        onMouseLeave={e => (e.currentTarget.style.background = '#f4f5f7')}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{isoToFlag(country.iso)}</span>
        <span style={{ fontSize: 13, color: '#5a6070', fontWeight: 500 }}>{country.dialCode}</span>
        <span style={{ fontSize: 9, color: '#9ca3af' }}>▼</span>
      </button>

      {/* Phone number input */}
      <input
        type="tel"
        placeholder={placeholder}
        value={phoneValue}
        onChange={e => onPhoneChange(e.target.value)}
        onBlur={normalizar}
        style={{
          flex: 1, height: 38, padding: '0 12px',
          border: '1px solid #e2e5ea', borderLeft: 'none',
          borderRadius: '0 8px 8px 0', fontSize: 14,
          fontFamily: 'inherit', background: '#fff',
          color: '#0d0f12', outline: 'none',
          minWidth: 0, boxSizing: 'border-box',
        }}
      />

      {/* Dropdown — portaled to document.body to escape overflow/stacking context of the drawer */}
      {open && mounted && createPortal(
        <div
          id="phone-dropdown-portal"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: 280,
            background: '#fff',
            border: '1px solid #e2e5ea',
            borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,.14)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar país o código…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', height: 34, padding: '0 10px',
                border: '1px solid #e2e5ea', borderRadius: 6,
                fontSize: 13, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', background: '#f9fafb',
              }}
            />
          </div>

          {/* Country list */}
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                Sin resultados
              </div>
            ) : filtered.map(c => {
              const active = c.iso === countryIso
              return (
                <div
                  key={c.iso}
                  onClick={() => select(c)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 12px', cursor: 'pointer',
                    background: active ? '#eff6ff' : 'transparent',
                    borderLeft: `2px solid ${active ? '#1B6EF3' : 'transparent'}`,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = '#f4f5f7' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{isoToFlag(c.iso)}</span>
                  <span style={{ flex: 1, fontSize: 13, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>
                    {c.dialCode}
                  </span>
                </div>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
