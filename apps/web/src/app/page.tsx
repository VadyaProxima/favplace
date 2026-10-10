'use client'

import { useT, usePriceFormatter } from '@/lib/preferences'

import Link from 'next/link'
import { HeaderPreferences } from './_ui/HeaderPreferences'
import { formFromPrice } from '@favplace/shared'
import { HeroTerrain } from './_components/HeroTerrain'

const PLACES = [
	{ name: 'Эльбрус', lat: 43.3499, lng: 42.4453 },
	{ name: 'Фудзи', lat: 35.3628, lng: 138.7307 },
	{ name: 'Белуха', lat: 49.8073, lng: 86.5895 },
]

export default function Home() {
	const t = useT()
	const formatPrice = usePriceFormatter()
	return (
		<main className="w-full bg-white text-zinc-900">
			<header className="flex w-full items-center justify-between gap-4 px-5 py-5 md:px-8">
				<Link href="/" className="font-display text-3xl font-semibold tracking-tight">Favplace</Link>
				<nav aria-label={t("Навигация сайта")} className="flex items-center gap-2 text-xs text-zinc-600 md:gap-6">
					<a href="#how" className="hidden hover:text-zinc-900 sm:block">{t("Как это устроено")}</a>
					<a href="#ring" className="hidden hover:text-zinc-900 sm:block">{t("О кольце")}</a>
					<HeaderPreferences />
					<Link href="/create" aria-label={t("В мастерскую")} className="flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 px-3 text-zinc-900 sm:px-4"><span className="hidden sm:inline">{t("В мастерскую")}</span><span aria-hidden="true">↗</span></Link>
				</nav>
			</header>

			<section className="grid w-full gap-10 px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
				<div>
					<p className="text-[10px] uppercase tracking-[.2em] text-zinc-500">{t("Топография в ювелирном металле")}</p>
					<h1 className="font-display mt-6 text-[clamp(3.5rem,7.8vw,7rem)] font-medium leading-[.92] tracking-tight">{t("Место,")}<br />{t("которое")}<br /><span className="italic">{t("остаётся.")}</span></h1>
					<p className="mt-7 max-w-sm text-sm leading-relaxed text-zinc-500 md:text-base">{t("Вершина, к которой хочется вернуться. Маршрут, который стал вашим. Перенесите рельеф этого места на кольцо.")}</p>
					<Link href="/create" className="mt-8 inline-flex min-h-12 items-center gap-8 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700">{t("Найти своё место ")}<span aria-hidden="true">→</span></Link>
					<p className="mt-4 text-xs text-zinc-400">{t("Вы выбираете место и характер кольца. Мы создаём его в металле.")}</p>
				</div>

				<div>
					<HeroTerrain />
					<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[11px] text-zinc-500">
						<span className="text-zinc-400">{t("Или начните с другого места")}</span>
						{PLACES.map(place => <Link key={place.name} href={`/create?s=place&lat=${place.lat}&lng=${place.lng}&p=${encodeURIComponent(place.name)}`} className="min-h-8 content-center transition hover:text-zinc-900">{t(place.name)} ↗</Link>)}
					</div>
				</div>
			</section>

			<section id="how" className="scroll-mt-8 border-y border-zinc-200 bg-zinc-50">
				<div className="grid w-full gap-8 px-5 py-14 md:px-8 md:py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
					<div><p className="text-[10px] uppercase tracking-wider text-zinc-500">{t("От карты к кольцу")}</p><h2 className="font-display mt-4 text-4xl font-medium leading-tight md:text-5xl">{t("Три решения.")}<br />{t("Одна ваша история.")}</h2></div>
					<div>
						{[
							[t('Найдите ландшафт'), t('Выберите точку, масштаб и направление на карте. Рассмотрите, как её рельеф ложится на кольцо.')],
							[t('Придайте ему форму'), t('Настройте профиль и массу кольца, укажите свой размер.')],
							[t('Передайте нам'), t('Проверьте изделие и оставьте контакты. Мы свяжемся с вами перед изготовлением и оплатой.')],
						].map(([title, description], index) => <div key={title} className="flex gap-5 border-b border-zinc-200 py-6 first:pt-0 last:border-0 last:pb-0 md:gap-8"><span className="pt-1 text-xs text-zinc-400">0{index + 1}</span><div><h3 className="font-display text-2xl font-semibold md:text-3xl">{t(title)}</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{t(description)}</p></div></div>)}
					</div>
				</div>
			</section>

			<section id="ring" className="grid w-full gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[1fr_1.6fr] lg:gap-24">
				<div><p className="text-[10px] uppercase tracking-wider text-zinc-500">{t("Горное кольцо")}</p><h2 className="font-display mt-4 text-4xl font-medium leading-tight md:text-5xl">{t("Ландшафт —")}<br />{t("часть самого кольца.")}</h2><p className="mt-5 max-w-sm text-sm leading-relaxed text-zinc-500">{t("Рельеф продолжает металл обруча. Без отдельной вставки: поверхность выбранного места становится поверхностью изделия.")}</p></div>
				<div className="flex flex-col justify-between">
					<dl className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-zinc-200 py-6">
						{[[t('Материал'), t('Серебро')], [t('Изготовление'), t('Отливка и ручная полировка')], [t('Размеры'), t('От 15 до 23 мм')], [t('Характер'), t('От лёгкого до массивного')]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-wider text-zinc-400">{t(label)}</dt><dd className="mt-2 text-sm leading-relaxed">{t(value)}</dd></div>)}
					</dl>
					<div className="mt-8 flex flex-wrap items-center justify-between gap-5"><div><p className="text-xs text-zinc-500">{t("Серебро, базовая детализация")}</p><p className="font-display mt-1 text-3xl font-semibold">{t("от ")}{formatPrice(formFromPrice('mountain'))}</p></div><Link href="/create" className="inline-flex min-h-12 items-center gap-8 rounded-xl border border-zinc-900 px-5 text-sm">{t("Собрать своё ")}<span aria-hidden="true">→</span></Link></div>
				</div>
			</section>

			<footer className="border-t border-zinc-200 px-5 py-8 md:px-8">
				<div className="w-full">
					<div className="flex flex-wrap items-start justify-between gap-8"><div><p className="font-display text-4xl font-semibold tracking-tight">Favplace</p><p className="mt-2 text-xs text-zinc-500">{t("Ваше место. Ваша форма.")}</p></div><div className="flex flex-col gap-3 text-sm text-zinc-600 sm:flex-row sm:gap-8"><a href="mailto:hello@favplace.ru" className="hover:text-zinc-900">hello@favplace.ru</a><a href="https://t.me/vadyaProxima" target="_blank" rel="noreferrer" className="hover:text-zinc-900">Telegram ↗</a><Link href="/create" className="hover:text-zinc-900">{t("Мастерская ↗")}</Link></div></div>
					<div className="mt-10 flex flex-wrap justify-between gap-3 border-t border-zinc-100 pt-5 text-[10px] text-zinc-400"><p>© {new Date().getFullYear()} Favplace</p>{/* Keep the licensed material attribution accessible. */}<Link href="/credits" className="hover:text-zinc-700">{t("Использованные материалы")}</Link></div>
				</div>
			</footer>
		</main>
	)
}
