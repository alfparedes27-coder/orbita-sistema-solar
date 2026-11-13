// «Explorar el rover»: visor 3D a pantalla completa con el modelo detallado de cada rover, despiece por piezas con la explicación
// de cada una, panel del lanzamiento y la llegada, y un recorrido animado sobre el terreno (suspensión rocker‑bogie articulada).
// Cada rover se describe en ROVERS con su constructor; la página de Marte llama a abrirRover(id). Tanda 1: Perseverance y Curiosity.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const Mt = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .25, ...o });
const box = (w, h, d, m, r = 0) => new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), m);
const cyl = (r1, r2, h, m, s = 24) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s), m);
function rod(a, b, r, m) { const d = b.clone().sub(a), c = cyl(r, r, d.length(), m, 10); c.position.copy(a).add(b).multiplyScalar(.5); c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); return c; }
function at(mesh, x, y, z, rx = 0, ry = 0, rz = 0) { mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); return mesh; }
function shadows(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }

// ---------- texturas procedurales ----------
function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
const T_BLANKET = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#e6e1d4'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 215 + Math.random() * 30 | 0; x.fillStyle = `rgba(${v},${v - 6},${v - 18},.35)`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } x.strokeStyle = 'rgba(120,110,95,.35)'; x.lineWidth = 2; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); } }, [2, 2]);
const T_GOLD = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#c9a142'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = Math.random(); x.fillStyle = `rgba(${200 + v * 55 | 0},${150 + v * 60 | 0},${40 + v * 50 | 0},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 6, 2); } }, [3, 3]);
const M = {
  blanket: Mt(0xffffff, { map: T_BLANKET, roughness: .8, metalness: 0 }),      // mantas térmicas blancas del chasis
  alu: Mt(0xb9bcc2, { metalness: .75, roughness: .35 }),
  aluDark: Mt(0x8e9298, { metalness: .7, roughness: .45 }),
  dark: Mt(0x26272a, { roughness: .6 }),
  black: Mt(0x121214, { roughness: .4, metalness: .3 }),
  gold: Mt(0xffffff, { map: T_GOLD, metalness: .85, roughness: .3 }),          // Kapton dorado
  rtg: Mt(0x3b3b3d, { metalness: .5, roughness: .5 }),
  lens: new THREE.MeshPhysicalMaterial({ color: 0x0b1220, roughness: .05, clearcoat: 1, metalness: .2 }),
  red: Mt(0xc23b2c), white: Mt(0xf1efe8, { roughness: .5 }), solar: Mt(0x1a2a5c, { metalness: .5, roughness: .25 }),
};

// ---------- rueda de aluminio (0,525 m Perseverance / 0,5 m Curiosity), con tacos y, en Curiosity, los cortes en zigzag ----------
function wheel(r, w, curiosity) {
  const g = new THREE.Group();
  const rim = cyl(r, r, w, M.alu, 36); rim.rotation.z = Math.PI / 2; g.add(rim);
  const hub = cyl(r * .55, r * .55, w + .02, M.aluDark, 24); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let k = 0; k < 6; k++) { const sp = box(w * .9, r * .95, .03, M.aluDark); sp.rotation.x = k / 6 * Math.PI; g.add(sp); }   // radios curvos (titanio) simplificados
  const n = curiosity ? 24 : 48;                                                                                             // Perseverance tiene 48 tacos suaves; Curiosity 24 con chevrones
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; const cl = box(w * 1.02, .012, curiosity ? .03 : .018, M.aluDark); cl.position.set(0, Math.cos(a) * (r + .004), Math.sin(a) * (r + .004)); cl.rotation.x = -a; if (curiosity) cl.rotation.y = (k % 2 ? 1 : -1) * .35; g.add(cl); }
  g.userData.r = r; return g;
}

