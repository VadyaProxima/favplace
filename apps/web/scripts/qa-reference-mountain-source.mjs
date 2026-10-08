import { chromium } from 'playwright'

const CHROME =
	process.env.CHROME_EXECUTABLE_PATH ||
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function main() {
	const browser = await chromium.launch({ headless: true, executablePath: CHROME })
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
	const glbRequests = []
	page.on('request', request => {
		if (request.url().toLowerCase().includes('.glb')) glbRequests.push(request.url())
	})

	await page.goto('http://localhost:3000/create', { waitUntil: 'networkidle' })
	await page.waitForSelector('[data-testid="mountain-ring-viewer"] canvas', {
		timeout: 60000,
	})
	await page.waitForTimeout(1800)
	await browser.close()

	const usedReferenceBody = glbRequests.some(url => url.endsWith('/models/basic_ring.glb'))
	const usedRejectedBody = glbRequests.some(url =>
		url.endsWith('/models/mountain_signet_body.glb'),
	)
	if (!usedReferenceBody || usedRejectedBody) {
		throw new Error(
			`Mountain viewer must load basic_ring.glb Object_8 instead of the rejected body. Requests: ${glbRequests.join(', ')}`,
		)
	}

	console.log('mountain viewer uses the supplied basic_ring.glb reference body')
}

main().catch(error => {
	console.error(error)
	process.exit(1)
})
