'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),s=fs.readFileSync(__dirname+'/../dist/app.js','utf8');
const ctx={Date,Intl};vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf('function parisWaitDay('),s.indexOf('function renderDailyWaits(')),ctx);
const at=x=>Date.parse(x),entry=(start,end)=>({startedAt:at(start),finishedAt:at(end)}),now=at('2026-10-06T12:00:00Z');
let rows=ctx.dailyWaitTotals([entry('2026-10-05T21:30:00Z','2026-10-05T22:30:00Z'),entry('2026-10-06T08:00:00Z','2026-10-06T08:15:00Z')],{startedAt:now-600000},now);
assert.equal(rows[0].day,'2026-10-06');assert.equal(rows[0].waitedMs,55*60000);assert.equal(rows[0].liveMs,10*60000);assert.equal(rows[0].count,2);assert.equal(rows[1].waitedMs,30*60000);
for(const [day,hours] of [['2026-03-29',23],['2026-10-25',25]]){const previous=day==='2026-03-29'?'2026-03-28':'2026-10-24';assert.equal(ctx.nextParisMidnight(day)-ctx.nextParisMidnight(previous),hours*3600000);}
assert.equal(ctx.dailyWaitTotals([{startedAt:NaN,finishedAt:now},{startedAt:now+1,finishedAt:now+100}],null,now).length,0);
assert.equal(ctx.waitDuration(3661000),'1 Std. 1 Min. 01 Sek.');
console.log('Passed: summed completed and running waits, Paris midnight splitting, 23/25-hour DST days, invalid/future data, duration formatting.');
