import PropertyDetailClient from './PropertyDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  return <PropertyDetailClient id={id} />
}
