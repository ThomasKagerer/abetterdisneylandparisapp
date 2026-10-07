'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),push=fs.readFileSync(__dirname+'/../dist/push-client.js','utf8');
const {Router}=require('../dist/routing.js'),park=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-data.json'));
const ride=park.rides.find(r=>r.name==='Spider-Man W.E.B. Adventure'),other=park.rides.find(r=>r.name==='The Twilight Zone Tower of Terror'),show=park.rides.find(r=>r.name==='Stitch Live!');
const data={...park,rides:[ride,other,show]},router=new Router(park),elements=new Map(),stored=new Map(),markers=[],notices=[];
function element(){return {value:'all',checked:false,dataset:{},open:false,_html:'',get innerHTML(){return this._html;},set innerHTML(value){this._html=value;this.firstElementChild={};},replaceChildren(){this._html='';this.firstElementChild=null;},setAttribute(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},appendChild(){}};}
const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
const ctx={finishQueueForNavigation(){},$,data,router,userKey:'test',pointById:new Map([...park.rides,...park.toilets].map(r=>[r.id,r])),favorites:new Set([ride.id,other.id,show.id]),visited:new Set(),deferred:new Set([ride.id]),uninterested:new Set(),targetAvailable:()=>true,priorityRide:ride,focusedRideId:ride.id,pendingNoticeId:ride.id,pinnedWC:null,route:null,routeOrigin:null,planning:false,nav:false,generation:0,origin:data.nodes[ride.node],originLabel:'Teststart',selectedPark:'all',onlyFav:false,ratingsMode:false,activeHomeView:'all',lastRideDistancePaint:0,appReady:true,
 localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},map:{closePopup(){},setView(){throw Error('Hidden notification must not focus map');}},lineLayer:{clearLayers(){}},pins:{clearLayers(){markers.length=0;}},popupWaits:new Map(),
 L:{divIcon:options=>options,marker:(latlng,options)=>({addTo(){markers.push(options.title);return this;},getElement(){return {setAttribute(){}};},isPopupOpen(){return false;},bindPopup(){},on(){}})},document:{createElement:element,body:{classList:{toggle(){}}}},window:{innerWidth:393},navigator:{onLine:true},
 DisneyRatings:{get:()=>null,ranked:x=>x},esc:String,metric:Math.round,minutes:x=>Math.ceil(x/72),nextShowBadge:()=>'',waitBadge:()=>'',childBadge:()=>'',toast:s=>notices.push(s),renderRoute(){},renderLines(){},renderPlaylist(){},renderSuggestions(){},markShowTargets(){},updatePopupWaits(){},fitRoute(){},exitNav(){},openMapObjectSheet(){},renderFollow(){},setHeadingUp(){},homeView(){},showMap(){},
 rpc:async(type,args)=>type==='optimize'?router.optimize(args.start,args.stops,args.deferredIds):router.assemble(args.start,args.stops),Date
};
vm.createContext(require('./helpers/near-park.cjs')(ctx));vm.runInContext(source.slice(source.indexOf('function ageData('),source.indexOf('function childBadge(')),ctx);
function use(begin,end){const start=source.indexOf(begin);assert(start>=0,begin);vm.runInContext(source.slice(start,source.indexOf(end,start)),ctx);}
use('function save(','function rpc(');
use('function remaining(','function waitInfo(');
use('function rideSearchText(',"$('rides-list').addEventListener('click'");
use('function renderPins(','function markShowTargets(');
use('function focusRideOnMap(','function updatePopupTravel(');
use('async function replan(','function fitRoute(');
use('async function visitNext(','async function acceptSuggestion(');
Object.assign(ctx,{lastFix:Date.now(),position:{latlng:ctx.origin,accuracy:5},shows:new Map(),showsFetchedAt:Date.now(),nearbyShows:[],parkMatches:()=>true,DisneyShows:{startsSoon:()=>false,nextPerformance:()=>null,nearby:()=>[{ride:show,start:Date.now()+600000,walkMinutes:2}]}});
use('function renderNearbyShows(','function renderShowList(');
$('search').value='';$('category').value='all';$('ride-sort').value='distance';
const pushCalls=[];
Object.assign(ctx,{pushSubscription:{},pushConfig:{},pushSyncBusy:false,pushSyncPending:false,pushSyncAt:0,activeSession:true,insidePark:()=>true,pushStatus(){},pushRequest:async(action,payload)=>pushCalls.push(payload.context)});
vm.runInContext(push.slice(push.indexOf('async function syncPush('),push.indexOf('function updateSetupLocation(')),ctx);
(async()=>{
 ctx.save();ctx.load();assert.equal(ctx.uninterested.size,0,'Existing preferences migrate with no hidden targets');
 await ctx.replan();assert.equal(ctx.route.order[0],ride.id);
 const timer={id:ride.id,startedAt:Date.now(),minutes:20};ctx.queueCheckin=timer;
 $('object-dialog').dataset.rideId=ride.id;$('object-dialog').open=true;
 await ctx.setUninterested(ride.id);
 assert(!ctx.route.order.includes(ride.id),'Current target is removed and remaining route is recalculated');
 assert.equal(ctx.priorityRide,null);assert.equal(ctx.focusedRideId,null);assert.equal(ctx.pendingNoticeId,null);assert(!ctx.deferred.has(ride.id));assert(!ctx.visited.has(ride.id));assert(ctx.favorites.has(ride.id),'Hiding retains favorite membership for restoration');assert.equal(ctx.queueCheckin,timer,'Hiding must not destroy an active wait timer');assert.equal($('object-dialog').open,false);
 assert(!$('rides-list').innerHTML.includes(ride.name));assert(!markers.includes(ride.name));
 // Current/focused exceptions and show-visited must never reveal hidden targets.
 ctx.focusedRideId=ride.id;ctx.route.order.unshift(ride.id);$('show-visited').checked=true;ctx.renderPins();ctx.renderRides();assert(!markers.includes(ride.name));assert(!$('rides-list').innerHTML.includes(ride.name));
 ctx.focusRideOnMap(ride.id);assert.match(notices.at(-1),/ausgeblendet/);
 await ctx.visitNext(ride.id);assert.equal(ctx.priorityRide,null,'Hidden target cannot be selected via a stale Visit next action');
 await ctx.setUninterested(show.id);assert.equal(ctx.nearbyShows.length,0,'Hidden shows do not appear in nearby hints');
 await ctx.syncPush(true);assert(pushCalls.at(-1).candidates.every(x=>x.id!==ride.id&&x.id!==show.id),'Hidden rides and shows are excluded from push context');
 ctx.pushSyncBusy=true;ctx.pushSyncPending=false;await ctx.syncPush(true);assert(ctx.pushSyncPending,'A hide while syncing schedules a fresh context instead of losing the update');ctx.pushSyncBusy=false;ctx.pushSyncPending=false;
 ctx.save();const saved=JSON.parse(stored.get('test'));saved.uninterested.push('unknown','wc-1');saved.priorityRideId=ride.id;stored.set('test',JSON.stringify(saved));ctx.uninterested.clear();ctx.load();assert.deepEqual([...ctx.uninterested],[ride.id,show.id]);assert.equal(ctx.priorityRide,null,'Reload cannot restore hidden priority');assert(!ctx.remaining().some(r=>ctx.uninterested.has(r.id)));
 $('hidden-targets-dialog').showModal();ctx.renderHiddenTargets();assert($('hidden-targets-list').innerHTML.includes(show.name));assert($('hidden-targets-list').innerHTML.includes('Wieder anzeigen'));
 await ctx.setUninterested(ride.id,false);assert(ctx.remaining().some(r=>r.id===ride.id));assert($('rides-list').innerHTML.includes(ride.name));assert(markers.includes(ride.name));assert.equal($('open-hidden-targets').textContent,'Ausblenden · 1');
 await ctx.setUninterested(show.id,false);assert.equal(ctx.nearbyShows.length,1);assert.equal(ctx.uninterested.size,0);assert($('hidden-targets-list').innerHTML.includes('Keine ausgeblendeten Ziele'));
 // A worker calculation started before hiding must not overwrite the new route.
 const rpc=ctx.rpc;let release,first=true;
 ctx.rpc=async(type,args)=>{if(type==='optimize'&&first){first=false;return new Promise(resolve=>{release=()=>resolve(router.optimize(args.start,args.stops,args.deferredIds));});}return rpc(type,args);};
 const oldPlan=ctx.replan();await ctx.setUninterested(other.id);const freshRoute=ctx.route;release();await oldPlan;
 assert.equal(ctx.route,freshRoute);assert(!ctx.route.order.includes(other.id));assert.equal(ctx.planning,false);
 await ctx.setUninterested(other.id,false);
 console.log('Passed: migration/persistence, current-route removal, strict list/map hiding, focus and Visit next guards, nearby/push exclusion, busy sync replay, individual restore, favorites and wait timer preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
