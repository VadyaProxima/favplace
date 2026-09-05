'use client'

import Link from 'next/link'
import { motion } from 'motion/react'

// Карточки ведут прямо в конструктор с выбранной формой, поэтому список
// держим в тех же рамках, что RING_FORM_OPTIONS: классический и планка
// временно скрыты, иначе ссылка вела бы на недоступную форму.
const PRODUCTS = [
	// {
	// 	id: 'classic',
	// 	name: 'Классический',
	// 	desc: 'Сигнет с овальной площадкой под карту места',
	// },
	// {
	// 	id: 'bar',
	// 	name: 'Планка',
	// 	desc: 'Прямоугольная вставка на всю ширину обруча',
	// },
	{
		id: 'mountain',
		name: 'Горный',
		desc: 'Рельеф продолжает металл обруча без отдельной вставки',
	},
	{
		id: 'square',
		name: 'Квадрат',
		desc: 'Чёткая квадратная площадка и объёмный рельеф',
	},
]

export default function Home() {
	return (
		<main className="bg-white text-zinc-900">
			{/* ── Hero ───────────────────────────────────────────────── */}
			<section className="relative min-h-[100svh] overflow-hidden bg-zinc-100">
				{/* Full-bleed visual plane */}
				<div
					className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,#e8e8ea_0%,#f4f4f5_45%,#d4d4d8_100%)]"
					aria-hidden
				/>
				<div
					className="absolute inset-0 opacity-[0.35]"
					style={{
						backgroundImage:
							'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
					}}
					aria-hidden
				/>
				{/* Soft ring silhouette as hero anchor */}
				<div
					className="pointer-events-none absolute right-[-8%] top-1/2 h-[min(78vw,640px)] w-[min(78vw,640px)] -translate-y-1/2 rounded-full border border-zinc-400/40 bg-gradient-to-br from-zinc-200/80 via-zinc-300/30 to-transparent shadow-[inset_0_0_80px_rgba(255,255,255,0.5)]"
					aria-hidden
				/>
				<div
					className="pointer-events-none absolute right-[8%] top-1/2 h-[min(42vw,340px)] w-[min(42vw,340px)] -translate-y-1/2 rounded-full border border-zinc-500/25 bg-zinc-100/40"
					aria-hidden
				/>

				<header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
					<span className="font-display text-xl font-semibold tracking-tight md:text-2xl">
						Favplace
					</span>
					<Link
						href="/create"
						className="text-sm font-medium text-zinc-600 transition hover:text-zinc-900"
					>
						Конструктор
					</Link>
				</header>

				<div className="relative z-10 flex min-h-[calc(100svh-4.5rem)] max-w-xl flex-col justify-center px-6 pb-16 pt-8 md:px-10 md:pb-24">
					<motion.h1
						className="font-display text-[clamp(3.25rem,10vw,5.5rem)] font-semibold leading-[0.95] tracking-tight text-zinc-900"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
					>
						Favplace
					</motion.h1>
					<motion.p
						className="mt-5 max-w-sm text-base leading-relaxed text-zinc-600 md:text-lg"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.12, duration: 0.6 }}
					>
						Рельеф вашего места — в металле. Настоящая топография, отлитая в кольцо.
					</motion.p>
					<motion.div
						className="mt-10"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.22, duration: 0.55 }}
					>
						<Link
							href="/create"
							className="inline-flex items-center bg-zinc-900 px-8 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-zinc-700"
						>
							Создать кольцо
						</Link>
					</motion.div>
				</div>
			</section>

			{/* ── Products ───────────────────────────────────────────── */}
			<section className="border-t border-zinc-200 px-6 py-20 md:px-10 md:py-28">
				<div className="mx-auto max-w-6xl">
					<h2 className="font-display text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
						Коллекция форм
					</h2>
					<p className="mt-3 max-w-md text-sm text-zinc-500 md:text-base">
						Выберите силуэт — рельеф места ляжет на площадку именно этой формы.
					</p>

					<div className="mt-12 grid gap-px bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
						{PRODUCTS.map((p, i) => (
							<Link
								key={p.id}
								href={`/create?form=${p.id}`}
								className="group flex flex-col bg-white p-6 transition hover:bg-zinc-50 md:p-8"
							>
								<span className="font-mono text-[11px] tracking-widest text-zinc-400">
									{String(i + 1).padStart(2, '0')}
								</span>
								<span className="font-display mt-6 text-2xl font-semibold tracking-tight text-zinc-900">
									{p.name}
								</span>
								<span className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">
									{p.desc}
								</span>
								<span className="mt-8 text-xs font-medium uppercase tracking-wider text-zinc-900 opacity-0 transition group-hover:opacity-100">
									Открыть →
								</span>
							</Link>
						))}
					</div>
				</div>
			</section>

			{/* ── Footer ─────────────────────────────────────────────── */}
			<footer className="border-t border-zinc-200 bg-white px-6 py-14 md:px-10">
				<div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
					<div className="max-w-sm">
						<p className="font-display text-2xl font-semibold tracking-tight text-zinc-900">
							Favplace
						</p>
						<p className="mt-3 text-sm leading-relaxed text-zinc-500">
							Место, которое важно — всегда с вами. Топография в ювелирном металле.
						</p>
					</div>
					<div className="space-y-2 text-sm text-zinc-600">
						<p className="text-xs uppercase tracking-wider text-zinc-400">Контакты</p>
						<a
							href="mailto:hello@favplace.ru"
							className="block transition hover:text-zinc-900"
						>
							hello@favplace.ru
						</a>
						<a
							href="https://t.me/favplace"
							target="_blank"
							rel="noreferrer"
							className="block transition hover:text-zinc-900"
						>
							Telegram
						</a>
					</div>
					<p className="font-display text-lg italic text-zinc-400 md:max-w-[12rem] md:text-right">
						Ваш ландшафт. Ваш металл.
					</p>
				</div>
				<div className="mx-auto mt-12 flex max-w-6xl flex-wrap items-baseline gap-x-5 gap-y-2 text-xs text-zinc-400">
					<p>© {new Date().getFullYear()} Favplace</p>
					{/* Обязательно по CC-BY: атрибуция должна быть достижима оттуда,
					    где используется материал. Не удалять вместе с редизайном футера. */}
					<Link href="/credits" className="transition hover:text-zinc-700">
						Использованные материалы
					</Link>
				</div>
			</footer>
		</main>
	)
}
