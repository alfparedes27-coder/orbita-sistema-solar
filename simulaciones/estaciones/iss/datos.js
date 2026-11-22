// Estación Espacial Internacional: módulos, armado, naves visitantes y puntos de interés.
// Ejes de la escena (metros): x = hacia adelante (dirección del vuelo), y = cenit (hacia el espacio),
// z = estribor. La Tierra queda siempre abajo (−y), como vuela la estación de verdad (actitud +XVV).
// Medidas: NASA «Reference Guide to the ISS» (2015), ESA, JAXA y Roscosmos; posiciones simplificadas a escala.

export const D = (s) => new Date(s + 'T12:00:00Z').getTime();

// ---------- módulos presurizados (se pueden recorrer por dentro) ----------
// ax: eje largo del módulo · c: centro · L: largo · R: radio exterior · tipo 'us' (paredes de racks) o 'ru' (cilindro ruso)
// ag: agencia · hz: medio ancho del pasillo interior (us) · ri: radio interior libre (ru)
export const MODS = [
  { id:'unity', name:'Unity (Nodo 1)', ag:'NASA', tipo:'nodo', ax:'x', c:[0,0,0], L:5.5, R:2.28,
    lanz:'4 dic. 1998 · Transbordador Endeavour (STS‑88)', masa:'11 600 kg',
    txt:'El primer módulo de Estados Unidos y el cruce de caminos de la estación: tiene seis puertas, una en cada dirección. Hoy es el comedor de la tripulación.' },
  { id:'destiny', name:'Destiny', ag:'NASA', tipo:'us', ax:'x', c:[7.15,0,0], L:8.5, R:2.14, racks:6,
    lanz:'7 feb. 2001 · Transbordador Atlantis (STS‑98)', masa:'14 520 kg',
    txt:'El laboratorio principal de la NASA. Tiene 24 espacios para «racks» del tamaño de un refrigerador y la ventana con mejor calidad óptica de la estación.' },
  { id:'harmony', name:'Harmony (Nodo 2)', ag:'NASA', tipo:'nodo', ax:'x', c:[15.05,0,0], L:7.2, R:2.2, racks:4,
    lanz:'23 oct. 2007 · Transbordador Discovery (STS‑120)', masa:'14 300 kg',
    txt:'Conecta los laboratorios de Europa y Japón y es donde duermen cuatro astronautas, en cabinas del tamaño de una cabina telefónica. Aquí se acoplan las Crew Dragon.' },
  { id:'columbus', name:'Columbus', ag:'ESA', tipo:'us', ax:'z', c:[15.05,0,5.75], L:6.9, R:2.24, racks:4,
    lanz:'7 feb. 2008 · Transbordador Atlantis (STS‑122)', masa:'10 300 kg',
    txt:'El laboratorio de la Agencia Espacial Europea. Tiene 10 racks de experimentos y por fuera lleva instrumentos que miran al Sol y a la Tierra.' },
  { id:'kibo', name:'Kibō (módulo presurizado)', short:'Kibō', ag:'JAXA', tipo:'us', ax:'z', c:[15.05,0,-7.9], L:11.2, R:2.2, racks:9,
    lanz:'31 may. 2008 · Transbordador Discovery (STS‑124)', masa:'15 900 kg',
    txt:'«Esperanza» en japonés. Es el módulo más grande de la estación: 11,2 m de largo, con su propia esclusa para sacar experimentos al vacío y su propio brazo robótico.' },
  { id:'jlp', name:'Kibō (bodega ELM‑PS)', short:'Kibō · bodega', ag:'JAXA', tipo:'us', ax:'y', c:[15.05,4.55,-6.4], L:4.2, R:2.2, racks:2,
    lanz:'11 mar. 2008 · Transbordador Endeavour (STS‑123)', masa:'8 400 kg',
    txt:'El «ático» de Kibō: una bodega encima del laboratorio japonés donde se guardan repuestos y experimentos.' },
  { id:'tranquility', name:'Tranquility (Nodo 3)', ag:'NASA', tipo:'nodo', ax:'z', c:[0,0,-5.65], L:6.7, R:2.24, racks:4,
    lanz:'8 feb. 2010 · Transbordador Endeavour (STS‑130)', masa:'15 500 kg',
    txt:'El módulo de la vida diaria: el baño, las máquinas de ejercicio y los sistemas que reciclan el agua y fabrican el oxígeno que se respira a bordo.' },
  { id:'cupola', name:'Cúpula', ag:'ESA', tipo:'cupula', ax:'y', c:[0,-3.0,-6.15], L:1.5, R:1.48,
    lanz:'8 feb. 2010 · con Tranquility (STS‑130)', masa:'1 880 kg',
    txt:'La ventana más grande que se ha llevado al espacio: siete vidrios mirando a la Tierra. Desde aquí se maneja el brazo Canadarm2 para atrapar naves de carga.' },
  { id:'pmm', name:'Leonardo (PMM)', ag:'ASI · NASA', tipo:'us', ax:'x', c:[5.6,0,-6.15], L:6.6, R:2.28, racks:5,
    lanz:'24 feb. 2011 · Transbordador Discovery (STS‑133)', masa:'9 900 kg',
    txt:'Construido en Italia, viajó varias veces en el transbordador como un «camión de mudanza» antes de quedarse fijo. Hoy es una bodega grande.' },
  { id:'beam', name:'BEAM (módulo inflable)', ag:'Bigelow · NASA', tipo:'inflable', ax:'x', c:[-4.3,0,-6.15], L:4.0, R:1.6,
    lanz:'8 abr. 2016 · Falcon 9 (Dragon CRS‑8)', masa:'1 400 kg',
    txt:'Un módulo de tela que viajó doblado y se infló en mayo de 2016 hasta 4 m de largo. Era una prueba de dos años y salió tan bien que sigue allí, usado como bodega.' },
  { id:'quest', name:'Quest (esclusa)', ag:'NASA', tipo:'us', ax:'z', c:[0,0,5.05], L:5.5, R:2.0, racks:2,
    lanz:'12 jul. 2001 · Transbordador Atlantis (STS‑104)', masa:'6 064 kg',
    txt:'La puerta de salida para las caminatas espaciales estadounidenses. Aquí se guardan los trajes y se preparan los astronautas antes de salir al vacío.' },
  { id:'pma1', name:'PMA‑1 (adaptador)', ag:'NASA', tipo:'tunel', ax:'x', c:[-3.7,0,0], L:1.9, R:0.95,
    lanz:'4 dic. 1998 · con Unity (STS‑88)', masa:'1 590 kg',
    txt:'Un túnel corto y algo torcido que une el segmento ruso con el estadounidense: por fuera es un cono, por dentro un pasillo estrecho lleno de cables.' },
  { id:'zarya', name:'Zariá (FGB)', ag:'Roscosmos · NASA', tipo:'ru', ax:'x', c:[-10.9,0,0], L:12.6, R:2.05, Rn:1.45, nLen:3.2, nAt:'+',
    lanz:'20 nov. 1998 · cohete Protón‑K, Baikonur', masa:'19 323 kg',
    txt:'«Amanecer» en ruso: la primera pieza de la estación. Se construyó en Rusia con dinero de Estados Unidos. Al principio daba energía y empuje; hoy es una bodega.' },
  { id:'zvezda', name:'Zvezdá (módulo de servicio)', ag:'Roscosmos', tipo:'ru', ax:'x', c:[-23.75,0,0], L:13.1, R:2.08, Rn:1.45, nLen:4.0, nAt:'+',
    lanz:'12 jul. 2000 · cohete Protón‑K, Baikonur', masa:'19 051 kg',
    txt:'«Estrella» en ruso. El corazón del segmento ruso: tiene los motores que suben la órbita, el soporte de vida, el comedor ruso y dos cabinas para dormir.' },
  { id:'poisk', name:'Poisk (MIM‑2)', ag:'Roscosmos', tipo:'ru', ax:'y', c:[-18.45,3.35,0], L:4.0, R:1.28,
    lanz:'10 nov. 2009 · cohete Soyuz‑U, Baikonur', masa:'3 670 kg',
    txt:'«Búsqueda»: un módulo pequeño con un puerto para naves Soyuz y Progress arriba. También sirve de esclusa para las caminatas espaciales rusas.' },
  { id:'rassvet', name:'Rassvet (MIM‑1)', ag:'Roscosmos', tipo:'ru', ax:'y', c:[-6.3,-4.6,0], L:6.0, R:1.18,
    lanz:'14 may. 2010 · Transbordador Atlantis (STS‑132)', masa:'5 075 kg',
    txt:'«Alba». Una bodega rusa con puerto de acoplamiento abajo. Fue uno de los pocos módulos rusos que viajó en el transbordador estadounidense.' },
  { id:'nauka', name:'Naúka (MLM)', ag:'Roscosmos', tipo:'ru', ax:'y', c:[-18.45,-7.75,0], L:13.1, R:2.1, Rn:1.45, nLen:4.2, nAt:'-',
    lanz:'21 jul. 2021 · cohete Protón‑M, Baikonur', masa:'20 350 kg',
    txt:'«Ciencia». El laboratorio ruso más nuevo; tardó más de 20 años en salir. Al acoplarse, sus motores se encendieron por error y giraron toda la estación una vuelta y media.' },
  { id:'prichal', name:'Prichal (nodo)', ag:'Roscosmos', tipo:'esfera', ax:'y', c:[-18.45,-15.95,0], L:3.3, R:1.65,
    lanz:'24 nov. 2021 · cohete Soyuz‑2.1b, Baikonur', masa:'4 650 kg',
    txt:'«Muelle». Una esfera con seis puertas que espera a las naves y módulos rusos del futuro. Es el punto más bajo de la estación.' },
];
export const MOD = Object.fromEntries(MODS.map(m => [m.id, m]));

