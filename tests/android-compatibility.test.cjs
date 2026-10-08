'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const push=fs.readFileSync(__dirname+'/../dist/push-client.js','utf8'),app=fs.readFileSync(__dirname+'/../dist/app.js','utf8');
const elements=new Map(),events=new Map();
const $=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',setAttribute(){},addEventListener(){}});return elements.get(id);};
const ctx={$,navigator:{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/132.0.0.0 Mobile Safari/537.36',maxTouchPoints:5},window:{matchMedia:()=>({matches:false}),addEventListener:(k,f)=>events.set(k,f)},location:{pathname:'/App/',hostname:'abetterdisneylandparisapp.weletapi.com'},setInterval:()=>0,setTimeout:()=>0,installedPrompt:null};
vm.createContext(ctx);vm.runInContext(push,ctx);
assert.equal(ctx.devicePlatform(),'android');assert.match($('setup-install-instructions').textContent,/Android:/);assert(!$('install-text').textContent.includes('iPhone'));
(async()=>{
 await ctx.initPush();assert.match($('push-status').textContent,/Android in Chrome/);assert(!$('push-status').textContent.includes('iPhone'));
 assert.match(ctx.pushDeniedHelp(),/Android/);
 ctx.navigator.userAgent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) Safari/604.1';assert.equal(ctx.devicePlatform(),'ios');ctx.refreshPlatformHelp();assert.match($('install-text').textContent,/Safari: Teilen/);assert.match(ctx.pushDeniedHelp(),/iPhone-Einstellungen/);
 ctx.navigator.userAgent='Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1';assert.equal(ctx.devicePlatform(),'ios','iPad desktop user agent with touch support');
 ctx.navigator.maxTouchPoints=0;assert.equal(ctx.devicePlatform(),'other');assert(!ctx.pushUnavailableHelp().includes('iPhone'));
 // The same native prompt powers both existing install buttons and can be used once.
 vm.runInContext(app.slice(app.indexOf('async function promptAppInstallation()'),app.indexOf("window.addEventListener('beforeinstallprompt'")),ctx);
 let prompts=0;ctx.installedPrompt={prompt:async()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})};assert.equal(await ctx.promptAppInstallation(),true);assert.equal(await ctx.promptAppInstallation(),false);assert.equal(prompts,1);
 ctx.installedPrompt={prompt:async()=>{},userChoice:Promise.resolve({outcome:'dismissed'})};assert.equal(await ctx.promptAppInstallation(),false);
 ctx.installedPrompt={prompt:async()=>{throw Error('browser refused');}};assert.equal(await ctx.promptAppInstallation(),false);assert.equal(ctx.installedPrompt,null);
 // Android absolute orientation is accepted without Safari's permission API.
 const sensorEvents=[],sensor={window:{DeviceOrientationEvent:function(){},addEventListener:(name,handler)=>sensorEvents.push([name,handler])},DeviceOrientationEvent:function(){},screen:{orientation:{angle:90}},Date,heading:null,headingAt:0,lastCompassPaint:0,interactionPaused:()=>false,updateUser(){},renderDirection(){}};
 vm.createContext(sensor);vm.runInContext(app.slice(app.indexOf('function compassEvent('),app.indexOf('function bearing(')),sensor);
 await sensor.requestCompass();assert.equal(sensorEvents.length,2);await sensor.requestCompass();assert.equal(sensorEvents.length,2,'sensor listeners are not duplicated');sensor.compassEvent({absolute:true,alpha:270});assert.equal(sensor.heading,180);
 sensor.heading=null;sensor.compassEvent({absolute:false,alpha:12});assert.equal(sensor.heading,null,'relative yaw must not invent north');
 // Menus and setup phases retain their existing IDs and order.
 const html=fs.readFileSync(__dirname+'/../dist/index.html','utf8');
 const nav=html.slice(html.indexOf('class="bottom-nav"'));assert.deepEqual([...nav.matchAll(/<button id="(home-[^"]+)"/g)].map(m=>m[1]),['home-map','home-favorites','home-all','home-route','home-info']);
 console.log('Passed: Android/iOS/iPad/desktop instructions, unsupported push and denial guidance, one-shot native install acceptance/dismissal/failure, Android absolute compass without iOS permission APIs, unchanged menu order.');
})().catch(e=>{console.error(e);process.exitCode=1;});
