// Órbita real de la ISS (SGP4 con el TLE del día), posición del Sol y la Tierra fotorrealista vista desde la estación.
import * as THREE from 'three';
const sat = () => window.satellite;
const RE = 6378.137;
const TEX = '../../tex/', TEX_HI = '../../puerto-espacial-guayaquil/';

// ---------- TLE ----------
function chk(l){ let s = 0; for (const ch of l.slice(0, 68)){ if (ch >= '0' && ch <= '9') s += +ch; else if (ch === '-') s += 1; } return l.slice(0, 68) + (s % 10); }
// TLE de respaldo (posición aproximada) si no hay conexión: órbita típica con época de hoy
function fallbackTLE(){
  const d = new Date(), y = d.getUTCFullYear() % 100, start = Date.UTC(d.getUTCFullYear(), 0, 1), doy = (d - start) / 864e5 + 1;
  const ep = String(y).padStart(2,'0') + doy.toFixed(8).padStart(12, '0');
  const l1 = chk(`1 25544U 98067A   ${ep}  .00016717  00000-0  30270-3 0  999 `);
  const l2 = chk(`2 25544  51.6400 ${(doy*360/62 % 360).toFixed(4).padStart(8)} 0004500 ${'120.0000'} ${'240.0000'} 15.49800000${'00001'} `);
  return [l1, l2];
}
export async function loadTLE(){
  try { const c = JSON.parse(localStorage.getItem('iss-tle') || 'null'); if (c && Date.now() - c.t < 6*3600e3) return { l:c.l, src:c.src }; } catch {}
  const save = (l, src) => { try { localStorage.setItem('iss-tle', JSON.stringify({ t:Date.now(), l, src })); } catch {} return { l, src }; };
  const tm = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  try {
    const r = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE', { signal:tm(6000) });
    const t = (await r.text()).trim().split(/\r?\n/).map(s => s.trim()); const i = t.findIndex(s => s.startsWith('1 25544'));
    if (i >= 0 && t[i+1]?.startsWith('2 25544')) return save([t[i], t[i+1]], 'CelesTrak');
  } catch {}
  try {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544/tles', { signal:tm(6000) }); const j = await r.json();
    if (j.line1 && j.line2) return save([j.line1, j.line2], 'wheretheiss.at');
  } catch {}
  return { l:fallbackTLE(), src:null };
}

// ---------- propagación ----------
export class Orbit {
  constructor(tle){ this.rec = sat().twoline2satrec(tle[0], tle[1]); this.r = new THREE.Vector3(); this.v = new THREE.Vector3(); }
  at(date){ // posición y velocidad en ECI (km, km/s)
    const pv = sat().propagate(this.rec, date);
    if (!pv.position) return false;
    this.r.set(pv.position.x, pv.position.y, pv.position.z); this.v.set(pv.velocity.x, pv.velocity.y, pv.velocity.z);
    this.gmst = sat().gstime(date); return true;
  }
  geo(){ const g = sat().eciToGeodetic({ x:this.r.x, y:this.r.y, z:this.r.z }, this.gmst); return { lat:g.latitude*180/Math.PI, lon:((g.longitude*180/Math.PI + 540) % 360) - 180, h:g.height }; }
  periodMin(){ return 2*Math.PI / this.rec.no; }
}
// Sol en ECI (dirección unitaria), fórmula de baja precisión del Almanaque Astronómico
export function sunECI(date, out = new THREE.Vector3()){
  const n = date / 864e5 + 2440587.5 - 2451545.0, L = (280.460 + .9856474*n) % 360, g = (357.528 + .9856003*n) * Math.PI/180;
  const lam = (L + 1.915*Math.sin(g) + .020*Math.sin(2*g)) * Math.PI/180, eps = (23.439 - 4e-7*n) * Math.PI/180;
  return out.set(Math.cos(lam), Math.cos(eps)*Math.sin(lam), Math.sin(eps)*Math.sin(lam)).normalize();
}
// ¿La estación está en la sombra de la Tierra? (sombra cilíndrica)
export const inShadow = (r, s) => r.dot(s) < 0 && r.clone().addScaledVector(s, -r.dot(s)).length() < RE;
// Ejes de la estación en ECI: x = hacia adelante, y = cenit, z = estribor
export function stationBasis(r, v){
  const ey = r.clone().normalize(), ex = v.clone().addScaledVector(ey, -v.dot(ey)).normalize(), ez = ex.clone().cross(ey);
  return new THREE.Matrix4().makeBasis(ex, ey, ez); // estación → ECI
}
// ECEF de la malla de la Tierra (u=0 en −180°): local x→X, y→Z(norte), z→−Y
export const MESH_TO_ECEF = new THREE.Matrix4().makeBasis(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,-1,0));

// Vista del globo: y = norte (eje Z de ECI), x = equinoccio, z = −Y
export const ECI_TO_GLOBE = new THREE.Matrix4().makeBasis(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,-1), new THREE.Vector3(0,1,0));