// Conexiones transitables (escotillas abiertas): [a, b]. El punto de paso se calcula entre ambos módulos.
export const LINKS = [
  ['unity','destiny'], ['destiny','harmony'], ['harmony','columbus'], ['harmony','kibo'], ['kibo','jlp'],
  ['unity','tranquility'], ['tranquility','cupola'], ['tranquility','pmm'], ['tranquility','beam'], ['unity','quest'],
  ['unity','pma1'], ['pma1','zarya'], ['zarya','zvezda'], ['zarya','rassvet'], ['zvezda','poisk'], ['zvezda','nauka'], ['nauka','prichal'],
];

// Escotillas cerradas (naves o equipos detrás): módulo, dirección, rótulo
export const CLOSED = [
  { m:'harmony', dir:'+x', t:'IDA‑2 · Crew Dragon (Crew‑13)' },
  { m:'harmony', dir:'+y', t:'IDA‑3 · Dragon de carga' },
  { m:'harmony', dir:'-y', t:'Puerto para Cygnus y HTV‑X' },
  { m:'zvezda', dir:'-x', t:'Nave de carga Progress' },
  { m:'poisk', dir:'+y', t:'Nave de carga Progress' },
  { m:'rassvet', dir:'-y', t:'Soyuz MS‑29' },
  { m:'tranquility', dir:'-z', t:'Esclusa comercial Bishop' },
  { m:'kibo', dir:'-z', t:'Esclusa de experimentos de Kibō' },
  { m:'quest', dir:'+z', t:'Escotilla al vacío (caminatas)' },
  { m:'unity', dir:'+y', t:'Z1 · cables hacia la armazón' },
  { m:'unity', dir:'-y', t:'Puerto libre' },
  { m:'prichal', dir:'-y', t:'Puerto libre (naves futuras)' }, { m:'prichal', dir:'+x', t:'Puerto libre' }, { m:'prichal', dir:'-x', t:'Puerto libre' },
  { m:'prichal', dir:'+z', t:'Puerto libre' }, { m:'prichal', dir:'-z', t:'Puerto libre' },
  { m:'columbus', dir:'+z', t:'Pared exterior (experimentos afuera)' },
];