// ---------- rover de la clase MSL (Curiosity 2012 / Perseverance 2021): mismo chasis, distinto equipo ----------
// Devuelve {group, parts, wheels, suspension, anim}. Las piezas llevan dir (hacia dónde se separan en el despiece) y su explicación.
function buildMSL(kind) {
  const P = kind === 'perse';
  const g = new THREE.Group(), parts = [];
  const part = (id, name, obj, dir, info) => { obj.userData.part = id; parts.push({ id, name, obj, dir, info, home: obj.position.clone() }); g.add(obj); return obj; };

  // --- chasis (WEB: Warm Electronics Box) y cubierta ---
  const chassis = new THREE.Group();
  chassis.add(at(box(1.9, .55, 2.0, M.blanket, .03), 0, 1.02, .1));
  chassis.add(at(box(1.95, .04, 2.1, M.alu), 0, 1.31, .1));                                                                 // cubierta de aluminio
  chassis.add(at(box(1.0, .05, .9, M.white), -.3, 1.34, .4));                                                               // paneles de equipo sobre la cubierta
  chassis.add(at(box(.5, .35, .7, M.blanket, .02), .55, 1.5, .7));                                                           // caja de electrónica RCE
  part('chasis', P ? 'Chasis (WEB) y cubierta' : 'Chasis (WEB) y cubierta', chassis, V3(0, 1, 0),
    P ? 'La «caja de electrónica caliente»: el cuerpo del rover. Dentro van las dos computadoras (una de repuesto), las baterías, y el sistema de muestras. Se mantiene a temperatura de oficina con el calor sobrante del generador, aunque afuera haga −80 °C.'
      : 'El cuerpo del rover: 2,9 m de largo. Dentro están las computadoras, las baterías y los dos laboratorios (SAM y CheMin) que analizan el polvo de roca que les entrega el brazo.');

  // --- generador MMRTG (atrás, inclinado), con sus aletas ---
  const rtg = new THREE.Group(); const core = cyl(.23, .23, .66, M.rtg, 20); rtg.add(core);
  for (let k = 0; k < 8; k++) { const f = box(.012, .66, .38, M.rtg); const a = k / 8 * Math.PI * 2; f.position.set(Math.cos(a) * .25, 0, Math.sin(a) * .25); f.rotation.y = -a; rtg.add(f); }
  rtg.add(at(cyl(.08, .08, .3, M.gold), 0, .45, 0));
  rtg.rotation.x = -.95; rtg.position.set(0, 1.5, 1.45);
  part('mmrtg', 'Generador nuclear MMRTG', rtg, V3(0, .6, 1), 'Lleva 4,8 kg de plutonio‑238. Su calor natural se convierte en unos 110 W de electricidad (como una bombilla fuerte) de día y de noche, con polvo o sin él, durante más de 14 años. El sobrante calienta el chasis. Por eso estos rovers no dependen de paneles solares.');

  // --- suspensión rocker‑bogie (articulada): cada lado = balancín (rocker) + bogie ---
  const WR = P ? .2625 : .25, WW = P ? .39 : .4, X = 1.22;
  const wheels = [], susp = { L: null, R: null };
  for (const s of [-1, 1]) {
    const rocker = new THREE.Group(); rocker.position.set(s * X, 1.0, -.25);                                                // pivote del balancín (en el diferencial)
    const pivot = V3(0, 0, 0), fr = V3(0, -(1.0 - WR), -1.05 + .25), bg = V3(s * .02, -.35, .75);                           // extremos en coordenadas del balancín
    rocker.add(rod(pivot, fr, .055, M.alu)); rocker.add(rod(pivot, bg, .055, M.alu));
    rocker.add(at(cyl(.09, .09, .14, M.aluDark), 0, 0, 0, 0, 0, Math.PI / 2));
    const wf = wheel(WR, WW, !P); wf.position.copy(fr); rocker.add(wf); wheels.push({ obj: wf, side: s, z: -1.05 });
    rocker.add(rod(fr.clone().add(V3(0, .1, 0)), fr.clone().add(V3(0, .45, 0)), .04, M.alu));                               // actuador de dirección
    const bogie = new THREE.Group(); bogie.position.copy(bg); rocker.add(bogie);
    const bm = V3(0, -(1.0 - .35 - WR), .05 - .75 + .25), br = V3(0, -(1.0 - .35 - WR), 1.15 - .75 + .25);
    bogie.add(rod(V3(0, 0, 0), bm, .048, M.alu)); bogie.add(rod(V3(0, 0, 0), br, .048, M.alu));
    const wm = wheel(WR, WW, !P); wm.position.copy(bm); bogie.add(wm); wheels.push({ obj: wm, side: s, z: .05 });
    const wr = wheel(WR, WW, !P); wr.position.copy(br); bogie.add(wr); wheels.push({ obj: wr, side: s, z: 1.15 });
    bogie.add(rod(br.clone().add(V3(0, .1, 0)), br.clone().add(V3(0, .45, 0)), .04, M.alu));
    susp[s < 0 ? 'L' : 'R'] = { rocker, bogie };
    part(s < 0 ? 'suspL' : 'suspR', s < 0 ? 'Suspensión rocker‑bogie (izquierda)' : 'Suspensión rocker‑bogie (derecha)', rocker, V3(s, -.2, 0),
      'Seis ruedas con motor propio y sin muelles: dos balancines unidos por un diferencial. Cuando una rueda sube una piedra, el otro lado baja y el cuerpo se inclina solo la mitad. Puede trepar obstáculos del tamaño de la rueda (unos 60 cm) e inclinarse 45° sin volcar. Las ruedas delanteras y traseras giran para dirigir.');
  }
  g.add(at(cyl(.05, .05, 2 * X, M.alu), 0, 1.0, -.25, 0, 0, Math.PI / 2));                                                   // eje del diferencial

  // --- mástil (RSM) con la cabeza de cámaras ---
  const mast = new THREE.Group(); mast.position.set(.6, 1.31, -.85);
  mast.add(rod(V3(0, 0, 0), V3(0, .85, 0), .06, M.blanket));
  const head = at(box(.56, .27, .3, M.blanket, .02), 0, .98, 0); mast.add(head);
  if (P) { mast.add(at(cyl(.1, .1, .14, M.dark, 20), 0, 1.06, -.17, Math.PI / 2)); mast.add(at(cyl(.06, .06, .05, M.lens, 20), 0, 1.06, -.25, Math.PI / 2)); }  // SuperCam (telescopio + láser)
  else { mast.add(at(cyl(.09, .09, .14, M.dark, 20), 0, 1.06, -.17, Math.PI / 2)); mast.add(at(cyl(.055, .055, .05, M.lens, 20), 0, 1.06, -.25, Math.PI / 2)); } // ChemCam
  for (const x of [-.19, .19]) { mast.add(at(cyl(.045, .045, .08, M.dark, 14), x, .92, -.18, Math.PI / 2)); mast.add(at(cyl(.03, .03, .02, M.lens, 14), x, .92, -.225, Math.PI / 2)); } // Mastcam‑Z / Mastcam
  for (const x of [-.26, .26]) mast.add(at(cyl(.025, .025, .06, M.dark, 10), x, 1.0, -.17, Math.PI / 2));                                                                                   // Navcams
  part('mastil', P ? 'Mástil con Mastcam‑Z y SuperCam' : 'Mástil con Mastcam y ChemCam', mast, V3(0, 1, -.3),
    P ? 'Mide 2,2 m hasta las cámaras, como los ojos de una persona alta. Mastcam‑Z son dos cámaras con zoom que ven en 3D y en color. SuperCam dispara un láser a rocas hasta a 7 m: la chispa de plasma revela de qué están hechas, y un micrófono escucha el «clac». Las Navcams ayudan a conducir.'
      : 'Las dos Mastcam toman las fotos panorámicas en color. ChemCam dispara un láser que vaporiza un punto de roca a 7 m y un telescopio lee la luz de la chispa: así supo de qué estaban hechas más de un millón de puntos. Debajo, las Navcams en blanco y negro con las que se conduce.');

  // --- brazo robótico con torreta ---
  const arm = new THREE.Group(); arm.position.set(.62, 1.05, -.95);
  const sh = V3(0, 0, 0), el = V3(-.25, .45, -.9), wr2 = V3(-.55, -.2, -1.35);
  arm.add(at(cyl(.11, .11, .2, M.aluDark, 16), 0, 0, 0, Math.PI / 2)); arm.add(rod(sh, el, .065, M.alu)); arm.add(at(cyl(.09, .09, .18, M.aluDark, 16), el.x, el.y, el.z, 0, 0, Math.PI / 2)); arm.add(rod(el, wr2, .06, M.alu));
  const tur = new THREE.Group(); tur.position.copy(wr2); arm.add(tur);
  tur.add(cyl(.2, .2, .2, M.aluDark, 12));
  tur.add(at(cyl(.06, .025, P ? .5 : .36, M.gold, 12), 0, -.32, 0));                                                        // taladro
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + .4; const t = box(.14, .13, .15, P ? M.blanket : M.dark, .01); t.position.set(Math.cos(a) * .24, -.03, Math.sin(a) * .24); tur.add(t); }
  tur.add(at(cyl(.035, .035, .05, M.lens, 12), .26, -.03, .0, 0, 0, Math.PI / 2));
  part('brazo', 'Brazo robótico y torreta', arm, V3(-.4, .2, -1),
    P ? 'Mide 2,1 m y tiene 5 articulaciones. En la punta lleva una torreta de 45 kg: un taladro que saca núcleos de roca del tamaño de una tiza, PIXL (rayos X que mapean la química grano a grano), SHERLOC (láser ultravioleta que busca moléculas orgánicas), la cámara WATSON y un cepillo para quitar el polvo.'
      : 'Mide 2,2 m. Su torreta de 30 kg lleva un taladro de percusión que convierte la roca en polvo fino; una pala lo tamiza y lo deja caer en las entradas de SAM y CheMin, en el lomo del rover. También lleva MAHLI (una lupa‑cámara) y APXS (mide elementos químicos pegándose a la roca).');

  // --- antenas ---
  const hga = new THREE.Group(); hga.position.set(-.55, 1.33, .1);
  hga.add(rod(V3(0, 0, 0), V3(0, .3, 0), .045, M.alu)); hga.add(at(cyl(.3, .3, .04, M.alu, 32), 0, .36, 0, .55)); hga.add(at(cyl(.02, .02, .22, M.dark, 8), 0, .5, -.08, .55));
  part('hga', 'Antena de alta ganancia', hga, V3(-.8, .8, 0), 'Un plato de 30 cm que apunta a la Tierra y habla directo con las antenas gigantes de la NASA (Red del Espacio Profundo). Sirve para recibir las órdenes del día. La señal tarda entre 4 y 24 minutos en llegar, según dónde estén los planetas.');
  const uhf = at(cyl(.12, .12, .2, M.alu, 14), -.6, 1.42, .75);
  part('uhf', 'Antena UHF', uhf, V3(-.6, .9, .4), 'La antena cilíndrica con la que el rover manda casi todas sus fotos y datos: no a la Tierra, sino a los orbitadores (Mars Reconnaissance Orbiter, MAVEN, Odyssey) cuando pasan por encima unos minutos; ellos los reenvían con sus antenas grandes.');

  if (P) {
    const scs = at(box(.9, .22, .55, M.blanket, .02), -.1, .72, -.9);
    part('muestras', 'Sistema de muestras (carrusel y tubos)', scs, V3(0, -1, -.6), 'En la panza del rover hay un carrusel con 43 tubos de titanio ultralimpios y un segundo brazo pequeño que los mueve. Cada tubo guarda un núcleo de roca sellado. Perseverance ya dejó varios en el suelo y guarda otros dentro, para que una misión futura los traiga a la Tierra.');
    const moxie = at(box(.3, .3, .3, M.gold, .02), -.5, 1.0, .35);
    part('moxie', 'MOXIE', moxie, V3(-1, .3, 0), 'Un aparato del tamaño de una tostadora que respiró el aire marciano (96 % de CO₂) y le quitó un átomo de oxígeno a cada molécula: fabricó 122 gramos de oxígeno puro en 16 pruebas. Es el ensayo de la fábrica de oxígeno que necesitarán los astronautas para respirar y para el combustible de vuelta.');
    const rimfax = at(box(.6, .06, .3, M.dark), 0, .78, 1.1);
    part('rimfax', 'Radar RIMFAX', rimfax, V3(0, -.8, .8), 'Un radar en la parte trasera que mira hacia abajo y ve las capas de roca y hielo hasta 10 m bajo las ruedas, como una ecografía del suelo. Va dibujando un corte del subsuelo por donde pasa el rover.');
    const meda = new THREE.Group(); meda.position.set(.6, 1.31, -.85); for (const a of [-.9, .9]) meda.add(rod(V3(0, .45, 0), V3(Math.sin(a) * .35, .45, Math.cos(a) * .35), .018, M.alu));
    part('meda', 'Estación meteorológica MEDA', meda, V3(.6, .4, .2), 'Sensores en el mástil y en el cuerpo: viento, temperatura, humedad, presión, radiación y, sobre todo, polvo. Mide el clima todos los días para preparar las misiones con astronautas.');
    // Ingenuity (aparte, en el suelo; vuela en el recorrido)
    const ing = new THREE.Group();
    ing.add(at(box(.14, .14, .14, Mt(0x8a7f6e), .01), 0, .3, 0)); ing.add(at(box(.5, .01, .34, M.solar), 0, .92, 0)); ing.add(at(cyl(.012, .012, .6, M.alu, 8), 0, .62, 0));
    const rot = []; for (const y of [.55, .7]) { const r = box(1.2, .008, .08, Mt(0x33302c)); r.position.y = y; ing.add(r); rot.push(r); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + .78; ing.add(rod(V3(0, .25, 0), V3(Math.cos(a) * .3, 0, Math.sin(a) * .3), .008, Mt(0xdddddd))); }
    ing.position.set(2.6, 0, -.4); ing.userData.rot = rot;
    part('ingenuity', 'Helicóptero Ingenuity', ing, V3(1, .5, 0), 'Pesa 1,8 kg y viajó colgado de la panza del rover. Sus dos rotores de 1,2 m giran en sentidos opuestos a unas 2.400 rpm (5 veces más rápido que un helicóptero terrestre) porque el aire de Marte es 100 veces más fino. El 19 de abril de 2021 hizo el primer vuelo en otro planeta; voló 72 veces, hasta romper una pala en enero de 2024.');
    g.userData.ing = ing;
  } else {
    const rems = new THREE.Group(); rems.position.set(.6, 1.31, -.85); for (const a of [-.2, 1.9]) rems.add(rod(V3(0, .5, 0), V3(Math.sin(a) * .3, .5, Math.cos(a) * .3), .015, M.alu));
    part('rems', 'Estación meteorológica REMS', rems, V3(.6, .4, .2), 'Dos brazos en el mástil con sensores de viento, temperatura del aire y del suelo, humedad, presión y radiación ultravioleta. Lleva 14 años escribiendo el parte meteorológico del cráter Gale.');
    const rad = at(box(.24, .14, .24, M.gold, .01), -.45, 1.38, -.6);
    part('rad', 'Detector de radiación RAD', rad, V3(-.6, 1, -.3), 'Mide la radiación cósmica y solar que llega al suelo de Marte: la misma que recibiría un astronauta. Gracias a él se sabe que un viaje de ida y vuelta equivale a unos 15 años del límite de un trabajador nuclear, y que hacen falta refugios.');
    const sam = at(box(.55, .2, .5, M.dark, .02), -.15, 1.36, -.3);
    part('sam', 'Laboratorios SAM y CheMin (entradas)', sam, V3(0, 1, 0), 'Las dos tapas en el lomo son las entradas de los laboratorios. CheMin dispara rayos X al polvo y reconoce los minerales por cómo los desvía. SAM es un horno con tres espectrómetros: calienta la muestra a 1.000 °C y huele los gases, incluidas moléculas orgánicas y metano.');
    const dan = at(box(.3, .2, .2, M.alu, .01), -.7, 1.1, .9);
    part('dan', 'DAN (neutrones)', dan, V3(-1, -.2, .5), 'Un cañón de neutrones ruso: dispara pulsos al suelo y cuenta cuántos rebotan. Los átomos de hidrógeno los frenan, así que mide cuánta agua hay escondida en el metro superior del terreno por donde pasa.');
    const mardi = at(cyl(.04, .04, .06, M.dark, 12), .5, .8, -.9, Math.PI / 2);
    part('mardi', 'Cámara de descenso MARDI', mardi, V3(.5, -1, -.4), 'Una cámara que mira hacia abajo. Grabó en color los últimos dos minutos del aterrizaje, desde que se soltó el escudo térmico hasta el polvo del suelo: la primera película de un aterrizaje en Marte.');
  }
  for (const s of [-1, 1]) { g.add(at(cyl(.03, .03, .06, M.dark, 10), s * .5, .85, -1.0, Math.PI / 2)); g.add(at(cyl(.03, .03, .06, M.dark, 10), s * .5, .85, 1.15, -Math.PI / 2)); } // Hazcams
  shadows(g);
  return { group: g, parts, wheels, susp, WR };
}

