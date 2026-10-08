import type { MountainSignetModel } from './referenceMountainSignet.ts'

export interface AcceptedRingValidationReport {
	finite: boolean
	boundaryEdges: number
	nonManifoldEdges: number
	degenerateTriangles: number
	signedVolume: number
	minimumEdgeLength: number
	minimumWallEstimate: number
	boreDiameter: number
}

const DEGENERATE_CROSS_LENGTH_SQUARED = 1e-24

function emptyReport(): AcceptedRingValidationReport {
	return {
		finite: false,
		boundaryEdges: 0,
		nonManifoldEdges: 0,
		degenerateTriangles: 0,
		signedVolume: Number.NaN,
		minimumEdgeLength: Number.NaN,
		minimumWallEstimate: Number.NaN,
		boreDiameter: Number.NaN,
	}
}

export function validateAcceptedMountainRing(
	model: MountainSignetModel,
): AcceptedRingValidationReport {
	const report = emptyReport()
	try {
		const geometry = model?.geometry
		const position = geometry?.getAttribute('position')
		const normal = geometry?.getAttribute('normal')
		const index = geometry?.getIndex()
		if (
			!position ||
			position.itemSize < 3 ||
			position.count === 0 ||
			!normal ||
			normal.itemSize < 3 ||
			normal.count !== position.count ||
			!index ||
			index.count < 3
		) {
			return report
		}

		let finite = index.count % 3 === 0
		for (let vertex = 0; vertex < position.count; vertex++) {
			finite =
				finite &&
				Number.isFinite(position.getX(vertex)) &&
				Number.isFinite(position.getY(vertex)) &&
				Number.isFinite(position.getZ(vertex)) &&
				Number.isFinite(normal.getX(vertex)) &&
				Number.isFinite(normal.getY(vertex)) &&
				Number.isFinite(normal.getZ(vertex))
		}

		const numericEdgeKeys =
			position.count * position.count <= Number.MAX_SAFE_INTEGER
		const edgeCounts = new Map<number | string, number>()
		const addEdge = (first: number, second: number) => {
			const low = Math.min(first, second)
			const high = Math.max(first, second)
			const key = numericEdgeKeys
				? low * position.count + high
				: `${low}:${high}`
			edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
		}

		let degenerateTriangles = 0
		let minimumEdgeLengthSquared = Infinity
		let signedVolume = 0
		let signedVolumeCompensation = 0
		const completeIndexCount = index.count - (index.count % 3)
		for (let cursor = 0; cursor < completeIndexCount; cursor += 3) {
			const first = index.getX(cursor)
			const second = index.getX(cursor + 1)
			const third = index.getX(cursor + 2)
			if (
				!Number.isInteger(first) ||
				!Number.isInteger(second) ||
				!Number.isInteger(third) ||
				first < 0 ||
				second < 0 ||
				third < 0 ||
				first >= position.count ||
				second >= position.count ||
				third >= position.count
			) {
				finite = false
				degenerateTriangles++
				continue
			}

			addEdge(first, second)
			addEdge(second, third)
			addEdge(third, first)

			const ax = position.getX(first)
			const ay = position.getY(first)
			const az = position.getZ(first)
			const bx = position.getX(second)
			const by = position.getY(second)
			const bz = position.getZ(second)
			const cx = position.getX(third)
			const cy = position.getY(third)
			const cz = position.getZ(third)
			const abx = bx - ax
			const aby = by - ay
			const abz = bz - az
			const acx = cx - ax
			const acy = cy - ay
			const acz = cz - az
			const bcx = cx - bx
			const bcy = cy - by
			const bcz = cz - bz
			minimumEdgeLengthSquared = Math.min(
				minimumEdgeLengthSquared,
				abx * abx + aby * aby + abz * abz,
				acx * acx + acy * acy + acz * acz,
				bcx * bcx + bcy * bcy + bcz * bcz,
			)
			const crossX = aby * acz - abz * acy
			const crossY = abz * acx - abx * acz
			const crossZ = abx * acy - aby * acx
			const crossLengthSquared =
				crossX * crossX + crossY * crossY + crossZ * crossZ
			if (
				!Number.isFinite(crossLengthSquared) ||
				crossLengthSquared <= DEGENERATE_CROSS_LENGTH_SQUARED
			) {
				degenerateTriangles++
			}

			const tetrahedronVolume =
				(ax * (by * cz - bz * cy) +
					ay * (bz * cx - bx * cz) +
					az * (bx * cy - by * cx)) /
				6
			const compensatedVolume = tetrahedronVolume - signedVolumeCompensation
			const nextSignedVolume = signedVolume + compensatedVolume
			signedVolumeCompensation =
				(nextSignedVolume - signedVolume) - compensatedVolume
			signedVolume = nextSignedVolume
		}

		let boundaryEdges = 0
		let nonManifoldEdges = 0
		for (const incidence of edgeCounts.values()) {
			if (incidence === 1) boundaryEdges++
			else if (incidence > 2) nonManifoldEdges++
		}

		let minimumWallEstimate = Infinity
		let boreRadiusTotal = 0
		let boreSampleCount = 0
		const radialCount = model.radialCount
		const sectionCount = model.sectionCount
		if (
			Number.isInteger(radialCount) &&
			Number.isInteger(sectionCount) &&
			radialCount > 0 &&
			sectionCount > 1 &&
			sectionCount % 2 === 0 &&
			radialCount * sectionCount <= position.count
		) {
			const innerSection = sectionCount / 2
			for (let radial = 0; radial < radialCount; radial++) {
				const outerVertex = radial * sectionCount
				const innerVertex = outerVertex + innerSection
				const outerX = position.getX(outerVertex)
				const outerY = position.getY(outerVertex)
				const outerZ = position.getZ(outerVertex)
				const innerX = position.getX(innerVertex)
				const innerY = position.getY(innerVertex)
				const innerZ = position.getZ(innerVertex)
				minimumWallEstimate = Math.min(
					minimumWallEstimate,
					Math.hypot(outerX - innerX, outerY - innerY, outerZ - innerZ),
				)
				boreRadiusTotal += Math.hypot(innerX, innerY)
				boreSampleCount++
			}
		} else {
			finite = false
		}

		report.finite = finite
		report.boundaryEdges = boundaryEdges
		report.nonManifoldEdges = nonManifoldEdges
		report.degenerateTriangles = degenerateTriangles
		report.signedVolume = signedVolume
		report.minimumEdgeLength = Number.isFinite(minimumEdgeLengthSquared)
			? Math.sqrt(minimumEdgeLengthSquared)
			: Number.NaN
		report.minimumWallEstimate = Number.isFinite(minimumWallEstimate)
			? minimumWallEstimate
			: Number.NaN
		report.boreDiameter = boreSampleCount > 0
			? (2 * boreRadiusTotal) / boreSampleCount
			: Number.NaN
		return report
	} catch {
		report.finite = false
		return report
	}
}
