'use client'

import { CreateStudio } from './_components/CreateStudio'

export default function CreatePage() {
	return <CreateStudio terrainProvider={process.env.NODE_ENV === 'development' ? 'terrarium' : undefined} />
}
