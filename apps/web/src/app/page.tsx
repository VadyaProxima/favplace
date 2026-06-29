'use client'

import { motion } from 'motion/react'

const fadeUp = {
	hidden: { opacity: 0, y: 30 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: { delay: i * 0.15, duration: 0.6, ease: 'easeOut' as const },
	}),
}

const steps = [
	{
		icon: '📍',
		title: 'Выберите место',
		desc: 'Гора, город, берег моря — любое место, которое вам дорого',
	},
	{
		icon: '🗺️',
		title: 'Настройте масштаб',
		desc: 'От 100 метров до 10 километров — выбирайте детализацию',
	},
	{
		icon: '💍',
		title: 'Создайте кольцо',
		desc: 'Золото, серебро или платина с реальным рельефом местности',
	},
]

export default function Home() {
	return (
		<main className="relative min-h-screen overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />

			<div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6">
				<motion.div
					className="mb-6 text-7xl"
					initial={{ scale: 0, rotate: -180 }}
					animate={{ scale: 1, rotate: 0 }}
					transition={{ type: 'spring', duration: 1.2, bounce: 0.4 }}
				>
					💍
				</motion.div>

				<motion.h1
					className="mb-4 text-center text-6xl font-bold tracking-tight"
					custom={0}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					<span className="bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300 bg-clip-text text-transparent">
						Favplace
					</span>
				</motion.h1>

				<motion.p
					className="mb-2 text-center text-xl text-zinc-300"
					custom={1}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					Кольцо с рельефом вашего любимого места
				</motion.p>

				<motion.p
					className="mb-10 max-w-md text-center text-zinc-500"
					custom={2}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					Настоящая топография, превращённая в ювелирное изделие. Каждая линия
					рельефа — реальные данные спутников.
				</motion.p>

				<motion.a
					href="/create"
					className="rounded-full bg-amber-500 px-10 py-4 text-lg font-semibold text-zinc-950 transition hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/25"
					custom={3}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				>
					Создать кольцо
				</motion.a>

				<motion.div
					className="mt-20 grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3"
					custom={4}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					{steps.map(step => (
						<motion.div
							key={step.title}
							className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur"
							whileHover={{ y: -4, borderColor: 'rgba(245, 158, 11, 0.3)' }}
							transition={{ duration: 0.2 }}
						>
							<div className="mb-3 text-3xl">{step.icon}</div>
							<h3 className="mb-1 font-semibold">{step.title}</h3>
							<p className="text-sm text-zinc-400">{step.desc}</p>
						</motion.div>
					))}
				</motion.div>

				<motion.div
					className="mt-16 mb-8 text-center"
					custom={5}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					<p className="text-sm text-zinc-600">
						Данные из NASA SRTM • Three.js рендеринг • Ювелирное качество
					</p>
				</motion.div>
			</div>
		</main>
	)
}
