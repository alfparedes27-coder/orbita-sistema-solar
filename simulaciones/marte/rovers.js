// «Explorar el rover»: visor 3D a pantalla completa con el modelo detallado de cada rover, despiece por piezas con la explicación
// de cada una, panel del lanzamiento y la llegada, y un recorrido animado sobre el terreno (suspensión rocker‑bogie articulada).
// Cada rover se describe en ROVERS con su constructor; la página de Marte llama a abrirRover(id). Rovers y, desde la tanda 4, módulos fijos (Phoenix, InSight) con su brazo en acción.
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

// ---------- módulos fijos (Phoenix 2008 e InSight 2018): el mismo diseño de Lockheed Martin, con un brazo que trabaja el suelo ----------
// brazo de dos tramos con muñeca; reach(p, wa) lo apunta con cinemática inversa (p: muñeca relativa a la base, wa: ángulo de la herramienta)
function roboArm(L1, L2, tool, r = .035) {
  const base = new THREE.Group(), yaw = new THREE.Group(), sh = new THREE.Group(), el = new THREE.Group(), wr = new THREE.Group();
  base.add(yaw); yaw.add(at(cyl(.08, .09, .1, M.aluDark, 16), 0, .05, 0)); yaw.add(sh); sh.position.y = .1;
  sh.add(at(cyl(.06, .06, .13, M.dark, 14), 0, 0, 0, 0, 0, Math.PI / 2));
  sh.add(rod(V3(0, 0, 0), V3(0, 0, -L1), r, M.alu)); sh.add(rod(V3(0, .035, -.08), V3(0, .03, -L1 + .08), .008, M.black)); el.position.z = -L1; sh.add(el);
  el.add(at(cyl(.05, .05, .11, M.dark, 14), 0, 0, 0, 0, 0, Math.PI / 2));
  el.add(rod(V3(0, 0, 0), V3(0, 0, -L2), r * .85, M.alu)); el.add(rod(V3(0, -.03, -.08), V3(0, -.025, -L2 + .08), .007, M.black)); wr.position.z = -L2; el.add(wr);
  wr.add(at(cyl(.04, .04, .09, M.dark, 12), 0, 0, 0, 0, 0, Math.PI / 2)); wr.add(tool);
  function reach(p, wa = -Math.PI / 2) {
    const x = p.x, y = p.y - .1, z = p.z; yaw.rotation.y = Math.atan2(-x, -z);
    const d = Math.hypot(x, z), D = Math.min(L1 + L2 - 1e-3, Math.max(Math.abs(L1 - L2) + 1e-3, Math.hypot(d, y)));
    const g = Math.acos(THREE.MathUtils.clamp((D * D - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
    const t1 = Math.atan2(y, d) + Math.atan2(L2 * Math.sin(g), L1 + L2 * Math.cos(g));
    sh.rotation.x = t1; el.rotation.x = -g; wr.rotation.x = wa - (t1 - g);
  }
  return { base, reach, el, wr };
}
// panel solar UltraFlex: un decágono que se abre como un abanico
function ultraflex(R) {
  const g = new THREE.Group(), pts = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
  g.add(flatShape(pts, M_CELLS, 0, .018));
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.add(rod(V3(0, .02, 0), V3(Math.cos(a) * R, .02, Math.sin(a) * R), .007, M.white)); }
  const rim = []; for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI * 2; rim.push(V3(Math.cos(a) * R, .02, Math.sin(a) * R)); }
  for (let k = 0; k < 10; k++) g.add(rod(rim[k], rim[k + 1], .006, M.aluDark));
  g.add(at(cyl(.07, .07, .05, M.alu, 12), 0, .02, 0)); return g;
}
// cubierta, propulsores, patas y paneles comunes a los dos; devuelve gy(x,z): altura del suelo en coordenadas del módulo
function landerBase(part, hf, o) {
  const h0 = hf(0, 0), gy = (x, z) => hf(x, z) - h0;
  const deck = new THREE.Group(), skin = Mt(o.col, { metalness: .35, roughness: .45 });
  deck.add(at(cyl(.78, .78, .28, skin, 10), 0, 1.0, 0));
  deck.add(at(cyl(.8, .8, .03, M.alu, 10), 0, 1.15, 0));
  deck.add(at(cyl(.72, .76, .06, M.gold, 10), 0, .84, 0));
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; for (let j = -1; j <= 1; j++) { const b = a + j * .13; deck.add(at(cyl(.03, .05, .11, M.dark, 10), Math.cos(b) * .6, .76, Math.sin(b) * .6)); } }
  deck.add(at(box(.16, .1, .1, M.dark), 0, .9, -.74)); deck.add(at(cyl(.03, .03, .02, M.lens, 10), 0, .9, -.8, Math.PI / 2));
  part('cubierta', 'Cubierta y propulsores', deck, V3(0, -.35, 0), o.deckInfo);
  const legs = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + i / 3 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), fx = c * 1.12, fz = s * 1.12, f = V3(fx, gy(fx, fz) + .1, fz);
    legs.add(rod(V3(c * .62, .88, s * .62), f, .045, M.alu));
    for (const e of [-.4, .4]) legs.add(rod(V3(Math.cos(a + e) * .74, .95, Math.sin(a + e) * .74), f.clone().add(V3(0, .06, 0)), .02, M.aluDark));
    legs.add(at(cyl(.14, .17, .06, M.alu, 16), fx, f.y - .06, fz));
  }
  part('patas', 'Patas', legs, V3(0, -.3, 0), 'Tres patas con amortiguadores de aluminio en forma de panal, que se aplastan una sola vez al tocar el suelo. Los platos de las patas tienen sensores: apenas uno toca el suelo, se apagan los 12 propulsores para no rebotar.');
  const sol = new THREE.Group();
  for (const s of [-1, 1]) { const p = ultraflex(o.R); p.position.set(s * (.8 + o.R), 1.16, 0); p.rotation.z = -s * .04; sol.add(p); sol.add(rod(V3(s * .78, 1.13, 0), V3(s * .95, 1.17, 0), .035, M.alu)); }
  part('solar', 'Paneles solares UltraFlex', sol, V3(0, .45, 0), o.solarInfo);
  return gy;
}
// interpolación suave por fotogramas clave [t, x, y, z, extra]
function track(keys, t) {
  let i = 0; while (i < keys.length - 2 && t >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], u = THREE.MathUtils.clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1), s = u * u * (3 - 2 * u);
  return { p: V3(a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s), x: (a[4] ?? 0) + ((b[4] ?? 0) - (a[4] ?? 0)) * s, i };
}
const sm = (a, b, t) => { const u = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
// cable con algo de comba entre dos puntos (las amarras de SEIS y del topo)
function tether(col) { const n = 16, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col })); l.frustumCulled = false;
  l.userData.set = (a, b, sag) => { const p = geo.attributes.position; for (let i = 0; i < n; i++) { const u = i / (n - 1); p.setXYZ(i, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * sag, a.z + (b.z - a.z) * u); } p.needsUpdate = true; }; return l; }

// ---------- Phoenix (2008): el módulo polar que cavó hasta el hielo ----------
function buildPhoenix(hf) {
  const g = new THREE.Group(), parts = [];
  const part = (id, name, obj, dir, info) => { obj.userData.part = id; parts.push({ id, name, obj, dir, info, home: obj.position.clone() }); g.add(obj); return obj; };
  const gy = landerBase(part, hf, { col: 0xd8ccae, R: 1.0,
    deckInfo: 'La cubierta de 1,5 m guarda la computadora, las baterías y la radio que habla con los orbitadores. Debajo, 12 propulsores de hidracina que se encienden en pulsos lo frenaron en los últimos metros. Phoenix se armó con piezas del módulo Mars Surveyor 2001, que se canceló.',
    solarInfo: 'Dos paneles de 2 m que se abren como abanicos de diez varillas. A 68° de latitud norte, en verano el Sol no se pone: da vueltas alrededor del cielo sin esconderse. Cuando llegó el invierno, la luz se acabó y el hielo de CO₂ que cayó encima los rompió.' });
  // cámara estéreo SSI en su mástil
  const ssi = new THREE.Group(); ssi.position.set(-.35, 1.16, -.3);
  ssi.add(rod(V3(0, 0, 0), V3(0, .82, 0), .03, M.alu)); ssi.add(at(box(.22, .12, .13, M.white, .01), 0, .9, 0));
  for (const x of [-.06, .06]) { ssi.add(at(cyl(.03, .03, .04, M.dark, 12), x, .91, -.08, Math.PI / 2)); ssi.add(at(cyl(.02, .02, .01, M.lens, 12), x, .91, -.1, Math.PI / 2)); }
  part('ssi', 'Cámara estéreo SSI', ssi, V3(-.25, .5, -.1), 'Dos ojos a unos 2 m del suelo, como los de una persona de pie, con 12 filtros de color. Tomaban fotos en 3D para que en la Tierra supieran dónde mandar el brazo, y fotos del cielo para medir el polvo y las nubes.');
  // estación del tiempo canadiense: mástil con la veleta y el lidar
  const met = new THREE.Group(); met.position.set(.5, 1.16, .35);
  met.add(rod(V3(0, 0, 0), V3(0, 1.0, 0), .015, M.alu));
  for (const y of [.25, .5, 1.0]) met.add(at(box(.1, .01, .01, M.aluDark), .05, y, 0));
  met.add(rod(V3(0, 1.0, 0), V3(0, .9, 0), .003, M.dark)); met.add(at(cyl(.012, .012, .03, M.gold, 8), 0, .89, 0));
  const lid = at(box(.16, .12, .14, M.white, .01), .1, .06, .25); met.add(lid); met.add(at(cyl(.04, .04, .02, M.lens, 14), .1, .13, .25));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 12, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x40ff70, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); beam.position.set(.1, 6.14, .25); met.add(beam);
  part('met', 'Estación del tiempo y lidar', met, V3(.4, .4, .3), 'Hecha en Canadá. Arriba del mástil cuelga la «veleta» (telltale): un tubito que el viento empuja y la cámara fotografía para medir su fuerza. El lidar dispara pulsos de láser verde hacia el cielo y mide la luz que rebota: así vio nieve cayendo de las nubes, que se evaporaba antes de llegar al suelo.');
  // TEGA: 8 hornitos en fila con sus puertas
  const tega = new THREE.Group(); tega.position.set(.28, 1.17, -.2);
  tega.add(at(box(.6, .12, .2, M.white, .01), 0, .06, 0)); const doors = [];
  for (let k = 0; k < 8; k++) { const d = new THREE.Group(); d.position.set(-.26 + k * .075, .125, -.07); d.add(at(box(.055, .008, .09, M.alu), 0, 0, .045)); d.add(at(box(.04, .01, .04, M.aluDark), 0, .002, .045)); tega.add(d); doors.push(d); }
  part('tega', 'Hornos TEGA', tega, V3(.3, .3, .1), 'Ocho hornitos, cada uno se usa una sola vez. El brazo echa un poco de tierra por la rejilla, el horno la calienta hasta 1.000 °C y un espectrómetro «huele» los gases que salen. En el horno 0 salió vapor de agua al calentar la muestra: la prueba de que lo blanco era hielo.');
  // MECA: laboratorio de química húmeda y microscopios
  const meca = new THREE.Group(); meca.position.set(-.3, 1.17, .3);
  meca.add(at(box(.34, .14, .26, M.white, .01), 0, .07, 0));
  for (let k = 0; k < 4; k++) meca.add(at(cyl(.035, .035, .04, M.aluDark, 12), -.12 + k * .08, .16, -.04));
  meca.add(at(box(.1, .06, .08, M.gold), .1, .17, .08));
  part('meca', 'Laboratorio MECA', meca, V3(-.3, .35, .2), 'Cuatro vasitos donde la tierra se mezclaba con agua traída desde la Tierra, para medir si era ácida o salada. Encontró percloratos: sales que en la Tierra se usan en fuegos artificiales y que podrían servir para fabricar oxígeno. También tenía un microscopio de fuerza atómica, que tocaba los granos con una punta finísima.');
  // brazo robótico de 2,35 m con la pala, la raspa y la cámara RAC
  const tool = new THREE.Group();
  tool.add(rod(V3(0, 0, 0), V3(0, 0, -.12), .025, M.alu));
  tool.add(at(box(.1, .012, .16, M.alu), 0, 0, -.2)); for (const x of [-.05, .05]) tool.add(at(box(.01, .06, .16, M.alu), x, .03, -.2)); tool.add(at(box(.1, .06, .012, M.alu), 0, .03, -.125));
  tool.add(at(box(.1, .006, .02, M.aluDark), 0, .003, -.285));
  tool.add(at(cyl(.008, .008, .08, M.dark, 8), 0, -.025, -.17, Math.PI / 2));
  tool.add(at(box(.05, .04, .05, M.dark), .07, .0, -.05)); tool.add(at(cyl(.014, .014, .01, M.lens, 10), .07, -.025, -.05));
  const arm = roboArm(.95, 1.15, tool); arm.base.position.set(.2, 1.16, -.62);
  part('brazo', 'Brazo robótico y pala', arm.base, V3(0, .3, -.6), 'Un brazo de 2,35 m con codo y muñeca. En la punta lleva una pala con filo para cavar y, detrás, una raspa que gira a toda velocidad para romper el hielo duro como el cemento. Encima, la cámara RAC fotografiaba lo que había en la pala. Cavó más de diez zanjas.');
  // la zanja, el hielo y los terrones que se evaporan
  const TX = .32, TZ0 = -2.25, TZ1 = -1.62;
  const dirt = Mt(0x5a301e, { roughness: 1 }), trench = at(box(.26, .04, 1, dirt), TX, gy(TX, -1.95) - .015, 0); g.add(trench);
  const iceM = Mt(0xdde6ea, { roughness: .4, transparent: true, opacity: 0 }), ice = at(box(.18, .01, 1, iceM), TX, gy(TX, -1.95) + .008, 0); g.add(ice);
  const spoil = new THREE.Group(); for (let k = 0; k < 5; k++) spoil.add(at(new THREE.Mesh(new THREE.DodecahedronGeometry(.05 + k * .008, 0), dirt), TX + (k % 2 ? .05 : -.05), gy(TX, TZ1 + .1) + .01, TZ1 + .06 + k * .04)); g.add(spoil);
  const chunks = []; for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(.022 + k * .004, 0), Mt(0xf5f8fa, { roughness: .3 })); c.position.set(TX - .1 + k * .045, gy(TX, -2.1) + .02, -2.12 + (k % 2) * .05); g.add(c); chunks.push(c); }
  // granitos que caen de la pala al horno y la nieve del cielo
  const NP = 40, pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const grains = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x8a5a3c, size: .025 })); grains.frustumCulled = false; g.add(grains);
  const NS = 260, sGeo = new THREE.BufferGeometry(), sP = new Float32Array(NS * 3), seed = []; for (let i = 0; i < NS; i++) seed.push([(Math.random() - .5) * 9, Math.random(), (Math.random() - .5) * 9]); sGeo.setAttribute('position', new THREE.BufferAttribute(sP, 3));
  const snow = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffff, size: .12, transparent: true, opacity: 0, depthWrite: false })); snow.frustumCulled = false; g.add(snow);
  const DOOR = 4, dp = V3(.28 - .26 + DOOR * .075, 1.3, -.2 - .07 + .045), B = arm.base.position, S = [.32, 1.5, -.3];
  const tz = z => gy(TX, z) + .3, keys = [[0, ...S], [3.5, TX, tz(TZ0) + .25, TZ0], [5.5, TX, tz(TZ0), TZ0], [10.5, TX, tz(TZ1), TZ1], [12, TX, .75, TZ1 + .05], [15, dp.x, dp.y + .32, dp.z - .05], [16, dp.x, dp.y + .32, dp.z - .05, -.75], [19, dp.x, dp.y + .32, dp.z - .05, -.75], [20, dp.x, dp.y + .4, dp.z - .05], [22.5, ...S], [36, ...S]];
  const T = 36, tmp = V3();
  function act(time, env) {
    const t = time % T, k = track(keys, t); arm.reach(tmp.copy(k.p).sub(B), -Math.PI / 2 + k.x);
    const dug = sm(5.5, 10.5, t), len = Math.max(.001, dug * (TZ1 - TZ0));
    trench.scale.z = len; trench.position.z = TZ0 + len / 2; trench.visible = ice.visible = dug > .01; ice.scale.z = len * .85; ice.position.z = TZ0 + len / 2; iceM.opacity = sm(8, 10, t);
    spoil.visible = t > 9; spoil.scale.setScalar(sm(9, 11, t) + 1e-3);
    const sub = 1 - sm(29, 35, t); chunks.forEach((c, i) => { c.visible = t > 10; c.scale.setScalar(Math.max(1e-3, sub * (1 - i * .08))); });
    doors[DOOR].rotation.x = -1.2 * sm(13, 14.5, t) * (1 - sm(20, 21, t));
    const pp = pGeo.attributes.position, pour = t > 16 && t < 19.5; grains.visible = pour;
    if (pour) for (let i = 0; i < NP; i++) { const f = ((t * 1.6 + i / NP) % 1); pp.setXYZ(i, dp.x + (Math.sin(i * 7.3) * .03), dp.y + .05 + (1 - f) * .14, dp.z + Math.cos(i * 3.1) * .03); } pp.needsUpdate = true;
    const lidarOn = sm(21, 23, t) * (1 - sm(34.5, 35.8, t)); beam.material.opacity = lidarOn * (.35 + .25 * Math.sin(time * 40));
    snow.material.opacity = lidarOn * .85;
    for (let i = 0; i < NS; i++) { const s = seed[i], f = (s[1] + time * .07) % 1; sP[i * 3] = s[0] + Math.sin(time * .3 + i) * .2; sP[i * 3 + 1] = 9 - f * 4.5; sP[i * 3 + 2] = s[2]; } sGeo.attributes.position.needsUpdate = true;
    if (env && env.sun) { const az = time / T * Math.PI * 2, el = (25 + 21 * Math.cos(az)) * Math.PI / 180; env.sun.position.set(Math.cos(az) * Math.cos(el) * 12, Math.sin(el) * 12, Math.sin(az) * Math.cos(el) * 12); }
    const step = t < 4 ? 0 : t < 8.5 ? 1 : t < 12 ? 2 : t < 21 ? 3 : t < 29 ? 4 : 5, sol = Math.floor(18 + 6 * sm(26, 35.5, t));
    return { step, kv: [['Sol', String(sol)], ['Sol a medianoche', 'sí: a 68° N en verano no se pone'], ['Zanja', `${(len * 100 / 1).toFixed(0)} cm de largo · unos 5 cm de hondo`], ['Terrones de hielo', sub > .99 ? 'recién destapados' : sub > .02 ? 'evaporándose…' : 'desaparecieron (sol 24)']] };
  }
  function reset() { act(0); }
  shadows(g); [beam, snow, grains].forEach(o => { o.castShadow = false; o.receiveShadow = false; }); reset();
  return { group: g, parts, act, reset };
}

