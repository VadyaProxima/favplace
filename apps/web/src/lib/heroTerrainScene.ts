import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { MATERIALS } from '@favplace/shared'
import { JEWELLERY_ENV, JEWELLERY_GL, JEWELLERY_LIGHTS } from './jewelleryMaterial'
import { makeMountainRingMaterials } from '../app/create/_components/mountainRingAppearance'
import type { Theme } from './preferences'

export type HeroPhase = 'mountain' | 'transition' | 'ring'
export interface HeroSceneHandle {
	replay: () => void
	finish: () => void
	setVisible: (visible: boolean) => void
	setTheme: (theme: Theme) => void
	dispose: () => void
}
interface Metadata {
	encoding: string
	vertexCount: number
	indexCount: number
	positionBytes: number
	normalBytes: number
	indexBytes: number
	bodyIndexCount: number
	bounds: { min: number[]; max: number[] }
}
const ASSETS = '/hero/beshtau'
const TRANSITION_START = 1.5
const TRANSITION_END = 8
const DURATION = 10.4
const PIVOT_Y = 10.25
const smooth = (a: number, b: number, time: number) => {
	const t = THREE.MathUtils.clamp((time - a) / (b - a), 0, 1)
	return t ** 3 * (t * (t * 6 - 15) + 10)
}

async function getResponse(url: string, signal: AbortSignal) {
	const response = await fetch(url, { signal })
	if (!response.ok) throw new Error(`Hero asset ${response.status}`)
	return response
}

function decodeMesh(buffer: ArrayBuffer, meta: Metadata) {
	if (meta.encoding !== 'quantized-u16-i16-delta-v1' ||
		buffer.byteLength !== meta.positionBytes + meta.normalBytes + meta.indexBytes) {
		throw new Error('Invalid hero mesh')
	}
	const qp = new Uint16Array(buffer, 0, meta.vertexCount * 3)
	const qn = new Int16Array(buffer, meta.positionBytes, meta.vertexCount * 3)
	const bytes = new Uint8Array(buffer, meta.positionBytes + meta.normalBytes)
	const position = new Float32Array(qp.length), normal = new Float32Array(qn.length)
	for (let i = 0; i < position.length; i++) {
		const axis = i % 3
		position[i] = meta.bounds.min[axis] + qp[i] / 65535 * (meta.bounds.max[axis] - meta.bounds.min[axis])
		normal[i] = qn[i] / 32767
	}
	const index = new Uint32Array(meta.indexCount)
	let offset = 0, previous = 0
	for (let i = 0; i < index.length; i++) {
		let n = 0, shift = 0, byte: number
		do {
			if (offset >= bytes.length || shift > 21) throw new Error('Invalid hero indices')
			byte = bytes[offset++]; n |= (byte & 127) << shift; shift += 7
		} while (byte & 128)
		previous += n & 1 ? -(n + 1) / 2 : n / 2
		if (previous < 0 || previous >= meta.vertexCount) throw new Error('Hero index out of range')
		index[i] = previous
	}
	return { position, normal, index }
}

