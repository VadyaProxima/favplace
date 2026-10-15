import Link from 'next/link'
import { GUIDE_COPY, ringPrices, ringQuestions, type GuideLanguage } from '@/lib/ringGuide'
import { GUIDE_PATH, RU_GUIDE_PATH, SITE_URL } from '@/lib/seo'
import { JsonLd } from '../_ui/JsonLd'
import { GuideStudioLink } from '../_ui/GuideStudioLink'

export function RingGuide({ language }: { language: GuideLanguage }) {
	const copy = GUIDE_COPY[language]
	const path = language === 'en' ? GUIDE_PATH : RU_GUIDE_PATH
	const url = `${SITE_URL}${path}`
	return <main lang={language} className="min-h-screen bg-white px-5 py-8 text-zinc-900 md:px-8">
		<JsonLd data={{ '@context': 'https://schema.org', '@graph': [
			{ '@type': 'Article', '@id': `${url}#article`, headline: copy.heading, description: copy.description, inLanguage: language, mainEntityOfPage: url,
				author: { '@type': 'Organization', name: 'Mesto Metal', url: SITE_URL }, image: `${SITE_URL}/hero/beshtau/poster.webp` },
			{ '@type': 'BreadcrumbList', itemListElement: [
				{ '@type': 'ListItem', position: 1, name: copy.home, item: SITE_URL },
				{ '@type': 'ListItem', position: 2, name: copy.guide, item: url },
			] },
		] }} />
		<header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-6">
			<Link href="/" className="font-display text-3xl">{language === 'en' ? 'Mesto Metal' : 'Место Металл'}</Link>
			<nav aria-label={language === 'en' ? 'Page navigation' : 'Навигация страницы'} className="flex gap-6 text-sm">
				<Link href={language === 'en' ? RU_GUIDE_PATH : GUIDE_PATH} hrefLang={language === 'en' ? 'ru' : 'en'} lang={language === 'en' ? 'ru' : 'en'} className="underline underline-offset-4">{language === 'en' ? 'Русский' : 'English'}</Link>
				<GuideStudioLink language={language}>{copy.studio} ↗</GuideStudioLink>
			</nav>
		</header>
		<article className="mx-auto max-w-3xl py-12 md:py-20">
			<nav aria-label={language === 'en' ? 'Breadcrumb' : 'Хлебные крошки'} className="mb-8 text-sm text-zinc-500"><Link href="/" className="underline underline-offset-4">{copy.home}</Link> / <span aria-current="page">{copy.guide}</span></nav>
			<h1 className="font-display text-5xl leading-tight md:text-6xl">{copy.heading}</h1>
			<p className="mt-6 text-lg leading-relaxed text-zinc-600">{copy.intro}</p>
			<figure className="mt-8">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img src="/hero/beshtau/poster.webp" alt={language === 'en' ? '3D design preview of a silver ring with the terrain of Mount Beshtau' : '3D-превью серебряного кольца с рельефом Бештау'} width="960" height="787" className="h-auto w-full rounded-2xl" decoding="async" />
				<figcaption className="mt-3 text-sm text-zinc-500">{language === 'en' ? 'Mount Beshtau: the default design in the studio. 3D preview.' : 'Бештау: начальный дизайн в конструкторе. 3D-превью.'}</figcaption>
			</figure>
			{copy.sections.map((section, index) => <section key={section.title} id={`step-${index + 1}`} className="mt-10">
				<h2 className="font-display text-3xl">{section.title}</h2><p className="mt-3 leading-relaxed text-zinc-600">{section.text}</p>
			</section>)}
			<p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-500"><a href="https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/" className="underline underline-offset-4">Mapbox Terrain-RGB ↗</a><a href="https://github.com/tilezen/joerd/blob/master/docs/formats.md" className="underline underline-offset-4">Terrarium ↗</a></p>
			<section id="prices" className="mt-12">
				<h2 className="font-display text-3xl">{copy.pricing}</h2>
				<table className="mt-5 w-full text-left text-sm"><caption className="sr-only">{copy.pricing}</caption><thead><tr className="border-b border-zinc-200"><th scope="col" className="py-3">{copy.detail}</th><th scope="col" className="py-3">{copy.price}</th></tr></thead>
					<tbody>{ringPrices(language).map(price => <tr key={price.detail} className="border-b border-zinc-200"><th scope="row" className="py-4 font-normal">{price.label}</th><td className="py-4">{price.formatted}</td></tr>)}</tbody>
				</table><p className="mt-4 text-sm leading-relaxed text-zinc-500">{copy.pricingNote}</p>
			</section>
			<section id="questions" className="mt-12"><h2 className="font-display text-3xl">{copy.faq}</h2>
				{ringQuestions(language).map(item => <section key={item.question} className="mt-6"><h3 className="font-medium">{item.question}</h3><p className="mt-2 leading-relaxed text-zinc-600">{item.answer}</p></section>)}
			</section>
			<div className="mt-12 flex flex-wrap gap-6 border-t border-zinc-200 pt-8"><GuideStudioLink language={language}>{copy.studio} ↗</GuideStudioLink><Link href="/credits" className="underline underline-offset-4">{copy.sources} ↗</Link></div>
		</article>
		<footer className="border-t border-zinc-200 py-6 text-sm text-zinc-500">© {new Date().getFullYear()} {language === 'en' ? 'Mesto Metal' : 'Место Металл'}</footer>
	</main>
}
