import { headers } from 'next/headers'
import { getTenantByDomain, getTenantConfig } from '@/lib/tenant'
import MapViewWrapper from '@/components/Map/MapViewWrapper'
import LandingPage from '@/components/Landing/LandingPage'

export default async function HomePage() {
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)

  // No tenant → show Noduus marketing landing page
  if (!tenant) return <LandingPage />

  const config = await getTenantConfig(tenant.id).catch(() => null)

  const theme = tenant.theme ?? {}
  const mapStyle = theme.mapStyle ?? 'mapbox://styles/ssolorzano/cmp04iyh7000t01rw07qhd7eh'
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
      autoLightPreset={theme.autoLightPreset === true}
      show3dObjects={theme.show3dObjects !== false}
      showPoiLabels={theme.showPoiLabels !== false}
      showTransitLabels={theme.showTransitLabels !== false}
      showPlaceLabels={theme.showPlaceLabels !== false}
      showRoadLabels={theme.showRoadLabels !== false}
    />
  )
}
