"""Merge the captured official catalogue; preserve favorites' existing identifiers."""
import json, math, re, unicodedata
from pathlib import Path
from difflib import SequenceMatcher
base=Path(__file__).parent
p=base/'dist/park-data.json'; data=json.loads(p.read_text()); old=json.loads((base/'sources/original-rides.json').read_text())
entities=json.loads((base/'sources/themeparks-entities.json').read_text())['children']
def norm(s):
 return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s.lower()).encode('ascii','ignore').decode())
def match(name,items,threshold=.89):
 scores=[(SequenceMatcher(None,norm(name),norm(e['name'])).ratio(),e) for e in items]
 score,e=max(scores,key=lambda x:x[0]);return e if score>=threshold else None
osm=json.loads((base/'osm-source.json').read_text())['elements']; coords={e['id']:[e['lat'],e['lon']] for e in osm if e['type']=='node'}
def osmpos(name):
 for e in osm:
  if e.get('tags',{}).get('name')==name:
   pts=[coords[n] for n in e.get('nodes',[]) if n in coords] if e['type']!='node' else [coords[e['id']]]
   if pts:return [sum(x[i] for x in pts)/len(pts) for i in (0,1)]
# Explicit aliases keep users' saved choices, visited flags and default favorites stable.
alias={'la-taniere-du-dragon':8,'la-galerie-de-la-belle-au-bois-dormant':19,'star-tours-the-aventures-continue':20,'ratatouille-the-adventure':30,'autopia':3,'le-pays-des-contes-de-fees':12}
landanchors={'Adventureland':old[1]['latlng'],'Fantasyland':old[19]['latlng'],'Frontierland':old[17]['latlng'],'Discoveryland':old[20]['latlng'],'Main Street U.S.A.':osmpos('Main Street Vehicles'),'World Premiere Plaza':osmpos('Animation Academy'),'Avengers Campus':old[32]['latlng'],'Worlds of Pixar':old[31]['latlng'],'World of Frozen':old[26]['latlng'],'Adventure Way':old[29]['latlng']}
explicit={'Sleeping Beauty Castle':old[19]['latlng'],'Disney Stars on Parade':[48.87272360314155,2.7770224213600163],'Mickey’s Halloween Celebration':[48.87272360314155,2.7770224213600163],'Meet Mickey Mouse':osmpos('Meet Mickey Mouse'),'Princess Pavilion: A Royal Invitation':osmpos('Princess Pavilion'),'Hero Training Center':osmpos('Hero Training Center')}
# Snap only to the connected pedestrian component used by existing ride entrances.
adj=[[] for _ in data['nodes']];rev=[[] for _ in adj]
for a,b,w in data['edges']:adj[a].append(b);rev[b].append(a)
def reachable(graph,start):
 seen={start};stack=[start]
 while stack:
  for n in graph[stack.pop()]:
   if n not in seen:seen.add(n);stack.append(n)
 return seen
start=old[0]['node'];connected=reachable(adj,start)&reachable(rev,start)
def distance(a,b):return math.hypot((a[0]-b[0])*111195,(a[1]-b[1])*111195*math.cos(math.radians(a[0])))
result=[];used=set()
for filename in ['official-attractions.json','official-entertainment.json']:
 for e in json.loads((base/'sources'/filename).read_text()):
  if 'Disneyland Park' not in e['details'] and 'Disney Adventure World' not in e['details']:continue
  slug=e['url'].rstrip('/').split('/')[-1];r=old[alias[slug]] if slug in alias else match(e['name'],old)
  if r and r['id'] in used:r=None
  park='Disneyland Park' if 'Disneyland Park' in e['details'] else 'Disney Adventure World'
  land=e['details'].split(park+',')[-1].replace('Closed','').strip() if park+',' in e['details'] else ''
  category='attraction' if filename=='official-attractions.json' else 'character' if 'Character Experiences' in e['details'] else 'show'
  entity=match(e['name'],entities,.94)
  loc=entity.get('location',{}) if entity else {};pos=[loc.get('latitude'),loc.get('longitude')]
  area=False;source='ThemeParks.wiki'
  if e['name'] in explicit and explicit[e['name']]:pos=explicit[e['name']];source='OpenStreetMap / venue'
  if not all(isinstance(x,(int,float)) for x in pos):pos=osmpos(e['name']);source='OpenStreetMap'
  if not pos:pos=landanchors.get(land,old[19 if park=='Disneyland Park' else 33]['latlng']);area=True;source='Official land; approximate area'
  if r:r=dict(r)
  else:
   node=min(connected,key=lambda n:distance(pos,data['nodes'][n]));r={'id':'ride-'+slug,'name':e['name'],'park':park,'latlng':pos,'node':node,'offset':round(distance(pos,data['nodes'][node])),'type':category,'approximateEntrance':True,'locationSource':source,'approximateArea':area}
  r.update(officialName=e['name'],officialUrl=e['url'],category=category,land=land)
  if entity:r['themeparksId']=entity['id']
  if category=='attraction':
   height=re.search(r'Height: (Any Height|[0-9.]+ (?:cm|m))',e['details'])
   if height:
    h=height.group(1);r['minHeightCm']=0 if h=='Any Height' else round(float(h.split()[0])*(100 if h.endswith(' m') else 1))
   if 'Big Thrills' in e['details']:r['intensity']='strong'
   if slug=='autopia':r['accompaniedBelowCm']=132
  if 'Virtual Queue' in e['details']:r['bookingRequired']=True
  if 'Reserved viewing area option' in e['details']:r['reservedViewing']=True
  used.add(r['id']);result.append(r)
# Include all other railroad boarding stations, also listed in the current park API.
for e in entities:
 if e['name'].startswith('Disneyland Railroad ') and 'Main Street' not in e['name']:
  pos=[e['location']['latitude'],e['location']['longitude']];node=min(connected,key=lambda n:distance(pos,data['nodes'][n]));result.append({'id':'ride-'+e['externalId'].lower(),'name':e['name'],'park':'Disneyland Park','latlng':pos,'node':node,'offset':round(distance(pos,data['nodes'][node])),'type':'train','category':'attraction','minHeightCm':0,'themeparksId':e['id'],'approximateEntrance':True})
# Map each additional destination only to its own standby queue (no single rider duplicates).
for park in [4,28]:
 queues=json.loads((base/f'sources/queues-{park}.json').read_text())
 entries=[r for land in queues.get('lands',[]) for r in land['rides'] if 'Single Rider' not in r['name']]
 for r in result:
  if r.get('queueTimes') or (r['park']=='Disneyland Park')!=(park==4):continue
  q=match(r.get('officialName',r['name']),entries,.96)
  if r['name']=='Starport':q=next(x for x in entries if x['id']==4573)
  if r['name']=='Princess Pavilion: A Royal Invitation':q=next(x for x in entries if x['id']==24)
  if q:r['queueTimes']={'parkId':park,'rideId':q['id']}
assert {r['id'] for r in old}<= {r['id'] for r in result},'Existing rides must remain'
data['rides']=sorted(result,key=lambda r:(r['park'],r['name'].casefold()));data['catalogue']={'updatedAt':'2026-10-05','officialAttractions':50,'officialEntertainment':42,'sources':['https://www.disneylandparis.com/en-gb/attractions','https://www.disneylandparis.com/en-gb/entertainment','https://api.themeparks.wiki/v1']}
p.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False));print(len(result),'destinations;',sum(r['category']=='show' for r in result),'shows')
for r in result:
 if r.get('approximateArea'):print('AREA',r['name'],r['land'])