// ---------- pasos visibles sobre Guayaquil ----------
export function passes(orbit, obs = { lat:-2.19, lon:-79.89, h:.01 }, days = 4){
  const S = sat(), gd = { latitude:obs.lat*Math.PI/180, longitude:obs.lon*Math.PI/180, height:obs.h };
  const up = new THREE.Vector3(Math.cos(gd.latitude)*Math.cos(gd.longitude), Math.cos(gd.latitude)*Math.sin(gd.longitude), Math.sin(gd.latitude));
  const out = [], t0 = Date.now(), sun = new THREE.Vector3(); let cur = null;
  for (let t = t0; t < t0 + days*864e5; t += 20e3){
    const d = new Date(t), pv = S.propagate(orbit.rec, d); if (!pv.position) continue;
    const gm = S.gstime(d), ecf = S.eciToEcf(pv.position, gm), la = S.ecfToLookAngles(gd, ecf), el = la.elevation*180/Math.PI;
    if (el > 10){
      sunECI(t, sun); const sE = sun.clone().applyAxisAngle(new THREE.Vector3(0,0,1), -gm), sunEl = Math.asin(sE.dot(up))*180/Math.PI;
      const r = new THREE.Vector3(pv.position.x, pv.position.y, pv.position.z), lit = !inShadow(r, sun);
      const az = (la.azimuth*180/Math.PI + 360) % 360;
      if (!cur) cur = { t0:t, maxEl:el, az0:az, lit:false, dark:sunEl < -6, tMax:t };
      if (el > cur.maxEl){ cur.maxEl = el; cur.tMax = t; }
      if (lit && sunEl < -6) cur.lit = true;
      cur.t1 = t; cur.az1 = az;
    } else if (cur){ out.push(cur); cur = null; }
  }
  return out;
}
export const compass = (a) => ['norte','noreste','este','sureste','sur','suroeste','oeste','noroeste'][Math.round(a/45) % 8];

// ---------- Tierra fotorrealista ----------
const loader = new THREE.TextureLoader();
function T(url, srgb = true){ const t = loader.load(url); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
let EARTH_TEX = null;
function earthTex(){
  if (EARTH_TEX) return EARTH_TEX;
  // detalle fino: ruido que rompe el desenfoque de la textura cuando se mira de cerca
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), d = g.createImageData(256, 256);
  let s = 9; const r = () => (s = (s*16807) % 2147483647) / 2147483647;
  const v = new Float32Array(256*256); for (let o = 64; o >= 2; o /= 2) for (let y = 0; y < 256; y += o) for (let x = 0; x < 256; x += o){ const n = r(); for (let j = 0; j < o; j++) for (let i = 0; i < o; i++) v[(y+j)*256 + x+i] += n * o / 64; }
  for (let i = 0; i < v.length; i++){ const k = 128 + (v[i] - 1) * 90; d.data[i*4] = d.data[i*4+1] = d.data[i*4+2] = k; d.data[i*4+3] = 255; }
  g.putImageData(d, 0, 0); const det = new THREE.CanvasTexture(c); det.wrapS = det.wrapT = THREE.RepeatWrapping;
  EARTH_TEX = { day:T(TEX_HI + 'tierra.webp'), night:T(TEX + 'tierra-noche.webp'), clouds:T(TEX + 'nubes.webp', false), mask:T(TEX + 'tierra-mascara.png', false), det };
  return EARTH_TEX;
}
const VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = `uniform sampler2D day, night, clouds, mask, det; uniform vec3 sun; uniform float cloudShift, detail;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float mu = dot(n, sun), dayK = smoothstep(-.08, .18, mu);
  vec3 dc = texture2D(day, vUv).rgb;
  float dt = texture2D(det, vUv * vec2(512., 256.)).r * .6 + texture2D(det, vUv * vec2(2048., 1024.)).r * .4;
  dc *= mix(1., .78 + .44*dt, detail);
  float water = 1. - texture2D(mask, vUv).r;
  vec2 cu = vec2(vUv.x + cloudShift, vUv.y);
  float cl = texture2D(clouds, cu).r; cl = smoothstep(.12, .85, cl);
  float cs = texture2D(clouds, cu + vec2(.0009, -.0009)).r; // sombra de las nubes
  vec3 col = dc * (1. - .35*smoothstep(.2,.9,cs)*water*0.6);
  // brillo del Sol en el mar
  vec3 h = normalize(sun + v); float spec = pow(max(dot(n, h), 0.), 140.) * water * 1.6;
  col = col * max(mu, 0.) * 1.25 + vec3(1., .93, .8) * spec * dayK;
  col = mix(col, vec3(.96) * (max(mu,0.)*1.1 + .02), cl * .92);
  // luces de las ciudades en la noche
  vec3 nl = texture2D(night, vUv).rgb * vec3(1., .82, .55) * 1.6 * (1. - dayK) * (1. - cl*.8);
  // atmósfera: azul hacia el borde y rojizo en el terminador
  float rim = pow(1. - max(dot(n, v), 0.), 2.5);
  vec3 atm = mix(vec3(.25,.5,1.), vec3(1.,.45,.2), smoothstep(.25,.0,mu)*smoothstep(-.15,.05,mu));
  col += atm * rim * .55 * smoothstep(-.2, .3, mu);
  col = mix(col, vec3(.38,.6,1.)*max(mu,0.), .12);
  gl_FragColor = vec4(col + nl, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const AVS = `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const AFS = `uniform vec3 sun; varying vec3 vN; varying vec3 vW;
void main(){ vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float f = 1. - abs(dot(n, v));
  float lit = smoothstep(-.35, .25, dot(n, sun)); float a = pow(f, 6.) * 1.4;
  vec3 c = mix(vec3(1.,.5,.25), vec3(.35,.62,1.), smoothstep(-.1,.4,dot(n,sun)));
  gl_FragColor = vec4(c * lit, a * lit); }`;

