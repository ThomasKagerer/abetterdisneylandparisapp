#!/usr/bin/env python3
"""Disney Village scenery from existing OSM data. Never changes foot routing."""
import json,math
from pathlib import Path
from shapely.geometry import Polygon,LineString,Point,mapping
from shapely import make_valid
ROOT=Path(__file__).resolve().parent

def prepare(scene,osm):
 nodes={e['id']:[e['lon'],e['lat']] for e in osm if e['type']=='node'}
 ways={e['id']:e for e in osm if e['type']=='way'}
 def polygon(e):
  ids=e.get('nodes',[])
  if len(ids)<4 or ids[0]!=ids[-1] or not all(n in nodes for n in ids):return None
  g=make_valid(Polygon([nodes[n] for n in ids]))
  return g if g.geom_type in ['Polygon','MultiPolygon'] and not g.is_empty else None
 village=polygon(ways[188316843]);lake=polygon(ways[23942961]);balloon=polygon(ways[253840775])
 features={f['id']:f for f in scene['features']['features']}
 names=[(Point(nodes[e['id']]),e['tags']['name']) for e in osm if e['type']=='node' and e.get('tags',{}).get('name') and (e['tags'].get('shop') or e['tags'].get('amenity') in ['restaurant','cinema'])]
 def add(e,g,kind,**extra):
  id='way'+str(e['id']);t=e.get('tags',{});name=t.get('name','')
  if kind=='building' and not name:name=next((name for p,name in names if g.covers(p)),'')
  if id in features:
   f=features[id]
  else:
   geo=mapping(g)
   if geo['type']=='Polygon':geo={'type':'MultiPolygon','coordinates':[geo['coordinates']]}
   f={'type':'Feature','id':id,'properties':{'kind':kind,'height':8,'heightKnown':False,'wall':'#dec99e','roof':'#758e94','name':name,'osmId':str(e['id'])},'geometry':geo};scene['features']['features'].append(f);features[id]=f
  f['properties'].update(village=True,**extra)
  if name:f['properties']['name']=name
  return f
 add(ways[188316843],village,'village-ground')
 add(ways[23942961],lake,'water')
 palette=[('#e7c795','#426f83'),('#dca978','#ab6858'),('#dae2d5','#788b6d'),('#e3bca7','#648d98')]
 for e in ways.values():
  t=e.get('tags',{});ids=e.get('nodes',[])
  if e['id']==253840775:continue
  if t.get('building') or t.get('building:part') and t.get('name'):
   g=polygon(e)
   if g is None or not village.covers(g.representative_point()):continue
   wall,roof=palette[e['id']%len(palette)];add(e,g,'building',wall=wall,roof=roof)
  if t.get('highway') in ['footway','path','pedestrian','steps'] and t.get('access') not in ['private','no'] and len(ids)>1 and all(n in nodes for n in ids):
   line=LineString([nodes[n] for n in ids]);clipped=line.intersection(village)
   for i,g in enumerate(getattr(clipped,'geoms',[clipped])):
    if g.geom_type!='LineString' or g.length<.00001:continue
    id='village-path-'+str(e['id'])+'-'+str(i)
    if id not in features:
     f={'type':'Feature','id':id,'properties':{'kind':'village-path','village':True},'geometry':mapping(g)};scene['features']['features'].append(f);features[id]=f
 # The OSM floating polygon is the mooring deck, not a building-sized balloon.
 deck=add(ways[253840775],balloon,'building',customModel=True,roofTop=.35,height=.35,heightKnown=True)
 deck['properties']['name']='PanoraMagique'
 c=balloon.centroid;v=village.representative_point()
 scene['village']={'name':'Disney Village','sourceId':'way188316843','latlng':[v.y,v.x],'bounds':list(village.bounds),'balloon':{'name':'PanoraMagique','kind':'balloon','sourceId':deck['id'],'rideId':'landmark-panoramagique','latlng':[c.y,c.x],'height':115,'modelAngle':0,'angle':0,'length':22.5,'width':22.5,'diameter':22.5,'basketHeight':80,'maxFlightHeight':100,'geometrySource':'OSM mooring polygon; operator dimensions; illustrative flight pose'}}
 return scene['village']

if __name__=='__main__':
 p=ROOT/'dist/park-scene.json';scene=json.loads(p.read_text());prepare(scene,json.loads((ROOT/'osm-source.json').read_text())['elements']);p.write_text(json.dumps(scene,ensure_ascii=False,separators=(',',':')))
 print('Disney Village scenery:',sum(bool(f['properties'].get('village')) for f in scene['features']['features']))
