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
- Edificios y puntos de interés de los sitios de lanzamiento: © colaboradores de [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).

## Cómo está organizado

- `index.html`: el simulador. Los datos pesados (efemérides JPL, catálogo de estrellas, mapa de las simulaciones) están en `datos/`
  y las texturas en `simulaciones/tex/`; se descargan aparte, se guardan en caché y los mapas de los planetas llegan en segundo plano.
- `simulaciones/`: una carpeta por simulación. Las tres cabinas (Dragon, Soyuz, Starliner) comparten `simulaciones/cabina/comun.js`
  y los dos recorridos por sitios de lanzamiento (Baikonur, Cabo Cañaveral) comparten el motor `simulaciones/sitio/motor.js` y `sitio.css`:
  cada página sólo contiene sus datos, su nave y su misión.
- `simulaciones/marte/rovers.js`: «Explorar el rover»: modelo 3D detallado, despiece por piezas con explicación, recorrido animado
  con suspensión rocker‑bogie y ficha de lanzamiento y llegada. Se añaden rovers de dos en dos.
- `tools/hornear_osm.py`: descarga los edificios de OpenStreetMap y los guarda en `edificios-osm.bin` (formato compacto OSB2);
  un flujo de GitHub Actions lo ejecuta una vez al mes.
- `datos/incrustado.js`: copia de datos y texturas para abrir `index.html` con doble clic (sin servidor). En la web no se descarga.

## Uso sin internet

`index.html` funciona abriéndolo en el navegador, pero los videos de YouTube solo se ven dentro de la página cuando se sirve por http(s). En Windows, `Abrir simulador.bat` lo abre con un pequeño servidor local.
