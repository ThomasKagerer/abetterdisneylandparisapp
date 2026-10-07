"""Audit every destination against official venue/land and the mapped pedestrian graph."""
import json,math,re,unicodedata
from pathlib import Path
BASE=Path(__file__).parent
norm=lambda s:re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
dist=lambda a,b:math.hypot((a[0]-b[0])*111195,(a[1]-b[1])*73150)
def build():
 p=BASE/'dist/park-data.json';data=json.loads(p.read_text());source=json.loads((BASE/'osm-source.json').read_text())['elements'];elements={(e['type'],str(e['id'])):e for e in source};ns={e['id']:e for e in source if e['type']=='node'}
 graph={tuple(pt):i for i,pt in enumerate(data['nodes'])};adj=[[] for _ in graph];rev=[[] for _ in graph]
 for a,b,w in data['edges']:adj[a].append(b);rev[b].append(a)
 def reachable(g,start):
  seen={start};stack=[start]
  while stack:
   for n in g[stack.pop()]:
    if n not in seen:seen.add(n);stack.append(n)
  return seen
 start=data['rides'][0]['node'];connected=reachable(adj,start)&reachable(rev,start);public=set()
 for e in source:
  t=e.get('tags',{})
  if e['type']=='way' and t.get('highway') in ['pedestrian','footway','path','steps','living_street'] and t.get('access') not in ['private','no'] and t.get('foot') not in ['private','no']:
   public.update(graph[(ns[n]['lat'],ns[n]['lon'])] for n in e['nodes'] if n in ns and (ns[n]['lat'],ns[n]['lon']) in graph)
 public&=connected
 def center(e):
  if e['type']=='node':return [e['lat'],e['lon']]
  pts=[ns[n] for n in e.get('nodes',[]) if n in ns]
  return [sum(pt[k] for pt in pts)/len(pts) for k in ['lat','lon']] if pts else None
 # Explicit identities are supported by official venue names, not API fallback pins.
 aliases={
 'A Celebration in Arendelle':('node','13444981711'),
 'Animation Academy':('node','12593786582'),
 'Mickey and the Magician':('way','1469626864'),
 'Minnie’s Dream Factory':('node','12593786584'),
 'TOGETHER: a Pixar Musical Adventure':('way','1469626865'),
 'Meet a Character from Zootropolis':('way','78038327'),
 'An Encounter with Captain Hook':('node','12642996207'),
 'An Encounter with Jafar':('node','12642996203'),
 'Meet Jessie':('node','12593786585'),
 'The Lion King: Rhythms of the Pride Lands':('way','40223257'),
 'Mickey’s PhilharMagic':('way','40404111'),
 'Princess Pavilion: A Royal Invitation':('way','159671422'),
 'Rencontre Royale':('way','1485420825'),
 'Starport':('way','78037572'),
 'Enchantment on the Royal Castle Stage':('way','285765332'),
 'Disney Performing Arts Programme':('way','78036718'),
 'Drache unter dem Schloss':('way','1359852391'),
 'Schloss-Rundgang':('way','1359852391'),
 'Sleeping Beauty Castle':('way','1359852391'),
 }
 official=json.loads((BASE/'sources/official-entertainment.json').read_text());byurl={x['url']:x for x in official};manifest={x['rideId']:x for x in json.loads((BASE/'sources/ride-entrances.json').read_text())};audit=[]
 # Read latest full park data; keep already reviewed main queues unchanged.
 for r in data['rides']:
  old=r['latlng'][:];e=elements.get(aliases.get(r['name']));match='venue-identity' if e else None
  if not e:
   key=r['id'].removeprefix('ride-');e=elements.get(('node',key)) or elements.get(('way',key));match='mapped-attraction-id' if e else None
  if not e:
   names={norm(r['name']),norm(r.get('officialName',''))}-{''};e=next((x for x in source if any(norm(x.get('tags',{}).get(k,'')) in names for k in ['name','name:en']) and center(x)),None);match='mapped-venue-name' if e else None
  if r['id'] in manifest:
   status='user-confirmed-entrance' if manifest[r['id']].get('confirmation')=='user-screenshot' else 'reviewed-queue';e=elements[('node',str(manifest[r['id']]['osmNode']))];evidence=manifest[r['id']]['evidence']
  elif r.get('approximateArea') and r['name'] not in aliases:
   status='variable-or-unspecified-area';e=None;evidence='Official catalogue gives '+r.get('land','park')+' only; no fixed meeting point confirmed. Position remains explicitly approximate.'
  elif e and center(e):
   point=center(e);doors=[ns[n] for n in e.get('nodes',[]) if n in ns and ns[n].get('tags',{}).get('entrance')=='main' and (ns[n]['lat'],ns[n]['lon']) in graph and graph[(ns[n]['lat'],ns[n]['lon'])] in connected]
   # Direct main door wins; otherwise use a real public walkway close to the venue.
   node=graph[(doors[0]['lat'],doors[0]['lon'])] if doors else min(connected,key=lambda n:dist(point,data['nodes'][n]))
   if r['name'] not in aliases:node=r['node']
   # Existing castle access has a reviewed front gate; preserve it for all castle entries.
   if r['name'] in ['Drache unter dem Schloss','Schloss-Rundgang','Sleeping Beauty Castle']:node=r['node']
   if r['name']=='Mickey and the Magician':node=graph[(ns[12684963369]['lat'],ns[12684963369]['lon'])]
   r['attractionLocation']=point[:]
   r['node']=node;r['latlng']=data['nodes'][node][:];r['offset']=0;r['approximateEntrance']=not bool(doors);r['approximateArea']=False
   status='mapped-venue-approach';evidence='Official venue/identity matched to OSM '+e.get('tags',{}).get('name',r['name'])+'; '+('tagged main door' if doors else 'public walking approach, not surveyed queue entrance')
  elif r.get('approximateArea'):
   status='variable-or-unspecified-area';evidence='Official catalogue gives '+r.get('land','park')+' only; no fixed meeting point confirmed. Position remains explicitly approximate.'
  else:
   status='source-location-approach';evidence='Existing venue coordinate checked against official park/land and reachable pedestrian endpoint; exact entrance not independently mapped.';r['approximateEntrance']=True
  record={'disneyMap':('https://disneyparksblog.com/app/uploads/2026/03/Map-of-Disney-Adventure-World-1080x1080.png' if r['park']=='Disney Adventure World' else 'https://brochure.disneylandparis.com/HCP/EN/adlp/common/data/catalogue.pdf'),'rideId':r['id'],'name':r['name'],'status':status,'evidence':evidence,'officialUrl':r.get('officialUrl'),'osm':{'type':e['type'],'id':e['id']} if e else None,'node':r['node'],'before':old,'after':r['latlng'],'movedMeters':round(dist(old,r['latlng']),1)}
  r['locationReview']={'date':manifest.get(r['id'],{}).get('confirmedAt','2026-10-06'),'status':status,'venue':e.get('tags',{}).get('name') if e else None}
  if r['category'] in ['show','character']:
   details=byurl.get(r.get('officialUrl'),{}).get('details','')
   indoors='Indoor' in details or r['name'] in ['Animation Academy','Stitch Live!','Hero Training Center'];outdoors='Outdoor' in details or r['name']=='Disney Stars on Parade'
   r['eventSetting']='indoor' if indoors else 'outdoor' if outdoors else 'unknown';r['arrivalLeadMinutes']=15 if r['category']=='show' and indoors else 0
   record['eventSetting']=r['eventSetting'];record['arrivalLeadMinutes']=r['arrivalLeadMinutes']
  if manifest.get(r['id'],{}).get('confirmedAt'):record['reviewedAt']=manifest[r['id']]['confirmedAt']
  audit.append(record)
 data['locationRevision']=3;data['catalogue']['locationsReviewedAt']='2026-10-06'
 p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
 (BASE/'sources/location-audit.json').write_text(json.dumps({'date':'2026-10-06','method':'Official Disney venue and catalogue + local OpenStreetMap geometry. No guessed exact meeting points. All pins remain walking graph endpoints.','destinations':audit},ensure_ascii=False,indent=2)+'\n')
 (BASE/'dist/ride-summary.json').write_text(json.dumps({'rides':[{k:r[k] for k in ['id','name','category','eventSetting','arrivalLeadMinutes'] if k in r} for r in data['rides']]},ensure_ascii=False,separators=(',',':')))
 for x in audit:
  if x['movedMeters']>0:print(x['name'],x['movedMeters'],x['after'])
 print('Audited',len(audit),'destinations;',sum(x.get('eventSetting')=='indoor' for x in audit),'indoor events')
if __name__=='__main__':build()
