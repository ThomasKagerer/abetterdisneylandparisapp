'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const data=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-data.json'));
const {Router}=require('../dist/routing.js'),{nearby}=require('../dist/show-times.js'),router=new Router(data);
assert.equal(data.rides.length,95);assert.equal(new Set(data.rides.map(x=>x.id)).size,95);assert.equal(data.defaultFavorites.length,15);
for(const source of ['official-attractions','official-entertainment'])for(const row of JSON.parse(fs.readFileSync(__dirname+'/../sources/'+source+'.json'))){if(!/Disneyland Park|Disney Adventure World/.test(row.details))continue;assert(data.rides.some(r=>r.officialUrl===row.url),'missing '+row.name);}
const start=data.rides[0].node;for(const r of data.rides){assert(Number.isFinite(router.tree(start).ds[r.node]),r.name+' reachable');assert(Number.isFinite(router.tree(r.node).ds[start]),r.name+' return path');}
const now=Date.parse('2026-10-05T10:00:00Z'),show=data.rides.find(r=>r.name==='Mickey’s PhilharMagic'),pos={latlng:data.nodes[show.node],accuracy:5};
const live=new Map([[show.themeparksId,{status:'OPERATING',showtimes:[{startTime:'2026-10-05T12:20:00+02:00'},{startTime:'2026-10-04T12:05:00+02:00'}]}]]);
assert.equal(nearby(data,live,router,pos,now,now).find(x=>x.ride.id===show.id).minutes,20);
assert.equal(nearby(data,live,router,null,now,now).length,0);assert.equal(nearby(data,live,router,{...pos,accuracy:100},now,now).length,0);assert.equal(nearby(data,live,router,pos,now,now-301000).length,0);
assert.equal(nearby({...data,rides:[{...show,approximateArea:true}]},live,router,pos,now,now).length,0);
live.get(show.themeparksId).status='CLOSED';assert.equal(nearby(data,live,router,pos,now,now).length,0);
live.get(show.themeparksId).status='OPERATING';live.get(show.themeparksId).showtimes=[{startTime:'2026-10-05T12:01:00+02:00'}];assert.equal(nearby(data,live,router,pos,now,now).length,0,'Indoor show starting in a minute misses the fifteen-minute arrival deadline');
live.get(show.themeparksId).showtimes=[{startTime:'2026-10-05T11:55:00+02:00'}];const started=nearby({...data,rides:[{...show,eventSetting:'outdoor'}]},live,router,pos,now,now).find(x=>x.ride.id===show.id);assert(started);assert.equal(started.started,true);assert.equal(started.minutes,5);
live.get(show.themeparksId).showtimes=[{startTime:'2026-10-05T11:44:59+02:00',endTime:'2026-10-05T12:30:00+02:00'}];assert.equal(nearby(data,live,router,pos,now,now).length,0,'Hide started shows older than fifteen minutes');
console.log('Passed: all 92 official entries + 3 stations, stable defaults, all 95 routes in both directions; current/nearby/reachable shows only, GPS and freshness, no past or unreachable starts.');

const multiRides=[0,1,2,3,4].map(i=>({id:'show-'+i,themeparksId:'live-'+i,name:'Show '+i,category:'show',node:i}));
const testNow=Date.parse('2026-10-05T12:00:00+02:00'),time=minutes=>new Date(testNow+minutes*60000).toISOString();
const liveList=new Map(multiRides.map((r,i)=>[r.themeparksId,{status:'OPERATING',showtimes:[{startTime:time(30+i*10)},{startTime:time(90+i*10)},{startTime:time(90+i*10)}]}]));
const testRouter={snap:()=>({node:0,distance:0}),tree:()=>({ds:[600,200,200,1000,300]})};
const list=nearby({rides:[...multiRides,{...multiRides[1],id:'alias'}]},liveList,testRouter,{latlng:[0,0],accuracy:5},testNow,testNow,{maxMeters:Infinity,maxMinutes:Infinity});
assert.equal(list.length,5,'No three-entry cap, includes later and more distant shows');assert.deepEqual(list.map(x=>x.ride.id),['show-1','show-2','show-4','show-0','show-3'],'Distance first, start time breaks ties');assert.equal(list.filter(x=>x.ride.themeparksId==='live-1').length,1,'One show even with duplicate catalogue entry and multiple times');assert.equal(list.find(x=>x.ride.id==='show-1').start,Date.parse(time(40)),'Next reachable performance selected once');
console.log('Passed: extended daily show list, distance/time order, one entry per show, next reachable time, distant/later shows included.');
