// Código común de las tres cabinas (Dragon, Soyuz, Starliner): texturas y materiales procedurales, partículas de las
// llamas, dibujo de las pantallas, audio, cámara y controles. Cada cabina conserva sólo su nave, su interior, su misión y sus pasos.
// Generado a partir de las tres páginas originales; las tres lo importan.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const EARTH_DAY='../../tex/tierra-dia.webp', EARTH_NIGHT='../../tex/tierra-noche.webp', EARTH_SPEC='../../tex/tierra-brillo.webp', EARTH_CLOUDS='../../tex/nubes.webp', MOON_URI='../../tex/luna.webp', WATER_URI='../../tex/agua.webp';
const $=s=>document.querySelector(s);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const D2R=Math.PI/180;
const FD='"Jost","Futura","Century Gothic",sans-serif';
const FM='"IBM Plex Mono",ui-monospace,Menlo,monospace';
const RE=6371, RM=1737.4, DM=384400, MU_E=398600.4418, MU_M=4902.8;
const TAGTXT={real:'Dato confirmado',simp:'Simplificado',hipo:'Hipotético'};
const canvas=$('#gl');
const MOBILE=matchMedia('(pointer:coarse)').matches||Math.min(innerWidth,innerHeight)<600;
const Q={high:!MOBILE};
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'}); }
catch(e){ $('#loading').textContent='Tu navegador no pudo iniciar WebGL. Prueba con Chrome, Edge o Safari actualizados.'; throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,Q.high?2:1.25));
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
RectAreaLightUniformsLib.init();
const pmrem=new THREE.PMREMGenerator(renderer);
const ground=new THREE.Scene();
const far=new THREE.Scene();
const near=new THREE.Scene();
const gcam=new THREE.PerspectiveCamera(45,1,0.5,4e5);
const cam=new THREE.PerspectiveCamera(70,1,0.02,3000);
const ecam=new THREE.PerspectiveCamera(50,1,0.1,5000);
const fcam=new THREE.PerspectiveCamera(70,1,2000,5e10);
const composer=new EffectComposer(renderer);
const rpGround=new RenderPass(ground,gcam);
const rpFar=new RenderPass(far,fcam);
const rpNear=new RenderPass(near,cam);
rpNear.clear=false;
rpNear.clearDepth=true;
const bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.3,.55,.92);
const outPass=new OutputPass();
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0},grain:{value:.03},vig:{value:.3}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float time,grain,vig;varying vec2 vUv;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;c.rgb*=1.-vig*smoothstep(.3,.95,length(d*vec2(1.,.8))*1.3);
  c.rgb+=(h(vUv*vec2(1733.,977.)+fract(time*7.))-.5)*grain;gl_FragColor=c;}`});
[rpGround,rpFar,rpNear,bloom,outPass,grade].forEach(p=>composer.addPass(p));
const texLoader=new THREE.TextureLoader();
function img(uri,srgb=true){const t=texLoader.load(uri);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function canvasTex(w,h,draw,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
function vnoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),u),lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);}
function fbm(x,y,o=4){let a=0,f=1,s=.5;for(let i=0;i<o;i++){a+=vnoise(x*f,y*f)*s;f*=2;s*=.5;}return a;}
function normalTex(w,h,hf,str=2,rep=[1,1]){
  const H=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)H[y*w+x]=hf(x,y);
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),im=ctx.createImageData(w,h),d=im.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const l=H[y*w+(x-1+w)%w],r=H[y*w+(x+1)%w],u=H[((y-1+h)%h)*w+x],b=H[((y+1)%h)*w+x];
    let nx=(l-r)*str,ny=(b-u)*str,nz=1;const n=Math.hypot(nx,ny,nz);const i=(y*w+x)*4;d[i]=(nx/n*.5+.5)*255;d[i+1]=(ny/n*.5+.5)*255;d[i+2]=(nz/n*.5+.5)*255;d[i+3]=255;}
  ctx.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...rep);t.anisotropy=8;return t;
}
const glowTex=canvasTex(128,128,(x)=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.2,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);});
const puffTex=canvasTex(128,128,(x)=>{x.clearRect(0,0,128,128);for(let i=0;i<70;i++){const a=Math.random()*6.28,r=Math.random()*34,cx=64+Math.cos(a)*r,cy=64+Math.sin(a)*r,rad=14+Math.random()*22;const g=x.createRadialGradient(cx,cy,0,cx,cy,rad);g.addColorStop(0,'rgba(255,255,255,.16)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}});
function hullTex(lines,seed=1){return canvasTex(512,1024,(x,w,h)=>{x.fillStyle='#f3f4f5';x.fillRect(0,0,w,h);
  for(let i=0;i<1400;i++){x.fillStyle=`rgba(${120+Math.random()*60|0},${120+Math.random()*60|0},${130+Math.random()*60|0},${Math.random()*.035})`;x.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*30,1+Math.random()*3);}
  x.strokeStyle='rgba(90,95,105,.32)';x.lineWidth=2;for(let i=1;i<lines;i++){const y=i*h/lines;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();}
  x.strokeStyle='rgba(90,95,105,.18)';x.beginPath();x.moveTo(w*.25,0);x.lineTo(w*.25,h);x.stroke();});}
const MW=new THREE.MeshPhysicalMaterial({map:hullTex(14),roughness:.38,metalness:0,clearcoat:.35,clearcoatRoughness:.35});
const MWdragon=new THREE.MeshPhysicalMaterial({map:hullTex(5),roughness:.33,metalness:0,clearcoat:.5,clearcoatRoughness:.25});
const carbonCol=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#16171a';x.fillRect(0,0,w,h);const s=16;for(let j=0;j<h/s;j++)for(let i=0;i<w/s;i++){const g=x.createLinearGradient(i*s,j*s,(i+1)*s,(j+1)*s);const on=(i+j)%2;g.addColorStop(0,on?'#26282d':'#121316');g.addColorStop(1,on?'#1a1c20':'#202227');x.fillStyle=g;x.fillRect(i*s,j*s,s,s);}});
carbonCol.wrapS=carbonCol.wrapT=THREE.RepeatWrapping;
carbonCol.repeat.set(6,6);
const MK=new THREE.MeshPhysicalMaterial({map:carbonCol,color:0xffffff,roughness:.45,metalness:.1,clearcoat:.6,clearcoatRoughness:.3});
const MG=new THREE.MeshStandardMaterial({color:0x4a4f57,roughness:.38,metalness:.85});
const MTi=new THREE.MeshStandardMaterial({color:0x6d6f73,roughness:.55,metalness:.8});
const solarTex=canvasTex(1024,256,(x,w,h)=>{x.fillStyle='#f1f2f3';x.fillRect(0,0,w,h);x.fillStyle='#0d1730';x.fillRect(0,0,w/2,h);
  for(let i=0;i<32;i++)for(let j=0;j<8;j++){x.fillStyle=`rgb(${18+Math.random()*10|0},${30+Math.random()*14|0},${66+Math.random()*24|0})`;x.fillRect(i*16+1,j*32+1,14,30);}
  x.strokeStyle='rgba(180,190,210,.35)';x.lineWidth=1;for(let i=0;i<=32;i++){x.beginPath();x.moveTo(i*16,0);x.lineTo(i*16,h);x.stroke();}});
const MTrunk=new THREE.MeshPhysicalMaterial({map:solarTex,roughness:.3,metalness:.25,clearcoat:.6});
function lathe(pts,seg=48){return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg);}
const CAP_PROF=[[2.02,-2.0],[1.99,-1.75],[1.9,-1.2],[1.74,-.5],[1.52,.3],[1.28,1.1],[1.08,1.7],[.99,2.0],[.72,2.02]];
function capR(y){for(let i=1;i<CAP_PROF.length;i++){if(y<=CAP_PROF[i][1]){const a=CAP_PROF[i-1],b=CAP_PROF[i],u=(y-a[1])/(b[1]-a[1]);return lerp(a[0],b[0],u);}}return .99;}
function buildDragon(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(lathe(CAP_PROF,72),MWdragon); g.add(body);
  const shield=new THREE.Mesh(lathe([[0,-2.42],[.9,-2.38],[1.6,-2.25],[1.98,-2.07],[2.03,-2.0]],72),new THREE.MeshStandardMaterial({color:0x2b2724,roughness:.95,side:THREE.DoubleSide}));g.add(shield);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.0,.03,8,96),MG);ring.rotation.x=Math.PI/2;ring.position.y=-2.0;g.add(ring);
  const port=new THREE.Mesh(new THREE.CylinderGeometry(.66,.7,.16,40),MG);port.position.y=2.08;g.add(port);
  const glass=new THREE.MeshPhysicalMaterial({color:0x05070c,roughness:.05,metalness:.2,clearcoat:1});
  for(let i=0;i<4;i++){const a=i*Math.PI/2+.62,y=.35,r=capR(y)+.005;const p=new THREE.Vector3(Math.sin(a)*r,y,Math.cos(a)*r);
    const n=new THREE.Vector3(Math.sin(a),.28,Math.cos(a)).normalize();
    const w=new THREE.Mesh(new THREE.CircleGeometry(.19,24),glass);w.position.copy(p);w.lookAt(p.clone().add(n));g.add(w);
    const f=new THREE.Mesh(new THREE.TorusGeometry(.2,.022,8,32),MG);f.position.copy(p);f.lookAt(p.clone().add(n));g.add(f);}
  const podMat=MWdragon, nzMat=new THREE.MeshStandardMaterial({color:0x2e3036,roughness:.4,metalness:.7});
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,y=-1.05,r=capR(y)+.12;const pod=new THREE.Group();pod.position.set(Math.sin(a)*r,y,Math.cos(a)*r);pod.rotation.y=a;pod.rotation.x=.18;g.add(pod);
    pod.add(new THREE.Mesh(new RoundedBoxGeometry(.66,1.05,.3,3,.08),podMat));
    for(const sx of[-.16,.16]){const nz=new THREE.Mesh(lathe([[.07,0],[.09,-.05],[.13,-.16]],16),nzMat);nz.position.set(sx,-.5,.06);pod.add(nz);}}
  const hinge=new THREE.Group();hinge.position.set(0,2.02,.99);g.add(hinge);
  const nose=new THREE.Mesh(lathe([[.99,0],[.97,.25],[.88,.5],[.68,.74],[.38,.9],[0,.96]],64),MWdragon);nose.position.set(0,0,-.99);hinge.add(nose);
  g.userData.hinge=hinge;
  return g;
}
function buildTrunk(){const t=new THREE.Mesh(new THREE.CylinderGeometry(1.98,1.98,2.8,72),MTrunk);t.position.y=-2.42-1.4;return t;}
const gSun=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-3.2),THREE.MathUtils.degToRad(-104));
const SKY={turbidity:4.5,rayleigh:2.8,mie:.006,mieG:.84};
function makeSky(scale){const s=new Sky();s.scale.setScalar(scale);const u=s.material.uniforms;u.turbidity.value=SKY.turbidity;u.rayleigh.value=SKY.rayleigh;u.mieCoefficient.value=SKY.mie;u.mieDirectionalG.value=SKY.mieG;u.sunPosition.value.copy(gSun);return s;}
const skyG=makeSky(3e5);
ground.add(skyG);
{ const es=new THREE.Scene(); es.add(makeSky(1000)); ground.environment=pmrem.fromScene(es,0,.1,3000).texture; }
const hemiG=new THREE.HemisphereLight(0x8aa2d4,0x2a2218,.35);
ground.add(hemiG);
const sunG=new THREE.DirectionalLight(0xffb07a,2.4);
// Cada sitio fija su hora y su atmósfera: elevación y acimut del Sol, turbidez (humedad), color e intensidad de la luz, cielo y suelo del hemisferio.
function setPadSky({elev=3.2,az=-104,turbidity=4.5,rayleigh=2.8,mie=.006,sun=0xffb07a,intensity=2.4,hemiSky=0x8aa2d4,hemiGround=0x2a2218,hemi=.35}={}){
  gSun.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-elev),THREE.MathUtils.degToRad(az));
  Object.assign(SKY,{turbidity,rayleigh,mie});
  const u=skyG.material.uniforms;u.turbidity.value=turbidity;u.rayleigh.value=rayleigh;u.mieCoefficient.value=mie;u.sunPosition.value.copy(gSun);
  const es=new THREE.Scene(); es.add(makeSky(1000)); if(ground.environment) ground.environment.dispose(); ground.environment=pmrem.fromScene(es,0,.1,3000).texture;
  sunG.color.set(sun); sunG.intensity=intensity; sunG.position.copy(gSun).multiplyScalar(600);
  hemiG.color.set(hemiSky); hemiG.groundColor.set(hemiGround); hemiG.intensity=hemi;
}
sunG.position.copy(gSun).multiplyScalar(600);
sunG.target.position.set(0,0,0);
ground.add(sunG,sunG.target);
sunG.castShadow=true;
Object.assign(sunG.shadow.camera,{left:-70,right:70,top:90,bottom:-30,near:10,far:1600});
sunG.shadow.mapSize.set(Q.high?2048:1024,Q.high?2048:1024);
sunG.shadow.bias=-.0004;
sunG.shadow.normalBias=.04;
const steel=new THREE.MeshStandardMaterial({color:0x8a9097,roughness:.55,metalness:.75});
const beacon=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:new THREE.Color(6,.6,.3),blending:THREE.AdditiveBlending,depthWrite:false}));
ground.add(beacon);
const armPivot=new THREE.Group();
ground.add(armPivot);
const pick=[];
const fh=new THREE.Group();
ground.add(fh);
const stage1=new THREE.Group();
fh.add(stage1);
const upper=new THREE.Group();
fh.add(upper);
function plumeMat(core,edge,power=1){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  uniforms:{time:{value:0},power:{value:power},cCore:{value:new THREE.Color(core)},cEdge:{value:new THREE.Color(edge)}},
  vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
  fragmentShader:`uniform float time,power;uniform vec3 cCore,cEdge;varying vec2 vUv;varying vec3 vN;varying vec3 vV;
  float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  void main(){float a=1.-vUv.y;float e=pow(abs(dot(normalize(vN),normalize(vV))),1.4);
   float n=h(floor(vec2(vUv.x*28.,a*26.-time*24.)));float diam=.75+.25*sin(a*60.-time*3.);
   vec3 col=mix(cEdge,cCore,pow(1.-a,5.));float i=power*pow(1.-a,1.7)*e*(.72+.28*n)*diam;
   gl_FragColor=vec4(col*i*3.,i);}`});}
function plume(len,r0,r1,core,edge){
  const geo=new THREE.CylinderGeometry(r0,r1,len,28,1,true); geo.translate(0,-len/2,0);
  const g=new THREE.Group(); const outer=new THREE.Mesh(geo,plumeMat(core,edge,1)); const inner=new THREE.Mesh(geo.clone().scale(.5,.55,.5),plumeMat(0xffffff,core,1.4));
  g.add(outer,inner); g.userData={mats:[outer.material,inner.material]}; g.visible=false; return g;
}
const engLight=new THREE.PointLight(0xffa050,0,900,0);
engLight.position.set(0,-8,0);
fh.add(engLight);
function puffSystem(n,color,s0,s1,life){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
  geo.setAttribute('aSize',new THREE.BufferAttribute(new Float32Array(n),1));
  geo.setAttribute('aAlpha',new THREE.BufferAttribute(new Float32Array(n),1));
  geo.setAttribute('aRot',new THREE.BufferAttribute(new Float32Array(n).map(()=>Math.random()*6.28),1));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:puffTex},color:{value:new THREE.Color(color)},glow:{value:new THREE.Color(0)},scale:{value:600},opacity:{value:1}},
    vertexShader:`attribute float aSize,aAlpha,aRot;varying float vA,vR;varying float vY;uniform float scale;void main(){vA=aAlpha;vR=aRot;vec4 mv=modelViewMatrix*vec4(position,1.);vY=position.y;gl_PointSize=aSize*scale/-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D map;uniform vec3 color,glow;uniform float opacity;varying float vA,vR,vY;void main(){vec2 p=gl_PointCoord-.5;float c=cos(vR),s=sin(vR);p=mat2(c,-s,s,c)*p+.5;vec4 t=texture2D(map,p);float g=exp(-max(vY,0.)/40.);gl_FragColor=vec4(color+glow*g,t.a*vA*opacity);}`});
  const pts=new THREE.Points(geo,mat); pts.frustumCulled=false; pts.userData={vel:new Float32Array(n*3),age:new Float32Array(n).fill(999),next:0,s0,s1,life}; return pts;
}
const smoke=puffSystem(700,0xbfb8ae,8,90,70);
ground.add(smoke);
const vent=puffSystem(220,0xf4f7fb,1.5,9,8);
ground.add(vent);
function emit(sys,p,v){const u=sys.userData,i=u.next;u.next=(i+1)%u.age.length;sys.geometry.attributes.position.array.set(p,i*3);u.vel.set(v,i*3);u.age[i]=0;}
const sunDir=new THREE.Vector3(-1,.08,.2).normalize();
const uM=new THREE.Vector3(.55,.6,-.58).normalize();
const farRoot=new THREE.Group();
far.add(farRoot);
const sunDirL=sunDir.clone();
const earthMat=new THREE.ShaderMaterial({uniforms:{day:{value:img(EARTH_DAY)},night:{value:img(EARTH_NIGHT)},spec:{value:img(EARTH_SPEC,false)},clouds:{value:img(EARTH_CLOUDS,false)},sunDir:{value:sunDirL},cOff:{value:0}},
 vertexShader:'#include <common>\nvarying vec2 vUv;varying vec3 vN;varying vec3 vW;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
 fragmentShader:`uniform sampler2D day,night,spec,clouds;uniform vec3 sunDir;uniform float cOff;varying vec2 vUv;varying vec3 vN;varying vec3 vW;
 void main(){vec3 N=normalize(vN);vec3 V=normalize(cameraPosition-vW);float d=dot(N,sunDir);
  vec3 dc=texture2D(day,vUv).rgb;vec3 nc=texture2D(night,vUv).rgb;float sp=texture2D(spec,vUv).r;
  vec2 cu=vUv+vec2(cOff,0.);float cl=texture2D(clouds,cu).r;float cs=texture2D(clouds,cu+vec2(.0012,.0006)).r;
  float lit=smoothstep(-.1,.22,d);float diff=max(d,0.);
  vec3 col=dc*(diff*1.25+.012)*(1.-.5*cs*lit);
  vec3 H=normalize(sunDir+V);col+=vec3(1.,.9,.75)*pow(max(dot(N,H),0.),80.)*sp*1.6*lit*(1.-cl);
  col=mix(col,vec3(1.)*(diff*1.3+.008),cl*.9);
  col+=nc*vec3(1.,.78,.5)*1.8*(1.-lit)*(1.-cl*.8);
  float rim=pow(1.-max(dot(N,V),0.),2.5);vec3 atm=mix(vec3(1.,.42,.18),vec3(.32,.58,1.),smoothstep(-.02,.35,d));
  col=mix(col,atm*(.25+diff),rim*smoothstep(-.3,.25,d)*.75);
  gl_FragColor=vec4(col,1.);
  #include <colorspace_fragment>
 }`});
const earth=new THREE.Mesh(new THREE.SphereGeometry(RE*1000,128,96),earthMat);
farRoot.add(earth);
const atmo=new THREE.Mesh(new THREE.SphereGeometry(RE*1000*1.028,128,96),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,uniforms:{sunDir:{value:sunDirL}},
 vertexShader:'varying vec3 vN;varying vec3 vW;void main(){vN=normalize(normalMatrix*normal);vW=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 sunDir;varying vec3 vN;varying vec3 vW;void main(){float f=pow(clamp(.72+dot(vN,vec3(0.,0.,1.)),0.,1.),5.);float d=dot(vW,sunDir);float l=smoothstep(-.35,.3,d);vec3 c=mix(vec3(1.,.45,.2),vec3(.3,.56,1.),smoothstep(-.05,.3,d));gl_FragColor=vec4(c*f*l*2.2,1.);}'}));
farRoot.add(atmo);
const moon=new THREE.Mesh(new THREE.SphereGeometry(RM*1000,128,96),new THREE.ShaderMaterial({uniforms:{map:{value:img(MOON_URI)},sunDir:{value:sunDirL}},
 vertexShader:'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}',
 fragmentShader:'uniform sampler2D map;uniform vec3 sunDir;varying vec2 vUv;varying vec3 vN;void main(){vec3 c=texture2D(map,vUv).rgb;float d=max(dot(normalize(vN),sunDir),0.);gl_FragColor=vec4(c*(pow(d,.75)*1.35+.006),1.);\n#include <colorspace_fragment>\n}'}));
moon.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),uM.clone().negate());
farRoot.add(moon);
const sun=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:new THREE.Color(30,27,22),blending:THREE.AdditiveBlending,depthWrite:false}));
sun.position.copy(sunDir).multiplyScalar(3e9);
sun.scale.setScalar(5e7);
farRoot.add(sun);
const sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:new THREE.Color(.9,.8,.6),blending:THREE.AdditiveBlending,depthWrite:false}));
sunHalo.position.copy(sun.position);
sunHalo.scale.setScalar(3.2e8);
farRoot.add(sunHalo);
const stars=(()=>{const n=6000,p=new Float32Array(n*3),c=new Float32Array(n*3),s=new Float32Array(n);for(let i=0;i<n;i++){const v=new THREE.Vector3().randomDirection().multiplyScalar(4e9);p.set([v.x,v.y,v.z],i*3);const b=Math.pow(Math.random(),3)*1.6+.25,w=Math.random();c.set([b*(w<.2?.75:1),b*(w<.2?.85:.97),b*(w>.8?.75:1)],i*3);s[i]=1+Math.pow(Math.random(),6)*2.6;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(c,3));g.setAttribute('aSize',new THREE.BufferAttribute(s,1));
 return new THREE.Points(g,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{op:{value:0},pr:{value:1}},vertexShader:'attribute float aSize;varying vec3 vC;uniform float pr;void main(){vC=color;gl_PointSize=aSize*pr;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform float op;varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vC,op*smoothstep(.5,.15,d));}',vertexColors:true}));})();
farRoot.add(stars);
const craft=new THREE.Group();
near.add(craft);
const envCabin=pmrem.fromScene(new RoomEnvironment(),.04).texture;
const envSpace=(()=>{const s=new THREE.Scene();s.add(new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;void main(){float e=smoothstep(.1,-.6,vP.y);gl_FragColor=vec4(vec3(.09,.12,.17)*e*3.+vec3(.012),1.);}'})));return pmrem.fromScene(s,0,.1,500).texture;})();
near.environment=envCabin;
const hemiN=new THREE.HemisphereLight(0x0b0d12,0x2c4a78,.5);
near.add(hemiN);
const sunLight=new THREE.DirectionalLight(0xfff6ea,6);
near.add(sunLight,sunLight.target);
sunLight.castShadow=true;
sunLight.shadow.mapSize.set(Q.high?2048:1024,Q.high?2048:1024);
sunLight.shadow.bias=-.0003;
sunLight.shadow.normalBias=.012;
function setSunFrustum(r,dist){const c=sunLight.shadow.camera;c.left=-r;c.right=r;c.top=r;c.bottom=-r;c.near=.1;c.far=dist*2;c.updateProjectionMatrix();sunLight.userData.dist=dist;}
setSunFrustum(2.4,12);
const cabin=new THREE.Group();
craft.add(cabin);
const quiltH=(x,y)=>{const t=256,lx=x%t,ly=y%t,de=Math.min(lx,t-lx,ly,t-ly);let h=smooth(0,10,de);h+=fbm(x/3,y/3,3)*.05;return h*3;};
const quiltN=normalTex(256,256,quiltH,1,[12,4]);
const metal=new THREE.MeshStandardMaterial({color:0xaeb3ba,roughness:.32,metalness:.9});
const darkMetal=new THREE.MeshStandardMaterial({color:0x2c3036,roughness:.45,metalness:.6});
const fabric=new THREE.MeshStandardMaterial({color:0xdcd8cf,roughness:.92,normalMap:normalTex(128,128,(x,y)=>fbm(x/2,y/2,3)*2+((x+y)%8<1?.3:0),1,[3,3])});
const glassMat=new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.05,roughness:.02,metalness:0,clearcoat:1,envMapIntensity:.3,depthWrite:false});
const winCenters=[];
const camHome=new THREE.Vector3();
const shellMat=new THREE.MeshPhysicalMaterial({map:carbonCol,roughness:.35,metalness:.15,clearcoat:1,clearcoatRoughness:.15});
const cushMat=new THREE.MeshStandardMaterial({color:0x2a2c31,roughness:.95,normalMap:normalTex(128,128,(x,y)=>fbm(x/1.5,y/1.5,3)*2,1,[2,2])});
const strapMat=new THREE.MeshStandardMaterial({color:0x1b1d21,roughness:.8});
const buckle=new THREE.MeshStandardMaterial({color:0xc9ccd1,roughness:.25,metalness:.95});
cabin.updateMatrixWorld(true);
const panel=new THREE.Group();
cabin.add(panel);
panel.lookAt(camHome);
panel.updateMatrixWorld();
class Screen{
  constructor(name){this.name=name;this.c=document.createElement('canvas');this.c.width=1024;this.c.height=576;this.x=this.c.getContext('2d');this.tex=new THREE.CanvasTexture(this.c);this.tex.colorSpace=THREE.SRGBColorSpace;this.tex.anisotropy=8;this.hits=[];}
  hit(id,x,y,w,h,en=true){this.hits.push({id,x,y,w,h,en});}
  pick(u,v){const px=u*1024,py=(1-v)*576;for(const h of this.hits) if(px>=h.x&&px<=h.x+h.w&&py>=h.y&&py<=h.y+h.h) return h;return null;}
}
const scr={left:new Screen('left'),center:new Screen('center'),right:new Screen('right')};
const screenMeshes=[];
[['left',-.53],['center',0],['right',.53]].forEach(([k,x])=>{
  const m=new THREE.Mesh(new THREE.PlaneGeometry(.5,.28125),new THREE.MeshStandardMaterial({color:0x000000,emissive:0xffffff,emissiveMap:scr[k].tex,emissiveIntensity:1.15,roughness:.06,metalness:0,envMapIntensity:.9}));
  m.position.set(x,.09,.034); m.userData.screen=scr[k]; panel.add(m); screenMeshes.push(m);
  const bez=new THREE.Mesh(new RoundedBoxGeometry(.528,.31,.03,3,.01),new THREE.MeshStandardMaterial({color:0x0b0c0f,roughness:.25,metalness:.3}));bez.position.set(x,.09,.017);panel.add(bez);m.userData.bezel=bez;
});
const capMeshes=[], coverMeshes=[], buttons=[];
const ringMesh=new THREE.Mesh(new THREE.RingGeometry(.038,.047,32),new THREE.MeshBasicMaterial({color:new THREE.Color(.6,1.6,2.4),transparent:true,depthWrite:false}));
ringMesh.visible=false;
panel.add(ringMesh);
const plush=(()=>{const g=new THREE.Group();const fur=new THREE.MeshStandardMaterial({color:0xc9a77c,roughness:1,normalMap:normalTex(64,64,(x,y)=>Math.random()*1.5,1,[2,2])});
  const body=new THREE.Mesh(new THREE.SphereGeometry(.045,24,16),fur);body.scale.y=1.15;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.036,24,16),fur);head.position.y=.07;g.add(head);
  for(const k of[-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.013,12,8),fur);e.position.set(k*.026,.1,0);g.add(e);
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.005,8,6),new THREE.MeshStandardMaterial({color:0x111,roughness:.2}));eye.position.set(k*.012,.075,.032);g.add(eye);
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.011,.03,4,8),fur);arm.position.set(k*.048,.0,0);arm.rotation.z=k*.6;g.add(arm);
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.012,.025,4,8),fur);leg.position.set(k*.022,-.055,.01);g.add(leg);}
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.012,12,8),new THREE.MeshStandardMaterial({color:0xe9d8bf,roughness:1}));nose.position.set(0,.065,.03);g.add(nose);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;}); cabin.add(g);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0x222}));cabin.add(line);
  const anchor=panel.localToWorld(new THREE.Vector3(-.87,.3,.03)); cabin.worldToLocal(anchor);
  return {g,line,anchor,pos:anchor.clone().add(new THREE.Vector3(0,-.22,.05)),vel:new THREE.Vector3(),L:.22};})();
const extModel=new THREE.Group();
craft.add(extModel);
extModel.visible=false;
const ext={};
const UI={bg:'#05070c',ink:'#e8ecf4',dim:'#8d99b0',faint:'#4f5a74',line:'#1e2940',craft:'#6fd3ff',ok:'#7ee2a8',warn:'#ffcf6b',bad:'#ff8a7a',btn:'#0c121d'};
function fmtClock(t){const sgn=t<0?'T−':'T+';let a=Math.abs(t);const d=Math.floor(a/86400);a-=d*86400;const h=Math.floor(a/3600),m=Math.floor(a%3600/60),s=Math.floor(a%60);const p=n=>String(n).padStart(2,'0');return sgn+(d?d+'d ':'')+p(h)+':'+p(m)+':'+p(s);}
function fmtNum(x,d=0){return x.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g,'\u2009');}
function wrapText(c,txt,x,y,maxW,lh,maxL=3){const words=txt.split(' ');let line='',n=0;for(const w of words){const t=line?line+' '+w:w;if(c.measureText(t).width>maxW&&line){c.fillText(line,x,y+n*lh);line=w;n++;if(n>=maxL)return;}else line=t;}if(line)c.fillText(line,x,y+n*lh);}
const G={q:new THREE.Quaternion(),w:{x:0,y:0,z:0},stepSize:.1,err:{x:0,y:0,z:0},okT:0};
cabin.add(cam);
cam.position.copy(camHome);
const orbitE={th:2.3,ph:1.2,d:26};
const qTmp=new THREE.Quaternion(), vTmp=new THREE.Vector3();
const BORE=new THREE.Vector3();
function worldToCabin(v){return v.applyMatrix4(new THREE.Matrix4().copy(cabin.matrixWorld).invert());}
const cardEl=$('#card');
function setTag(k){const el=$('#tag');el.className='tag '+k;el.textContent=TAGTXT[k];}
let calloutTimer=0,toastTimer=0;
function callout(big,sub){$('#cBig').textContent=big;$('#cSub').textContent=sub||'';$('#callout').classList.add('show');clearTimeout(calloutTimer);calloutTimer=setTimeout(()=>$('#callout').classList.remove('show'),3200);}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4200);}
$('#bMin').addEventListener('click',()=>{const m=cardEl.classList.toggle('min');$('#bMin').textContent=m?'Mostrar':'Ocultar';});
$('#bReset').addEventListener('click',()=>{try{location.reload();}catch(e){}});
const A={ctx:null,g:null};
const ptrs=new Map();
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
const detached=[];
const glowCol=new THREE.Color();
const skyLow=new THREE.Color(0x46689e), black=new THREE.Color(0x000000), skyCol=new THREE.Color();
const duskCol=new THREE.Color(0xffb27a), spaceCol=new THREE.Color(0xfff6ea);
const hemiSkyPad=new THREE.Color(0x6f8fc8), hemiSkySpace=new THREE.Color(0x07080c);
const craftQ=new THREE.Quaternion();
const gLocal=new THREE.Vector3(), tmpV=new THREE.Vector3();
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);for(const c of[gcam,ecam]){c.aspect=w/h;c.updateProjectionMatrix();}}
addEventListener('resize',resize);
function applyQuality(){
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,Q.high?2:1.25)); resize();
  bloom.enabled=Q.high;
  for(const l of[sunLight,sunG]){const n=Q.high?2048:1024;if(l.shadow.mapSize.x!==n){l.shadow.mapSize.set(n,n);if(l.shadow.map){l.shadow.map.dispose();l.shadow.map=null;}}}
  $('#bQual').textContent='Calidad: '+(Q.high?'alta':'media');
}
$('#bQual').addEventListener('click',()=>{Q.high=!Q.high;applyQuality();});
const clock=new THREE.Clock();

export { setPadSky, EARTH_DAY, EARTH_NIGHT, EARTH_SPEC, EARTH_CLOUDS, MOON_URI, WATER_URI, $, clamp, lerp, smooth, D2R, FD, FM, RE, RM, DM, MU_E, MU_M, TAGTXT, canvas, MOBILE, Q, renderer, pmrem, ground, far, near, gcam, cam, ecam, fcam, composer, rpGround, rpFar, rpNear, bloom, outPass, grade, texLoader, img, canvasTex, hash, vnoise, fbm, normalTex, glowTex, puffTex, hullTex, MW, MWdragon, carbonCol, MK, MG, MTi, solarTex, MTrunk, lathe, CAP_PROF, capR, buildDragon, buildTrunk, gSun, makeSky, hemiG, sunG, steel, beacon, armPivot, pick, fh, stage1, upper, plumeMat, plume, engLight, puffSystem, smoke, vent, emit, sunDir, uM, farRoot, sunDirL, earthMat, earth, atmo, moon, sun, sunHalo, stars, craft, envCabin, envSpace, hemiN, sunLight, setSunFrustum, cabin, quiltH, quiltN, metal, darkMetal, fabric, glassMat, winCenters, camHome, shellMat, cushMat, strapMat, buckle, panel, Screen, scr, screenMeshes, capMeshes, coverMeshes, buttons, ringMesh, plush, extModel, ext, UI, fmtClock, fmtNum, wrapText, G, orbitE, qTmp, vTmp, BORE, worldToCabin, cardEl, setTag, calloutTimer, toastTimer, callout, toast, A, ptrs, ray, ndc, detached, glowCol, skyLow, black, skyCol, duskCol, spaceCol, hemiSkyPad, hemiSkySpace, craftQ, gLocal, tmpV, resize, applyQuality, clock };
