import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
	title: 'Использованные материалы — Favplace',
	description:
		'Авторы и лицензии сторонних 3D-моделей, использованных в конструкторе Favplace.',
}

/**
 * Требование CC-BY-4.0: имя автора, ссылка на оригинал, ссылка на лицензию
 * и указание, что вносились изменения. Атрибуция должна быть доступна
 * оттуда, где используется материал, — поэтому на страницу ведёт ссылка
 * из футера лендинга и из конструктора.
 */

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
		title: 'Basic ring',
		author: 'gheopardo',
		authorUrl: 'https://sketchfab.com/gheopardo',
		source:
			'https://sketchfab.com/3d-models/basic-ring-ca4ee8dbe18543f78f10aacdc26d10b1',
		license: 'CC BY 4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
		usedFor: 'Базовая форма кольца в 3D-конструкторе',
		changes:
			'Модель изменена: нормирована по габариту, перестроены материалы, добавлена посадочная площадка под рельеф.',
	},
	{
		title: 'Lion Signate Ring',
		author: 'EristoffJewelryDesigns',
		authorUrl: 'https://sketchfab.com/EristoffJewelryDesigns',
		source:
			'https://sketchfab.com/3d-models/lion-signate-ring-717543dbcdb148f8ad8a91ad88cace02',
		license: 'CC BY 4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
		usedFor: 'Форма перстня-сигнета в 3D-конструкторе',
		changes:
			'Модель изменена: нормирована по габариту, перестроены материалы, адаптирована под вставку рельефа.',
	},
]

export default function CreditsPage() {
	return (
		<main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
			<Link
				href="/"
				className="text-xs uppercase tracking-wider text-zinc-400 transition hover:text-zinc-900"
			>
				← На главную
			</Link>

			<h1 className="mt-8 font-display text-4xl font-semibold tracking-tight text-zinc-900">
				Использованные материалы
			</h1>
			<p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
				Часть 3D-моделей в конструкторе основана на работах сторонних авторов,
				опубликованных под свободной лицензией. Ниже — авторы, источники
				и условия использования.
			</p>

			<ul className="mt-12 space-y-10">
				{ASSETS.map(asset => (
					<li key={asset.source} className="border-t border-zinc-200 pt-6">
						<h2 className="font-display text-xl font-semibold text-zinc-900">
							{asset.title}
						</h2>

						<dl className="mt-4 space-y-2 text-sm">
							<Row label="Автор">
								<a
									href={asset.authorUrl}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-2 transition hover:text-zinc-500"
								>
									{asset.author}
								</a>
							</Row>
							<Row label="Оригинал">
								<a
									href={asset.source}
									target="_blank"
									rel="noreferrer"
									className="break-all underline underline-offset-2 transition hover:text-zinc-500"
								>
									{asset.source}
								</a>
							</Row>
							<Row label="Лицензия">
								<a
									href={asset.licenseUrl}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-2 transition hover:text-zinc-500"
								>
									{asset.license}
								</a>
							</Row>
							<Row label="Где используется">{asset.usedFor}</Row>
							<Row label="Изменения">{asset.changes}</Row>
						</dl>
					</li>
				))}
			</ul>

			<p className="mt-16 border-t border-zinc-200 pt-6 text-xs leading-relaxed text-zinc-400">
				Лицензия CC BY 4.0 разрешает использование, в том числе коммерческое,
				и переработку при условии указания авторства. Остальные модели, код
				и тексты сайта созданы для Favplace.
			</p>
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
