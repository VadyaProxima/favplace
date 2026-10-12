import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { FloatType } from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

const [input, output, widthArg = '1024'] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: node prepare-delivery-hdri.mjs source.hdr output.hdr [width]')
const width = Number(widthArg), height = width / 2
assert.ok(Number.isInteger(width) && width >= 8 && width <= 4096 && Number.isInteger(height))
const sourceBytes = fs.readFileSync(input)
const loader = new RGBELoader().setDataType(FloatType)
const source = loader.parse(sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength))
assert.equal(source.width, source.height * 2, 'The environment must be equirectangular')

// Average radiance in linear HDR space. No tone mapping or 8-bit colour conversion.
const channels = new Uint8Array(width * height * 4)
let sourceEnergy = 0, outputEnergy = 0
for (let y = 0; y < height; y++) {
	const y0 = y * source.height / height, y1 = (y + 1) * source.height / height
	for (let x = 0; x < width; x++) {
		const x0 = x * source.width / width, x1 = (x + 1) * source.width / width
		const sum = [0, 0, 0]
		for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
			for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
				const weight = (Math.min(y1, sy + 1) - Math.max(y0, sy)) * (Math.min(x1, sx + 1) - Math.max(x0, sx))
				const offset = (sy * source.width + sx) * 4
				for (let c = 0; c < 3; c++) sum[c] += source.data[offset + c] * weight
			}
		}
		const area = (x1 - x0) * (y1 - y0)
		const rgb = sum.map(value => value / area)
		sourceEnergy += rgb[0] + rgb[1] + rgb[2]
		const max = Math.max(...rgb), offset = (y * width + x) * 4
		if (max > 1e-32) {
			const exponent = Math.floor(Math.log2(max)) + 1
			// Match Three's RGBELoader radiance normalization.
			const scale = 255 / 2 ** exponent
			for (let c = 0; c < 3; c++) channels[offset + c] = Math.min(255, Math.round(rgb[c] * scale))
			channels[offset + 3] = exponent + 128
		}
	}
}

function encodeChannel(values) {
	const bytes = []
	for (let start = 0; start < values.length;) {
		let run = 1
		while (run < 127 && start + run < values.length && values[start + run] === values[start]) run++
		if (run >= 4) { bytes.push(128 + run, values[start]); start += run; continue }
		const literalStart = start
		start += run
		while (start < values.length && start - literalStart < 128) {
			let nextRun = 1
			while (nextRun < 4 && start + nextRun < values.length && values[start + nextRun] === values[start]) nextRun++
			if (nextRun >= 4) break
			start += Math.min(nextRun, 128 - (start - literalStart))
		}
		bytes.push(start - literalStart, ...values.subarray(literalStart, start))
	}
	return Buffer.from(bytes)
}
const parts = [Buffer.from(`#?RADIANCE\n# Web environment prepared from the delivered PrirodaHDRI_68.hdr\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`)]
for (let y = 0; y < height; y++) {
	parts.push(Buffer.from([2, 2, width >> 8, width & 255]))
	for (let c = 0; c < 4; c++) parts.push(encodeChannel(Uint8Array.from({ length: width }, (_, x) => channels[(y * width + x) * 4 + c])))
}
const result = Buffer.concat(parts)
const decoded = loader.parse(result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength))
assert.equal(decoded.width, width)
assert.equal(decoded.height, height)
let peak = 0
for (let i = 0; i < decoded.data.length; i += 4) {
	for (let c = 0; c < 3; c++) { assert.ok(Number.isFinite(decoded.data[i + c])); outputEnergy += decoded.data[i + c]; peak = Math.max(peak, decoded.data[i + c]) }
}
assert.ok(Math.abs(outputEnergy - sourceEnergy) / sourceEnergy < .005, 'HDR radiance changed during encoding')
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, result)
console.log(JSON.stringify({ source: [source.width, source.height], output: [width, height], sourceBytes: sourceBytes.length, outputBytes: result.length, peakRadiance: peak, energyDifference: (outputEnergy - sourceEnergy) / sourceEnergy }))
