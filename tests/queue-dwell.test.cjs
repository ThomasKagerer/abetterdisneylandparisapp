const assert=require('node:assert/strict'),{Dwell}=require('../dist/queue-dwell.js');
let d=new Dwell();for(let t=0;t<300000;t+=15000)assert.equal(d.observe('a',t),null);assert.equal(d.observe('a',300000),'a');assert.equal(d.observe('a',315000),null);d.observe(null,330000,false);for(let t=345000;t<=645000;t+=15000)assert.equal(d.observe('a',t),null);
d=new Dwell();d.observe('a',0);d.observe('a',299999);assert.equal(d.observe('a',300000),null,'background gap must reset dwell');d.observe(null,315000,false);d.observe('a',330000);assert.equal(d.observe('b',345000),null,'switching ride resets dwell');
console.log('Passed: five continuous minutes, one reminder per ride, no duplicates after leave, invalid fixes and long GPS gaps reset dwell.');

d=new Dwell();assert.equal(d.observe('target',0,true,true),'target','Arrival offers check-in immediately');assert.equal(d.observe('target',15000,true,true),null);for(let t=30000;t<=330000;t+=15000)assert.equal(d.observe('target',t),null,'Dwell must not duplicate the arrival offer');d=new Dwell();assert.equal(d.observe('target',0,false,true),null,'Inaccurate or paused GPS cannot imply arrival');
