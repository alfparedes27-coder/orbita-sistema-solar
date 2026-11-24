# Órbita · Sistema Solar 3D

Simulador del sistema solar en 3D hecho en una sola página HTML, pensado para aprender jugando.

**Ábrelo aquí:** https://alfparedes27-coder.github.io/orbita-sistema-solar/

## Qué incluye

- Planetas, planetas enanos, 21 lunas, cometas y visitantes interestelares con órbitas de JPL (Small-Body Database y elementos keplerianos).
- Naves con trayectorias reales de JPL Horizons: Voyager 1 y 2, New Horizons, Pioneer 10 y 11, Cassini, Juno, Parker Solar Probe, Europa Clipper y el telescopio James Webb.
- El cielo visto desde Ecuador (Quito, Guayaquil, Cuenca, Galápagos…) con 5 000 estrellas reales y las 88 constelaciones.
- Eclipses de Sol y de Luna de 1990 a 2060, con su visibilidad desde cada ciudad.
- Satélites alrededor de la Tierra, estrellas vecinas, la nube de Oort y un modelo de la Vía Láctea.
- Un video corto y narración en voz alta para cada objeto.

## Fuentes y librerías

- Efemérides: NASA/JPL Horizons y Small-Body Database.
- Luna y eclipses: [Astronomy Engine](https://github.com/cosinekitty/astronomy) (Don Cross, MIT).
- Estrellas y constelaciones: [d3-celestial](https://github.com/ofrohn/d3-celestial) (Olaf Frohn, BSD), catálogo Hipparcos.
- Gráficos 3D: [three.js](https://threejs.org) (MIT).
- Mapas de los planetas y anillos de Saturno: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0).
- Lunas galileanas: [Björn Jónsson](https://bjj.mmedia.is/data/planetary_maps.html), a partir de datos NASA/PDS. Luna: NASA LRO/LROC. Marte: NASA/USGS Viking.
  Titán, Encélado, Tritón, Plutón y Caronte: NASA/JPL y New Horizons (dominio público).
- Relieve de la Luna: altímetro láser LOLA de la sonda LRO, del CGI Moon Kit de NASA SVS (dominio público).
- Edificios y puntos de interés de los sitios de lanzamiento: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).

## Cómo está organizado

- `index.html`: el simulador. Los datos pesados (efemérides JPL, catálogo de estrellas, mapa de las simulaciones) están en `datos/`
  y las texturas en `simulaciones/tex/`; se descargan aparte, se guardan en caché y los mapas de los planetas llegan en segundo plano.
- `simulaciones/`: una carpeta por simulación. Las tres cabinas (Dragon, Soyuz, Starliner) comparten `simulaciones/cabina/comun.js`
  y los dos recorridos por sitios de lanzamiento (Baikonur, Cabo Cañaveral) comparten el motor `simulaciones/sitio/motor.js` y `sitio.css`:
  cada página sólo contiene sus datos, su nave y su misión.
- `simulaciones/cabina/mandos.js`: mandos interactivos de las cabinas (interruptores, botones iluminados, teclados, perillas,
  manijas EJECT y de aborto), pantallas con encendido y páginas extra, y todos los sonidos sintetizados con Web Audio.
- `simulaciones/marte/rovers.js`: «Explorar el rover»: modelo 3D detallado, despiece por piezas con explicación, recorrido animado
  con suspensión rocker‑bogie y ficha de lanzamiento y llegada. Se añaden rovers de dos en dos. Los módulos fijos (Viking 1 y 2, Phoenix, InSight) y los que fallaron (Mars 2, 3 y 6, Beagle 2,
  Mars Polar Lander, Schiaparelli, con la reconstrucción de «Qué pasó»).
  El mismo visor tiene un entorno lunar y se abre desde el mapa de la Luna: Luna 9, Surveyor 3, Chang'e 3 con Yutu y Chang'e 4 con Yutu‑2
  (su CSS está en `simulaciones/marte/rovers.css`)
  usan el mismo visor: en «En acción» su brazo trabaja con cinemática inversa (la zanja con hielo, o SEIS, el escudo y el topo con el sismograma en vivo).
- `simulaciones/luna/`: mapa 3D de la Luna con relieve LOLA y la cara oculta; fichas completas (modelo 3D, cómo funciona, historia con fuentes y animación del alunizaje) de Apollo 11 a 17, Luna 9, 13, 17 y 21, Surveyor 1, 5, 6 y 7, Chang'e 3 a 6, Chandrayaan‑3 y SLIM; `paseo/` (caminata del Apolo 11 y rover del Apolo 17),
  `lunojod/` (el Lunojod 1 manejado desde la Tierra con 1,3 s de retraso y TV de una imagen cada pocos segundos) y
  `fases/` (la Luna de cada noche desde Ecuador, por qué cambia y los próximos eclipses, todo calculado con Astronomy Engine) y
  `regreso-libre/` (Apolo 13 y Artemis II por detrás de la Luna, con trayectorias integradas por `tools/hornear_regreso_libre.py`
  y desafíos: encender el Aquarius, la «caja de correo», el encendido a mano y el pilotaje de Orión junto a su etapa).
- `simulaciones/jpl/`: visita al JPL de la NASA. `trajes/` es la sala de trajes espaciales: línea del tiempo en 3D con modelos
  procedurales (tela con relieve de hilos, metal, visores con transparencia real), qué es cada pieza, capas, datos y fuentes.
  Se agregan trajes de dos en dos (listos: Mercury, Gemini G4C, Apollo A7L, Sokol KV‑2, Orlan‑MKS, EMU, ACES y SpaceX).
- `simulaciones/starbase/`: Starbase (Texas) en 3D: los cohetes de SpaceX en fila con su historia, la torre con los palillos,
  una galería para recorrer a pie (Dragon, motores, aletas, losetas, Starlink, trajes) y la línea del tiempo de Tesla.
  `starbase/dragon/`: el interior de la Crew Dragon, desde los asientos.
- `simulaciones/estaciones/`: estaciones espaciales, una por tanda. `iss/` es la Estación Espacial Internacional: órbita en vivo con SGP4
  (TLE de CelesTrak, `comun/satellite.min.js`) y pasos visibles desde Guayaquil; interior recorrible de los 18 módulos (`interior.js`, con volúmenes
  de colisión y rutas entre escotillas) con la Tierra real en las ventanas; armado de 1998 a 2026 (`datos.js`) y el lanzamiento de cada pieza
  en su Protón, transbordador, Soyuz o Falcon 9 (`lanzamiento.js`).
  `interactivo.js` agrega lo que se puede hacer por dentro: entrar a las cabinas para dormir (4 en Harmony, 2 kayutas en Zvezdá),
  salir a una caminata espacial desde la esclusa Quest (traje, despresurización y salida atado a la estación) y experimentos en los laboratorios
  (guantera con agua en Destiny, ventana de ciencia, huerto Veggie en Columbus y CubeSats desde Kibō). Las texturas se dibujan en canvas (`tex.js`): no descarga imágenes nuevas.
- `tools/hornear_osm.py`: descarga los edificios de OpenStreetMap y los guarda en `edificios-osm.bin` (formato compacto OSB2);
  un flujo de GitHub Actions lo ejecuta una vez al mes.
- `datos/incrustado.js`: copia de datos y texturas para abrir `index.html` con doble clic (sin servidor). En la web no se descarga.

## Uso sin internet

`index.html` funciona abriéndolo en el navegador, pero los videos de YouTube solo se ven dentro de la página cuando se sirve por http(s). En Windows, `Abrir simulador.bat` lo abre con un pequeño servidor local.
