'use client'

import { usePreferences } from '@/lib/preferences'
import { SITE_URL, PAGE_COPY } from '@/lib/seo'
import { ringPrices } from '@/lib/ringGuide'
import { JsonLd } from '../_ui/JsonLd'

export function HomeStructuredData() {
	const language = usePreferences(s => s.language)
	return <JsonLd data={{ '@context': 'https://schema.org', '@graph': [
		{ '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Mesto Metal', alternateName: 'Место Металл', url: SITE_URL },
		{ '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'Mesto Metal', alternateName: 'Место Металл', url: SITE_URL, publisher: { '@id': `${SITE_URL}/#organization` }, inLanguage: ['en', 'ru'] },
		{ '@type': 'Product', '@id': `${SITE_URL}/#mountain-ring`, name: language === 'en' ? 'Custom topographic silver ring' : 'Серебряное кольцо с рельефом местности',
			description: PAGE_COPY['/'][language][1], image: `${SITE_URL}/hero/beshtau/poster.webp`, material: language === 'en' ? 'Silver' : 'Серебро',
			brand: { '@type': 'Brand', name: 'Mesto Metal' },
			offers: ringPrices(language).map(price => ({ '@type': 'Offer', name: price.label, price: price.amount, priceCurrency: price.currency, url: `${SITE_URL}/create?d=${price.detail}`, seller: { '@id': `${SITE_URL}/#organization` } })),
		},
	] }} />
}
