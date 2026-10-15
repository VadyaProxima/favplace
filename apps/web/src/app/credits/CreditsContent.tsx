'use client'

import { useT } from '@/lib/preferences'

import Link from 'next/link'
import { HeaderPreferences } from '../_ui/HeaderPreferences'
import { CopyrightNotice } from '../_ui/CopyrightNotice'

interface Asset {
	title: string
	author: string
	authorUrl: string
	source: string
	license: string
	licenseUrl: string
	usedFor: string
	changes: string
}

const ASSETS: Asset[] = [
	{
		title: 'Small Empty Room 3',
		author: 'Sergej Majboroda',
		authorUrl: 'https://polyhaven.com/a/small_empty_room_3',
		source: 'https://polyhaven.com/a/small_empty_room_3',
		license: 'CC0',
		licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
		usedFor: 'Освещение и отражения металла в конструкторе и на главной странице',
		changes: 'Версия 1K. Используется как HDR-окружение.',
	},
]

export function CreditsContent() {
	const t = useT()
	return (
		<main className="mx-auto max-w-3xl px-6 pb-10 pt-20 md:pb-14 md:pt-24">
			<div className="absolute right-5 top-4"><HeaderPreferences /></div>
			<Link
				href="/"
				className="text-xs uppercase tracking-wider text-zinc-400 transition hover:text-zinc-900"
			>
				{t("← На главную")}</Link>

			<h1 className="mt-8 font-display text-4xl font-semibold tracking-tight text-zinc-900">
				{t("Авторы и материалы")}</h1>
			<p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
				{t("Проект «Место Металл» объединяет ювелирную форму и рельеф настоящих мест. Здесь собраны источники 3D-материалов и сведения о работе над визуализацией.")}</p>

			<section aria-labelledby="project-assets" className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8">
				<p className="text-[10px] uppercase tracking-[.15em] text-zinc-500">{t('Создано для проекта')}</p>
				<h2 id="project-assets" className="font-display mt-3 text-2xl font-semibold">{t('3D-визуализация кольца')}</h2>
				<p className="mt-3 text-sm"><span className="text-zinc-500">{t('Исполнитель')} · </span><a href="https://kwork.ru/user/xlimbo" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4 transition hover:text-zinc-500">xLIMBO <span className="text-zinc-500">↗ Kwork</span></a></p>
				<p className="mt-3 text-sm leading-relaxed text-zinc-600">{t('В основе работы — переданный исполнителем комплект проекта от августа 2026 года. Форма кольца, рельеф и освещение адаптированы для интерактивной мастерской.')}</p>
			</section>
			<h2 className="font-display mt-12 text-2xl font-semibold">{t('Источники и лицензии')}</h2>
			<p className="mt-2 text-sm leading-relaxed text-zinc-500">{t('Источники и лицензии окружения для 3D-визуализации.')}</p>

			<ul className="mt-6 space-y-5">
				{ASSETS.map(asset => (
					<li key={asset.source} className="rounded-2xl border border-zinc-200 p-6 sm:p-8">
						<h2 className="font-display text-xl font-semibold text-zinc-900">
							{asset.title}
						</h2>

						<dl className="mt-4 space-y-2 text-sm">
							<Row label={t("Автор")}>
								<a
									href={asset.authorUrl}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-2 transition hover:text-zinc-500"
								>
									{asset.author}
								</a>
							</Row>
							<Row label={t("Оригинал")}>
								<a
									href={asset.source}
									target="_blank"
									rel="noreferrer"
									className="break-all underline underline-offset-2 transition hover:text-zinc-500"
								>
									{t('Смотреть оригинал')} ↗
								</a>
							</Row>
							<Row label={t("Лицензия")}>
								<a
									href={asset.licenseUrl}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-2 transition hover:text-zinc-500"
								>
									{asset.license}
								</a>
							</Row>
							<Row label={t("Где используется")}>{t(asset.usedFor)}</Row>
							<Row label={t("Изменения")}>{t(asset.changes)}</Row>
						</dl>
					</li>
				))}
			</ul>

			<footer className="mt-10 border-t border-zinc-200 pt-6 text-xs leading-relaxed text-zinc-500">
				<p>{t('Сторонние материалы используются на условиях лицензий, указанных у каждого источника.')}</p>
				<div className="mt-5 flex flex-wrap items-center justify-between gap-4"><p><CopyrightNotice /></p><Link href="/create" className="underline underline-offset-4 hover:text-zinc-900">{t('Открыть в мастерской')} ↗</Link></div>
			</footer>
		</main>
	)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
			<dt className="shrink-0 text-zinc-400 sm:w-40">{label}</dt>
			<dd className="text-zinc-700">{children}</dd>
		</div>
	)
}
