import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

import { fetchHeightMap } from '../../../packages/terrain/dist/heightmap.js'
import { terrainContextRadius } from '../src/lib/basicReliefSurface.ts'

const CHROME =
	process.env.CHROME_EXECUTABLE_PATH ||
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const tagArg = process.argv.find(arg => arg.startsWith('--tag='))
const tag = tagArg?.slice('--tag='.length) || 'current'
const OUT = path.join(process.cwd(), `apps/web/.qa-relief-real-${tag}`)

const locations = [
	{
		name: 'fuji-500m',
		lat: 35.3628,
		lng: 138.7307,
		radius: 500,
	},
	{
		name: 'grand-canyon-5km',
		lat: 36.1069,
		lng: -112.1129,
		radius: 5_000,
	},
	{
		name: 'alps-5km',
		lat: 46.558,
		lng: 8.56,
		radius: 5_000,
	},
	{
		name: 'moscow-2km',
		lat: 55.7558,
		lng: 37.6173,
		radius: 2_000,
	},
]

async function main() {
	fs.mkdirSync(OUT, { recursive: true })
	const browser = await chromium.launch({
		headless: true,
		executablePath: CHROME,
	})
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
	const pageErrors = []
	page.on('pageerror', error => pageErrors.push(error.message))

	await page.goto('http://localhost:3000/create', { waitUntil: 'networkidle' })
	await page.waitForFunction(() => Boolean(window.__favplaceStore), null, {
		timeout: 60_000,
	})

	for (const location of locations) {
		const heightMap = await fetchHeightMap(
			location.lat,
			location.lng,
			terrainContextRadius(location.radius),
		)
		await page.evaluate(
			({ data, minElevation, maxElevation, radius }) => {
				window.__favplaceStore.setState({
					step: 'form',
					ringForm: 'mountain',
					material: 'silver',
					surfaceFinish: 'polished',
					reliefHeight: 2.2,
					reliefDetail: 'high',
					radius,
					heightMap: data,
					elevationMeta: { min: minElevation, max: maxElevation },
				})
			},
			{
				data: heightMap.data,
				minElevation: heightMap.minElevation,
				maxElevation: heightMap.maxElevation,
				radius: location.radius,
			},
		)
		await page.waitForSelector('[data-testid="mountain-ring-viewer"] canvas', {
			timeout: 60_000,
		})
		await page.waitForTimeout(1_500)
		await page.locator('[data-testid="mountain-ring-viewer"]').screenshot({
			path: path.join(OUT, `${location.name}-3q.png`),
		})
		console.log(
			`${location.name}: ${heightMap.minElevation.toFixed(1)}–${heightMap.maxElevation.toFixed(1)} m`,
		)
	}

	await browser.close()
	if (pageErrors.length) {
		throw new Error(`Browser page errors:\n${pageErrors.join('\n')}`)
	}
	console.log(`screenshots: ${OUT}`)
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
