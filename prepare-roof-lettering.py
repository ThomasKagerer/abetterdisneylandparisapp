#!/usr/bin/env python3
"""Text decals clipped to surveyed roof meshes; no billboard markers or invented names."""
import json,math,subprocess
from pathlib import Path
from shapely.geometry import shape,Polygon,Point,box
from shapely.ops import transform
from shapely import maximum_inscribed_circle,constrained_delaunay_triangles
ROOT=Path(__file__).resolve().parent
ORIGIN=[2.7782,48.8695];SX=111195*math.cos(math.radians(ORIGIN[1]));SY=111195
xy=lambda ll:((ll[0]-ORIGIN[0])*SX,(ll[1]-ORIGIN[1])*SY)

def build():
 scene=json.loads((ROOT/'dist/park-scene.json').read_text());park=json.loads((ROOT/'dist/park-data.json').read_text());osm=json.loads((ROOT/'osm-source.json').read_text())['elements'];names={e['type']+str(e['id']):e.get('tags',{}).get('name') for e in osm}
 polygons={f['id']:transform(lambda x,y:((x-ORIGIN[0])*SX,(y-ORIGIN[1])*SY),shape(f['geometry'])) for f in scene['features']['features'] if f['properties']['kind']=='building'}
 mesh=scene['roofMeshes']['vertices'];triangles=[]
 for i in range(0,len(mesh),18):
  pts=[mesh[j:j+3] for j in [i,i+6,i+12]];g=Polygon([(p[0],p[1]) for p in pts]);
  if g.area>.0001:triangles.append((g,pts))
 points=park['rides']+[r for r in park.get('services',[]) if r.get('serviceType')=='restaurant'];landmarkIds={id for l in scene['landmarks'] for id in l.get('sourceIds',[l['sourceId']])};labels=[];covered=[];flags=[]
 def flag(name,faces,source,rideIds,angle=0):
  peak=max((p for _,pts in faces for p in pts),key=lambda p:p[2]);x,y,z=peak;w=max(5,min(10,len(name)*.25));h=2.5;verts=[]
  for i in range(12):
   lo=i/12;hi=(i+1)/12
   for u,v in [(lo,1),(hi,1),(hi,0),(lo,1),(hi,0),(lo,0)]:wave=.12*math.sin(u*math.pi*2);verts.extend([x+u*w*math.cos(angle)-wave*math.sin(angle),y+u*w*math.sin(angle)+wave*math.cos(angle),z+4.3-v*h,u,v])
  flags.append(dict(name=name,sourceId=source,rideIds=rideIds,pole=[x,y,z,4.8],vertices=verts,color='#376c87'));covered.extend(rideIds)
 def project_label(name,center,angle,width,height,faces,source,rideIds=[]):
  ca,sa=math.cos(angle),math.sin(angle);cx,cy=center;local=lambda x,y:((x-cx)*ca+(y-cy)*sa,-(x-cx)*sa+(y-cy)*ca);patch=transform(lambda u,v:(cx+u*ca-v*sa,cy+u*sa+v*ca),box(-width/2,-height/2,width/2,height/2));verts=[]
  for g,pts in faces:
   if not g.intersects(patch):continue
   inter=g.intersection(patch)
   if inter.is_empty or inter.area<.0001:continue
   a,b,c=pts;den=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
   for tri in constrained_delaunay_triangles(inter).geoms:
    for x,y in list(tri.exterior.coords)[:3]:
     u=((x-a[0])*(c[1]-a[1])-(y-a[1])*(c[0]-a[0]))/den;v=((b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]))/den;z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2])+.10;px,py=local(x,y);verts.extend([round(x,4),round(y,4),round(z,4),round((px/width+.5),6),round(.5-py/height,6)])
  if verts and (width<max(3,min(6,len(name)*.2)) or max(verts[2::5])-min(verts[2::5])>height*.8):flag(name,faces,source,rideIds,angle);return
  if verts:labels.append(dict(name=name,sourceId=source,rideIds=rideIds,vertices=verts));covered.extend(rideIds)
 for f in scene['features']['features']:
  if f['properties']['kind']!='building' or f['id'] in landmarkIds:continue
  g=polygons[f['id']];contained=[r for r in points if g.covers(Point(xy((r.get('attractionLocation') or r['latlng'])[::-1])))];name=names.get(f['id']) or f['properties'].get('name')
  if not name and contained:name=min(contained,key=lambda r:Point(xy((r.get('attractionLocation') or r['latlng'])[::-1])).distance(g.centroid))['name']
  if not name or g.area<25:continue
  poly=max(getattr(g,'geoms',[g]),key=lambda x:x.area);circle=maximum_inscribed_circle(poly,tolerance=.3);center=list(circle.coords)[0];radius=circle.length
  if radius<1.5:continue
  rect=list(poly.minimum_rotated_rectangle.exterior.coords);_,a,b=max((math.dist(a,b),a,b) for a,b in zip(rect,rect[1:]));angle=math.atan2(b[1]-a[1],b[0]-a[0]);width=radius*1.8;height=radius*.63
  faces=[t for t in triangles if t[0].intersects(poly) and poly.buffer(.001).covers(t[0].centroid)]
  project_label(name,center,angle,width,height,faces,f['id'],[r['id'] for r in contained if r['id'].startswith('ride-')])
 # Exact roof triangles of the installed landmark models (including slopes/domes).
 for l in scene['landmarks']:
  if l['kind'] in ['castle','tower','entry','waterTower','station','chessy','balloon']:continue
  output=subprocess.run(['node','-e',"const m=require('./dist/park-models.js');const l=JSON.parse(process.argv[1]);process.stdout.write(JSON.stringify([...m.build({landmarks:[l],trees:[]},[])]));",json.dumps(l)],cwd=ROOT,capture_output=True,text=True,check=True);v=json.loads(output.stdout);faces=[]
  for i in range(0,len(v),18):
   pts=[v[j:j+3] for j in [i,i+6,i+12]];g=Polygon([(p[0],p[1]) for p in pts]);
   if g.area>.001 and min(p[2] for p in pts)>5:faces.append((g,pts))
  if l['kind']=='arendelle':flag('ARENDELLE',faces,l['sourceId'],[l['rideId']],l['modelAngle']);continue
  x,y=xy(l['latlng'][::-1]);a=l['modelAngle'];offset={'tower':(0,-l['length']*.22+2),'space':(0,-min(l['length'],l['width'])*.13),'castle':(0,1),'arendelle':(0,0)}[l['kind']];center=(x+offset[0]*math.cos(a)-offset[1]*math.sin(a),y+offset[0]*math.sin(a)+offset[1]*math.cos(a));w,h={'tower':(11,7),'space':(25,8),'castle':(14,7),'arendelle':(7,5)}[l['kind']];name={'tower':'THE HOLLYWOOD TOWER HOTEL','space':'SPACE MOUNTAIN','castle':'LE CHÂTEAU DE LA BELLE AU BOIS DORMANT','arendelle':'ARENDELLE'}[l['kind']];project_label(name,center,a,w,h,faces,l['sourceId'],[l['rideId']])
 scene['roofFlags']=flags;scene['roofLettering']={'labels':labels,'rideIds':sorted(set(covered))};(ROOT/'dist/park-scene.json').write_text(json.dumps(scene,ensure_ascii=False,separators=(',',':')));print('Roof flags:',len(flags),'Painted roof labels:',len(labels),'vertices:',sum(len(x['vertices'])//5 for x in labels))
if __name__=='__main__':build()
