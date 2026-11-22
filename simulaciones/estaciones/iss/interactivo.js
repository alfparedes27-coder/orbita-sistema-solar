// Partes interactivas del interior: dormitorios a los que se puede entrar, la esclusa Quest para salir a caminar
// al espacio y experimentos que se activan en los laboratorios.
import * as THREE from 'three';
import { canvas, tex, rng } from './tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (k) => k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2;

// ---------- texturas pequeñas ----------
function doorTex(name, ru = false){
  const [c, g] = canvas(256, 400);
  g.fillStyle = ru ? '#e6dfc8' : '#eef0f1'; g.fillRect(0, 0, 256, 400);
  g.strokeStyle = ru ? '#9a8f70' : '#aab1b7'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 388);
  g.fillStyle = ru ? '#c9c0a0' : '#d6dade'; g.fillRect(24, 40, 208, 70);
  g.fillStyle = '#222'; g.font = '600 26px IBM Plex Sans, sans-serif'; g.fillText(name, 36, 86);
  g.fillStyle = '#7a8086'; for (let i = 0; i < 8; i++) g.fillRect(60, 300 + i*9, 136, 4); // rejilla de ventilación
  g.fillStyle = '#3a3f44'; g.fillRect(208, 170, 18, 70); // manija
  if (!ru){ g.fillStyle = '#1b4fa3'; g.beginPath(); g.arc(128, 200, 34, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '700 20px Jost, sans-serif'; g.fillText('ISS', 110, 207); }
  else { g.fillStyle = '#b22'; g.fillRect(70, 170, 116, 40); g.fillStyle = '#fff'; g.font = '600 18px IBM Plex Sans, sans-serif'; g.fillText('КАЮТА', 92, 197); }
  return tex(c);
}
function photoTex(seed){
  const [c, g] = canvas(200, 140), r = rng(seed);
  const sky = g.createLinearGradient(0, 0, 0, 140); sky.addColorStop(0, ['#f6a65a','#6fb1e8','#2b3d6b'][seed % 3]); sky.addColorStop(1, ['#f3d28c','#cfe8f7','#6d5a8c'][seed % 3]);
  g.fillStyle = sky; g.fillRect(0, 0, 200, 140);
  g.fillStyle = ['#3b6b3f','#4d7f5a','#2d3a4f'][seed % 3]; g.beginPath(); g.moveTo(0, 140); for (let x = 0; x <= 200; x += 20) g.lineTo(x, 80 + r()*40); g.lineTo(200, 140); g.fill();
  g.fillStyle = 'rgba(255,240,200,.9)'; g.beginPath(); g.arc(150, 40, 14, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(0, 0, 200, 140);
  return tex(c);
}
function gaugeTex(){
  const [c, g] = canvas(256, 160), t = tex(c);
  t.draw = (kPa, label) => {
    g.fillStyle = '#0b1218'; g.fillRect(0, 0, 256, 160); g.strokeStyle = '#3d4a55'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 156);
    g.fillStyle = '#7fe0a8'; g.font = '500 14px IBM Plex Mono, monospace'; g.fillText('PRESIÓN · ESCLUSA', 14, 26);
    g.fillStyle = kPa < 5 ? '#ff8f5a' : '#e9fff3'; g.font = '600 52px IBM Plex Mono, monospace'; g.fillText(kPa.toFixed(1), 14, 92);
    g.font = '500 18px IBM Plex Mono, monospace'; g.fillText('kPa', 190, 92);
    g.fillStyle = '#1d2a33'; g.fillRect(14, 108, 228, 14); g.fillStyle = kPa < 5 ? '#ff8f5a' : '#7fe0a8'; g.fillRect(14, 108, 228*Math.min(1, kPa/101.3), 14);
    g.fillStyle = '#9fb3c2'; g.font = '500 13px IBM Plex Mono, monospace'; g.fillText(label || '', 14, 145);
    t.needsUpdate = true;
  };
  t.draw(101.3, 'CABINA NORMAL'); return t;
}

