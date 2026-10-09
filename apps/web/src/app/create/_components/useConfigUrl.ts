'use client'

import { MAX_RELIEF_MM, MIN_RELIEF_MM } from '@/lib/referenceSignetTerrain'
import { STEPS, useAppStore, type Step } from '@/store/useAppStore'
import {
	// ENGRAVING_MAX_LENGTH,
	MATERIALS,
	RING_FORMS,
	RING_SIZES_MM,
	type MaterialType,
	type ReliefDetail,
	type RingForm,
	type SurfaceFinish,
} from '@favplace/shared'
import { useEffect, useRef } from 'react'

/**
 * Конфигурация целиком живёт в query-строке: конструктор можно переслать
 * ссылкой, а браузерный «назад» возвращает предыдущий шаг.
 *
 * Параметр `form` намеренно сохраняет старое имя — на него ссылается лендинг.
 */
export function buildConfigParams(): URLSearchParams {
	const s = useAppStore.getState()
	const p = new URLSearchParams()

	p.set('form', s.ringForm)
	p.set('m', s.material)
	p.set('sf', s.surfaceFinish)
	p.set('d', s.reliefDetail)
	p.set('h', s.reliefHeight.toFixed(2))
	p.set('sz', String(s.ringSize))
	p.set('r', String(s.radius))
	p.set('w', s.ringWeight)
	p.set('bp', s.bandProfile)
	p.set('sh', s.shoulderStyle)
	if (s.terrainBearing !== 0) p.set('b', String(Math.round(s.terrainBearing)))
	if (s.mountainTwoTone) p.set('tt', '1')
	// if (s.engraving.trim()) p.set('e', s.engraving.trim()) // Временно отключена.
	if (s.location) {
		p.set('lat', s.location.coordinates.lat.toFixed(5))
		p.set('lng', s.location.coordinates.lng.toFixed(5))
		p.set('p', s.location.name)
		if (s.location.country) p.set('c', s.location.country)
	}
	p.set('s', s.step)

	return p
}

/** Абсолютная ссылка на текущую конфигурацию — для кнопки «Поделиться». */
export function buildShareUrl(): string {
	if (typeof window === 'undefined') return ''
	return `${window.location.origin}${window.location.pathname}?${buildConfigParams()}`
}

function readConfigFromUrl(search: string) {
	const p = new URLSearchParams(search)
	const s = useAppStore.getState()

	const form = p.get('form')
	if (form && (RING_FORMS as string[]).includes(form)) {
		s.setRingForm(form as RingForm)
	} else {
		s.setRingForm('mountain')
	}

	const material = p.get('m')
	if (material && material in MATERIALS) s.setMaterial(material as MaterialType)

	const finish = p.get('sf')
	if (finish === 'polished' || finish === 'matte') {
		s.setSurfaceFinish(finish as SurfaceFinish)
	}

	const detail = p.get('d')
	if (detail === 'low' || detail === 'medium' || detail === 'high') {
		s.setReliefDetail(detail as ReliefDetail)
	}

	const height = Number(p.get('h'))
	if (
		Number.isFinite(height) &&
		height >= MIN_RELIEF_MM &&
		height <= MAX_RELIEF_MM
	) {
		s.setReliefHeight(height)
	}

	const size = Number(p.get('sz'))
	if (RING_SIZES_MM.includes(size)) s.setRingSize(size)

	const radius = Number(p.get('r'))
	if (Number.isFinite(radius) && radius >= 100 && radius <= 20000) {
		s.setRadius(radius)
	}

	const weight = p.get('w')
	if (weight === 'subtle' || weight === 'classic' || weight === 'statement') {
		s.setRingWeight(weight)
	}

	const profile = p.get('bp')
	if (profile === 'flat' || profile === 'classic' || profile === 'd-shaped') {
		s.setBandProfile(profile)
	}

	const shoulder = p.get('sh')
	if (shoulder === 'straight' || shoulder === 'classic' || shoulder === 'curved') {
		s.setShoulderStyle(shoulder)
	}

	const bearing = Number(p.get('b'))
	if (Number.isFinite(bearing) && bearing >= -180 && bearing <= 180) {
		s.setTerrainBearing(bearing)
	}

	s.setMountainTwoTone(p.get('tt') === '1')

	// Гравировка временно отключена, включая старые ссылки с ?e=.
	// const engraving = p.get('e')
	// if (engraving) s.setEngraving(engraving.slice(0, ENGRAVING_MAX_LENGTH))
	s.setEngraving('')

	// Number(null) === 0, поэтому проверяем именно наличие параметров,
	// иначе пустой URL читается как «выбрано место 0,0».
	const rawLat = p.get('lat')
	const rawLng = p.get('lng')
	const lat = Number(rawLat)
	const lng = Number(rawLng)
	const hasLocation =
		rawLat !== null && rawLng !== null && Number.isFinite(lat) && Number.isFinite(lng)

	if (hasLocation) {
		s.setLocation({
			id: crypto.randomUUID(),
			name: p.get('p') || 'Выбранное место',
			country: p.get('c') || '',
			coordinates: { lat, lng },
		})
	}

	const step = p.get('s')
	if (step && (STEPS as readonly string[]).includes(step)) s.setStep(step as Step)

	return { lat, lng, hasLocation }
}

/**
 * Гидрирует стор из URL один раз при монтировании и после этого держит
 * query-строку в актуальном состоянии через `replaceState` (без ререндера
 * роутера — иначе 3D-канвас пересоздаётся на каждый клик).
 */
export function useConfigUrl(onHydrated?: (lat: number, lng: number) => void) {
	const hydrated = useRef(false)

	useEffect(() => {
		if (hydrated.current) return
		hydrated.current = true
		const result = readConfigFromUrl(window.location.search)
		if (result.hasLocation) onHydrated?.(result.lat, result.lng)
		// onHydrated намеренно не в зависимостях: гидрация должна быть однократной
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		// Таймер, а не rAF: в фоновой вкладке rAF не срабатывает вовсе,
		// и ссылка осталась бы протухшей.
		let timer: ReturnType<typeof setTimeout> | undefined
		const write = () => {
			clearTimeout(timer)
			// 600 мс, а не 150: при живом пересчёте координаты меняются
			// несколько раз в секунду, а Chrome троттлит частые replaceState.
			// Итоговое положение всё равно попадёт в ссылку — окно сдвигается
			// на каждое изменение, срабатывает только после остановки.
			timer = setTimeout(() => {
				const next = `${window.location.pathname}?${buildConfigParams()}`
				if (next !== `${window.location.pathname}${window.location.search}`) {
					window.history.replaceState(null, '', next)
				}
			}, 600)
		}
		write()
		const unsub = useAppStore.subscribe(write)
		return () => {
			clearTimeout(timer)
			unsub()
		}
	}, [])
}
