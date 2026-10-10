import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
let width = Number(params.get('width')) || 1920, height = Number(params.get('height')) || 1080;
const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setSize(width, height);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .72;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f4f3f0');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .8;
const camera = new THREE.PerspectiveCamera(30, width / height, .1, 220);
camera.setViewOffset(width, height, -width * .205, 0, width, height);
const hemisphere = new THREE.HemisphereLight('#fffaf0', '#515461', .65);
scene.add(hemisphere);
const key = new THREE.DirectionalLight('#fff4de', 2.5);
key.position.set(-25, 55, 30);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 180 });
key.shadow.bias = -.0003;
key.shadow.normalBias = .035;
key.shadow.radius = 4;
scene.add(key);
const rim = new THREE.DirectionalLight('#edf1ff', 1.9); rim.position.set(15, 20, -40); scene.add(rim);
const fill = new THREE.DirectionalLight('#ffffff', .6); fill.position.set(35, 15, 25); scene.add(fill);
const metadata = await fetch('./assets/metadata.json').then(r => r.json());
const getBuffer = name => fetch('./assets/' + name).then(r => r.arrayBuffer());
const [pb, nb, ib] = await Promise.all(['ring-position.f32', 'ring-normal.f32', 'ring-index.u32'].map(getBuffer));
const positions = new Float32Array(pb), normals = new Float32Array(nb), indices = new Uint32Array(ib);
const group = new THREE.Group(); scene.add(group);
const bodyGeo = new THREE.BufferGeometry();
bodyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
bodyGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
bodyGeo.setIndex(new THREE.BufferAttribute(indices.slice(0, metadata.groups[0].count), 1));
const silver = new THREE.MeshStandardMaterial({ color: '#e6e4e0', metalness: 1, roughness: .19, envMapIntensity: .9, transparent: true, opacity: 0 });
const body = new THREE.Mesh(bodyGeo, silver); body.castShadow = true; body.receiveShadow = true; group.add(body);
const pivotY = 10.25;
const crownIndices = indices.slice(metadata.groups[1].start);
const used = [...new Set(crownIndices)];
const remap = new Map(used.map((id, i) => [id, i]));
const crownP = new Float32Array(used.length * 3), crownN = new Float32Array(used.length * 3);
used.forEach((id, i) => {
  crownP.set(positions.subarray(id * 3, id * 3 + 3), i * 3);
  crownP[i * 3 + 1] -= pivotY;
  crownN.set(normals.subarray(id * 3, id * 3 + 3), i * 3);
});
const crownGeo = new THREE.BufferGeometry();
crownGeo.setAttribute('position', new THREE.BufferAttribute(crownP, 3));
crownGeo.setAttribute('normal', new THREE.BufferAttribute(crownN, 3));
crownGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(Array.from(crownIndices, id => remap.get(id))), 1));
crownGeo.computeBoundingBox();
const uniforms = { uPhase: { value: -.15 }, uNear: { value: 1 }, uFar: { value: 100 }, uPass: { value: 0 } };
const terrain = new THREE.MeshStandardMaterial({ color: '#e6e4e0', metalness: 1, roughness: .19, envMapIntensity: .9 });
terrain.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vLocal; uniform float uPhase; uniform float uNear; uniform float uFar; uniform float uPass;
    float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
    float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `);
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    float depth01=clamp((vViewPosition.z-uNear)/(uFar-uNear),0.,1.);
    float metal=1.-smoothstep(uPhase-.045,uPhase+.045,depth01);
    float rockNoise=noise3(vLocal*2.7)*.65+noise3(vLocal*11.)*.25+noise3(vLocal*43.)*.1;
    float snow=smoothstep(1.3,2.55,vLocal.y+rockNoise*.38);
    vec3 rock=mix(vec3(.065,.075,.072),vec3(.23,.24,.21),rockNoise);
    vec3 mountainColor=mix(rock,vec3(.68,.73,.72),snow);
    diffuseColor.rgb=mix(mountainColor,diffuseColor.rgb,metal);
  `);
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.91,roughnessFactor,metal);');
  shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor*=metal;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
    if(uPass>.5){
      float band=exp(-pow((depth01-uPhase)/.018,2.));
      float grain=.75+.25*sin(vLocal.x*48.+vLocal.z*27.);
      gl_FragColor=vec4(vec3(band*grain)*vec3(.72,.83,1.),1.);
    }
  `);
};
const mountain = new THREE.Mesh(crownGeo, terrain); mountain.castShadow = true; mountain.receiveShadow = true; group.add(mountain);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: '#65584a', opacity: .13 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const depthMaterial = new THREE.ShaderMaterial({
  uniforms: { uNear: uniforms.uNear, uFar: uniforms.uFar },
  vertexShader: 'varying float vDepth; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'uniform float uNear,uFar;varying float vDepth;void main(){float d=1.-clamp((vDepth-uNear)/(uFar-uNear),0.,1.);gl_FragColor=vec4(vec3(d),1.);}',
  toneMapped: false,
});
const beautyTexture = new THREE.FramebufferTexture(width, height);
// Store the already display-encoded default framebuffer without another conversion.
beautyTexture.colorSpace = THREE.NoColorSpace;
const depthTarget = new THREE.WebGLRenderTarget(width, height);
const scanTarget = new THREE.WebGLRenderTarget(width, height);
const postScene = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postUniforms = { tBeauty: { value: beautyTexture }, tDepth: { value: depthTarget.texture }, tScan: { value: scanTarget.texture }, uPhase: uniforms.uPhase, uStrength: { value: 0 }, uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(width, height) }, uMode: { value: 0 } };
const post = new THREE.ShaderMaterial({ uniforms: postUniforms, depthTest: false, depthWrite: false, toneMapped: false,
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: `precision highp float;varying vec2 vUv;uniform sampler2D tBeauty,tDepth,tScan;uniform float uPhase,uStrength,uTime,uMode;uniform vec2 uResolution;
  void main(){
    if(uMode>2.5){
      float d=1.-texture2D(tDepth,vUv).r;
      float wave=exp(-pow((d-uPhase)/.09,2.))*uStrength;
      vec2 jitter=vec2(sin(vUv.y*21.+uTime*18.),cos(vUv.x*17.-uTime*13.));
      gl_FragColor=vec4(vec2(.5)+jitter*wave*.5,.5,1.);return;
    }
    if(uMode>1.5){gl_FragColor=texture2D(tScan,vUv);return;}
    if(uMode>.5){gl_FragColor=texture2D(tDepth,vUv);return;}
    float d=1.-texture2D(tDepth,vUv).r;
    float wave=exp(-pow((d-uPhase)/.09,2.))*uStrength;
    vec2 jitter=vec2(sin(vUv.y*21.+uTime*18.),cos(vUv.x*17.-uTime*13.));
    vec2 offset=jitter*wave*vec2(11.,6.)/uResolution;
    vec2 uv=clamp(vUv+offset,vec2(.001),vec2(.999));
    vec2 ca=vec2(wave*1.7/uResolution.x,0.);
    vec3 color=vec3(texture2D(tBeauty,uv+ca).r,texture2D(tBeauty,uv).g,texture2D(tBeauty,uv-ca).b);
    vec3 scan=texture2D(tScan,vUv).rgb;
    color=1.-(1.-color)*(1.-scan*.5);
    gl_FragColor=vec4(color,1.);
  }` });
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const smooth = (a, b, t) => { const x = THREE.MathUtils.clamp((t-a)/(b-a),0,1); return x*x*x*(x*(x*6.-15.)+10.); };
const center = new THREE.Vector3(), corner = new THREE.Vector3();
function update(time) {
  // A C2 return at the end makes the video loop without a cut.
  const returnAmount = smooth(8.25, 10, time);
  const dock = smooth(1.6, 5.15, time) * (1-returnAmount);
  const reveal = smooth(2.0, 4.9, time) * (1-returnAmount);
  const sweep = smooth(3.65, 5.55, time) * (1-returnAmount);
  const scale = THREE.MathUtils.lerp(2.35, 1, dock);
  mountain.scale.set(scale, THREE.MathUtils.lerp(5.1,1,dock), scale);
  mountain.position.set(0, THREE.MathUtils.lerp(.5,pivotY,dock), 0);
  group.rotation.y = THREE.MathUtils.lerp(-.28,.12,dock) + .045*Math.sin(Math.PI*time/10)**2;
  group.rotation.z = THREE.MathUtils.lerp(-.02,-.12,dock);
  silver.opacity = reveal;
  body.visible = reveal > .001;
  silver.transparent = reveal < .999;
  silver.depthWrite = reveal > .999;
  const target = new THREE.Vector3(0, THREE.MathUtils.lerp(6.5,1.8,dock), 0);
  const distance = THREE.MathUtils.lerp(83,66,dock);
  const direction = new THREE.Vector3(.44,.36,.82).normalize();
  camera.position.copy(target).addScaledVector(direction,distance); camera.lookAt(target); camera.updateMatrixWorld();
  floor.position.y = THREE.MathUtils.lerp(-4.2,-10.45,dock);
  floor.material.opacity = THREE.MathUtils.lerp(.065,.10,dock);
  group.updateMatrixWorld(true);
  let near=Infinity,far=-Infinity;
  const box=crownGeo.boundingBox;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    corner.set(x,y,z).applyMatrix4(mountain.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    near=Math.min(near,-corner.z);far=Math.max(far,-corner.z);
  }
  uniforms.uNear.value=near;uniforms.uFar.value=far;
  uniforms.uPhase.value=THREE.MathUtils.lerp(-.15,1.15,sweep);
  postUniforms.uTime.value=time;
  postUniforms.uStrength.value=Math.sin(Math.PI*sweep)**2 * .8;
}
function render(time, pass='final') {
  update(time);
  scene.overrideMaterial=null;uniforms.uPass.value=0;floor.visible=true;
  scene.background.set('#f4f3f0');
  renderer.setRenderTarget(null); renderer.render(scene,camera);
  renderer.copyFramebufferToTexture(beautyTexture);
  const bodyVisible=body.visible;
  body.visible=false;floor.visible=false;scene.background.set('#000000');
  scene.overrideMaterial=depthMaterial;
  renderer.setRenderTarget(depthTarget);renderer.render(scene,camera);
  scene.overrideMaterial=null;uniforms.uPass.value=1;
  renderer.setRenderTarget(scanTarget);renderer.render(scene,camera);
  uniforms.uPass.value=0;body.visible=bodyVisible;floor.visible=true;
  renderer.setRenderTarget(null);
  if(pass==='beauty'){
    // Export the clean pass. The editable AE comp adds depth displacement and scan glow.
    scene.background.set('#f4f3f0');renderer.render(scene,camera);
  }else{
    postUniforms.uMode.value=pass==='depth'?1:pass==='scan'?2:pass==='warp'?3:0;
    renderer.render(postScene,postCamera);
  }
}
window.favplaceMotion = { render, duration:10, metadata, capture(time,pass='final'){render(time,pass);return canvas.toDataURL('image/png');} };
window.__ready=true;
document.body.dataset.ready='true';
if(params.has('render')) document.querySelector('#controls').style.display='none';
else {
  let playing=true, started=performance.now(), held=0;
  document.querySelector('#play').onclick=()=>{playing=!playing;if(playing)started=performance.now()-held*1000;document.querySelector('#play').textContent=playing?'Пауза':'Старт';};
  document.querySelector('#time').oninput=e=>{held=Number(e.target.value);started=performance.now()-held*1000;render(held);};
  function tick(now){if(playing){held=((now-started)/1000)%10;render(held);document.querySelector('#time').value=held;document.querySelector('#label').textContent=held.toFixed(2)+' / 10.00';}requestAnimationFrame(tick);}requestAnimationFrame(tick);
}
render(0);
