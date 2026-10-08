import type { NextConfig } from 'next'
import path from 'path'

// В docker-compose API доступен по имени сервиса, локально — на :4000.
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'

const config: NextConfig = {
	devIndicators: false,
	transpilePackages: ['@favplace/shared'],
	// Самодостаточный сервер для образа: тащит в .next/standalone только
	// реально используемые файлы, без node_modules всего монорепо.
	//
	// Включается лишь в Dockerfile: на Windows раскладка standalone делается
	// симлинками, а их создание требует прав администратора — локальный
	// `pnpm build` без этого флага падал бы с EPERM.
	output: process.env.NEXT_OUTPUT_STANDALONE ? 'standalone' : undefined,
	outputFileTracingRoot: path.join(__dirname, '../../'),
	async rewrites() {
		return [
			{
				source: '/api/:path*',
				destination: `${apiOrigin}/api/:path*`,
			},
		]
	},
}

export default config
