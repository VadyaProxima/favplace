import { calcPrice, formatPrice, RING_SIZES_MM, type ReliefDetail } from '@favplace/shared'

export type GuideLanguage = 'en' | 'ru'

export function ringPrices(language: GuideLanguage) {
	const currency = language === 'en' ? 'USD' : 'RUB'
	return (['low', 'medium', 'high'] as ReliefDetail[]).map((detail, index) => {
		const amount = calcPrice({ ringForm: 'mountain', material: 'silver', reliefDetail: detail }, currency).total
		return { detail, amount, currency, formatted: formatPrice(amount, currency), label: (language === 'en' ? ['Low', 'Medium', 'High'] : ['Низкая', 'Средняя', 'Высокая'])[index] }
	})
}

export function ringQuestions(language: GuideLanguage) {
	const prices = ringPrices(language)
	const min = RING_SIZES_MM[0], max = RING_SIZES_MM.at(-1)
	return language === 'en' ? [
		{ question: 'What is a topographic ring?', answer: 'A topographic ring carries the terrain of a real place as a three-dimensional relief. Mesto Metal lets you choose a location on a map and shape that landscape into the upper surface of a silver mountain ring.' },
		{ question: 'Can I choose my own mountain or place?', answer: 'Yes. Search for a place or move the map, then adjust the selected area and its rotation. The studio starts with Mount Beshtau, the landscape shown on the homepage. You can replace it with your own location.' },
		{ question: 'How much does a custom silver ring cost?', answer: `The displayed silver ring prices are ${prices[0].formatted} with low detail, ${prices[1].formatted} with medium detail and ${prices[2].formatted} with high detail. These are fixed USD prices, not exchange-rate conversions. Submit a request to confirm your design and payment details before production.` },
		{ question: 'What ring sizes are available?', answer: `The configurator offers inner diameters from ${min} to ${max} mm in 0.5 mm steps. These values are diameters in millimetres, not US ring-size numbers. If you are unsure, have your finger measured by a jeweller before submitting your request.` },
		{ question: 'Can I control the height and orientation of the terrain?', answer: 'Yes. Adjust the map area, rotation and relief height, then inspect the ring in 3D. These are design controls: the relief is adapted to the ring and is not a survey-scale reproduction of the landscape.' },
		{ question: 'Can I save or share my exact ring design?', answer: 'Use Share in the studio to copy a configuration link. It includes the location, map scale and bearing, relief height, detail level, ring size and shape settings. Opening the link restores those settings.' },
		{ question: 'Does submitting the form take a payment?', answer: 'No. The form sends an order request with your configuration and contact details. We contact you to confirm the design and payment method before making the ring. Delivery options and timing should be confirmed for your destination.' },
	] : [
		{ question: 'Что такое кольцо с топографическим рельефом?', answer: 'Это кольцо, на котором поверхность реального места воспроизведена в виде объёмного рельефа. В Место Металл вы выбираете местность на карте и настраиваете ландшафт, который становится верхней частью серебряного горного кольца.' },
		{ question: 'Можно ли выбрать свою гору или другое место?', answer: 'Да. Найдите место через поиск или переместите карту, затем настройте область и её поворот. Конструктор открывается на Бештау — это тот же ландшафт, что на главной странице. Его можно заменить своей местностью.' },
		{ question: 'Сколько стоит серебряное кольцо с рельефом?', answer: `Цена в конструкторе: ${prices[0].formatted} с низкой, ${prices[1].formatted} со средней и ${prices[2].formatted} с высокой детализацией. В английской версии действует отдельный фиксированный прайс в долларах. Перед изготовлением мы подтверждаем конфигурацию и условия оплаты по заявке.` },
		{ question: 'Какие размеры кольца доступны?', answer: `В конструкторе доступны внутренние диаметры от ${min} до ${max} мм с шагом 0,5 мм. Это диаметр в миллиметрах, а не американская нумерация размеров. Если сомневаетесь, измерьте палец у ювелира перед отправкой заявки.` },
		{ question: 'Можно ли менять высоту и направление рельефа?', answer: 'Да. Настройте область карты, поворот и высоту рельефа и рассмотрите кольцо в 3D. Рельеф адаптируется к форме украшения: это художественная модель местности, а не геодезическое воспроизведение в строгом масштабе.' },
		{ question: 'Как сохранить или передать точные настройки кольца?', answer: 'Нажмите «Поделиться» в конструкторе и скопируйте ссылку. В неё входят координаты, масштаб и поворот карты, высота и детализация рельефа, размер и настройки формы кольца. При открытии ссылки эти настройки восстановятся.' },
		{ question: 'При отправке заявки сразу списываются деньги?', answer: 'Нет. Форма отправляет заявку с конфигурацией и контактами. Мы связываемся с вами, чтобы подтвердить дизайн и способ оплаты до изготовления. Способ доставки и сроки уточняются для вашего адреса.' },
	]
}

