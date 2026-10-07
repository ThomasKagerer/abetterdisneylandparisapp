"""Build a local, geographic park scene; illustrative heights never affect routing."""
import json,math,re
from pathlib import Path
from collections import Counter
BASE=Path(__file__).parent;BOUNDS=[2.768,48.8625,2.7855,48.877];SX=111195*math.cos(math.radians(48.87));SY=111195

def area(r):return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:]))/2

def inside(p,r):
    x,y=p;c=False
    for a,b in zip(r,r[1:]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:c=not c
    return c

def in_bounds(p):return BOUNDS[0]<=p[0]<=BOUNDS[2] and BOUNDS[1]<=p[1]<=BOUNDS[3]
def ring(ids,nodes,outer=True):
    if len(ids)<4 or ids[0]!=ids[-1] or any(i not in nodes for i in ids):return None
    r=[[round(nodes[i][0],7),round(nodes[i][1],7)] for i in ids]
    if abs(area(r))<1e-12:return None
    if (area(r)>0)!=outer:r.reverse()
    return r

def stitched(lines):
    parts=[p[:] for p in lines if len(p)>1];result=[]
    while parts:
        p=parts.pop()
        while p[0]!=p[-1]:
            for i,q in enumerate(parts):
                if p[-1]==q[0]:p.extend(q[1:]);break
                if p[-1]==q[-1]:p.extend(list(reversed(q))[1:]);break
                if p[0]==q[-1]:p=q[:-1]+p;break
                if p[0]==q[0]:p=list(reversed(q))[:-1]+p;break
            else:break
            parts.pop(i)
        if p[0]==p[-1]:result.append(p)
    return result

def height(t,seed):
    v=t.get('height','');m=re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(m|ft|feet)?\s*',v)
    if m:return max(.5,min(70,float(m[1])*(.3048 if m[2] in ('ft','feet') else 1))),True
    try:return max(3,min(50,float(t['building:levels'])*3)),True
    except (KeyError,ValueError):return (2 if t.get('building')=='roof' else 5+seed%5),False

def build():
    elements=json.loads((BASE/'osm-source.json').read_text())['elements'];data=json.loads((BASE/'dist/park-data.json').read_text());nodes={e['id']:[e['lon'],e['lat']] for e in elements if e['type']=='node'};ways={e['id']:e for e in elements if e['type']=='way'}
    palettes={'Main Street, U.S.A.':('#f4cba3','#a85768'),'Fantasyland':('#f3d5b2','#cb6f99'),'Frontierland':('#cc985f','#75523b'),'Adventureland':('#e0bb77','#728344'),'Discoveryland':('#dccb79','#398d99'),'World Premiere Plaza':('#e7bfa9','#986b87'),'Worlds of Pixar':('#e8c298','#557ca8'),'Avengers Campus':('#91a5c4','#4e638a'),'World of Frozen':('#b5d6db','#527fa1')}
    def colors(p):
        closest=min(data['rides'],key=lambda r:((r['latlng'][1]-p[0])*SX)**2+((r['latlng'][0]-p[1])*SY)**2)
        return palettes.get(closest.get('land'),('#e3d7bc','#819397'))
    def kind(t):
        if t.get('building') not in (None,'no'):return 'building'
        if t.get('natural')=='water' or t.get('water') or t.get('leisure')=='swimming_pool':return 'water'
        if t.get('landuse') in ('forest','grass','flowerbed') or t.get('natural') in ('wood','scrub','heath') or t.get('leisure') in ('garden','park'):return 'green'
        if t.get('highway')=='pedestrian' and t.get('area')=='yes':return 'plaza'
        if t.get('natural') in ('bare_rock','scree'):return 'rock'
        return None
    features=[];used=set();trees=[]
    def feature(e,polys):
        t=e.get('tags',{});k=kind(t)
        if not k or not polys:return
        coordinates=[p for poly in polys for r in poly for p in r]
        if not any(in_bounds(p) for p in coordinates):return
        center=[sum(p[i] for p in polys[0][0][:-1])/(len(polys[0][0])-1) for i in (0,1)];h,known=height(t,e['id']);wall,roof=colors(center)
        props={'kind':k,'height':round(h,2),'heightKnown':known,'wall':wall,'roof':roof,'name':t.get('name',''),'osmId':str(e['id'])}
        if k=='green':props['color']='#83b96c' if t.get('landuse')=='forest' or t.get('natural')=='wood' else '#aed58a'
        features.append({'type':'Feature','id':str(e['type'])+str(e['id']),'properties':props,'geometry':{'type':'MultiPolygon','coordinates':polys}})
        if k=='green' and (t.get('landuse')=='forest' or t.get('natural')=='wood'):
            for poly in polys:
                outer=poly[0];xs=[p[0]*SX for p in outer];ys=[p[1]*SY for p in outer]
                for x in range(math.ceil(min(xs)/18),math.floor(max(xs)/18)+1):
                    for y in range(math.ceil(min(ys)/18),math.floor(max(ys)/18)+1):
                        p=[x*18/SX,y*18/SY];seed=(x*73856093^y*19349663)&0x7fffffff
                        if in_bounds(p) and inside(p,outer) and not any(inside(p,r) for r in poly[1:]):trees.append([round(p[0],7),round(p[1],7),seed%101])
    for e in elements:
        if e['type']!='relation' or e.get('tags',{}).get('type')!='multipolygon' or not kind(e.get('tags',{})):continue
        outer=[];inner=[];members=e.get('members',[])
        if any(m['type']=='way' and m['ref'] not in ways for m in members):continue
        for role,result in [('outer',outer),('inner',inner)]:
            lines=[ways[m['ref']]['nodes'] for m in members if m['type']=='way' and m.get('role','outer')==role]
            for ids in stitched(lines):
                r=ring(ids,nodes,role=='outer')
                if r:result.append(r)
        feature(e,[[r]+[h for h in inner if inside(h[0],r)] for r in outer])
        if outer:used.update(m['ref'] for m in members if m['type']=='way')
    for e in elements:
        if e['type']=='way' and e['id'] not in used and kind(e.get('tags',{})):
            r=ring(e.get('nodes',[]),nodes)
            if r:feature(e,[[r]])
        if e['type']=='node' and e.get('tags',{}).get('natural')=='tree' and in_bounds(nodes[e['id']]):trees.append([*nodes[e['id']],e['id']%101])
    # Stable cap bounds GPU work on phones; scene coordinates stay geographic.
    trees=list({(p[0],p[1]):p for p in trees}.values());trees=sorted(trees,key=lambda p:p[2])[:1800]
    for i,path in enumerate(data['paths']):
        if len(path)>1:features.append({'type':'Feature','id':'path'+str(i),'properties':{'kind':'path'},'geometry':{'type':'LineString','coordinates':[[p[1],p[0]] for p in path]}})
    payload={'source':'© OpenStreetMap contributors · ODbL · 2026-10-05','bounds':BOUNDS,'features':{'type':'FeatureCollection','features':features},'trees':trees,'note':'Geographic footprints and paths; building heights and landmark models are partly illustrative.'}
    (BASE/'dist/park-scene.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
    print(Counter(f['properties']['kind'] for f in features),'Trees',len(trees))
    import importlib.util
    spec=importlib.util.spec_from_file_location('building_shapes', BASE/'prepare-building-shapes.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.build()
    spec=importlib.util.spec_from_file_location('roof_lettering', BASE/'prepare-roof-lettering.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.build()
if __name__=='__main__':build()