// ---------- InSight (2018): el sismógrafo que escuchó el interior de Marte ----------
function buildInSight(hf) {
  const g = new THREE.Group(), parts = [];
  const part = (id, name, obj, dir, info) => { obj.userData.part = id; parts.push({ id, name, obj, dir, info, home: obj.position.clone() }); g.add(obj); return obj; };
  const gy = landerBase(part, hf, { col: 0xd9c49a, R: 1.1,
    deckInfo: 'La misma cubierta que Phoenix, mejorada. Lleva la computadora, la radio y, debajo, la cámara ICC de ojo de pez que miraba el suelo de enfrente. Encima va un pequeño espejo LaRRI de Italia, para que futuras naves lo encuentren con láser desde la órbita.',
    solarInfo: 'Dos abanicos de 2,2 m: juntos daban hasta 4,6 kW·h en un día soleado, suficiente para una licuadora durante horas. El polvo los fue tapando: al final daban 20 veces menos. Los operadores probaron a soltar arena con el brazo para que el viento se llevara el polvo, y funcionó un poco.' });
  const H = 1.16;
  // SEIS: el sismógrafo francés
  const seis = new THREE.Group(); seis.position.set(-.38, H, -.25);
  seis.add(at(cyl(.17, .19, .13, M.gold, 6), 0, .1, 0)); seis.add(at(new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.white), 0, .165, 0));
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; seis.add(rod(V3(Math.cos(a) * .14, .06, Math.sin(a) * .14), V3(Math.cos(a) * .2, 0, Math.sin(a) * .2), .012, M.aluDark)); }
  seis.add(at(cyl(.025, .025, .04, M.aluDark, 10), 0, .32, 0)); seis.add(rod(V3(0, .3, 0), V3(0, .22, 0), .01, M.alu));
  part('seis', 'Sismógrafo SEIS', seis, V3(-.3, .5, -.3), 'Hecho en Francia. Por dentro tiene péndulos tan sensibles que notan un movimiento del suelo más chico que el ancho de un átomo de hidrógeno. Va dentro de una esfera al vacío y con tres patas que se nivelan solas. El brazo lo bajó al suelo el 19 de diciembre de 2018: fue la primera vez que un robot puso un instrumento en el suelo de otro planeta.');
  // WTS: el escudo contra el viento y el frío
  const wts = new THREE.Group(); wts.position.set(.32, H, .3);
  wts.add(at(new THREE.Mesh(new THREE.SphereGeometry(.36, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), Mt(0xe8e3d6, { metalness: .65, roughness: .28 })), 0, .03, 0));
  wts.add(at(cyl(.43, .45, .04, Mt(0x9a8a62, { metalness: .6, roughness: .5 }), 28), 0, .02, 0));
  wts.add(at(cyl(.03, .03, .05, M.aluDark, 10), 0, .41, 0));
  part('wts', 'Escudo WTS', wts, V3(.3, .6, .3), 'Una cúpula que tapa al sismógrafo, con una falda de malla metálica que se acomoda a las piedras del suelo. Sin ella, el viento y los cambios de temperatura (de −100 °C a 0 °C cada día) harían «temblar» al sensor más que los sismos de verdad. Se colocó el 2 de febrero de 2019.');
  // HP³: el topo alemán y su estructura
  const hp3 = new THREE.Group(); hp3.position.set(.42, H, -.38);
  hp3.add(at(box(.28, .3, .22, Mt(0x9a9ca0, { metalness: .55, roughness: .4 }), .01), 0, .18, 0));
  for (const [x, z] of [[-.13, -.1], [.13, -.1], [-.13, .1], [.13, .1]]) hp3.add(rod(V3(x, .05, z), V3(x * 1.3, 0, z * 1.3), .01, M.aluDark));
  hp3.add(at(cyl(.02, .02, .04, M.aluDark, 10), 0, .35, 0)); hp3.add(at(box(.12, .1, .06, M.gold), .1, .12, .13));
  const mole = at(cyl(.014, .014, .4, M.alu, 10), 0, .2, 0); hp3.add(mole);
  part('hp3', 'Topo HP³', hp3, V3(.35, .45, -.35), 'Hecho en Alemania. Dentro de la caja hay un «topo»: un clavo de 40 cm con un martillo interior que golpea y lo hunde solo, arrastrando un cable con sensores de temperatura. Debía llegar a 5 m para medir el calor que sale del interior de Marte. El suelo resultó duro y pegajoso, como tierra apelmazada, y el topo rebotaba sin agarre: tras casi dos años de intentos, con ayuda de la pala del brazo, solo quedó enterrado justo bajo la superficie.');
  // RISE y TWINS
  const rise = new THREE.Group();
  for (const [x, z, r] of [[-.5, .3, .4], [-.22, .55, -.4]]) { const h = at(cyl(.05, .1, .14, M.white, 4), x, H + .1, z, -.5, r); rise.add(h); rise.add(at(box(.08, .06, .08, M.gold), x, H + .03, z)); }
  part('rise', 'Antenas RISE', rise, V3(-.3, .4, .35), 'Dos antenas en forma de bocina que mandaban una señal de radio a la Tierra. Midiendo sus cambios de frecuencia, se calcula cómo se bambolea el eje de Marte al girar, como un trompo, y de eso cuánto pesa y mide su núcleo.');
  const twins = new THREE.Group();
  for (const s of [-1, 1]) { twins.add(rod(V3(s * .5, H + .02, -.5), V3(s * .78, H + .12, -.58), .012, M.alu)); twins.add(at(box(.08, .05, .05, M.white), s * .8, H + .13, -.59)); }
  twins.add(at(cyl(.02, .02, .05, M.dark, 8), 0, H + .04, .62));
  part('clima', 'Estación del tiempo APSS', twins, V3(0, .4, -.45), 'Dos brazos de viento TWINS, que miran a lados opuestos para medir de dónde sopla, y un barómetro con una toma de aire. Los sismólogos necesitan saber el viento para distinguir un sismo de una ráfaga. De paso, dio el pronóstico del tiempo diario en Marte durante años.');
  // brazo IDA de 2,4 m con la garra de cinco dedos y la cámara IDC
  const tool = new THREE.Group(); tool.add(rod(V3(0, 0, 0), V3(0, 0, -.1), .022, M.alu)); tool.add(at(cyl(.045, .045, .03, M.aluDark, 14), 0, 0, -.1, Math.PI / 2)); const fingers = [];
  for (let k = 0; k < 5; k++) { const o = new THREE.Group(); o.position.z = -.1; o.rotation.z = k / 5 * Math.PI * 2; const f = new THREE.Group(); f.position.x = .035; f.add(rod(V3(0, 0, 0), V3(0, 0, -.12), .007, M.dark)); f.add(at(box(.016, .016, .02, M.aluDark), 0, 0, -.12)); o.add(f); tool.add(o); fingers.push(f); }
  tool.add(at(box(.05, .05, .07, M.dark), 0, .065, -.02)); tool.add(at(box(.03, .03, .03, M.gold), 0, .065, .04));
  const arm = roboArm(1.0, 1.2, tool); arm.base.position.set(0, H, -.66);
  arm.el.add(at(box(.07, .06, .09, M.white), 0, .06, -.45)); arm.el.add(at(cyl(.02, .02, .01, M.lens, 10), 0, .06, -.5, Math.PI / 2));
  part('brazo', 'Brazo IDA y garra', arm.base, V3(0, .35, -.6), 'Un brazo de 2,4 m que primero fotografió el suelo con su cámara IDC para elegir el mejor lugar, y después levantó cada instrumento con una garra de cinco dedos, como una máquina de peluches, pero sin fallar ninguno. Todo se ensayó antes en una copia del módulo en JPL.');
  // amarras
  const t1 = tether(0x2a2a2a), t2 = tether(0x6b5a3a); g.add(t1, t2);
  const off = o => o.userData.hk + .22; seis.userData.hk = .34; wts.userData.hk = .44; hp3.userData.hk = .37;
  const SG = V3(-.55, gy(-.55, -1.95), -1.95), HG = V3(.78, gy(.78, -1.75), -1.75), WG = SG.clone();
  const homes = { seis: seis.position.clone(), wts: wts.position.clone(), hp3: hp3.position.clone() };
  const above = (P, o, up = 0) => [P.x, P.y + off(o) + up, P.z], S = [0, 1.55, -.32];
  const keys = [[0, ...S], [3, ...above(homes.seis, seis, .25)], [4.5, ...above(homes.seis, seis)], [5.5, ...above(homes.seis, seis)], [7, ...above(homes.seis, seis, .35)], [9.5, ...above(SG, seis, .3)], [11, ...above(SG, seis)], [12, ...above(SG, seis)], [13, ...above(SG, seis, .3)],
    [15.5, ...above(homes.wts, wts, .2)], [16.5, ...above(homes.wts, wts)], [17.5, ...above(homes.wts, wts)], [19, ...above(homes.wts, wts, .35)], [21.5, ...above(WG, wts, .3)], [23, ...above(WG, wts)], [24, ...above(WG, wts)], [25, ...above(WG, wts, .3)],
    [27, ...above(homes.hp3, hp3, .25)], [28.5, ...above(homes.hp3, hp3)], [29.5, ...above(homes.hp3, hp3)], [31, ...above(homes.hp3, hp3, .35)], [33, ...above(HG, hp3, .3)], [34.5, ...above(HG, hp3)], [35.5, ...above(HG, hp3)], [36.5, ...above(HG, hp3, .3)], [39, ...S], [52, ...S]];
  const plan = [[seis, 5, 11.5, SG], [wts, 17, 23.5, WG], [hp3, 29, 35, HG]];
  const T = 52, tmp = V3(), B = arm.base.position, deckP = V3(-.5, 1.0, -.6), deckH = V3(.55, 1.0, -.62);
  const seismo = new Float32Array(420); let sIdx = 0, lastT = 0, strokes = 0;
  function act(time, env) {
    const t = time % T, k = track(keys, t); arm.reach(tmp.copy(k.p).sub(B));
    let grip = 0;
    for (const [o, a, b, G] of plan) { const P = t < a ? homes[o === seis ? 'seis' : o === wts ? 'wts' : 'hp3'] : t < b ? V3(k.p.x, k.p.y - off(o), k.p.z) : G; o.position.copy(P); grip = Math.max(grip, sm(a - .8, a, t) * (1 - sm(b, b + .6, t))); }
    for (const f of fingers) f.rotation.y = .45 - grip * .32;
    // topo: martillazos a partir del segundo 39
    const ham = t > 39.5 && t < 47.5, ph = (t * 1.8) % 1, hit = ham && ph < .12; mole.position.y = .2 - sm(39.5, 46, t) * .37 + (hit ? .006 : 0); hp3.position.y += hit ? .004 : 0;
    // amarras: del sismógrafo y del topo hasta la cubierta
    t1.visible = t > 5; t1.userData.set(V3(seis.position.x, seis.position.y + .08, seis.position.z), deckP, t < 11.5 ? .05 : .12);
    t2.visible = t > 29; t2.userData.set(V3(hp3.position.x + .1, hp3.position.y + .12, hp3.position.z), deckH, t < 35 ? .04 : .1);
    // sismograma: ruido, golpes del topo y el martemoto S1222a
    const dt = t < lastT ? .016 : Math.min(.05, t - lastT); lastT = t; const nS = Math.max(1, Math.round(dt * 120));
    for (let i = 0; i < nS; i++) { const tt = t - dt + dt * (i + 1) / nS; let v = (Math.random() - .5) * .06 * (t < 11.5 ? 3 : t < 23.5 ? 1.8 : 1);
      if (ham && ((tt * 1.8) % 1) < .06) v += (Math.random() - .3) * .5;
      if (tt > 46.5) { const P = sm(46.5, 46.8, tt) * Math.exp(-(tt - 46.6) * 1.2) * .35, Sw = sm(48.3, 48.6, tt) * Math.exp(-(tt - 48.5) * .55); v += (Math.random() - .5) * 2 * (P + Sw) * Math.sin(tt * 37); }
      seismo[sIdx++ % seismo.length] = v; }
    strokes = ham ? Math.floor((t - 39.5) * 1.8) : t >= 47.5 ? 14 : 0;
    const step = t < 11.5 ? (t < 5.5 ? 0 : 1) : t < 25 ? 2 : t < 39 ? 3 : t < 46.5 ? 4 : 5;
    const depth = Math.round(sm(39.5, 46, t) * 37);
    return { step, kv: [['Sismógrafo', t < 11.5 ? 'en la cubierta' : t < 23.5 ? 'en el suelo, sin tapar' : 'en el suelo, tapado'], ['Punta del topo', t < 39.5 ? 'sin empezar' : `${depth} cm bajo la caja${t > 46 ? ' · atascado' : ''}`], ['Golpes del topo', `${strokes} (en la realidad, miles)`], ['Martemoto', t < 46.5 ? '—' : 'S1222a · magnitud 4,7']] };
  }
  function reset() { act(0); }
  shadows(g); reset();
  return { group: g, parts, act, reset, seismo: () => ({ a: seismo, i: sIdx }) };
}

