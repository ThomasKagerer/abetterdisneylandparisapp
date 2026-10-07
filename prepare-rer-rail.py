#!/usr/bin/env python3
"""Render-only RER A track: Chessy to Gare de Lyon. No pedestrian graph edits."""
import heapq,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def prepare():
 source=json.loads((ROOT/'sources/rer-a-reference.json').read_text())
 nodes={int(k):v for k,v in source['nodes'].items()};ways={w['id']:w for w in source['ways']};graph={}
 sx=111195*math.cos(math.radians(48.86))
 def distance(a,b):return math.hypot((a[0]-b[0])*sx,(a[1]-b[1])*111195)
 for w in ways.values():
  for a,b in zip(w['nodes'],w['nodes'][1:]):
   d=distance(nodes[a],nodes[b]);graph.setdefault(a,[]).append((b,d,w['id']));graph.setdefault(b,[]).append((a,d,w['id']))
 queue=[(0,source['startNode'],[])];seen=set()
 while queue:
  length,n,path=heapq.heappop(queue)
  if n in seen:continue
  seen.add(n)
  if n==source['endNode']:break
  for b,d,i in graph[n]:
   if b not in seen:heapq.heappush(queue,(length+d,b,path+[(n,b,i)]))
 else:raise ValueError('Disconnected RER A track')
 features=[]
 for a,b,i in path:
  w=ways[i]
  if not features or features[-1]['properties']['sourceId']!=i:
   features.append({'type':'Feature','properties':{'sourceId':i,'tunnel':w['tunnel'],'bridge':w['bridge']},'geometry':{'type':'LineString','coordinates':[nodes[a]]}})
  features[-1]['geometry']['coordinates'].append(nodes[b])
 stations=[{**s,'endpoint':i in [0,len(source['stations'])-1]} for i,s in enumerate(source['stations'])]
 coordinates=[nodes[path[0][0]]]+[nodes[b] for _,b,_ in path]
 return {'line':'RER A','lengthMeters':round(length),'bounds':[[min(p[1] for p in coordinates),min(p[0] for p in coordinates)],[max(p[1] for p in coordinates),max(p[0] for p in coordinates)]],
         'stations':stations,'tracks':{'type':'FeatureCollection','features':features},'attribution':'© OpenStreetMap contributors · Île-de-France Mobilités'}

def world_overview():
 return {'land':json.loads((ROOT/'sources/world-land-110m.json').read_text()),'paris':json.loads((ROOT/'sources/paris-outline.json').read_text()),'disneyPlaces':json.loads((ROOT/'sources/disney-world-locations.json').read_text())['places']}

if __name__=='__main__':
 p=ROOT/'dist/park-scene.json';scene=json.loads(p.read_text());scene['regionalRail']=prepare();scene['worldOverview']=world_overview();p.write_text(json.dumps(scene,ensure_ascii=False,separators=(',',':')))
 print('RER A:',scene['regionalRail']['lengthMeters'],'m;',len(scene['regionalRail']['stations']),'stations')
