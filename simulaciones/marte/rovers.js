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
  return { group: g, parts, wheels, susp, WR, geo: { X, zF: -1.05, zM: .05, zR: 1.15, lift: .04 } };
}

// ---------- Mars Exploration Rover (Spirit y Opportunity, 2004): gemelos idénticos, solares y del tamaño de un carrito de golf ----------
// 1,6 m de largo, ruedas de 26 cm, mástil de 1,5 m. Rueda delantera izquierda/derecha, media y trasera como en los grandes.
const T_CELLS = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#0d1736'; x.fillRect(0, 0, w, h); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const v = Math.random() * 14; x.fillStyle = `rgb(${18 + v | 0},${30 + v | 0},${70 + v * 2 | 0})`; x.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); } x.strokeStyle = 'rgba(190,200,220,.35)'; x.lineWidth = 1.2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); } }, [3, 3]);
const M_CELLS = Mt(0xffffff, { map: T_CELLS, metalness: .45, roughness: .28 });
function flatShape(pts, m, y, thick = .025) { const s = new THREE.Shape(); pts.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); const me = new THREE.Mesh(geo, m); me.position.y = y; return me; }
function merWheel(r, w) {   // rueda de aluminio con radios curvos en espiral (absorben golpes) y tacos rectos
  const g = new THREE.Group();
  const rim = cyl(r, r, w, M.alu, 32); rim.rotation.z = Math.PI / 2; g.add(rim);
  const face = cyl(r * .9, r * .9, w * .3, M.aluDark, 24); face.rotation.z = Math.PI / 2; face.position.x = w * .3; g.add(face);
  const hub = cyl(r * .3, r * .3, w + .02, M.dark, 16); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const sp = box(.01, r * .62, .018, M.alu); sp.position.set(w * .47, Math.cos(a + .35) * r * .5, Math.sin(a + .35) * r * .5); sp.rotation.x = -a - .7; g.add(sp); }
  for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; const cl = box(w * 1.02, .008, .012, M.aluDark); cl.position.set(0, Math.cos(a) * (r + .003), Math.sin(a) * (r + .003)); cl.rotation.x = -a; g.add(cl); }
  g.userData.r = r; return g;
}
function buildMER(kind) {
  const SP = kind === 'spirit';
  const g = new THREE.Group(), parts = [];
  const part = (id, name, obj, dir, info) => { obj.userData.part = id; parts.push({ id, name, obj, dir, info, home: obj.position.clone() }); g.add(obj); return obj; };
  // --- caja electrónica caliente (WEB) ---
  const web = new THREE.Group();
  web.add(at(box(1.0, .3, 1.15, M.blanket, .02), 0, .6, .05));
  web.add(at(box(1.02, .05, 1.17, M.gold), 0, .44, .05));
  for (const s of [-1, 1]) web.add(at(box(.02, .22, .9, M.gold), s * .51, .6, .05));
  part('web', 'Caja electrónica caliente (WEB)', web, V3(0, -.6, 0),
    'El cuerpo del rover, aislado como un termo con aerogel. Adentro: una computadora RAD6000 de 20 MHz con 128 MB de memoria (menos que un celular de hoy), dos baterías de litio y ocho calentadores de plutonio de 1 vatio cada uno. Sin ellos, las noches de −100 °C habrían congelado los circuitos.');
  // --- cubierta solar con alas desplegables ---
  const deck = new THREE.Group();
  deck.add(flatShape([[-.55, -.55], [.55, -.55], [.55, .62], [-.55, .62]], M_CELLS, .78));
  for (const s of [-1, 1]) deck.add(flatShape([[s * .55, -.55], [s * 1.15, -.3], [s * 1.15, .35], [s * .55, .62]].map(([x, z]) => [x, z]), M_CELLS, .79));
  deck.add(flatShape([[-.55, .62], [.55, .62], [.42, 1.05], [-.42, 1.05]], M_CELLS, .79));
  for (const s of [-1, 1]) deck.add(flatShape([[s * .55, .62], [s * 1.15, .35], [s * .95, .82], [s * .42, 1.05]], M_CELLS, .795));
  deck.add(at(box(2.32, .02, .02, M.alu), 0, .8, -.3)); deck.add(at(box(.02, .02, 1.6, M.alu), 0, .8, .25));
  part('solar', 'Paneles solares', deck, V3(0, .9, .2),
    'Cinco paneles, doblados como un origami dentro de la nave y abiertos en Marte: 1,3 m² de celdas de tres capas. Al comienzo daban unos 900 vatios‑hora por día marciano. El polvo los iba tapando… hasta que remolinos de viento (los «dust devils») los limpiaban de golpe. Esa suerte los hizo durar años en vez de 90 días.');
  // --- mástil PMA: Pancam, Navcam y el periscopio de Mini‑TES ---
  const mast = new THREE.Group(); mast.position.set(-.2, .8, -.42);
  mast.add(rod(V3(0, 0, 0), V3(0, .55, 0), .035, M.white)); mast.add(at(cyl(.06, .06, .08, M.aluDark, 16), 0, .3, 0));
  mast.add(at(box(.42, .08, .1, M.white, .015), 0, .64, 0));
  for (const x of [-.15, .15]) { mast.add(at(cyl(.025, .025, .06, M.dark, 12), x, .64, -.06, Math.PI / 2)); mast.add(at(cyl(.016, .016, .01, M.lens, 12), x, .64, -.09, Math.PI / 2)); }
  for (const x of [-.05, .05]) mast.add(at(cyl(.016, .016, .05, M.dark, 10), x, .64, -.06, Math.PI / 2));
  part('mastil', 'Mástil con Pancam, Navcam y Mini‑TES', mast, V3(0, .7, -.3),
    'Las cámaras quedan a 1,5 m, la altura de los ojos de una persona. Pancam son dos cámaras separadas como nuestros ojos, con 14 filtros de color, que armaban las panorámicas. En medio, las dos Navcam para conducir. Por dentro del mástil mira Mini‑TES, que mide el calor que emiten las rocas para reconocer sus minerales desde lejos.');
  // --- brazo IDD con 4 herramientas en la torreta ---
  const arm = new THREE.Group(); arm.position.set(.1, .5, -.62);
  arm.add(at(cyl(.05, .05, .12, M.aluDark, 12), 0, 0, 0, 0, 0, Math.PI / 2));
  const el = V3(.12, .02, -.38), wr = V3(-.02, -.16, -.62);
  arm.add(rod(V3(0, 0, 0), el, .028, M.alu)); arm.add(at(cyl(.04, .04, .09, M.aluDark, 12), el.x, el.y, el.z, 0, 0, Math.PI / 2)); arm.add(rod(el, wr, .026, M.alu));
  const tur = new THREE.Group(); tur.position.copy(wr); arm.add(tur);
  tur.add(at(cyl(.05, .05, .08, M.aluDark, 10), 0, 0, 0, 0, 0, Math.PI / 2));
  const tools = [[M.gold, 'RAT'], [M.dark, 'MI'], [M.alu, 'MB'], [M.blanket, 'APXS']];
  tools.forEach(([m], k) => { const a = k / 4 * Math.PI * 2; const t = box(.07, .07, .09, m, .008); t.position.set(Math.cos(a) * .08, Math.sin(a) * .08, -.02); tur.add(t); });
  part('brazo', 'Brazo IDD con 4 herramientas', arm, V3(.2, -.1, -.8),
    'Un brazo de 5 articulaciones guardado bajo el frente. Su torreta lleva cuatro herramientas: la RAT, una amoladora que lija la costra de una roca (un círculo de 4,5 cm y hasta 5 mm de hondo) para ver su interior fresco; el Microscopic Imager, una lupa‑cámara; el espectrómetro Mössbauer, que reconoce minerales con hierro; y el APXS, que mide los elementos químicos.');
  // --- antenas y reloj de sol ---
  const ant = new THREE.Group(); ant.position.set(.32, .8, .28);
  ant.add(rod(V3(0, 0, 0), V3(0, .2, 0), .02, M.alu)); ant.add(at(cyl(.14, .14, .025, M.alu, 28), 0, .23, 0, .6)); ant.add(at(cyl(.012, .012, .1, M.dark, 6), 0, .29, -.03, .6));
  ant.add(rod(V3(.3, 0, .1), V3(.3, .5, .1), .008, M.dark)); ant.add(rod(V3(-.62, 0, .2), V3(-.62, .32, .2), .012, M.white));
  part('antenas', 'Antenas', ant, V3(.5, .7, .4),
    'El plato de 28 cm es la antena de alta ganancia: apunta a la Tierra con un motor para recibir las órdenes del día. La varilla fina es la de baja ganancia, de respaldo. La blanca corta es la UHF: por ella el rover mandaba casi todos sus datos a los orbitadores Mars Odyssey y Mars Global Surveyor, que los reenviaban a la Tierra.');
  const dial = new THREE.Group(); dial.position.set(.42, .8, .78);
  dial.add(at(box(.08, .01, .08, M.white), 0, .005, 0)); dial.add(at(cyl(.003, .003, .05, M.dark, 6), 0, .03, 0));
  for (let k = 0; k < 4; k++) dial.add(at(box(.016, .004, .016, [M.red, M.gold, Mt(0x3b6fd4), Mt(0x3ea04a)][k]), (k % 2 - .5) * .056, .012, ((k >> 1) - .5) * .056));
  part('reloj', 'Reloj de sol (MarsDial)', dial, V3(.3, .8, .5),
    'Un reloj de sol con esquinas de colores: Pancam lo fotografiaba para ajustar los colores de las fotos según la luz de cada momento. Tiene escrita la palabra «Marte» en 17 idiomas y el lema «Dos mundos, un Sol».');
  // --- suspensión rocker‑bogie a escala MER ---
  const WR = .13, WW = .16, X = .6, zF = -.68, zM = .0, zR = .62, PY = .44, PZ = -.1, BY = .3, BZ = .25;
  const wheels = [], susp = { L: null, R: null };
  for (const s of [-1, 1]) {
    const rocker = new THREE.Group(); rocker.position.set(s * X, PY, PZ);
    const fr = V3(0, WR - PY, zF - PZ), bg = V3(0, BY - PY, BZ - PZ);
    rocker.add(rod(V3(0, 0, 0), fr, .025, M.alu)); rocker.add(rod(V3(0, 0, 0), bg, .025, M.alu)); rocker.add(at(cyl(.045, .045, .08, M.aluDark), 0, 0, 0, 0, 0, Math.PI / 2));
    const wf = merWheel(WR, WW); wf.position.copy(fr); rocker.add(wf); wheels.push({ obj: wf, side: s, z: zF });
    rocker.add(rod(fr.clone().add(V3(0, .05, 0)), fr.clone().add(V3(0, .22, 0)), .018, M.alu));
    const bogie = new THREE.Group(); bogie.position.copy(bg); rocker.add(bogie);
    const bm = V3(0, WR - BY, zM - BZ), br = V3(0, WR - BY, zR - BZ);
    bogie.add(rod(V3(0, 0, 0), bm, .022, M.alu)); bogie.add(rod(V3(0, 0, 0), br, .022, M.alu));
    const wm = merWheel(WR, WW); wm.position.copy(bm); bogie.add(wm); wheels.push({ obj: wm, side: s, z: zM });
    const wrr = merWheel(WR, WW); wrr.position.copy(br); bogie.add(wrr); wheels.push({ obj: wrr, side: s, z: zR });
    bogie.add(rod(br.clone().add(V3(0, .05, 0)), br.clone().add(V3(0, .22, 0)), .018, M.alu));
    susp[s < 0 ? 'L' : 'R'] = { rocker, bogie };
    part(s < 0 ? 'suspL' : 'suspR', `Suspensión y ruedas (${s < 0 ? 'izquierda' : 'derecha'})`, rocker, V3(s, -.1, 0),
      SP && s > 0 ? 'La misma suspensión rocker‑bogie que los rovers grandes, en pequeño: ruedas de 26 cm con radios en espiral que amortiguan. En 2006 se trabó el motor de la rueda delantera derecha de Spirit. Desde entonces anduvo en reversa, arrastrándola… y el surco que dejó destapó un suelo blanco de sílice casi pura, señal de que ahí hubo aguas termales.'
        : 'La misma suspensión rocker‑bogie que los rovers grandes, en pequeño: seis ruedas de 26 cm con motor propio y radios curvos en espiral que absorben los golpes. Las cuatro de las esquinas giran para dirigir, y puede pasar sobre piedras de 25 cm.');
  }
  g.add(at(cyl(.025, .025, 2 * X, M.alu), 0, PY, PZ, 0, 0, Math.PI / 2));
  for (const s of [-1, 1]) { g.add(at(cyl(.018, .018, .04, M.dark, 10), s * .15, .5, -.5, Math.PI / 2)); g.add(at(cyl(.018, .018, .04, M.dark, 10), s * .15, .5, .62, -Math.PI / 2)); } // Hazcams
  shadows(g);
  return { group: g, parts, wheels, susp, WR, geo: { X, zF, zM, zR, lift: .02 }, spirit: SP };
}

