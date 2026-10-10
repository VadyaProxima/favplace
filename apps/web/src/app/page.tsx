import Link from 'next/link'
import { formFromPrice, formatPrice } from '@favplace/shared'

const PLACES = [
	{ name: 'Эльбрус', lat: 43.3499, lng: 42.4453 },
	{ name: 'Фудзи', lat: 35.3628, lng: 138.7307 },
	{ name: 'Белуха', lat: 49.8073, lng: 86.5895 },
]

function Contours() {
	// A decorative drawing, independent of any DEM or another site's artwork.
	const paths = Array.from({ length: 19 }, (_, level) => {
		const radius = 24 + level * 11
		return Array.from({ length: 121 }, (_, point) => {
			const a = point / 120 * Math.PI * 2
			const r = radius * (1 + .09 * Math.sin(a * 3 + level * .08) + .05 * Math.cos(a * 5))
			const x = 310 + Math.cos(a) * r + Math.sin(a) * r * .22
			const y = 184 + Math.sin(a) * r * .64
			return `${point === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
		}).join(' ') + ' Z'
	})
	return <svg viewBox="0 0 620 370" fill="none" className="h-full w-full" aria-hidden="true">
		<defs><pattern id="place-grid" width="62" height="62" patternUnits="userSpaceOnUse"><path d="M62 0H0V62" stroke="#e4e4e7" strokeWidth=".6" /></pattern></defs>
		<rect width="620" height="370" fill="url(#place-grid)" />
		{paths.map((d, i) => <path key={i} d={d} stroke={i % 4 === 0 ? '#a1a1aa' : '#d4d4d8'} strokeWidth={i % 4 === 0 ? 1.2 : .8} />)}
		<path d="M310 171V197M297 184H323" stroke="#18181b" />
		<circle cx="310" cy="184" r="4" fill="#18181b" />
	</svg>
}

export default function Home() {
	return (
		<main className="w-full bg-white text-zinc-900">
			<header className="flex w-full items-center justify-between gap-4 px-5 py-5 md:px-8">
				<Link href="/" className="font-display text-3xl font-semibold tracking-tight">Favplace</Link>
				<nav aria-label="Навигация сайта" className="flex items-center gap-6 text-xs text-zinc-600">
					<a href="#how" className="hidden hover:text-zinc-900 sm:block">Как это устроено</a>
					<a href="#ring" className="hidden hover:text-zinc-900 sm:block">О кольце</a>
					<Link href="/create" className="flex min-h-11 items-center rounded-full border border-zinc-200 px-4 text-zinc-900">В мастерскую ↗</Link>
				</nav>
			</header>

			<section className="grid w-full gap-10 px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
				<div>
					<p className="text-[10px] uppercase tracking-[.2em] text-zinc-500">Топография в ювелирном металле</p>
					<h1 className="font-display mt-6 text-[clamp(3.5rem,7.8vw,7rem)] font-medium leading-[.92] tracking-tight">Место,<br />которое<br /><span className="italic">остаётся.</span></h1>
					<p className="mt-7 max-w-sm text-sm leading-relaxed text-zinc-500 md:text-base">Вершина, к которой хочется вернуться. Маршрут, который стал вашим. Перенесите рельеф этого места на кольцо.</p>
					<Link href="/create" className="mt-8 inline-flex min-h-12 items-center gap-8 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700">Найти своё место <span aria-hidden="true">→</span></Link>
					<p className="mt-4 text-xs text-zinc-400">Вы выбираете место и характер кольца. Мы создаём его в металле.</p>
				</div>

				<div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
					<div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
						<p className="text-xs font-medium">Всё начинается с точки на карте</p><span className="text-xs text-zinc-400" aria-hidden="true">↗</span>
					</div>
					<div className="aspect-[620/370]"><Contours /></div>
					<div className="border-t border-zinc-200 bg-white px-5 py-4">
						<p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-400">Попробуйте знакомый ландшафт</p>
						{PLACES.map((place, index) => <Link key={place.name} href={`/create?s=place&lat=${place.lat}&lng=${place.lng}&p=${encodeURIComponent(place.name)}`} className="group flex min-h-14 items-center gap-4 border-b border-zinc-100 py-3 last:border-0">
							<span className="text-[10px] tabular-nums text-zinc-400">0{index + 1}</span><span className="text-sm font-medium">{place.name}</span><span className="ml-auto hidden text-[10px] tabular-nums text-zinc-400 sm:block">{place.lat.toFixed(2)}° · {place.lng.toFixed(2)}°</span><span className="text-zinc-400 transition group-hover:translate-x-1 group-hover:text-zinc-900" aria-hidden="true">→</span>
						</Link>)}
					</div>
				</div>
			</section>

			<section id="how" className="scroll-mt-8 border-y border-zinc-200 bg-zinc-50">
				<div className="grid w-full gap-8 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
					<div><p className="text-[10px] uppercase tracking-wider text-zinc-500">От карты к кольцу</p><h2 className="font-display mt-4 text-4xl font-medium leading-tight md:text-5xl">Три решения.<br />Одна ваша история.</h2></div>
					<div>
						{[
							['Найдите ландшафт', 'Выберите точку, масштаб и направление на карте. Рассмотрите, как её рельеф ложится на кольцо.'],
							['Придайте ему форму', 'Настройте профиль и массу кольца, укажите свой размер.'],
							['Передайте нам', 'Проверьте изделие и оставьте контакты. Мы свяжемся с вами перед изготовлением и оплатой.'],
						].map(([title, description], index) => <div key={title} className="flex gap-5 border-b border-zinc-200 py-6 first:pt-0 last:border-0 last:pb-0 md:gap-8"><span className="pt-1 text-xs text-zinc-400">0{index + 1}</span><div><h3 className="font-display text-2xl font-semibold md:text-3xl">{title}</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{description}</p></div></div>)}
					</div>
				</div>
			</section>

			<section id="ring" className="grid w-full gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
				<div><p className="text-[10px] uppercase tracking-wider text-zinc-500">Горное кольцо</p><h2 className="font-display mt-4 text-4xl font-medium leading-tight md:text-5xl">Ландшафт —<br />часть самого кольца.</h2><p className="mt-5 max-w-sm text-sm leading-relaxed text-zinc-500">Рельеф продолжает металл обруча. Без отдельной вставки: поверхность выбранного места становится поверхностью изделия.</p></div>
				<div className="flex flex-col justify-between">
					<dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-zinc-200 py-6">
						{[['Материал', 'Серебро'], ['Изготовление', 'Отливка и ручная полировка'], ['Размеры', 'От 15 до 23 мм'], ['Характер', 'От лёгкого до массивного']].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-wider text-zinc-400">{label}</dt><dd className="mt-2 text-sm leading-relaxed">{value}</dd></div>)}
					</dl>
					<div className="mt-8 flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs text-zinc-500">Серебро, базовая детализация</p><p className="font-display mt-1 text-3xl font-semibold">от {formatPrice(formFromPrice('mountain'))}</p></div><Link href="/create" className="inline-flex min-h-12 items-center gap-8 rounded-xl border border-zinc-900 px-5 text-sm">Собрать своё <span aria-hidden="true">→</span></Link></div>
				</div>
			</section>

			<footer className="border-t border-zinc-200 px-5 py-8 md:px-8">
				<div className="w-full">
					<div className="flex flex-wrap items-start justify-between gap-8"><div><p className="font-display text-4xl font-semibold tracking-tight">Favplace</p><p className="mt-2 text-xs text-zinc-500">Ваше место. Ваша форма.</p></div><div className="flex flex-col gap-3 text-sm text-zinc-600 sm:flex-row sm:gap-8"><a href="mailto:hello@favplace.ru" className="hover:text-zinc-900">hello@favplace.ru</a><a href="https://t.me/favplace" target="_blank" rel="noreferrer" className="hover:text-zinc-900">Telegram ↗</a><Link href="/create" className="hover:text-zinc-900">Мастерская ↗</Link></div></div>
					<div className="mt-10 flex flex-wrap justify-between gap-3 border-t border-zinc-100 pt-5 text-[10px] text-zinc-400"><p>© {new Date().getFullYear()} Favplace</p>{/* Keep the licensed material attribution accessible. */}<Link href="/credits" className="hover:text-zinc-700">Использованные материалы</Link></div>
				</div>
			</footer>
		</main>
	)
}
