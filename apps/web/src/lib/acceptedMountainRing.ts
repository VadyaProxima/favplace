import * as THREE from 'three'

import {
	CORRECTION_COMPONENTS,
	CORRECTION_VERTEX_INDICES,
	RADIAL_COUNT,
	SECTION_COUNT,
} from './acceptedMountainRingCorrection.generated.ts'
import type { MountainSignetModel } from './referenceMountainSignet.ts'

export type RingMass = 'subtle' | 'classic' | 'statement'
export type BandProfile = 'flat' | 'classic' | 'd-shaped'
export type ShoulderStyle = 'straight' | 'classic' | 'curved'

export interface AcceptedMountainRingOptions {
	ringDiameter: number
	mass: RingMass
	profile: BandProfile
	shoulders: ShoulderStyle
}

export const ACCEPTED_MOUNTAIN_DEFAULTS: Readonly<AcceptedMountainRingOptions> =
	Object.freeze({
		ringDiameter: 17,
		mass: 'classic',
		profile: 'classic',
		shoulders: 'classic',
	})

const MINIMUM_RING_DIAMETER = 15
const MAXIMUM_RING_DIAMETER = 22
const INNER_RADIUS = 8.5

/**
 * Высота верха кольца. Опускаем — площадка становится площе.
 * Всё остальное подстраивается: направляющая внешнего профиля
 * подрезается в upperOuterPoint, потолок рельефа считается от неё же.
 */
const FACE_HEIGHT = 11

/**
 * Высота принятой базы: под неё выгружена таблица поправок
 * (ACCEPTED_BOUNDS.max[1] = 12.394) и подогнаны координаты точек
 * направляющей. Служит опорой, менять её нельзя.
 */
const ACCEPTED_FACE_HEIGHT = 12.394

/** На столько ниже верха проходит гребень скоса в принятой подгонке. */
const ACCEPTED_BEVEL_CREST_DROP = 0.032
const FACE_HALF_X = 5
const FACE_HALF_Z = 3.12
const FACE_EXPONENT = 4.2
const FACE_SUPPORT_X = 0.24
const FACE_SUPPORT_Z = 0.38
const FACE_CORNER_BONUS = 0.04
const FACE_WALL_START = 0.8
const FACE_WALL_FULL = 0.93
const FACE_BLEND_POWER = 6
const UPPER_BIAS_POWER = 3.2
const LOWER_BIAS_POWER = 3.643856189775
const BIAS_TRANSITION_START = 70
const BIAS_TRANSITION_END = 125
const SHOULDER_RADIAL_FULL_DEGREES = 90
const CROSS_SECTION_EXPONENT = 3.8
const SECTION_PARAMETER_POWER = 6
const FACE_REGION_DEGREES = 25
const MASS_FACE_RELEASE_DEPTH = 0.85
const TWO_PI = Math.PI * 2
const RADIANS_TO_DEGREES = 180 / Math.PI

const MASS = {
	subtle: { radial: 0.84, axial: 0.82, support: 0.96 },
	classic: { radial: 1, axial: 1, support: 1 },
	statement: { radial: 1.2, axial: 1.23, support: 1.04 },
} as const

/**
 * Масса меняет площадку и обруч одной ручкой, поэтому «широкая площадка при
 * тонком обруче» пресетом не выражается. Пропорции разведены по углу:
 * у верха работает свой множитель, у шинки — свой, между ними плавный
 * переход. Пресет массы умножается поверх и продолжает работать.
 *
 * Значения взяты из самих пресетов: площадка получает ширину «массивного»,
 * обруч — ширину и толщину «лёгкого».
 */
const FACE_AXIAL_FACTOR = 1.23
const BAND_AXIAL_FACTOR = 0.82
const BAND_RADIAL_FACTOR = 0.84
/**
 * Площадка держится до первого угла, дальше идёт переход к шинке.
 *
 * Переход обязан быть длинным. Если сузить его до пары десятков градусов,
 * широкая площадка обрывается в узкую шинку ступенькой, и по бокам
 * вырастают «уши» — плоские крылья, торчащие за силуэт. Растянутый до
 * самой шинки переход даёт вместо ступеньки плавное сужение.
 */
const BAND_SHAPE_START_DEGREES = 20
const BAND_SHAPE_FULL_DEGREES = 90

const SHOULDER = {
	straight: { startDeg: 34, endDeg: 74, radialBias: 0.42, axialBias: 0.48 },
	classic: { startDeg: 30, endDeg: 78, radialBias: 0.5, axialBias: 0.56 },
	curved: { startDeg: 24, endDeg: 82, radialBias: 0.6, axialBias: 0.66 },
} as const

const SHOULDER_TRANSITION_STRENGTH = {
	straight: 0.1,
	classic: 0,
	curved: 0.4,
} as const

const MASS_VALUES: readonly RingMass[] = ['subtle', 'classic', 'statement']
const PROFILE_VALUES: readonly BandProfile[] = ['flat', 'classic', 'd-shaped']
const SHOULDER_VALUES: readonly ShoulderStyle[] = ['straight', 'classic', 'curved']

const HALF_WIDTH_DEGREES = [
	0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 105, 120, 140, 160, 180,
] as const
const HALF_WIDTHS = [
	4.385, 4.351, 4.254, 4.101, 3.905, 3.683, 3.448, 3.211, 2.976, 2.75,
	2.4, 2.16, 1.9, 1.74, 1.69,
] as const
const SECTION_RADIAL_KNOTS = [
	0, 0.035, 0.08, 0.15, 0.5, 0.75, 0.85, 0.95, 0.965, 1,
] as const
const SECTION_CURVE_KNOTS = SECTION_RADIAL_KNOTS.map(value =>
	Math.pow(value, 1 / SECTION_PARAMETER_POWER),
)
const SECTION_RATIOS = [
	0, 0.9, 1, 0.992, 0.94, 0.898, 0.878, 0.808, 0.68, 0,
] as const

