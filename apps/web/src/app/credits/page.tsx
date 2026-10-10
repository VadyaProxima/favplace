import type { Metadata } from 'next'
import { CreditsContent } from './CreditsContent'

export const metadata: Metadata = {
	title: 'Использованные материалы — Favplace',
	description:
		'Авторы и лицензии сторонних 3D-моделей, использованных в конструкторе Favplace.',
}

export default function CreditsPage() {
	return <CreditsContent />
}