export const GUIDE_COPY = {
	en: {
		title: 'Topographic Rings: Design, Sizes & Prices | Mesto Metal',
		description: 'How to design a silver ring with the terrain of a meaningful place: choosing the map area, relief height, ring size and detail. Prices from $210.',
		heading: 'A guide to your topographic ring',
		intro: 'A place can hold a whole story. A topographic ring gives that place a physical shape: the terrain you choose becomes the surface of a silver ring. Here is how to choose a landscape and turn it into your design.',
		home: 'Home', guide: 'Ring guide', studio: 'Design your ring', pricing: 'Silver ring prices', detail: 'Relief detail', price: 'Ring price', faq: 'Questions before you design',
		pricingNote: 'Displayed configuration prices. Send an order request to confirm the design, payment and delivery before production.',
		sources: 'Terrain data and 3D credits',
		sections: [
			{ title: '1. Choose the landscape, then frame it', text: 'Search for a mountain or move the map to a meaningful location. Begin with a recognisable ridge or peak. A smaller area concentrates the design on local features; a wider area includes more of the surrounding landscape. Rotate the map until the ridge sits well across the ring.' },
			{ title: '2. Balance relief height and detail', text: 'Height controls how strongly the landscape rises above the ring. Detail controls the density of the terrain model. They are separate settings: increasing detail does not automatically make a peak taller. Inspect the design from the side as well as from above.' },
			{ title: '3. Check the size in millimetres', text: 'Ring size is the inner diameter of the band. The studio supports 15–23 mm in half-millimetre steps. Do not enter a US size directly. A jeweller can measure the required diameter; an existing well-fitting ring can also help you compare sizes.' },
			{ title: '4. Share the configuration or send a request', text: 'Use the studio’s Share action to keep the selected location and all design settings in a link. When you are ready, submit the order form. This creates a request for confirmation; it does not charge your card.' },
			{ title: 'Where the landscape comes from', text: 'The studio uses Terrarium elevation data, with Mapbox Terrain-RGB as a fallback if Terrarium is unavailable. The selected area is sampled and shaped into a ring. Terrain coverage and the area you choose affect the result; the preview is a design representation rather than a precision survey.' },
		],
	},
	ru: {
		title: 'Кольца с рельефом: выбор места, размеры и цены | Место Металл',
		description: 'Как создать серебряное кольцо с рельефом любимого места: выбор области карты, высоты, размера и детализации. Цены от 16 400 ₽.',
		heading: 'Как создать кольцо с рельефом любимого места',
		intro: 'Одно место может хранить целую историю. Кольцо с топографическим рельефом придаёт ей форму: выбранный вами ландшафт становится поверхностью серебряного кольца. Рассказываем, как выбрать местность и настроить своё украшение.',
		home: 'Главная', guide: 'О кольцах', studio: 'Создать кольцо', pricing: 'Цены на серебряное кольцо', detail: 'Детализация рельефа', price: 'Цена кольца', faq: 'Вопросы перед созданием',
		pricingNote: 'Цены конфигурации в конструкторе. Перед изготовлением мы подтверждаем дизайн, оплату и доставку по вашей заявке.',
		sources: 'Данные рельефа и авторы 3D',
		sections: [
			{ title: '1. Выберите ландшафт и его границы', text: 'Найдите гору через поиск или переместите карту к важному для вас месту. Начните с узнаваемого хребта или вершины. Небольшая область выделит локальные детали, а широкая захватит окружающий ландшафт. Поверните карту так, чтобы хребет хорошо располагался на кольце.' },
			{ title: '2. Настройте высоту и детализацию', text: 'Высота определяет, насколько сильно ландшафт возвышается над кольцом. Детализация отвечает за плотность модели рельефа. Это разные настройки: более высокая детализация сама по себе не делает вершину выше. Рассмотрите модель не только сверху, но и сбоку.' },
			{ title: '3. Проверьте размер в миллиметрах', text: 'Размер кольца — внутренний диаметр обруча. Конструктор поддерживает размеры от 15 до 23 мм с шагом 0,5 мм. Американский размер нельзя вводить напрямую. Подходящий диаметр поможет определить ювелир; для сравнения можно использовать кольцо, которое уже хорошо сидит.' },
			{ title: '4. Поделитесь дизайном или отправьте заявку', text: 'Кнопка «Поделиться» сохраняет выбранное место и настройки дизайна в ссылке. Когда кольцо готово, заполните форму заказа. Она создаёт заявку для подтверждения и не списывает деньги с карты.' },
			{ title: 'Откуда берётся рельеф', text: 'Конструктор использует данные высот Terrarium, а при их недоступности — Mapbox Terrain-RGB. Выбранная область обрабатывается и переносится на кольцо. Результат зависит от покрытия данных и масштаба выбранного места; превью показывает дизайн украшения, а не точную геодезическую модель.' },
		],
	},
} as const
