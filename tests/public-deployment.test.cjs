'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),push=fs.readFileSync(__dirname+'/../dist/push-client.js','utf8');
const domain='abetterdisneylandparisapp.weletapi.com',requests=[];
const ctx={AbortSignal,location:{pathname:'/',hostname:domain},navigator:{onLine:true},userKey:'disney-preview',activeSession:true,fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({user:'public',build:104})};}};
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('async function checkSession()'),source.indexOf("window.addEventListener('DOMContentLoaded',async()=>")),ctx);
vm.runInContext(push.slice(push.indexOf('const pushPreview='),push.indexOf('function pushSupported')),ctx);
(async()=>{
    assert.equal(vm.runInContext('pushPreview()',ctx),false,'Public root supports push');
    assert.equal((await ctx.checkSession()).user,'public');assert.equal(requests.at(-1),'index.php?session=1');
    ctx.userKey='disney:public';assert.equal((await ctx.checkSession()).user,'public','Public local preferences have a stable namespace');
    ctx.fetch=async()=>{throw Error('temporary outage');};assert.equal(await ctx.checkSession(),null);assert.equal(ctx.activeSession,true,'Temporary public outage keeps open route and favorites');
    ctx.location.hostname='127.0.0.1';assert.equal(vm.runInContext('pushPreview()',ctx),true);assert.equal(await ctx.checkSession(),undefined,'Local root stays a preview');
    for(const [start,end] of [['async function refreshWaits()','async function checkSession()'],['async function refreshShows()','function '],['async function checkAppUpdate()','async function reloadAppUpdate()']]){
        const at=source.indexOf(start);assert(at>=0);const next=end==='function '?source.indexOf('\nfunction ',at):source.indexOf(end,at);
        const fragment=source.slice(at,next);assert(fragment.includes("location.hostname!=='"+domain+"'"),'Live API at the public root: '+start);
    }
    const publicEntry=fs.readFileSync(__dirname+'/../docker/public-index.php','utf8');
    assert(!publicEntry.includes('qr_lib.php'));assert(publicEntry.includes("Service-Worker-Allowed: /"));assert(!publicEntry.includes("'collect-push.php'=>"));assert(!publicEntry.includes("'map-diagnostics.php'=>"));
    assert(source.includes("+'sw.js?v='+APP_BUILD"),'Service worker URL is versioned to avoid stale edge cache after update');assert(publicEntry.includes("$asset!=='sw.js'&&preg_match"),'Service worker keeps no-store while other assets may be cached');
    const docker=fs.readFileSync(__dirname+'/../docker/deploy.sh','utf8');assert(docker.includes('127.0.0.1:18081:8080'));assert(!docker.includes('/mnt/backup/webdav'));assert(!docker.includes('docker.sock'));assert(docker.includes('--read-only --cap-drop ALL'));
    ctx.location={pathname:'/App/',hostname:domain};ctx.fetch=async()=>({ok:true,json:async()=>({user:'public'})});assert.equal((await ctx.checkSession()).user,'public');assert.equal(vm.runInContext('pushPreview()',ctx),false);
    console.log('Passed: public root calls live APIs and supports push; stable local preferences; outages preserve route; local preview preserved; independent Docker volumes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
