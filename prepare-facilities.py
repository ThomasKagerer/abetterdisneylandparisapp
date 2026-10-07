#!/usr/bin/env python3
"""Public amenities inside the two mapped park boundaries, using existing paths."""
import json, math, unicodedata
from collections import deque
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def distance(a,b):
    return math.hypot((a[0]-b[0])*111195,(a[1]-b[1])*111195*math.cos(math.radians((a[0]+b[0])/2)))

def inside(p,ring):
    y,x=p;result=False
    for a,b in zip(ring,ring[1:]):
        if (a[0]>y)!=(b[0]>y) and x<(b[1]-a[1])*(y-a[0])/(b[0]-a[0])+a[1]:result=not result
    return result

def normalized(text):
    return ''.join(c for c in unicodedata.normalize('NFKD',text).lower() if c.isalnum())

def build(data,source):
    elements=source['elements'];nodes={e['id']:e for e in elements if e['type']=='node'}
    bounds={}
    for e in elements:
        if e['type']=='way' and e['id'] in (775180147,205734843):
            assert e['nodes'][0]==e['nodes'][-1]
            bounds['Disneyland Park' if e['id']==775180147 else 'Disney Adventure World']=[[nodes[i]['lat'],nodes[i]['lon']] for i in e['nodes']]
    assert len(bounds)==2
    graph=data['nodes'];index={tuple(p):i for i,p in enumerate(graph)};adj=[[] for _ in graph];reverse=[[] for _ in graph]
    for a,b,_ in data['edges']:adj[a].append(b);reverse[b].append(a)
    def reachable(edges):
        seen={data['rides'][0]['node']};q=deque(seen)
        while q:
            for i in edges[q.popleft()]:
                if i not in seen:seen.add(i);q.append(i)
        return seen
    public=reachable(adj)&reachable(reverse);candidates=[]
    for e in elements:
        t=e.get('tags',{});amenity=t.get('amenity')
        if amenity not in ('drinking_water','restaurant','fast_food','cafe') or t.get('access') in ('no','private') or t.get('drinking_water')=='no':continue
        shape=[e] if e['type']=='node' else [nodes[i] for i in e.get('nodes',[]) if i in nodes]
        if not shape:continue
        if len(shape)>1 and shape[0]['id']==shape[-1]['id']:shape=shape[:-1]
        poi=[sum(n['lat'] for n in shape)/len(shape),sum(n['lon'] for n in shape)/len(shape)]
        park=next((name for name,ring in bounds.items() if inside(poi,ring)),None)
        if not park:continue
        entrances=[n for n in shape if n.get('tags',{}).get('entrance') in ('main','yes') and n.get('tags',{}).get('access') not in ('private','no')]
        entrances.sort(key=lambda n:n.get('tags',{}).get('entrance')!='main')
        approach=[entrances[0]['lat'],entrances[0]['lon']] if entrances else poi
        node=min(public,key=lambda i:distance(approach,graph[i]));gap=distance(approach,graph[node])
        if gap>90:continue
        kind='water' if amenity=='drinking_water' else 'restaurant'
        name=t.get('name') or ('Trinkwasserstelle' if kind=='water' else 'Café' if amenity=='cafe' else 'Imbiss' if amenity=='fast_food' else 'Restaurant')
        candidates.append({'id':f"service-{kind}-{e['type']}-{e['id']}",'category':'facility','serviceType':kind,'amenity':amenity,'name':name,'park':park,'poiLocation':poi,'latlng':graph[node][:],'node':node,'offset':0,'approachMeters':round(gap),'approximateEntrance':tuple(approach) not in index or not entrances,'osm':{'type':e['type'],'id':e['id']},'openingHours':t.get('opening_hours'),'cuisine':t.get('cuisine'),'_rank':0 if entrances else 1 if e['type']=='node' else 2,'_named':bool(t.get('name'))})
    result=[]
    for p in sorted(candidates,key=lambda p:(p['_rank'],p['id'])):
        if any(q['park']==p['park'] and q['serviceType']==p['serviceType'] and distance(q['poiLocation'],p['poiLocation'])<60 and ((q['_named'] and p['_named'] and normalized(q['name'])==normalized(p['name'])) or (p['serviceType']=='water' and distance(q['poiLocation'],p['poiLocation'])<5)) for q in result):continue
        result.append(p)
    for p in result:p.pop('_rank');p.pop('_named')
    return sorted(result,key=lambda p:(p['park'],p['serviceType'],p['name'],p['id']))

if __name__=='__main__':
    path=ROOT/'dist/park-data.json';data=json.loads(path.read_text());data['services']=build(data,json.loads((ROOT/'osm-source.json').read_text()));path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
    from collections import Counter
    print(dict(Counter(p['serviceType'] for p in data['services'])))
