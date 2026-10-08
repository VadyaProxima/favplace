import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import * as THREE from 'three'
import {
	buildDeformedMountainSignet,
	type DeformedMountainSignetOptions,
} from './referenceMountainSignet.ts'

export function buildMountainStl(
	options: DeformedMountainSignetOptions,
	quality: 'preview' | 'exact' = 'exact',
) {
	const model = buildDeformedMountainSignet(options, quality)
	try {
		const mesh = new THREE.Mesh(model.geometry)
		mesh.updateMatrixWorld(true)
		const output = new STLExporter().parse(mesh, { binary: true })
		return new Uint8Array(
			output.buffer,
			output.byteOffset,
			output.byteLength,
		).slice()
	} finally {
		model.geometry.dispose()
	}
}

export function downloadMountainStl(bytes: Uint8Array, filename: string) {
	const blob = new Blob([bytes], { type: 'model/stl' })
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = filename
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
