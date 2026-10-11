import type { Metadata } from 'next'
import { CreditsContent } from './CreditsContent'

export const metadata: Metadata = {
	title: 'Использованные материалы — Место Металл',
	description:
		'Авторы и лицензии сторонних 3D-моделей, использованных в конструкторе Место Металл.',
}

export default function CreditsPage() {
	return <CreditsContent />
}
