import type { RingForm } from '@favplace/shared'
import { MAX_RELIEF_MM, MIN_RELIEF_MM } from './referenceSignetTerrain.ts'

/**
 * Приведение высоты рельефа к одному эталону.
 *
 * У каждой формы своя формула перевода ползунка в геометрию: классический,
 * диск, цилиндр и планка считают через `embossAmplitude`, базовые формы —
 * через `reliefAmplitudeForTable`, гора — сразу в миллиметрах. При одном и
 * том же значении ползунка металл поднимался на разную высоту: базовые формы
 * давали 17–20% от классического, гора — 71%.
 *
 * Эталон — классический сигнет, его реальный диапазон и задаёт
 * MIN/MAX_RELIEF_MM. Значение ползунка теперь равно миллиметрам, на которые
 * поднимается рельеф, а здесь оно пересчитывается в то число, которое нужно
 * подать билдеру конкретной формы, чтобы получить ровно эти миллиметры.
 *
 * Каждая форма аффинна по своему входу: `высота_мм = a·вход + b`. Значит
 * обратная поправка тоже аффинная: `вход = (1/a)·мм − b/a`. Коэффициенты a и b
 * сняты замером на реальных моделях, проверяются и пересчитываются скриптом
 * `scripts/qa-relief-height-parity.mjs`.
 */
interface ReliefGain {
	gain: number
	offset: number
}

const IDENTITY: ReliefGain = { gain: 1, offset: 0 }

const FORM_GAIN: Record<RingForm, ReliefGain> = {
	// a = 1.328889, b =  0.139333 — эталон, задаёт диапазон ползунка
	classic: { gain: 0.752511, offset: -0.104851 },
	// a = 1.577778, b = -0.138333
	disc: { gain: 0.633803, offset: 0.087676 },
	// a = 1.577778, b = -0.206333
	plug: { gain: 0.633803, offset: 0.130789 },
	// a = 1.575556, b = -0.087667
	bar: { gain: 0.634697, offset: 0.055642 },
	// a = 0.322222, b =  0.280333
	square: { gain: 3.103448, offset: -0.869965 },
	// a = 0.360000, b =  0.316000
	circle: { gain: 2.777778, offset: -0.877778 },
	// a = 0.289630, b =  0.253111
	oval: { gain: 3.452425, offset: -0.873909 },
	// Гора считает рельеф прямо в миллиметрах через reliefMillimeters,
	// то есть уже совпадает с диапазоном эталона — поправка не нужна.
	mountain: IDENTITY,
	// «Duo» — та же горная геометрия с двумя местностями.
	duo: IDENTITY,
}

/** Поправка ползунка (мм) для форм, которые принимают `reliefHeight`. */
export function calibratedReliefHeight(form: RingForm, reliefHeight: number): number {
	const { gain, offset } = FORM_GAIN[form] ?? IDENTITY
	return Math.max(0, reliefHeight * gain + offset)
}

/** Та же поправка для горы: она принимает нормированный 0..1, а не миллиметры. */
export function calibratedReliefScale(reliefScale: number): number {
	const millimetres = MIN_RELIEF_MM + reliefScale * (MAX_RELIEF_MM - MIN_RELIEF_MM)
	const corrected = calibratedReliefHeight('mountain', millimetres)
	return Math.min(
		1,
		Math.max(0, (corrected - MIN_RELIEF_MM) / (MAX_RELIEF_MM - MIN_RELIEF_MM)),
	)
}
