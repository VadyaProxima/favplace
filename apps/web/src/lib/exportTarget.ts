import { useEffect } from 'react'
import type * as THREE from 'three'

/**
 * Реестр текущего отрисованного изделия.
 *
 * Экспорт STL берёт меш отсюда, а не строит геометрию заново — иначе файл
 * и превью неизбежно разъедутся, как это уже случилось с серверным
 * /api/export/stl (эндпоинт по этой причине и удалён). Вьюер один в каждый
 * момент времени, поэтому хватает одной ячейки.
 */
let current: THREE.Object3D | null = null

export function getExportTarget(): THREE.Object3D | null {
	return current
}

/**
 * Регистрирует отрисованный меш на время жизни вьюера.
 *
 * Присваивание идёт в фазе рендера, а не в useEffect: компоненты внутри
 * <Canvas> живут в отдельном реконсилере R3F, и полагаться на порядок
 * эффектов между двумя корнями не стоит — к моменту клика по «Скачать STL»
 * ячейка должна быть заполнена гарантированно.
 */
export function useExportTarget(object: THREE.Object3D | null | undefined) {
	if (object) current = object

	useEffect(() => {
		if (!object) return
		return () => {
			if (current === object) current = null
		}
	}, [object])
}