export async function createHeroTerrainScene(
	canvas: HTMLCanvasElement,
	options: {
		theme?: Theme
		signal: AbortSignal
		reducedMotion: boolean
		onPhase: (phase: HeroPhase) => void
		onError: () => void
	},
): Promise<HeroSceneHandle> {
	const { signal } = options
	const [meta, environmentBuffer, photoBitmap] = await Promise.all([
		getResponse(`${ASSETS}/metadata.json`, signal).then(r => r.json() as Promise<Metadata>),
		getResponse(JEWELLERY_ENV.files, signal).then(r => r.arrayBuffer()),
		getResponse(`${ASSETS}/forest-v2.webp`, signal).then(r => r.blob()).then(blob => createImageBitmap(blob, { imageOrientation: 'flipY' })),
	])
	let meshBuffer: ArrayBuffer
	if (typeof DecompressionStream !== 'undefined') {
		const response = await getResponse(`${ASSETS}/mesh.bin.gz`, signal)
		if (!response.body) throw new Error('Hero mesh stream missing')
		meshBuffer = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
	} else {
		meshBuffer = await getResponse(`${ASSETS}/mesh.bin`, signal).then(r => r.arrayBuffer())
	}
	if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
	const { position, normal, index } = decodeMesh(meshBuffer, meta)
	const renderer = new THREE.WebGLRenderer({ canvas, ...JEWELLERY_GL })
	renderer.outputColorSpace = THREE.SRGBColorSpace
	renderer.toneMapping = JEWELLERY_GL.toneMapping
	renderer.toneMappingExposure = JEWELLERY_ENV.toneMappingExposure
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = THREE.PCFShadowMap
	renderer.localClippingEnabled = true
	const scene = new THREE.Scene()
	let backgroundColor = options.theme === 'dark' ? '#141418' : '#f4f3f0'
	const background = new THREE.Color(backgroundColor)
	scene.background = background
	const hdr = new RGBELoader().parse(environmentBuffer)
	const environment = new THREE.DataTexture(hdr.data, hdr.width, hdr.height, THREE.RGBAFormat, hdr.type)
	environment.colorSpace = THREE.LinearSRGBColorSpace
	environment.mapping = THREE.EquirectangularReflectionMapping
	environment.minFilter = THREE.LinearFilter
	environment.magFilter = THREE.LinearFilter
	environment.flipY = true
	environment.needsUpdate = true
	const pmrem = new THREE.PMREMGenerator(renderer)
	const environmentTarget = pmrem.fromEquirectangular(environment)
	scene.environment = environmentTarget.texture
	environment.dispose(); pmrem.dispose()
	scene.environmentIntensity = JEWELLERY_ENV.environmentIntensity
	const { hemisphere, ambient, directional } = JEWELLERY_LIGHTS
	scene.add(new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity))
	scene.add(new THREE.AmbientLight('#ffffff', ambient))
	const studioLights = directional.map(spec => {
		const light = new THREE.DirectionalLight(spec.color, spec.intensity)
		light.position.fromArray(spec.position).multiplyScalar(1 / .15)
		light.castShadow = spec.castShadow; scene.add(light)
		return light
	})
	const key = studioLights[0]
	key.shadow.mapSize.set(1024, 1024)
	Object.assign(key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 180 })
	key.shadow.radius = 4; key.shadow.bias = -.0003; key.shadow.normalBias = .04
	const group = new THREE.Group(); scene.add(group)
	const bodyGeo = new THREE.BufferGeometry()
	bodyGeo.setAttribute('position', new THREE.BufferAttribute(position, 3))
	bodyGeo.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
	bodyGeo.setIndex(new THREE.BufferAttribute(index.slice(0, meta.bodyIndexCount), 1))
	const buildPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -14)
	const buildY = { value: 14 }
	const { body: silver, relief: terrain } = makeMountainRingMaterials(MATERIALS.silver, 'polished')
	silver.clippingPlanes = [buildPlane]; silver.clipShadows = true
	silver.onBeforeCompile = shader => {
		shader.uniforms.uBuildY = buildY
		shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBuildY;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBuildY=(modelMatrix*vec4(position,1.)).y;')
		shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBuildY;uniform float uBuildY;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.55,.7,.9)*exp(-pow((vBuildY-uBuildY)/.13,2.))*.45;')
	}
	const body = new THREE.Mesh(bodyGeo, silver); body.castShadow = true; body.receiveShadow = true; group.add(body)
	const crownIndex = index.subarray(meta.bodyIndexCount)
	const vertices = [...new Set(crownIndex)], remap = new Map(vertices.map((id, i) => [id, i]))
	const crownP = new Float32Array(vertices.length * 3), crownN = new Float32Array(vertices.length * 3)
	vertices.forEach((id, i) => {
		crownP.set(position.subarray(id * 3, id * 3 + 3), i * 3); crownP[i * 3 + 1] -= PIVOT_Y
		crownN.set(normal.subarray(id * 3, id * 3 + 3), i * 3)
	})
	const crownGeo = new THREE.BufferGeometry()
	crownGeo.setAttribute('position', new THREE.BufferAttribute(crownP, 3))
	crownGeo.setAttribute('normal', new THREE.BufferAttribute(crownN, 3))
	crownGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(Array.from(crownIndex, id => remap.get(id)!)), 1))
	crownGeo.computeBoundingBox()
	// Project the photographic surface onto the unchanged frontal DEM geometry.
	const photoCamera = new THREE.PerspectiveCamera(32, 670 / 549, .1, 200)
	photoCamera.position.set(0, 11.8, 0).addScaledVector(new THREE.Vector3(0, .071, 1).normalize(), 32)
	photoCamera.lookAt(0, 11.8, 0); photoCamera.updateMatrixWorld()
	const photoUv = new Float32Array(vertices.length * 2), photoPoint = new THREE.Vector3(), photoScale = new THREE.Vector3(2.25, 2.8, 2.25)
	vertices.forEach((_, i) => {
		photoPoint.fromArray(crownP, i * 3).multiply(photoScale)
		photoPoint.y += PIVOT_Y; photoPoint.project(photoCamera)
		photoUv[i * 2] = photoPoint.x * .5 + .5; photoUv[i * 2 + 1] = photoPoint.y * .5 + .5
	})
	crownGeo.setAttribute('photoUv', new THREE.BufferAttribute(photoUv, 2))
	const photoTexture = new THREE.Texture(photoBitmap)
	photoTexture.colorSpace = THREE.NoColorSpace; photoTexture.needsUpdate = true
	const uniforms = { uPhase: { value: -.15 }, uNear: { value: 1 }, uFar: { value: 100 }, uPass: { value: 0 }, uDock: { value: 0 } }
	terrain.onBeforeCompile = shader => {
		Object.assign(shader.uniforms, uniforms)
		shader.uniforms.uPhoto = { value: photoTexture }
		shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 photoUv; varying vec2 vPhotoUv; varying vec3 vLocal; varying vec3 vLocalNormal;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal=position; vLocalNormal=normal; vPhotoUv=photoUv;')
		shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLocal; varying vec3 vLocalNormal; varying vec2 vPhotoUv; uniform sampler2D uPhoto; uniform float uPhase,uNear,uFar,uPass,uDock;
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
		shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float depth01=clamp((vViewPosition.z-uNear)/(uFar-uNear),0.,1.);
float metal=1.-smoothstep(uPhase-.045,uPhase+.045,depth01);
float photoRange=smoothstep(0.,.025,vPhotoUv.x)*(1.-smoothstep(.975,1.,vPhotoUv.x))*smoothstep(0.,.025,vPhotoUv.y)*(1.-smoothstep(.975,1.,vPhotoUv.y));
metal=max(metal,(1.-photoRange)*smoothstep(.03,.3,uDock));
float grain=noise3(vLocal*3.1)*.65+noise3(vLocal*16.)*.25+noise3(vLocal*57.)*.1;
vec3 foliage=mix(vec3(.045,.075,.047),vec3(.19,.23,.125),grain);
float stone=smoothstep(.24,.72,1.-abs(vLocalNormal.y))+smoothstep(1.95,2.8,vLocal.y)*.4;
vec3 natural=mix(foliage,mix(vec3(.13,.135,.12),vec3(.33,.32,.26),grain),clamp(stone,0.,.85));
diffuseColor.rgb=mix(natural,diffuseColor.rgb,metal);`)
		shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.92,roughnessFactor,metal);')
		shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor*=metal;')
		shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
if(uPass>.5){float beam=exp(-pow((depth01-uPhase)/.022,2.));gl_FragColor=vec4(beam*vec3(.58,.77,1.),1.);}`)
		shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
