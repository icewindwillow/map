"""Optional reproducible geography extraction. NOT needed to run or deploy the website.
Requires basemap==2.0.0, basemap-data==2.0.0 (GSHHG 2.3.6, LGPL-3.0-or-later).
Extracts the intermediate-resolution polygons without visual hand drawing.
The bundled overview is deliberately not a street/survey-level map.
"""
from pathlib import Path
import json
from mpl_toolkits.basemap import Basemap
root = Path(__file__).resolve().parents[1]
m = Basemap(projection='cyl', llcrnrlon=-17, llcrnrlat=46,
            urcrnrlon=12, urcrnrlat=65, resolution='i', area_thresh=0)
features = []
for idx, ((xs, ys), level) in enumerate(zip(m.coastpolygons, m.coastpolygontypes)):
    ring = [[round(float(x), 5), round(float(y), 5)] for x, y in zip(xs, ys)]
    if ring[0] != ring[-1]: ring.append(ring[0])
    features.append({'type':'Feature', 'properties':{'kind':'water' if level % 2 == 0 else 'land', 'level':int(level)},
                     'geometry':{'type':'Polygon', 'coordinates':[ring]}})
for seg in m._readboundarydata('countries')[0]:
    features.append({'type':'Feature','properties':{'kind':'boundary'},
                     'geometry':{'type':'LineString','coordinates':[[round(float(x),5),round(float(y),5)] for x,y in seg]}})
result = {'type':'FeatureCollection','metadata':{
    'source':'GSHHG 2.3.6 via basemap-data 2.0.0', 'license':'LGPL-3.0-or-later',
    'resolution':'intermediate (generalized geographic overview, not survey or street data)',
    'coordinateSystem':'WGS84 longitude, latitude', 'bounds':[-17,46,12,65],
    'sourceURL':'https://github.com/matplotlib/basemap',
    'notice':'Contains neighbouring land for geographical context; land fill does not denote UK membership.'},
    'features':features}
out = root/'public/data/uk-overview.geojson'
out.write_text(json.dumps(result, ensure_ascii=False, separators=(',',':')),encoding='utf-8')
print(f'{len(features)} geographic features, {out.stat().st_size} bytes')