// ---------- fichas: lanzamiento, viaje, llegada (datos NASA/JPL) ----------
const ROVERS = {
  m2020: { name: 'Perseverance', sub: 'Mars 2020 · NASA/JPL', build: () => buildMSL('perse'), mass: '1.025 kg', size: '3,0 m de largo · 2,7 m de ancho · 2,2 m de alto', speed: 'hasta 152 m/h (0,042 m/s)',
    launch: [['Despegue', '30 de julio de 2020, 11:50 UTC'], ['Cohete', 'Atlas V 541 (ULA), 4 propulsores sólidos'], ['Plataforma', 'SLC‑41, Cabo Cañaveral, Florida'], ['Viaje', '203 días · 472 millones de km'], ['Llegada', '18 de febrero de 2021, 20:55 UTC'], ['Lugar', 'Cráter Jezero (18,44° N, 77,45° E)'], ['Misión prevista', '1 año marciano (687 días)'], ['Estado', 'Funcionando (más de 45 km recorridos)']],
    edl: [['Entrada', '125 km de altura a 19.500 km/h; el escudo térmico llega a 1.300 °C'], ['Paracaídas', 'a 11 km y 1.500 km/h: el más grande llevado a Marte, 21,5 m'], ['Navegación relativa al terreno', 'compara fotos con el mapa y elige un punto seguro entre las rocas'], ['Grúa aérea', '8 retrocohetes frenan a 2,7 km/h; el rover baja colgado de 3 cables de 7,6 m'], ['Suelo', 'corta los cables y la grúa se aleja volando; «siete minutos de terror», todo automático']],
    firsts: ['Primer sonido grabado en Marte', 'Primer vuelo en otro planeta (Ingenuity)', 'Primer oxígeno fabricado en Marte (MOXIE)', 'Primeras muestras selladas para traer a la Tierra'] },
  msl: { name: 'Curiosity', sub: 'Mars Science Laboratory · NASA/JPL', build: () => buildMSL('curio'), mass: '899 kg', size: '2,9 m de largo · 2,7 m de ancho · 2,2 m de alto', speed: 'hasta 144 m/h (0,04 m/s)',
    launch: [['Despegue', '26 de noviembre de 2011, 15:02 UTC'], ['Cohete', 'Atlas V 541 (ULA), 4 propulsores sólidos'], ['Plataforma', 'SLC‑41, Cabo Cañaveral, Florida'], ['Viaje', '254 días · 567 millones de km'], ['Llegada', '6 de agosto de 2012, 05:17 UTC'], ['Lugar', 'Cráter Gale (4,59° S, 137,44° E)'], ['Misión prevista', '1 año marciano (687 días)'], ['Estado', 'Funcionando (más de 37 km; sube el monte Sharp)']],
    edl: [['Entrada', '125 km de altura a 21.000 km/h, guiada como una cápsula Apolo'], ['Paracaídas', 'a 11 km, de 16 m de diámetro, soporta 29 toneladas de fuerza'], ['Retrocohetes', 'la etapa de descenso enciende 8 motores y frena a 2,7 km/h'], ['Grúa aérea', 'estrenada aquí: el rover baja colgado de cables porque es demasiado pesado para bolsas de aire'], ['Suelo', '«Siete minutos de terror»: la señal tardaba 14 min, así que todo pasó solo']],
    firsts: ['Primer aterrizaje con grúa aérea', 'Primer taladro en Marte', 'Encontró un antiguo lago habitable (bahía Yellowknife)', 'Detectó moléculas orgánicas y metano estacional'] },
};
export const ROVER_IDS = Object.keys(ROVERS);

