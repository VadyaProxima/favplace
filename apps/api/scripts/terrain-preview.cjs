require('reflect-metadata')
const path = require('node:path')
const { config } = require('dotenv')
const { NestFactory } = require('@nestjs/core')
const { TerrainModule } = require('../dist/terrain/terrain.module')

if (process.env.NODE_ENV === 'production') throw new Error('Terrain preview is development-only')
process.env.NODE_ENV = 'development'
config({ path: path.resolve(__dirname, '../.env'), quiet: true })

;(async () => {
	const app = await NestFactory.create(TerrainModule)
	await app.listen(Number(process.env.TERRAIN_PREVIEW_PORT) || 4000, '127.0.0.1')
	console.log('Local terrain preview API is ready')
})().catch(error => { console.error(error.message); process.exitCode = 1 })
