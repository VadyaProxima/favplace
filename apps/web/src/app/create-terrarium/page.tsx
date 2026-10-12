import { notFound } from 'next/navigation'
import { CreateStudio } from '../create/_components/CreateStudio'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Terrarium — Место Металл',
	robots: { index: false, follow: false },
}

export default function CreateTerrariumPage() {
	if (process.env.NODE_ENV !== 'development') notFound()
	return <CreateStudio terrainProvider="terrarium" />
}