// ---------- terreno del recorrido: campo de alturas suave con piedras ----------
function hNoise(x, z) { return Math.sin(x * .9) * Math.cos(z * .7) * .09 + Math.sin(x * 2.3 + z * 1.7) * .035 + Math.sin(x * 5.1 - z * 4.3) * .012 + Math.cos(x * .25 + z * .4) * .18; }
function makeTerrain() {
  const geo = new THREE.PlaneGeometry(60, 60, 240, 240); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hNoise(p.getX(i), p.getZ(i))); geo.computeVertexNormals();
  const tex = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#b0683e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const r = Math.random(); x.fillStyle = `rgba(${120 + r * 90 | 0},${55 + r * 50 | 0},${28 + r * 30 | 0},.45)`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6); } }, [14, 14]);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); m.receiveShadow = true;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.14, 0), Mt(0x6e3f26, { roughness: 1 }), 260), mm = new THREE.Matrix4();
  for (let i = 0; i < 260; i++) { const x = (Math.random() - .5) * 56, z = (Math.random() - .5) * 56, s = .4 + Math.random() * 2.2; if (Math.abs(x) < 2 && Math.abs(z) < 3) continue; mm.compose(V3(x, hNoise(x, z) + .02, z), new THREE.Quaternion().random(), V3(s, s * .6, s)); rocks.setMatrixAt(i, mm); }
  rocks.castShadow = rocks.receiveShadow = true;
  const g = new THREE.Group(); g.add(m, rocks); return g;
}

