import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import './globals.css'

const display = Cormorant_Garamond({
	subsets: ['latin', 'cyrillic'],
	weight: ['500', '600', '700'],
	variable: '--font-display',
	display: 'swap',
})

const sans = Manrope({
	subsets: ['latin', 'cyrillic'],
	weight: ['300', '400', '500', '600', '700'],
	variable: '--font-sans',
	display: 'swap',
})

export const metadata: Metadata = {
	title: 'Favplace — Кольцо с рельефом любимого места',
	description:
		'Создайте уникальное кольцо с топографическим рельефом места, которое вам дорого',
}

export const viewport: Viewport = { viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ru" className={`${display.variable} ${sans.variable}`}>
			<body className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
				{children}
			</body>
		</html>
	)
}
