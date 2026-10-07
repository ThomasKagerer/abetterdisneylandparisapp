'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),scene=require('../dist/park-scene.json'),M=require('../dist/park-models.js');
const castle=scene.landmarks.find(l=>l.kind==='castle'),arendelle=scene.landmarks.find(l=>l.kind==='arendelle'),flags=scene.roofFlags;
assert(flags.length>0&&flags.length<20,'Small fallback set instead of flags over every roof');
const flag=flags.find(f=>f.sourceId===arendelle.sourceId);assert(flag);assert.equal(flag.name,'ARENDELLE');assert.equal(flag.pole[2],26);assert(!scene.roofLettering.labels.some(l=>l.sourceId===arendelle.sourceId));assert(!flags.some(f=>f.sourceId===castle.sourceId));
for(const f of flags){assert.equal(f.vertices.length,12*6*5);assert(f.pole.every(Number.isFinite));assert(f.vertices.every(Number.isFinite));for(let i=0;i<f.vertices.length;i+=5){assert(f.vertices[i+2]>f.pole[2]);assert(f.vertices[i+2]<f.pole[2]+f.pole[3]);assert(f.vertices[i+3]>=0&&f.vertices[i+3]<=1);assert(f.vertices[i+4]>=0&&f.vertices[i+4]<=1);}assert(!scene.roofLettering.labels.some(l=>l.sourceId===f.sourceId),'Flag and overlapping roof lettering must not coexist');}
const poles=M.build({roofFlags:flags},[]);assert(poles.every(Number.isFinite));assert(poles.byteLength<20000);assert.equal(M.flagLayer({},scene).id,'park-roof-flags');
const source=fs.readFileSync(__dirname+'/../dist/park-models.js','utf8');assert(source.includes('p.y+=.3*a_wave*sin'));assert(source.includes('if(this.paintTimer)clearTimeout(this.paintTimer)'),'Animation stops when the renderer is disposed');
assert(JSON.stringify(scene.worldOverview).length<160000);assert(scene.worldOverview.land.features.every(f=>Object.keys(f.properties).length===0),'World overview has land outlines only');
console.log('Passed: Arendelle pole at highest roof point, fallback-only cloth flags, roof text removed, castle excluded, finite compact geometry and animation cleanup.');
