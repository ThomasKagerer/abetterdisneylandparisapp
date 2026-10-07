const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),DisneyShows=require('../dist/show-times.js');
let now=Date.parse('2026-10-06T14:25:00+02:00');const stamp=mins=>new Date(now+mins*60000).toISOString(),ride={category:'show',themeparksId:'show',eventSetting:'indoor'};
const live={showtimes:[{startTime:stamp(65),endTime:stamp(100)},{startTime:stamp(-40),endTime:stamp(-10)},{startTime:stamp(35),endTime:stamp(65)}]};
assert.equal(DisneyShows.nextPerformance(live,now).start,Date.parse(stamp(35)));
const ctx={DisneyShows,shows:new Map([['show',live]]),Date:class extends Date{static now(){return now;}}};vm.createContext(ctx);const s=fs.readFileSync(__dirname+'/../dist/app.js','utf8');vm.runInContext(s.slice(s.indexOf('function nextShowBadge('),s.indexOf('function showSchedule(')),ctx);
const html=ctx.nextShowBadge(ride);assert(html.includes('15:00'));assert(html.includes('in 35 Min.'));assert(html.includes('14:50'));assert.equal(ctx.nextShowBadge({category:'attraction'}),'');
now=Date.parse(stamp(35));assert(ctx.nextShowBadge(ride).includes('beginnt jetzt'));ctx.shows.set('show',{showtimes:[{startTime:new Date(now-600000).toISOString(),endTime:new Date(now+600000).toISOString()}]});assert(ctx.nextShowBadge(ride).includes('Läuft seit'));assert(!ctx.nextShowBadge(ride).includes('Spätestens'));
for(const live of [null,{}, {showtimes:'bad'}, {showtimes:[{startTime:'bad'}]}, {showtimes:[{startTime:'2026-10-07T12:00:00+02:00'}]}])assert.equal(DisneyShows.nextPerformance(live,now),null);
console.log('Passed: earliest next show today, countdown and Paris clock, indoor arrival, exact start, running-only show, missing/invalid/tomorrow schedules and rides without show labels.');
