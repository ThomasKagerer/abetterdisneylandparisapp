'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),{Router,distance}=require('../dist/routing.js');
const data=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-data.json')),meta=data.smallPathGraph,router=new Router(data);
assert.equal(meta.ways.length,8);assert(meta.refinedWays>300);assert.equal(meta.spacingMeters,5);
const old={...data,nodes:data.nodes.slice(0,meta.baseNodes),edges:data.edges.slice(0,meta.baseEdges)},base=new Router(old);
for(const target of [...data.rides,...data.toilets,...data.services])assert.deepEqual(data.nodes[target.node],old.nodes[target.node],'Every existing entrance stays stable');
const forward=router.tree(data.rides[0].node).ds,reverse=new Router({...data,edges:data.edges.map(([a,b,w])=>[b,a,w])}).tree(data.rides[0].node).ds;
for(let n=meta.baseNodes;n<data.nodes.length;n++){assert(Number.isFinite(forward[n]),'New path reachable');assert(Number.isFinite(reverse[n]),'New path returnable');}
// Both public arcades and the Fort Comstock building passage are included.
for(const id of [136940228,1223755259,40251275,40251292])assert(meta.ways.some(w=>w.way===id));
const source=JSON.parse(fs.readFileSync(__dirname+'/../osm-source.json')),ns=new Map(source.elements.filter(e=>e.type==='node').map(n=>[n.id,[n.lat,n.lon]]));
for(const way of meta.ways){const coords=source.elements.find(e=>e.type==='way'&&e.id===way.way).nodes.map(n=>ns.get(n));for(const [a,b] of coords.slice(0,-1).map((p,i)=>[p,coords[i+1]])){
 const middle=a.map((p,j)=>(p+b[j])/2),snap=router.snap(middle);assert(snap.distance<2.6,'GPS attaches to the captured small path, within 2.5 m plus rounding');
 const start=router.snap(a).node,end=router.snap(b).node;assert(router.leg(start,end).distance<=distance(a,b)+.03,'Mapped segment is directly navigable');
}}
// A long captured outer path also benefits from the denser location attachment.
const candidates=data.nodes.slice(meta.baseNodes);assert(candidates.some(p=>p[0]<48.868),'Whole Adventure World park refined');assert(candidates.some(p=>p[0]>48.872),'Whole Disneyland Park refined');
const py=String.raw`
import runpy,json
m=runpy.run_path('Disneyland/prepare-small-paths.py');build=m['build']
def n(i,lat,lon):return {'type':'node','id':i,'lat':lat,'lon':lon}
def w(i,ns,**tags):return {'type':'way','id':i,'nodes':ns,'tags':tags}
els=[n(1,48.87,2.775),n(2,48.87,2.776),n(3,48.8701,2.7755),n(4,48.8702,2.7755),n(5,48.8703,2.7755),n(6,48.8704,2.7755),n(7,48.8705,2.7755),n(8,48.8706,2.7755)]
for i,(a,b) in enumerate([(48.869,2.774),(48.872,2.774),(48.872,2.778),(48.869,2.778),(48.863,2.774),(48.866,2.774),(48.866,2.778),(48.863,2.778)],100):els.append(n(i,a,b))
els += [w(775180147,[100,101,102,103,100]),w(205734843,[104,105,106,107,104]),w(10,[1,3,2],highway='corridor',indoor='yes'),w(11,[1,4],highway='footway',access='private'),w(12,[1,5],highway='footway',access='permit'),w(13,[1,6],highway='footway',oneway='yes'),w(14,[1,7],highway='footway',name='Single Rider'),w(15,[7,8],highway='footway')]
d={'nodes':[[48.87,2.775],[48.87,2.776]],'edges':[[0,1,74],[1,0,74]],'paths':[],'rides':[{'node':0}]}
build(d,{'elements':els});assert [w['way'] for w in d['smallPathGraph']['ways']]==[10]
before=json.dumps(d,sort_keys=True);build(d,{'elements':els});assert json.dumps(d,sort_keys=True)==before,'Repeat generation must not accumulate nodes/edges'
print('ok')
`;
assert.equal(execFileSync('python3',['-c',py],{cwd:__dirname+'/../..',encoding:'utf8'}).trim(),'ok');
console.log('Passed: both parks, eight missing connected public passages/steps, dense GPS attachment, direct small segments, reachable return paths, stable entrances, no private/permit/queue shortcuts or invented junctions, repeatable generation.');