// Escena de fondo en kilómetros: la Tierra, la atmósfera, las estrellas y el Sol
export function makeSky(){
  const tx = earthTex(), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, .5, 4e5);
  const U = { day:{value:tx.day}, night:{value:tx.night}, clouds:{value:tx.clouds}, mask:{value:tx.mask}, det:{value:tx.det}, sun:{value:new THREE.Vector3(1,0,0)}, cloudShift:{value:0}, detail:{value:1} };
  const earth = new THREE.Mesh(new THREE.SphereGeometry(RE, 256, 128), new THREE.ShaderMaterial({ uniforms:U, vertexShader:VS, fragmentShader:FS }));
  earth.matrixAutoUpdate = false; scene.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(RE + 70, 128, 64), new THREE.ShaderMaterial({ uniforms:{ sun:U.sun }, vertexShader:AVS, fragmentShader:AFS, transparent:true, side:THREE.BackSide, blending:THREE.AdditiveBlending, depthWrite:false }));
  atm.matrixAutoUpdate = false; scene.add(atm);
  // estrellas
  const N = 3000, p = new Float32Array(N*3), cc = new Float32Array(N*3); let s = 3; const r = () => (s = (s*16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++){ const z = r()*2-1, a = r()*Math.PI*2, q = Math.sqrt(1-z*z), k = .3 + Math.pow(r(), 3)*.9;
    p.set([q*Math.cos(a)*3e5, z*3e5, q*Math.sin(a)*3e5], i*3); cc.set([k, k*.97, k*(.9 + r()*.2)], i*3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(p, 3)); sg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  const starsM = new THREE.PointsMaterial({ size:1.6, sizeAttenuation:false, vertexColors:true, transparent:true, depthWrite:false });
  const stars = new THREE.Points(sg, starsM); scene.add(stars);
  // el Sol
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const g = sc.getContext('2d'), gr = g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(255,255,250,1)'); gr.addColorStop(.08,'rgba(255,250,235,1)'); gr.addColorStop(.25,'rgba(255,220,170,.35)'); gr.addColorStop(1,'rgba(255,200,150,0)'); g.fillStyle = gr; g.fillRect(0,0,128,128);
  const sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(sc), blending:THREE.AdditiveBlending, depthWrite:false, depthTest:true }));
  sunS.scale.setScalar(5e4); scene.add(sunS);
  const M = new THREE.Matrix4(), toStation = new THREE.Matrix4(), tmp = new THREE.Vector3();
  return {
    scene, cam, earth, U,
    // coloca todo en ejes de la estación: r, basis (estación→ECI), gmst, sol en ECI; extra: desplazamiento de la cámara en km
    update(orbit, sunE, date, frame = 'station'){
      if (frame === 'globe') toStation.copy(ECI_TO_GLOBE); else toStation.copy(stationBasis(orbit.r, orbit.v)).invert();
      const earthPos = frame === 'globe' ? new THREE.Vector3() : orbit.r.clone().negate().applyMatrix4(toStation);
      M.makeRotationZ(orbit.gmst).multiply(MESH_TO_ECEF); M.premultiply(toStation); M.setPosition(earthPos);
      earth.matrix.copy(M); atm.matrix.copy(M); earth.matrixWorldNeedsUpdate = atm.matrixWorldNeedsUpdate = true;
      U.sun.value.copy(sunE).applyMatrix4(toStation).normalize();
      U.cloudShift.value = (date / 864e5 * .002) % 1;
      sunS.position.copy(U.sun.value).multiplyScalar(2.5e5);
      const lit = !inShadow(orbit.r, sunE); starsM.opacity = lit ? .25 : 1;
      stars.quaternion.setFromRotationMatrix(toStation);
      return { sunLocal:U.sun.value.clone(), lit, earthPos };
    },
  };
}
