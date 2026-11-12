"""Descarga los edificios de OpenStreetMap (Overpass) y guarda una copia compacta para cada sitio.

Formato binario «OSB2» (unas 7 veces más pequeño que el JSON de antes), comprimido con deflate sin cabecera:
  'OSB2' · tabla de cadenas · elementos · puntos de interés. Todos los números son varints (enteros con signo en zigzag);
  las coordenadas van en unidades de 1e-5° (≈1,1 m) y cada vértice se guarda como diferencia respecto al anterior;
  el primer vértice de cada elemento, respecto al primer vértice del elemento anterior (elementos en orden de Morton).
  Elemento: tipo (0 vía, 1 relación) · nº de etiquetas · (clave, valor)… · vía: nº de vértices · (Δlat, Δlon)…
            relación: nº de miembros · (rol, nº de vértices, (Δlat, Δlon)…)…
  Punto de interés: nombre · lat · lon.   La cadena 0 es la fuente/fecha.
El lector está en simulaciones/sitio/motor.js (leerOSB).

Uso:  python3 tools/hornear_osm.py              → descarga de Overpass y guarda los .bin
      python3 tools/hornear_osm.py --empaquetar → convierte los edificios-osm.json antiguos a .bin sin descargar nada
"""
import json, sys, time, urllib.request, urllib.parse, datetime, zlib, os

SITES = {
    'simulaciones/cabo-canaveral/edificios-osm.bin': ['28.44,-80.72,28.65,-80.53', '28.398,-80.64,28.42,-80.595'],
    'simulaciones/baikonur/edificios-osm.bin': ['45.90,63.27,46.02,63.60', '46.02,62.95,46.09,63.07', '45.59,63.26,45.65,63.37'],
}

def empaquetar(doc):
    """{'src','e','p'} (formato JSON antiguo, microgrados) → bytes del formato OSB2 comprimido.
    OSB2: coordenadas en unidades de 1e-5° (≈1,1 m); los elementos van ordenados por una curva de Morton y el primer
    vértice de cada uno se guarda como diferencia respecto al primer vértice del elemento anterior."""
    strings, idx = [], {}
    def S(t):
        t = '' if t is None else str(t)
        if t not in idx: idx[t] = len(strings); strings.append(t)
        return idx[t]
    S(doc.get('src', ''))
    out = bytearray()
    def V(n):                                   # varint sin signo
        while True:
            b = n & 0x7f; n >>= 7
            out.append(b | (0x80 if n else 0))
            if not n: break
    def Z(n): V((n << 1) ^ (n >> 63))           # zigzag para enteros con signo
    def absolutos(c):                           # microgrados con diferencias → lista de (lat, lon) en 1e-5°
        pts, la, lo = [], 0, 0
        for k in range(0, len(c), 2):
            la += c[k]; lo += c[k + 1]; pts.append((round(la / 10), round(lo / 10)))
        return pts
    def morton(la, lo):
        x, y, m = (lo + 18000000) & 0xffffff, (la + 9000000) & 0xffffff, 0
        for i in range(24): m |= ((x >> i) & 1) << (2 * i) | ((y >> i) & 1) << (2 * i + 1)
        return m
    elems = []
    for t, tags, c in doc['e']:
        geoms = [absolutos(c)] if t == 0 else [(role, absolutos(g)) for role, g in c]
        first = geoms[0] if t == 0 else (geoms[0][1] if geoms else [(0, 0)])
        if not first: continue
        elems.append((morton(*first[0]), t, tags, geoms, first[0]))
    elems.sort(key=lambda e: e[0])
    pois = doc.get('p', [])
    for _, t, tags, geoms, _ in elems:
        for k, v in tags.items(): S(k); S(v)
        if t == 1:
            for role, _ in geoms: S(role)
    for name, _, _ in pois: S(name)
    V(len(strings))
    for t in strings:
        b = t.encode('utf-8'); V(len(b)); out.extend(b)
    V(len(elems))
    pla, plo = 0, 0
    def pts(g, origen):
        nonlocal pla, plo
        V(len(g))
        la, lo = origen
        for (a, b) in g: Z(a - la); Z(b - lo); la, lo = a, b
    for _, t, tags, geoms, first in elems:
        out.append(t); V(len(tags))
        for k, v in tags.items(): V(S(k)); V(S(v))
        if t == 0: pts(geoms[0], (pla, plo))
        else:
            V(len(geoms))
            for role, g in geoms: V(S(role)); pts(g, (pla, plo))
        pla, plo = first
    V(len(pois))
    for name, la, lo in pois: V(S(name)); Z(round(la * 1e5)); Z(round(lo * 1e5))
    comp = zlib.compressobj(9, zlib.DEFLATED, -15)
    return b'OSB2' + comp.compress(bytes(out)) + comp.flush()

if '--empaquetar' in sys.argv:
    for path in SITES:
        j = path[:-4] + '.json'
        if not os.path.exists(j): print('no existe', j); continue
        data = empaquetar(json.load(open(j, encoding='utf-8')))
        open(path, 'wb').write(data); print(path, len(data), 'bytes (antes', os.path.getsize(j), ')')
    sys.exit(0)
MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter',
           'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
KEYS = ['name', 'name:en', 'name:es', 'operator', 'owner', 'brand', 'building', 'height', 'min_height', 'building:height', 'building:levels']

def enc(geom):
    out, pa, po = [], 0, 0
    for p in geom:
        a, b = round(p['lat'] * 1e6), round(p['lon'] * 1e6)
        out += [a - pa, b - po]; pa, po = a, b
    return out

def fetch(q, vacio_ok=False):
    body = urllib.parse.urlencode({'data': q}).encode()
    for ronda in range(8):
        for url in MIRRORS:
            try:
                req = urllib.request.Request(url, data=body, headers={'User-Agent': 'orbita-sistema-solar (educational project)'})
                with urllib.request.urlopen(req, timeout=300) as r:
                    d = json.load(r)
                if d.get('elements') or (vacio_ok and 'elements' in d and not d.get('remark')):
                    print('ok', url, len(d['elements'])); return d
                print('vacío', url, d.get('remark'))
            except Exception as e:
                print('falla', url, e)
        time.sleep(60 * (ronda + 1))
    sys.exit('Ningún servidor de Overpass respondió')

for path, boxes in SITES.items():
    d = fetch('[out:json][timeout:240];(' + ''.join(f'way["building"]({b});relation["building"]({b});' for b in boxes) + ');out geom;')
    e = []
    for x in d['elements']:
        t = {k: x['tags'][k] for k in KEYS if k in x.get('tags', {})}
        if x['type'] == 'way': e.append([0, t, enc(x.get('geometry', []))])
        else: e.append([1, t, [[m['role'], enc(m['geometry'])] for m in x.get('members', []) if m.get('geometry')]])
    # puntos de interés con nombre (museos, monumentos, miradores): [nombre, lat, lon]
    pd = fetch('[out:json][timeout:120];(' + ''.join(f'node["tourism"~"museum|attraction|viewpoint|artwork"]["name"]({b});node["historic"]["name"]({b});' for b in boxes) + ');out;', vacio_ok=True)
    pois = [[x['tags'].get('name:es') or x['tags'].get('name') or x['tags'].get('name:en'), round(x['lat'], 6), round(x['lon'], 6)] for x in pd['elements'] if 'lat' in x and x.get('tags')]
    data = empaquetar({'src': 'OpenStreetMap (ODbL) ' + datetime.date.today().isoformat(), 'e': e, 'p': pois})
    open(path, 'wb').write(data)
    print(path, len(e), 'edificios,', len(data), 'bytes')
