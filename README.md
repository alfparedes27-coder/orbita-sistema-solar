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

## Uso sin internet

`index.html` funciona abriéndolo en el navegador, pero los videos de YouTube solo se ven dentro de la página cuando se sirve por http(s). En Windows, `Abrir simulador.bat` lo abre con un pequeño servidor local.
