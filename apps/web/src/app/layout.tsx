import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import './globals.css'
import { PreferencesProvider } from './_ui/PreferencesProvider'

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
	title: 'Mesto Metal — A ring with the landscape of your favourite place',
	description:
		'Create a unique ring with the topographic landscape of a place you love',
}

export const viewport: Viewport = { viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
			<head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=JSON.parse(localStorage.getItem('favplace:preferences')||'{}');document.documentElement.dataset.theme=p&&p.theme==='light'?'light':'dark';document.documentElement.lang=p&&p.language==='ru'?'ru':'en';}catch(e){}})();` }} /></head>
			<body className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
				<PreferencesProvider>{children}</PreferencesProvider>
			</body>
		</html>
	)
}
