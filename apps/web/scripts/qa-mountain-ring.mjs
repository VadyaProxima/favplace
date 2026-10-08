import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const OUT = path.join(process.cwd(), 'apps/web/.qa-mountain-v2')
const CHROME =
	process.env.CHROME_EXECUTABLE_PATH ||
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const GRID_SIZE = 72

function makeGrid(sample) {
	const values = []
	for (let row = 0; row < GRID_SIZE; row++) {
		const v = row / (GRID_SIZE - 1)
		const valuesRow = []
		for (let col = 0; col < GRID_SIZE; col++) {
			const u = col / (GRID_SIZE - 1)
			valuesRow.push(Math.max(0, Math.min(1, sample(u, v))))
		}
		values.push(valuesRow)
	}
	return values
}

const fixtures = [
	{
		name: 'flat',
		data: makeGrid(() => 0.32),
	},
	{
		name: 'center-peak',
		data: makeGrid((u, v) =>
			Math.exp(-((u - 0.5) ** 2 + (v - 0.48) ** 2) / 0.025),
		),
	},
	{
		name: 'edge-peak',
		data: makeGrid((u, v) =>
			Math.exp(-((u - 0.94) ** 2 + (v - 0.52) ** 2) / 0.012),
		),
	},
	{
		name: 'valley',
		data: makeGrid(
			(u, v) =>
				0.84 -
				0.78 * Math.exp(-((u - 0.5) ** 2 + (v - 0.5) ** 2) / 0.035),
		),
	},
	{
		name: 'noise',
		data: makeGrid(
			(u, v) =>
				0.5 +
				0.22 * Math.sin(u * 39 + Math.sin(v * 13)) +
				0.16 * Math.cos(v * 47 - u * 9),
		),
	},
]

async function setMountainState(page, heightMap, overrides = {}) {
	await page.evaluate(
		({ data, next }) => {
			window.__favplaceStore.setState({
				step: 'form',
				ringForm: 'mountain',
				mountainTwoTone: false,
				material: 'silver',
				surfaceFinish: 'polished',
				reliefHeight: 2.2,
				reliefDetail: 'high',
				heightMap: data,
				...next,
			})
		},
		{ data: heightMap, next: overrides },
	)
}

async function dragCanvas(page, from, to) {
	const canvas = page.locator('[data-testid="mountain-ring-viewer"] canvas')
	const box = await canvas.boundingBox()
	if (!box) throw new Error('Mountain viewer canvas has no bounding box')
	const startX = box.x + box.width * from[0]
	const startY = box.y + box.height * from[1]
	await page.mouse.move(startX, startY)
	await page.mouse.down()
	await page.mouse.move(
		box.x + box.width * to[0],
		box.y + box.height * to[1],
		{ steps: 30 },
	)
	await page.mouse.up()
	await page.waitForTimeout(500)
}

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
		timeout: 60000,
	})
	await setMountainState(page, fixtures[0].data)
	await page.waitForSelector('[data-testid="mountain-ring-viewer"] canvas', {
		timeout: 60000,
	})
	await page.waitForTimeout(2500)

	const viewer = page.locator('[data-testid="mountain-ring-viewer"]')
	for (const fixture of fixtures) {
		await setMountainState(page, fixture.data)
		await page.waitForTimeout(650)
		await viewer.screenshot({ path: path.join(OUT, `${fixture.name}-3q.png`) })
		console.log(`fixture ${fixture.name}: rendered`)
	}

	await setMountainState(page, fixtures[1].data)
	await dragCanvas(page, [0.5, 0.48], [0.75, 0.44])
	await viewer.screenshot({ path: path.join(OUT, 'center-peak-side.png') })
	console.log('side silhouette: rendered')

	await setMountainState(page, fixtures[1].data, {
		material: 'gold',
		mountainTwoTone: true,
	})
	await page.waitForTimeout(650)
	await viewer.screenshot({ path: path.join(OUT, 'center-peak-two-tone.png') })
	console.log('two-tone material: rendered')

	if (pageErrors.length) {
		throw new Error(`Browser page errors:\n${pageErrors.join('\n')}`)
	}

	await browser.close()
	console.log(`screenshots: ${OUT}`)
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
