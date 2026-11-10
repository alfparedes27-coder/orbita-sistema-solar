"""Descarga los edificios de OpenStreetMap (Overpass) y guarda una copia compacta para cada sitio.
Formato: {"v":1,"src":...,"e":[[tipo(0 vía,1 relación), etiquetas, coordenadas]]}; coordenadas en microgrados con diferencias."""
import json, sys, time, urllib.request, urllib.parse, datetime

SITES = {
    'simulaciones/cabo-canaveral/edificios-osm.json': ['28.44,-80.72,28.65,-80.53', '28.398,-80.64,28.42,-80.595'],
    'simulaciones/baikonur/edificios-osm.json': ['45.90,63.27,46.02,63.60', '46.02,62.95,46.09,63.07', '45.59,63.26,45.65,63.37'],
}
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
    json.dump({'v': 1, 'src': 'OpenStreetMap (ODbL) ' + datetime.date.today().isoformat(), 'e': e, 'p': pois}, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
    print(path, len(e))
