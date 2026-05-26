'use client'

import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('./MapView'), { ssr: false })

interface Props {
  mapStyle: string
  mapboxToken: string
  mapCenter?: [number, number]
  mapZoom?: number
}

export default function MapViewWrapper(props: Props) {
  return <MapView {...props} />
}