// ---------- el visor ----------
let UI = null;
export function abrirRover(id, onClose) {
  const R = ROVERS[id]; if (!R) return false;
  if (UI) UI.close();
  const root = document.createElement('div'); root.className = 'rv'; root.innerHTML = `
    <canvas class="rv-gl" aria-label="Rover en 3D: arrastra para girar, rueda para acercar"></canvas>
    <header class="rv-top"><div><div class="rv-sub">${R.sub}</div><h2>${R.name}</h2></div>
      <nav class="rv-tabs" role="tablist"><button data-m="modelo" aria-pressed="true">Modelo</button><button data-m="piezas">Piezas</button><button data-m="recorrido">Recorrido</button><button data-m="lanzamiento">Lanzamiento y llegada</button></nav>
      <button class="rv-close" aria-label="Cerrar">✕</button></header>
    <aside class="rv-side"></aside>
    <div class="rv-labels"></div>
    <div class="rv-foot"><label class="rv-slider" hidden><span>Despiece</span><input type="range" min="0" max="100" value="0"></label><div class="rv-hint"></div></div>`;
  document.body.appendChild(root);
  const canvas = root.querySelector('.rv-gl'), side = root.querySelector('.rv-side'), labels = root.querySelector('.rv-labels'), slider = root.querySelector('.rv-slider'), range = slider.querySelector('input'), hint = root.querySelector('.rv-hint');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xd9a77c); scene.fog = new THREE.Fog(0xd9a77c, 14, 48);
  const cam = new THREE.PerspectiveCamera(38, 1, .05, 200); cam.position.set(5.5, 2.8, 5.8);
  const ctl = new OrbitControls(cam, canvas); ctl.enableDamping = true; ctl.target.set(0, .9, 0); ctl.minDistance = 1.5; ctl.maxDistance = 30; ctl.maxPolarAngle = 1.52; ctl.autoRotate = true; ctl.autoRotateSpeed = .8;
  scene.add(new THREE.HemisphereLight(0xffe2c8, 0x7a4426, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(6, 9, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, far: 60 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);
  // cielo: un degradado marciano (butterscotch) en una esfera
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: {}, vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = mix(vec3(.86,.64,.47), vec3(.62,.46,.36), smoothstep(0.,.5,h)); c = mix(vec3(.93,.74,.55), c, smoothstep(-.02,.12,h)); gl_FragColor = vec4(c,1.); }' })); scene.add(sky);
  const terrain = makeTerrain(); scene.add(terrain);
  const rover = R.build(); scene.add(rover.group); rover.group.rotation.order = 'YXZ'; for (const w of rover.wheels) w.obj.rotation.order = 'YXZ';
  const parts = rover.parts; let mode = 'modelo', explode = 0, selected = null, t0 = performance.now(), dist = 0, running = true;
  const drive = { s: 0, heading: 0, x: 0, z: 0, dust: [] };
  const dustGeo = new THREE.SphereGeometry(.06, 6, 5), dustMat = Mt(0xc9865a, { transparent: true, opacity: .55, roughness: 1 });

  // etiquetas HTML sobre las piezas
  const tags = parts.map(p => { const d = document.createElement('button'); d.className = 'rv-tag'; d.textContent = p.name; d.onclick = () => selectPart(p); labels.appendChild(d); return d; });
  function selectPart(p) { selected = p; renderSide(); tags.forEach((t, i) => t.classList.toggle('sel', parts[i] === p));
    parts.forEach(q => q.obj.traverse(o => { if (!o.isMesh) return; if (o.userData.m0) { o.material = o.userData.m0; o.userData.m0 = null; } if (q === p) { o.userData.m0 = o.material; o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x2f6cff); o.material.emissiveIntensity = .35; } })); }
  function renderSide() {
    if (mode === 'modelo') side.innerHTML = `<div class="kv"><span>Masa</span><b>${R.mass}</b><span>Tamaño</span><b>${R.size}</b><span>Velocidad</span><b>${R.speed}</b></div><p>Arrastra para girarlo y acércate con la rueda o pellizcando. En <b>Piezas</b> se separa en sus partes; en <b>Recorrido</b> lo ves andar.</p><ul class="rv-firsts">${R.firsts.map(f => `<li>${f}</li>`).join('')}</ul>`;
    if (mode === 'piezas') side.innerHTML = (selected ? `<h3>${selected.name}</h3><p>${selected.info}</p>` : `<h3>Despiece</h3><p>Mueve el control de abajo para separar las piezas y toca el nombre de cada una para saber qué hace.</p>`) + `<div class="rv-list">${parts.map(p => `<button data-p="${p.id}" ${selected === p ? 'aria-pressed="true"' : ''}>${p.name}</button>`).join('')}</div>`;
    if (mode === 'recorrido') side.innerHTML = `<h3>Conduciendo</h3><p>El rover avanza a <b>${R.speed}</b>; aquí lo ves <b>6 veces más rápido</b>. Mira cómo cada rueda sigue el suelo y los balancines se inclinan: ninguna rueda se despega.</p><p>En la realidad recorre unos 100 m en un buen día: los conductores en la Tierra planean la ruta con las fotos del día anterior, y el rover la sigue solo, frenando si ve una piedra o una pendiente peligrosa.</p><div class="kv"><span>Distancia</span><b id="rv-dist">0 m</b><span>Tiempo real equivalente</span><b id="rv-time">0 min</b></div>${rover.group.userData.ing ? '<p>Ingenuity vuela alrededor: en Marte voló hasta 24 m de alto y 700 m de distancia en un solo vuelo.</p>' : ''}`;
    if (mode === 'lanzamiento') side.innerHTML = `<h3>Despegue y viaje</h3><div class="kv">${R.launch.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div><h3>Los siete minutos de terror</h3><div class="kv">${R.edl.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div><a class="go" href="../cabo-canaveral/marte/#${id}/llegada">Ver la animación del aterrizaje →</a><a class="go alt" href="../cabo-canaveral/marte/#${id}">Ver el despegue en Cabo Cañaveral →</a>`;
    side.querySelectorAll('[data-p]').forEach(b => b.onclick = () => selectPart(parts.find(p => p.id === b.dataset.p)));
  }
  function setMode(m) {
    mode = m; root.querySelectorAll('.rv-tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
    slider.hidden = m !== 'piezas'; labels.hidden = m !== 'piezas'; ctl.autoRotate = m === 'modelo';
    if (m !== 'piezas') { explode = 0; range.value = 0; if (selected) { const q = selected; selected = null; parts.forEach(pp => pp.obj.traverse(o => { if (o.isMesh && o.userData.m0) { o.material = o.userData.m0; o.userData.m0 = null; } })); } tags.forEach(t => t.classList.remove('sel')); }
    if (m === 'piezas' && explode === 0) { range.value = 60; explode = .6; }
    if (m !== 'recorrido') { rover.group.position.set(0, 0, 0); rover.group.rotation.set(0, 0, 0); poseSuspension(0, 0, 0, 0, 0, 0); drive.s = 0; drive.x = drive.z = drive.heading = 0; dist = 0; ctl.target.set(0, .9, 0); terrain.visible = m !== 'piezas'; scene.fog.near = 14; }
    else { terrain.visible = true; cam.position.set(4.5, 2.4, 6); }
    hint.textContent = m === 'piezas' ? 'Toca una pieza o su nombre' : m === 'recorrido' ? 'La cámara sigue al rover; arrastra para mirar alrededor' : m === 'modelo' ? 'Arrastra para girar · rueda para acercar' : '';
    renderSide();
  }
  root.querySelectorAll('.rv-tabs button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  range.oninput = () => { explode = range.value / 100; };
  // toque sobre una pieza en el lienzo
  const ray = new THREE.Raycaster(); let down = null;
  canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', e => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || mode !== 'piezas') return; const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam); const hit = ray.intersectObject(rover.group, true)[0]; if (!hit) return; let o = hit.object; while (o && o.userData.part === undefined) o = o.parent; if (o) selectPart(parts.find(p => p.obj === o)); });

  // --- suspensión: ángulos de balancines y bogies a partir de la altura del suelo bajo cada rueda ---
  const tmpV = new THREE.Vector3();
  function groundAt(x, z) { return hNoise(x, z); }
  function poseSuspension(rockL, bogL, rockR, bogR, pitch, roll) { rover.susp.L.rocker.rotation.x = rockL; rover.susp.L.bogie.rotation.x = bogL; rover.susp.R.rocker.rotation.x = rockR; rover.susp.R.bogie.rotation.x = bogR; rover.group.rotation.x = pitch; rover.group.rotation.z = roll; }
  function stepDrive(dt) {
    const v = .042 * 6;                                                                                  // 6× la velocidad real
    drive.s += v * dt; dist += v * dt;
    // ruta: un lazo ancho, girando despacio
    drive.heading += Math.sin(drive.s * .08) * .25 * dt; drive.x += Math.sin(drive.heading) * v * dt; drive.z += Math.cos(drive.heading) * v * dt;
    if (Math.hypot(drive.x, drive.z) > 24) { drive.heading += Math.PI; }
    const g = rover.group; g.position.set(drive.x, 0, drive.z); g.rotation.set(0, drive.heading, 0);
    // alturas del suelo bajo las 6 ruedas (en el marco del rover: x lateral, z adelante=-z)
    const h = {}; for (const w of rover.wheels) { tmpV.set(w.side * 1.22, 0, w.z).applyAxisAngle(V3(0, 1, 0), drive.heading).add(g.position); h[w.side + ':' + w.z] = groundAt(tmpV.x, tmpV.z); }
    const WR = rover.WR, L = s => h[s + ':-1.05'], Mw = s => h[s + ':0.05'], Rw = s => h[s + ':1.15'];
    const bog = s => Math.atan2(Mw(s) - Rw(s), 1.1), rock = s => Math.atan2(L(s) - (Mw(s) + Rw(s)) / 2, 1.65);
    const hL = (L(-1) + Mw(-1) + Rw(-1)) / 3, hR = (L(1) + Mw(1) + Rw(1)) / 3, hF = (L(-1) + L(1)) / 2, hB = (Mw(-1) + Mw(1) + Rw(-1) + Rw(1)) / 4;
    g.position.y = (hL + hR) / 2 + .04;
    poseSuspension(rock(-1), bog(-1), rock(1), bog(1), Math.atan2(hF - hB, 1.65) * .9, Math.atan2(hR - hL, 2.44));
    for (const w of rover.wheels) w.obj.rotation.x += v * dt / WR;
    // dirección de las ruedas delanteras y traseras al girar
    const steer = Math.sin(drive.s * .08) * .25 * .8; for (const w of rover.wheels) if (Math.abs(w.z) > .5) w.obj.rotation.y = (w.z < 0 ? 1 : -1) * steer;
    // polvo tras las ruedas traseras
    if (Math.random() < dt * 8) for (const s of [-1, 1]) { const d = new THREE.Mesh(dustGeo, dustMat.clone()); tmpV.set(s * 1.22, .05, 1.3).applyAxisAngle(V3(0, 1, 0), drive.heading).add(g.position); d.position.copy(tmpV); d.userData.age = 0; scene.add(d); drive.dust.push(d); }
    for (let i = drive.dust.length - 1; i >= 0; i--) { const d = drive.dust[i]; d.userData.age += dt; d.position.y += dt * .12; d.scale.setScalar(1 + d.userData.age * 1.6); d.material.opacity = .45 * (1 - d.userData.age / 2.2); if (d.userData.age > 2.2) { scene.remove(d); drive.dust.splice(i, 1); } }
    // Ingenuity vuela en círculos alrededor
    const ing = g.userData.ing; if (ing) { const t = drive.s * .5; ing.position.set(Math.cos(t) * 4.5 + 0, 2.2 + Math.sin(t * 1.7) * .6, Math.sin(t) * 4.5); ing.rotation.y = -t; ing.rotation.z = .12; ing.userData.rot.forEach((r, i) => r.rotation.y += (i ? 1 : -1) * .5); }
    // cámara: sigue al rover
    const tgt = tmpV.set(g.position.x, g.position.y + .9, g.position.z); ctl.target.lerp(tgt, .08);
    const back = V3(Math.sin(drive.heading + .6), 0, Math.cos(drive.heading + .6)).multiplyScalar(-6).add(V3(0, 2.6, 0)).add(g.position); if (cam.position.distanceTo(g.position) > 9) cam.position.lerp(back, .03);
    const de = side.querySelector('#rv-dist'); if (de) { de.textContent = dist.toFixed(1) + ' m'; side.querySelector('#rv-time').textContent = (dist / .042 / 60).toFixed(1) + ' min'; }
  }
  // --- bucle ---
  let last = performance.now();
  function frame(now) {
    if (!running) return; requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (mode === 'piezas') { for (const p of parts) { p.obj.position.copy(p.home).addScaledVector(p.dir, explode * 1.1); } }
    else for (const p of parts) p.obj.position.copy(p.home);
    if (mode === 'recorrido') stepDrive(dt);
    else { const ing = rover.group.userData.ing; if (ing) { ing.position.set(2.6, 0, -.4); ing.rotation.set(0, 0, 0); ing.userData.rot.forEach((r, i) => r.rotation.y += (i ? 1 : -1) * .5); } }
    if (mode === 'piezas') for (let i = 0; i < parts.length; i++) { const p = parts[i]; const b = new THREE.Box3().setFromObject(p.obj); b.getCenter(tmpV); tmpV.project(cam); const vis = tmpV.z < 1; tags[i].hidden = !vis; tags[i].style.left = (tmpV.x + 1) / 2 * w + 'px'; tags[i].style.top = (1 - tmpV.y) / 2 * h + 'px'; }
    ctl.update(); renderer.render(scene, cam);
  }
  requestAnimationFrame(frame);
  function close() { running = false; renderer.dispose(); root.remove(); UI = null; onClose && onClose(); }
  root.querySelector('.rv-close').onclick = close; const onKey = e => { if (e.key === 'Escape') { removeEventListener('keydown', onKey); close(); } }; addEventListener('keydown', onKey);
  setMode('modelo');
  UI = { close };
  window.__rv = { rover, hNoise, THREE };   // para pruebas
  return true;
}