// ---------- Viking 1 y 2 (1976): los primeros en trabajar en el suelo de Marte ----------
// base hexagonal de lados alternos 1,09 m y 0,56 m, tres patas (triángulo de 2,21 m), dos generadores nucleares SNAP-19,
// dos cámaras de barrido, brazo de cinta extensible (como un metro de carpintero) y los laboratorios de biología y GCMS
function buildViking(hf, n) {
  const g = new THREE.Group(), parts = [], two = n === 2;
  const part = (id, name, obj, dir, info) => { obj.userData.part = id; parts.push({ id, name, obj, dir, info, home: obj.position.clone() }); g.add(obj); return obj; };
  const h0 = hf(0, 0), gy = (x, z) => hf(x, z) - h0, skin = Mt(0xd9d6cc, { metalness: .3, roughness: .5 });
  // base hexagonal (un lado largo mira al frente, −z)
  const hex = []; { let x = 0, z = 0, a = 0; for (const L of [1.09, .56, 1.09, .56, 1.09, .56]) { hex.push([x, z]); x += Math.cos(a) * L; z += Math.sin(a) * L; a += Math.PI / 3; }
    const cx = hex.reduce((s, p) => s + p[0], 0) / 6, cz = hex.reduce((s, p) => s + p[1], 0) / 6; hex.forEach(p => { p[0] -= cx; p[1] -= cz; });
    const r = Math.atan2(hex[0][1] + hex[1][1], hex[0][0] + hex[1][0]), rot = -Math.PI / 2 - r; hex.forEach(p => { const x2 = p[0] * Math.cos(rot) - p[1] * Math.sin(rot), z2 = p[0] * Math.sin(rot) + p[1] * Math.cos(rot); p[0] = x2; p[1] = -z2; }); }
  const body = new THREE.Group(); body.add(flatShape(hex, skin, .3, .22)); body.add(flatShape(hex.map(p => [p[0] * 1.01, p[1] * 1.01]), M.alu, .52, .02));
  body.add(flatShape(hex.map(p => [p[0] * .95, p[1] * .95]), M.gold, .27, .03));
  // tres motores de descenso de 18 toberas cada uno (para no remover ni calentar el suelo) y las toberas de desorbitado
  for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + k / 3 * Math.PI * 2 + Math.PI / 3, x = Math.cos(a) * .48, z = Math.sin(a) * .48;
    body.add(at(cyl(.09, .12, .14, M.dark, 14), x, .22, z)); const face = at(cyl(.13, .13, .02, M.aluDark, 18), x, .15, z); body.add(face);
    for (let j = 0; j < 18; j++) { const b = j / 18 * Math.PI * 2, rr = j % 2 ? .1 : .06; body.add(at(cyl(.008, .012, .02, M.black, 6), x + Math.cos(b) * rr, .13, z + Math.sin(b) * rr)); } }
  part('cuerpo', 'Cuerpo y motores', body, V3(0, -.3, 0), 'Una caja de aluminio de seis lados, de 1,5 m, con la computadora, la radio, las baterías y los laboratorios bien abrigados por dentro. Debajo, tres motores de hidracina con 18 toberas pequeñas cada uno: repartían el chorro para no calentar ni ensuciar el suelo que luego iban a analizar.');
  // patas: en los tres lados cortos, con platos a 2,21 m entre sí
  const legs = new THREE.Group(), feet = [];
  for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + k / 3 * Math.PI * 2 + Math.PI / 3, c = Math.cos(a), s = Math.sin(a), fx = c * 1.276, fz = s * 1.276, f = V3(fx, gy(fx, fz) + .08, fz); feet.push(f);
    legs.add(rod(V3(c * .62, .42, s * .62), f, .05, M.alu)); for (const e of [-.5, .5]) legs.add(rod(V3(Math.cos(a + e) * .58, .3, Math.sin(a + e) * .58), f.clone().add(V3(0, .05, 0)), .022, M.aluDark));
    legs.add(at(cyl(.15, .15, .05, M.alu, 18), fx, f.y - .05, fz)); }
  part('patas', 'Patas', legs, V3(0, -.25, 0), 'Tres patas con amortiguadores de aluminio en panal. La primera foto tomada en el suelo de Marte fue justamente de la pata número 3 del Viking 1, minutos después de aterrizar: querían ver si se había hundido en el suelo.' + (two ? ' El Viking 2 quedó inclinado 8°, con una pata sobre una roca.' : ''));
  // dos generadores SNAP‑19 de plutonio bajo sus cubiertas contra el viento
  const rtg = new THREE.Group();
  for (const [x, z] of [[-.42, .38], [.42, .38]]) { rtg.add(at(box(.5, .34, .42, Mt(0xeeeae0, { roughness: .7 })), x, .71, z)); rtg.add(at(cyl(.12, .12, .3, M.dark, 12), x, .72, z, Math.PI / 2)); for (let j = 0; j < 6; j++) rtg.add(at(box(.012, .3, .36, M.aluDark), x - .2 + j * .08, .71, z)); }
  part('rtg', 'Generadores nucleares', rtg, V3(0, .45, .35), 'Dos generadores SNAP‑19: el calor del plutonio se convierte en unos 35 W de electricidad cada uno, de día y de noche, sin depender del Sol ni del polvo. Por eso funcionaron años. Las cubiertas los protegen del viento y llevan el calor sobrante al interior.');
  // cámaras de barrido: cilindros que giran y arman la foto línea por línea
  const camG = new THREE.Group(), heads = [];
  for (const x of [-.4, .4]) { camG.add(rod(V3(x, .52, -.2), V3(x, 1.12, -.2), .045, M.alu)); const hd = new THREE.Group(); hd.position.set(x, 1.22, -.2);
    hd.add(at(cyl(.1, .1, .3, Mt(0x8e9096, { metalness: .6, roughness: .35 }), 18), 0, 0, 0)); hd.add(at(cyl(.11, .11, .04, M.dark, 18), 0, .17, 0)); hd.add(at(box(.03, .14, .03, M.black), 0, .02, -.1)); hd.add(at(cyl(.03, .035, .05, M.dark, 10), 0, -.04, -.09, Math.PI / 2)); camG.add(hd); heads.push(hd); }
  part('camaras', 'Cámaras de barrido', camG, V3(0, .45, -.3), 'Dos cámaras «de fax», separadas 0,8 m para ver en 3D. No sacaban la foto de golpe: un espejo giraba y tomaba una línea vertical a la vez, mientras la cámara rotaba poco a poco. Una panorámica tardaba muchos minutos y llegaba a la Tierra línea por línea.');
  // antena parabólica de alta ganancia y antena UHF
  const ant = new THREE.Group(); ant.add(rod(V3(.05, .52, .55), V3(.05, 1.45, .55), .03, M.alu));
  const dish = at(new THREE.Mesh(new THREE.SphereGeometry(.38, 24, 8, 0, Math.PI * 2, 0, .55), Mt(0xf2f0ea, { side: THREE.DoubleSide, roughness: .5 })), .05, 1.75, .55, -2.2); ant.add(dish); ant.add(at(cyl(.02, .02, .2, M.aluDark, 8), .05, 1.62, .45, -.6));
  ant.add(at(cyl(.04, .04, .35, M.white, 10), -.6, .7, -.05));
  part('antena', 'Antenas', ant, V3(0, .5, .4), 'La parabólica de 76 cm hablaba directo con la Tierra, apuntando con precisión cada día. La antena UHF, la vara blanca, mandaba los datos al orbitador Viking que pasaba por encima, y él los reenviaba. El Viking 1 se perdió en 1982 por un comando equivocado que borró el programa para apuntar la parabólica.');
  // brazo meteorológico
  const met = new THREE.Group(); met.add(rod(V3(.62, .52, .15), V3(.75, 1.1, .2), .02, M.alu)); met.add(rod(V3(.75, 1.1, .2), V3(1.25, 1.42, .2), .015, M.alu)); met.add(at(box(.12, .06, .08, M.white), 1.28, 1.44, .2)); met.add(at(cyl(.005, .005, .14, M.gold, 6), 1.33, 1.5, .2));
  part('meteo', 'Estación del tiempo', met, V3(.45, .3, .1), 'Un brazo con sensores de viento de película caliente y termómetros. Midió los primeros pronósticos de Marte: madrugadas de −85 °C, tardes de −30 °C y cómo la presión del aire sube y baja con las estaciones, porque en invierno parte del aire se congela en los polos.');
  // laboratorios: embudos de entrada en la cubierta
  const lab = new THREE.Group(), funnel = (x, z, c) => { lab.add(at(cyl(.07, .025, .08, c, 14), x, .58, z)); lab.add(at(cyl(.075, .075, .01, M.dark, 14), x, .625, z)); };
  funnel(-.3, -.15, M.gold); funnel(.05, -.12, M.alu); funnel(.3, -.15, M.white); lab.add(at(box(.18, .08, .14, M.gold), -.05, .56, .12)); lab.add(at(box(.12, .1, .1, M.dark), .32, .57, .08));
  part('labs', 'Biología, GCMS y rayos X', lab, V3(0, .35, -.2), 'Tres embudos: el de biología (dorado), el del GCMS (que busca moléculas orgánicas) y el del espectrómetro de rayos X (que mide los elementos del suelo). La biología hacía tres experimentos para buscar seres vivos; uno dio una señal que parecía de vida, pero el GCMS no encontró nada orgánico. El debate sigue: en 2008 Phoenix halló percloratos, que pudieron destruir lo orgánico al calentarlo.');
  // brazo de muestreo: un tubo que gira y una cinta metálica que se estira hasta 3 m, con la pala en la punta
  const arm = new THREE.Group(); arm.position.set(0, .56, -.52); const yaw = new THREE.Group(), pitch = new THREE.Group(); arm.add(yaw); yaw.add(pitch);
  yaw.add(at(box(.22, .16, .3, Mt(0xb8b4aa, { metalness: .5 })), 0, .02, .1)); pitch.add(at(cyl(.09, .09, .26, M.aluDark, 16), 0, 0, 0, 0, 0, Math.PI / 2));
  const tape = at(box(.07, .015, 1, Mt(0xcfd2d6, { metalness: .85, roughness: .25 })), 0, 0, -.5); pitch.add(tape);
  const head = new THREE.Group(); pitch.add(head); head.add(at(box(.1, .09, .16, M.alu), 0, -.03, -.05)); head.add(at(box(.09, .012, .1, M.aluDark), 0, -.08, -.12)); head.add(at(box(.012, .06, .08, M.aluDark), .045, -.1, -.12)); head.add(at(box(.012, .06, .08, M.aluDark), -.045, -.1, -.12)); head.add(at(cyl(.015, .015, .02, M.dark, 10), 0, .025, -.05));
  const lid = at(box(.09, .01, .1, M.alu), 0, -.07, -.12); head.add(lid);
  part('brazo', 'Brazo de muestreo', arm, V3(0, .3, -.6), 'No es un brazo con codo: es una cinta de acero doblada en canal, como la de un metro de carpintero, que sale de un tambor y se estira hasta 3 m. La pala de la punta cava, tamiza la tierra y la echa en los embudos. ' + (two ? 'El Viking 2 empujó rocas a un lado para tomar tierra que había estado protegida del Sol debajo.' : 'También llevaba un imán para recoger polvo con hierro, que las cámaras miraban con un espejito.'));
  // zanja, granos, roca que se empuja (Viking 2), escarcha de invierno (Viking 2) y la roca Big Joe (Viking 1)
  const origin = arm.position, dirt = Mt(0x5a301e, { roughness: 1 }), DZ0 = -2.3, DZ1 = -1.75, DX = two ? -.45 : .25;
  const trench = at(box(.12, .03, 1, dirt), DX, gy(DX, -2) - .01, 0); g.add(trench);
  const NP = 30, pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3)); const grains = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x8a5a3c, size: .022 })); grains.frustumCulled = false; g.add(grains);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(.13, 1), Mt(0x5b4a40, { roughness: .95 })); rock.scale.set(1.3, .75, 1); const RK = V3(DX, gy(DX, -2.0) + .06, -2.0); if (two) g.add(rock);
  const frost = []; if (two) for (let k = 0; k < 60; k++) { const x = (Math.random() - .5) * 7, z = -1.3 - Math.random() * 5; const f = new THREE.Mesh(new THREE.CircleGeometry(.04 + Math.random() * .14, 7), new THREE.MeshStandardMaterial({ color: 0xf4f7fa, roughness: .6, transparent: true, opacity: 0, depthWrite: false })); f.rotation.x = -Math.PI / 2; f.rotation.z = Math.random() * 3; f.scale.set(1, .4 + Math.random() * .6, 1); f.position.set(x, gy(x, z) + .02, z); g.add(f); frost.push(f); }
  if (!two) { const bj = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), Mt(0x6a5244, { roughness: .95, flatShading: true })); bj.scale.set(1.1, .55, .8); bj.position.set(-3.2, gy(-3.2, -7.5) + .25, -7.5); g.add(bj); }
  const BIO = V3(-.3, .78, -.15), GC = V3(.05, .78, -.12), S = V3(0, .62, -.85);
  const H = (x, z, up) => [x, gy(x, z) + .12 + up, z];
  const keys = two
    ? [[0, ...S.toArray()], [2.5, ...H(DX + .35, -2.0, .3)], [3.5, ...H(DX + .3, -2.0, .02)], [6.5, ...H(DX - .35, -2.0, .02)], [7.5, ...H(DX - .35, -2.0, .3)], [8.5, ...H(DX, DZ0, .3)], [9.5, ...H(DX, DZ0, 0)], [13, ...H(DX, DZ1, 0)], [14, ...H(DX, DZ1, .45)], [17, ...BIO.toArray()], [20, ...BIO.toArray()], [22, ...S.toArray()], [25, ...H(DX + .15, DZ0 + .1, .3)], [26, ...H(DX + .15, DZ0 + .1, 0)], [28.5, ...H(DX + .15, DZ1 - .1, 0)], [29.5, ...H(DX + .15, DZ1, .4)], [32, ...GC.toArray()], [35, ...GC.toArray()], [37, ...S.toArray()], [46, ...S.toArray()]]
    : [[0, ...S.toArray()], [2.5, ...H(DX, DZ0, .3)], [3.5, ...H(DX, DZ0, 0)], [7.5, ...H(DX, DZ1, 0)], [8.5, ...H(DX, DZ1, .45)], [11.5, ...BIO.toArray()], [14.5, ...BIO.toArray()], [16.5, ...S.toArray()], [22, ...S.toArray()], [24.5, ...H(DX + .15, DZ0 + .1, .3)], [25.5, ...H(DX + .15, DZ0 + .1, 0)], [28, ...H(DX + .15, DZ1 - .1, 0)], [29, ...H(DX + .15, DZ1, .4)], [31.5, ...GC.toArray()], [34.5, ...GC.toArray()], [36.5, ...S.toArray()], [46, ...S.toArray()]];
  const T = 46, tmp = V3(), d = V3();
  const pourBio = two ? [17.3, 19.8] : [11.8, 14.3], pourGC = two ? [32.3, 34.8] : [31.8, 34.3], dig1 = two ? [9.5, 13] : [3.5, 7.5], dig2 = two ? [26, 28.5] : [25.5, 28];
  function act(time, env) {
    const t = time % T, k = track(keys, t); d.copy(k.p).sub(origin);
    yaw.rotation.y = Math.atan2(-d.x, -d.z); const L = Math.max(.3, d.length()), el = Math.atan2(d.y, Math.hypot(d.x, d.z)); pitch.rotation.x = el;
    tape.scale.z = L; tape.position.z = -L / 2; head.position.z = -L; head.rotation.x = -el;
    const pour = (t > pourBio[0] && t < pourBio[1]) || (t > pourGC[0] && t < pourGC[1]); lid.rotation.x = pour ? -.9 : 0; head.rotation.z = pour ? Math.sin(t * 40) * .05 : 0;    // la pala vibra para tamizar
    const pp = pGeo.attributes.position, P = (t > pourBio[0] && t < pourBio[1]) ? BIO : GC; grains.visible = pour;
    if (pour) for (let i = 0; i < NP; i++) { const f = (t * 1.5 + i / NP) % 1; pp.setXYZ(i, P.x + Math.sin(i * 7.1) * .02, P.y - .03 - f * .14, P.z + Math.cos(i * 3.3) * .02); } pp.needsUpdate = true;
    const len = Math.max(.001, sm(dig1[0], dig1[1], t) * (DZ1 - DZ0)); trench.scale.z = len; trench.position.z = DZ0 + len / 2; trench.visible = len > .01;
    if (two) { const push = sm(3.5, 6.5, t); rock.position.set(RK.x - push * .6, RK.y, RK.z); rock.rotation.z = push * 1.4; frost.forEach((f, i) => f.material.opacity = .38 * sm(37 + (i % 14) * .2, 41 + (i % 14) * .2, t) * (1 - sm(44.5, 45.8, t))); }
    heads.forEach((h, i) => h.rotation.y = -t * .35 + i * .4);
    const lr = sm(pourBio[1], pourBio[1] + 8, t) * (1 - sm(44, 45.5, t));
    let step; if (two) step = t < 8 ? 0 : t < 14 ? 1 : t < 22 ? 2 : t < 37 ? 3 : 4; else step = t < 8.5 ? 0 : t < 16.5 ? 1 : t < 24 ? 2 : t < 37 ? 3 : 4;
    return { step, scan: { f: (t % 23) / 21, cycle: Math.floor(t / 23), pos: V3(.4, 1.24, -.32), look: V3(DX, gy(DX, -2), -2.0) },
      kv: [['Liberación marcada', lr > .02 ? `gas marcado: ${Math.round(lr * 10000).toLocaleString('es-EC')} cuentas/min${lr > .8 ? ' · ¿vida?' : ''}` : 'esperando tierra'], ['Control (tierra calentada a 160 °C)', lr > .5 ? 'casi nada de gas' : '—'],
        ['GCMS: moléculas orgánicas', t > pourGC[1] + 1.5 && t < 45 ? 'ninguna detectada' : t > pourGC[0] ? 'calentando la muestra…' : '—'], ['Temperatura del aire', `${Math.round(-30 - 55 * (.5 + .5 * Math.cos(t / T * Math.PI * 2)))} °C`]] };
  }
  function reset() { act(0); }
  shadows(g); grains.castShadow = false; frost.forEach(f => { f.castShadow = false; }); reset();
  return { group: g, parts, act, reset };
}

