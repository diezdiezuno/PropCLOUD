import { headers } from 'next/headers'
import { getTenantByDomain } from '@/lib/tenant'
import MapView from '@/components/Map/MapView'

export default async function HomePage() {
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)

  const mapStyle = tenant?.theme?.mapStyle ?? 'mapbox://styles/mapbox/streets-v12'
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

  return (
    <div style={{ paddingTop: 'var(--nav-h)' }}>
      <MapView mapStyle={mapStyle} mapboxToken={mapboxToken} />
    </div>
  )
}
