type GtagFn = (...args: unknown[]) => void

declare global {
  interface Window { gtag?: GtagFn }
}

/**
 * Fire a GA4 event. Safe to call even if GA isn't loaded (no-op).
 * Usage: track('whatsapp_click', { property_id: '123', property_title: 'Casa ...' })
 */
export function track(eventName: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}
