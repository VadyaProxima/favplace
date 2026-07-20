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
		title: 'Создайте изделие',
		desc: 'Золото, серебро или платина с реальным рельефом местности',
	},
]

export default function Home() {
	return (
		<main className="relative min-h-screen overflow-hidden">
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
					className="mb-4 text-center text-6xl font-semibold tracking-tight text-zinc-900"
					custom={0}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					Favplace
				</motion.h1>

				<motion.p
					className="mb-2 text-center text-xl text-zinc-700"
					custom={1}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					Рельеф вашего любимого места в металле
				</motion.p>

				<motion.p
					className="mb-10 max-w-md text-center text-zinc-500"
					custom={2}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					Настоящая топография, превращённая в изделие. Каждая линия рельефа —
					реальные данные спутников.
				</motion.p>

				<motion.a
					href="/create"
					className="rounded-100 bg-zinc-900 px-10 py-4 text-lg font-medium text-white transition hover:bg-zinc-700"
					custom={3}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
					whileHover={{ scale: 1.03 }}
					whileTap={{ scale: 0.97 }}
				>
					Создать
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
							className="rounded-xl border border-zinc-200 bg-white p-6"
							whileHover={{ y: -4, borderColor: 'rgba(0,0,0,0.2)' }}
							transition={{ duration: 0.2 }}
						>
							<div className="mb-3 text-3xl">{step.icon}</div>
							<h3 className="mb-1 font-semibold text-zinc-900">{step.title}</h3>
							<p className="text-sm text-zinc-500">{step.desc}</p>
						</motion.div>
					))}
				</motion.div>

				<motion.p
					className="mt-16 mb-8 text-center text-sm text-zinc-400"
					custom={5}
					variants={fadeUp}
					initial="hidden"
					animate="visible"
				>
					Данные рельефа • Three.js рендеринг • Ювелирное качество
				</motion.p>
			</div>
		</main>
	)
}
