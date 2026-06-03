'use client'

import { useState, useRef, useEffect } from 'react'
import { COUNTRIES, isoToFlag, type Country } from '@/data/countries'

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
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef  = useRef<HTMLButtonElement>(null)
  const searchRef   = useRef<HTMLInputElement>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  const country = COUNTRIES.find(c => c.iso === countryIso) ?? COUNTRIES[0]

  const filtered = search.trim().length > 0
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search.replace(/\s/g, ''))
      )
    : COUNTRIES

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

  // Auto-focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        // Check if click is inside the dropdown portal
        const portal = document.getElementById('phone-dropdown-portal')
        if (portal && portal.contains(target)) return
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      {/* Country button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        style={{
          height: 38,
          padding: '0 10px',
          border: '1px solid #e2e5ea',
          borderRight: 'none',
          borderRadius: '8px 0 0 8px',
          background: '#f4f5f7',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'background .1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#eaecf0')}
        onMouseLeave={e => (e.currentTarget.style.background = '#f4f5f7')}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{isoToFlag(country.iso)}</span>
        <span style={{ fontSize: 13, color: '#5a6070', fontWeight: 500 }}>{country.dialCode}</span>
        <span style={{ fontSize: 9, color: '#9ca3af' }}>▼</span>
      </button>

      {/* Number input */}
      <input
        type="tel"
        placeholder={placeholder}
        value={phoneValue}
        onChange={e => onPhoneChange(e.target.value)}
        style={{
          flex: 1,
          height: 38,
          padding: '0 12px',
          border: '1px solid #e2e5ea',
          borderLeft: 'none',
          borderRadius: '0 8px 8px 0',
          fontSize: 14,
          fontFamily: 'inherit',
          background: '#fff',
          color: '#0d0f12',
          outline: 'none',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      />

      {/* Dropdown — rendered via fixed position to escape overflow:hidden */}
      {open && (
        <div
          id="phone-dropdown-portal"
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
                width: '100%',
                height: 34,
                padding: '0 10px',
                border: '1px solid #e2e5ea',
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#f9fafb',
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                Sin resultados
              </div>
            ) : (
              filtered.map(c => {
                const active = c.iso === countryIso
                return (
                  <div
                    key={c.iso}
                    onClick={() => select(c)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 12px',
                      cursor: 'pointer',
                      background: active ? '#eff6ff' : 'transparent',
                      borderLeft: active ? '2px solid #1B6EF3' : '2px solid transparent',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = '#f4f5f7' }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{isoToFlag(c.iso)}</span>
                    <span style={{ flex: 1, fontSize: 13, color: '#0d0f12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {c.dialCode}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
