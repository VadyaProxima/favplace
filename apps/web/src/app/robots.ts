import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
	return {
		// Leave pages crawlable so crawlers can read canonical and noindex tags.
		// The common rule also permits search/answer crawlers without special exceptions.
		rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
		sitemap: `${SITE_URL}/sitemap.xml`,
	}
}
