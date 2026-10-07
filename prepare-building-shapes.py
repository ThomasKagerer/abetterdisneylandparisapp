#!/usr/bin/env python3
"""Styled roof relief and facade signs follow park footprints. Never edits routing."""
import json,math
from pathlib import Path
from shapely.geometry import shape,Polygon,Point,LineString,mapping
from shapely import constrained_delaunay_triangles,make_valid
from shapely.ops import transform,split
ROOT=Path(__file__).resolve().parent
ORIGIN=[2.7782,48.8695];SX=111195*math.cos(math.radians(ORIGIN[1]));SY=111195
xy=lambda p:((p[0]-ORIGIN[0])*SX,(p[1]-ORIGIN[1])*SY)
ll=lambda p:[p[1]/SY+ORIGIN[1],p[0]/SX+ORIGIN[0]]

def build():
 scene=json.loads((ROOT/'dist/park-scene.json').read_text());park=json.loads((ROOT/'dist/park-data.json').read_text());osm=json.loads((ROOT/'osm-source.json').read_text())['elements'];tags={e['type']+str(e['id']):e.get('tags',{}) for e in osm};nodes={e['id']:[e['lon'],e['lat']] for e in osm if e['type']=='node'}
 import importlib.util
 spec=importlib.util.spec_from_file_location('village',ROOT/'prepare-village.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.prepare(scene,osm)
 # The OSM Fantasyland building includes the castle base. Remove only the
 # castle overlap from its render geometry; routing and the OSM source stay intact.
 castle_way=next(e for e in osm if e['type']=='way' and e['id']==1359852391)
 castle_footprint=Polygon([xy(nodes[n]) for n in castle_way['nodes']])
 castle_cut=castle_footprint.buffer(1.8)
 for f in scene['features']['features']:
  if f['id']=='way225604995' and not f['properties'].get('castleCutout'):
   g=transform(lambda x,y:((x-ORIGIN[0])*SX,(y-ORIGIN[1])*SY),shape(f['geometry']))
   carved=make_valid(g).difference(castle_cut)
   f['geometry']=mapping(transform(lambda x,y:(x/SX+ORIGIN[0],y/SY+ORIGIN[1]),carved))
   f['properties']['castleCutout']=True
 buildings=[f for f in scene['features']['features'] if f['properties']['kind']=='building'];geo={f['id']:transform(lambda x,y:((x-ORIGIN[0])*SX,(y-ORIGIN[1])*SY),shape(f['geometry'])) for f in buildings}
 def feature(id):return next(f for f in buildings if f['id']==id)
 def frame(g):
  ps=list(g.minimum_rotated_rectangle.exterior.coords);edges=[(math.dist(ps[i],ps[i+1]),ps[i],ps[i+1]) for i in range(4)];length,a,b=max(edges);angle=math.atan2(b[1]-a[1],b[0]-a[0]);width=min(e[0] for e in edges);c=g.centroid
  return c.x,c.y,angle,length,width
 def ride(name):return next(r for r in park['rides'] if r['name']==name)
 landmarks=[]
 for name,id,kind in [('Sleeping Beauty Castle','way1359852391','castle'),('The Twilight Zone Tower of Terror','way225080040','tower'),('Star Wars Hyperspace Mountain','relation3958220','space'),('A Celebration in Arendelle','way1338725885','arendelle')]:
  if id in geo:g=geo[id]
  else:
   e=next(e for e in osm if 'way'+str(e['id'])==id and e['type']=='way');g=Polygon([xy(nodes[n]) for n in e['nodes']])
  x,y,angle,length,width=frame(g);r=ride(name);maxh={'castle':43,'tower':59,'space':32,'arendelle':26}[kind]
  landmarks.append({'kind':kind,'rideId':r['id'],'name':name,'latlng':ll((x,y)),'angle':angle,'length':length,'width':width,'height':maxh,'sourceId':id})
  if id in geo:
   feature(id)['properties']['customModel']=kind!='tower'
   feature(id)['properties']['roofTop']=12 if kind=='tower' else maxh
   if kind=='tower':
    feature(id)['properties']['height']=12
    feature(id)['properties']['roof']='#9e9076'
    feature(id)['properties']['wall']='#b4a58c'
  entry=xy(r['latlng'][::-1]);landmarks[-1]['modelAngle']=math.atan2(entry[1]-y,entry[0]-x)+math.pi/2
  if kind=='castle':
   dragon=next(r for r in park['rides'] if r['id']=='ride-905816849')
   landmarks[-1]['dragon']={'rideId':dragon['id'],'latlng':dragon['latlng'],'offset':[-17.3,-1.1],'placement':'illustrative-lair'}
 # Keep decorative trees out of the visible cave; never changes the path graph.
 castle=next(l for l in landmarks if l['kind']=='castle');cx,cy=xy(castle['latlng'][::-1]);a=castle['modelAngle'];dx,dy=castle['dragon']['offset'];dragon_xy=(cx+dx*math.cos(a)-dy*math.sin(a),cy+dx*math.sin(a)+dy*math.cos(a))
 scene['trees']=[t for t in scene['trees'] if math.dist(xy(t),dragon_xy)>6.8]
 import importlib.util
 spec=importlib.util.spec_from_file_location('park_details',ROOT/'prepare-park-details.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 detail_landmarks,detail_signs=module.prepare(scene,park,osm);landmarks.extend(detail_landmarks);landmarks.append(scene['village']['balloon'])
 vertices=[];roof_count=0;roof_shapes={} 
 for f in buildings:
  p=f['properties'];g=make_valid(geo[f['id']]);t=tags.get(f['id'],{});cx,cy,angle,length,width=frame(g);nearest=min(park['rides'],key=lambda r:Point(xy((r.get('attractionLocation',r['latlng'])[1],r.get('attractionLocation',r['latlng'])[0]))).distance(g))
  land=nearest.get('land','');roof=t.get('roof:shape','flat')
  if roof=='flat' and 'roof:shape' not in t and g.area<550 and land in ['Main Street, U.S.A.','Fantasyland','Frontierland']:roof='gabled'
  if not p['heightKnown']:p['height']=4.0 if g.area<150 else 6.0 if g.area<550 else 10.0
  p['roofShape']=roof;p['roofTop']=max(p['height'],p.get('roofTop',0));p['roofShapeSource']='OSM' if 'roof:shape' in t else 'illustrative'
  if p.get('customModel'):continue
  roof_count+=1;roof_shapes[roof]=roof_shapes.get(roof,0)+1
  color=t.get('roof:colour',p['roof']);named={'orange':'#da9459','red':'#b86d65','grey':'#82919c','gray':'#82919c','blue':'#5386a7','green':'#698e74','brown':'#8f7155'};color=named.get(color,color)
  if not isinstance(color,str) or not color.startswith('#') or len(color)!=7:color=p['roof']
  p['roof']=color;co=[int(color[i:i+2],16)/255 for i in (1,3,5)]
  co=[c*.97 for c in co];ca,sa=math.cos(angle),math.sin(angle)
  project=lambda x,y:((x-cx)*ca+(y-cy)*sa,-(x-cx)*sa+(y-cy)*ca)
  local=transform(project,g);parts=[local]
  rise=min(6,max(1.4,width*.2)) if roof!='flat' else .35
  if roof in ['gabled','round','dome']:
   segments=14 if roof in ['round','dome'] else 2
   for i in range(1,segments):
    pos=-width/2+width*i/segments;line=LineString([(-length, pos),(length,pos)]);result=[]
    for part in parts:
     result.extend(split(part,line).geoms)
    parts=result
  for part in parts:
   for tri in constrained_delaunay_triangles(part).geoms:
    pts=list(tri.exterior.coords)[:3];world=[]
    for u,v in pts:
     curve=max(0,1-(v/(width/2 or 1))**2)
     extra=rise*math.sqrt(curve) if roof in ['round','dome'] else rise*max(0,1-abs(v)/(width/2 or 1)) if roof=='gabled' else .35
     z=p['height']+extra;p['roofTop']=max(p['roofTop'],z);world.append((cx+u*ca-v*sa,cy+u*sa+v*ca,z))
    a,b,c=world;u=[b[i]-a[i] for i in range(3)];w=[c[i]-a[i] for i in range(3)];normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];norm=math.hypot(*normal) or 1;shade=.8+.2*abs(normal[2])/norm
    for q in world:vertices.extend([round(n,4) for n in q]+[round(n*shade,4) for n in co])
 scene['roofMeshes']={'vertices':vertices,'buildings':roof_count,'shapes':roof_shapes};scene['landmarks']=landmarks
 # One facade sign per actual named attraction/show; select the wall toward its entrance.
 signs=[];seen=set();overrides={'The Twilight Zone Tower of Terror':['THE HOLLYWOOD','TOWER HOTEL'], 'Star Wars Hyperspace Mountain':['SPACE MOUNTAIN'],'Sleeping Beauty Castle':['LE CHÂTEAU','DE LA BELLE AU BOIS DORMANT'],'A Celebration in Arendelle':['ARENDELLE']}
 for r in park['rides']:
  if r['category'] not in ['attraction','show'] or r['id'] in ['ride-sleeping-beauty-castle','ride-1359852391','ride-905816849']:continue
  position=Point(xy((r.get('attractionLocation',r['latlng'])[1],r.get('attractionLocation',r['latlng'])[0])));entry=Point(xy(r['latlng'][::-1]));choices=[f for f in buildings if geo[f['id']].covers(position)]
  if not choices:continue
  f=min(choices,key=lambda f:geo[f['id']].area)
  if f['id']=='way1359852391':continue
  g=geo[f['id']];label=r['name'];key=(f['id'],label)
  if key in seen:continue
  seen.add(key);edges=[]
  for poly in getattr(g,'geoms',[g]):
   coords=list(poly.exterior.coords)
   for a,b in zip(coords,coords[1:]):
    line=LineString([a,b]);length=line.length
    if length>=7:edges.append((line.distance(entry),length,a,b,line))
  if not edges:continue
  _,length,a,b,line=min(edges);center=line.interpolate(.5,normalized=True);ex=(b[0]-a[0])/length;ey=(b[1]-a[1])/length;normal=(-ey,ex)
  if g.covers(Point(center.x+normal[0]*.2,center.y+normal[1]*.2)):normal=(-normal[0],-normal[1])
  width=min(16,length*.68);height=max(1.2,min(4,width*.28));z=max(height/2+.7,min(f['properties']['height']*.65,f['properties']['height']-height/2-.3));x,y=center.x+normal[0]*.25,center.y+normal[1]*.25
  landmark=next((l for l in landmarks if l['rideId']==r['id']),None)
  if landmark:
   x,y=xy(landmark['latlng'][::-1]);ang=landmark['modelAngle'];ex,ey=math.cos(ang),math.sin(ang);normal=(math.sin(ang),-math.cos(ang))
   if landmark['kind']=='tower':distance=landmark['length']*.22+10.3;width=13;height=5;z=39
   elif landmark['kind']=='arendelle':distance=6.3;width=8;height=2.4;z=9
   else:distance=10.8;width=12;height=3;z=10
   x+=normal[0]*distance;y+=normal[1]*distance
  signs.append({'rideId':r['id'],'name':label,'lines':overrides.get(label,[]),'center':[x,y,z],'axis':[ex,ey],'normal':normal,'width':width,'height':height,'color':f['properties']['roof']})
 for l in landmarks:
  if l['kind'] in ['castle','entry','waterTower','station','chessy','balloon']:continue
  if any(s['rideId']==l['rideId'] for s in signs):continue
  x,y=xy(l['latlng'][::-1]);a=l['modelAngle']+(.6 if l['kind']=='space' else 0);normal=[math.sin(a),-math.cos(a)];distance=6.3 if l['kind']=='arendelle' else min(l['length'],l['width'])/2+1
  signs.append({'rideId':l['rideId'],'name':l['name'],'lines':overrides.get(l['name'],[]),'center':[x+normal[0]*distance,y+normal[1]*distance,8],'axis':[math.cos(a),math.sin(a)],'normal':normal,'width':8 if l['kind']=='arendelle' else 16,'height':2.4 if l['kind']=='arendelle' else 3.4,'color':'#344b63'})
 signs=[s for s in signs if s['rideId']!='ride-disneyland-railroad-main-street-station']+detail_signs
 for s in signs:
  if s['rideId']==ride('The Twilight Zone Tower of Terror')['id']:s.update(lines=['The','HOLLYWOOD','TOWER','Hotel'],plaque=False,ink='#ede0c4',textStyle='hotel',height=6.2)
 scene['facadeSigns']=signs;scene.pop('photoRoofs',None)
 (ROOT/'dist/park-scene.json').write_text(json.dumps(scene,ensure_ascii=False,separators=(',',':')))
 print('Roof shapes',roof_shapes,'landmarks',len(landmarks),'facade signs',len(signs),'mesh bytes',len(vertices)*4)
if __name__=='__main__':build()
