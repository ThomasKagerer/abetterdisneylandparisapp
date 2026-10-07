#!/usr/bin/env python3
"""Georeference IGN BD ORTHO onto existing roof geometry, preserving courtyard holes.

This uses an unedited WMS image of the public park, not Apple Maps content.
Walls and uncertain heights remain modelled; 2026 construction gets no 2024 texture.
Requires Shapely >= 2.1 (the existing plaza environment provides it).
"""
import json, math
from pathlib import Path
from shapely import constrained_delaunay_triangles, make_valid
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parent
ORIGIN = [2.7782, 48.8695]
SX = 111195 * math.cos(math.radians(ORIGIN[1]))
SY = 111195

def mercator(p):
    return [6378137 * math.radians(p[0]), 6378137 * math.log(math.tan(math.pi / 4 + math.radians(p[1]) / 2))]

def build():
    scene = json.loads((ROOT / 'dist/park-scene.json').read_text())
    meta = json.loads((ROOT / 'sources/ign-ortho.json').read_text())
    west, south, east, north = meta['bounds']
    mx0, my0, mx1, my1 = meta['mercatorBounds']
    clip = box(west, south, east, north)
    vertices, covered = [], []
    for feature in scene['features']['features']:
        props = feature['properties']
        if props['kind'] != 'building':
            continue
        # The southern 2026 expansion was a construction site in the 2024 flight.
        coords = [p for poly in feature['geometry']['coordinates'] for ring in poly for p in ring]
        if any(p[1] < 48.8668 and 2.7708 < p[0] < 2.776 for p in coords):
            continue
        start = len(vertices)
        for rings in feature['geometry']['coordinates']:
            shape = make_valid(Polygon(rings[0], rings[1:])).intersection(clip)
            triangles = constrained_delaunay_triangles(shape)
            for tri in triangles.geoms:
                for p in list(tri.exterior.coords)[:3]:
                    mx, my = mercator(p)
                    vertices.extend([round((p[0] - ORIGIN[0]) * SX, 4), round((p[1] - ORIGIN[1]) * SY, 4), props['height'] + 1.0, round((mx - mx0) / (mx1 - mx0), 7), round((my1 - my) / (my1 - my0), 7)])
        if len(vertices) > start:
            covered.append(feature['id'])
    assert vertices and len(vertices) % 15 == 0 and len(vertices) / 5 < 100000
    scene['photoRoofs'] = {'url': 'park-ortho.jpg', 'width': 2048, 'height': 2048, 'imageYear': 2024, 'source': 'IGN BD ORTHO · Licence Ouverte Etalab 2.0', 'sourceUrl': meta['sourceUrl'], 'origin': ORIGIN, 'bounds': meta['bounds'], 'buildingIds': covered, 'vertices': vertices}
    (ROOT / 'dist/park-scene.json').write_text(json.dumps(scene, ensure_ascii=False, separators=(',', ':')))
    print(f'{len(covered)} existing buildings; {len(vertices)//15} roof triangles; {len(vertices)*4:,} vertex-buffer bytes; one 2048x2048 photograph')

if __name__ == '__main__':
    build()
