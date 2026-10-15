import type { Metadata } from 'next'

export const SITE_URL = 'https://mestometal.ru'
export const GUIDE_PATH = '/guide/topographic-rings'
export const RU_GUIDE_PATH = '/ru/guide/topographic-rings'
export const PAGE_COPY = {
	'/': {
		en: ['Custom Topographic Silver Rings | Mesto Metal', 'Turn the terrain of a meaningful place into a silver ring. Choose a location, shape the relief and preview your design in 3D. From $210.'],
		ru: ['Кольца с рельефом гор на заказ | Место Металл', 'Создайте серебряное кольцо с рельефом любимого места. Выберите местность на карте, настройте форму и посмотрите 3D-модель. От 16 400 ₽.'],
	},
	'/create': {
		en: ['Design Your Topographic Ring | Mesto Metal', 'Choose a place on the map and design a custom silver terrain ring. Adjust scale, rotation, relief height and size in an interactive 3D configurator.'],
		ru: ['Конструктор кольца с рельефом | Место Металл', 'Выберите место на карте и создайте серебряное кольцо с его рельефом. Настройте масштаб, поворот, высоту рельефа и размер в 3D-конструкторе.'],
	},
	'/credits': {
		en: ['Authors and Assets | Mesto Metal', 'Credits and source licences for the Mesto Metal 3D ring model and room lighting.'],
		ru: ['Авторы и материалы | Место Металл', 'Авторы, источники и лицензии 3D-модели кольца Место Металл и освещения.'],
	},
} as const

export function pageMetadata(path: string, title: string, description: string, language: 'en' | 'ru' = 'en'): Metadata {
	return {
		title, description,
		alternates: { canonical: `${SITE_URL}${path}` },
		openGraph: {
			type: 'website', url: `${SITE_URL}${path}`, siteName: 'Mesto Metal',
			title, description, locale: language === 'ru' ? 'ru_RU' : 'en_US',
			images: [{ url: `${SITE_URL}/social-image`, width: 1200, height: 630, alt: 'Mesto Metal — custom topographic silver rings' }],
		},
		twitter: { card: 'summary_large_image', title, description, images: [`${SITE_URL}/social-image`] },
	}
}

export const guideAlternates = {
	'en': `${SITE_URL}${GUIDE_PATH}`,
	'ru': `${SITE_URL}${RU_GUIDE_PATH}`,
	'x-default': `${SITE_URL}${GUIDE_PATH}`,
}