// ======================= los que no lo lograron (o casi): Mars 2, 3 y 6, Beagle 2, Mars Polar Lander y Schiaparelli =======================
// cada uno trae un grupo «inner» con sus piezas (para bajarlo, inclinarlo o romperlo en la reconstrucción) y un kit de descenso:
// paracaídas, llama de los cohetes, polvo, cráter y trozos que saltan
function descentKit(g, gy) {
  const k = {};
  k.chute = new THREE.Group(); const can = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, 1.1), Mt(0xe8e2d2, { side: THREE.DoubleSide, roughness: .8 }));
  can.scale.set(1, .55, 1); k.chute.add(can); const lp = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; lp.push(Math.cos(a) * .89, .25, Math.sin(a) * .89, 0, -2.2, 0); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); k.chute.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5a5248 }))); k.chute.visible = false; g.add(k.chute);
  k.flame = new THREE.Group(); k.flames = []; g.add(k.flame);
  k.addFlame = (x, y, z, s = 1) => { const f = new THREE.Mesh(new THREE.ConeGeometry(.08 * s, .6 * s, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb266, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); f.rotation.x = Math.PI; f.position.set(x, y - .3 * s, z); k.flame.add(f); k.flames.push(f); return f; };
  const ND = 220, dGeo = new THREE.BufferGeometry(), dP = new Float32Array(ND * 3), seeds = []; for (let i = 0; i < ND; i++) seeds.push([Math.random() * Math.PI * 2, .3 + Math.random(), Math.random()]);
  dGeo.setAttribute('position', new THREE.BufferAttribute(dP, 3)); k.dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0xb07a52, size: .09, transparent: true, opacity: 0, depthWrite: false })); k.dust.frustumCulled = false; g.add(k.dust);
  k.crater = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ color: 0x2e1c14, roughness: 1, transparent: true, opacity: 0, depthWrite: false })); k.crater.rotation.x = -Math.PI / 2; k.crater.position.y = gy(0, 0) + .015; g.add(k.crater);
  k.blast = new THREE.Mesh(new THREE.RingGeometry(1, 3.2, 40), new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 1, transparent: true, opacity: 0, depthWrite: false })); k.blast.rotation.x = -Math.PI / 2; k.blast.position.y = gy(0, 0) + .012; g.add(k.blast);
  k.bits = []; for (let i = 0; i < 10; i++) { const b = at(box(.08 + Math.random() * .12, .03, .06 + Math.random() * .1, i % 3 ? M.alu : M.gold), 0, 0, 0); b.visible = false; g.add(b); k.bits.push([b, Math.random() * Math.PI * 2, 2 + Math.random() * 4, 2 + Math.random() * 3]); }
  // impacto: age en segundos desde el choque; size escala el cráter y la nube
  k.impact = (age, size = 1, blast = 0) => {
    const on = age >= 0; k.dust.material.opacity = on ? Math.max(0, .85 - age * .14) : 0;
    if (on) for (let i = 0; i < ND; i++) { const [a, sp, up] = seeds[i], r = sp * size * 2.2 * (1 - Math.exp(-age * 1.6)); dP[i * 3] = Math.cos(a) * r; dP[i * 3 + 1] = gy(0, 0) + .05 + up * size * 1.2 * Math.max(0, Math.sin(Math.min(Math.PI, age * 1.2))) * (1 - age * .08); dP[i * 3 + 2] = Math.sin(a) * r; }
    dGeo.attributes.position.needsUpdate = true; k.crater.material.opacity = on ? Math.min(.9, age * 3) : 0; k.crater.scale.setScalar(size * .9);
    k.blast.material.opacity = on && blast ? Math.min(.55, age * 1.5) * blast : 0; k.blast.scale.setScalar(size);
    for (const [b, a, v, vy] of k.bits) { b.visible = on && age < 6; if (!b.visible) continue; const tt = Math.min(age, (2 * vy) / 3.71); b.position.set(Math.cos(a) * v * tt * .5 * size, gy(0, 0) + .03 + Math.max(0, vy * tt - 1.855 * tt * tt) * .5, Math.sin(a) * v * tt * .5 * size); b.rotation.set(age * 6, age * 3, 0); }
  };
  k.reset = () => { k.chute.visible = false; k.flames.forEach(f => f.visible = false); k.impact(-1); };
  return k;
}
function crashBase(hf) {
  const g = new THREE.Group(), inner = new THREE.Group(), parts = []; g.add(inner);
  const part = (id, name, obj, dir, info) => { obj.userData.part = id; parts.push({ id, name, obj, dir, info, home: obj.position.clone() }); inner.add(obj); return obj; };
  const h0 = hf(0, 0), gy = (x, z) => hf(x, z) - h0; return { g, inner, parts, part, gy, kit: descentKit(g, gy) };
}
const flick = t => .75 + Math.sin(t * 61) * .15 + Math.sin(t * 37) * .1;

// ---------- módulos soviéticos M‑71 y M‑73 (Mars 2, Mars 3 y Mars 6): una esfera con cuatro pétalos ----------
function buildSoviet(hf, kind) {
  const { g, inner, parts, part, gy, kit } = crashBase(hf);
  const shell = Mt(0xc9c3b4, { metalness: .45, roughness: .45 }), green = Mt(0x6f7a63, { metalness: .3, roughness: .6 });
  const body = new THREE.Group(); body.add(at(new THREE.Mesh(new THREE.SphereGeometry(.5, 28, 16), shell), 0, .55, 0)); body.add(at(cyl(.52, .52, .08, M.aluDark, 28), 0, .52, 0));
  body.add(at(cyl(.12, .16, .14, M.dark, 14), 0, 1.07, 0)); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; body.add(at(box(.07, .05, .02, M.gold), Math.cos(a) * .47, .72, Math.sin(a) * .47, 0, -a + Math.PI / 2)); }
  part('cuerpo', 'Esfera del módulo', body, V3(0, .3, 0), 'El módulo que llegaba al suelo era una esfera de 1,2 m y 358 kg, envuelta en espuma para aguantar el golpe. Dentro iban la radio, las baterías, los aparatos para medir la temperatura, la presión y el viento, y un espectrómetro de masas para el aire.');
  // pétalos triangulares: cerrados forman una pirámide; abiertos quedan en el suelo y enderezan el módulo
  const pet = new THREE.Group(), petals = [];
  for (let k = 0; k < 4; k++) { const hinge = new THREE.Group(), a = k / 4 * Math.PI * 2; hinge.rotation.y = -a; const p = new THREE.Group(); p.position.set(.52, .2, 0); hinge.add(p);
    const sh = new THREE.Shape(); sh.moveTo(0, -.5); sh.lineTo(1.05, 0); sh.lineTo(0, .5); sh.lineTo(0, -.5); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .03, bevelEnabled: false }), green); m.rotation.x = -Math.PI / 2; p.add(m);
    p.add(rod(V3(0, .02, 0), V3(.9, .02, 0), .015, M.aluDark)); pet.add(hinge); petals.push(p); }
  part('petalos', 'Pétalos', pet, V3(0, -.15, 0), 'Cuatro pétalos de metal que, al abrirse, empujan el suelo y ponen derecho al módulo, cayera como cayera. Al abrirse dejaban libres las cámaras y las antenas.');
  // cámaras panorámicas (telefotómetros) y antenas de látigo
  const cams = new THREE.Group(); for (const s of [-1, 1]) { cams.add(at(cyl(.07, .07, .26, Mt(0x9aa0a6, { metalness: .6 }), 16), s * .36, .95, 0)); cams.add(at(box(.03, .12, .03, M.black), s * .36 - .06 * s, .97, 0)); }
  part('camaras', 'Cámaras panorámicas', cams, V3(0, .45, -.2), 'Dos «telefotómetros»: en vez de sacar una foto de golpe, un espejo giraba y armaba la imagen de 360° línea por línea, igual que en el Viking pero cinco años antes.');
  const ants = new THREE.Group(), antM = []; for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4, h = new THREE.Group(); h.position.set(Math.cos(a) * .3, 1.0, Math.sin(a) * .3); h.rotation.y = -a; const r = at(cyl(.008, .008, 1.1, M.alu, 6), .55, 0, 0, 0, 0, Math.PI / 2); h.add(r); ants.add(h); antM.push(h); }
  part('antenas', 'Antenas', ants, V3(0, .5, .2), 'Cuatro antenas de látigo que se estiran después de abrir los pétalos. Mandaban todo al orbitador, que pasaba por encima y lo reenviaba a la Tierra.');
  // PrOP‑M: el primer rover que llegó a Marte, con esquís y un cable de 15 m (solo en Mars 2 y 3)
  let prop = null, tth = null, propArm = null;
  if (kind !== 6) { const pg = new THREE.Group(); prop = new THREE.Group(); prop.add(at(box(.25, .14, .22, Mt(0x8c9196, { metalness: .5 })), 0, .12, 0)); for (const s of [-1, 1]) prop.add(at(box(.06, .02, .3, M.aluDark), s * .16, .04, 0)); prop.add(at(cyl(.004, .004, .2, M.alu, 4), .1, .12, -.2, Math.PI / 2)); prop.add(at(cyl(.004, .004, .2, M.alu, 4), -.1, .12, -.2, Math.PI / 2));
    prop.position.set(0, .62, -.55); pg.add(prop); propArm = new THREE.Group(); propArm.position.set(0, .75, -.45); propArm.add(rod(V3(0, 0, 0), V3(0, 0, -.6), .015, M.alu)); pg.add(propArm);
    tth = tether(0x222222); pg.add(tth);
    part('prop', 'Rover PrOP‑M', pg, V3(0, .3, -.5), 'El primer rover enviado a otro planeta: una cajita de 4,5 kg que caminaba sobre dos esquís, atada al módulo con un cable de 15 m. Dos varillas al frente tocaban los obstáculos para que diera la vuelta solo. Medía la dureza del suelo. Nunca se supo si llegó a salir.'); }
  const T = kind === 2 ? 18 : 30;
  function pose(open) { petals.forEach(p => p.rotation.z = (1 - open) * 1.25); antM.forEach(h => h.rotation.z = (1 - Math.min(1, open * 1.4)) * -1.45 + .35); }
  function act(time) {
    const t = time % T; kit.reset(); kit.flames.length || kit.addFlame(0, 2.1, 0, 2.5);
    let step = 0, alt = 0, open = 0, look = 1.5; inner.visible = true; inner.rotation.set(0, 0, 0);
    if (kind === 2) {                     // sin paracaídas: cae empinado y se estrella
      const ti = 6; if (t < ti) { const u = t / ti; alt = 34 * (1 - u * u); inner.position.set(-14 * (1 - u), alt, 6 * (1 - u)); inner.rotation.set(1.1 * u, .4, .8); open = 0; look = Math.max(1.5, alt * 1.05); step = t < 3 ? 0 : 1; }
      else { inner.visible = false; kit.impact(t - ti, 1.1, .4); step = t < 10 ? 2 : 3; }
      pose(open); return { step, look, lookX: t < 6 ? inner.position.x * .9 : 0, kv: [['Ángulo de entrada', 'demasiado empinado'], ['Paracaídas', t < ti ? 'no alcanza a frenar' : '—'], ['Velocidad', t < ti ? `${Math.round(400 + 900 * t / ti)} km/h` : 'choque'], ['Resultado', t < ti ? 'cayendo…' : 'primer objeto humano en Marte']] };
    }
    // Mars 3 y 6: paracaídas, cohete de frenado que se lleva el paracaídas, golpe y (Mars 3) apertura y 20 s de señal
    const land = kind === 3 ? 7 : 7.5;
    if (t < land) { const u = t / land; alt = 24 * (1 - u); inner.position.set(0, alt, 0); inner.rotation.z = Math.sin(t * 1.3) * .06; kit.chute.visible = t < land - 1.4; kit.chute.position.set(Math.sin(t * 1.3) * .2, alt + 5.2, 0); kit.chute.scale.setScalar(2.4);
      if (t > land - 1.6 && t < land - .2) { kit.flame.position.set(0, alt, 0); kit.flames[0].visible = true; kit.flames[0].material.opacity = .8 * flick(t); kit.chute.position.x += (t - land + 1.6) * 8; }
      step = 0; look = Math.max(1.5, alt * 1.05); }
    else inner.position.set(0, Math.max(0, .25 * Math.sin((t - land) * 9) * Math.exp(-(t - land) * 4)), 0);
    if (kind === 6) {
      const lost = t > land - .4; if (t >= land) kit.impact(t - land, .35, 0);
      pose(0); step = t < 3 ? 0 : t < land - .4 ? 1 : 2; if (t > 16) step = 3;
      const tx = Math.min(224, Math.round(t / (land - .4) * 224));
      return { step, look, kv: [['Datos enviados al bajar', `${tx} de 224 s`], ['Presión', lost ? '—' : `${(3 + t * .9).toFixed(1)} mbar`], ['Cohete de frenado', t < land - 1.6 ? 'esperando' : lost ? 'encendido… y silencio' : 'encendiendo'], ['Señal', lost ? 'perdida a las 09:11:05 UTC' : 'llegando']] };
    }
    if (t >= land) kit.impact(t - land, .35, 0);
    open = sm(land + 1, land + 4, t); pose(open);
    if (prop) { const pd = sm(land + 6, land + 9, t), walk = sm(land + 9, land + 16, t); propArm.rotation.x = -pd * .9; prop.position.set(0, .62 - pd * (.62 - gy(0, -1.15)) , -.55 - pd * .6 - walk * 1.1); prop.position.y += walk > 0 && walk < 1 ? Math.abs(Math.sin(t * 3)) * .03 : 0;
      tth.visible = pd > .05; tth.userData.set(V3(0, .6, -.45), prop.position.clone().add(V3(0, .1, .1)), .12); }
    const sig = t > land + 2 && t < land + 2 + 20 * .5;
    step = t < land ? 0 : t < land + 2 ? 1 : t < land + 6 ? 2 : t < land + 12 ? 3 : 4;
    return { step, look, scan: t > land + 2 ? { f: Math.min(.22, (t - land - 2) / 10 * .22), cycle: Math.floor(time / T), pos: V3(.36, 1.0, -.1), look: V3(0, gy(0, -3), -3), noise: .92, lost: t > land + 12 } : null,
      kv: [['Pétalos', open < .02 ? 'cerrados' : open < .98 ? 'abriéndose' : 'abiertos'], ['Señal al orbitador', t < land + 1.5 ? 'esperando 90 s' : sig ? 'transmitiendo…' : 'perdida tras unos 20 s'], ['Imagen recibida', t < land + 2 ? '—' : `${Math.min(70, Math.round((t - land - 2) / 10 * 70))} líneas, gris y sin detalles`], ['Tormenta de polvo', 'cubría todo el planeta']] };
  }
  function reset() { kit.reset(); inner.position.set(0, 0, 0); inner.rotation.set(0, 0, 0); inner.visible = true; pose(1); if (prop) { prop.position.set(0, .62, -.55); propArm.rotation.x = 0; tth.visible = false; } }
  shadows(g); kit.dust.castShadow = false; reset();
  return { group: g, parts, act, reset };
}

