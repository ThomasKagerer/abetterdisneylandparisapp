'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sw=fs.readFileSync(__dirname+'/../dist/sw.js','utf8'),handlers={},stored=new Map();let requests=0,offline=false;
const build=Number(sw.match(/BUILD='(\d+)'/)[1]);
const origin='https://weletapi.com',scope=origin+'/files/.internal/Disney/';
const cache={match:async request=>stored.get(request.url||String(request)),put:async(request,response)=>stored.set(request.url||String(request),response)};
const ctx={URL,Response,self:{location:{origin},registration:{scope},addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>cache,match:cache.match},fetch:async request=>{requests++;if(offline)throw Error('offline');const photo=request.url?.includes('/photos/');return new Response(photo?'photo-bytes':'cached-facts',{headers:{'Content-Type':photo?'image/webp':'application/javascript'}});}};
vm.createContext(ctx);vm.runInContext(sw,ctx);
function dispatch(path,mode='cors'){
 let result;handlers.fetch({request:{url:scope+path,method:'GET',mode},respondWith:promise=>result=promise});return result;
}
(async()=>{
 const url=scope+'disney-guide.js?v='+build;stored.set(url,new Response('preloaded',{headers:{'Content-Type':'application/javascript'}}));
 assert.equal(await(await dispatch('disney-guide.js?v='+build)).text(),'preloaded');assert.equal(requests,0,'preloaded facts open without a network round trip');
 stored.delete(url);assert.equal(await(await dispatch('disney-guide.js?v='+build)).text(),'cached-facts');assert.equal(requests,1);
 offline=true;assert.equal(await(await dispatch('disney-guide.js?v='+build)).text(),'cached-facts');assert.equal(requests,1,'offline details use the captured guide');
 assert.equal(dispatch('disney-guide.js?v=61'),undefined,'old build must not receive new version data');
 assert.equal(dispatch('index.php?waits=1'),undefined,'live API must not receive cached static values');
 offline=false;const photo='photos/0123456789abcdef.webp';assert.equal(await(await dispatch(photo)).text(),'photo-bytes');const photoRequests=requests;
 offline=true;assert.equal(await(await dispatch(photo)).text(),'photo-bytes');assert.equal(requests,photoRequests,'viewed photos open offline without another request');
 offline=false;assert.equal(await(await dispatch('photos/fedcba9876543210.gif')).text(),'photo-bytes');offline=true;assert.equal(await(await dispatch('photos/fedcba9876543210.gif')).text(),'photo-bytes');
 for(const path of ['photos/private.php','photos/0123456789abcdef.webp?foo=1','photos/../private.webp'])assert.equal(dispatch(path),undefined,'only exact local photo files enter the cache');
 assert.equal((await dispatch('', 'navigate')).status,503,'app navigation still requires authenticated online access');
 const controller=fs.readFileSync(__dirname+'/../dist/index.php','utf8');assert(controller.includes("'disney-guide.js'=>'application/javascript; charset=utf-8'"));
 assert(controller.indexOf("$user === ''")<controller.indexOf("preg_match('~\\Aphotos/"),'photo access remains behind login');assert(controller.includes("'~\\Aphotos/[a-f0-9]{16}\\.(webp|gif)\\z~'"));
 console.log('Passed: cache-first Disney facts/photos, offline viewed images, exact build/path isolation, live API excluded, login navigation unchanged.');
})().catch(error=>{console.error(error);process.exitCode=1;});
