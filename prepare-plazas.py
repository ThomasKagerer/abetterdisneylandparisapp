"""Add ground-level pedestrian-area visibility links to the captured OSM graph.
Requires shapely>=2.1. Existing node indices and ride entrances remain stable.
"""
import json, math
from pathlib import Path
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union, polygonize
from shapely import make_valid
from shapely.strtree import STRtree
from shapely.prepared import prep
BASE=Path(__file__).parent
SCALE_X=111195*math.cos(math.radians(48.87)); SCALE_Y=111195

def xy(p): return (p[1]*SCALE_X,p[0]*SCALE_Y)
def ll(p): return [round(p[1]/SCALE_Y,8),round(p[0]/SCALE_X,8)]
def ground(t): return t.get('layer','0')=='0' and t.get('level','0')=='0' and t.get('bridge') not in ('yes','viaduct')
def permitted(t): return t.get('access') not in ('private','no') and t.get('foot') not in ('private','no')
def pieces(g): return [g] if g.geom_type=='Polygon' else [p for p in getattr(g,'geoms',[]) if p.geom_type=='Polygon']
def add_visibility(data,areas,spacing=10):
    nodes=data['nodes']; edges=data['edges']; original=len(nodes)
    adjacency=[[] for _ in nodes]
    for a,b,_ in edges: adjacency[a].append(b)
    connected=set(); stack=[data['rides'][0]['node']]
    while stack:
        n=stack.pop()
        if n in connected:continue
        connected.add(n);stack.extend(adjacency[n])
    lookup={tuple(xy(p)):i for i,p in enumerate(nodes)}; added=set(); used=[]
    for area in areas:
        if area.area<5:continue
        # A 2 cm tolerance handles rounded source coordinates; holes stay excluded.
        safe=area.buffer(.02); allowed=prep(safe)
        candidates=[i for i in connected if allowed.covers(Point(xy(nodes[i])))]
        if not candidates:continue
        corners=[]
        outline=area.simplify(.2,preserve_topology=True)
        for ring in [outline.exterior,*outline.interiors]:
            for p in ring.coords[:-1]:
                key=tuple(p)
                if key not in lookup:lookup[key]=len(nodes);nodes.append(ll(p))
                corners.append(lookup[key])
        minx,miny,maxx,maxy=area.bounds
        for x in range(math.ceil(minx/spacing),math.floor(maxx/spacing)+1):
            for y in range(math.ceil(miny/spacing),math.floor(maxy/spacing)+1):
                p=(x*spacing,y*spacing)
                if allowed.contains(Point(p)):
                    if p not in lookup:lookup[p]=len(nodes);nodes.append(ll(p))
                    candidates.append(lookup[p])
        candidates=list(dict.fromkeys(candidates+corners))
        coords=[xy(nodes[i]) for i in candidates]
        tree=STRtree([Point(p) for p in coords])
        for k,a in enumerate(candidates):
            pa=coords[k]
            neighbors=tree.query(Point(pa),predicate='dwithin',distance=120)
            neighbors=sorted(neighbors,key=lambda j:math.dist(pa,coords[j]))[:len(candidates) if len(candidates)<250 else 48]
            for j in neighbors:
                b=candidates[j];key=(min(a,b),max(a,b))
                pb=coords[j];d=math.dist(pa,pb)
                if d<.05 or key in added:continue
                if allowed.covers(LineString([pa,pb])):
                    edges.extend([[a,b,round(d,3)],[b,a,round(d,3)]]);added.add(key)
        used.append(area)
        print('Area',len(used),'nodes',len(candidates),'links',len(added),flush=True)
    data['plazaGraph']={'baseNodes':original,'baseEdges':len(edges)-2*len(added),'areas':len(used),'links':len(added),'spacingMeters':spacing,'source':'OSM highway=pedestrian areas; holes, buildings, planting, water and barriers excluded'}
    return used

def build():
    data=json.loads((BASE/'dist/park-data.json').read_text())
    supplement=data.pop('smallPathGraph',None)
    if supplement:
        data['nodes']=data['nodes'][:supplement['baseNodes']];data['edges']=data['edges'][:supplement['baseEdges']];data['paths']=data['paths'][:supplement['basePaths']]
    old=data.pop('plazaGraph',None)
    if old:data['nodes']=data['nodes'][:old['baseNodes']];data['edges']=data['edges'][:old['baseEdges']]
    elements=json.loads((BASE/'osm-source.json').read_text())['elements']
    points={e['id']:xy([e['lat'],e['lon']]) for e in elements if e['type']=='node'}
    ways={e['id']:e for e in elements if e['type']=='way'}
    def line(w):
        ns=w.get('nodes',[])
        if len(ns)<2 or any(n not in points for n in ns):return None
        return LineString([points[n] for n in ns])
    def polygon(w):
        ns=w.get('nodes',[])
        if len(ns)<4 or ns[0]!=ns[-1]:return None
        path=line(w)
        return make_valid(Polygon(path.coords)) if path else None
    def geometry(e):
        if e['type']=='way':return polygon(e)
        rings={role:[] for role in ('outer','inner')}
        for m in e.get('members',[]):
            if m['type']!='way' or m['role'] not in rings:return None
            w=ways.get(m['ref']);path=line(w) if w else None
            if path is None:return None # Incomplete geometry cannot justify a shortcut.
            rings[m['role']].append(path)
        if not rings['outer']:return None
        outer=unary_union(list(polygonize(unary_union(rings['outer']))))
        inner=unary_union(list(polygonize(unary_union(rings['inner'])))) if rings['inner'] else Polygon()
        return make_valid(outer.difference(inner))
    area_elements=[e for e in elements if e['type'] in ('way','relation') and e.get('tags',{}).get('highway')=='pedestrian' and e.get('tags',{}).get('area')=='yes' and ground(e['tags']) and permitted(e['tags'])]
    member_ids={m['ref'] for e in area_elements if e['type']=='relation' for m in e.get('members',[]) if m['role']=='outer'}
    areas=[]
    for e in area_elements:
        if e['type']=='way' and e['id'] in member_ids:continue
        g=geometry(e)
        if g is not None:areas.extend(pieces(g))
    obstacles=[]
    for e in elements:
        t=e.get('tags',{})
        if e['type'] not in ('way','relation') or not ground(t):continue
        blocked=t.get('building') not in (None,'no') or t.get('natural') in ('water','scrub') or t.get('landuse') in ('grass','flowerbed','forest') or t.get('leisure') in ('garden','swimming_pool') or t.get('barrier') in ('hedge','wall','fence')
        if not blocked:continue
        g=geometry(e)
        if g is not None and not g.is_empty:obstacles.append(g)
        elif e['type']=='way' and t.get('barrier') in ('hedge','wall','fence'):
            path=line(e)
            if path is not None:obstacles.append(path.buffer(.3))
    blocked=unary_union(obstacles)
    park_bounds=box(*xy([48.8628,2.769]),*xy([48.8763,2.7825]))
    walkable=unary_union(areas).difference(blocked).intersection(park_bounds)
    add_visibility(data,pieces(walkable))
    (BASE/'dist/park-data.json').write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False))
    print(data['plazaGraph']);print('Nodes:',len(data['nodes']),'Edges:',len(data['edges']))
if __name__=='__main__':build()
