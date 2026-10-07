const assert=require('node:assert/strict'),{describe}=require('../dist/wait-times.js'),fs=require('node:fs');
const now=Date.parse('2026-10-05T09:30:00Z'),fresh={status:'OPERATING',minutes:25,updatedAt:'2026-10-05T09:29:00Z'};
assert.equal(describe(fresh,now).text,'25 Min. Wartezeit');
assert.equal(describe({...fresh,minutes:0},now).text,'0 Min. Wartezeit');
assert.equal(describe({...fresh,status:'CLOSED',minutes:0},now).text,'Geschlossen');
assert.equal(describe(undefined,now).kind,'unknown');
assert.equal(describe({...fresh,minutes:null},now).kind,'unknown');
assert.equal(describe({...fresh,minutes:-1},now).kind,'unknown');
assert.equal(describe({...fresh,minutes:601},now).kind,'unknown');
for(const entry of [{...fresh,updatedAt:null},{...fresh,updatedAt:'2026-10-05T09:00:00Z'},{...fresh,updatedAt:'2026-10-05T10:00:00Z'},{...fresh,stale:true}])assert.equal(describe(entry,now).kind,'stale');
assert.match(describe(fresh,now,true).text,/Letzter Stand/);
assert.match(describe({...fresh,status:'CLOSED'},now,true).text,/Letzter Stand: Geschlossen/);
const park=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../dist/park-data.json'))),ids=park.rides.filter(r=>r.queueTimes).map(r=>`${r.queueTimes.parkId}:${r.queueTimes.rideId}`);assert.equal(new Set(ids).size,51);assert.equal(ids.length,51);assert.ok(!park.rides.find(r=>r.name==='Schloss-Rundgang').queueTimes);
console.log('Passed: open/closed/zero/missing queues, invalid minutes, old/future timestamps, offline and partial failures, and 51 unique mapped rides.');

const {isClosed}=require('../dist/wait-times.js'),closed={...fresh,status:'CLOSED'};
assert(isClosed(closed));assert(isClosed({...closed,stale:true}),'Last known closure stays hidden until reopening');
assert(isClosed(closed,closed));assert(isClosed(closed,{status:'UNKNOWN'}));
assert(!isClosed(closed,fresh),'Operating Single Rider keeps the ride available');
assert(!isClosed(fresh,closed),'Closed Single Rider does not close the regular queue');
assert(!isClosed(undefined,closed),'Single Rider closure alone does not establish a ride closure');
assert(!isClosed(undefined));assert(!isClosed({status:'UNKNOWN'}));
console.log('Passed: regular closure, last known closure, independent Single Rider availability and unknown status.');

const {opportunity}=require('../dist/wait-times.js'),chance={...fresh,minutes:10,baselineMinutes:45,baselineSamples:4};
assert.equal(opportunity(chance,4,now).saved,35);
for(const entry of [{...chance,baselineSamples:2},{...chance,minutes:37},{...chance,status:'CLOSED'},{...chance,stale:true}])assert.equal(opportunity(entry,4,now),null);
assert.equal(opportunity(chance,11,now),null);assert.equal(opportunity(chance,4,now,true),null);
console.log('Passed: unusually short queue suggestions need fresh open data, sufficient baseline, major drop and worthwhile walking detour.');

const {comparison}=require('../dist/wait-times.js'),base={...fresh,baselineMinutes:100,baselineSamples:12,baselineWindow:'similar-hour-30d'};
for(const [minutes,tone,label]of [[120,'long-red','+20 %'],[110,'long-orange','+10 %'],[100,'normal','0 %'],[90,'short-yellow','-10 %'],[80,'short-green','-20 %'],[60,'short-green','-40 %'],[119,'long-orange','+19 %'],[91,'normal','-9 %']]){const c=comparison({...base,minutes});assert.equal(c.tone,tone);assert.equal(c.text,label);assert.match(describe({...base,minutes},now).text,new RegExp(label.replace('+','\\+')));}
assert.equal(comparison({...base,baselineMinutes:0}),null);assert.equal(comparison({...base,baselineSamples:2}),null);assert.equal(describe({...base,stale:true},now).comparison,null);assert.equal(describe({...base,status:'CLOSED'},now).comparison,null);assert.match(describe(base,now).detail,/ähnliche Tageszeit, letzte 30 Tage/);
console.log('Passed: exact percentage thresholds, neutral band, no zero baseline or stale/closed comparisons.');
const historic={...fresh,minutes:10,baselineMinutes:40,baselineSamples:null,baselineWindow:'source-all-time-average',baselineUpdatedAt:'2026-10-05'};
assert.equal(comparison(historic).text,'-75 %');assert.equal(opportunity(historic,2,now).saved,30);assert.match(describe(historic,now).detail,/historischer Durchschnitt von Queue-Times.com/);
assert.equal(comparison({...historic,baselineWindow:'recent-6h'}),null);
console.log('Passed: explicitly sourced historical means work without an invented sample count.');

assert(opportunity({...chance,minutes:36},0,now));assert(opportunity({...chance,baselineMinutes:10,minutes:8},4,now));