// Shared inner comfort round; the outer contour is either a broad flat
// face with a short bevel, or a continuous D-shaped dome of the same width.
const PROFILE_SECTION_RATIOS = {
	flat: [0, 0.9, 1, 1, 1, 1, 0.999, 0.985, 0.94, 0],
	'd-shaped': SECTION_RADIAL_KNOTS.map((fraction, index) =>
		fraction <= 0.08
			? SECTION_RATIOS[index]
			: Math.sqrt(Math.max(0, 1 - ((fraction - 0.08) / 0.92) ** 2)),
	),
} as const

type Point2 = readonly [number, number]
type OuterRailPoint = readonly [number, Point2, number]

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
	return typeof value === 'string' && values.includes(value as T)
}

export function normalizeAcceptedMountainRingOptions(
	input: Partial<AcceptedMountainRingOptions>,
): AcceptedMountainRingOptions {
	return {
		ringDiameter:
			Number.isFinite(input.ringDiameter) &&
			input.ringDiameter !== undefined &&
			input.ringDiameter >= MINIMUM_RING_DIAMETER &&
			input.ringDiameter <= MAXIMUM_RING_DIAMETER
				? input.ringDiameter
				: ACCEPTED_MOUNTAIN_DEFAULTS.ringDiameter,
		mass: isOneOf(input.mass, MASS_VALUES)
			? input.mass
			: ACCEPTED_MOUNTAIN_DEFAULTS.mass,
		profile: isOneOf(input.profile, PROFILE_VALUES)
			? input.profile
			: ACCEPTED_MOUNTAIN_DEFAULTS.profile,
		shoulders: isOneOf(input.shoulders, SHOULDER_VALUES)
			? input.shoulders
			: ACCEPTED_MOUNTAIN_DEFAULTS.shoulders,
	}
}

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value))
}

function smootherstep(value: number) {
	const clamped = clamp01(value)
	return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10)
}

function signedSuperellipseComponent(value: number, exponent: number) {
	if (Math.abs(value) <= 1e-15) return 0
	return Math.sign(value) * Math.abs(value) ** (2 / exponent)
}

function pchipSlopes(xs: readonly number[], ys: readonly number[]) {
	const count = xs.length
	const h = new Array<number>(count - 1)
	const delta = new Array<number>(count - 1)
	for (let index = 0; index < count - 1; index++) {
		h[index] = xs[index + 1] - xs[index]
		delta[index] = (ys[index + 1] - ys[index]) / h[index]
	}
	const slopes = new Array<number>(count).fill(0)
	for (let index = 1; index < count - 1; index++) {
		if (delta[index - 1] * delta[index] <= 0) {
			slopes[index] = 0
		} else {
			const w1 = 2 * h[index] + h[index - 1]
			const w2 = h[index] + 2 * h[index - 1]
			slopes[index] =
				(w1 + w2) / (w1 / delta[index - 1] + w2 / delta[index])
		}
	}
	slopes[0] =
		((2 * h[0] + h[1]) * delta[0] - h[0] * delta[1]) / (h[0] + h[1])
	slopes[count - 1] =
		((2 * h[count - 2] + h[count - 3]) * delta[count - 2] -
			h[count - 2] * delta[count - 3]) /
		(h[count - 2] + h[count - 3])
	for (const [endpoint, secant] of [
		[0, delta[0]],
		[count - 1, delta[count - 2]],
	] as const) {
		if (slopes[endpoint] * secant <= 0) slopes[endpoint] = 0
		else if (Math.abs(slopes[endpoint]) > 3 * Math.abs(secant)) {
			slopes[endpoint] = 3 * secant
		}
	}
	return slopes
}

function pchip(
	value: number,
	xs: readonly number[],
	ys: readonly number[],
	slopes: readonly number[],
) {
	if (value <= xs[0]) return ys[0]
	if (value >= xs[xs.length - 1]) return ys[ys.length - 1]
	for (let index = 0; index < xs.length - 1; index++) {
		if (value < xs[index] || value > xs[index + 1]) continue
		const h = xs[index + 1] - xs[index]
		const amount = (value - xs[index]) / h
		return (
			(2 * amount ** 3 - 3 * amount ** 2 + 1) * ys[index] +
			(amount ** 3 - 2 * amount ** 2 + amount) * h * slopes[index] +
			(-2 * amount ** 3 + 3 * amount ** 2) * ys[index + 1] +
			(amount ** 3 - amount ** 2) * h * slopes[index + 1]
		)
	}
	throw new Error('Unreachable PCHIP interval')
}

const HALF_WIDTH_SLOPES = pchipSlopes(HALF_WIDTH_DEGREES, HALF_WIDTHS)
const SECTION_CURVE_SLOPES = pchipSlopes(
	SECTION_CURVE_KNOTS,
	SECTION_RATIOS,
)
const PROFILE_SECTION_SLOPES = {
	flat: pchipSlopes(SECTION_CURVE_KNOTS, PROFILE_SECTION_RATIOS.flat),
	'd-shaped': pchipSlopes(SECTION_CURVE_KNOTS, PROFILE_SECTION_RATIOS['d-shaped']),
}

function cubicBezier(
	first: Point2,
	controlA: Point2,
	controlB: Point2,
	last: Point2,
	amount: number,
): Point2 {
	const remaining = 1 - amount
	return [
		remaining ** 3 * first[0] +
			3 * remaining ** 2 * amount * controlA[0] +
			3 * remaining * amount ** 2 * controlB[0] +
			amount ** 3 * last[0],
		remaining ** 3 * first[1] +
			3 * remaining ** 2 * amount * controlA[1] +
			3 * remaining * amount ** 2 * controlB[1] +
			amount ** 3 * last[1],
	]
}

