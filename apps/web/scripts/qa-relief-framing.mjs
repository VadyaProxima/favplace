import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const { PNG } = require('../../../packages/terrain/node_modules/pngjs')

const CHROME =
	process.env.CHROME_EXECUTABLE_PATH ||
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const GRID_SIZE = 72

function makePeakGrid() {
	const grid = []
	for (let row = 0; row < GRID_SIZE; row++) {
		const v = row / (GRID_SIZE - 1)
		const values = []
		for (let col = 0; col < GRID_SIZE; col++) {
			const u = col / (GRID_SIZE - 1)
			values.push(
				Math.exp(-((u - 0.5) ** 2 + (v - 0.48) ** 2) / 0.025),
			)
		}
		grid.push(values)
	}
	return grid
}

function countModelPixelsAtTop(buffer, rows = 24) {
	const png = PNG.sync.read(buffer)
	let count = 0
	for (let y = 0; y < Math.min(rows, png.height); y++) {
		for (let x = 2; x < png.width - 2; x++) {
			const offset = (y * png.width + x) * 4
			const delta =
				Math.abs(png.data[offset] - 244) +
				Math.abs(png.data[offset + 1] - 244) +
				Math.abs(png.data[offset + 2] - 245)
			if (delta > 24) count++
		}
	}
	return count
}

async function main() {
	const browser = await chromium.launch({
		headless: true,
		executablePath: CHROME,
	})
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
	await page.goto('http://localhost:3000/create', { waitUntil: 'networkidle' })
	await page.waitForFunction(() => Boolean(window.__favplaceStore), null, {
		timeout: 60_000,
	})
	await page.evaluate(data => {
		window.__favplaceStore.setState({
			step: 'form',
			ringForm: 'mountain',
			material: 'silver',
			surfaceFinish: 'polished',
			reliefHeight: 2.2,
			reliefDetail: 'high',
			heightMap: data,
		})
	}, makePeakGrid())
	const viewer = page.locator('[data-testid="mountain-ring-viewer"]')
	await viewer.locator('canvas').waitFor({ timeout: 60_000 })
	await page.waitForTimeout(1_200)
	const screenshot = await viewer.screenshot()
	fs.writeFileSync('apps/web/.qa-relief-framing.png', screenshot)
	await browser.close()

	const clippedPixels = countModelPixelsAtTop(screenshot)
	assert.equal(
		clippedPixels,
		0,
		`relief is clipped by the top edge (${clippedPixels} model pixels in the first 24 rows)`,
	)
	console.log('mountain relief has a clear top framing margin')
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