vec4 photo=texture2D(uPhoto,clamp(vPhotoUv,vec2(.001),vec2(.999)));
if(photo.a<.2 && metal<.65)discard;
if(uPass<.5)gl_FragColor.rgb=mix(photo.rgb,gl_FragColor.rgb,metal);`)
	}
	const mountain = new THREE.Mesh(crownGeo, terrain); mountain.castShadow = true; mountain.receiveShadow = true; group.add(mountain)
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), new THREE.ShadowMaterial({ color: '#6e6253', opacity: .1 }))
	floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
	const camera = new THREE.PerspectiveCamera(32, 1, .1, 200)
	const controls = new OrbitControls(camera, canvas)
	controls.enabled = false; controls.enablePan = false; controls.enableZoom = false
	controls.enableDamping = true; controls.dampingFactor = .085
	controls.minPolarAngle = .12; controls.maxPolarAngle = Math.PI - .12
	canvas.style.touchAction = 'pan-y'
	const depthMaterial = new THREE.ShaderMaterial({
		uniforms: { uNear: uniforms.uNear, uFar: uniforms.uFar }, toneMapped: false,
		vertexShader: 'varying float vDepth;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}',
		fragmentShader: 'uniform float uNear,uFar;varying float vDepth;void main(){float d=1.-clamp((vDepth-uNear)/(uFar-uNear),0.,1.);gl_FragColor=vec4(vec3(d),1.);}',
	})
	let beautyTexture = new THREE.FramebufferTexture(1, 1)
	const depthTarget = new THREE.WebGLRenderTarget(1, 1), scanTarget = new THREE.WebGLRenderTarget(1, 1)
	const postScene = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
	const postUniforms = {
		tBeauty: { value: beautyTexture }, tDepth: { value: depthTarget.texture }, tScan: { value: scanTarget.texture },
		uPhase: uniforms.uPhase, uStrength: { value: 0 }, uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(1, 1) },
	}
	const post = new THREE.ShaderMaterial({ uniforms: postUniforms, depthTest: false, depthWrite: false, toneMapped: false,
		vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
		fragmentShader: `precision highp float;varying vec2 vUv;uniform sampler2D tBeauty,tDepth,tScan;uniform float uPhase,uStrength,uTime;uniform vec2 uResolution;