function upperOuterPoint(degreesInput: number): Point2 {
	const radius80 = 10.4356
	const railPoints: readonly OuterRailPoint[] = [
		[0, [0, FACE_HEIGHT], 0],
		[10, [FACE_HEIGHT * Math.tan((10 * Math.PI) / 180), FACE_HEIGHT], 0],
		[20, [ACCEPTED_FACE_HEIGHT * Math.tan((20 * Math.PI) / 180), ACCEPTED_FACE_HEIGHT], 0],
		[25, [5.764, ACCEPTED_FACE_HEIGHT - ACCEPTED_BEVEL_CREST_DROP], -7.44],
		[30, [6.621, 11.468], -59.73],
		[35, [7.246, 10.349], -61.56],
		[40, [7.8, 9.295], -62.89],
		[45, [8.292, 8.292], -64.63],
		[50, [8.726, 7.322], -66.95],
		[60, [9.431, 5.445], -72.11],
		[70, [9.946, 3.62], -76.03],
		[
			80,
			[
				radius80 * Math.sin((80 * Math.PI) / 180),
				radius80 * Math.cos((80 * Math.PI) / 180),
			],
			-82,
		],
		[90, [10.37, 0], -90],
	]
	// Координаты выше подогнаны под ACCEPTED_FACE_HEIGHT. Если площадку
	// опустить, часть точек скоса оказывается выше верха кольца и лезет над
	// площадкой бортиком. Каждая точка направляющей лежит на луче своего
	// угла, поэтому подрезка — это сдвиг точки вдоль луча до плоскости
	// y = FACE_HEIGHT; касательная там становится горизонтальной, потому что
	// это уже площадка, а не скос.
	const points: readonly OuterRailPoint[] =
		FACE_HEIGHT >= ACCEPTED_FACE_HEIGHT
			? railPoints
			: railPoints.map(([degrees, [x, y], tangent]) =>
					y > FACE_HEIGHT
						? ([
								degrees,
								[FACE_HEIGHT * Math.tan((degrees * Math.PI) / 180), FACE_HEIGHT],
								0,
							] as OuterRailPoint)
						: ([degrees, [x, y], tangent] as OuterRailPoint),
				)
	const degrees = Math.max(points[0][0], Math.min(points[points.length - 1][0], degreesInput))
	const finish = (point: Point2): Point2 => {
		if (degrees > 20 && degrees < 25) {
			const amount = (degrees - 20) / 5
			// Просадка гребня скоса — величина абсолютная, а не доля высоты.
			// Прежняя запись FACE_HEIGHT - (FACE_HEIGHT - 12.362) при
			// FACE_HEIGHT < 12.362 поднимала потолок выше верха кольца.
			const ceiling = FACE_HEIGHT - ACCEPTED_BEVEL_CREST_DROP * smootherstep(amount)
			return [point[0], Math.min(point[1], ceiling)]
		}
		return point
	}
	for (let index = 0; index < points.length - 1; index++) {
		const first = points[index]
		const last = points[index + 1]
		if (degrees < first[0] || degrees > last[0]) continue
		const chord = Math.hypot(last[1][0] - first[1][0], last[1][1] - first[1][1])
		const handle = chord / 3
		const firstRadians = (first[2] * Math.PI) / 180
		const lastRadians = (last[2] * Math.PI) / 180
		const controlA: Point2 = [
			first[1][0] + handle * Math.cos(firstRadians),
			first[1][1] + handle * Math.sin(firstRadians),
		]
		const controlB: Point2 = [
			last[1][0] - handle * Math.cos(lastRadians),
			last[1][1] - handle * Math.sin(lastRadians),
		]
		if (degrees === first[0]) return finish(first[1])
		if (degrees === last[0]) return finish(last[1])
		let low = 0
		let high = 1
		for (let iteration = 0; iteration < 36; iteration++) {
			const amount = 0.5 * (low + high)
			const point = cubicBezier(first[1], controlA, controlB, last[1], amount)
			const angle = Math.atan2(point[0], point[1]) * RADIANS_TO_DEGREES
			if (angle < degrees) low = amount
			else high = amount
		}
		return finish(cubicBezier(first[1], controlA, controlB, last[1], 0.5 * (low + high)))
	}
	throw new Error('Unreachable outer-rail interval')
}

function outerRadius(degrees: number) {
	if (degrees > 90) return 10.37
	const point = upperOuterPoint(degrees)
	return Math.hypot(point[0], point[1])
}

function halfWidth(degrees: number) {
	return pchip(degrees, HALF_WIDTH_DEGREES, HALF_WIDTHS, HALF_WIDTH_SLOPES)
}

const RADIAL_CONTEXT = Array.from({ length: RADIAL_COUNT }, (_, radial) => {
	const theta = (TWO_PI * radial) / RADIAL_COUNT
	const degrees = canonicalDegrees(theta)
	return {
		theta,
		degrees,
		sinTheta: Math.sin(theta),
		cosTheta: Math.cos(theta),
		localOuterRadius: outerRadius(degrees),
		localHalfWidth: halfWidth(degrees),
		biasExponent: biasPower(degrees),
		shoulderWeight: shoulderRadialWeight(degrees),
	}
})

const SECTION_CONTEXT = Array.from({ length: SECTION_COUNT }, (_, section) => {
	const phi = (TWO_PI * section) / SECTION_COUNT
	const radialComponent = signedSuperellipseComponent(
		Math.cos(phi),
		CROSS_SECTION_EXPONENT,
	)
	const outerness = 0.5 * (1 + radialComponent)
	return {
		outerness,
		axialSign: Math.sin(phi) >= 0 ? 1 : -1,
		shellWeight: smootherstep(outerness / 0.5),
	}
})

