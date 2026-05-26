import dynamic from 'next/dynamic'
import { headers } from 'next/headers'
import { getTenantByDomain } from '@/lib/tenant'

const MapView = dynamic(() => import('@/components/Map/MapView'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 'calc(100vh - 68px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#aaa', fontSize: 14 }}>Cargando mapa...</span>
    </div>
  ),
})

export default async function HomePage() {
  const headersList = await headers()
  const domain = headersList.get('x-tenant-domain') ?? 'localhost'
  const tenant = await getTenantByDomain(domain).catch(() => null)

  const mapStyle = tenant?.theme?.mapStyle ?? 'mapbox://styles/mapbox/streets-v12'
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  return (
    <div style={{ paddingTop: 68 }}>
      <MapView mapStyle={mapStyle} mapboxToken={mapboxToken} />
    </div>
  )
}
