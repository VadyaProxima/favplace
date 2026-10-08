import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

import { fetchHeightMap } from '../../../packages/terrain/dist/heightmap.js'
import { terrainContextRadius } from '../src/lib/basicReliefSurface.ts'

const CHROME =
	process.env.CHROME_EXECUTABLE_PATH ||
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT = path.join(
	process.cwd(),
	'assets/previews/relief-generator-v2',
)
const LOCATION = {
	lat: 36.1069,
	lng: -112.1129,
	radius: 5_000,
}

async function configurePage(browser, heightMap) {
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
	await page.goto('http://localhost:3000/create', { waitUntil: 'networkidle' })
	await page.waitForFunction(() => Boolean(window.__favplaceStore), null, {
		timeout: 60_000,
	})
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
			radius: LOCATION.radius,
		},
	)
	const viewer = page.locator('[data-testid="mountain-ring-viewer"]')
	await viewer.locator('canvas').waitFor({ timeout: 60_000 })
	await page.waitForTimeout(1_200)
	return { page, viewer }
}

async function drag(viewer, page, toX, toY) {
	const canvas = viewer.locator('canvas')
	const box = await canvas.boundingBox()
	if (!box) throw new Error('Mountain viewer canvas has no bounding box')
	const startX = box.x + box.width * 0.5
	const startY = box.y + box.height * 0.48
	await page.mouse.move(startX, startY)
	await page.mouse.down()
	await page.mouse.move(box.x + box.width * toX, box.y + box.height * toY, {
		steps: 36,
	})
	await page.mouse.up()
	await page.waitForTimeout(700)
}

async function renderView(browser, heightMap, name, orbit) {
	const { page, viewer } = await configurePage(browser, heightMap)
	if (orbit) await drag(viewer, page, orbit[0], orbit[1])
	await viewer.screenshot({ path: path.join(OUT, `${name}.png`) })
	await page.close()
	console.log(`${name}: rendered`)
}

async function main() {
	fs.mkdirSync(OUT, { recursive: true })
	const heightMap = await fetchHeightMap(
		LOCATION.lat,
		LOCATION.lng,
		terrainContextRadius(LOCATION.radius),
	)
	const browser = await chromium.launch({
		headless: true,
		executablePath: CHROME,
	})
	await renderView(browser, heightMap, '01-three-quarter', null)
	await renderView(browser, heightMap, '02-right', [0.78, 0.48])
	await renderView(browser, heightMap, '03-left', [0.22, 0.48])
	await renderView(browser, heightMap, '04-top', [0.5, 0.82])
	await renderView(browser, heightMap, '05-front-profile', [0.5, 0.2])
	await renderView(browser, heightMap, '06-back-profile', [0.92, 0.48])
	await browser.close()
	console.log(
		`terrain ${heightMap.minElevation.toFixed(1)}–${heightMap.maxElevation.toFixed(1)} m`,
	)
	console.log(`renders: ${OUT}`)
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
