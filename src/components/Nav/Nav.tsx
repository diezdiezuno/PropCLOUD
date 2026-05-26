'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Tenant } from '@/types'

interface NavProps {
  tenant: Tenant | null
}

export default function Nav({ tenant }: NavProps) {
  const [tab, setTab] = useState<'sale' | 'rent'>('sale')
  const logo = tenant?.logo_url
  const name = tenant?.name ?? 'PropCLOUD'

  return (
    <nav
      id="main-nav"
      className="fixed top-0 left-0 right-0 z-[10000] bg-white border-b border-stone-100"
      style={{ height: 'var(--nav-h)' }}
    >
      <div className="flex items-center h-full px-6 gap-0">

        {/* Logo */}
        <Link href="/" className="flex items-center mr-4 flex-shrink-0">
          {logo ? (
            <img src={logo} alt={name} className="h-8 object-contain" />
          ) : (
            <span className="font-extrabold text-lg tracking-tight">{name}</span>
          )}
        </Link>

        {/* Tabs */}
        <div className="flex items-center">
          <TabBtn active={tab === 'sale'} onClick={() => setTab('sale')}>
            <HouseIcon />
            <span>Compra</span>
          </TabBtn>
          <TabBtn active={tab === 'rent'} onClick={() => setTab('rent')}>
            <KeyIcon />
            <span>Alquiler</span>
          </TabBtn>
        </div>

        <div className="flex-1" />

        {/* Right side links */}
        <div className="flex items-center gap-2">
          <NavLink href="/listings">Propiedades</NavLink>
          <NavLink href="/about">Nosotros</NavLink>
          <NavLink href="/contact">Contacto</NavLink>
        </div>

      </div>
    </nav>
  )
}

function TabBtn({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-[5px] px-5 py-3 border-b-2 text-[9.5px] font-normal tracking-[0.22em] uppercase transition-colors cursor-pointer bg-transparent outline-none
        ${active
          ? 'border-[#aaa] text-[#1a1a1a]'
          : 'border-transparent text-[#bbb] hover:text-[#666]'
        }`}
    >
      {children}
    </button>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[13px] font-medium text-[#555] hover:text-[#1a1a1a] px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
    >
      {children}
    </Link>
  )
}

function HouseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="3.5"/>
      <path d="M11 15.5h9"/>
      <path d="M17 12.5V9l-3 2.5"/>
      <path d="M20 12.5V9"/>
    </svg>
  )
}
