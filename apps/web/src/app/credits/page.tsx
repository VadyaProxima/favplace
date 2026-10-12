import type { Metadata } from 'next'
import { CreditsContent } from './CreditsContent'

export const metadata: Metadata = {
	title: 'Авторы и материалы — Место Металл',
	description:
		'3D-визуализация Место Металл: авторы, источники моделей, окружение и лицензии материалов.',
}

export default function CreditsPage() {
	return <CreditsContent />
}