// ---------- Beagle 2 (2003): rebotó en bolsas de aire, abrió solo una parte de sus paneles y tapó su propia antena ----------
function buildBeagle(hf) {
  const { g, inner, parts, part, gy, kit } = crashBase(hf);
  const base = new THREE.Group(); base.add(at(cyl(.33, .3, .14, Mt(0x6d6f73, { metalness: .6, roughness: .4 }), 32), 0, .09, 0)); base.add(at(cyl(.335, .335, .02, M.gold, 32), 0, .165, 0));
  base.add(at(box(.14, .05, .1, M.gold), .05, .19, .08)); base.add(at(cyl(.03, .03, .06, M.dark, 10), -.12, .2, -.05));
  part('base', 'Base y laboratorio GAP', base, V3(0, -.25, 0), 'Una «tapa de olla» de menos de un metro donde iba todo: la computadora, la batería y el GAP, un laboratorio que horneaba muestras para buscar rastros de vida en los gases. Pesaba unos 33 kg. Lo dirigía el científico británico Colin Pillinger y su nombre recuerda al barco de Darwin.');
  const ant = new THREE.Group(); ant.add(at(cyl(.012, .012, .12, M.white, 8), .2, .24, 0)); ant.add(at(box(.05, .02, .05, M.white), .2, .3, 0));
  part('antena', 'Antena', ant, V3(.25, .2, 0), 'La antena de radio quedaba debajo del último panel. Si ese panel no se abría, la antena quedaba tapada y el Beagle 2 no podía hablar con nadie: eso fue lo que pasó.');
  // cuatro paneles redondos que se abren como pétalos alrededor de la base
  const pg = new THREE.Group(), panels = [];
  for (let k = 0; k < 4; k++) { const hinge = new THREE.Group(), a = k / 4 * Math.PI * 2; hinge.rotation.y = -a; const p = new THREE.Group(); p.position.set(.32, .18, 0); hinge.add(p);
    const disc = at(new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .012, 30), M.solar), -.3, -.006 + k * .022, 0); p.add(disc); p.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.305, .305, .02, 30), M.gold), -.3, .01 + k * .022, 0)); pg.add(hinge); panels.push(p); }   // las celdas miran hacia abajo guardadas y hacia arriba abiertas
  part('paneles', 'Paneles solares', pg, V3(0, .3, 0), 'Cuatro paneles redondos guardados uno sobre otro. Al abrirse como pétalos daban energía y destapaban la antena. En 2015 la cámara HiRISE lo encontró en el suelo: solo uno, dos o como mucho tres paneles se habían abierto.');
  // tapa con el brazo PAW plegado
  const lidG = new THREE.Group(); lidG.position.set(-.33, .2, 0); const lid = new THREE.Group(); lidG.add(lid);
  lid.add(at(new THREE.Mesh(new THREE.SphereGeometry(.34, 30, 8, 0, Math.PI * 2, 0, .5), Mt(0x6d6f73, { metalness: .6, roughness: .4 })), .33, -.06, 0));
  const paw = new THREE.Group(); paw.add(rod(V3(.2, .06, 0), V3(.5, .07, 0), .02, M.alu)); paw.add(at(box(.1, .07, .1, M.gold), .52, .08, 0)); paw.add(at(cyl(.015, .015, .12, M.dark, 8), .55, .08, .06, Math.PI / 2)); lid.add(paw);
  part('tapa', 'Tapa y brazo PAW', lidG, V3(-.3, .35, 0), 'La tapa se abría como una almeja. Por dentro llevaba el brazo con el PAW: cámaras estéreo, un microscopio, dos espectrómetros, un taladro para rocas y el «topo» PLUTO, que se arrastraba por el suelo para sacar tierra de debajo de las piedras.');
  // bolsas de aire (tres esferas) para la reconstrucción
  const bags = new THREE.Group(); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; bags.add(at(new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 14), Mt(0xd8d0bf, { roughness: .9 })), Math.cos(a) * .4, .55, Math.sin(a) * .4)); } bags.visible = false; g.add(bags);
  const OPEN = [1, 1, .55, 0], T = 26;
  function pose(lidA, pan) { lid.rotation.z = -lidA * 2.0; panels.forEach((p, i) => p.rotation.z = -pan[i] * Math.PI * .97); }
  function act(time) {
    const t = time % T; kit.reset(); let step, look = 1.2;
    if (t < 7) { const bx = -10 + t * 1.45, hgt = Math.abs(Math.sin(t * 1.6)) * 7 * Math.exp(-t * .45); bags.visible = true; bags.position.set(bx, hgt, 0); bags.rotation.z = -t * 2; inner.visible = false; step = 0; look = Math.max(1.2, hgt * .8); }
    else { bags.visible = t < 8.5; if (bags.visible) { const u = t - 7; bags.position.set(.2 + u * 3, .1 + u * 2, -u); bags.scale.setScalar(Math.max(.3, 1 - u * .5)); } else bags.scale.setScalar(1);
      inner.visible = true; inner.position.set(0, 0, 0); step = 1; }
    const lidA = sm(10, 12.5, t), pan = OPEN.map((o, i) => o * sm(12.5 + i * 1.2, 14 + i * 1.2, t)); pose(lidA, pan);
    if (t > 10) step = 2; if (t > 17) step = 3; if (t > 21) step = 4;
    return { step, look, lookX: t < 7 ? -10 + t * 1.45 : 0, kv: [['Bolsas de aire', t < 7 ? 'rebotando' : 'sueltas'], ['Paneles abiertos', t < 12.5 ? '0 de 4' : `${pan.filter(p => p > .9).length} de 4 (uno a medias)`], ['Antena', t < 17 ? '—' : 'tapada por el último panel'], ['Señal', t < 17 ? 'esperando…' : 'ninguna, nunca: hasta que HiRISE lo vio en 2015']] };
  }
  function reset() { kit.reset(); bags.visible = false; inner.visible = true; inner.position.set(0, 0, 0); pose(1, [1, 1, 1, 1]); }
  shadows(g); reset();
  return { group: g, parts, act, reset };
}

// ---------- Mars Polar Lander (1999): apagó los motores a 40 m por una señal falsa de sus patas ----------
function buildMPL(hf) {
  const { g, inner, parts, part, gy, kit } = crashBase(hf);
  const deck = new THREE.Group(); deck.add(at(cyl(.72, .72, .26, Mt(0xd8ccae, { metalness: .35, roughness: .45 }), 12), 0, .78, 0)); deck.add(at(cyl(.74, .74, .03, M.alu, 12), 0, .92, 0)); deck.add(at(cyl(.68, .7, .05, M.gold, 12), 0, .63, 0));
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + Math.PI / 6; for (let j = 0; j < 4; j++) deck.add(at(cyl(.025, .045, .1, M.dark, 8), Math.cos(a) * .5 + (j % 2 - .5) * .1, .56, Math.sin(a) * .5 + (j > 1 ? .05 : -.05))); kit.addFlame(Math.cos(a) * .5, .5, Math.sin(a) * .5, 1.6); }
  part('cubierta', 'Cubierta y motores', deck, V3(0, -.3, 0), 'Hermano mayor de Phoenix: la misma familia de módulo con 12 motores de hidracina en tres grupos de cuatro. Debía aterrizar cerca del polo sur, donde nunca había llegado nada.');
  const legs = new THREE.Group(), sens = Mt(0xe84a3a, { emissive: 0x551010 });
  for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i / 3 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), fx = c * 1.05, fz = s * 1.05, f = V3(fx, gy(fx, fz) + .1, fz);
    legs.add(rod(V3(c * .58, .7, s * .58), f, .04, M.alu)); legs.add(at(cyl(.13, .15, .05, M.alu, 14), fx, f.y - .06, fz)); legs.add(at(box(.07, .07, .07, sens), c * .78, .5, s * .78)); }
  part('patas', 'Patas y sensores de contacto', legs, V3(0, -.25, 0), 'En cada pata, un sensor magnético (en rojo) avisaba cuando tocaba el suelo, para apagar los motores. Al desplegarse las patas a 1.500 m, la sacudida hizo «saltar» esos sensores. El programa guardó esa señal falsa y, al llegar a 40 m, la creyó: apagó los motores en el aire.');
  const sol = new THREE.Group(); for (const s of [-1, 1]) { sol.add(at(box(1.05, .025, .8, M.solar), s * 1.25, .95, 0)); sol.add(at(box(1.07, .015, .82, M.gold), s * 1.25, .935, 0)); sol.add(at(box(.35, .02, .5, M.solar), 0, .96, s * .72)); }
  part('solar', 'Paneles solares', sol, V3(0, .4, 0), 'Dos paneles de arseniuro de galio a los lados (3,6 m de punta a punta) y dos auxiliares, para unos 200 W.');
  const ins = new THREE.Group(); ins.add(rod(V3(-.3, .93, -.3), V3(-.3, 1.9, -.3), .025, M.alu)); ins.add(at(box(.2, .11, .12, M.white), -.3, 1.95, -.3)); for (const x of [-.06, .06]) ins.add(at(cyl(.02, .02, .02, M.lens, 10), -.3 + x, 1.95, -.37, Math.PI / 2));
  ins.add(rod(V3(.45, .93, .3), V3(.45, 2.1, .3), .012, M.alu)); ins.add(rod(V3(.2, .93, .45), V3(.2, 1.8, .45), .012, M.alu));
  ins.add(at(box(.15, .1, .12, M.white), .35, .99, -.15)); ins.add(at(cyl(.035, .035, .02, M.lens, 12), .35, 1.05, -.15));
  ins.add(at(cyl(.025, .025, .04, M.dark, 10), -.1, .97, .35)); ins.add(at(box(.4, .1, .16, M.white), .05, .99, .05));
  ins.add(rod(V3(.1, .97, -.6), V3(.4, 1.25, -.95), .03, M.alu)); ins.add(rod(V3(.4, 1.25, -.95), V3(.5, .99, -.6), .025, M.alu)); ins.add(at(box(.1, .06, .1, M.alu), .5, 1.0, -.58));
  part('ciencia', 'Cámaras, brazo, lidar y micrófono', ins, V3(0, .45, -.2), 'Llevaba una cámara estéreo en un mástil, un brazo de 1 m con pala, un horno TEGA como el de Phoenix, mástiles del tiempo, un lidar ruso para ver el polvo y el hielo en el aire y el primer micrófono enviado a Marte, hecho con piezas de audífono. Antes de entrar soltó dos sondas «Deep Space 2» que debían clavarse en el suelo: tampoco se supo de ellas.');
  const T = 22, VS = .5;            // escala vertical de la reconstrucción: 1 m real = 0,5 m en pantalla
  function altAt(tr) { const t1 = 12 / 13; if (tr < t1) return 52 - 13 * tr; const s = tr - t1; return Math.max(0, 40 - 13 * s - 1.855 * s * s); }
  function act(time) {
    const t = time % T, tr = t / 4, alt = altAt(tr), cut = tr > 12 / 13, hit = alt <= 0; kit.reset(); let step;
    if (!hit) { inner.position.set(0, alt * VS, 0); inner.rotation.set(0, 0, 0); kit.flame.position.copy(inner.position); kit.flames.forEach(f => { f.visible = !cut; f.material.opacity = .8 * flick(t); }); }
    else { const tImp = (12 / 13 + 2.31) * 4; inner.position.set(0, -.25, 0); inner.rotation.set(.45, 0, .35); kit.impact(t - tImp, .8, 0); }
    const v = !cut ? 13 : Math.min(21.6, 13 + 3.71 * (tr - 12 / 13));
    step = !cut ? 1 : !hit ? 2 : t < 18 ? 3 : 4; if (t < 1) step = 0;
    return { step, look: Math.max(1, alt * VS * 1.05), kv: [['Altura', hit ? '0 m' : `${alt.toFixed(0)} m`], ['Velocidad', hit ? '—' : `${(v * 3.6).toFixed(0)} km/h`], ['Motores', cut ? 'apagados por la señal falsa' : 'encendidos'], ['Cámara lenta', '×4 · altura a media escala']] };
  }
  function reset() { kit.reset(); inner.position.set(0, 0, 0); inner.rotation.set(0, 0, 0); }
  shadows(g); reset();
  return { group: g, parts, act, reset };
}

