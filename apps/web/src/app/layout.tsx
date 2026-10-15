import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import './globals.css'
import { PreferencesProvider } from './_ui/PreferencesProvider'
import { SITE_URL } from '@/lib/seo'

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
	metadataBase: new URL(SITE_URL),
	applicationName: 'Mesto Metal',
	title: 'Mesto Metal — Custom Topographic Rings',
	robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
}

export const viewport: Viewport = { viewportFit: 'cover' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
			<head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=JSON.parse(localStorage.getItem('favplace:preferences')||'{}');document.documentElement.dataset.theme=p&&p.theme==='light'?'light':'dark';document.documentElement.lang=location.pathname==='/ru/guide/topographic-rings'?'ru':location.pathname==='/guide/topographic-rings'?'en':p&&p.language==='ru'?'ru':'en';}catch(e){}})();` }} /></head>
			<body className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
				<PreferencesProvider>{children}</PreferencesProvider>
			</body>
		</html>
	)
}
