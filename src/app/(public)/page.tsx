import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import MapViewWrapper from '@/components/Map/MapViewWrapper'
import LandingPage from '@/components/Landing/LandingPage'

export default async function HomePage() {
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)

  // No tenant → show PropCLOUD marketing landing page
  if (!tenant) return <LandingPage />

  const config = await getTenantConfig(tenant.id).catch(() => null)

  const mapStyle = tenant.theme?.mapStyle ?? 'mapbox://styles/mapbox/streets-v12'
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
  const mapCenter: [number, number] = [
    config?.map_center_lng ?? -84.0,
    config?.map_center_lat ?? 9.9,
  ]
  const mapZoom = config?.map_zoom ?? 7

  return (
    <MapViewWrapper
      mapStyle={mapStyle}
      mapboxToken={mapboxToken}
      mapCenter={mapCenter}
      mapZoom={mapZoom}
    />
  )
}