// ---------- puntos de interés dentro de la estación ----------
// m: módulo · s: posición a lo largo del eje (0 = un extremo, 1 = el otro) · w: pared hacia donde está (+x,−x,+y,−y,+z,−z) · d: distancia desde el centro
export const SPOTS = [
  { m:'unity', s:.5, w:'-y', d:.75, t:'La mesa del comedor', x:'Aquí se juntan a comer. La comida no se cae, pero tampoco se queda quieta: las bolsas se pegan con velcro y las cucharas con imanes o cinta. Se come casi todo en bolsas rehidratadas con agua caliente; la sal y la pimienta vienen líquidas, porque los granos saldrían flotando y podrían meterse en los ojos o en los aparatos.' },
  { m:'unity', s:.5, w:'+z', d:.95, t:'Seis puertas', x:'Unity fue el primer «nodo»: un cubo con una escotilla en cada cara. Por el frente sigue Destiny, atrás el túnel hacia los módulos rusos, a la izquierda Tranquility y a la derecha la esclusa Quest. Mira las flechas pintadas: dentro de la estación no hay arriba ni abajo, así que todo se rotula.' },
  { m:'destiny', s:.55, w:'-y', d:.8, t:'La ventana de ciencia', x:'Tiene 51 cm y es la ventana de mejor calidad óptica de la estación. Desde aquí se toman fotos de la Tierra para estudiar glaciares, ciudades de noche, incendios y huracanes. Una tapa por fuera la protege de los micrometeoritos cuando no se usa.' },
  { m:'destiny', s:.25, w:'+z', d:.9, t:'Un «rack» de experimentos', x:'Cada pared está hecha de racks: armarios de 1,05 m de ancho y 2 m de alto con conexiones de electricidad, agua de enfriamiento, datos y gases. Se pueden cambiar de lugar como piezas de lego. En el laboratorio caben 24.' },
  { m:'destiny', s:.8, w:'+y', d:.9, t:'Luces y aire', x:'Las luces LED del techo cambian de color durante el día: más azules en la mañana y más rojizas en la noche, para que el cuerpo sepa cuándo dormir. La estación da 16 vueltas a la Tierra al día, así que afuera hay 16 amaneceres. Los ventiladores no paran nunca: sin gravedad el aire no circula solo y alrededor de la cabeza se formaría una burbuja de dióxido de carbono.' },
  { m:'destiny', s:.4, w:'-z', d:.9, t:'Laptops por todas partes', x:'Hay decenas de computadoras portátiles sujetas a brazos articulados. Con ellas se revisan los procedimientos, se controlan experimentos y se habla con la familia. El control de la misión en Houston puede ver y manejar muchos sistemas desde la Tierra.' },
  { m:'harmony', s:.35, w:'+y', d:.85, t:'Cabina para dormir', x:'Cuatro astronautas duermen en Harmony, cada uno en una cabina del tamaño de una cabina telefónica: arriba, abajo, a la izquierda y a la derecha. Duermen en un saco amarrado a la pared, para no chocar con nada mientras flotan. Tienen su laptop, fotos de la familia y una puerta corrediza.' },
  { m:'harmony', s:.95, w:'+x', d:.7, t:'Puerto de la Crew Dragon', x:'Detrás de esta escotilla está el adaptador IDA‑2, donde se acoplan solas las Crew Dragon de SpaceX. Arriba hay otro igual, el IDA‑3, donde llegan las Dragon de carga. Las naves se acercan a unos centímetros por segundo.' },
  { m:'columbus', s:.5, w:'-y', d:.85, t:'El laboratorio europeo', x:'Columbus tiene 10 racks: aquí se estudian plantas y células (Biolab), fluidos que se comportan raro sin gravedad y cómo cambia el cuerpo humano en el espacio. Se controla desde un centro de la ESA en Oberpfaffenhofen, Alemania.' },
  { m:'kibo', s:.55, w:'+y', d:.85, t:'El laboratorio japonés', x:'Kibō es el módulo más grande: 11,2 m. Aquí se han cultivado cristales de proteínas para diseñar medicinas, se han criado peces medaka y ratones para estudiar los huesos y músculos, y se han soltado decenas de pequeños satélites CubeSat.' },
  { m:'kibo', s:.96, w:'-z', d:.7, t:'La esclusa de experimentos', x:'Al fondo hay una pequeña esclusa: se mete un experimento, se saca el aire y el brazo robótico japonés lo lleva a la plataforma exterior, donde queda en el vacío. Por aquí también salen los CubeSat que se lanzan desde la estación.' },
  { m:'kibo', s:.85, w:'+x', d:.85, t:'Control del brazo japonés', x:'Desde esta consola se maneja el JEMRMS, el brazo robótico de 10 m de Kibō, mirando por dos ventanas y cámaras. Tiene un «brazo pequeño» en la punta para trabajos finos.' },
  { m:'jlp', s:.6, w:'+x', d:.85, t:'El ático', x:'Una bodega llena de bolsas, repuestos y experimentos que se guardan hasta que se necesitan. En la estación no se pierde nada a propósito: cada bolsa tiene un código de barras y una ubicación en la base de datos.' },
  { m:'tranquility', s:.1, w:'+x', d:.85, t:'El baño', x:'El inodoro funciona con succión de aire, como una aspiradora: sin gravedad, nada cae por su cuenta. La orina se recicla y, después de filtrarla y destilarla, vuelve a ser agua para beber: la estación recupera cerca del 98 % del agua.' },
  { m:'tranquility', s:.55, w:'-x', d:.85, t:'Cinta para correr T2', x:'Para correr hay que amarrarse a la cinta con arneses elásticos, si no, el primer paso te lanzaría al techo. Los astronautas hacen unas dos horas de ejercicio al día; sin eso, en seis meses perderían mucho hueso y músculo.' },
  { m:'tranquility', s:.82, w:'-y', d:.6, t:'ARED: pesas sin pesas', x:'Las pesas no sirven si no hay gravedad. ARED usa cilindros de vacío que resisten como si levantaras hasta unos 270 kg. Así se hacen sentadillas y peso muerto en órbita.' },
  { m:'tranquility', s:.5, w:'+y', d:.9, t:'Agua y oxígeno', x:'Aquí están los racks que reciclan el agua y los que fabrican oxígeno separando el agua en hidrógeno y oxígeno con electricidad. El dióxido de carbono que exhalan los astronautas se retira del aire con filtros especiales.' },
  { m:'cupola', s:.55, w:'-y', d:.55, t:'La ventana al mundo', x:'Siete ventanas: seis alrededor y una redonda de 80 cm en el centro. Lo que ves abajo es la Tierra en el lugar real por donde pasa la estación en este momento. A 7,7 km/s, se cruza el océano Atlántico en unos 15 minutos.' },
  { m:'cupola', s:.25, w:'+x', d:1.0, t:'Estación del brazo robótico', x:'Desde aquí se maneja el Canadarm2 con dos palancas, una para mover y otra para girar, mirando por las ventanas y tres pantallas. Así se atrapan naves de carga como la Cygnus y se mueven equipos por fuera.' },
  { m:'pmm', s:.5, w:'+y', d:.9, t:'La bodega italiana', x:'Leonardo viajó varias veces dentro de la bodega del transbordador llevando carga a la estación y de vuelta a la Tierra. En 2011 se quedó para siempre. Hoy guarda comida, ropa y repuestos.' },
  { m:'beam', s:.5, w:'+y', d:.85, t:'Paredes de tela', x:'BEAM viajó doblado como una maleta y se infló con aire. Sus paredes son muchas capas de tela muy resistente, incluso más fuertes que el aluminio contra los micrometeoritos. Las empresas privadas quieren hacer estaciones enteras así.' },
  { m:'quest', s:.3, w:'+x', d:.85, t:'Trajes para caminar en el espacio', x:'Los trajes EMU cuelgan aquí, listos para salir. Antes de una caminata los astronautas respiran oxígeno puro para sacar el nitrógeno de la sangre; si no, al bajar la presión del traje les daría la enfermedad de los buzos.' },
  { m:'quest', s:.85, w:'+z', d:.6, t:'La puerta al vacío', x:'Al fondo está la parte pequeña de la esclusa: entran dos astronautas con sus trajes, se cierra la escotilla de atrás y se saca el aire. Después abren la escotilla exterior y salen. Se han hecho más de 270 caminatas espaciales en la estación.' },
  { m:'pma1', s:.5, w:'+y', d:.7, t:'De un país a otro', x:'Este túnel une la parte estadounidense con la rusa. Las dos usan electricidad distinta (120 voltios aquí, 28 allá), así que hay convertidores para compartir energía.' },
  { m:'zarya', s:.5, w:'+z', d:1.3, t:'La primera pieza', x:'Zariá fue lanzada el 20 de noviembre de 1998 desde Baikonur. Es rusa, pero la pagó Estados Unidos. Durante el armado dio energía, control y empuje; hoy sus paredes están llenas de bolsas y tanques de combustible que usa el resto de la estación.' },
  { m:'zvezda', s:.5, w:'-y', d:1.1, t:'El comedor ruso', x:'La mesa de los cosmonautas, con calentadores de latas y tubos. Los rusos comen sopas, carnes y pescado en latas y tubos; muchas veces se juntan con los estadounidenses para compartir la comida.' },
  { m:'zvezda', s:.46, w:'+z', d:1.0, t:'Las cabinas rusas', x:'Dos cabinas pequeñas (kayutas), cada una con una ventanita redonda para mirar la Tierra antes de dormir. En las primeras expediciones eran las únicas camas de la estación.' },
  { m:'zvezda', s:.35, w:'-y', d:1.0, t:'Ventana de Zvezdá', x:'Zvezdá tiene 14 ventanas. Por las de abajo los cosmonautas fotografían la Tierra y vigilan la llegada de las naves Soyuz y Progress.' },
  { m:'zvezda', s:.85, w:'+y', d:1.1, t:'Motores y control', x:'Atrás de Zvezdá están los motores principales. Junto con las naves Progress, elevan la órbita varias veces al año: el poco aire que hay a 420 km frena la estación y la hace bajar unos 2 km por mes, y más cuando el Sol está muy activo.' },
  { m:'zvezda', s:.96, w:'-x', d:.6, t:'La pequeña fuga', x:'En la cámara de atrás de Zvezdá hay una fuga de aire muy lenta desde 2019. Los cosmonautas sellaron grietas y, cuando no se usa, la escotilla se mantiene cerrada para cuidar el aire del resto de la estación.' },
  { m:'poisk', s:.5, w:'+x', d:.85, t:'La esclusa rusa', x:'Desde aquí salen los cosmonautas a caminar en el espacio con trajes Orlan, que se entran por una puerta en la espalda, como un armario. Arriba se acoplan las naves Soyuz y Progress.' },
  { m:'rassvet', s:.5, w:'+x', d:.75, t:'Puerto de la Soyuz', x:'Abajo de Rassvet se acopla la Soyuz, el «bote salvavidas» de los tres tripulantes rusos: siempre lista para volver a la Tierra en unas tres horas si hay una emergencia.' },
  { m:'nauka', s:.3, w:'+z', d:1.2, t:'El laboratorio ruso', x:'Naúka tiene lugar para experimentos, un baño, una cabina más y una gran ventana. Por fuera lleva el Brazo Robótico Europeo (ERA), que camina por el módulo como una oruga.' },
  { m:'nauka', s:.12, w:'-x', d:1.25, t:'Un acoplamiento accidentado', x:'El 29 de julio de 2021, tres horas después de acoplarse, los motores de Naúka se encendieron solos y giraron toda la estación unos 540°, una vuelta y media. Los controladores la recuperaron usando los motores de Zvezdá y de una Progress.' },
  { m:'prichal', s:.5, w:'+z', d:.9, t:'Seis puertas, cinco libres', x:'Prichal es una esfera con seis escotillas: una une a Naúka y las otras cinco esperan naves y módulos del futuro. Algunas Soyuz ya se han acoplado aquí.' },
];