function biasPower(degrees: number) {
	const amount = smootherstep(
		(degrees - BIAS_TRANSITION_START) /
			(BIAS_TRANSITION_END - BIAS_TRANSITION_START),
	)
	return UPPER_BIAS_POWER + amount * (LOWER_BIAS_POWER - UPPER_BIAS_POWER)
}

function sectionRatio(
	radialFraction: number,
	profile: BandProfile,
	degreeFromCrown: number,
) {
	const curveFraction = Math.max(0, radialFraction) ** (1 / SECTION_PARAMETER_POWER)
	const classicRatio = Math.max(
		0,
		pchip(
			curveFraction,
			SECTION_CURVE_KNOTS,
			SECTION_RATIOS,
			SECTION_CURVE_SLOPES,
		),
	)
	if (profile === 'classic') return classicRatio
	const profileWeight = smootherstep(
		(degreeFromCrown - FACE_REGION_DEGREES) /
			(SHOULDER_RADIAL_FULL_DEGREES - FACE_REGION_DEGREES),
	)
	const targetRatio = Math.max(0, pchip(
		curveFraction,
		SECTION_CURVE_KNOTS,
		PROFILE_SECTION_RATIOS[profile],
		PROFILE_SECTION_SLOPES[profile],
	))
	return classicRatio + (targetRatio - classicRatio) * profileWeight
}

/**
 * Множитель ширины на данном угле: у площадки один, у шинки другой.
 * Вынесен отдельно, потому что нужен и при построении вершины, и воротам
 * плоского верха — иначе они разъезжаются.
 */
function axialShapeFactor(degrees: number) {
	const blend = smootherstep(
		Math.min(
			1,
			Math.max(
				0,
				(degrees - BAND_SHAPE_START_DEGREES) /
					(BAND_SHAPE_FULL_DEGREES - BAND_SHAPE_START_DEGREES),
			),
		),
	)
	return FACE_AXIAL_FACTOR + (BAND_AXIAL_FACTOR - FACE_AXIAL_FACTOR) * blend
}

/**
 * axialFactor — то же расширение по оси, что применено к самой вершине.
 * Без него ворота считались бы по исходной полуширине, прибавка ширины
 * оказывалась за их границей, и вместо плоскости по краю площадки шёл
 * скруглённый валик.
 */
function faceGate(x: number, z: number, outerness: number, axialFactor: number) {
	const normX = Math.abs(x) / FACE_HALF_X
	const normZ = Math.abs(z) / (FACE_HALF_Z * axialFactor)
	const xPower = normX ** FACE_EXPONENT
	const zPower = normZ ** FACE_EXPONENT
	const total = xPower + zPower
	const level = total ** (1 / FACE_EXPONENT)
	let weightX: number
	let weightZ: number
	if (total <= 1e-15) {
		weightX = 0.5
		weightZ = 0.5
	} else {
		weightX = xPower / total
		weightZ = 1 - weightX
	}
	const support =
		1 +
		FACE_SUPPORT_X * weightX +
		FACE_SUPPORT_Z * weightZ +
		FACE_CORNER_BONUS * 4 * weightX * weightZ
	const boundaryDistance = Math.max(0, (level - 1) / (support - 1))
	const wallDistance = Math.max(
		0,
		(FACE_WALL_FULL - outerness) / (FACE_WALL_FULL - FACE_WALL_START),
	)
	const distance =
		(boundaryDistance ** FACE_BLEND_POWER + wallDistance ** FACE_BLEND_POWER) **
		(1 / FACE_BLEND_POWER)
	return 1 - smootherstep(distance)
}

function faceAdjustedY(
	x: number,
	y: number,
	z: number,
	degrees: number,
	outerness: number,
	axialFactor = 1,
) {
	let adjustedY = Math.min(y, FACE_HEIGHT)
	if (degrees <= 45 && adjustedY < FACE_HEIGHT) {
		// The reference section is unscaled; the actual section supplies its
		// own axial factor. Expanding the reference gate too would flatten
		// an extra strip and force a sharp step into the real crown edge.
		const gate = faceGate(x, z, outerness, axialFactor)
		adjustedY += gate * (FACE_HEIGHT - adjustedY)
	}
	return adjustedY
}

function canonicalDegrees(theta: number) {
	const rawDegrees = (theta * RADIANS_TO_DEGREES) % 360
	return Math.min(rawDegrees, 360 - rawDegrees)
}

function shoulderRadialWeight(degrees: number) {
	return smootherstep(
		(degrees - FACE_REGION_DEGREES) /
			(SHOULDER_RADIAL_FULL_DEGREES - FACE_REGION_DEGREES),
	)
}

function shoulderGrowthAdjustment(
	degrees: number,
	shoulders: ShoulderStyle,
	bias: number,
	bandward: boolean,
) {
	if (shoulders === 'classic') return 0
	const preset = SHOULDER[shoulders]
	const amount = (degrees - preset.startDeg) / (preset.endDeg - preset.startDeg)
	const field =
		smootherstep(amount / bias) * smootherstep((1 - amount) / (1 - bias))
	const classicSpan = SHOULDER.classic.endDeg - SHOULDER.classic.startDeg
	const span = preset.endDeg - preset.startDeg
	return (
		SHOULDER_TRANSITION_STRENGTH[shoulders] *
		(span / classicSpan - 1) *
		field *
		(bandward ? clamp01(amount) : 1)
	)
}

function shoulderRadialGrowth(degrees: number, shoulders: ShoulderStyle) {
	return 1 +
		shoulderGrowthAdjustment(
			degrees,
			shoulders,
			SHOULDER[shoulders].radialBias,
			false,
		)
}

function shoulderAxialGrowth(degrees: number, shoulders: ShoulderStyle) {
	return 1 +
		shoulderGrowthAdjustment(
			degrees,
			shoulders,
			SHOULDER[shoulders].axialBias,
			true,
		)
}

