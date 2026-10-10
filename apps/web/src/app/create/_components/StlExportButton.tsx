'use client'

import { useT, useNumberFormatter } from '@/lib/preferences'

import { getExportTarget } from '@/lib/exportTarget'
import {
	MIN_CASTABLE_WALL_MM,
	auditMesh,
	auditWarnings,
	type MeshAudit,
} from '@/lib/meshAudit'
import { buildAcceptedReliefModel } from '@/lib/acceptedMountainRelief'
import { buildStlExport, downloadBlob, encodeBinarySTL } from '@/lib/stlExport'
import { useAppStore } from '@/store/useAppStore'
import { useState } from 'react'
import { RING_FORM_OPTIONS } from './FormRingViewer'

export function StlExportButton() {
	const t = useT()
	const formatNumber = useNumberFormatter()
	const mm = (value: number) => `${formatNumber(value)} ${t('мм')}`
	const ringForm = useAppStore(s => s.ringForm)
	const ringSize = useAppStore(s => s.ringSize)
	const location = useAppStore(s => s.location)
	const ringWeight = useAppStore(s => s.ringWeight)
	const bandProfile = useAppStore(s => s.bandProfile)
	const shoulderStyle = useAppStore(s => s.shoulderStyle)
	const terrainFrame = useAppStore(s => s.terrainFrame)
	const coarseTerrainFrame = useAppStore(s => s.coarseTerrainFrame)
	const terrainViewFrame = useAppStore(s => s.terrainViewFrame)
	const edgeTerrainFrame = useAppStore(s => s.edgeTerrainFrame)
	const edgeCoarseTerrainFrame = useAppStore(s => s.edgeCoarseTerrainFrame)
	const edgeStart = useAppStore(s => s.edgeStart)
	const reliefScale = useAppStore(s => s.reliefScale)
	const reliefDetail = useAppStore(s => s.reliefDetail)

	const [busy, setBusy] = useState(false)
	const [audit, setAudit] = useState<MeshAudit | null>(null)
	const [error, setError] = useState<string | null>(null)

	const fileSlug = () =>
		(location?.name ?? 'favplace')
			.toLowerCase()
			.replace(/[^a-zа-я0-9]+/gi, '-')
			.replace(/^-|-$/g, '')

	/**
	 * У горы превью строится в воркере по черновой сетке, поэтому файл на
	 * печать пересобирается тем же генератором принятой базы — не с экранного
	 * меша. Остальные формы отдаются as-is из вьюера, иначе превью и файл
	 * разъедутся.
	 *
	 * Масштаб рельефа передаётся сырым, как в MountainRingViewer:
	 * calibratedReliefScale подгонялся под прежний генератор и на принятой
	 * базе даст другую высоту, то есть превью разойдётся с файлом.
	 */
	const exportMountain = () => {
		if (!terrainFrame) {
			throw new Error(t('Рельеф ещё считается — подождите пару секунд'))
		}
		const model = buildAcceptedReliefModel({
			ringDiameter: ringSize,
			mass: ringWeight,
			profile: bandProfile,
			shoulders: shoulderStyle,
			fine: terrainFrame,
			coarse: coarseTerrainFrame,
			view: terrainViewFrame ?? terrainFrame.frame,
			relief: reliefScale,
			detail: reliefDetail,
			// Та же вторая местность, что и в превью: иначе файл разойдётся.
			edge:
				ringForm === 'duo' && edgeTerrainFrame
					? { fine: edgeTerrainFrame, coarse: edgeCoarseTerrainFrame }
					: null,
			edgeStart,
		})
		try {
			// auditMesh и бинарный STL читают позиции подряд, тройками вершин.
			const flat = model.geometry.toNonIndexed()
			const pos = flat.getAttribute('position').array as Float32Array
			const result = {
				audit: auditMesh(flat),
				blob: new Blob([encodeBinarySTL(pos)], { type: 'model/stl' }),
				filename: `favplace-mountain-${fileSlug()}-d${ringSize}mm.stl`,
			}
			flat.dispose()
			return result
		} finally {
			model.geometry.dispose()
		}
	}

	const exportViewerMesh = () => {
		const root = getExportTarget()
		if (!root) {
			throw new Error(t('Модель ещё не загрузилась — подождите, пока появится превью'))
		}
		return buildStlExport(root, {
			ringSizeMm: ringSize,
			filename: `favplace-${ringForm}-${fileSlug()}-d${ringSize}mm.stl`,
		})
	}

	const run = () => {
		setBusy(true)
		setError(null)
		try {
			// «Duo» — та же горная геометрия: собирается генератором, а не с
			// экранного меша, который горный вьюер вообще не регистрирует.
			const isMountain = ringForm === 'mountain' || ringForm === 'duo'
			const result = isMountain ? exportMountain() : exportViewerMesh()
			setAudit(result.audit)
			downloadBlob(result.blob, result.filename)
		} catch (err) {
			setError(err instanceof Error ? err.message : t('Не удалось собрать STL'))
		} finally {
			setBusy(false)
		}
	}

	const warnings = audit ? auditWarnings(audit) : []
	const formLabel = RING_FORM_OPTIONS.find(o => o.id === ringForm)?.label ?? ringForm

	return (
		<>
			<button
				type="button"
				onClick={run}
				disabled={busy}
				aria-label={busy ? t('Считаем…') : t('Скачать STL')}
				className="min-h-11 min-w-11 border border-zinc-300 bg-white/80 px-2 py-2 text-xs font-medium text-zinc-700 backdrop-blur transition hover:bg-white disabled:opacity-40 lg:min-h-0 lg:px-3.5"
			>
				<span className="hidden lg:inline">{busy ? t('Считаем…') : t('Скачать STL')}</span><span className="lg:hidden" aria-hidden="true">{busy ? '…' : 'STL'}</span>
			</button>

			{(audit || error) && (
				<div className="absolute right-0 top-full mt-2 max-h-[60dvh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border border-zinc-200 bg-white/95 p-4 text-left shadow-sm backdrop-blur lg:bottom-16 lg:top-auto lg:mt-0">
					<div className="flex items-start justify-between gap-3">
						<span className="text-[11px] uppercase tracking-wider text-zinc-400">
							{t("Проверка файла")}</span>
						<button
							type="button"
							onClick={() => {
								setAudit(null)
								setError(null)
							}}
							className="text-zinc-400 transition hover:text-zinc-800"
							aria-label={t("Закрыть")}
						>
							×
						</button>
					</div>

					{error && <p className="mt-2 text-sm text-red-600">{t(error)}</p>}

					{audit && (
						<>
							<dl className="mt-3 space-y-1 text-xs">
								<Row label={t("Форма")} value={`${t(formLabel)}, ⌀ ${ringSize} ${t("мм")}`} />
								<Row
									label={t("Габариты")}
									value={`${mm(audit.size.x)} × ${mm(audit.size.y)} × ${mm(audit.size.z)}`}
								/>
								<Row label={t("Треугольников")} value={formatNumber(audit.triangles, 0)} />
								<Row
									label={t("Замкнутость")}
									value={audit.watertight ? t('да') : t('нет')}
									bad={!audit.watertight}
								/>
								<Row
									label={t("Тоньше всего")}
									value={
										audit.p1Thickness !== null
											? `${formatNumber(audit.p1Thickness, 2)} ${t('мм')} (${t('порог')} ${MIN_CASTABLE_WALL_MM})`
											: t('замерить не удалось')
									}
									bad={
										audit.p1Thickness === null ||
										audit.p1Thickness < MIN_CASTABLE_WALL_MM
									}
								/>
							</dl>

							{warnings.length > 0 ? (
								<ul className="mt-3 space-y-2 border-t border-zinc-200 pt-3">
									{warnings.map((w, i) => (
										<li key={i} className="text-xs leading-relaxed text-amber-700">
											{t(w)}
										</li>
									))}
								</ul>
							) : (
								<p className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-relaxed text-emerald-700">
									{t("Замечаний нет. Файл можно отдавать на печать восковки.")}</p>
							)}
						</>
					)}
				</div>
			)}
		</>
	)
}

function Row({
	label,
	value,
	bad,
}: {
	label: string
	value: string
	bad?: boolean
}) {
	const t = useT()
	return (
		<div className="flex items-baseline justify-between gap-3">
			<dt className="shrink-0 text-zinc-400">{t(label)}</dt>
			<dd className={`text-right ${bad ? 'font-medium text-amber-700' : 'text-zinc-800'}`}>
				{value}
			</dd>
		</div>
	)
}
