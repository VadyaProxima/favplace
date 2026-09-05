import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const { PNG } = require('../../../packages/terrain/node_modules/pngjs')
const CHROME =
	process.env.CHROME_EXECUTABLE_PATH ||
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const GRID_SIZE = 72

function makePeakGrid() {
	return Array.from({ length: GRID_SIZE }, (_, row) => {
		const v = row / (GRID_SIZE - 1)
		return Array.from({ length: GRID_SIZE }, (_, col) => {
			const u = col / (GRID_SIZE - 1)
			return Math.exp(-((u - 0.5) ** 2 + (v - 0.48) ** 2) / 0.025)
		})
	})
}

function changedPixels(firstBuffer, secondBuffer, startY, endY) {
	const first = PNG.sync.read(firstBuffer)
	const second = PNG.sync.read(secondBuffer)
	assert.equal(first.width, second.width)
	assert.equal(first.height, second.height)
	let count = 0
	for (let y = startY; y < endY; y++) {
		for (let x = 4; x < first.width - 4; x++) {
			const offset = (y * first.width + x) * 4
			const delta =
				Math.abs(first.data[offset] - second.data[offset]) +
				Math.abs(first.data[offset + 1] - second.data[offset + 1]) +
				Math.abs(first.data[offset + 2] - second.data[offset + 2])
			if (delta > 18) count++
		}
	}
	return count
}

async function screenshotForRange(page, rangeMeters) {
	await page.evaluate(
		({ heightMap, range }) => {
			window.__favplaceStore.setState({
				step: 'form',
				ringForm: 'mountain',
				material: 'silver',
				surfaceFinish: 'polished',
				reliefHeight: 2.2,
				reliefDetail: 'high',
				radius: 2_000,
				elevationMeta: { min: 0, max: range },
				heightMap,
			})
		},
		{ heightMap: makePeakGrid(), range: rangeMeters },
	)
	await page.waitForTimeout(900)
	return page.locator('[data-testid="mountain-ring-viewer"]').screenshot()
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
	await page.locator('[data-testid="mountain-ring-viewer"] canvas').waitFor({
		timeout: 60_000,
	})

	const flatCrop = await screenshotForRange(page, 64)
	const mountainCrop = await screenshotForRange(page, 1_000)
	await browser.close()

	const decoded = PNG.sync.read(flatCrop)
	const topDifference = changedPixels(
		flatCrop,
		mountainCrop,
		0,
		Math.floor(decoded.height / 2),
	)
	const bodyDifference = changedPixels(
		flatCrop,
		mountainCrop,
		Math.floor(decoded.height / 2),
		decoded.height,
	)
	assert.ok(
		topDifference >= 1_000,
		`elevation range did not affect the rendered relief (${topDifference} changed pixels)`,
	)
	assert.ok(
		bodyDifference < 500,
		`changing terrain moved the ring body (${bodyDifference} changed lower-half pixels)`,
	)
	console.log(
		`elevation range changes the relief only: top=${topDifference}, body=${bodyDifference}`,
	)
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