// ---------- suspensión rocker‑bogie genérica (balancín + bogie a cada lado) ----------
function rockerBogie(g, part, o) {
  const { WR, X, zF, zM, zR, PY, PZ, BY, BZ, r, wheelFn, info, m = M.alu } = o, wheels = [], susp = {};
  for (const s of [-1, 1]) {
    const rocker = new THREE.Group(); rocker.position.set(s * X, PY, PZ);
    const fr = V3(0, WR - PY, zF - PZ), bg = V3(0, BY - PY, BZ - PZ);
    rocker.add(rod(V3(0, 0, 0), fr, r, m)); rocker.add(rod(V3(0, 0, 0), bg, r, m)); rocker.add(at(cyl(r * 1.8, r * 1.8, r * 3, M.aluDark), 0, 0, 0, 0, 0, Math.PI / 2));
    const wf = wheelFn(); wf.position.copy(fr); rocker.add(wf); wheels.push({ obj: wf, side: s, z: zF });
    const bogie = new THREE.Group(); bogie.position.copy(bg); rocker.add(bogie);
    const bm = V3(0, WR - BY, zM - BZ), br = V3(0, WR - BY, zR - BZ);
    bogie.add(rod(V3(0, 0, 0), bm, r * .9, m)); bogie.add(rod(V3(0, 0, 0), br, r * .9, m));
    const wm = wheelFn(); wm.position.copy(bm); bogie.add(wm); wheels.push({ obj: wm, side: s, z: zM });
    const wr = wheelFn(); wr.position.copy(br); bogie.add(wr); wheels.push({ obj: wr, side: s, z: zR });
    susp[s < 0 ? 'L' : 'R'] = { rocker, bogie };
    part(s < 0 ? 'suspL' : 'suspR', `Suspensión y ruedas (${s < 0 ? 'izquierda' : 'derecha'})`, rocker, V3(s, -.1, 0), info);
  }
  g.add(at(cyl(r, r, 2 * X, m), 0, PY, PZ, 0, 0, Math.PI / 2));
  return { wheels, susp };
}
function plainWheel(r, w, n, m = M.alu) {
  const g = new THREE.Group(); const rim = cyl(r, r, w, m, 28); rim.rotation.z = Math.PI / 2; g.add(rim);
  const hub = cyl(r * .35, r * .35, w + .01, M.dark, 14); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; const cl = box(w * 1.02, r * .07, r * .09, M.aluDark); cl.position.set(0, Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02); cl.rotation.x = -a; g.add(cl); }
  g.userData.r = r; return g;
}