// ---------- Schiaparelli (2016): un sensor se saturó un segundo, la computadora creyó estar bajo el suelo y soltó el paracaídas a 3,7 km ----------
function buildSchia(hf) {
  const { g, inner, parts, part, gy, kit } = crashBase(hf);
  const plat = new THREE.Group(); plat.add(at(cyl(.82, .82, .18, Mt(0xcfcac0, { metalness: .4, roughness: .45 }), 36), 0, .55, 0)); plat.add(at(cyl(.84, .84, .02, M.gold, 36), 0, .645, 0));
  plat.add(at(cyl(.8, .7, .3, Mt(0x8a7a52, { metalness: .3, roughness: .8 }), 36), 0, .31, 0));
  part('plataforma', 'Plataforma y base aplastable', plat, V3(0, -.3, 0), 'Un disco de 1,7 m. No tenía patas: por debajo llevaba una estructura que se aplastaba como una lata para aguantar el golpe final, desde unos 2 m de altura. Era una prueba de la ESA para aprender a aterrizar en Marte.');
  const thr = new THREE.Group(); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; for (let j = -1; j <= 1; j++) { const b = a + j * .12; thr.add(at(cyl(.03, .05, .12, M.dark, 10), Math.cos(b) * .68, .5, Math.sin(b) * .68)); } kit.addFlame(Math.cos(a) * .68, .44, Math.sin(a) * .68, 1.8); }
  part('motores', 'Nueve propulsores', thr, V3(0, -.5, .3), 'Tres grupos de tres motores de hidracina. Debían encenderse unos 30 segundos para bajar despacio hasta 2 m del suelo. Solo funcionaron 3 segundos.');
  const top = new THREE.Group(); top.add(rod(V3(.3, .66, .2), V3(.3, 1.2, .2), .015, M.alu)); top.add(at(box(.1, .05, .06, M.white), .3, 1.22, .2)); top.add(rod(V3(.3, 1.05, .2), V3(.5, 1.05, .2), .008, M.alu));
  top.add(at(box(.3, .12, .2, M.gold), -.25, .72, .1)); top.add(at(cyl(.025, .025, .25, M.white, 8), -.4, .79, -.3)); top.add(at(box(.25, .08, .18, M.white), .1, .7, -.35));
  part('dreams', 'Estación DREAMS', top, V3(0, .4, 0), 'La pequeña estación del tiempo DREAMS iba a medir viento, temperatura, presión y, por primera vez, la electricidad del aire en Marte durante unos días, con su batería.');
  const radar = new THREE.Group(); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + .4; radar.add(at(box(.1, .03, .1, M.dark), Math.cos(a) * .35, .15, Math.sin(a) * .35)); }
  part('radar', 'Radar Doppler', radar, V3(0, -.55, -.2), 'Cuatro antenas que miden la altura y la velocidad respecto al suelo con ondas de radio. Funcionaban bien, pero la computadora ya creía otra cosa.');
  // escudo delantero y cubierta trasera (para el despiece y la bajada)
  const shield = new THREE.Group(); const fs = at(new THREE.Mesh(new THREE.ConeGeometry(1.2, .45, 40, 1, true), Mt(0x6b4a2e, { roughness: .9, side: THREE.DoubleSide })), 0, -.05, 0, Math.PI); shield.add(fs);
  const bc = at(new THREE.Mesh(new THREE.CylinderGeometry(.45, 1.2, .7, 40, 1, true), Mt(0xe8e4da, { roughness: .6, side: THREE.DoubleSide })), 0, 1.0, 0); shield.add(bc);
  part('escudo', 'Escudo térmico y cubierta', shield, V3(0, 1.4, 0), 'El escudo de 2,4 m aguantó la entrada a 21.000 km/h. La cubierta de atrás guardaba el paracaídas de 12 m. Las dos se soltaron demasiado pronto, a 3,7 km de altura.');
  const T = 26;
  function act(time) {
    const t = time % T; kit.reset(); let step = 0, look = 2, realAlt, think, spd;
    shield.children[0].visible = false; shield.children[1].visible = true;
    if (t < 6.5) { const y = 22 - t * .3; inner.position.set(Math.sin(t) * .15, y, 0); inner.rotation.set(t > 3 && t < 4 ? Math.sin(t * 30) * .3 : Math.sin(t * 1.4) * .08, 0, 0); kit.chute.visible = true; kit.chute.scale.setScalar(3.2); kit.chute.position.set(inner.position.x, y + 8, 0);
      realAlt = 6.2 - t * .38; think = t < 3.5 ? realAlt : realAlt - (t - 3.5) * 3; spd = 250; step = t < 3 ? 0 : 1; look = y * 1.05; }
    else if (t < 9.5) { const u = t - 6.5, y = 22 - 6.5 * .3 - u * .4; inner.position.set(0, y, 0); inner.rotation.set(0, 0, 0); shield.children[1].visible = false; kit.chute.visible = true; kit.chute.position.set(u * 2.5, 22 + 8 - 6.5 * .3 + u * 1.5, -u); kit.chute.scale.setScalar(3.2);
      kit.flame.position.copy(inner.position); kit.flames.forEach(f => { f.visible = true; f.material.opacity = .85 * flick(t); }); realAlt = 3.7; think = -2.1; spd = 200; step = 2; look = y * 1.05; }
    else { const u = (t - 9.5) / 4.5; shield.children[1].visible = false;
      if (u < 1) { const y = (22 - 6.5 * .3 - 3 * .4) * (1 - u * u); inner.position.set(0, y, 0); realAlt = 3.7 * (1 - u * u); spd = 200 + 340 * u; look = Math.max(1.5, y * 1.05); step = 3; }
      else { inner.visible = false; kit.impact(t - 14, 1.6, 1); realAlt = 0; spd = 540; step = 4; look = 1.5; }
      think = -2.1; }
    if (t >= 14) inner.visible = false; else inner.visible = true;
    return { step, look, kv: [['Altura real', `${realAlt.toFixed(1).replace('.', ',')} km`], ['Altura que creía la computadora', think < 0 ? 'bajo el suelo (¡imposible!)' : `${think.toFixed(1).replace('.', ',')} km`], ['Velocidad', `${Math.round(spd)} km/h`], ['Propulsores', t < 6.5 ? 'apagados' : t < 9.5 ? 'encendidos 3 s (debían ser 30)' : 'apagados']] };
  }
  function reset() { kit.reset(); inner.visible = true; inner.position.set(0, 0, 0); inner.rotation.set(0, 0, 0); shield.children[0].visible = true; shield.children[1].visible = false; }
  shadows(g); reset();
  return { group: g, parts, act, reset };
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
  phx: { name: 'Phoenix', sub: 'Phoenix Mars Lander · NASA/JPL · Universidad de Arizona', build: buildPhoenix, lander: true, mass: '350 kg (664 kg al despegar)', size: '5,5 m de ancho con los paneles · unos 2,2 m de alto', speed: 'no se mueve: es un módulo fijo con un brazo de 2,35 m', speedLabel: 'Movimiento',
    view: { ty: 1.0, cam: [5.2, 3.2, -5.4], drv: [3.6, 2.4, -4.6], back: 6, up: 2.6, max: 9 }, padName: 'Ver el despegue en Cabo Cañaveral',
    act: { title: 'Cavando hasta el hielo', text: 'Un verano polar en 36 segundos: el brazo cava la zanja Dodo‑Goldilocks, destapa hielo y lo lleva al horno. Fíjate en el Sol: da vueltas bajo en el cielo y nunca se pone.',
      steps: ['El brazo se despliega', 'Cava la zanja raspando hacia el módulo', 'Aparece hielo blanco a unos 5 cm', 'Lleva la muestra al horno TEGA, que la calienta', 'El lidar verde ve nieve que cae de las nubes y se evapora en el aire', 'Los terrones de hielo desaparecen en 4 soles: eran hielo de agua'] },
    launch: [['Despegue', '4 de agosto de 2007, 09:26 UTC'], ['Cohete', 'Delta II 7925'], ['Plataforma', 'SLC‑17A, Cabo Cañaveral, Florida'], ['Viaje', '295 días · 680 millones de km'], ['Llegada', '25 de mayo de 2008, 23:38 UTC'], ['Lugar', 'Vastitas Borealis, llanura polar (68,22° N, 234,25° E)'], ['Misión prevista', '90 soles (unos 3 meses)'], ['Estado', 'Terminada: trabajó 157 soles; última señal el 2 de noviembre de 2008. El invierno lo cubrió de hielo seco']],
    edl: [['Entrada', 'a 125 km de altura y unos 20.000 km/h; el escudo térmico se calienta a más de 1.400 °C'], ['Paracaídas', 'a 12,9 km de altura, 7 segundos más tarde de lo previsto'], ['Foto histórica', 'el orbitador MRO lo fotografió desde la órbita colgando de su paracaídas: la primera foto de una nave bajando a otro planeta'], ['Propulsores', 'a 1 km se suelta y 12 motores en pulsos lo frenan; se apagan al tocar'], ['Suelo', 'toca a unos 9 km/h sobre sus tres patas; los chorros dejaron ver hielo bajo el módulo']],
    firsts: ['Primero en tocar y probar hielo de agua en Marte', 'Su bajada en paracaídas fue fotografiada desde la órbita', 'Vio nieve cayendo de las nubes marcianas', 'Descubrió percloratos en el suelo'] },
  insight: { name: 'InSight', sub: 'Interior Exploration using Seismic Investigations · NASA/JPL', build: buildInSight, lander: true, mass: '358 kg (694 kg al despegar)', size: '6 m de ancho con los paneles · cubierta a 1 m del suelo', speed: 'no se mueve: es un módulo fijo con un brazo de 2,4 m', speedLabel: 'Movimiento',
    view: { ty: .8, cam: [4.6, 3.0, -5.2], drv: [3.4, 2.2, -4.2], back: 6, up: 2.6, max: 9 }, padName: 'Ver el despegue en Vandenberg', seismo: true,
    act: { title: 'Escuchando el interior de Marte', text: 'El brazo coloca los instrumentos uno por uno y el sismógrafo escucha: primero el viento, luego los golpes del topo y al final el martemoto más grande medido. En 52 segundos, lo que tomó años.',
      steps: ['La garra toma el sismógrafo SEIS de la cubierta', 'Lo apoya en el suelo (19 de diciembre de 2018)', 'Lo tapa con el escudo WTS (2 de febrero de 2019)', 'Coloca el topo HP³ al otro lado (12 de febrero de 2019)', 'El topo martilla para enterrarse… y se atasca', 'Martemoto S1222a, magnitud 4,7 (4 de mayo de 2022): llegan las ondas P y luego las S, más fuertes'] },
    launch: [['Despegue', '5 de mayo de 2018, 11:05 UTC'], ['Cohete', 'Atlas V 401 (sin propulsores sólidos)'], ['Plataforma', 'SLC‑3E, Base Vandenberg, California: la primera misión a otro planeta lanzada desde la costa oeste'], ['Viaje', '205 días · 485 millones de km, con los CubeSats MarCO A y B al lado'], ['Llegada', '26 de noviembre de 2018, 19:53 UTC'], ['Lugar', 'Elysium Planitia (4,50° N, 135,62° E)'], ['Misión prevista', '1 año marciano (unos 2 años terrestres)'], ['Estado', 'Terminada: trabajó 1.446 soles; último contacto el 15 de diciembre de 2022, cubierto de polvo']],
    edl: [['Entrada', 'a 128 km de altura y 19.800 km/h; el escudo térmico llega a unos 1.500 °C'], ['Paracaídas', 'a unos 12 km de altura y 1.400 km/h'], ['Radar', 'mide la distancia al suelo; se sueltan el escudo y luego el paracaídas'], ['Propulsores', '12 motores lo frenan hasta unos 8 km/h y se apaga al tocar'], ['En vivo', 'los CubeSats MarCO retransmitieron el aterrizaje: en la Tierra supieron que llegó bien en 8 minutos, no horas']],
    firsts: ['Primeros sismos medidos en otro planeta: más de 1.300', 'Midió el núcleo de Marte: líquido, de unos 1.830 km de radio', 'Primer instrumento puesto en el suelo de otro planeta por un brazo', 'Primeros CubeSats en otro planeta (MarCO)'] },
  vk1: { name: 'Viking 1', sub: 'Viking Lander 1 · NASA (Langley y JPL) · hoy «Estación Thomas Mutch»', build: hf => buildViking(hf, 1), lander: true, noSim: true, scan: true, mass: '572 kg en el suelo (con el orbitador: 3.530 kg)', size: '1,5 m de base · unos 2 m de alto con la antena', speed: 'no se mueve: brazo de cinta que se estira 3 m', speedLabel: 'Movimiento',
    view: { ty: .8, cam: [4.4, 2.8, -4.6], drv: [3.2, 2.1, -4.0], back: 6, up: 2.6, max: 9 }, edlTitle: 'Del orbitador al suelo',
    act: { title: 'Buscando vida', text: 'El brazo estira su cinta, cava y echa tierra en los laboratorios. Mientras tanto, la cámara arma su foto línea por línea, como en 1976. Lo que tomó meses pasa en 46 segundos.',
      steps: ['El brazo estira su cinta hasta 3 m y cava una zanja', 'Echa la tierra en el embudo de biología', 'Liberación marcada: sale gas «marcado»… ¿hay algo vivo?', 'Otra muestra va al GCMS: no encuentra moléculas orgánicas', 'El debate sigue hasta hoy'] },
    launch: [['Despegue', '20 de agosto de 1975, 21:22 UTC'], ['Cohete', 'Titan IIIE con etapa Centaur'], ['Plataforma', 'LC‑41, Cabo Cañaveral, Florida'], ['Viaje', '304 días hasta la órbita de Marte (19 de junio de 1976); un mes buscando un lugar seguro'], ['Llegada', '20 de julio de 1976, 11:53 UTC, a las 4 de la tarde en Marte'], ['Lugar', 'Chryse Planitia (22,27° N, 312,05° E)'], ['Misión prevista', '90 días'], ['Estado', 'Terminada: funcionó 6 años y 4 meses (2.245 soles); la señal se perdió el 13 de noviembre de 1982 por un comando equivocado']],
    edl: [['Separación', 'se suelta del orbitador y enciende 12 toberas pequeñas para bajar de la órbita (−180 m/s)'], ['Entrada', 'unas 3 horas después, protegida por un escudo térmico, mide la atmósfera mientras cae'], ['Paracaídas', 'de 16 m, a 6 km de altura y 250 m/s; se suelta el escudo y salen las patas'], ['Motores', 'a 1,5 km, tres motores de 18 toberas encienden 40 segundos'], ['Suelo', 'toca a 2,4 m/s con 22 kg de combustible de sobra; 25 segundos después empieza a sacar la primera foto']],
    firsts: ['Primer aterrizaje en Marte que funcionó por largo tiempo (el Mars 3 soviético, en 1971, transmitió solo unos segundos)', 'Primera foto desde el suelo de Marte: su propia pata', 'Primeros experimentos para buscar vida en otro planeta', 'Funcionó más de 6 años con energía nuclear'] },
  vk2: { name: 'Viking 2', sub: 'Viking Lander 2 · NASA (Langley y JPL) · hoy «Estación Gerald Soffen»', build: hf => buildViking(hf, 2), lander: true, noSim: true, scan: true, mass: '572 kg en el suelo (con el orbitador: 3.530 kg)', size: '1,5 m de base · unos 2 m de alto con la antena', speed: 'no se mueve: brazo de cinta que se estira 3 m', speedLabel: 'Movimiento',
    view: { ty: .8, cam: [4.4, 2.8, -4.6], drv: [3.2, 2.1, -4.0], back: 6, up: 2.6, max: 9 }, edlTitle: 'Del orbitador al suelo',
    act: { title: 'Bajo las rocas y bajo la escarcha', text: 'En Utopia, el brazo empuja una roca para sacar tierra que estaba protegida del Sol, y la lleva a los laboratorios. Al final llega el invierno y aparece escarcha. Lo que tomó años pasa en 46 segundos.',
      steps: ['El brazo empuja una roca a un lado', 'Cava donde estaba la roca y llena el embudo de biología', 'La liberación marcada vuelve a dar gas, igual que en el Viking 1', 'El GCMS tampoco encuentra moléculas orgánicas', 'Llega el invierno: escarcha sobre el suelo'] },
    launch: [['Despegue', '9 de septiembre de 1975, 18:39 UTC'], ['Cohete', 'Titan IIIE con etapa Centaur'], ['Plataforma', 'LC‑41, Cabo Cañaveral, Florida'], ['Viaje', '333 días hasta la órbita de Marte (7 de agosto de 1976)'], ['Llegada', '3 de septiembre de 1976, 22:37 UTC'], ['Lugar', 'Utopia Planitia (47,64° N, 134,29° E), más al norte, en una llanura llena de rocas'], ['Misión prevista', '90 días'], ['Estado', 'Terminada: funcionó 3 años y 7 meses (1.281 soles), hasta que fallaron sus baterías el 11 de abril de 1980']],
    edl: [['Separación', 'se suelta del orbitador y enciende 12 toberas para bajar de la órbita'], ['Entrada', 'escudo térmico y medición de la atmósfera al caer'], ['Paracaídas', 'de 16 m, a 6 km de altura'], ['Motores', 'tres motores de 18 toberas en el último kilómetro y medio'], ['Suelo', 'el radar se confundió con una roca y encendió un propulsor de más: quedó inclinado 8°, con una pata sobre una piedra']],
    firsts: ['Fotografió escarcha de agua sobre el suelo de Marte en invierno', 'Su sismómetro funcionó (el del Viking 1 nunca se destrabó)', 'Movió rocas con su brazo para tomar tierra que estaba debajo', 'Junto con el Viking 1 enviaron más de 4.500 fotos desde el suelo'] },
  mars2: { name: 'Mars 2', sub: 'Mars 2 · URSS · módulo de descenso M‑71', build: hf => buildSoviet(hf, 2), view: { ty: .7, cam: [3.6, 2.3, -3.8], drv: [12, 8, -17], back: 6, up: 2.6, max: 40 }, lander: true, noSim: true, crash: true, speedLabel: 'Estado', edlTitle: 'La llegada', mass: '358 kg la esfera que debía llegar al suelo', size: 'esfera de 1,2 m con cuatro pétalos', speed: 'se estrelló el 27 de noviembre de 1971',
    act: { title: 'El primero en llegar… estrellado', text: 'Reconstrucción: el módulo entra con un ángulo demasiado empinado y el paracaídas no llega a frenarlo. Aun así, fue el primer objeto hecho por humanos que tocó Marte.',
      steps: ['El módulo entra demasiado empinado', 'El paracaídas no alcanza a frenarlo', 'Choque: el primer objeto humano en Marte', 'Nunca envió datos desde el suelo'] },
    launch: [['Despegue', '19 de mayo de 1971, 16:22 UTC'], ['Cohete', 'Protón‑K con etapa Blok D'], ['Plataforma', 'Baikonur (hoy Kazajistán)'], ['Llegada', '27 de noviembre de 1971'], ['Lugar', 'cerca de Hellas (posición aproximada)'], ['Orbitador', 'siguió funcionando y fotografió Marte durante meses'], ['Estado', 'el módulo se estrelló; nunca envió datos']],
    edl: [['Separación', 'el módulo se soltó del orbitador horas antes de llegar'], ['Entrada', 'un error dejó el ángulo de entrada demasiado empinado'], ['Paracaídas', 'no alcanzó a frenarlo a tiempo'], ['Suelo', 'choque a gran velocidad']],
    firsts: ['Primer objeto hecho por humanos que llegó al suelo de Marte', 'Llevaba el primer rover enviado a Marte, el PrOP‑M', 'Su orbitador fue de los primeros en estudiar Marte desde la órbita'] },
  mars3: { name: 'Mars 3', sub: 'Mars 3 · URSS · módulo de descenso M‑71', build: hf => buildSoviet(hf, 3), view: { ty: .7, cam: [3.6, 2.3, -3.8], drv: [12, 8, -17], back: 6, up: 2.6, max: 40 }, lander: true, noSim: true, crash: true, speedLabel: 'Estado', edlTitle: 'La llegada', scan: true, mass: '358 kg la esfera de aterrizaje (1.210 kg con escudo y cohetes)', size: 'esfera de 1,2 m con cuatro pétalos', speed: 'aterrizó y calló a los 20 s',
    act: { title: '20 segundos en Marte', text: 'Reconstrucción: paracaídas, cohete de frenado, pétalos abiertos y la primera señal desde el suelo de Marte… que se cortó a los 20 segundos, en plena tormenta de polvo global.',
      steps: ['Baja en paracaídas en plena tormenta de polvo', 'Un cohete lo frena y se lleva el paracaídas; golpe y pétalos abiertos', 'A los 90 s empieza a mandar una imagen…', 'El rover PrOP‑M debía salir con su cable (nunca se supo si salió)', 'A los 20 s, silencio para siempre'] },
    launch: [['Despegue', '28 de mayo de 1971, 15:26 UTC'], ['Cohete', 'Protón‑K con etapa Blok D'], ['Plataforma', 'Baikonur (hoy Kazajistán)'], ['Llegada', '2 de diciembre de 1971, 13:52 UTC'], ['Lugar', 'cerca del cráter Ptolemaeus (unos 45° S, 202° E)'], ['Duró', 'unos 20 segundos de señal, 90 s después de aterrizar'], ['Estado', 'en 2013 unos aficionados creyeron verlo en fotos de HiRISE; no está confirmado']],
    edl: [['Separación', 'a las 09:14 UTC, 4 h 35 min antes de llegar'], ['Entrada', 'a unos 5,7 km/s, frenado por un escudo cónico de 2,9 m'], ['Paracaídas', 'frena la esfera; luego un cohete la frena más y aparta el paracaídas'], ['Suelo', 'espuma alrededor de la esfera para aguantar el golpe; los pétalos la enderezan']],
    firsts: ['Primer aterrizaje suave en Marte', 'Primera señal enviada desde el suelo de Marte (unos 20 s)', 'Primera imagen desde el suelo, aunque solo 70 líneas grises sin detalles', 'Llevaba el rover PrOP‑M con esquís y un cable de 15 m'] },
  mars6: { name: 'Mars 6', sub: 'Mars 6 · URSS · módulo de descenso M‑73', build: hf => buildSoviet(hf, 6), view: { ty: .7, cam: [3.6, 2.3, -3.8], drv: [12, 8, -17], back: 6, up: 2.6, max: 40 }, lander: true, noSim: true, crash: true, speedLabel: 'Estado', edlTitle: 'La llegada', mass: '635 kg el módulo de descenso', size: 'esfera con cuatro pétalos, como el de Mars 3', speed: 'perdido al aterrizar',
    act: { title: 'Datos al caer', text: 'Reconstrucción: durante 224 segundos envía las primeras mediciones del aire de Marte tomadas mientras bajaba. Justo al encender el cohete de frenado, la señal se corta.',
      steps: ['Baja en paracaídas enviando datos del aire', 'Primeras mediciones de la atmósfera tomadas al bajar', 'Al encender el cohete de frenado, la señal se corta', 'Nunca se supo si llegó entero'] },
    launch: [['Despegue', '5 de agosto de 1973, 17:45 UTC'], ['Cohete', 'Protón‑K con etapa Blok D'], ['Plataforma', 'Baikonur (hoy Kazajistán)'], ['Llegada', '12 de marzo de 1974; entrada a las 09:05:53 UTC'], ['Lugar', 'Margaritifer Terra (23,9° S, 19,4° O)'], ['Señal perdida', '09:11:05 UTC, al ir a encender los cohetes'], ['Estado', 'perdido; un chip defectuoso arruinó buena parte de los datos']],
    edl: [['Separación', 'a unos 48.000 km de Marte'], ['Entrada', 'frena de 5.600 a 600 m/s con su escudo'], ['Paracaídas', 'mientras baja mide temperatura, presión y composición del aire'], ['Cohete', 'debía encenderse en los últimos segundos: ahí se perdió la señal']],
    firsts: ['Primeras mediciones de la atmósfera de Marte tomadas mientras bajaba', '224 segundos de datos durante la bajada', 'Llegó a la superficie, aunque no se sabe en qué estado'] },
  beagle: { name: 'Beagle 2', sub: 'Beagle 2 · Reino Unido / ESA · viajó con Mars Express', build: buildBeagle, view: { ty: .25, cam: [1.7, 1.1, -1.9], drv: [6, 4, -8], back: 6, up: 2.6, max: 40 }, lander: true, noSim: true, crash: true, speedLabel: 'Estado', edlTitle: 'La llegada', mass: 'unos 33 kg en el suelo (69 kg con su sistema de aterrizaje)', size: 'menos de 1 m cerrado, menos de 2 m abierto', speed: 'aterrizó, pero quedó mudo',
    act: { title: 'Casi lo logra', text: 'Reconstrucción de lo que mostraron las fotos de HiRISE en 2015: aterrizó bien, abrió la tapa y algunos paneles, pero el último panel quedó cerrado sobre la antena.',
      steps: ['Rebota envuelto en bolsas de aire', 'Las bolsas se sueltan y queda en el suelo', 'Abre la tapa y los paneles… pero no todos', 'El último panel tapa la antena: silencio', 'En 2015 la cámara HiRISE lo encuentra a 5 km del centro previsto'] },
    launch: [['Despegue', '2 de junio de 2003, con la sonda Mars Express'], ['Cohete', 'Soyuz‑FG con etapa Fregat'], ['Plataforma', 'Baikonur (hoy Kazajistán)'], ['Separación', '19 de diciembre de 2003'], ['Llegada', '25 de diciembre de 2003, Navidad'], ['Lugar', 'Isidis Planitia (11,5° N, 90,4° E)'], ['Estado', 'perdido hasta 2015, cuando HiRISE lo encontró con sus paneles a medio abrir']],
    edl: [['Separación', 'Mars Express lo suelta 6 días antes'], ['Entrada', 'escudo térmico'], ['Paracaídas', 'un paracaídas pequeño y luego el principal'], ['Bolsas de aire', 'rebota envuelto en bolsas, que luego se sueltan'], ['Suelo', 'aterrizó bien: las fotos muestran el paracaídas y la cubierta cerca']],
    firsts: ['Primer módulo británico enviado a otro planeta', 'Encontrado 11 años después en fotos desde la órbita', 'Llevaba un «topo» que se arrastraba para sacar tierra de debajo de las piedras'] },
  mpl: { name: 'Mars Polar Lander', sub: 'Mars Surveyor ’98 · NASA/JPL', build: buildMPL, view: { ty: .7, cam: [3.6, 2.3, -3.8], drv: [12, 8, -17], back: 6, up: 2.6, max: 40 }, lander: true, noSim: true, crash: true, speedLabel: 'Estado', edlTitle: 'La llegada', mass: '290 kg', size: '3,6 m de ancho con los paneles · 1,06 m de alto', speed: 'se estrelló el 3 de diciembre de 1999',
    act: { title: 'Una señal falsa a 40 metros', text: 'Reconstrucción de la causa más probable, según la junta que investigó el fallo: los motores se apagan a 40 m porque el programa cree que las patas ya tocaron el suelo.',
      steps: ['Baja con los motores encendidos', 'A 40 m el programa lee la señal falsa guardada desde 1.500 m', 'Apaga los motores: cae 40 m', 'Choca a unos 80 km/h', 'Phoenix, su hermano, corrigió el programa y aterrizó bien en 2008'] },
    launch: [['Despegue', '3 de enero de 1999, 20:21 UTC'], ['Cohete', 'Delta II 7425'], ['Plataforma', 'SLC‑17B, Cabo Cañaveral, Florida'], ['Llegada', '3 de diciembre de 1999; última señal a las 14:39 UTC, antes de la entrada'], ['Lugar', 'cerca del polo sur (zona prevista, 76,6° S)'], ['Estado', 'perdido; dado por perdido el 17 de enero de 2000']],
    edl: [['Sondas', 'antes de entrar suelta dos sondas Deep Space 2, que también se perdieron'], ['Patas', 'a unos 1.500 m se despliegan; la sacudida da una señal falsa de contacto'], ['Motores', 'encendidos desde 1,3 km a unos 80 m/s'], ['40 m', 'se apaga el radar y se empiezan a leer las patas: el programa cree la señal falsa'], ['Suelo', 'cae 40 m y llega a unos 22 m/s (80 km/h)']],
    firsts: ['Primer intento de aterrizar cerca del polo sur de Marte', 'Llevaba el primer micrófono enviado a Marte', 'Su error enseñó a revisar mejor los programas: Phoenix usó su diseño y aterrizó bien'] },
  schia: { name: 'Schiaparelli', sub: 'ExoMars 2016 · ESA y Roscosmos · módulo de demostración', build: buildSchia, view: { ty: .7, cam: [3.6, 2.3, -3.8], drv: [12, 8, -17], back: 6, up: 2.6, max: 40 }, lander: true, noSim: true, crash: true, speedLabel: 'Estado', edlTitle: 'La llegada', mass: '577 kg', size: '2,4 m con el escudo · 1,7 m la plataforma', speed: 'se estrelló el 19 de octubre de 2016',
    act: { title: 'Creyó que estaba bajo el suelo', text: 'Reconstrucción del informe de la ESA: un sensor de giro se satura un instante, la computadora calcula una altura negativa y corta el paracaídas y los motores a 3,7 km.',
      steps: ['Baja en paracaídas', 'Un sensor de giro se satura un instante y la computadora calcula mal su posición', 'Cree estar bajo el suelo: suelta el paracaídas y enciende los motores solo 3 s', 'Cae libre desde 3,7 km', 'Choca a unos 540 km/h; el orbitador MRO fotografió la mancha'] },
    launch: [['Despegue', '14 de marzo de 2016, con el orbitador TGO'], ['Cohete', 'Protón‑M con etapa Briz‑M'], ['Plataforma', 'Baikonur (hoy Kazajistán)'], ['Separación', '16 de octubre de 2016'], ['Llegada', '19 de octubre de 2016'], ['Lugar', 'Meridiani Planum, cerca de donde trabajó Opportunity'], ['Estado', 'se estrelló; el orbitador TGO sigue funcionando']],
    edl: [['Entrada', 'escudo de 2,4 m; seis minutos de bajada'], ['Paracaídas', 'se abre unos 3 minutos después de entrar'], ['El error', 'el sensor de giro se satura un instante y la navegación queda mal'], ['Corte', 'suelta paracaídas y cubierta, y enciende 3 s en vez de 30'], ['Suelo', 'caída libre desde unos 3,7 km; impacto a unos 540 km/h']],
    firsts: ['Primera prueba europea de aterrizaje en Marte', 'Mandó datos durante casi toda la bajada: por eso se supo qué falló', 'Lo aprendido se usó para el rover europeo Rosalind Franklin'] },
};
export const ROVER_IDS = Object.keys(ROVERS);