// ---------- armado: vuelos y elementos ----------
// veh: cohete · sitio · ev: eventos del ascenso (s desde el despegue, aproximados)
export const VEH = {
  protonK: { name:'Protón‑K', pais:'URSS/Rusia', alto:'≈ 57 m', ev:[[0,'Despegue: 6 motores RD‑253'],[62,'Presión dinámica máxima'],[124,'Se separa la primera etapa'],[183,'Se suelta la cubierta de la carga'],[334,'Se separa la segunda etapa'],[580,'Apagado de la tercera etapa'],[590,'El módulo se separa del cohete']], tEnd:590, prof:[[0,0,0],[62,12,.45],[124,42,1.7],[334,130,4.3],[580,185,7.6],[590,186,7.65]] },
  protonM: { name:'Protón‑M', pais:'Rusia', alto:'≈ 58 m', ev:[[0,'Despegue: 6 motores RD‑276'],[63,'Presión dinámica máxima'],[123,'Se separa la primera etapa'],[180,'Se suelta la cubierta de la carga'],[330,'Se separa la segunda etapa'],[575,'Apagado de la tercera etapa'],[582,'Naúka se separa del cohete']], tEnd:582, prof:[[0,0,0],[63,12,.45],[123,42,1.7],[330,130,4.3],[575,190,7.6],[582,191,7.65]] },
  shuttle: { name:'Transbordador espacial', pais:'EE. UU.', alto:'56 m', ev:[[0,'Despegue: 3 motores principales y 2 cohetes sólidos'],[60,'Presión dinámica máxima'],[124,'Se separan los cohetes sólidos'],[510,'Apagado de los motores principales (MECO)'],[528,'Se suelta el tanque externo'],[540,'Rumbo a la estación: la alcanza en unos 2 días']], tEnd:540, prof:[[0,0,0],[60,11,.45],[124,46,1.4],[300,105,3.0],[440,108,5.5],[510,110,7.7],[540,111,7.72]] },
  soyuzU: { name:'Soyuz‑U', pais:'URSS/Rusia', alto:'≈ 50 m', ev:[[0,'Despegue: 5 motores con 20 toberas'],[60,'Presión dinámica máxima'],[118,'Se sueltan los 4 laterales: la «cruz de Koroliov»'],[160,'Se suelta la cubierta de la carga'],[288,'Se separa la etapa central'],[528,'Apagado de la tercera etapa'],[531,'La nave Progress se separa']], tEnd:531, prof:[[0,0,0],[60,11,.45],[118,45,1.6],[288,165,3.8],[528,200,7.6],[531,200,7.65]] },
  soyuz21b: { name:'Soyuz‑2.1b', pais:'Rusia', alto:'≈ 46 m', ev:[[0,'Despegue'],[60,'Presión dinámica máxima'],[118,'Se sueltan los 4 laterales: la «cruz de Koroliov»'],[165,'Se suelta la cubierta de la carga'],[287,'Se separa la etapa central'],[526,'Apagado de la tercera etapa'],[529,'Prichal y su Progress se separan']], tEnd:529, prof:[[0,0,0],[60,11,.45],[118,45,1.6],[287,165,3.8],[526,200,7.6],[529,200,7.65]] },
  falcon9: { name:'Falcon 9', pais:'EE. UU. (SpaceX)', alto:'70 m', ev:[[0,'Despegue: 9 motores Merlin'],[72,'Presión dinámica máxima'],[150,'Apagado de la primera etapa (MECO)'],[154,'Separación: la primera etapa vuelve a aterrizar'],[525,'Apagado de la segunda etapa'],[710,'La Dragon se separa']], tEnd:710, prof:[[0,0,0],[72,12,.5],[150,65,2.1],[300,160,3.4],[525,210,7.6],[710,215,7.6]] },
};
// coordenadas de cada plataforma y rumbo de lanzamiento hacia la órbita de 51,6°
export const PADS = { b81:[46.07,62.98,'steppe',64], b200:[46.04,63.03,'steppe',64], b1:[45.92,63.342,'steppe',64], b31:[45.996,63.564,'steppe',64],
  k39a:[28.608,-80.604,'florida',44], k39b:[28.627,-80.621,'florida',44], c40:[28.562,-80.577,'florida',44], cc:[28.562,-80.577,'florida',44] };