void main(){float d=1.-texture2D(tDepth,vUv).r;float wave=exp(-pow((d-uPhase)/.085,2.))*uStrength;
vec2 offset=vec2(sin(vUv.y*21.+uTime*18.),cos(vUv.x*17.-uTime*13.))*wave*vec2(9.,5.)/uResolution;
vec2 uv=clamp(vUv+offset,vec2(.001),vec2(.999)),split=vec2(wave*1.5/uResolution.x,0.);
vec3 color=vec3(texture2D(tBeauty,uv+split).r,texture2D(tBeauty,uv).g,texture2D(tBeauty,uv-split).b);
vec3 beam=texture2D(tScan,vUv).rgb*.6;
beam+=(texture2D(tScan,vUv+vec2(2.,0.)/uResolution).rgb+texture2D(tScan,vUv-vec2(2.,0.)/uResolution).rgb)*.1;
gl_FragColor=vec4(1.-(1.-color)*(1.-beam),1.);}`,
	})
	const postGeo = new THREE.PlaneGeometry(2, 2); postScene.add(new THREE.Mesh(postGeo, post))
	let disposed = false, visible = true, playing = !options.reducedMotion, elapsed = options.reducedMotion ? DURATION : 0
	let raf = 0, lastTick = 0, lastDraw = 0, currentPhase: HeroPhase | null = null
	const corner = new THREE.Vector3(), direction = new THREE.Vector3(0, .071, 1).normalize()
	function emitPhase(phase: HeroPhase) {
		if (currentPhase !== phase) { currentPhase = phase; options.onPhase(phase) }
	}
	function pose(time: number) {
		// One continuous six-and-a-half-second transition builds the whole ring.
		const progress = smooth(TRANSITION_START, TRANSITION_END, time)
		const dock = progress, sweep = progress, draw = progress
		const pullBack = smooth(TRANSITION_END, DURATION, time)
		const scale = THREE.MathUtils.lerp(2.25, 1, dock)
		const heightScale = THREE.MathUtils.lerp(2.8, 1, dock)
		mountain.scale.set(scale, heightScale, scale)
		mountain.position.set(0, PIVOT_Y, 0)
		// Keep the developing band joined to the relief throughout the morph.
		body.scale.copy(mountain.scale)
		body.position.set(0, PIVOT_Y * (1 - heightScale), 0)
		group.rotation.set(0, 0, 0)
		buildY.value = PIVOT_Y + (THREE.MathUtils.lerp(14, -11, draw) - PIVOT_Y) * heightScale
		buildPlane.constant = -buildY.value
		body.visible = draw > 0
		const target = new THREE.Vector3(0, THREE.MathUtils.lerp(12.8, 1.3, pullBack), 0)
		const narrow = canvas.clientWidth / Math.max(1, canvas.clientHeight) < 1.1
		const distance = THREE.MathUtils.lerp(narrow ? 34 : 29, narrow ? 59 : 55, pullBack)
		camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target); camera.updateMatrixWorld()
		controls.target.copy(target)
		floor.position.y = -10.4
		group.updateMatrixWorld(true)
		let near = Infinity, far = -Infinity
		const box = crownGeo.boundingBox!
		for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
			corner.set(x, y, z).applyMatrix4(mountain.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
			near = Math.min(near, -corner.z); far = Math.max(far, -corner.z)
		}
		uniforms.uNear.value = near; uniforms.uFar.value = far
		uniforms.uPhase.value = THREE.MathUtils.lerp(-.15, 1.15, sweep)
		uniforms.uDock.value = dock
		postUniforms.uTime.value = time; postUniforms.uStrength.value = Math.sin(Math.PI * sweep) ** 2 * .85
		emitPhase(time >= DURATION ? 'ring' : time < TRANSITION_START ? 'mountain' : 'transition')
	}
	function render() {
		if (disposed) return
		scene.overrideMaterial = null; uniforms.uPass.value = 0; floor.visible = true; background.set(backgroundColor)
		renderer.setRenderTarget(null); renderer.render(scene, camera)
		if (currentPhase === 'ring') return
		renderer.copyFramebufferToTexture(beautyTexture)
		const bodyVisible = body.visible; body.visible = false; floor.visible = false; background.set('#000000')
		scene.overrideMaterial = depthMaterial
		renderer.setRenderTarget(depthTarget); renderer.render(scene, camera)
		scene.overrideMaterial = null; uniforms.uPass.value = 1
		renderer.setRenderTarget(scanTarget); renderer.render(scene, camera)
		uniforms.uPass.value = 0; body.visible = bodyVisible; floor.visible = true
		renderer.setRenderTarget(null); renderer.render(postScene, postCamera)
	}
	function requestDraw() {
		if (!disposed && visible && !raf) raf = requestAnimationFrame(tick)
	}
	function tick(now: number) {
		raf = 0
		if (disposed || !visible) return
		if (playing) {
			if (lastTick) elapsed = Math.min(DURATION, elapsed + Math.min(.1, (now - lastTick) / 1000))
			lastTick = now
			if (now - lastDraw < 1000 / 45 && elapsed < DURATION) { requestDraw(); return }
			pose(elapsed); lastDraw = now
			if (elapsed >= DURATION) {
				playing = false; controls.enabled = true; canvas.style.touchAction = 'none'; controls.update(); controls.saveState()
			}
		} else { controls.update() }
		render()
		if (playing) requestDraw()
	}
	function resize() {
		if (disposed) return
		const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
		const ratio = Math.min(window.devicePixelRatio || 1, w < 600 ? 1.35 : 1.6)
		renderer.setPixelRatio(ratio); renderer.setSize(w, h, false)
		camera.aspect = w / h; camera.updateProjectionMatrix()
		const size = renderer.getDrawingBufferSize(new THREE.Vector2())
		beautyTexture.dispose(); beautyTexture = new THREE.FramebufferTexture(size.x, size.y); postUniforms.tBeauty.value = beautyTexture
		depthTarget.setSize(size.x, size.y); scanTarget.setSize(size.x, size.y); postUniforms.uResolution.value.copy(size)
		if (playing || currentPhase === null) pose(elapsed)
		requestDraw()
	}
	function finish() {
		playing = false; elapsed = DURATION; lastTick = 0; pose(elapsed)
		controls.enabled = true; canvas.style.touchAction = 'none'; controls.update(); controls.saveState(); requestDraw()
	}
	function replay() {
		controls.enabled = false; controls.reset(); controls.update(); canvas.style.touchAction = 'pan-y'
		playing = true; elapsed = 0; lastTick = 0; lastDraw = 0; pose(0); requestDraw()
	}
	function keyDown(event: KeyboardEvent) {
		if (!controls.enabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return
		event.preventDefault()
		if (event.key === 'Home') controls.reset()
		else {
			const offset = camera.position.clone().sub(controls.target), spherical = new THREE.Spherical().setFromVector3(offset)
			if (event.key === 'ArrowLeft') spherical.theta += .12
			if (event.key === 'ArrowRight') spherical.theta -= .12
			if (event.key === 'ArrowUp') spherical.phi = Math.max(.12, spherical.phi - .1)
			if (event.key === 'ArrowDown') spherical.phi = Math.min(Math.PI - .12, spherical.phi + .1)
			camera.position.copy(controls.target).add(offset.setFromSpherical(spherical)); controls.update()
		}
		requestDraw()
	}
	function lost(event: Event) { event.preventDefault(); visible = false; if (raf) cancelAnimationFrame(raf); raf = 0; options.onError() }
	controls.addEventListener('change', requestDraw)
	canvas.addEventListener('keydown', keyDown); canvas.addEventListener('webglcontextlost', lost)
	const observer = new ResizeObserver(resize); observer.observe(canvas)
	resize(); pose(elapsed)
	if (options.reducedMotion) finish()
	else requestDraw()
	return {
		replay, finish,
		setTheme(theme) {
			backgroundColor = theme === 'dark' ? '#141418' : '#f4f3f0'
			requestDraw()
		},
		setVisible(value) {
			visible = value; lastTick = 0
			if (!visible && raf) { cancelAnimationFrame(raf); raf = 0 }
			else requestDraw()
		},
		dispose() {
			if (disposed) return
			disposed = true; if (raf) cancelAnimationFrame(raf)
			observer.disconnect(); controls.removeEventListener('change', requestDraw); controls.dispose()
			canvas.removeEventListener('keydown', keyDown); canvas.removeEventListener('webglcontextlost', lost)
			bodyGeo.dispose(); crownGeo.dispose(); silver.dispose(); terrain.dispose(); depthMaterial.dispose()
			photoTexture.dispose(); photoBitmap.close()
			floor.geometry.dispose(); floor.material.dispose(); postGeo.dispose(); post.dispose()
			beautyTexture.dispose(); depthTarget.dispose(); scanTarget.dispose(); environmentTarget.dispose()
			key.shadow.map?.dispose(); renderer.dispose(); renderer.forceContextLoss()
		},
	}
}