function outerSizeDisplacement(
	theta: number,
	degrees: number,
	deltaRadius: number,
): Point2 {
	const radialWeight = shoulderRadialWeight(degrees)
	return [
		deltaRadius * Math.sin(theta) * radialWeight,
		deltaRadius * (1 + radialWeight * (Math.cos(theta) - 1)),
	]
}

function shoulderBell(degrees: number) {
	const startDegrees = SHOULDER.curved.startDeg
	const endDegrees = SHOULDER.curved.endDeg
	const amount = clamp01(
		(degrees - startDegrees) / (endDegrees - startDegrees),
	)
	return 64 * amount ** 3 * (1 - amount) ** 3
}

function curvedShoulderSweep(degrees: number) {
	const t = clamp01((degrees - 24) / 58)
	// Put the inward sweep nearer the crown and finish gradually before the
	// lower band. A centred bell releases too late and makes a second bulge.
	return t ** 3 * (1 - t) ** 6 / ((1 / 3) ** 3 * (2 / 3) ** 6)
}

function shoulderTargetHalfWidth(
	degrees: number,
	shoulders: Exclude<ShoulderStyle, 'classic'>,
) {
	const startDegrees = SHOULDER.curved.startDeg
	const endDegrees = SHOULDER.curved.endDeg
	const amount = clamp01(
		(degrees - startDegrees) / (endDegrees - startDegrees),
	)
	const direction = shoulders === 'curved' ? 0.65 : -1.1
	const remapped = clamp01(
		amount +
			direction * amount * (1 - amount) * (1 - 2 * amount),
	)
	const startWidth = halfWidth(startDegrees)
	const endWidth = halfWidth(endDegrees)
	const designedWidth = startWidth + (endWidth - startWidth) * remapped
	return halfWidth(degrees) +
		(designedWidth - halfWidth(degrees)) * shoulderBell(degrees)
}

function acceptedOuterRailPoint(
	degrees: number,
	deltaRadius: number,
): Point2 {
	const theta = degrees / RADIANS_TO_DEGREES
	const radius = outerRadius(degrees)
	const x = radius * Math.sin(theta)
	const y = faceAdjustedY(
		x,
		radius * Math.cos(theta),
		0,
		degrees,
		1,
	)
	const displacement = outerSizeDisplacement(theta, degrees, deltaRadius)
	return [x + displacement[0], y + displacement[1]]
}

function straightShoulderRail(deltaRadius: number) {
	const first = acceptedOuterRailPoint(28, deltaRadius)
	const last = acceptedOuterRailPoint(82, deltaRadius)
	const tangent = (degrees: number): Point2 => {
		const before = acceptedOuterRailPoint(degrees - 0.001, deltaRadius)
		const after = acceptedOuterRailPoint(degrees + 0.001, deltaRadius)
		const length = Math.hypot(after[0] - before[0], after[1] - before[1])
		return [(after[0] - before[0]) / length, (after[1] - before[1]) / length]
	}
	const startTangent = tangent(28)
	const endTangent = tangent(82)
	const offset = (point: Point2, direction: Point2, distance: number): Point2 =>
		[point[0] + direction[0] * distance, point[1] + direction[1] * distance]
	// One fair rail, tangent to both the head bevel and the lower band.
	// Local bell/chord blending creates an S-shaped waist when amplified.
	const controls: readonly Point2[] = [
		first, offset(first, startTangent, 0.5), offset(first, startTangent, 1),
		offset(last, endTangent, -1.5), offset(last, endTangent, -0.75), last,
	]
	const evaluate = (t: number): Point2 => {
		const s = 1 - t
		const weights = [s ** 5, 5 * s ** 4 * t, 10 * s ** 3 * t ** 2,
			10 * s ** 2 * t ** 3, 5 * s * t ** 4, t ** 5]
		let x = 0, y = 0
		for (let index = 0; index < 6; index++) {
			x += controls[index][0] * weights[index]
			y += controls[index][1] * weights[index]
		}
		return [x, y]
	}
	return (degrees: number) => {
		if (degrees <= 28 || degrees >= 82) return 0
		const accepted = acceptedOuterRailPoint(degrees, deltaRadius)
		const theta = degrees / RADIANS_TO_DEGREES
		const ray: Point2 = [Math.sin(theta), Math.cos(theta)]
		let low = 0, high = 1
		for (let iteration = 0; iteration < 32; iteration++) {
			const p = evaluate((low + high) / 2)
			// Resizing translates the head: intersect a line through the actual
			// sized rail, not a polar ray from the old origin.
			if (ray[0] * (p[1] - accepted[1]) - ray[1] * (p[0] - accepted[0]) > 0) {
				low = (low + high) / 2
			} else high = (low + high) / 2
		}
		const target = evaluate((low + high) / 2)
		return (target[0] - accepted[0]) * ray[0] + (target[1] - accepted[1]) * ray[1]
	}
}

interface BaseVertexScratch {
	x: number
	y: number
	z: number
	neutralX: number
	neutralY: number
	localThickness: number
	deformedHalfWidth: number
	acceptedY: number
	acceptedNeutralX: number
	acceptedNeutralY: number
	radialFraction: number
	acceptedAxial: number
	axialSign: number
	shellWeight: number
}

