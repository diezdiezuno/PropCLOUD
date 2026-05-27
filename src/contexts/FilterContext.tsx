'use client'

import { createContext, useContext, useState, useMemo, useRef, ReactNode } from 'react'
import type { Property } from '@/types'

export type Tab = 'sale' | 'rent'
export type Currency = 'USD' | 'CRC'

// Non-linear price steps (same as Sunrise reference)
export const USD_STEPS = [0,50000,100000,150000,200000,250000,300000,400000,500000,600000,750000,1000000,1500000,2000000,3000000,5000000,99000000]
export const CRC_STEPS = [0,10000000,20000000,40000000,60000000,80000000,100000000,150000000,200000000,300000000,500000000,750000000,1000000000,9900000000]

export function stepToPrice(step: number, steps: number[]): number {
  return steps[Math.round(step * (steps.length - 1) / 100)]
}

export function fmtPrice(v: number, currency: Currency): string {
  const sym = currency === 'CRC' ? '₡' : '$'
  if (currency === 'CRC') {
    if (v >= 1e9) return sym + (v / 1e9).toFixed(1).replace('.0', '') + 'B'
    if (v >= 1e6) return sym + Math.round(v / 1e6) + 'M'
    return sym + Math.round(v / 1000) + 'K'
  }
  if (v >= 1e6) return sym + (v / 1e6).toFixed(1).replace('.0', '') + 'M'
  if (v >= 1000) return sym + Math.round(v / 1000) + 'K'
  return sym + v.toLocaleString()
}

interface FilterState {
  tab: Tab
  currency: Currency
  priceMinStep: number
  priceMaxStep: number
  keyword: string
  minBeds: number
  minBaths: number
  propertyType: string
  zone: string
  minConstruction: number   // m² construcción mínimo
  minLot: number            // m² terreno mínimo
}

const DEFAULT: FilterState = {
  tab: 'sale',
  currency: 'USD',
  priceMinStep: 0,
  priceMaxStep: 100,
  keyword: '',
  minBeds: 0,
  minBaths: 0,
  propertyType: '',
  zone: '',
  minConstruction: 0,
  minLot: 0,
}

// [lng, lat, zoom] — optional predefined coordinates for a zone
export type ZoneCenter = [number, number, number]

interface FilterContextValue extends FilterState {
  setTab: (t: Tab) => void
  setCurrency: (c: Currency) => void
  setPriceRange: (min: number, max: number) => void
  setKeyword: (s: string) => void
  setMinBeds: (n: number) => void
  setMinBaths: (n: number) => void
  setPropertyType: (t: string) => void
  setZone: (zone: string, center?: ZoneCenter) => void
  setMinConstruction: (n: number) => void
  setMinLot: (n: number) => void
  resetFilters: () => void
  getSteps: () => number[]
  getPriceMin: () => number
  getPriceMax: () => number
  isMaxPrice: () => boolean
  // Map fly-to: MapView registers this, Nav calls it
  registerMapFlyTo: (fn: (center: ZoneCenter) => void) => void
  registerMapFitZone: (fn: (zone: string) => void) => void
}

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<FilterState>(DEFAULT)
  const flyToRef = useRef<((center: ZoneCenter) => void) | null>(null)
  const fitZoneRef = useRef<((zone: string) => void) | null>(null)

  const getSteps = () => s.currency === 'CRC' ? CRC_STEPS : USD_STEPS
  const getPriceMin = () => stepToPrice(s.priceMinStep, getSteps())
  const getPriceMax = () => stepToPrice(s.priceMaxStep, getSteps())
  const isMaxPrice = () => s.priceMaxStep >= 99

  const value: FilterContextValue = {
    ...s,
    setTab: (tab) => setS(f => ({ ...f, tab })),
    setCurrency: (currency) => setS(f => ({ ...f, currency, priceMinStep: 0, priceMaxStep: 100 })),
    setPriceRange: (priceMinStep, priceMaxStep) => setS(f => ({ ...f, priceMinStep, priceMaxStep })),
    setKeyword: (keyword) => setS(f => ({ ...f, keyword })),
    setMinBeds: (minBeds) => setS(f => ({ ...f, minBeds })),
    setMinBaths: (minBaths) => setS(f => ({ ...f, minBaths })),
    setPropertyType: (propertyType) => setS(f => ({ ...f, propertyType })),
    setMinConstruction: (minConstruction) => setS(f => ({ ...f, minConstruction })),
    setMinLot: (minLot) => setS(f => ({ ...f, minLot })),
    setZone: (zone, center) => {
      setS(f => ({ ...f, zone }))
      if (zone && center) {
        flyToRef.current?.(center)
      } else if (zone) {
        fitZoneRef.current?.(zone)
      } else {
        // Reset to default map center
        flyToRef.current?.([-84.2, 9.7, 8])
      }
    },
    resetFilters: () => {
      setS(DEFAULT)
      flyToRef.current?.([-84.2, 9.7, 8])
    },
    registerMapFlyTo: (fn) => { flyToRef.current = fn },
    registerMapFitZone: (fn) => { fitZoneRef.current = fn },
    getSteps,
    getPriceMin,
    getPriceMax,
    isMaxPrice,
  }

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be inside FilterProvider')
  return ctx
}

export function useFilteredProperties(properties: Property[]) {
  const f = useFilters()
  return useMemo(() => {
    const pMin = f.getPriceMin()
    const pMax = f.getPriceMax()
    const isMax = f.isMaxPrice()
    return properties.filter(p => {
      if (f.tab === 'sale' && p.transaction !== 'sale') return false
      if (f.tab === 'rent' && p.transaction !== 'rent') return false
      if (f.currency === 'USD' && p.currency !== 'USD') return false
      if (f.currency === 'CRC' && p.currency !== 'CRC') return false
      if (p.price < pMin) return false
      if (!isMax && p.price > pMax) return false
      if (f.minBeds && (p.bedrooms ?? 0) < f.minBeds) return false
      if (f.minBaths && (p.bathrooms ?? 0) < f.minBaths) return false
      if (f.minConstruction && (p.area_m2 ?? 0) < f.minConstruction) return false
      if (f.minLot && (p.lot_m2 ?? 0) < f.minLot) return false
      if (f.propertyType) {
        const type = (p.type ?? '').toLowerCase()
        if (!type.includes(f.propertyType.toLowerCase())) return false
      }
      if (f.zone) {
        const q = f.zone.toLowerCase()
        const loc = [p.city, p.country, p.address].filter(Boolean).join(' ').toLowerCase()
        if (!loc.includes(q)) return false
      }
      if (f.keyword) {
        const q = f.keyword.toLowerCase()
        const hay = [p.title, p.city, p.type, p.description, p.address].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, f.tab, f.currency, f.priceMinStep, f.priceMaxStep, f.minBeds, f.minBaths, f.propertyType, f.zone, f.keyword, f.minConstruction, f.minLot])
}
