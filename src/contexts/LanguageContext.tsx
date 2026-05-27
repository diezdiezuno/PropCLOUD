'use client'

import { createContext, useContext, useState, useTransition } from 'react'
import type { Property } from '@/types'

export type Lang = 'es' | 'en'

// ── UI string translations ────────────────────────────────────────────────────

const ui_es = {
  // Prices
  priceOnRequest: 'Precio a consultar',
  perMonth: '/mes',
  // Actions
  share: 'Compartir',
  contact: 'Contactar',
  contactAgent: 'Contactar agente',
  contactOffice: 'Contactar oficina',
  // Stats labels
  bedrooms: 'Habitaciones',
  bathrooms: 'Baños',
  built: 'Construcción',
  lot: 'Lote',
  builtShort: 'm² Const.',
  lotShort: 'm² Lote',
  bedroomsLower: 'habitaciones',
  bathroomsLower: 'baños',
  builtLower: 'm² const.',
  lotLower: 'm² lote',
  // Section labels
  gallery: 'Galería',
  location: 'Ubicación',
  description: 'Descripción',
  viewOnGoogleMaps: 'Ver en Google Maps →',
  photos: 'fotos',
  viewPhotos: (n: number) => `Ver ${n} fotos`,
  // Contact form
  requestInfo: 'Solicitar información',
  fullName: 'Nombre completo',
  email: 'Correo electrónico',
  whatsapp: 'WhatsApp',
  interestedMsg: 'Me interesa esta propiedad...',
  inquirySent: 'Consulta enviada. Te contactaremos pronto.',
  sendInquiry: 'Enviar consulta →',
  fillNameEmail: 'Por favor completá nombre y correo.',
  // Toast / status
  linkCopied: 'Enlace copiado',
  // Not found
  propertyNotFound: 'Propiedad no encontrada',
  viewAllProperties: 'Ver todas las propiedades',
  // Interest block
  interestedTitle: '¿Te interesa esta propiedad?',
  agentContact24h: 'Un agente te contactará en menos de 24 horas',
  propertyQuote: 'Una propiedad diseñada para quienes aprecian lo extraordinario',
  // Contact person
  office: 'Oficina',
  // Listings page
  portfolio: 'Portafolio',
  allProperties: 'Todas las Propiedades',
  loading: 'Cargando...',
  propertiesFound: (n: number) => `${n} propiedades encontradas`,
  noResults: 'Sin resultados con esos filtros',
  rent: 'Alquiler',
  sale: 'Venta',
  bdrShort: 'Hab',
  bathShort: 'Baños',
  // Map
  propertiesInArea: 'propiedades en esta zona',
  loadingProperties: 'Cargando propiedades...',
}

const ui_en: typeof ui_es = {
  priceOnRequest: 'Price on request',
  perMonth: '/mo',
  share: 'Share',
  contact: 'Contact',
  contactAgent: 'Contact agent',
  contactOffice: 'Contact office',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  built: 'Built area',
  lot: 'Lot',
  builtShort: 'Built (m²)',
  lotShort: 'Lot (m²)',
  bedroomsLower: 'bedrooms',
  bathroomsLower: 'bathrooms',
  builtLower: 'built area',
  lotLower: 'lot area',
  gallery: 'Gallery',
  location: 'Location',
  description: 'Description',
  viewOnGoogleMaps: 'View on Google Maps →',
  photos: 'photos',
  viewPhotos: (n: number) => `View ${n} photos`,
  requestInfo: 'Request information',
  fullName: 'Full name',
  email: 'Email address',
  whatsapp: 'WhatsApp',
  interestedMsg: "I'm interested in this property...",
  inquirySent: "Inquiry sent. We'll contact you soon.",
  sendInquiry: 'Send inquiry →',
  fillNameEmail: 'Please fill in name and email.',
  linkCopied: 'Link copied',
  propertyNotFound: 'Property not found',
  viewAllProperties: 'View all properties',
  interestedTitle: 'Interested in this property?',
  agentContact24h: 'An agent will contact you within 24 hours',
  propertyQuote: 'A property designed for those who appreciate the extraordinary',
  office: 'Office',
  portfolio: 'Portfolio',
  allProperties: 'All Properties',
  loading: 'Loading...',
  propertiesFound: (n: number) => `${n} properties found`,
  noResults: 'No results with those filters',
  rent: 'Rent',
  sale: 'Sale',
  bdrShort: 'Bdr',
  bathShort: 'Bths',
  propertiesInArea: 'properties in this area',
  loadingProperties: 'Loading properties...',
}

export const UI = { es: ui_es, en: ui_en }
export type UIStrings = typeof ui_es

// ── Context ───────────────────────────────────────────────────────────────────

interface LanguageCtx {
  lang: Lang
  setLang: (l: Lang) => void
  isPending: boolean
}

const Ctx = createContext<LanguageCtx>({ lang: 'es', setLang: () => {}, isPending: false })

export function LanguageProvider({
  children,
  defaultLang = 'es',
}: {
  children: React.ReactNode
  defaultLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(defaultLang)
  const [isPending, startTransition] = useTransition()

  const setLang = (l: Lang) => startTransition(() => setLangState(l))

  return <Ctx.Provider value={{ lang, setLang, isPending }}>{children}</Ctx.Provider>
}

export function useLang() {
  return useContext(Ctx)
}

/** Returns the UI string dictionary for the current language */
export function useUI(): UIStrings {
  const { lang } = useContext(Ctx)
  return UI[lang]
}

/** Returns a property with title/description/type resolved to the given language */
export function locProp(p: Property, lang: Lang): Property {
  return {
    ...p,
    title:       (lang === 'es' ? p.title_es       : p.title_en)       ?? p.title_es       ?? p.title_en       ?? p.title,
    description: (lang === 'es' ? p.description_es : p.description_en) ?? p.description_es ?? p.description_en ?? p.description,
    type:        (lang === 'es' ? p.type_es         : p.type_en)         ?? p.type_es         ?? p.type_en         ?? p.type,
  }
}
