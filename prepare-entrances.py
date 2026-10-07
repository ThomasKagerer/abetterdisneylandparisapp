#!/usr/bin/env python3
"""Apply reviewed OSM queue access points without inventing walkable connectors."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def apply(data, source, entrances):
    source_nodes = {e['id']: e for e in source['elements'] if e['type'] == 'node'}
    graph_nodes = {tuple(p): i for i, p in enumerate(data['nodes'])}
    rides = {r['id']: r for r in data['rides']}
    for entry in entrances:
        ride = rides[entry['rideId']]
        node = source_nodes[entry['osmNode']]
        point = (node['lat'], node['lon'])
        if point not in graph_nodes:
            raise ValueError(f"Access point missing from walking graph: {ride['name']}")
        ride.setdefault('attractionLocation', ride['latlng'][:])
        ride['node'] = graph_nodes[point]
        ride['approximateEntrance'] = entry['kind'] == 'approach'
        ride['entranceSource'] = dict(entry)
    # The pin, arrival detection and route must refer to the SAME walking access
    # point. Unreviewed access points remain explicitly approximate, not centres.
    for ride in data['rides']:
        ride.setdefault('attractionLocation', ride['latlng'][:])
        ride['latlng'] = data['nodes'][ride['node']][:]
        ride['offset'] = 0
    data['entranceRevision'] = 2
    return data

if __name__ == '__main__':
    path = ROOT / 'dist/park-data.json'
    data = apply(json.loads(path.read_text()), json.loads((ROOT / 'osm-source.json').read_text()),
                 json.loads((ROOT / 'sources/ride-entrances.json').read_text()))
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print('Applied reviewed access points; aligned all destination pins with route endpoints.')
