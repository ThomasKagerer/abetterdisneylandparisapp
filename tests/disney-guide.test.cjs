'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const guide=require('../dist/disney-guide.js'),park=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-data.json'));
assert.equal(guide.count,park.rides.length);
assert.equal(guide.get('__proto__'),null);
assert.equal(guide.get('missing'),null);
for(const ride of park.rides){
 const entry=guide.get(ride.id);assert(entry,'missing cached entry: '+ride.name);
 assert(entry.catalogueDate);assert(Array.isArray(entry.services));assert(Array.isArray(entry.access));
 assert(Array.isArray(entry.photos)&&entry.photos.length>=0);
 if(ride.officialUrl)assert(entry.photos.length>=1,'missing official photo: '+ride.name);
 assert.equal(new Set(entry.photos.map(p=>p.src)).size,entry.photos.length,'duplicate photos: '+ride.name);
 for(const photo of entry.photos){
  assert.match(photo.src,/^photos\/[a-f0-9]{16}\.(?:webp|gif)$/);assert.equal(new URL(photo.sourceUrl).hostname,'media.disneylandparis.com');
  assert(photo.credit.includes('Disney'));
  const bytes=fs.readFileSync(__dirname+'/../dist/'+photo.src);if(photo.src.endsWith('.gif'))assert(['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)));else{assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}assert(bytes.length>1000&&bytes.length<1000000);
 }
 if(entry.sourceUrl){const u=new URL(entry.sourceUrl);assert.equal(u.protocol,'https:');assert.equal(u.hostname,'www.disneylandparis.com');}
 assert(!('minutes'in entry)&&!('showtimes'in entry),'live fields must not be embedded in the static guide');
}
const spider=park.rides.find(r=>r.name==='Spider-Man W.E.B. Adventure'),entry=guide.get(spider.id);
assert(entry.services.includes('Single Rider vorhanden'));assert(entry.access.includes('Zustieg mit Rollstuhl möglich'));
assert(entry.access.includes('Laut Disney für Schwangere nicht geeignet'));
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),ctx={DisneyGuide:guide,esc:s=>String(s).replace(/</g,'&lt;'),Date,Number,showSchedule:()=>'<section>Live show schedule</section>'};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function ageData('),source.indexOf('function childBadge(')),ctx);vm.runInContext('const unavailablePhotos=new Set();'+source.slice(source.indexOf('function objectPhotoList('),source.indexOf('function openObjectPhoto('))+source.slice(source.indexOf('function cachedDisneyInfo('),source.indexOf('function renderObjectInfo(')),ctx);
const info=ctx.cachedDisneyInfo(spider);assert(info.includes('Vorab gespeichert'));assert(info.includes('Originalseite bei Disney'));assert(info.includes('Audiobeschreibung'));
const station=park.rides.find(r=>!r.officialUrl);assert(ctx.cachedDisneyInfo(station).includes('keinen eigenen Disney-Eintrag'));
assert(!info.includes('<iframe'),'external page must not load when cached details open');
assert.equal(guide.get(spider.id).photos.length,2);assert(info.includes('object-photo-strip'));assert(info.includes('data-photo-index="1"'));assert.equal(ctx.objectPhotos({id:'wc-1',name:'WC'}),'');assert.equal(ctx.objectPhotos(station),'');
vm.runInContext('unavailablePhotos.add('+JSON.stringify(entry.photos[0].src)+')',ctx);assert.equal(ctx.objectPhotoList(spider).length,1,'failed photos do not keep broken placeholders');
console.log('Passed: all 95 local entries, safe source URLs, authentic local WebP photos, complete distinct galleries, missing/failed image handling, live queues/schedules excluded.');

const galleries=require('../sources/official-galleries.json');
for(const ride of park.rides){const gallery=galleries.entries[ride.officialUrl];if(gallery?.mode!=='gallery')continue;assert.deepEqual(guide.get(ride.id).photos.map(p=>p.sourceUrl),[...new Set(gallery.images.map(p=>p.url+'?w=800&f=webp'))],ride.name+' includes every gallery image in order');}
const alice=park.rides.find(r=>r.id==='ride-905816888');assert.equal(ctx.objectPhotoList(alice).length,10);assert(ctx.objectPhotos(alice).includes('data-photo-index="9"'));
const elements=new Map();ctx.$=id=>{if(!elements.has(id))elements.set(id,{dataset:{},open:false,showModal(){this.open=true;}});return elements.get(id);};ctx.pointById=new Map([[alice.id,alice]]);ctx.$('object-dialog').dataset.rideId=alice.id;
vm.runInContext(source.slice(source.indexOf('function openObjectPhoto('),source.indexOf("$('object-content').addEventListener('click'")),ctx);ctx.openObjectPhoto(9);assert.equal(ctx.$('photo-image').src,guide.get(alice.id).photos[9].src);assert(ctx.$('photo-position').textContent.startsWith('10 / 10'));assert(ctx.$('photo-next').disabled);assert(!ctx.$('photo-previous').disabled);ctx.openObjectPhoto(10);assert.equal(ctx.$('photo-dialog').dataset.photoIndex,9);
console.log('Passed: all official galleries complete and in order; tenth photo opens, correct counter, last-image bounds.');
