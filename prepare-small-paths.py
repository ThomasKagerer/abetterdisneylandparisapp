#!/usr/bin/env python3
"""Supplement the captured graph with connected public footpaths and corridors.

Run after prepare-plazas.py. Keep every existing node/entrance index stable.
Use source vertices only: proximity alone never creates a junction across walls,
gardens or levels. Unconnected paths and queue/access-only paths stay excluded.
"""
import json, math, runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parent
inside=runpy.run_path(str(ROOT/'prepare-facilities.py'))['inside']

def distance(a,b):
    return math.hypot((a[0]-b[0])*111195,(a[1]-b[1])*111195*math.cos(math.radians((a[0]+b[0])/2)))

def restore(data):
    old=data.pop('smallPathGraph',None)
    if old:
        data['nodes']=data['nodes'][:old['baseNodes']]
        data['edges']=data['edges'][:old['baseEdges']]
        data['paths']=data['paths'][:old['basePaths']]

def build(data,source):
    restore(data)
    elements=source['elements']; points={e['id']:e for e in elements if e['type']=='node'}
    rings=[[[points[n]['lat'],points[n]['lon']] for n in e['nodes']] for e in elements if e['type']=='way' and e['id'] in (775180147,205734843)]
    assert len(rings)==2
    nodes=data['nodes'];edges=data['edges'];index={tuple(p):i for i,p in enumerate(nodes)}
    original=(len(nodes),len(edges),len(data['paths']));pairs={(a,b) for a,b,_ in edges}
    adj=[[] for _ in nodes];rev=[[] for _ in nodes]
    for a,b,_ in edges:adj[a].append(b);rev[b].append(a)
    def reachable(graph):
        seen=set();todo=[data['rides'][0]['node']]
        while todo:
            n=todo.pop()
            if n not in seen:seen.add(n);todo.extend(graph[n])
        return seen
    public=reachable(adj)&reachable(rev)
    candidates=[]
    for e in elements:
        t=e.get('tags',{})
        if e['type']!='way' or t.get('highway') not in ('footway','path','steps','pedestrian','corridor'):continue
        if t.get('area')=='yes' or t.get('oneway') in ('yes','1','-1') or t.get('oneway:foot') in ('yes','1','-1'):continue
        if t.get('access') in ('private','no','permit','customers') or t.get('foot') in ('private','no','permit'):continue
        if t.get('footway')=='queue' or any(x in t.get('name','').lower() for x in ('premier','single rider','stand-by','stand by')):continue
        if len(e['nodes'])<2 or any(n not in points for n in e['nodes']):continue
        if any(points[n].get('tags',{}).get('access') in ('private','no','permit') or points[n].get('tags',{}).get('barrier') in ('wall','fence','hedge','block') for n in e['nodes']):continue
        coords=[(points[n]['lat'],points[n]['lon']) for n in e['nodes']]
        if not any(all(inside(p,ring) for p in coords) for ring in rings):continue
        candidates.append((e,coords))
    # Propagate only through exact shared vertices from the returnable public graph.
    attached={tuple(nodes[i]) for i in public};selected=[]
    while candidates:
        pending=[]
        for e,coords in candidates:
            if any(p in attached for p in coords):selected.append((e,coords));attached.update(coords)
            else:pending.append((e,coords))
        if len(pending)==len(candidates):break
        candidates=pending
    added=[];refined=0
    for e,coords in selected:
        ids=[]
        for p in coords:
            if p not in index:index[p]=len(nodes);nodes.append(list(p))
            ids.append(index[p])
        count=0;missing=False
        for a,b in zip(ids,ids[1:]):
            if a==b:continue
            if (a,b) not in pairs or (b,a) not in pairs:missing=True
            for u,v in ((a,b),(b,a)):
                if (u,v) not in pairs:
                    edges.append([u,v,round(distance(nodes[u],nodes[v]),3)]);pairs.add((u,v));count+=1
            # A GPS fix in the middle of a small path must attach there, rather
            # than to a distant endpoint or another nearby path. Only subdivide
            # captured linear paths; never the dense plaza visibility graph.
            length=distance(nodes[a],nodes[b]);steps=math.ceil(length/5)
            if steps>1:
                chain=[a]
                for step in range(1,steps):
                    p=tuple(round(nodes[a][j]+(nodes[b][j]-nodes[a][j])*step/steps,8) for j in (0,1))
                    if p not in index:index[p]=len(nodes);nodes.append(list(p))
                    chain.append(index[p])
                chain.append(b)
                for u,v in zip(chain,chain[1:]):
                    for x,y in ((u,v),(v,u)):
                        if (x,y) not in pairs:edges.append([x,y,round(distance(nodes[x],nodes[y]),3)]);pairs.add((x,y));count+=1
        if missing:
            data['paths'].append([list(p) for p in coords]);added.append({'way':e['id'],'highway':e['tags']['highway'],'edges':count})
        elif count:refined+=1
    data['smallPathGraph']={'baseNodes':original[0],'baseEdges':original[1],'basePaths':original[2],'ways':added,'refinedWays':refined,'spacingMeters':5,'addedNodes':len(nodes)-original[0],'addedEdges':len(edges)-original[1],'source':'Captured OSM public footways, paths, steps and corridors; exact shared junctions; no queues or private access'}
    return data['smallPathGraph']

if __name__=='__main__':
    path=ROOT/'dist/park-data.json';data=json.loads(path.read_text())
    result=build(data,json.loads((ROOT/'osm-source.json').read_text()))
    path.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False))
    print(json.dumps(result,ensure_ascii=False))