// ---------- Sojourner (Mars Pathfinder, 1997): el primer rover en Marte, del tamaño de un horno microondas ----------
function buildSojourner() {
  const g = new THREE.Group(), parts = [];
  const part = (id, name, obj, dir, info) => { obj.userData.part = id; parts.push({ id, name, obj, dir, info, home: obj.position.clone() }); g.add(obj); return obj; };
  const body = new THREE.Group();
  body.add(at(box(.3, .11, .42, M.gold, .01), 0, .19, 0));
  body.add(at(box(.31, .02, .43, M.white), 0, .25, 0));
  part('cuerpo', 'Caja electrónica caliente', body, V3(0, -.25, 0),
    'Dentro iba una computadora Intel 80C85 de 2 MHz con 64 KB de memoria: mil veces menos que una calculadora gráfica de hoy. También una batería que no se recargaba, de reserva. Está forrada de aerogel, un sólido tan liviano que casi es aire, para guardar el calor en noches de −100 °C.');
  const sol = new THREE.Group();
  sol.add(flatShape([[-.24, -.31], [.24, -.31], [.24, .31], [-.24, .31]], M_CELLS, .27, .012));
  sol.add(at(box(.5, .012, .012, M.alu), 0, .275, -.31)); sol.add(at(box(.5, .012, .012, M.alu), 0, .275, .31));
  part('solar', 'Panel solar', sol, V3(0, .4, 0), 'Un panel de 0,22 m² de celdas de arseniuro de galio: daba como máximo unos 15 vatios, lo que gasta una bombilla pequeña. Con eso hacía todo: andar, pensar, calentar y hablar. Por eso se movía a solo 1 cm por segundo.');
  const cams = new THREE.Group();
  for (const x of [-.06, .06]) { cams.add(at(cyl(.016, .016, .03, M.dark, 10), x, .2, -.225, Math.PI / 2)); cams.add(at(cyl(.01, .01, .006, M.lens, 10), x, .2, -.24, Math.PI / 2)); }
  cams.add(at(cyl(.014, .014, .025, M.dark, 10), .08, .2, .22, Math.PI / 2));
  for (const x of [-.12, .12]) cams.add(at(box(.02, .02, .03, M.red), x, .16, -.22));
  part('camaras', 'Cámaras y láseres', cams, V3(0, .1, -.4), 'Adelante, dos cámaras en blanco y negro que veían en 3D; atrás, una cámara a color. Junto a ellas, cinco láseres dibujaban rayas en el suelo: si una raya se doblaba, había una piedra o un pozo, y el rover lo esquivaba solo.');
  const apxs = new THREE.Group(); apxs.position.set(0, .17, .24);
  apxs.add(at(box(.03, .03, .1, M.alu), 0, 0, .05)); apxs.add(at(cyl(.035, .035, .05, M.gold, 14), 0, -.04, .11));
  part('apxs', 'Espectrómetro APXS', apxs, V3(0, -.1, .4), 'En la cola, en un brazo que bajaba hasta tocar la roca. Usaba un poquito de curio‑244 radiactivo para bombardear la piedra y medir de qué elementos estaba hecha. Analizó rocas con nombres de dibujos animados: Barnacle Bill, Yogi y Scooby‑Doo.');
  const ant = at(cyl(.004, .004, .28, M.dark, 6), -.1, .4, .14);
  part('antena', 'Antena de radio', ant, V3(-.2, .4, .2), 'No hablaba con la Tierra: le mandaba todo por radio al módulo Pathfinder, a menos de 12 m, con un módem de 9.600 baudios, como el de una computadora de los 90. El módulo lo reenviaba a la Tierra.');
  const { wheels, susp } = rockerBogie(g, part, { WR: .065, X: .21, zF: -.25, zM: .02, zR: .26, PY: .19, PZ: -.08, BY: .14, BZ: .14, r: .009, wheelFn: () => plainWheel(.065, .079, 14),
    info: 'Fue el estreno de la suspensión rocker‑bogie que luego usaron todos los rovers de la NASA. Seis ruedas de aluminio de 13 cm con tacos de acero, cada una con su motor. Podía subir piedras de 8 cm, más altas que la mitad de su rueda.' });
  // módulo Pathfinder con sus tres pétalos abiertos, las bolsas desinfladas y la cámara IMP
  const lander = new THREE.Group(); lander.position.set(-1.6, 0, .9); lander.rotation.y = .5;
  lander.add(at(cyl(.42, .5, .25, M.white, 3), 0, .2, 0));
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + Math.PI / 6; const p = flatShape([[0, 0], [.85, -.5], [.85, .5]], M_CELLS, .06, .02); p.rotation.y = -a; p.position.set(Math.cos(a) * .3, 0, Math.sin(a) * .3); lander.add(p);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), Mt(0xd9d2c0, { roughness: .9 })); bag.scale.set(1.2, .35, .9); bag.position.set(Math.cos(a + .5) * .9, .08, Math.sin(a + .5) * .9); lander.add(bag); }
  lander.add(rod(V3(0, .3, 0), V3(0, .95, 0), .015, M.alu)); lander.add(at(box(.14, .08, .08, M.white, .01), 0, 1.0, 0));
  lander.add(rod(V3(.25, .3, .1), V3(.25, 1.1, .1), .006, M.alu));
  const ramp = at(box(.3, .01, .6, M.aluDark), .55, .05, -.6, .1, .8); lander.add(ramp);
  part('pathfinder', 'Módulo Mars Pathfinder', lander, V3(-.3, 0, .2), 'La base donde viajó Sojourner. Llegó el 4 de julio de 1997 envuelta en bolsas de aire, el primer aterrizaje rebotando en Marte; luego abrió sus tres pétalos con paneles solares. Su cámara en un mástil fotografió al rover y el paisaje; su veleta midió el clima. Se rebautizó Estación Memorial Carl Sagan.');
  shadows(g);
  return { group: g, parts, wheels, susp, WR: .065, geo: { X: .21, zF: -.25, zM: .02, zR: .26, lift: .01 } };
}

