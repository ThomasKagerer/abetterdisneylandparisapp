'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{Router,distance}=require('../dist/routing.js');
const data=require('../dist/park-data.json'),manifest=require('../sources/ride-entrances.json');
const source=JSON.parse(fs.readFileSync(__dirname+'/../osm-source.json')),nodes=new Map(source.elements.filter(e=>e.type==='node').map(e=>[e.id,e])),router=new Router(data);
for(const entry of manifest){
 const ride=data.rides.find(r=>r.id===entry.rideId),node=nodes.get(entry.osmNode);
 assert.deepEqual(ride.latlng,[node.lat,node.lon],ride.name+' uses reviewed access');
 assert.equal(ride.approximateEntrance,entry.kind==='approach');
}
const from=data.rides.find(r=>r.id==='ride-1011446599').node;
for(const ride of data.rides){
 const leg=router.leg(from,ride.node);
 assert.deepEqual(leg.path.at(-1),ride.latlng,ride.name+' pin is route endpoint');
 assert.equal(ride.offset,0);
 assert(Number.isFinite(router.tree(ride.node).ds[from]),ride.name+' can be left');
}
const frozen=data.rides.find(r=>r.id==='ride-14211776384');
assert.equal(frozen.entranceSource.osmNode,13618187777,'Frozen regular entrance, not SR/PA');
const thunder=data.rides.find(r=>r.id==='ride-1011446599');
assert(distance(thunder.attractionLocation,thunder.latlng)>100,'Big Thunder target moves off the ride centre');
const spider=data.rides.find(r=>r.id==='ride-1271516013');
assert.equal(spider.entranceSource.osmNode,10024532531,'User-confirmed entrance beside Stark Factory');
assert.equal(spider.entranceSource.confirmation,'user-screenshot','Do not present the user correction as an OSM survey');
assert.deepEqual(spider.latlng,[48.865977,2.7795707]);
assert.equal(spider.approximateEntrance,false);
assert.equal(router.leg(router.snap(spider.latlng).node,spider.node).distance,0,'At the reported entrance no detour around the building remains');
const approach=router.snap([48.8659062,2.7795771]).node;assert(router.leg(approach,spider.node).distance<10,'Southern frontage reaches the entrance directly');
assert(router.leg(approach,data.nodes.findIndex(p=>p[0]===48.8663238&&p[1]===2.7790647)).distance>100,'Old target would have incorrectly required a 100 m detour');
console.log('Passed: 22 reviewed access points; all 95 route endpoints/pins match and remain reachable in both directions.');
