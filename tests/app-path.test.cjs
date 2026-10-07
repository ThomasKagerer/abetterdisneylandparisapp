'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname+'/../dist/',origin='https://abetterdisneylandparisapp.weletapi.com',handlers={},stored=new Map(),fetched=[],opened=[];
const cache={put:async(k,v)=>stored.set(String(k),v),match:async k=>stored.get(k.url||String(k))};let clients=[];
const ctx={URL,Response,self:{location:{origin},registration:{scope:origin+'/'},addEventListener:(k,v)=>handlers[k]=v,skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>clients,openWindow:async url=>opened.push(url)}},caches:{open:async()=>cache,keys:async()=>[],match:cache.match},fetch:async url=>{fetched.push(String(url));return new Response('asset',{headers:{'Content-Type':'application/javascript'}});}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'sw.js','utf8'),ctx);
function event(name,extra={}){let promise;handlers[name]({...extra,waitUntil:p=>promise=p,respondWith:p=>promise=p});return promise;}
(async()=>{
 await event('install');assert(fetched.length>30);assert(fetched.every(u=>u.startsWith(origin+'/App/')),'precache must use /App while retaining existing worker registration');
 assert.equal(event('fetch',{request:{url:origin+'/App/index.php?waits=1',mode:'cors',method:'GET'}}),undefined,'APIs must remain live');
 assert.equal(event('fetch',{request:{url:origin+'/intro.js?v=110',mode:'cors',method:'GET'}}),undefined,'intro is independent of app asset cache');
 const notification={close(){},data:{kind:'checkin',rideId:'ride-test'}};let posted=[];
 clients=[{url:origin+'/',postMessage:()=>{throw Error('intro cannot handle a checkin');}}];await event('notificationclick',{notification});assert.equal(opened.at(-1),origin+'/App/?checkin=ride-test');
 clients=[{url:origin+'/App/',postMessage:m=>posted.push(m),focus:async()=>{}}];await event('notificationclick',{notification});assert.equal(posted[0].id,'ride-test');
 const manifest=JSON.parse(fs.readFileSync(root+'manifest.webmanifest'));assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/App/');assert.equal(manifest.scope,'/App/');
 const source=fs.readFileSync(root+'intro.js','utf8');let replace;
 vm.runInNewContext(source,{navigator:{standalone:true},window:{},location:{search:'?view=info',replace:u=>replace=u}});assert.equal(replace,'/App/?view=info','existing iOS Home Screen app enters /App');
 const html=fs.readFileSync(root+'introduction.html','utf8');assert.equal((html.match(/<h1\b/g)||[]).length,1);assert(html.includes('rel="canonical" href="'+origin+'/"'));assert(html.includes('data-i18n-ignore name="description"'));assert(!html.includes('rel="manifest"'),'intro must not install a separate app');
 const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert.equal(schema.url,origin+'/App/');assert.equal(schema.inLanguage.length,9);assert.equal(schema.offers.price,'0');
 assert(fs.readFileSync(root+'sitemap.xml','utf8').includes('<loc>'+origin+'/</loc>'));
 console.log('Passed: app path/cache isolation, existing worker and installation identity, notification destinations, Home Screen migration and indexable intro metadata.');
})().catch(e=>{console.error(e);process.exitCode=1;});