// ---------- Zhurong (Tianwen‑1, China, 2021): alas solares de mariposa y suspensión activa ----------
function buildZhurong() {
  const g = new THREE.Group(), parts = [];
  const part = (id, name, obj, dir, info) => { obj.userData.part = id; parts.push({ id, name, obj, dir, info, home: obj.position.clone() }); g.add(obj); return obj; };
  const body = new THREE.Group();
  body.add(at(box(1.3, .42, 1.55, M.blanket, .03), 0, .78, 0));
  body.add(at(box(1.34, .04, 1.6, M.alu), 0, 1.0, 0));
  for (const z of [-.3, .3]) { body.add(at(cyl(.2, .2, .03, M.alu, 28), 0, 1.03, z)); body.add(at(cyl(.17, .17, .035, new THREE.MeshPhysicalMaterial({ color: 0x9fb5c8, roughness: .05, clearcoat: 1, transmission: 0, metalness: .2 }), 28), 0, 1.035, z)); }
  part('cuerpo', 'Cuerpo y ventanas de calor', body, V3(0, -.5, 0), 'Las dos ventanas redondas de arriba son un truco chino: debajo hay 10 recipientes con n‑undecano, una cera que se derrite de día con el Sol y, al volverse sólida de noche, suelta su calor. Así Zhurong se calentaba sin plutonio. Pesa 240 kg en total.');
  const wings = new THREE.Group();
  for (const s of [-1, 1]) for (const z of [-.4, .4]) { const w = new THREE.Group(); w.position.set(s * .67, 1.0, z); w.rotation.z = s * .5; const p = flatShape([[0, -.38], [s * .9, -.34], [s * .9, .34], [0, .38]], M_CELLS, 0, .02); w.add(p); w.add(at(box(.02, .03, .76, M.alu), s * .01, .01, 0)); wings.add(w); }
  part('solar', 'Cuatro alas solares de mariposa', wings, V3(0, .8, 0), 'Cuatro paneles que se abren como alas de mariposa y pueden girar e inclinarse para mirar al Sol. Si se llenaban de polvo, el rover las ladeaba y las sacudía para limpiarlas. En 2022 el polvo de una tormenta y el invierno lo dejaron dormido.');
  const mast = new THREE.Group(); mast.position.set(0, 1.02, -.62);
  mast.add(rod(V3(0, 0, 0), V3(0, .72, 0), .04, M.white));
  mast.add(at(box(.5, .16, .2, M.white, .02), 0, .8, 0));
  for (const x of [-.18, .18]) { mast.add(at(cyl(.035, .035, .05, M.dark, 12), x, .8, -.12, Math.PI / 2)); mast.add(at(cyl(.022, .022, .01, M.lens, 12), x, .8, -.145, Math.PI / 2)); }
  mast.add(at(cyl(.06, .06, .12, M.dark, 16), 0, .82, -.14, Math.PI / 2)); mast.add(at(cyl(.045, .045, .01, M.lens, 16), 0, .82, -.2, Math.PI / 2));
  part('mastil', 'Mástil: NaTeCam y MarSCoDe', mast, V3(0, .8, -.3), 'Como un cuello con cabeza. Las dos cámaras NaTeCam ven en 3D para manejar y hacer mapas del terreno. En el centro, MarSCoDe dispara un láser a rocas a varios metros y lee la luz de la chispa para saber de qué están hechas, como ChemCam de Curiosity.');
  const hga = new THREE.Group(); hga.position.set(.35, 1.02, .55);
  hga.add(rod(V3(0, 0, 0), V3(0, .25, 0), .03, M.alu)); hga.add(at(cyl(.26, .26, .03, M.alu, 28), 0, .3, 0, .5));
  part('antena', 'Antena', hga, V3(.5, .7, .4), 'Su plato apunta al orbitador Tianwen‑1, que pasa por encima y reenvía los datos a China. El rover y el orbitador llegaron juntos a Marte el 10 de febrero de 2021 y esperaron tres meses en órbita antes de bajar.');
  const radar = at(box(.9, .08, .3, M.dark), 0, .52, .6);
  part('radar', 'Radar RoPeR', radar, V3(0, -.7, .6), 'Un radar que mira bajo las ruedas, hasta unos 100 m de profundidad. Encontró capas inclinadas enterradas que parecen depósitos de una antigua playa: la orilla de un océano que habría cubierto el norte de Marte.');
  const met = new THREE.Group(); met.position.set(-.45, 1.02, .5);
  met.add(rod(V3(0, 0, 0), V3(0, .35, 0), .015, M.alu)); met.add(at(box(.08, .06, .06, M.white), 0, .38, 0)); met.add(at(box(.1, .06, .1, M.gold), .2, .03, -.2));
  part('clima', 'Clima, micrófono y magnetómetro', met, V3(-.6, .6, .3), 'La estación MCS mide viento, temperatura y presión, y tiene un micrófono para oír Marte. El magnetómetro RoMAG busca restos del campo magnético que Marte perdió hace miles de millones de años.');
  const { wheels, susp } = rockerBogie(g, part, { WR: .15, X: .78, zF: -.82, zM: 0, zR: .82, PY: .56, PZ: -.15, BY: .38, BZ: .4, r: .035, wheelFn: () => plainWheel(.15, .2, 18),
    info: 'Una suspensión activa: además de balancearse, cada lado puede levantar o bajar el cuerpo. Así Zhurong puede «gatear» como una oruga para salir si se hunde en arena, o agacharse para que la suspensión no se mueva al aterrizar. En el recorrido verás cómo sube el cuerpo de vez en cuando.' });
  shadows(g);
  return { group: g, parts, wheels, susp, WR: .15, geo: { X: .78, zF: -.82, zM: 0, zR: .82, lift: .02 }, crawl: true };
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
  merb: { name: 'Opportunity', sub: 'Mars Exploration Rover B · NASA/JPL', build: () => buildMER('oppy'), mass: '185 kg', size: '1,6 m de largo · 2,3 m de ancho con los paneles · 1,5 m de alto', speed: 'hasta 5 cm/s; con su autonavegación, 1 cm/s en promedio', v: .05, small: true,
    launch: [['Despegue', '8 de julio de 2003, 03:18 UTC'], ['Cohete', 'Delta II 7925H (más sólidos grandes)'], ['Plataforma', 'SLC‑17B, Cabo Cañaveral, Florida'], ['Viaje', '201 días'], ['Llegada', '25 de enero de 2004, 05:05 UTC'], ['Lugar', 'Meridiani Planum, dentro del cráter Eagle (1,95° S, 354,47° E)'], ['Misión prevista', '90 soles (unos 3 meses)'], ['Estado', 'Terminada: trabajó casi 15 años; una tormenta de polvo global la apagó el 10 de junio de 2018. Recorrió 45,16 km']],
    edl: [['Entrada', 'a 128 km de altura y unos 19.000 km/h, protegido por un escudo térmico'], ['Paracaídas', 'de 15 m, a unos 8,6 km de altura'], ['Brida', 'el módulo baja colgado de una cuerda de 20 m bajo la cápsula'], ['Bolsas de aire', 'se inflan segundos antes; tres retrocohetes frenan y se corta la cuerda'], ['Rebotes', 'cae envuelto en bolsas, rebota y rueda cientos de metros… y se metió justo dentro del pequeño cráter Eagle: un «hoyo en uno»']],
    firsts: ['Aterrizó dentro de un cráter de 22 m: un «hoyo en uno»', 'Halló «arándanos» de hematita: bolitas que se forman en agua', 'Encontró la primera roca meteorito en otro planeta', 'Recorrió 45,16 km: récord fuera de la Tierra durante años'] },
  mera: { name: 'Spirit', sub: 'Mars Exploration Rover A · NASA/JPL', build: () => buildMER('spirit'), mass: '185 kg', size: '1,6 m de largo · 2,3 m de ancho con los paneles · 1,5 m de alto', speed: 'hasta 5 cm/s; con su autonavegación, 1 cm/s en promedio', v: .05, small: true,
    launch: [['Despegue', '10 de junio de 2003, 17:58 UTC'], ['Cohete', 'Delta II 7925'], ['Plataforma', 'SLC‑17A, Cabo Cañaveral, Florida'], ['Viaje', '208 días'], ['Llegada', '4 de enero de 2004, 04:35 UTC'], ['Lugar', 'Cráter Gusev (14,57° S, 175,47° E)'], ['Misión prevista', '90 soles (unos 3 meses)'], ['Estado', 'Terminada: trabajó más de 6 años; atascada en arena desde 2009, último contacto el 22 de marzo de 2010. Recorrió 7,73 km']],
    edl: [['Entrada', 'a 128 km de altura y unos 19.000 km/h, protegido por un escudo térmico'], ['Paracaídas', 'de 15 m, a unos 8,6 km de altura'], ['Brida', 'el módulo baja colgado de una cuerda de 20 m bajo la cápsula'], ['Bolsas de aire', 'se inflan segundos antes; tres retrocohetes frenan y se corta la cuerda'], ['Rebotes', 'cae envuelto en bolsas, rebota unas dos docenas de veces y rueda cientos de metros; luego se abren los pétalos y el rover baja']],
    firsts: ['El primero de los gemelos en llegar', 'Subió a la cima de Husband Hill, en las colinas Columbia', 'Con una rueda rota descubrió sílice de aguas termales', 'Encontró carbonatos (roca Comanche): señal de agua poco ácida'] },
  mpf: { name: 'Sojourner', sub: 'Mars Pathfinder · NASA/JPL', build: buildSojourner, mass: '10,6 kg', size: '65 cm de largo · 48 cm de ancho · 30 cm de alto', speed: '1 cm/s (36 m por hora)', v: .01, noSim: true, edlTitle: 'El aterrizaje rebotando',
    view: { ty: .18, cam: [1.5, .8, 1.6], drv: [1.2, .6, 1.4], back: 1.4, up: .55, max: 2.4 },
    driveNote: 'En 83 días recorrió unos 100 m en total, siempre a menos de 12 m del módulo, para no perder la señal de radio.',
    launch: [['Despegue', '4 de diciembre de 1996'], ['Cohete', 'Delta II 7925'], ['Plataforma', 'LC‑17B, Cabo Cañaveral, Florida'], ['Viaje', '7 meses'], ['Llegada', '4 de julio de 1997'], ['Lugar', 'Ares Vallis, en Chryse Planitia (19,13° N, 326,78° E)'], ['Misión prevista', '7 soles (una semana)'], ['Estado', 'Terminada: trabajó 83 soles; última señal del módulo el 27 de septiembre de 1997']],
    edl: [['Entrada directa', 'sin entrar antes en órbita, a unos 27.000 km/h'], ['Paracaídas', 'frena la cápsula; el módulo baja colgado de una cuerda'], ['Bolsas de aire', 'se inflan alrededor del módulo; tres retrocohetes frenan casi del todo'], ['Rebotes', 'cae, rebota más de una docena de veces y rueda hasta detenerse: el primer aterrizaje con bolsas en Marte'], ['Pétalos', 'se desinflan las bolsas, se abren los tres pétalos y Sojourner baja por una rampa']],
    firsts: ['El primer rover en otro planeta', 'Estrenó la suspensión rocker‑bogie', 'Estrenó el aterrizaje con bolsas de aire', 'Tenía que durar una semana y duró casi tres meses'] },
  zhurong: { name: 'Zhurong', sub: 'Tianwen‑1 · Administración Espacial Nacional de China', build: buildZhurong, mass: '240 kg', size: '2,6 m de largo · 3 m de ancho con las alas · 1,85 m de alto', speed: 'unos 200 m por hora como máximo', v: .055, noSim: true, edlTitle: 'Los nueve minutos de terror',
    view: { ty: .85, cam: [4.6, 2.4, 4.8], drv: [4, 2.1, 5.2], back: 5.2, up: 2.2, max: 8 },
    launch: [['Despegue', '23 de julio de 2020, 04:41 UTC'], ['Cohete', 'Larga Marcha 5'], ['Plataforma', 'LC‑101, Wenchang, isla de Hainan (China)'], ['Órbita de Marte', '10 de febrero de 2021, junto al orbitador Tianwen‑1'], ['Llegada', '14 de mayo de 2021, 23:18 UTC'], ['Bajó del módulo', '22 de mayo de 2021, por una rampa'], ['Lugar', 'Utopia Planitia (25,1° N, 109,9° E)'], ['Misión prevista', '90 soles (unos 3 meses)'], ['Estado', 'Dormido desde mayo de 2022: no despertó tras el invierno. Recorrió 1.921 m']],
    edl: [['Separación', 'la cápsula se suelta del orbitador, que la llevó tres meses en órbita'], ['Entrada', 'escudo térmico contra la atmósfera'], ['Paracaídas', 'se abre y luego se suelta el escudo'], ['Retrocohete', 'un motor frena, el módulo se queda flotando, busca un lugar sin rocas con láser y cámaras, y baja'], ['Primer intento', 'China fue el segundo país en manejar un rover en Marte, y lo logró en su primer intento']],
    firsts: ['Primer rover chino en Marte, a la primera', 'Una cámara suelta en el suelo le sacó una foto de grupo con el módulo', 'Su radar vio una antigua playa enterrada', 'Se calentaba con cera que se derrite de día'] },
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
  const VW = R.view || (R.small ? { ty: .55, cam: [3.2, 1.7, 3.4], drv: [2.8, 1.5, 3.6], back: 3.6, up: 1.5, max: 5.5 } : { ty: .9, cam: [5.5, 2.8, 5.8], drv: [4.5, 2.4, 6], back: 6, up: 2.6, max: 9 });
  const TY = VW.ty; cam.position.set(...VW.cam);
  const ctl = new OrbitControls(cam, canvas); ctl.enableDamping = true; ctl.target.set(0, TY, 0); ctl.minDistance = 1.5; ctl.maxDistance = 30; ctl.maxPolarAngle = 1.52; ctl.autoRotate = true; ctl.autoRotateSpeed = .8;
  scene.add(new THREE.HemisphereLight(0xffe2c8, 0x7a4426, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(6, 9, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, far: 60 }); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03; scene.add(sun);
  // cielo: un degradado marciano (butterscotch) en una esfera
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: {}, vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = mix(vec3(.86,.64,.47), vec3(.62,.46,.36), smoothstep(0.,.5,h)); c = mix(vec3(.93,.74,.55), c, smoothstep(-.02,.12,h)); gl_FragColor = vec4(c,1.); }' })); scene.add(sky);
  const terrain = makeTerrain(); scene.add(terrain);
  if (id === 'merb') { const N = 1500, b = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 8, 6), Mt(0x56575c, { roughness: .45, metalness: .3 }), N), m = new THREE.Matrix4(); for (let i = 0; i < N; i++) { const x = (Math.random() - .5) * 36, z = (Math.random() - .5) * 36, sc = .6 + Math.random() * .8; m.compose(V3(x, hNoise(x, z) + .008, z), new THREE.Quaternion(), V3(sc, sc, sc)); b.setMatrixAt(i, m); } b.castShadow = true; terrain.add(b); }
  const MARKS = 1200, marks = new THREE.InstancedMesh(new THREE.BoxGeometry(.13, .006, .08), Mt(0xf0e8da, { roughness: .9 }), MARKS), mm4 = new THREE.Matrix4(); marks.count = 0; let markN = 0, markAcc = 0; terrain.add(marks);
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
    if (mode === 'recorrido') side.innerHTML = `<h3>Conduciendo</h3><p>El rover avanza a <b>${R.speed}</b>; aquí lo ves <b>6 veces más rápido</b>. Mira cómo cada rueda sigue el suelo y los balancines se inclinan: ninguna rueda se despega.</p><p>En la realidad recorre unos 100 m en un buen día: los conductores en la Tierra planean la ruta con las fotos del día anterior, y el rover la sigue solo, frenando si ve una piedra o una pendiente peligrosa.</p>${rover.spirit ? '<p><b>Spirit anda en reversa</b>: su rueda delantera derecha se trabó en 2006 y la arrastra. Mira el surco claro que deja: así destapó la sílice de aguas termales.</p>' : id === 'merb' ? '<p>Las bolitas grises del suelo son los «arándanos» de hematita que encontró Opportunity en Meridiani: se formaron dentro de rocas empapadas en agua y quedaron sueltas cuando el viento gastó la roca.</p>' : ''}<div class="kv"><span>Distancia</span><b id="rv-dist">0 m</b><span>Tiempo real equivalente</span><b id="rv-time">0 min</b></div>${R.driveNote ? `<p>${R.driveNote}</p>` : ''}${rover.group.userData.ing ? '<p>Ingenuity vuela alrededor: en Marte voló hasta 24 m de alto y 700 m de distancia en un solo vuelo.</p>' : ''}`;
    if (mode === 'lanzamiento') side.innerHTML = `<h3>Despegue y viaje</h3><div class="kv">${R.launch.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div><h3>${R.edlTitle || 'Los siete minutos de terror'}</h3><div class="kv">${R.edl.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div>${R.noSim ? '' : `<a class="go" href="../cabo-canaveral/marte/#${id}/llegada">Ver la animación del aterrizaje →</a><a class="go alt" href="../cabo-canaveral/marte/#${id}">Ver el despegue en Cabo Cañaveral →</a>`}`;
    side.querySelectorAll('[data-p]').forEach(b => b.onclick = () => selectPart(parts.find(p => p.id === b.dataset.p)));
  }
  function setMode(m) {
    mode = m; root.querySelectorAll('.rv-tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
    slider.hidden = m !== 'piezas'; labels.hidden = m !== 'piezas'; ctl.autoRotate = m === 'modelo';
    if (m !== 'piezas') { explode = 0; range.value = 0; if (selected) { const q = selected; selected = null; parts.forEach(pp => pp.obj.traverse(o => { if (o.isMesh && o.userData.m0) { o.material = o.userData.m0; o.userData.m0 = null; } })); } tags.forEach(t => t.classList.remove('sel')); }
    if (m === 'piezas' && explode === 0) { range.value = 60; explode = .6; }
    if (m !== 'recorrido') { rover.group.position.set(0, hNoise(0, 0), 0); rover.group.rotation.set(0, 0, 0); poseSuspension(0, 0, 0, 0, 0, 0); drive.s = 0; drive.x = drive.z = drive.heading = 0; dist = 0; ctl.target.set(0, TY, 0); marks.count = 0; markN = 0; terrain.visible = m !== 'piezas'; scene.fog.near = 14; }
    else { terrain.visible = true; cam.position.set(...VW.drv); }
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
    const v = (R.v || .042) * 6, G = rover.geo, dirS = rover.spirit ? -1 : 1;                          // 6× la velocidad real; Spirit va en reversa
    drive.s += v * dt; dist += v * dt;
    // ruta: un lazo ancho, girando despacio
    drive.heading += Math.sin(drive.s * .08) * .25 * dt; drive.x += Math.sin(drive.heading) * v * dt * dirS; drive.z += Math.cos(drive.heading) * v * dt * dirS;
    if (Math.hypot(drive.x, drive.z) > 24) { drive.heading += Math.PI; }
    const g = rover.group; g.position.set(drive.x, 0, drive.z); g.rotation.set(0, drive.heading, 0);
    // alturas del suelo bajo las 6 ruedas (en el marco del rover: x lateral, z adelante=-z)
    const h = {}; for (const w of rover.wheels) { tmpV.set(w.side * G.X, 0, w.z).applyAxisAngle(V3(0, 1, 0), drive.heading).add(g.position); h[w.side + ':' + w.z] = groundAt(tmpV.x, tmpV.z); }
    const WR = rover.WR, L = s => h[s + ':' + G.zF], Mw = s => h[s + ':' + G.zM], Rw = s => h[s + ':' + G.zR], LB = (G.zM + G.zR) / 2 - G.zF;
    const bog = s => Math.atan2(Mw(s) - Rw(s), G.zR - G.zM), rock = s => Math.atan2(L(s) - (Mw(s) + Rw(s)) / 2, LB);
    const hL = (L(-1) + Mw(-1) + Rw(-1)) / 3, hR = (L(1) + Mw(1) + Rw(1)) / 3, hF = (L(-1) + L(1)) / 2, hB = (Mw(-1) + Mw(1) + Rw(-1) + Rw(1)) / 4;
    g.position.y = (hL + hR) / 2 + G.lift + (rover.crawl ? Math.max(0, Math.sin(drive.s * .35)) * .12 : 0);
    poseSuspension(rock(-1), bog(-1), rock(1), bog(1), Math.atan2(hF - hB, LB) * .9, Math.atan2(hR - hL, 2 * G.X));
    for (const w of rover.wheels) if (!(rover.spirit && w.side > 0 && w.z === G.zF)) w.obj.rotation.x += v * dt / WR * dirS;
    // surco claro de la rueda trabada de Spirit
    if (rover.spirit) { markAcc += v * dt; if (markAcc > .06) { markAcc = 0; tmpV.set(G.X, 0, G.zF).applyAxisAngle(V3(0, 1, 0), drive.heading).add(g.position); mm4.compose(V3(tmpV.x, groundAt(tmpV.x, tmpV.z) + .006, tmpV.z), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), drive.heading), V3(1, 1, 1)); marks.setMatrixAt(markN % MARKS, mm4); markN++; marks.count = Math.min(markN, MARKS); marks.instanceMatrix.needsUpdate = true; } }
    // dirección de las ruedas delanteras y traseras al girar
    const steer = Math.sin(drive.s * .08) * .25 * .8; for (const w of rover.wheels) if (w.z !== G.zM) w.obj.rotation.y = (w.z < 0 ? 1 : -1) * steer;
    // polvo tras las ruedas traseras
    if (Math.random() < dt * 8) for (const s of [-1, 1]) { const d = new THREE.Mesh(dustGeo, dustMat.clone()); tmpV.set(s * G.X, .05, (G.zR + .15) * dirS).applyAxisAngle(V3(0, 1, 0), drive.heading).add(g.position); d.position.copy(tmpV); d.userData.age = 0; scene.add(d); drive.dust.push(d); }
    for (let i = drive.dust.length - 1; i >= 0; i--) { const d = drive.dust[i]; d.userData.age += dt; d.position.y += dt * .12; d.scale.setScalar(1 + d.userData.age * 1.6); d.material.opacity = .45 * (1 - d.userData.age / 2.2); if (d.userData.age > 2.2) { scene.remove(d); drive.dust.splice(i, 1); } }
    // Ingenuity vuela en círculos alrededor
    const ing = g.userData.ing; if (ing) { const t = drive.s * .5; ing.position.set(Math.cos(t) * 4.5 + 0, 2.2 + Math.sin(t * 1.7) * .6, Math.sin(t) * 4.5); ing.rotation.y = -t; ing.rotation.z = .12; ing.userData.rot.forEach((r, i) => r.rotation.y += (i ? 1 : -1) * .5); }
    // cámara: sigue al rover
    const tgt = tmpV.set(g.position.x, g.position.y + TY, g.position.z); ctl.target.lerp(tgt, .08);
    const back = V3(Math.sin(drive.heading + .6), 0, Math.cos(drive.heading + .6)).multiplyScalar(-VW.back * dirS).add(V3(0, VW.up, 0)).add(g.position); if (cam.position.distanceTo(g.position) > VW.max) cam.position.lerp(back, .03);
    const de = side.querySelector('#rv-dist'); if (de) { de.textContent = dist.toFixed(1) + ' m'; side.querySelector('#rv-time').textContent = (dist / (R.v || .042) / 60).toFixed(1) + ' min'; }
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
  window.__rv = { rover, hNoise, THREE, marks };   // para pruebas
  return true;
}
