'use client'

import { useT } from '@/lib/preferences'

import { useAdminSession } from '@/lib/adminSession'
import {
	createTerrainRequestPlan,
	terrainFrameFromResponse,
	terrainRequestUrl,
	type TerrainApiResponse,
} from '@/lib/referenceTerrainRequests'
import { useTerrainAnalysis } from '@/lib/useTerrainAnalysis'
import { useAppStore } from '@/store/useAppStore'
import { useCallback, useEffect, useState } from 'react'
import { StudioLayout } from './StudioLayout'
import type { FlyTarget } from './TerrainMap'
import { StepForm } from './steps/StepForm'
import { StepOrder } from './steps/StepOrder'
import { StepPlace } from './steps/StepPlace'
import { StepRelief } from './steps/StepRelief'
import { StepSize } from './steps/StepSize'
import { buildShareUrl, useConfigUrl } from './useConfigUrl'

export function CreateStudio() {
	const t = useT()
	// Экспорт STL — служебная операция, покупателю она не нужна.
	// Вход: /admin. Гейт косметический: сама сборка файла живёт в браузере.
	const { isAdmin } = useAdminSession()

	const step = useAppStore(s => s.step)

	const setEdgeTerrainFrames = useAppStore(s => s.setEdgeTerrainFrames)

	const { fetching, error: terrainError } = useTerrainAnalysis()
	const [shared, setShared] = useState(false)
	const [flyTarget, setFlyTarget] = useState<FlyTarget>({
		lng: 138.7307,
		lat: 35.3628,
		key: 0,
	})

	// Вторая местность формы «duo». Отдельный лёгкий запрос: она ложится
	// узкими полосами по краям площадки, и разрешение 512 там избыточно.
	const edgeLat = useAppStore(s => s.edgeLocation?.coordinates.lat)
	const edgeLng = useAppStore(s => s.edgeLocation?.coordinates.lng)
	const edgeRadius = useAppStore(s => s.edgeRadius)
	const ringFormForEdge = useAppStore(s => s.ringForm)
	useEffect(() => {
		if (ringFormForEdge !== 'duo') return
		if (edgeLat === undefined || edgeLng === undefined) return
		const ac = new AbortController()
		const timer = setTimeout(async () => {
			try {
				const plan = createTerrainRequestPlan({
					lat: edgeLat,
					lng: edgeLng,
					radiusMeters: edgeRadius,
					bearing: 0,
				})
				const stage = plan.fine[plan.fine.length - 1]
				const res = await fetch(terrainRequestUrl(stage), { signal: ac.signal })
				if (!res.ok) throw new Error(`Terrain API ${res.status}`)
				const data = (await res.json()) as TerrainApiResponse
				setEdgeTerrainFrames(terrainFrameFromResponse(data, true), null)
			} catch {
				// Вторая местность необязательна: если кадр не пришёл, кольцо
				// строится по основной местности, а не падает.
			}
		}, 120)
		return () => {
			clearTimeout(timer)
			ac.abort()
		}
	}, [ringFormForEdge, edgeLat, edgeLng, edgeRadius, setEdgeTerrainFrames])

	const flyTo = useCallback((lat: number, lng: number) => {
		setFlyTarget(prev => ({ lat, lng, key: prev.key + 1 }))
	}, [])

	// Ссылка-конфигурация: подхватываем место. Рельеф построит эффект выше.
	const onHydrated = useCallback(
		(hLat: number, hLng: number) => flyTo(hLat, hLng),
		[flyTo],
	)
	useConfigUrl(onHydrated)

	const share = async () => {
		const url = buildShareUrl()
		try {
			await navigator.clipboard.writeText(url)
			setShared(true)
			setTimeout(() => setShared(false), 2000)
		} catch {
			window.prompt(t('Скопируйте ссылку на конфигурацию:'), url)
		}
	}

	return (
		<StudioLayout isAdmin={Boolean(isAdmin)} fetching={fetching} shared={shared} onShare={share}>
			{terrainError && step === 'place' && (
				<p role="alert" className="mb-4 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
					{t("Не удалось загрузить высоты. Выберите место ещё раз.")}</p>
			)}
			{step === 'place' && <StepPlace flyTarget={flyTarget} flyTo={flyTo} fetching={fetching} />}
			{step === 'relief' && <StepRelief />}
			{step === 'form' && <StepForm />}
			{step === 'size' && <StepSize />}
			{step === 'order' && <StepOrder />}
		</StudioLayout>
	)
}
