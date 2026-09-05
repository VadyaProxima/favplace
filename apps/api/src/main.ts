import { config } from 'dotenv'
import { resolve } from 'path'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'

// В docker-compose переменные приходят из окружения, файла .env там нет —
// dotenv просто ничего не найдёт и не помешает.
config({ path: resolve(__dirname, '../.env') })

const isProd = process.env.NODE_ENV === 'production'

/**
 * В проде фронт и API живут за одним доменом (Caddy отдаёт /api/* прямо в
 * этот сервис), поэтому браузер ходит по тому же origin и CORS не нужен.
 * Разрешаем чужие origin только если их явно перечислили в CORS_ORIGIN.
 */
function corsOrigin() {
	const raw = process.env.CORS_ORIGIN?.trim()
	if (raw) return raw.split(',').map((o) => o.trim())
	return isProd ? false : true
}

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule)
	app.enableCors({ origin: corsOrigin() })

	// В проде перед API стоит Caddy. Без trust proxy req.ip был бы адресом
	// прокси у всех запросов сразу, и лимит попыток входа стал бы общим.
	if (isProd) app.set('trust proxy', 1)

	const port = Number(process.env.PORT) || 4000
	await app.listen(port, '0.0.0.0')
	console.log(`API running on port ${port}`)
}
bootstrap()
