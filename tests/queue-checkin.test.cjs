const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8');
const store=new Map(),ctx={Date,pointById:new Map([['ride',{name:'Ride'}]]),userKey:'preview',localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},renderQueueCheckin(){}};vm.createContext(ctx);
vm.runInContext('let queueCheckin=null;'+source.slice(source.indexOf('function saveQueueCheckin('),source.indexOf('function openQueueCheckin(')),ctx);
const now=Date.now(),q={id:'ride',startedAt:now-10*60000,minutes:30};assert.equal(ctx.queueProgress(q,now),'Gewartet: 10 Min. 00 Sek. · noch ca. 20 Min.');assert.equal(ctx.queueProgress({...q,minutes:null},now),'Gewartet: 10 Min. 00 Sek. · Restzeit unbekannt');assert.equal(ctx.queueProgress({...q,minutes:5},now),'Gewartet: 10 Min. 00 Sek.');
store.set('preview:queue-checkin',JSON.stringify(q));ctx.loadQueueCheckin();assert.equal(vm.runInContext('queueCheckin.minutes',ctx),30);ctx.saveQueueCheckin();assert.equal(JSON.parse(store.get('preview:queue-checkin')).startedAt,q.startedAt);
vm.runInContext('queueCheckin=null',ctx);store.set('preview:queue-checkin',JSON.stringify({...q,startedAt:now-2*86400000}));ctx.loadQueueCheckin();assert.equal(vm.runInContext('queueCheckin',ctx),null);
console.log('Passed: elapsed and remaining time, unknown estimate, zero is not guaranteed entry, reload persistence, expired timer rejected.');

assert.equal(ctx.queueProgress(q,now+61000),'Gewartet: 11 Min. 01 Sek. · noch ca. 19 Min.');assert.equal(ctx.recordActualWait(q,now+12500),'10 Min. 12 Sek.');const actual=JSON.parse(store.get('preview:actual-waits'));assert.equal(actual[0].waitedMs,612500);assert.equal(actual[0].finishedAt,now+12500);