// ---------- construcción ----------
// ctx trae piezas internas de buildInterior: M, local, vols, solids, info, HW, FW, RW, apo, laptop, ctb, handrail, holed, hatchRing, ruMat, cqFaces, MOD
export function addInteractive(ctx){
  const { M, local, vols, solids, info, HW, FW, RW, laptop, ctb, handrail, holed, hatchRing, ruMat, MOD } = ctx;
  const acts = [], tweens = [], std = (o) => new THREE.MeshStandardMaterial(o);
  const W = (id, v) => v.clone().applyMatrix4(local[id].mat);           // local → estación
  const mats = {
    cqIn: std({ color:0xe7e4da, roughness:.92, side:THREE.DoubleSide, normalMap:M.fabric.normalMap, normalScale:new THREE.Vector2(.5,.5) }),
    bag: std({ color:0x2e4370, roughness:.85 }), bagRu: std({ color:0x5e6b45, roughness:.9 }), strap: std({ color:0x9aa1a6, roughness:.6 }),
    lamp: std({ color:0xffffff, emissive:0xfff1d6, emissiveIntensity:1.8 }),
    glass: std({ color:0xcfe7ff, roughness:.05, metalness:.1, transparent:true, opacity:.18, side:THREE.DoubleSide, depthWrite:false }),
    water: new THREE.MeshPhysicalMaterial({ color:0x8fd0ff, roughness:.04, metalness:0, transparent:true, opacity:.62, clearcoat:1, envMapIntensity:1.4 }),
    glove: std({ color:0x1b1d1f, roughness:.7 }), leaf: std({ color:0x4f9a3a, roughness:.7, side:THREE.DoubleSide }), leafR: std({ color:0x8a3a4f, roughness:.7, side:THREE.DoubleSide }),
    pink: std({ color:0x331022, emissive:0xff3fb0, emissiveIntensity:0 }), plush: std({ color:0x5aa0e0, roughness:.95 }), ring: std({ color:0xf1c84a, roughness:.8 }),
  };
  // tween genérico: anima k de 0→1 o 1→0
  const anim = (o, dur, fn) => { o.k ??= 0; o.target = o.k > .5 ? 0 : 1; o.dur = dur; o.fn = fn; if (!tweens.includes(o)) tweens.push(o); };

  // ===== 1 · cabinas para dormir de Harmony (detrás de la pared, del tamaño de un rack) =====
  const D = .85; let cqN = 0;
  for (const f of ctx.cqFaces){
    const g = info[f.m], n = f.n, q = f.q, xA = f.xAx, yA = f.yAx, zA = f.zAx, P = f.pos, id = 'cq' + (++cqN);
    // marco con la abertura de la puerta
    const frame = holed(RW, FW, { w:.88, h:1.38, k:.07 }, M.chamfer); frame.quaternion.copy(q); frame.position.copy(P); g.add(frame);
    // paredes acolchadas de la cabina
    const inner = (w, h, pos, nrm, up) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.cqIn); const z = nrm.clone(), x = up.clone().cross(z).normalize();
      p.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z)); p.position.copy(pos); g.add(p); return p; };
    const C = P.clone().addScaledVector(n, D/2);
    inner(.9, 1.42, P.clone().addScaledVector(n, D), n.clone().negate(), yA);                       // fondo
    for (const s of [-1, 1]){ inner(D, 1.42, C.clone().addScaledVector(xA, s*.45), xA.clone().multiplyScalar(-s), yA); // costados
      inner(.9, D, C.clone().addScaledVector(yA, s*.71), yA.clone().multiplyScalar(-s), n); }          // arriba / abajo
    // saco de dormir amarrado al fondo
    const sb = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .95, 6, 16), mats.bag); sb.scale.set(1, 1, .45);
    sb.quaternion.copy(q); sb.position.copy(P).addScaledVector(n, D - .12).addScaledVector(yA, -.05); g.add(sb);
    for (const y of [-.35, .1, .5]){ const st = new THREE.Mesh(new THREE.BoxGeometry(.46, .03, .2), mats.strap); st.quaternion.copy(q); st.position.copy(P).addScaledVector(n, D - .1).addScaledVector(yA, y); g.add(st); }
    // lámpara, laptop, fotos y un muñeco que flota (los astronautas lo usan para ver cuándo empieza la ingravidez)
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(.3, .08), mats.lamp); lamp.quaternion.copy(q); lamp.rotateX(Math.PI/2); lamp.position.copy(C).addScaledVector(yA, .69); g.add(lamp);
    const lt = laptop(); lt.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(n, yA, xA)); lt.position.copy(C).addScaledVector(xA, -.44).addScaledVector(yA, .15); lt.scale.setScalar(.8); g.add(lt);
    for (let k = 0; k < 2; k++){ const ph = new THREE.Mesh(new THREE.PlaneGeometry(.2, .14), std({ map:photoTex(cqN*3 + k), roughness:.5 })); const z = xA.clone().negate(), x = yA.clone().cross(z).normalize();
      ph.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yA, z)); ph.position.copy(C).addScaledVector(xA, .445).addScaledVector(yA, .3 - k*.25); g.add(ph); }
    const plush = new THREE.Group(); const pl = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), mats.plush); plush.add(pl);
    const rg = new THREE.Mesh(new THREE.TorusGeometry(.085, .012, 8, 24), mats.ring); rg.rotation.x = 1.2; plush.add(rg);
    plush.position.copy(C).addScaledVector(yA, .35).addScaledVector(xA, .15); g.add(plush);
    // puerta corrediza
    const door = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.4), std({ map:doorTex('CQ‑' + cqN), roughness:.55, side:THREE.DoubleSide })); door.quaternion.copy(q);
    const d0 = P.clone().addScaledVector(n, .015); door.position.copy(d0); g.add(door);
    const st = { k:0, open:false };
    // volumen recorrible de la cabina (solo con la puerta abierta)
    const F = new THREE.Matrix4().makeBasis(xA, yA, zA).setPosition(P), inv = local[f.m].mat.clone().multiply(F).invert();
    vols.push({ m:f.m, kind:'box', inv, min:V(-.34, -.6, -D + .16), max:V(.34, .6, .45), enabled:() => st.k > .8, cabin:id });
    const cabinWorld = W(f.m, P.clone().addScaledVector(n, .12)), outWorld = W(f.m, P.clone().addScaledVector(n, -.55));
    acts.push({ id, m:f.m, p:outWorld, icon:'🛏️', t:'Cabina para dormir CQ‑' + cqN,
      x:'Cada astronauta tiene su cabina: un espacio del tamaño de una cabina telefónica con saco de dormir amarrado a la pared, una laptop, una lámpara, ventilación propia y fotos de la familia. Se duerme flotando, metido en el saco para no chocar con nada. El muñeco que flota es un «indicador de ingravidez»: cuando empieza a flotar, la nave ya está en órbita.',
      label:() => st.open ? 'Salir y cerrar' : 'Abrir y entrar',
      run(){ st.open = !st.open; anim(st, 1.0, (k) => door.position.copy(d0).addScaledVector(xA, .9*k));
        return st.open ? { fly:cabinWorld, look:W(f.m, P.clone().addScaledVector(n, D).addScaledVector(yA, .15)) } : { fly:outWorld, look:W(f.m, P.clone().addScaledVector(n, -2)), after:true }; } });
    tweens.push({ k:0, target:0, fn:(k, t) => { plush.position.y += Math.sin(t*1.3 + cqN)*.0004; plush.rotation.y += .004; } , always:true });
  }

  // ===== 2 · cabinas rusas (kayutas) en Zvezdá =====
  const zv = MOD.zvezda, gz = info.zvezda;
  for (const s of [-1, 1]){
    const a = ctx.apo(zv, -.5), zIn = s*(a - .75), zOut = s*a, cx = -.5;
    const front = holed(.8, 1.7, { w:.6, h:1.32, k:.05 }, ruMat('wall')); front.rotation.y = s > 0 ? Math.PI : 0; front.position.set(cx, 0, zIn); gz.add(front);
    const side = (x) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(.75, 1.7), ruMat('wall')); p.rotation.y = Math.PI/2; p.position.set(x, 0, (zIn + zOut)/2); gz.add(p); };
    side(cx - .4); side(cx + .4);
    for (const y of [-.85, .85]){ const p = new THREE.Mesh(new THREE.PlaneGeometry(.8, .75), ruMat('wall')); p.rotation.x = Math.PI/2; p.position.set(cx, y, (zIn + zOut)/2); gz.add(p); }
    const sb = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .9, 6, 16), mats.bagRu); sb.scale.set(.45, 1, 1); sb.position.set(cx - .31, -.1, (zIn + zOut)/2 + s*.08); gz.add(sb); // saco de dormir en la pared lateral: la ventanita queda libre
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(.25, .07), mats.lamp); lamp.rotation.x = Math.PI/2; lamp.position.set(cx, .83, (zIn + zOut)/2); gz.add(lamp);
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(.18, .13), std({ map:photoTex(7 + s), roughness:.5 })); ph.rotation.y = -Math.PI/2; ph.position.set(cx + .39, .35, (zIn + zOut)/2); gz.add(ph);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(.62, 1.34), std({ map:doorTex('Каюта ' + (s > 0 ? '1' : '2'), true), roughness:.6, side:THREE.DoubleSide }));
    door.rotation.y = s > 0 ? Math.PI : 0; const d0 = V(cx, 0, zIn + s*.01); door.position.copy(d0); gz.add(door);
    const st = { k:0, open:false };
    const box = { kind:'box', inv:local.zvezda.inv, min:V(cx - .38, -.82, Math.min(zIn, zOut) - .02), max:V(cx + .38, .82, Math.max(zIn, zOut) + .02) };
    solids.push({ ...box, enabled:() => st.k < .8 });
    vols.push({ m:'zvezda', kind:'box', inv:local.zvezda.inv, min:V(cx - .3, -.7, Math.min(zIn, zOut) - .1), max:V(cx + .3, .7, Math.max(zIn, zOut) - .12), enabled:() => st.k > .8 });
    const C = V(cx, 0, (zIn + zOut)/2), out = V(cx, 0, zIn - s*.5);
    acts.push({ id:'kayuta' + (s > 0 ? 1 : 2), m:'zvezda', p:W('zvezda', out), icon:'🛏️', t:'Kayuta ' + (s > 0 ? '1 (estribor)' : '2 (babor)'),
      x:'Las dos cabinas rusas de Zvezdá. Cada una tiene una ventanita redonda: los cosmonautas dicen que lo último que ven antes de dormir es la Tierra pasando. En las primeras expediciones, en 2000, eran las únicas camas de la estación.',
      label:() => st.open ? 'Salir y cerrar' : 'Abrir y entrar',
      run(){ st.open = !st.open; anim(st, 1.0, (k) => door.position.copy(d0).add(V(.66*k, 0, 0)));
        return st.open ? { fly:W('zvezda', C), look:W('zvezda', V(cx, 0, zOut + s)) } : { fly:W('zvezda', out), look:W('zvezda', V(cx, 0, -s*3)), after:true }; } });
  }

  // ===== 3 · Quest: esclusa de tripulación =====
  const gq = info.quest, X0 = .65, X1 = 2.45, RL = .85, xm = (X0 + X1)/2;
  const lockMat = std({ color:0xd6d9dc, roughness:.55, metalness:.25, side:THREE.BackSide, normalMap:M.fabric.normalMap, normalScale:new THREE.Vector2(.25,.25) });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(RL, RL, X1 - X0, 28, 1, true), lockMat); shell.rotation.z = Math.PI/2; shell.position.x = xm; gq.add(shell);
  for (const x of [X0 + .3, X1 - .3]){ const rr = new THREE.Mesh(new THREE.TorusGeometry(RL - .02, .03, 8, 32), M.ring); rr.rotation.y = Math.PI/2; rr.position.x = x; gq.add(rr); }
  // tapa exterior con la escotilla al vacío (1 m)
  const capS = new THREE.Shape(); capS.absarc(0, 0, RL + .02, 0, Math.PI*2, false); const hp = new THREE.Path(); hp.absarc(0, 0, .5, 0, Math.PI*2, true); capS.holes.push(hp);
  const cap = new THREE.Mesh(new THREE.ShapeGeometry(capS, 40), std({ color:0xb5babf, roughness:.4, metalness:.6, side:THREE.DoubleSide })); cap.rotation.y = -Math.PI/2; cap.position.x = X1; gq.add(cap);
  const outerRing = hatchRing({ r:.5 }, M.ring); outerRing.rotation.y = -Math.PI/2; outerRing.position.x = X1 - .02; gq.add(outerRing);
  const outerHinge = new THREE.Group(); outerHinge.position.set(X1 + .02, .5, 0); gq.add(outerHinge);
  const outerDoor = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .08, 32), std({ color:0xd0d4d8, roughness:.35, metalness:.7 })); outerDoor.rotation.z = Math.PI/2; outerDoor.position.set(.04, -.5, 0); outerHinge.add(outerDoor);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(.16, .025, 8, 24), M.dark); wheel.rotation.y = Math.PI/2; wheel.position.set(-.02, -.5, 0); outerHinge.add(wheel);
  // escotilla interior (entre la esclusa de equipos y la de tripulación)
  const innerHinge = new THREE.Group(); innerHinge.position.set(X0 - .02, 0, .47); gq.add(innerHinge);
  const innerDoor = new THREE.Mesh(new THREE.BoxGeometry(.05, .92, .92), std({ color:0xc9ced2, roughness:.4, metalness:.6 })); innerDoor.position.set(0, 0, -.46); innerHinge.add(innerDoor);
  const ih = new THREE.Mesh(new THREE.TorusGeometry(.12, .02, 6, 20), M.dark); ih.rotation.y = Math.PI/2; ih.position.set(-.04, 0, -.46); innerHinge.add(ih);
  // panel de presión, paneles de umbilicales (UIA) con mangueras, pasamanos y luz
  const gt = gaugeTex(); const gauge = new THREE.Mesh(new THREE.PlaneGeometry(.42, .26), std({ map:gt, emissiveMap:gt, emissive:0xffffff, emissiveIntensity:1, roughness:.3 }));
  gauge.position.set(xm - .3, .25, -RL + .06); gq.add(gauge);
  const uia = new THREE.Mesh(new THREE.BoxGeometry(.5, .35, .1), M.dark); uia.position.set(xm + .25, -.25, -RL + .08); gq.add(uia);
  for (let k = 0; k < 2; k++){ const c = new THREE.CatmullRomCurve3([V(xm + .1 + k*.2, -.3, -RL + .12), V(xm + .1 + k*.2, -.55, -.4), V(xm - .2 + k*.25, -.6, .1)]); gq.add(new THREE.Mesh(new THREE.TubeGeometry(c, 20, .025, 8), k ? M.blue : M.cable[1])); }
  for (const a of [.6, 2.2, 3.8, 5.4]){ const h = handrail(.9); h.position.set(xm, Math.cos(a)*(RL - .08), Math.sin(a)*(RL - .08)); h.rotation.x = -a; gq.add(h); }
  const ll = new THREE.Mesh(new THREE.PlaneGeometry(.8, .12), mats.lamp); ll.position.set(xm, RL - .04, 0); ll.rotation.x = Math.PI/2; gq.add(ll);
  const lockState = { inner:{ k:0 }, outer:{ k:0 }, kPa:101.3 };
  vols.push({ m:'quest', kind:'cyl', inv:local.quest.inv, x0:.2, x1:X1 - .25, r:.55, enabled:() => lockState.inner.k > .8 || lockState.inLock });
  const quest = {
    lockCenter:W('quest', V(xm, 0, 0)), lockLook:W('quest', V(X1 + 2, 0, 0)), eqCenter:W('quest', V(-.6, 0, 0)), backLook:W('quest', V(-3, 0, 0)),
    hatchOut:W('quest', V(X1 + .7, 0, 0)), hatchDir:W('quest', V(1, 0, 0)).sub(W('quest', V(0, 0, 0))).normalize(), state:lockState,
    inner(open){ const o = lockState.inner; if ((o.k > .5) === open) return; anim(o, 1.6, (k) => innerHinge.rotation.y = -1.75*ease(k)); },
    outer(open){ const o = lockState.outer; if ((o.k > .5) === open) return; anim(o, 2.2, (k) => outerHinge.rotation.z = -1.9*ease(k)); },
    press(kPa, label){ lockState.kPa = kPa; gt.draw(kPa, label); },
    suit(visible){ ctx.suits && ctx.suits[0] && (ctx.suits[0].visible = visible); },
  };
  acts.push({ id:'eva', m:'quest', p:W('quest', V(-.2, .3, .3)), icon:'👨‍🚀', t:'Salir a caminar al espacio',
    x:'Quest tiene dos partes: la esclusa de equipos, donde se guardan y se ponen los trajes, y la esclusa de tripulación, donde entran dos astronautas, se cierra la escotilla y se saca el aire. Sigue los pasos para salir tú.',
    label:() => 'Empezar la caminata', run:() => ({ special:'eva' }) });

  // ===== 4 · laboratorios =====
  // Destiny: guantera de ciencia (MSG) con una esfera de agua que flota
  const gd = info.destiny, gx = -1.91, gzW = -HW;
  const gb = new THREE.Group(); gb.position.set(gx, .05, gzW + .3); gd.add(gb);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.95, .62, .58), std({ color:0xd9dde0, roughness:.5, metalness:.2 })); body.position.z = -.02; gb.add(body);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(.8, .45), mats.glass); win.position.set(0, .03, .275); gb.add(win);
  body.material = [std({ color:0xd9dde0, roughness:.5 }), std({ color:0xd9dde0, roughness:.5 }), std({ color:0xd9dde0, roughness:.5 }), std({ color:0xd9dde0, roughness:.5 }), mats.glass, std({ color:0x9aa0a5, roughness:.6, side:THREE.BackSide })];
  for (const s of [-1, 1]){ const port = new THREE.Mesh(new THREE.TorusGeometry(.075, .02, 8, 20), M.dark); port.position.set(s*.22, -.12, .28); gb.add(port);
    const glove = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .3, 14), mats.glove); glove.rotation.x = Math.PI/2; glove.position.set(s*.22, -.12, .13); gb.add(glove); }
  const inLight = new THREE.Mesh(new THREE.PlaneGeometry(.6, .05), mats.lamp); inLight.position.set(0, .29, 0); inLight.rotation.x = Math.PI/2; gb.add(inLight);
  const drop = new THREE.Mesh(new THREE.SphereGeometry(.07, 32, 24), mats.water.clone()); drop.position.set(0, .02, 0); drop.scale.setScalar(.15); gb.add(drop);
  const bub = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 10), std({ color:0xffffff, roughness:.1, transparent:true, opacity:.7 })); drop.add(bub); bub.position.set(.02, .01, .01);
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .25, 6), M.alu); needle.rotation.z = Math.PI/2; needle.position.set(-.21, .02, 0); gb.add(needle);
  const msg = { k:0, t0:0, on:false };
  acts.push({ id:'msg', m:'destiny', p:W('destiny', V(gx, .05, gzW + .75)), icon:'💧', t:'Guantera de ciencia: agua sin gravedad',
    x:'Dentro de esta caja sellada los astronautas trabajan con las manos metidas en los guantes, así nada se escapa al aire de la estación. Al soltar agua, no cae: la tensión superficial la junta en una esfera que tiembla como gelatina. Después se le pone una gota de colorante y se ve cómo se mezcla solo por difusión, sin que nada lo revuelva.',
    label:() => msg.on ? 'Repetir' : 'Soltar el agua',
    run(){ msg.on = true; msg.t0 = performance.now()/1000; return { fly:W('destiny', V(gx, .15, gzW + 1.3)), look:W('destiny', V(gx, .02, gzW)) }; } });
  tweens.push({ always:true, fn:(k, t) => {
    if (!msg.on){ drop.visible = false; return; } drop.visible = true;
    const e = t - msg.t0, grow = Math.min(1, e/3), wob = Math.sin(e*7)*.12*Math.exp(-e*.25) * grow;
    drop.scale.set(.15 + .85*grow + wob, .15 + .85*grow - wob, .15 + .85*grow + wob*.5);
    drop.position.x = .02*Math.sin(e*.6); drop.rotation.y += .01;
    const dye = Math.max(0, Math.min(1, (e - 5)/8)); drop.material.color.setRGB(.56 + .4*dye, .82 - .55*dye, 1 - .5*dye);
    needle.position.x = -.21 + (e < 3 ? .06*Math.sin(e/3*Math.PI) : 0); } });
  // Destiny: mirar por la ventana de ciencia
  acts.push({ id:'ventana', m:'destiny', p:W('destiny', V(.21, -.55, 0)), icon:'📷', t:'Mirar por la ventana de ciencia',
    x:'La ventana de 51 cm de Destiny es la de mejor calidad óptica de la estación. Desde aquí se fotografía la Tierra para la ciencia. Lo que ves abajo es el lugar real por donde está pasando la estación ahora mismo.',
    label:() => 'Asomarse', run:() => ({ fly:W('destiny', V(.21, -.62, 0)), look:W('destiny', V(.21, -5, .05)), special:'window' }) });
  // Columbus: huerto Veggie con luces rojas y azules
  const gc = info.columbus, vg = new THREE.Group(); vg.position.set(.3, .1, -HW + .3); gc.add(vg);
  const vb = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, .42), std({ color:0xe9ecee, roughness:.5 })); vb.position.set(0, .2, 0); vg.add(vb);
  const bell = new THREE.Mesh(new THREE.BoxGeometry(.46, .42, .4), std({ color:0xffffff, roughness:.1, transparent:true, opacity:.18, side:THREE.DoubleSide, depthWrite:false })); bell.position.set(0, -.25, 0); vg.add(bell);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(.42, .36), mats.pink); led.rotation.x = Math.PI/2; led.position.set(0, -.04, 0); vg.add(led);
  const pinkLight = new THREE.PointLight(0xff4fc0, 0, 1.4, 2); pinkLight.position.set(0, -.15, .1); vg.add(pinkLight);
  const plants = [];
  for (let i = 0; i < 6; i++){ const p = new THREE.Group(); const pillow = new THREE.Mesh(new THREE.BoxGeometry(.1, .05, .1), std({ color:0xcfc4a8, roughness:.95 })); p.add(pillow);
    const R = rng(50 + i); for (let k = 0; k < 7; k++){ const lf = new THREE.Mesh(new THREE.CircleGeometry(.035 + R()*.02, 8), k % 3 ? mats.leaf : mats.leafR); lf.scale.set(1, 1.6, 1);
      lf.position.set((R()-.5)*.04, .04 + R()*.05, (R()-.5)*.04); lf.rotation.set(-.8 - R()*.6, R()*6.3, (R()-.5)*.6); p.add(lf); }
    p.position.set(-.15 + (i % 3)*.15, -.43, -.08 + Math.floor(i/3)*.16); p.userData.leaves = p.children.slice(1); p.userData.leaves.forEach(l => l.scale.multiplyScalar(.15)); vg.add(p); plants.push(p); }
  const veg = { on:false, t0:0 };
  acts.push({ id:'veggie', m:'columbus', p:W('columbus', V(.3, -.1, -HW + .75)), icon:'🌱', t:'Huerto espacial Veggie',
    x:'En Veggie los astronautas cultivan lechugas, repollo chino, mostaza y hasta flores de zinnia. Las plantas crecen en «almohadas» con tierra y abono, bajo luces LED rojas y azules: son los colores que más usan las hojas para la fotosíntesis, por eso todo se ve rosado. En agosto de 2015 los astronautas comieron por primera vez una lechuga cultivada en el espacio. Aquí ves cerca de un mes de crecimiento en 10 segundos.',
    label:() => veg.on ? 'Volver a sembrar' : 'Encender las luces',
    run(){ veg.on = true; veg.t0 = performance.now()/1000; return { fly:W('columbus', V(.3, -.15, -HW + .95)), look:W('columbus', V(.3, -.3, -HW)) }; } });
  tweens.push({ always:true, fn:(k, t) => {
    const e = veg.on ? t - veg.t0 : 0, light = veg.on ? Math.min(1, e/1.2) : 0, grow = veg.on ? Math.min(1, Math.max(0, (e - 1)/10)) : 0;
    mats.pink.emissiveIntensity = 2.2*light; pinkLight.intensity = 2.5*light;
    for (const p of plants) for (const l of p.userData.leaves){ l.scale.setScalar(.15 + 1.6*grow); l.scale.y *= 1.6; } } });
  // Kibō: soltar CubeSats por la esclusa de experimentos
  const kh = ctx.half(MOD.kibo);
  acts.push({ id:'cubesat', m:'kibo', p:W('kibo', V(kh - .45, -.35, 0)), icon:'🛰️', t:'Lanzar pequeños satélites (CubeSats)',
    x:'Por esta esclusa pasan los CubeSats: satélites del tamaño de una caja de zapatos que hacen universidades y empresas de todo el mundo. El brazo robótico japonés toma el lanzador, lo apunta hacia atrás y hacia abajo, y unos resortes los empujan suavemente. Desde aquí han salido cientos. El primer satélite del Ecuador, el Pegaso, también era un CubeSat, pero salió en 2013 en un cohete chino.',
    label:() => 'Lanzar', run:() => ({ special:'cubesat' }) });

  const update = (t, dt) => {
    for (const o of tweens){
      if (o.always){ o.fn(0, t); continue; }
      if (o.k === o.target) continue;
      o.k = o.target > o.k ? Math.min(o.target, o.k + dt/o.dur) : Math.max(o.target, o.k - dt/o.dur); o.fn(o.k, t);
    }
  };
  return { acts, update, quest };
}