function baseVertex(
	radialContext: (typeof RADIAL_CONTEXT)[number],
	sectionContext: (typeof SECTION_CONTEXT)[number],
	deltaRadius: number,
	outerDisplacement: Point2,
	mass: (typeof MASS)[RingMass],
	profile: BandProfile,
	shoulders: ShoulderStyle,
	output: BaseVertexScratch,
) {
	const {
		theta,
		degrees,
		sinTheta,
		cosTheta,
		localOuterRadius,
		localHalfWidth,
		biasExponent,
		shoulderWeight,
	} = radialContext
	const { outerness, axialSign, shellWeight } = sectionContext
	const radialFraction = outerness ** biasExponent
	const radialThickness = localOuterRadius - INNER_RADIUS
	const sectionWidthRatio = sectionRatio(radialFraction, profile, degrees)
	const acceptedSectionWidthRatio = sectionRatio(
		radialFraction,
		'classic',
		degrees,
	)
	const acceptedRadial = INNER_RADIUS + radialThickness * radialFraction
	const acceptedAxial =
		axialSign * localHalfWidth * acceptedSectionWidthRatio
	const acceptedX = acceptedRadial * sinTheta
	const acceptedFaceY = faceAdjustedY(
		acceptedX,
		acceptedRadial * cosTheta,
		acceptedAxial,
		degrees,
		outerness,
	)
	const outerFieldWeight = smootherstep(radialFraction)
	// Разведение пропорций площадки и обруча: см. FACE_AXIAL_FACTOR.
	// Множитель действует только на внешнюю поверхность (outerFieldWeight),
	// поэтому посадочное отверстие остаётся круглым и неизменным.
	const shapeAxial = axialShapeFactor(degrees)
	// Keep the widened crown and its monotone relief rail unchanged. Below
	// that rail, release the widening into the thin band instead of carrying
	// the full head width down to the inner lip (the protruding side "ears").
	const sectionShapeAxial =
		BAND_AXIAL_FACTOR +
		(shapeAxial - BAND_AXIAL_FACTOR) *
			smootherstep((outerness - 0.5) / (FACE_WALL_START - 0.5))
	// Тот же переход, но для толщины: 1 у площадки, BAND_RADIAL_FACTOR у шинки.
	const bandBlend =
		(shapeAxial - FACE_AXIAL_FACTOR) / (BAND_AXIAL_FACTOR - FACE_AXIAL_FACTOR)
	const shapeRadial = 1 + (BAND_RADIAL_FACTOR - 1) * bandBlend
	const radialScale = (1 + (mass.radial - 1) * outerFieldWeight) * shapeRadial
	const radialGrowth = shoulderRadialGrowth(degrees, shoulders)
	const radial =
		INNER_RADIUS + radialThickness * radialFraction * radialScale * radialGrowth
	const axialScale = (1 + (mass.axial - 1) * outerFieldWeight) * sectionShapeAxial
	const axialGrowth = shoulderAxialGrowth(degrees, shoulders)
	const axial =
		axialSign * localHalfWidth * sectionWidthRatio * axialScale * axialGrowth
	let x = radial * sinTheta
	let y = radial * cosTheta
	const faceSurfaceWeight = smootherstep(
		(outerness - FACE_WALL_START) / (FACE_WALL_FULL - FACE_WALL_START),
	)
	const supportWeight =
		(1 - shoulderWeight) * faceSurfaceWeight
	y +=
		(mass.support - 1) * radialThickness * radialGrowth * supportWeight
	y = faceAdjustedY(x, y, axial, degrees, outerness, sectionShapeAxial)
	if (Math.abs(acceptedFaceY - FACE_HEIGHT) <= 1e-4) {
		y = acceptedFaceY
	}
	const crownSurfaceWeight =
		(1 - shoulderWeight) * faceSurfaceWeight
	const outerSurfaceFraction =
		radialFraction + crownSurfaceWeight * (1 - radialFraction)
	const innerDisplacementX = deltaRadius * sinTheta
	const innerDisplacementY = deltaRadius * cosTheta
	const displacementX =
		innerDisplacementX +
		(outerDisplacement[0] - innerDisplacementX) * outerSurfaceFraction
	const displacementY =
		innerDisplacementY +
		(outerDisplacement[1] - innerDisplacementY) * outerSurfaceFraction
	output.neutralX = x
	output.neutralY = y
	x += displacementX
	y += displacementY
	output.x = x
	output.y = y
	output.z = axial
	output.localThickness = radialThickness * radialScale * radialGrowth
	output.deformedHalfWidth = localHalfWidth * axialScale * axialGrowth
	output.acceptedY = acceptedFaceY + displacementY
	output.acceptedNeutralX = acceptedX
	output.acceptedNeutralY = acceptedFaceY
	output.radialFraction = radialFraction
	output.acceptedAxial = axialSign * localHalfWidth * sectionWidthRatio
	output.axialSign = axialSign
	output.shellWeight = shellWeight
}

