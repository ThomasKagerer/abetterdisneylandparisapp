'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map(),classes=new Set(),calls=[];
const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},addEventListener(){}});return elements.get(id);};
const context=vm.createContext({$:element,document:{body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},window:{PushManager:function(){},Notification:{},matchMedia:()=>({matches:true}),addEventListener(){}},Notification:{permission:'default',requestPermission(){throw Error('Separate permission request would break gesture');}},navigator:{serviceWorker:{ready:new Promise(()=>{})},onLine:true},location:{pathname:'/files/.internal/Disney/',search:''},localStorage:{setItem:(...args)=>calls.push(args),getItem:()=>null},setTimeout:()=>0,setInterval:()=>0,URLSearchParams,Uint8Array,atob:x=>Buffer.from(x,'base64').toString('binary'),data:null,position:null,lastFix:0,userKey:'test',homeView:view=>calls.push(['home',view]),activateGPS(){},installedPrompt:null,fetch:async()=>({ok:true,json:async()=>({})})});
vm.runInContext(fs.readFileSync(__dirname+'/../dist/push-client.js','utf8'),context);
vm.runInContext("openSetup();",context);assert.equal(element('setup-dialog').hidden,false);assert(classes.has('setup-open'));
let subscribed=0;context.registration={pushManager:{subscribe(){subscribed++;return new Promise(()=>{});}}};context.key=Buffer.concat([Buffer.from([4]),Buffer.alloc(64)]).toString('base64url');
vm.runInContext("pushReady=true;pushRegistration=registration;pushConfig={publicKey:key,csrf:'test'};",context);
element('setup-push').onclick();assert.equal(subscribed,1,'subscribe must run immediately inside the click');assert.equal(element('setup-push').disabled,true);
element('setup-done').onclick();assert.equal(element('setup-dialog').hidden,true,'skip closes while browser permission is pending');assert(!classes.has('setup-open'));assert(calls.some(x=>x[0]==='home'&&x[1]==='map'));
vm.runInContext("pushEnabling=false;pushReady=false;renderPushControls();",context);assert.equal(element('setup-push').disabled,false,'failed initialization can be retried');
console.log('Passed: immediate push subscription gesture, no separate Notification prompt, skip closes during pending permission and worker readiness, retry remains available.');

// Permissions can finish in either order; setup must not wait for another tap.
context.position={latlng:[48.87,2.77],accuracy:5};context.lastFix=Date.now();
element('setup-permissions-step').hidden=false;
vm.runInContext('pushSubscription=null;pushReady=true;pushEnabling=false;onboardingAutoContinue=true;openSetup();updateSetupLocation();',context);
assert.equal(element('setup-dialog').hidden,false,'GPS alone must not close onboarding');
vm.runInContext('pushSubscription={};renderPushControls();',context);
assert.equal(element('setup-dialog').hidden,true,'GPS first, then push automatically opens map');
vm.runInContext('onboardingLocation=false;onboardingAutoContinue=true;openSetup();renderPushControls();',context);
assert.equal(element('setup-dialog').hidden,false,'Push alone must not close onboarding');
vm.runInContext('updateSetupLocation();',context);
assert.equal(element('setup-dialog').hidden,true,'Push first, then GPS automatically opens map');
vm.runInContext('onboardingAutoContinue=false;openSetup();renderPushControls();',context);
assert.equal(element('setup-dialog').hidden,false,'Manually opened settings remain visible');
assert.equal(element('setup-done').textContent,'Los geht’s · Karte öffnen');
console.log('Passed: automatic map entry in both permission orders, no premature entry, settings remain open.');

// Family details use the actual app save handlers and existing preferences storage.
const preferences=require('../dist/preferences.js');
context.favorites=new Set();context.uninterested=new Set();context.DisneyPreferences=preferences;context.appSettings={singleRiderAlerts:true,child:null};context.appReady=true;context.pointById=new Map();context.pendingNoticeId=null;
for(const name of ['renderRides','renderObjectInfo','renderPlaylist','renderNav','renderMapObjectSheet'])context[name]=()=>{};
context.toast=message=>calls.push(['toast',message]);
const app=fs.readFileSync(__dirname+'/../dist/app.js','utf8');
vm.runInContext(app.slice(app.indexOf('function loadPreferences(){'),app.indexOf("$('shows-nearby-tab').onclick=")),context);
assert.equal(preferences.childFromFields('', '126'),null);assert.equal(preferences.childFromFields('7',''),null);assert.equal(preferences.childFromFields('NaN','126'),null);assert.equal(preferences.childFromFields('18','126'),null);assert.equal(preferences.childFromFields('7','39'),null);assert.deepEqual(preferences.childFromFields('0','40'),{age:0,height:40});
vm.runInContext('onboardingAutoContinue=true;setupPhase(false);openSetup();',context);
element('setup-browser').onclick();assert.equal(element('setup-child-step').hidden,false,'Browser onboarding asks about the child first');
vm.runInContext('updateSetupLocation();renderPushControls();',context);assert.equal(element('setup-dialog').hidden,false,'Ready permissions cannot bypass the family question');
element('setup-child-age').value='';element('setup-child-height').value='126';element('setup-child-save').onclick();assert.equal(element('setup-child-step').hidden,false);assert.equal(element('setup-child-error').hidden,false);assert.equal(context.appSettings.child,null,'Blank age must not silently become zero');
element('setup-child-age').value='7.5';element('setup-child-height').value='126';element('setup-child-save').onclick();assert.deepEqual(context.appSettings.child,{age:7.5,height:126});assert(context.appSettings.singleRiderAlerts);assert.equal(element('child-enabled').checked,true);assert.equal(element('child-age').value,7.5);assert.equal(element('child-height').value,126);assert.equal(element('setup-favorites-step').hidden,false);element('setup-favorites-skip').onclick();assert.equal(element('setup-permissions-step').hidden,false);
const saved=calls.findLast(x=>x[0]==='test:preferences');assert.deepEqual(JSON.parse(saved[1]).child,{age:7.5,height:126});
vm.runInContext('setupChildPhase();',context);assert.equal(element('setup-child-age').value,7.5,'Existing profile is prefilled');element('setup-child-skip').onclick();assert.equal(context.appSettings.child,null);assert.equal(element('child-enabled').checked,false);assert(context.appSettings.singleRiderAlerts,'Without children preserves unrelated preferences');
vm.runInContext('startOnboarding();',context);assert.equal(element('setup-child-step').hidden,false,'Installed first launch asks the family question too');
let failStorage=true;context.localStorage.setItem=(...args)=>{if(failStorage)throw Error('full');calls.push(args);};element('setup-child-age').value='7';element('setup-child-height').value='126';element('setup-child-save').onclick();assert.equal(element('setup-child-step').hidden,false,'Storage failure does not proceed as if saved');assert.equal(element('setup-child-error').hidden,false);failStorage=false;element('setup-child-save').onclick();assert.equal(element('setup-favorites-step').hidden,false,'Saving can be retried and advances to favorites');
console.log('Passed: family onboarding before permissions in browser/installed app, existing profile, blank/range validation, shared local child settings, no-child option and storage retry.');
