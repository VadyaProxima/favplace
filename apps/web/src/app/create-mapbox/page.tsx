import { notFound } from 'next/navigation'
import { CreateStudio } from '../create/_components/CreateStudio'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Mapbox — Место Металл',
	robots: { index: false, follow: false },
}

export default function CreateMapboxPage() {
	if (process.env.NODE_ENV !== 'development') notFound()
	return <CreateStudio terrainProvider="mapbox" />
}
