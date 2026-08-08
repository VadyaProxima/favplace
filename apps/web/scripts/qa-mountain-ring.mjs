import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const OUT = path.join(process.cwd(), 'apps/web/.qa-mountain')

async function loadHeightmap(page) {
	for (let i = 0; i < 8; i++) {
		const ok = await page.evaluate(async () => {
			try {
				const res = await fetch(
					'/api/terrain/heightmap?lat=35.3739&lng=138.5395&radius=500&resolution=512',
				)
				if (!res.ok) return false
				const json = await res.json()
				if (!json?.data) return false
				window.__favplaceStore.setState({
					step: 'form',
					mountainTwoTone: true,
					material: 'gold',
					surfaceFinish: 'polished',
					reliefHeight: 2.2,
					reliefDetail: 'high',
					heightMap: json.data,
				})
				return true
			} catch {
				return false
			}
		})
		if (ok) return
		await page.waitForTimeout(1500)
	}
	// fallback: demo map via store only
	await page.evaluate(() => {
		window.__favplaceStore.setState({
			step: 'form',
			mountainTwoTone: true,
			material: 'gold',
			surfaceFinish: 'polished',
			reliefHeight: 2.2,
			reliefDetail: 'high',
			heightMap: null,
		})
	})
}

async function main() {
	fs.mkdirSync(OUT, { recursive: true })
	const browser = await chromium.launch({ headless: true })
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
	await page.goto('http://localhost:3000/create', { waitUntil: 'networkidle' })
	await loadHeightmap(page)

	await page.waitForSelector('[data-testid="mountain-ring-viewer"] canvas', {
		timeout: 60000,
	})
	await page.waitForTimeout(2800)

	const viewer = page.locator('[data-testid="mountain-ring-viewer"]')
	await viewer.screenshot({ path: path.join(OUT, 'flow-3q.png') })
	console.log('flow-3q')

	const canvas = page.locator('[data-testid="mountain-ring-viewer"] canvas')
	const box = await canvas.boundingBox()
	if (box) {
		const x = box.x + box.width * 0.55
		const y = box.y + box.height * 0.4
		await page.mouse.move(x, y)
		await page.mouse.down()
		await page.mouse.move(x + 300, y - 10, { steps: 30 })
		await page.mouse.up()
		await page.waitForTimeout(1000)
	}
	await viewer.screenshot({ path: path.join(OUT, 'flow-side.png') })
	console.log('flow-side')

	await page.evaluate(() => {
		window.__favplaceStore.setState({ material: 'silver', mountainTwoTone: false })
	})
	await page.waitForTimeout(1200)
	await viewer.screenshot({ path: path.join(OUT, 'flow-silver-side.png') })
	console.log('flow-silver-side')

	await browser.close()
}

main().catch(e => {
	console.error(e)
	process.exit(1)
})