function writePositions(
	ringDiameter: number,
	massPreset: RingMass,
	profile: BandProfile,
	shoulders: ShoulderStyle,
) {
	const positions = new Float32Array(RADIAL_COUNT * SECTION_COUNT * 3)
	const innerRadius = ringDiameter / 2
	const deltaRadius = innerRadius - INNER_RADIUS
	const mass = MASS[massPreset]
	const usesAdditiveDeformation =
		massPreset !== 'classic' || shoulders !== 'classic'
	const baseMass = usesAdditiveDeformation ? MASS.classic : mass
	const baseShoulders: ShoulderStyle = usesAdditiveDeformation
		? 'classic'
		: shoulders
	const vertexScratch: BaseVertexScratch = {
		x: 0,
		y: 0,
		z: 0,
		neutralX: 0,
		neutralY: 0,
		localThickness: 0,
		deformedHalfWidth: 0,
		acceptedY: 0,
		acceptedNeutralX: 0,
		acceptedNeutralY: 0,
		radialFraction: 0,
		acceptedAxial: 0,
		axialSign: 1,
		shellWeight: 0,
	}
	const massAmount = MASS[massPreset].radial - 1
	const acceptedTopY = FACE_HEIGHT + deltaRadius
	const straightRadialDelta = shoulders === 'straight' ? straightShoulderRail(deltaRadius) : null
	let correctionCursor = 0
	for (let radial = 0; radial < RADIAL_COUNT; radial++) {
		const radialContext = RADIAL_CONTEXT[radial]
		const {
			theta,
			degrees,
			sinTheta,
			cosTheta,
			localOuterRadius,
			localHalfWidth,
		} = radialContext
		const outerDisplacement = outerSizeDisplacement(
			theta,
			degrees,
			deltaRadius,
		)
		const acceptedLocalThickness = localOuterRadius - INNER_RADIUS
		const massShoulderWeight = smootherstep((degrees - 20) / 50)
		const shoulderActive =
			shoulders !== 'classic' && degrees > 24 && degrees < 82
		let shoulderRadialDelta = 0
		let shoulderAxialRatio = 1
		if (shoulderActive) {
			let targetHalfWidth: number
			if (shoulders === 'straight') {
				shoulderRadialDelta = straightRadialDelta!(degrees)
				targetHalfWidth = shoulderTargetHalfWidth(degrees, 'straight')
			} else {
				shoulderRadialDelta =
					outerRadius(degrees + 6 * curvedShoulderSweep(degrees)) - localOuterRadius
				targetHalfWidth = shoulderTargetHalfWidth(degrees, 'curved')
			}
			shoulderAxialRatio =
				localHalfWidth > 0 ? targetHalfWidth / localHalfWidth : 1
		}
		for (let section = 0; section < SECTION_COUNT; section++) {
			const vertex = radial * SECTION_COUNT + section
			baseVertex(
				radialContext,
				SECTION_CONTEXT[section],
				deltaRadius,
				outerDisplacement,
				baseMass,
				profile,
				baseShoulders,
				vertexScratch,
			)
			let x = vertexScratch.x
			let y = vertexScratch.y
			let finalZ = vertexScratch.z
			if (CORRECTION_VERTEX_INDICES[correctionCursor] === vertex) {
				const componentOffset = correctionCursor * 3
				const radius =
					Math.hypot(vertexScratch.neutralX, vertexScratch.neutralY) +
					CORRECTION_COMPONENTS[componentOffset] * vertexScratch.localThickness
				const angle = theta + CORRECTION_COMPONENTS[componentOffset + 2]
				const correctedX = radius * Math.sin(angle)
				const correctedY = radius * Math.cos(angle)
				x = correctedX + (x - vertexScratch.neutralX)
				y = correctedY + (y - vertexScratch.neutralY)
				const acceptedRadius =
					Math.hypot(
						vertexScratch.acceptedNeutralX,
						vertexScratch.acceptedNeutralY,
					) +
					CORRECTION_COMPONENTS[componentOffset] * acceptedLocalThickness
				const acceptedY =
					acceptedRadius * Math.cos(angle) +
					(vertexScratch.acceptedY - vertexScratch.acceptedNeutralY)
				finalZ +=
					CORRECTION_COMPONENTS[componentOffset + 1] *
					vertexScratch.deformedHalfWidth
				if (Math.abs(acceptedY - (FACE_HEIGHT + deltaRadius)) <= 1e-4) {
					y = acceptedY
				}
				correctionCursor++
			}
			if (usesAdditiveDeformation) {
				let massDeltaX = 0
				let massDeltaY = 0
				let massDeltaZ = 0
				if (massPreset !== 'classic') {
					const radialDelta =
						massAmount *
						acceptedLocalThickness *
						vertexScratch.radialFraction
					const faceRelease = smootherstep(
						Math.max(0, acceptedTopY - y) / MASS_FACE_RELEASE_DEPTH,
					)
					massDeltaX = radialDelta * sinTheta
					massDeltaY =
						radialDelta *
						cosTheta *
						massShoulderWeight *
						faceRelease
					massDeltaZ = (mass.axial - 1) * finalZ
				}
				let shoulderDeltaX = 0
				let shoulderDeltaY = 0
				let shoulderDeltaZ = 0
				if (shoulderActive) {
					shoulderDeltaX =
						shoulderRadialDelta * sinTheta * vertexScratch.radialFraction
					shoulderDeltaY =
						shoulderRadialDelta * cosTheta * vertexScratch.radialFraction
					const axialDelta =
						vertexScratch.acceptedAxial *
						(shoulderAxialRatio - 1) *
						vertexScratch.shellWeight
					shoulderDeltaZ = Number.isFinite(axialDelta)
						? axialDelta
						: vertexScratch.axialSign * 0
				}
				x += massDeltaX + shoulderDeltaX
				y += massDeltaY + shoulderDeltaY
				finalZ += massDeltaZ + shoulderDeltaZ
			}
			const offset = vertex * 3
			positions[offset] = x
			positions[offset + 1] = y
			positions[offset + 2] = finalZ
		}
	}
	return positions
}

function buildIndices() {
	const indices = new Uint16Array(RADIAL_COUNT * SECTION_COUNT * 6)
	let cursor = 0
	for (let radial = 0; radial < RADIAL_COUNT; radial++) {
		const nextRadial = (radial + 1) % RADIAL_COUNT
		for (let section = 0; section < SECTION_COUNT; section++) {
			const nextSection = (section + 1) % SECTION_COUNT
			const a = radial * SECTION_COUNT + section
			const b = radial * SECTION_COUNT + nextSection
			const c = nextRadial * SECTION_COUNT + nextSection
			const d = nextRadial * SECTION_COUNT + section
			indices[cursor++] = a
			indices[cursor++] = b
			indices[cursor++] = c
			indices[cursor++] = a
			indices[cursor++] = c
			indices[cursor++] = d
		}
	}
	return indices
}

