'use client'

import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef, type ElementRef } from 'react'
import * as THREE from 'three'

type Props = {
	target?: [number, number, number] | THREE.Vector3
	minDistance?: number
	maxDistance?: number
	minPolarAngle?: number
	maxPolarAngle?: number
}

/**
 * Orbit rotation and grab pan:
 * - Space + drag → pan
 * - Middle mouse drag → pan
 * - Right mouse drag → pan
 * - Left mouse → rotate (unless Space is held)
 */
export function RingOrbitControls({
	target = [0, 0.55, 0],
	minDistance = 0.85,
	maxDistance = 12,
	minPolarAngle = 0.12,
	maxPolarAngle = Math.PI / 1.75,
}: Props) {
	const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)
	const { gl } = useThree()

	useEffect(() => {
		const el = gl.domElement
		let spaceDown = false
		let heldButtons = 0

		const syncButtons = () => {
			const c = controlsRef.current
			if (!c) return
			c.mouseButtons.MIDDLE = THREE.MOUSE.PAN
			c.mouseButtons.LEFT = spaceDown ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
			c.mouseButtons.RIGHT = THREE.MOUSE.PAN
		}

		const syncCursor = () => {
			if ((heldButtons & 6) || (spaceDown && (heldButtons & 1))) {
				el.style.cursor = 'grabbing'
			} else if (spaceDown) {
				el.style.cursor = 'grab'
			} else {
				el.style.cursor = ''
			}
		}

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.code !== 'Space' || e.repeat) return
			const t = e.target as HTMLElement | null
			if (
				t &&
				(t.tagName === 'INPUT' ||
					t.tagName === 'TEXTAREA' ||
					t.tagName === 'SELECT' ||
					t.isContentEditable)
			) {
				return
			}
			e.preventDefault()
			spaceDown = true
			syncButtons()
			syncCursor()
		}

		const onKeyUp = (e: KeyboardEvent) => {
			if (e.code !== 'Space') return
			spaceDown = false
			syncButtons()
			syncCursor()
		}

		const onPointerDown = (e: PointerEvent) => {
			heldButtons = e.buttons
			syncCursor()
		}

		const onPointerUp = (e: PointerEvent) => {
			heldButtons = e.buttons
			syncCursor()
		}
		const reset = () => { heldButtons = 0; spaceDown = false; syncButtons(); syncCursor() }

		const onMouseDown = (e: MouseEvent) => {
			if (e.button === 1) e.preventDefault()
		}

		const onAuxClick = (e: MouseEvent) => {
			if (e.button === 1) e.preventDefault()
		}

		syncButtons()
		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('keyup', onKeyUp)
		el.addEventListener('pointerdown', onPointerDown)
		window.addEventListener('pointerup', onPointerUp)
		window.addEventListener('pointercancel', reset)
		window.addEventListener('blur', reset)
		el.addEventListener('mousedown', onMouseDown)
		el.addEventListener('auxclick', onAuxClick)

		return () => {
			window.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('keyup', onKeyUp)
			el.removeEventListener('pointerdown', onPointerDown)
			window.removeEventListener('pointerup', onPointerUp)
			window.removeEventListener('pointercancel', reset)
			window.removeEventListener('blur', reset)
			el.removeEventListener('mousedown', onMouseDown)
			el.removeEventListener('auxclick', onAuxClick)
			el.style.cursor = ''
		}
	}, [gl])

	return (
		<OrbitControls
			ref={controlsRef}
			enablePan
			screenSpacePanning
			panSpeed={1}
			minDistance={minDistance}
			maxDistance={maxDistance}
			minPolarAngle={minPolarAngle}
			maxPolarAngle={maxPolarAngle}
			target={target}
			enableDamping
		/>
	)
}