export const SITES = {
  b81: 'Baikonur, Sitio 81 (Kazajistán)', b200: 'Baikonur, Sitio 200 (Kazajistán)', b1: 'Baikonur, Sitio 1 «Arranque de Gagarin»', b31: 'Baikonur, Sitio 31 (Kazajistán)',
  k39a: 'Centro Espacial Kennedy, plataforma 39A (Florida)', k39b: 'Centro Espacial Kennedy, plataforma 39B (Florida)', c40: 'Cabo Cañaveral, SLC‑40 (Florida)', cc: 'Cabo Cañaveral (Florida)',
};
// orb: nombre del orbitador del transbordador
export const FLIGHTS = [
  { id:'1A/R', d:'1998-11-20', veh:'protonK', site:'b81', add:['zarya'], t:'Zariá, la primera pieza', x:'Un Protón‑K pone a Zariá en órbita. Durante dos semanas es la «estación» completa: un módulo solo, sin nadie a bordo.' },
  { id:'STS‑88', d:'1998-12-04', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['unity','pma1','pma2'], t:'Unity: se unen Rusia y Estados Unidos', x:'El Endeavour atrapa a Zariá con su brazo robótico y la une a Unity. Los astronautas entran por primera vez el 10 de diciembre.' },
  { id:'1R', d:'2000-07-12', veh:'protonK', site:'b81', add:['zvezda'], t:'Zvezdá, la casa', x:'Zvezdá llega con las camas, la cocina y el soporte de vida. Se acopla a Zariá el 26 de julio de 2000.' },
  { id:'STS‑92', d:'2000-10-11', veh:'shuttle', orb:'Discovery', site:'k39a', add:['z1','pma3'], t:'La armazón Z1', x:'Llega la primera pieza de la armazón, con giroscopios para orientar la estación sin gastar combustible. El 2 de noviembre de 2000 llega la Expedición 1: desde ese día siempre ha habido gente a bordo.' },
  { id:'STS‑97', d:'2000-11-30', veh:'shuttle', orb:'Endeavour', site:'k39b', add:['p6'], t:'Los primeros paneles grandes', x:'La sección P6 trae dos alas solares de 73 m de punta a punta, montadas por ahora encima de Unity.' },
  { id:'STS‑98', d:'2001-02-07', veh:'shuttle', orb:'Atlantis', site:'k39a', add:['destiny'], t:'Destiny, el laboratorio', x:'El brazo del Atlantis saca a Destiny de la bodega y lo coloca frente a Unity. Desde ahora la estación hace ciencia de verdad.' },
  { id:'STS‑100', d:'2001-04-19', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['canadarm2'], t:'Canadarm2', x:'El brazo robótico canadiense, de 17,6 m. Puede «caminar» por la estación dando volteretas de un enchufe al siguiente.' },
  { id:'STS‑104', d:'2001-07-12', veh:'shuttle', orb:'Atlantis', site:'k39b', add:['quest'], t:'La esclusa Quest', x:'Ahora los astronautas pueden salir a caminar al espacio desde la estación sin necesitar el transbordador.' },
  { id:'4R', d:'2001-09-14', veh:'soyuzU', site:'b1', add:['pirs'], t:'Pirs, el muelle ruso', x:'Una Progress modificada trae a Pirs: esclusa rusa y puerto para naves. Funcionó 20 años, hasta 2021.' },
  { id:'STS‑110', d:'2002-04-08', veh:'shuttle', orb:'Atlantis', site:'k39b', add:['s0'], t:'S0: el centro de la armazón', x:'La viga central se monta encima de Destiny. De aquí crecerán los brazos de la armazón hacia ambos lados.' },
  { id:'STS‑111', d:'2002-06-05', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['mbs'], t:'La base móvil del brazo', x:'Un carrito que corre sobre rieles a lo largo de la armazón y lleva al Canadarm2 de un lado a otro.' },
  { id:'STS‑112', d:'2002-10-07', veh:'shuttle', orb:'Atlantis', site:'k39b', add:['s1'], t:'S1 y los radiadores', x:'Llega el tramo derecho S1 con radiadores que botan al espacio el calor de la estación.' },
  { id:'STS‑113', d:'2002-11-23', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['p1'], t:'P1', x:'Su gemelo, el tramo izquierdo P1. La armazón ya mide 44 m.' },
  { id:'STS‑115', d:'2006-09-09', veh:'shuttle', orb:'Atlantis', site:'k39b', add:['p3p4'], t:'P3/P4: alas que siguen al Sol', x:'Tras la pausa por el accidente del Columbia en 2003, vuelve el armado: dos alas nuevas y una junta giratoria gigante para que sigan al Sol.' },
  { id:'STS‑116', d:'2006-12-09', veh:'shuttle', orb:'Discovery', site:'k39b', add:['p5'], t:'P5', x:'Un tramo corto que sirve de separador. Los astronautas tuvieron que sacudir un panel de P6 que no se quería doblar.' },
  { id:'STS‑117', d:'2007-06-08', veh:'shuttle', orb:'Atlantis', site:'k39a', add:['s3s4'], t:'S3/S4', x:'Dos alas solares más, del lado derecho.' },
  { id:'STS‑118', d:'2007-08-08', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['s5'], t:'S5', x:'El separador del lado derecho. Viajó a bordo la maestra Barbara Morgan.' },
  { id:'STS‑120', d:'2007-10-23', veh:'shuttle', orb:'Discovery', site:'k39a', add:['harmony'], move:['p6'], t:'Harmony y el traslado de P6', x:'Llega Harmony. Además se mueve P6 desde encima de Unity hasta el extremo izquierdo; al abrir sus alas una se rasgó y Scott Parazynski la cosió en una caminata espacial.' },
  { id:'STS‑122', d:'2008-02-07', veh:'shuttle', orb:'Atlantis', site:'k39a', add:['columbus'], t:'Columbus, el laboratorio europeo', x:'Europa entra a la estación con su laboratorio, montado a la derecha de Harmony.' },
  { id:'STS‑123', d:'2008-03-11', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['jlp','dextre'], t:'La bodega de Kibō y Dextre', x:'Llega la primera pieza japonesa y Dextre, el robot canadiense de dos brazos que hace trabajos finos por fuera.' },
  { id:'STS‑124', d:'2008-05-31', veh:'shuttle', orb:'Discovery', site:'k39a', add:['kibo'], t:'Kibō', x:'El módulo más grande de la estación. La bodega se pasa a su techo.' },
  { id:'STS‑119', d:'2009-03-15', veh:'shuttle', orb:'Discovery', site:'k39a', add:['s6'], t:'S6: la última ala', x:'Con S6 la estación tiene sus 8 alas solares completas: 2 500 m² de paneles. Ya pueden vivir seis personas a bordo.' },
  { id:'STS‑127', d:'2009-07-15', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['jef'], t:'El «balcón» de Kibō', x:'Una plataforma en el vacío donde se dejan experimentos expuestos al espacio.' },
  { id:'5R', d:'2009-11-10', veh:'soyuzU', site:'b1', add:['poisk'], t:'Poisk', x:'Otra Progress modificada trae un puerto más para naves rusas, arriba de Zvezdá.' },
  { id:'STS‑130', d:'2010-02-08', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['tranquility','cupola'], t:'Tranquility y la Cúpula', x:'Llegan el módulo de la vida diaria y la gran ventana. La Cúpula viajó pegada al extremo de Tranquility y se movió abajo después.' },
  { id:'STS‑132', d:'2010-05-14', veh:'shuttle', orb:'Atlantis', site:'k39a', add:['rassvet'], t:'Rassvet', x:'Un módulo ruso que viajó en el transbordador estadounidense, debajo de Zariá.' },
  { id:'STS‑133', d:'2011-02-24', veh:'shuttle', orb:'Discovery', site:'k39a', add:['pmm'], t:'Leonardo se queda', x:'La última misión del Discovery deja a Leonardo pegado a Unity. En 2015 se mueve a Tranquility.' },
  { id:'STS‑134', d:'2011-05-16', veh:'shuttle', orb:'Endeavour', site:'k39a', add:['ams'], t:'AMS‑02: cazador de antimateria', x:'Un detector de partículas con un imán gigante que busca antimateria y materia oscura en los rayos cósmicos. Fue la última misión del Endeavour; en julio de 2011 el Atlantis cierra el programa del transbordador.' },
  { id:'CRS‑8', d:'2016-04-08', veh:'falcon9', site:'c40', add:['beam'], t:'BEAM, el módulo inflable', x:'Viaja doblado en el baúl de una Dragon. El Canadarm2 lo saca y lo pega a Tranquility; se infla el 28 de mayo de 2016.' },
  { id:'CRS‑9', d:'2016-07-18', veh:'falcon9', site:'c40', add:['ida2'], t:'IDA‑2: puerto para naves nuevas', x:'Un anillo de acoplamiento automático para las naves comerciales, colocado en una caminata espacial.' },
  { id:'CRS‑18', d:'2019-07-25', veh:'falcon9', site:'c40', add:['ida3'], t:'IDA‑3', x:'El segundo puerto automático, arriba de Harmony.' },
  { id:'CRS‑21', d:'2020-12-06', veh:'falcon9', site:'k39a', add:['bishop'], t:'Bishop: la primera esclusa privada', x:'Una esclusa comercial en forma de campana que sirve para soltar satélites pequeños y para botar basura.' },
  { id:'CRS‑22', d:'2021-06-03', veh:'falcon9', site:'k39a', add:['iro2B','iro4B'], t:'Las primeras alas iROSA', x:'Los paneles viejos pierden fuerza después de 20 años. Las iROSA se desenrollan como una alfombra encima de las alas originales.' },
  { id:'3R', d:'2021-07-21', veh:'protonM', site:'b200', add:['nauka','era'], rem:['pirs'], t:'Naúka (y adiós a Pirs)', x:'Pirs se suelta y se quema en la atmósfera para dejarle el lugar a Naúka, el nuevo laboratorio ruso, que llega con el Brazo Robótico Europeo.' },
  { id:'6R', d:'2021-11-24', veh:'soyuz21b', site:'b31', add:['prichal'], t:'Prichal', x:'La última pieza rusa por ahora: una esfera con seis puertas debajo de Naúka.' },
  { id:'CRS‑26', d:'2022-11-26', veh:'falcon9', site:'k39a', add:['iro3A','iro4A'], t:'iROSA 3 y 4', x:'Dos alas enrollables más, instaladas en caminatas espaciales en diciembre de 2022.' },
  { id:'CRS‑28', d:'2023-06-05', veh:'falcon9', site:'k39a', add:['iro1A','iro1B'], t:'iROSA 5 y 6', x:'Ya son seis. Cada iROSA genera más de 20 kilovatios.' },
  { id:'CRS‑35', d:'2026-10-13', veh:'falcon9', site:'cc', add:['iro2A','iro3B'], t:'iROSA 7 y 8: la estación completa', x:'Las dos últimas, instaladas en las caminatas del 29 de octubre y del 5 de noviembre de 2026 por Anil Menon y Joshua Kutryk. La estación queda con su configuración final.' },
];
// Elementos que se mueven de lugar con los años (fecha → posición del elemento)
export const MOVES = {
  pma2: [['1998-12-04','unity+x'],['2001-02-10','destiny+x'],['2007-11-14','harmony+x']],
  pma3: [['2000-10-14','unity-y'],['2007-08-30','unity-z'],['2010-02-17','tranquility-z'],['2017-03-26','harmony+y']],
  harmony: [['2007-10-26','unity-z'],['2007-11-14','destiny+x']],
  pmm: [['2011-03-01','unity-y'],['2015-05-27','tranquility+x']],
  jlp: [['2008-03-14','harmony+y'],['2008-06-06','kibo+y']],
  p6: [['2000-12-03','z1'],['2007-10-30','p5']],
  cupola: [['2010-02-12','tranquility-z'],['2010-02-15','tranquility-y']],
};
export const fdate = (s) => { const [y,m,d] = s.split('-').map(Number); return d + ' ' + ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'][m-1] + ' ' + y; };

// Naves acopladas en la configuración actual (aproximada, noviembre de 2026)
export const VISIT = [
  { id:'v-crew', tipo:'dragon', port:'harmony+x', t:'Crew Dragon (Crew‑13)' },
  { id:'v-cargo', tipo:'dragonc', port:'harmony+y', t:'Dragon de carga (CRS‑35)' },
  { id:'v-soyuz', tipo:'soyuz', port:'rassvet-y', t:'Soyuz MS‑29' },
  { id:'v-prog1', tipo:'progress', port:'zvezda-x', t:'Progress MS' },
  { id:'v-prog2', tipo:'progress', port:'poisk+y', t:'Progress MS' },
];

export const STATS = [
  ['Masa', '≈ 420 toneladas'], ['Largo de la armazón', '109 m'], ['Alas solares', '8 originales + 8 iROSA'],
  ['Volumen presurizado', '916 m³'], ['Habitable', '388 m³ (como una casa de 5 dormitorios)'],
  ['Altura', '≈ 415–420 km'], ['Velocidad', '7,66 km/s ≈ 27 600 km/h'], ['Una vuelta', '≈ 92,9 min'],
  ['Inclinación', '51,64°'], ['Habitada desde', '2 nov. 2000'], ['Países', '15 (5 agencias)'], ['Fin previsto', '≈ 2030, con una nave de SpaceX que la hará caer al Pacífico'],
];