function squareUvProjection(positions: Float32Array, vertices: readonly number[]) {
	let minimumX = Infinity
	let maximumX = -Infinity
	let minimumZ = Infinity
	let maximumZ = -Infinity
	for (const vertex of vertices) {
		minimumX = Math.min(minimumX, positions[vertex * 3])
		maximumX = Math.max(maximumX, positions[vertex * 3])
		minimumZ = Math.min(minimumZ, -positions[vertex * 3 + 2])
		maximumZ = Math.max(maximumZ, -positions[vertex * 3 + 2])
	}
	const width = maximumX - minimumX
	const height = maximumZ - minimumZ
	const span = Math.max(width, height, 1e-9)
	const offsetU = (1 - width / span) * 0.5
	const offsetV = (1 - height / span) * 0.5
	return (vertex: number) =>
		[
			(positions[vertex * 3] - minimumX) / span + offsetU,
			(-positions[vertex * 3 + 2] - minimumZ) / span + offsetV,
		] as const
}

function meshDimensions(
	positions: Float32Array,
	faceVertexIndices: readonly number[],
	bottomRadial: number,
) {
	let maximumY = -Infinity
	for (let vertex = 0; vertex < positions.length / 3; vertex++) {
		maximumY = Math.max(maximumY, positions[vertex * 3 + 1])
	}
	let bandHalfWidth = 0
	for (let section = 0; section < SECTION_COUNT; section++) {
		bandHalfWidth = Math.max(
			bandHalfWidth,
			Math.abs(positions[(bottomRadial * SECTION_COUNT + section) * 3 + 2]),
		)
	}
	let faceHalfWidth = 0
	let faceHalfLength = 0
	for (const vertex of faceVertexIndices) {
		const offset = vertex * 3
		if (maximumY - positions[offset + 1] > 1e-4) continue
		faceHalfWidth = Math.max(faceHalfWidth, Math.abs(positions[offset]))
		faceHalfLength = Math.max(faceHalfLength, Math.abs(positions[offset + 2]))
	}
	return { bandHalfWidth, faceHalfWidth, faceHalfLength }
}

export function buildAcceptedMountainRing(
	input: AcceptedMountainRingOptions,
): MountainSignetModel {
	const options = normalizeAcceptedMountainRingOptions(input)
	const positions = writePositions(
		options.ringDiameter,
		options.mass,
		options.profile,
		options.shoulders,
	)
	const indices = buildIndices()
	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setIndex(new THREE.BufferAttribute(indices, 1))
	geometry.computeVertexNormals()
	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()

	const sectionSurfaceIndices: number[] = []
	for (let section = 0; section < SECTION_COUNT; section++) {
		const phi = (TWO_PI * section) / SECTION_COUNT
		const radialComponent = signedSuperellipseComponent(
			Math.cos(phi),
			CROSS_SECTION_EXPONENT,
		)
		const outerness = 0.5 * (1 + radialComponent)
		if (outerness >= FACE_WALL_START) sectionSurfaceIndices.push(section)
	}

	const faceRadialIndices: number[] = []
	for (let radial = 0; radial < RADIAL_COUNT; radial++) {
		const degrees = canonicalDegrees((TWO_PI * radial) / RADIAL_COUNT)
		if (degrees <= FACE_REGION_DEGREES) faceRadialIndices.push(radial)
	}
	const midpoint = RADIAL_COUNT / 2
	const firstFaceEdge =
		faceRadialIndices.filter(radial => radial < midpoint).at(-1) ?? 0
	const secondFaceEdge =
		faceRadialIndices.find(radial => radial > midpoint) ?? RADIAL_COUNT - 1
	const shoulderForward: number[] = []
	const shoulderBackward: number[] = []
	for (let radial = firstFaceEdge + 1; radial <= midpoint; radial++) {
		shoulderForward.push(radial)
	}
	for (let radial = secondFaceEdge - 1; radial > midpoint; radial--) {
		shoulderBackward.push(radial)
	}

	const faceVertexIndices: number[] = []
	for (const radial of faceRadialIndices) {
		for (const section of sectionSurfaceIndices) {
			faceVertexIndices.push(radial * SECTION_COUNT + section)
		}
	}
	const faceProjectUv = squareUvProjection(positions, faceVertexIndices)
	const faceUvs = faceVertexIndices.map(faceProjectUv)

	const shoulderVertexIndices: number[] = []
	const shoulderDistances: number[] = []
	for (const side of [shoulderForward, shoulderBackward]) {
		for (let radialOffset = 0; radialOffset < side.length; radialOffset++) {
			const distance = side.length <= 1 ? 1 : radialOffset / (side.length - 1)
			for (const section of sectionSurfaceIndices) {
				shoulderVertexIndices.push(side[radialOffset] * SECTION_COUNT + section)
				shoulderDistances.push(distance)
			}
		}
	}
	const shoulderUvs = shoulderVertexIndices.map(faceProjectUv)

	const faceShoulderPairs = sectionSurfaceIndices.flatMap(section => [
		{
			face: firstFaceEdge * SECTION_COUNT + section,
			shoulder: (firstFaceEdge + 1) * SECTION_COUNT + section,
		},
		{
			face: secondFaceEdge * SECTION_COUNT + section,
			shoulder: (secondFaceEdge - 1) * SECTION_COUNT + section,
		},
	])
	const bottomBandVertexIndices = sectionSurfaceIndices.map(
		section => midpoint * SECTION_COUNT + section,
	)
	const dimensions = meshDimensions(positions, faceVertexIndices, midpoint)

	return {
		geometry,
		originalPositions: positions.slice(),
		faceVertexIndices,
		faceUvs,
		shoulderVertexIndices,
		shoulderUvs,
		shoulderDistances,
		faceShoulderPairs,
		bottomBandVertexIndices,
		publicProps: {
			innerDiameter: options.ringDiameter,
			innerCircumference: options.ringDiameter * Math.PI,
			...dimensions,
		},
		radialCount: RADIAL_COUNT,
		sectionCount: SECTION_COUNT,
		sectionSurfaceIndices,
		faceRadialIndices,
		shoulderSides: [shoulderForward, shoulderBackward],
		faceEdges: [firstFaceEdge, secondFaceEdge],
	}
}
