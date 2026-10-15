import type { MetadataRoute } from 'next'
import { SITE_URL, GUIDE_PATH, RU_GUIDE_PATH, guideAlternates } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		...['/', '/create', '/credits'].map(path => ({ url: `${SITE_URL}${path}` })),
		...[GUIDE_PATH, RU_GUIDE_PATH].map(path => ({ url: `${SITE_URL}${path}`, alternates: { languages: guideAlternates } })),
	]
}