// ---------- terreno del recorrido: campo de alturas suave con piedras ----------
function hNoise(x, z) { return Math.sin(x * .9) * Math.cos(z * .7) * .09 + Math.sin(x * 2.3 + z * 1.7) * .035 + Math.sin(x * 5.1 - z * 4.3) * .012 + Math.cos(x * .25 + z * .4) * .18; }
// suelo polar de Phoenix: polígonos de 2 a 3 m que forma el hielo al encogerse y dilatarse cada año (diagrama de Voronoi repetible)
function polygons(x, w, h) {
  const P = []; for (let i = 0; i < 16; i++) P.push([Math.random() * w, Math.random() * h]);
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let a = 1e9, b = 1e9;
    for (const [px, py] of P) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const dd = Math.hypot(i - px - ox * w, j - py - oy * h); if (dd < a) { b = a; a = dd; } else if (dd < b) b = dd; }
    const e = b - a, k = (j * w + i) * 4; if (e < 7) { const f = .74 + e / 7 * .26; d[k] *= f; d[k + 1] *= f; d[k + 2] *= f; } else { const f = 1 + Math.min(.08, (e - 7) / 250); d[k] = Math.min(255, d[k] * f); d[k + 1] = Math.min(255, d[k + 1] * f); d[k + 2] = Math.min(255, d[k + 2] * f); } }
  x.putImageData(img, 0, 0);
}
function makeTerrain(kind) {
  const geo = new THREE.PlaneGeometry(60, 60, 240, 240); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hNoise(p.getX(i), p.getZ(i))); geo.computeVertexNormals();
  const tex = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#b0683e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const r = Math.random(); x.fillStyle = `rgba(${120 + r * 90 | 0},${55 + r * 50 | 0},${28 + r * 30 | 0},.45)`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6); } if (kind === 'phx') polygons(x, w, h); }, kind === 'phx' ? [7, 7] : [14, 14]);
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
      <nav class="rv-tabs" role="tablist"><button data-m="modelo" aria-pressed="true">Modelo</button><button data-m="piezas">Piezas</button><button data-m="recorrido">${R.crash ? 'Qué pasó' : R.lander ? 'En acción' : 'Recorrido'}</button><button data-m="lanzamiento">Lanzamiento y llegada</button></nav>
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
  const terrain = makeTerrain(id); scene.add(terrain);
  if (id === 'merb') { const N = 1500, b = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 8, 6), Mt(0x56575c, { roughness: .45, metalness: .3 }), N), m = new THREE.Matrix4(); for (let i = 0; i < N; i++) { const x = (Math.random() - .5) * 36, z = (Math.random() - .5) * 36, sc = .6 + Math.random() * .8; m.compose(V3(x, hNoise(x, z) + .008, z), new THREE.Quaternion(), V3(sc, sc, sc)); b.setMatrixAt(i, m); } b.castShadow = true; terrain.add(b); }
  const MARKS = 1200, marks = new THREE.InstancedMesh(new THREE.BoxGeometry(.13, .006, .08), Mt(0xf0e8da, { roughness: .9 }), MARKS), mm4 = new THREE.Matrix4(); marks.count = 0; let markN = 0, markAcc = 0; terrain.add(marks);
  const rover = R.build(hNoise); scene.add(rover.group); rover.group.rotation.order = 'YXZ'; for (const w of rover.wheels || []) w.obj.rotation.order = 'YXZ'; let actT = 0, actKv = '', actStep = -1;
  const parts = rover.parts; let mode = 'modelo', explode = 0, selected = null, t0 = performance.now(), dist = 0, running = true;
  const drive = { s: 0, heading: 0, x: 0, z: 0, dust: [] };
  const dustGeo = new THREE.SphereGeometry(.06, 6, 5), dustMat = Mt(0xc9865a, { transparent: true, opacity: .55, roughness: 1 });

  // etiquetas HTML sobre las piezas
  const tags = parts.map(p => { const d = document.createElement('button'); d.className = 'rv-tag'; d.textContent = p.name; d.onclick = () => selectPart(p); labels.appendChild(d); return d; });
  function selectPart(p) { selected = p; renderSide(); tags.forEach((t, i) => t.classList.toggle('sel', parts[i] === p));
    parts.forEach(q => q.obj.traverse(o => { if (!o.isMesh) return; if (o.userData.m0) { o.material = o.userData.m0; o.userData.m0 = null; } if (q === p) { o.userData.m0 = o.material; o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x2f6cff); o.material.emissiveIntensity = .35; } })); }
  function renderSide() {
    if (mode === 'modelo') side.innerHTML = `<div class="kv"><span>Masa</span><b>${R.mass}</b><span>Tamaño</span><b>${R.size}</b><span>${R.speedLabel || 'Velocidad'}</span><b>${R.speed}</b></div><p>Arrastra para girarlo y acércate con la rueda o pellizcando. En <b>Piezas</b> se separa en sus partes; ${R.crash ? 'en <b>Qué pasó</b> ves la reconstrucción de su llegada' : R.lander ? 'en <b>En acción</b> lo ves trabajar con su brazo' : 'en <b>Recorrido</b> lo ves andar'}.</p><ul class="rv-firsts">${R.firsts.map(f => `<li>${f}</li>`).join('')}</ul>`;
    if (mode === 'piezas') side.innerHTML = (selected ? `<h3>${selected.name}</h3><p>${selected.info}</p>` : `<h3>Despiece</h3><p>Mueve el control de abajo para separar las piezas y toca el nombre de cada una para saber qué hace.</p>`) + `<div class="rv-list">${parts.map(p => `<button data-p="${p.id}" ${selected === p ? 'aria-pressed="true"' : ''}>${p.name}</button>`).join('')}</div>`;
    if (mode === 'recorrido' && R.lander) side.innerHTML = `<h3>${R.act.title}</h3><p>${R.act.text}</p>${R.seismo ? '<canvas id="rv-seis" width="560" height="150" aria-label="Sismograma en vivo"></canvas>' : ''}${R.scan ? '<canvas id="rv-scan" width="320" height="200" aria-label="La foto de la cámara, línea por línea"></canvas>' : ''}<div class="kv" id="rv-actkv"></div><ol class="rv-steps">${R.act.steps.map((s, i) => `<li data-step="${i}">${s}</li>`).join('')}</ol>`;
    else if (mode === 'recorrido') side.innerHTML = `<h3>Conduciendo</h3><p>El rover avanza a <b>${R.speed}</b>; aquí lo ves <b>6 veces más rápido</b>. Mira cómo cada rueda sigue el suelo y los balancines se inclinan: ninguna rueda se despega.</p><p>En la realidad recorre unos 100 m en un buen día: los conductores en la Tierra planean la ruta con las fotos del día anterior, y el rover la sigue solo, frenando si ve una piedra o una pendiente peligrosa.</p>${rover.spirit ? '<p><b>Spirit anda en reversa</b>: su rueda delantera derecha se trabó en 2006 y la arrastra. Mira el surco claro que deja: así destapó la sílice de aguas termales.</p>' : id === 'merb' ? '<p>Las bolitas grises del suelo son los «arándanos» de hematita que encontró Opportunity en Meridiani: se formaron dentro de rocas empapadas en agua y quedaron sueltas cuando el viento gastó la roca.</p>' : ''}<div class="kv"><span>Distancia</span><b id="rv-dist">0 m</b><span>Tiempo real equivalente</span><b id="rv-time">0 min</b></div>${R.driveNote ? `<p>${R.driveNote}</p>` : ''}${rover.group.userData.ing ? '<p>Ingenuity vuela alrededor: en Marte voló hasta 24 m de alto y 700 m de distancia en un solo vuelo.</p>' : ''}`;
    if (mode === 'lanzamiento') side.innerHTML = `<h3>Despegue y viaje</h3><div class="kv">${R.launch.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div><h3>${R.edlTitle || 'Los siete minutos de terror'}</h3><div class="kv">${R.edl.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div>${R.noSim ? '' : `<a class="go" href="../cabo-canaveral/marte/#${id}/llegada">Ver la animación del aterrizaje →</a><a class="go alt" href="../cabo-canaveral/marte/#${id}">${R.padName || 'Ver el despegue en Cabo Cañaveral'} →</a>`}`;
    side.querySelectorAll('[data-p]').forEach(b => b.onclick = () => selectPart(parts.find(p => p.id === b.dataset.p)));
  }
  function setMode(m) {
    mode = m; root.querySelectorAll('.rv-tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
    slider.hidden = m !== 'piezas'; labels.hidden = m !== 'piezas'; ctl.autoRotate = m === 'modelo';
    if (m !== 'piezas') { explode = 0; range.value = 0; if (selected) { const q = selected; selected = null; parts.forEach(pp => pp.obj.traverse(o => { if (o.isMesh && o.userData.m0) { o.material = o.userData.m0; o.userData.m0 = null; } })); } tags.forEach(t => t.classList.remove('sel')); }
    if (m === 'piezas' && explode === 0) { range.value = 60; explode = .6; }
    if (m !== 'recorrido') { rover.group.position.set(0, hNoise(0, 0), 0); rover.group.rotation.set(0, 0, 0); if (rover.susp) poseSuspension(0, 0, 0, 0, 0, 0); if (rover.reset) rover.reset(); sun.position.set(6, 9, 4); actT = 0; actKv = ''; actStep = -1; drive.s = 0; drive.x = drive.z = drive.heading = 0; dist = 0; ctl.target.set(0, TY, 0); marks.count = 0; markN = 0; terrain.visible = m !== 'piezas'; scene.fog.near = 14; }
    else { terrain.visible = true; cam.position.set(...VW.drv); }
    hint.textContent = m === 'piezas' ? 'Toca una pieza o su nombre' : m === 'recorrido' ? (R.lander ? 'Arrastra para mirar alrededor' : 'La cámara sigue al rover; arrastra para mirar alrededor') : m === 'modelo' ? 'Arrastra para girar · rueda para acercar' : '';
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
  // --- módulos fijos: el brazo trabaja, se marcan los pasos y se dibuja el sismograma ---
  function stepAct(dt) {
    actT += dt; const r = rover.act(actT, { sun });
    if (r.step !== actStep) { actStep = r.step; side.querySelectorAll('[data-step]').forEach(li => li.classList.toggle('on', +li.dataset.step === actStep)); }
    const kv = r.kv.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join(''); if (kv !== actKv) { actKv = kv; const e = side.querySelector('#rv-actkv'); if (e) e.innerHTML = kv; }
    const cv = rover.seismo && side.querySelector('#rv-seis'); if (cv) { const x = cv.getContext('2d'), { a, i } = rover.seismo(), W = cv.width, Hh = cv.height, n = a.length;
      x.fillStyle = '#0b0d12'; x.fillRect(0, 0, W, Hh); x.strokeStyle = 'rgba(255,255,255,.08)'; x.beginPath(); for (let k = 1; k < 4; k++) { x.moveTo(0, k * Hh / 4); x.lineTo(W, k * Hh / 4); } x.stroke();
      x.strokeStyle = '#7ee0a1'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k < n; k++) { const v = a[(i + k) % n], y = Hh / 2 - Math.max(-1, Math.min(1, v)) * Hh * .45; k ? x.lineTo(k / (n - 1) * W, y) : x.moveTo(0, y); } x.stroke();
      x.fillStyle = 'rgba(255,255,255,.6)'; x.font = '20px system-ui'; x.fillText('SEIS · sismograma', 10, 24); }
    const sc = r.scan && side.querySelector('#rv-scan'); if (sc) drawScan(sc, r.scan);
    const tgt = tmpV.set(r.lookX ?? 0, r.look ?? TY * .75, r.look != null ? 0 : -.9); ctl.target.lerp(tgt, r.look != null ? .15 : .08);
  }
  // cámara de barrido del Viking: se saca la imagen desde la cabeza de la cámara y se revela una columna a la vez, como llegaba en 1976
  const SW = 320, SH = 200, scanRT = new THREE.WebGLRenderTarget(SW, SH), scanCam = new THREE.PerspectiveCamera(46, SW / SH, .03, 300), scanBuf = new Uint8Array(SW * SH * 4); let scanImg = null, scanCycle = -1;
  function drawScan(cv, s) {
    const x = cv.getContext('2d');
    if (s.cycle !== scanCycle || !scanImg) { scanCycle = s.cycle; rover.group.updateMatrixWorld(true);
      scanCam.position.copy(rover.group.localToWorld(s.pos.clone())); scanCam.lookAt(rover.group.localToWorld(s.look.clone()));
      renderer.setRenderTarget(scanRT); renderer.render(scene, scanCam); renderer.readRenderTargetPixels(scanRT, 0, 0, SW, SH, scanBuf); renderer.setRenderTarget(null);
      scanImg = x.createImageData(SW, SH); for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) { const a = ((SH - 1 - j) * SW + i) * 4, b = (j * SW + i) * 4, gr = Math.min(255, (scanBuf[a] * .3 + scanBuf[a + 1] * .59 + scanBuf[a + 2] * .11) * 1.15 + (Math.random() - .5) * 14); scanImg.data[b] = scanImg.data[b + 1] = scanImg.data[b + 2] = gr; scanImg.data[b + 3] = 255; }
      x.fillStyle = '#000'; x.fillRect(0, 0, SW, SH); }
    if (s.noise && !scanImg.noised) { scanImg.noised = true; const dd = scanImg.data; for (let i = 0; i < dd.length; i += 4) { const v = dd[i] * (1 - s.noise) + (118 + (Math.random() - .5) * 40) * s.noise; dd[i] = dd[i + 1] = dd[i + 2] = v; } }
    const c = Math.max(0, Math.min(SW, Math.floor(s.f * SW))); x.putImageData(scanImg, 0, 0, 0, 0, c, SH); x.fillStyle = '#000'; x.fillRect(c, 0, SW - c, SH);
    if (c < SW && !s.lost) { x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(c, 0, 2, SH); }
    if (s.lost) { x.fillStyle = '#ff7a6b'; x.font = 'bold 18px system-ui'; x.fillText('SEÑAL PERDIDA', SW / 2 - 62, SH / 2); }
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, SH - 18, SW, 18); x.fillStyle = '#ddd'; x.font = '12px monospace'; x.fillText(s.noise ? `Telefotómetro · ${Math.round(c / SW * 318)} líneas` : c < SW ? `Cámara 2 · línea ${c} de ${SW}` : 'Cámara 2 · foto completa', 6, SH - 5);
  }
  // --- bucle ---
  let last = performance.now();
  function frame(now) {
    if (!running) return; requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (mode === 'piezas') { for (const p of parts) { p.obj.position.copy(p.home).addScaledVector(p.dir, explode * 1.1); } }
    else for (const p of parts) p.obj.position.copy(p.home);
    if (mode === 'recorrido') { if (rover.act) stepAct(dt); else stepDrive(dt); }
    else { const ing = rover.group.userData.ing; if (ing) { ing.position.set(2.6, 0, -.4); ing.rotation.set(0, 0, 0); ing.userData.rot.forEach((r, i) => r.rotation.y += (i ? 1 : -1) * .5); } }
    if (mode === 'piezas') for (let i = 0; i < parts.length; i++) { const p = parts[i]; const b = new THREE.Box3().setFromObject(p.obj); b.getCenter(tmpV); tmpV.project(cam); const vis = tmpV.z < 1; tags[i].hidden = !vis; tags[i].style.left = (tmpV.x + 1) / 2 * w + 'px'; tags[i].style.top = (1 - tmpV.y) / 2 * h + 'px'; }
    ctl.update(); renderer.render(scene, cam);
  }
  requestAnimationFrame(frame);
  function close() { running = false; renderer.dispose(); root.remove(); UI = null; onClose && onClose(); }
  root.querySelector('.rv-close').onclick = close; const onKey = e => { if (e.key === 'Escape') { removeEventListener('keydown', onKey); close(); } }; addEventListener('keydown', onKey);
  setMode('modelo');
  UI = { close };
  window.__rv = { rover, hNoise, THREE, marks, setAct: t => { actT = t; } };   // para pruebas
  return true;
}
