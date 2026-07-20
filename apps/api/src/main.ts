import { config } from 'dotenv'
import { resolve } from 'path'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

config({ path: resolve(__dirname, '../.env') })

async function bootstrap() {
	const app = await NestFactory.create(AppModule)
	app.enableCors({ origin: true })
	await app.listen(4000)
	console.log('API running on http://localhost:4000')
}
bootstrap()
