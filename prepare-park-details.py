#!/usr/bin/env python3
"""Render-only architecture and visible railway lines from surveyed OSM geometry."""
import math,importlib.util
from pathlib import Path
from shapely.geometry import shape,Point,LineString
from shapely.ops import transform
ORIGIN=[2.7782,48.8695];SX=111195*math.cos(math.radians(ORIGIN[1]));SY=111195
xy=lambda p:((p[0]-ORIGIN[0])*SX,(p[1]-ORIGIN[1])*SY)
ll=lambda p:[p[1]/SY+ORIGIN[1],p[0]/SX+ORIGIN[0]]

def prepare(scene,park,osm):
 features={f['id']:f for f in scene['features']['features'] if f['properties']['kind']=='building'};nodes={e['id']:[e['lon'],e['lat']] for e in osm if e['type']=='node'}
 def frame(id):
  g=transform(lambda x,y:((x-ORIGIN[0])*SX,(y-ORIGIN[1])*SY),shape(features[id]['geometry']));ps=list(g.minimum_rotated_rectangle.exterior.coords);edges=[(math.dist(a,b),a,b) for a,b in zip(ps,ps[1:])];length,a,b=max(edges);return g.centroid,math.atan2(b[1]-a[1],b[0]-a[0]),length,min(e[0] for e in edges)
 details=[]
 for kind,id,name,rideId,height in [('entry','way1213008905','Disney Adventure World','landmark-adventure-world-entry',17.1),('waterTower','way49734660','Earffel Tower','landmark-earffel-tower',33),('station','way289661415','Disneyland Railroad Main Street Station','ride-disneyland-railroad-main-street-station',16),('chessy','way1165411503','Marne-la-Vallée–Chessy','landmark-chessy-station',16.5)]:
  c,a,length,width=frame(id)
  if kind=='entry':a=2.28943325072789;length=56;width=4
  if kind=='waterTower':a=2.28943325072789
  if kind=='station':a=a%math.pi;length=min(76,length);width=20
  if kind=='chessy':a=a-math.pi if math.sin(a)>0 else a
  sources={'entry':['way1213008905','way1213008906','way1213008907','way1213008908','way1213008909'],'station':['way289661415','way263826351']}.get(kind,[id])
  for source in sources:features[source]['properties']['customModel']=True;features[source]['properties']['roofTop']=height
  details.append({'kind':kind,'sourceId':id,'sourceIds':sources,'rideId':rideId,'name':name,'latlng':ll((c.x,c.y)),'angle':a,'modelAngle':a,'length':length,'width':width,'height':height,'geometrySource':'OSM footprint; photo-informed decorative details'})
 for id in ['way49734844','way49734845']:
  if id in features:features[id]['properties'].update(wall='#e2ba7c',roof='#b3ad98')
 entry=next(l for l in details if l['kind']=='entry');entryPt=Point(xy(entry['latlng'][::-1]));station=next(l for l in details if l['kind']=='station');stationPt=Point(xy(station['latlng'][::-1]));chessy=next(l for l in details if l['kind']=='chessy');chessyPt=Point(xy(chessy['latlng'][::-1]));bounds=scene['bounds']
 railways=[];fences=[]
 for e in osm:
  if e['type']!='way' or len(e.get('nodes',[]))<2 or not all(n in nodes for n in e['nodes']):continue
  t=e.get('tags',{});ps=[xy(nodes[n]) for n in e['nodes']];line=LineString(ps)
  if t.get('barrier')=='fence' and line.distance(entryPt)<140:
   clipped=line.intersection(entryPt.buffer(140))
   for g in getattr(clipped,'geoms',[clipped]):
    if g.geom_type=='LineString' and g.length>1:fences.append({'sourceId':'way'+str(e['id']),'points':[[p[0]/SX+ORIGIN[0],p[1]/SY+ORIGIN[1]] for p in g.coords]})
  kind=t.get('railway');elevated=e['id'] in [1213681808,1213681809]
  if kind not in ['narrow_gauge','tram','rail']:continue
  if not elevated and (t.get('tunnel')=='yes' or int(t.get('layer','0'))<0):continue
  if kind=='rail' and (line.distance(chessyPt)>400 or t.get('usage') not in ['main',None]):continue
  if kind in ['narrow_gauge','tram'] and not any(bounds[0]<=nodes[n][0]<=bounds[2] and bounds[1]<=nodes[n][1]<=bounds[3] for n in e['nodes']):continue
  # Clip normal mainline approaches to the station neighbourhood, not the whole region.
  clipped=line.intersection(chessyPt.buffer(400)) if kind=='rail' else line
  for g in getattr(clipped,'geoms',[clipped]):
   if g.geom_type!='LineString' or g.length<1:continue
   points=[]
   for a,b in zip(g.coords,list(g.coords)[1:]):
    length=math.dist(a,b);segments=max(1,math.ceil(length/6)) if elevated else 1
    for i in range(segments):
     p=(a[0]+(b[0]-a[0])*i/segments,a[1]+(b[1]-a[1])*i/segments);z=.12
     if elevated:
      X=(p[0]-stationPt.x)*math.cos(station['modelAngle'])+(p[1]-stationPt.y)*math.sin(station['modelAngle']);z=.12+4.13*max(0,min(1,(station['length']/2+14-abs(X))/12))
     points.append([round(p[0]/SX+ORIGIN[0],8),round(p[1]/SY+ORIGIN[1],8),round(z,3)])
   p=list(g.coords)[-1];z=points[-1][2] if elevated else .12;points.append([p[0]/SX+ORIGIN[0],p[1]/SY+ORIGIN[1],z])
   railways.append({'sourceId':'way'+str(e['id']),'type':kind,'gauge':int(t.get('gauge','914' if kind=='narrow_gauge' else '1435'))/1000,'points':points,'coveredStation':elevated})
 scene['railways']=railways;scene['fences']=fences
 spec=importlib.util.spec_from_file_location('rer_rail',Path(__file__).with_name('prepare-rer-rail.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);scene['regionalRail']=module.prepare();scene['worldOverview']=module.world_overview()
 # Small atlas decals lie on real fronts / the cylindrical tank, never roof billboards.
 signs=[]
 def sign(l,lines,center,width,height,color,ink,plaque=True,vertices=None,style=None,suffix=''):
  a=l['modelAngle'];c=xy(l['latlng'][::-1]);x,y,z=center;X=c[0]+x*math.cos(a)-y*math.sin(a);Y=c[1]+x*math.sin(a)+y*math.cos(a);s={'rideId':l['rideId']+suffix,'name':l['name'],'lines':lines,'center':[X,Y,z],'axis':[math.cos(a),math.sin(a)],'normal':[math.sin(a),-math.cos(a)],'width':width,'height':height,'color':color,'ink':ink,'plaque':plaque}
  if vertices:
   world=[]
   for i in range(0,len(vertices),5):x,y,z,u,v=vertices[i:i+5];world.extend([c[0]+x*math.cos(a)-y*math.sin(a),c[1]+x*math.sin(a)+y*math.cos(a),z,u,v])
   s['vertices']=world
  if style:s['textStyle']=style
  signs.append(s)
 def strip(point):
  v=[]
  for i in range(24):
   lo=i/24;hi=(i+1)/24
   for u,V in [(lo,1),(hi,1),(hi,0),(lo,1),(hi,0),(lo,0)]:v.extend([*point(u,V),u,V])
  return v
 for l in details:
  if l['kind']=='waterTower':
   v=strip(lambda u,V:(math.sin((u-.5)*1.75)*3.47,-math.cos((u-.5)*1.75)*3.47,25.15+(1-V)*2.65));sign(l,['Disney','ADVENTURE','WORLD'],(0,-3.47,26.475),5.8,2.65,'#e5d8b4','#2c514b',False,v,'water')
  elif l['kind']=='entry':
   v=strip(lambda u,V:((u-.5)*8.8,-1.705,13.45+.95*math.cos((u-.5)*math.pi)+(1-V)*1.05));sign(l,['DISNEY ADVENTURE WORLD'],(0,-1.705,14.7),8.8,1.05,'#d6a467','#2b514a',False,v)
  elif l['kind']=='station':sign(l,['DISNEYLAND PARK'],(0,-10.65,10.5),7.2,.85,'#305b50','#e3d2ad')
  elif l['kind']=='chessy':
   c=xy(l['latlng'][::-1]);a=l['modelAngle'];facade={**l,'modelAngle':a+math.pi/2,'latlng':ll((c[0]+math.cos(a)*l['length']/2,c[1]+math.sin(a)*l['length']/2))}
   sign(facade,['GARE DE MARNE-LA-VALLÉE–CHESSY'],(0,-2.78,6.6),17.2,1.0,'#6d9898','#eef0df',False);sign(facade,['SNCF'],(7.3,-2.78,5.3),2.3,.9,'#b74765','#fff8ea',True,suffix='-logo')
 return details,signs
