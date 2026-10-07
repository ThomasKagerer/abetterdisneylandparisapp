'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),DisneyShows=require('../dist/show-times.js'),DisneyWaits=require('../dist/wait-times.js'),RouteCore=require('../dist/routing.js'),{Router}=RouteCore;
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),push=fs.readFileSync(__dirname+'/../dist/push-client.js','utf8'),park=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-data.json'));
const finished=park.rides.find(r=>r.name==='Animation Academy'),evening=park.rides.find(r=>r.name==='Disney Cascade of Lights'),unknown=park.rides.find(r=>r.name==='Heroic Welcome'),ride=park.rides.find(r=>r.name==='The Twilight Zone Tower of Terror'),singleRide=park.rides.find(r=>r.name==="Crush's Coaster");
const data={...park,rides:[finished,evening,unknown,ride,singleRide]},router=new Router(park),els=new Map(),markers=[],markerOptions=new Map(),notices=[];
let now=Date.parse('2026-10-05T20:42:00+02:00');class Clock extends Date{static now(){return now;}}
const entry=(r,start,end)=>[r.themeparksId,{showtimes:[{startTime:start,endTime:end}],status:'OPERATING'}];
function element(){return {value:'all',checked:false,dataset:{},open:false,innerHTML:'',addEventListener(){},setAttribute(){},appendChild(){},close(){this.open=false;}};}
const $=id=>{if(!els.has(id))els.set(id,element());return els.get(id);};
const ctx={finishQueueForNavigation(){},$,data,router,DisneyShows,DisneyWaits,waits:new Map(),singleRiderIds:{},Date:Clock,shows:new Map([entry(finished,'2026-10-05T17:00:00+02:00','2026-10-05T17:00:00+02:00'),entry(evening,'2026-10-05T21:50:00+02:00','2026-10-05T22:10:00+02:00')]),showsScheduleAt:Date.parse('2026-10-05T12:00:00+02:00'),targetAvailabilityKey:'',pointById:new Map([...data.rides,...data.toilets].map(r=>[r.id,r])),favorites:new Set(data.rides.map(r=>r.id)),visited:new Set(),deferred:new Set(),uninterested:new Set(),priorityRide:finished,focusedRideId:finished.id,route:{order:[finished.id,ride.id],legs:[],distance:0},routeOrigin:null,pinnedWC:null,nav:true,planning:false,generation:0,origin:data.nodes[finished.node],originLabel:'Test',onlyFav:false,ratingsMode:false,activeHomeView:'favorites',selectedPark:'all',lastRideDistancePaint:0,appReady:true,parkMatches:()=>true,
 document:{createElement:element},window:{innerWidth:393},popupWaits:new Map(),pins:{clearLayers(){markers.length=0;markerOptions.clear();}},L:{divIcon:o=>o,marker:(_,options)=>({addTo(){markers.push(options.title);markerOptions.set(options.title,options);return this;},getElement(){return {setAttribute(){}};},isPopupOpen:()=>false,openPopup(){},bindPopup(){},on(){}})},map:{closePopup(){},setView(){}},lineLayer:{clearLayers(){}},DisneyRatings:{get:()=>null},esc:String,metric:Math.round,minutes:d=>Math.ceil(d/72),nextShowBadge:()=>'',waitBadge:()=>'',childBadge:()=>'',save(){ctx.saved=true;},renderHiddenTargets(){},renderLines(){},renderNearbyShows(){},openMapObjectSheet(){},homeView(){},showNavigationMap(){},renderFollow(){},setHeadingUp(){},markShowTargets(){},updatePopupWaits(){},fitRoute(){},exitNav(){},toast:s=>notices.push(s),localStorage:{removeItem(){}},userKey:'test',
 RouteCore,renderSuggestions(){},renderOrientation(){},renderQueueCheckin(){},renderDirection(){},playerVisible:()=>true,waitInfo:()=>null,queueCheckin:null,navigator:{onLine:true},position:null,lastFix:0,heading:null,headingAt:0,
 rpc:async(type,args)=>type==='optimize'?router.optimize(args.start,args.stops,args.deferredIds):router.assemble(args.start,args.stops)
};
vm.createContext(require('./helpers/near-park.cjs')(ctx));vm.runInContext(source.slice(source.indexOf('function ageData('),source.indexOf('function childBadge(')),ctx);
function use(a,b){const i=source.indexOf(a);vm.runInContext(source.slice(i,source.indexOf(b,i)),ctx);}
use('let showTravelCache=','function showSchedule(');
use('const singleRiderIds=','function singleRiderInfo(');
use('function remaining(','function toggleFavorite(');
use('function rideSearchText(',"$('rides-list').addEventListener('click'");
use('function renderPins(','function markShowTargets(');
use('async function refreshTargetAvailability(','function renderNearbyShows(');
use('async function replan(','function fitRoute(');
use('function focusRideOnMap(','function updatePopupTravel(');
use('function renderRoute(',"$('open-playlist').onclick=");
use('function renderNav(',"$('search').addEventListener(");
$('search').value='';$('category').value='all';$('ride-sort').value='distance';
$('route-playlist').open=true;
(async()=>{
 ctx.route.order.unshift(unknown.id);
 await ctx.refreshTargetAvailability();
 assert(!ctx.remaining().some(r=>r.id===finished.id));assert(!ctx.route.order.includes(finished.id));assert.equal(ctx.priorityRide,null);assert.equal(ctx.focusedRideId,null);assert(ctx.saved);
 for(const r of [evening,ride]){assert(ctx.remaining().some(x=>x.id===r.id));assert($('rides-list').innerHTML.includes(r.name));assert(markers.includes(r.name));}
 const assertHidden=r=>{assert(!ctx.remaining().some(x=>x.id===r.id));assert(!ctx.route.order.includes(r.id));assert($('rides-list').innerHTML.includes(r.name));assert($('rides-list').innerHTML.includes(`data-object-row="${r.id}" class="ride-row unavailable`));assert(markers.includes(r.name));assert(markerOptions.get(r.name).icon.html.includes('unavailable'));for(const id of ['stops','playlist-stops'])assert(!$(id).innerHTML.includes(r.name),`${id} must hide ${r.name}`);assert(![$('nav-target').textContent,$('nav-next').textContent].some(s=>s?.includes(r.name)),'Navigation must hide unavailable shows');};
 assertHidden(unknown);assertHidden(finished);assert(ctx.favorites.has(unknown.id),'No-time show remains saved as a favorite');
 for(const show of [{},{showtimes:[]},{showtimes:[{startTime:'bad'}]},{showtimes:[{startTime:'2026-10-06T17:00:00+02:00'}]}]){ctx.shows.set(unknown.themeparksId,show);assert(!ctx.showAvailable(unknown),'Missing, empty, malformed or tomorrow-only times must stay hidden');}
 ctx.shows.delete(unknown.themeparksId);
 ctx.focusRideOnMap(unknown.id);assert.equal(ctx.focusedRideId,unknown.id);
 assertHidden(finished);assert(ctx.favorites.has(finished.id));assert(!ctx.visited.has(finished.id));assert(!ctx.uninterested.has(finished.id),'Today-only filtering is not a permanent dislike');
 // Current or focused unavailable targets remain small and grey.
 ctx.route.order.unshift(finished.id);ctx.focusedRideId=finished.id;ctx.renderPins();assert(markers.includes(finished.name));assert(markerOptions.get(finished.name).icon.html.includes('unavailable'));ctx.focusRideOnMap(finished.id);assert.equal(ctx.focusedRideId,finished.id);ctx.route.order.shift();
 const requests=[];Object.assign(ctx,{pushSubscription:{},pushConfig:{},pushSyncBusy:false,pushSyncPending:false,pushSyncAt:0,activeSession:true,navigator:{onLine:true},position:{latlng:ctx.origin,accuracy:5},lastFix:now,insidePark:()=>true,pushStatus(){},pushRequest:async(_,payload)=>requests.push(payload.context)});
 vm.runInContext(push.slice(push.indexOf('async function syncPush('),push.indexOf('function updateSetupLocation(')),ctx);await ctx.syncPush(true);assert(requests.at(-1).candidates.every(x=>x.id!==finished.id&&x.id!==unknown.id));
 const firstOrigin=ctx.origin,walk=ctx.showWalkingMinutes(evening),start=Date.parse('2026-10-05T21:50:00+02:00');
 now=start+15*60000-walk*60000;assert(ctx.showAvailable(evening),'Arrival exactly fifteen minutes after start fits');
 now++;await ctx.refreshTargetAvailability();assert.equal(DisneyShows.hasRemainingToday(ctx.shows.get(evening.themeparksId),now,ctx.showsScheduleAt),true,'The performance is still inside its grace');assert(!ctx.showAvailable(evening),'But the walk makes it too late');assertHidden(evening);
 ctx.origin=data.nodes[evening.node];await ctx.refreshTargetAvailability();assert(ctx.showAvailable(evening),'Moving close enough makes the performance feasible again');assert($('rides-list').innerHTML.includes(evening.name));assert(markers.includes(evening.name));ctx.origin=firstOrigin;
 now=Date.parse('2026-10-05T21:55:00+02:00');ctx.origin=data.nodes[evening.node];await ctx.refreshTargetAvailability();assert(ctx.showAvailable(evening),'A nearby started performance remains in lists/map/route');assert($('rides-list').innerHTML.includes(evening.name));assert(markers.includes(evening.name));assert(ctx.route.order.includes(evening.id));assert($('playlist-stops').innerHTML.includes(evening.name));ctx.position={latlng:ctx.origin,accuracy:5};ctx.lastFix=now;await ctx.syncPush(true);assert(requests.at(-1).candidates.some(x=>x.id===evening.id));
 now=Date.parse('2026-10-05T22:05:00+02:00')+1;await ctx.refreshTargetAvailability();assertHidden(evening);ctx.origin=firstOrigin;
 now=Date.parse('2026-10-05T22:10:00+02:00');await ctx.refreshTargetAvailability();assert(!ctx.showAvailable(evening));assert(!ctx.route.order.includes(evening.id));assertHidden(evening);
 now=Date.parse('2026-10-06T10:00:00+02:00');await ctx.refreshTargetAvailability();assert(!ctx.showAvailable(finished),'Old schedule must not reveal a show without confirmed times today');assertHidden(finished);
 ctx.showsScheduleAt=now;ctx.shows.set(finished.themeparksId,{showtimes:[{startTime:'2026-10-06T17:00:00+02:00'}]});ctx.shows.set(evening.themeparksId,{showtimes:[]});await ctx.refreshTargetAvailability();assert(ctx.showAvailable(finished));assert($('rides-list').innerHTML.includes(finished.name));assert(markers.includes(finished.name));assert(!ctx.showAvailable(evening));assert(!ctx.showAvailable(unknown));
 // Closing an active ride removes it from the rendered navigation and preserves
 // its favorite and running timer. The real refresh path must trigger replanning.
 ctx.priorityRide=ride;ctx.focusedRideId=ride.id;await ctx.replan();
 const timer={id:ride.id,startedAt:now-600000,minutes:20};ctx.queueCheckin=timer;
 $('queue-prompt').dataset.rideId=ride.id;$('queue-prompt').open=true;
 Object.assign(ctx,{waitsBusy:false,waitsFailed:false,renderWaitStatus(){},renderWaitHistoryDialog(){},location:{pathname:'/'},AbortController,setTimeout:()=>1,clearTimeout(){},fetch:async()=>({ok:true,json:async()=>({fetchedAt:now/1000,parks:[{id:ride.queueTimes.parkId,rides:[{id:ride.queueTimes.rideId,status:'CLOSED',minutes:0,updatedAt:new Date(now).toISOString()}]}]})})});
 use('async function refreshWaits(',"$('refresh-waits').onclick=");
 await ctx.refreshWaits();assertHidden(ride);assert.equal(ctx.priorityRide,null);assert.equal(ctx.focusedRideId,null);assert(!$('queue-prompt').open);assert.equal(ctx.queueCheckin,timer);assert(ctx.favorites.has(ride.id));assert(!ctx.visited.has(ride.id));await ctx.syncPush(true);assert(requests.at(-1).candidates.every(x=>x.id!==ride.id));
 const key=r=>`${r.queueTimes.parkId}:${r.queueTimes.rideId}`;
 ctx.waits.set(key(ride),{status:'CLOSED',stale:true,updatedAt:new Date(now-86400000).toISOString()});assert(!ctx.targetAvailable(ride),'A stale last-known closure cannot reappear as an unknown queue');
 ctx.waits.set(key(ride),{status:'OPERATING',minutes:0,updatedAt:new Date(now).toISOString()});await ctx.refreshTargetAvailability();assert(ctx.targetAvailable(ride));assert($('rides-list').innerHTML.includes(ride.name));assert(markers.includes(ride.name));assert(ctx.route.order.includes(ride.id));
 const singleKey=`${singleRide.queueTimes.parkId}:7277`;
 ctx.waits.set(key(singleRide),{status:'CLOSED'});ctx.waits.set(singleKey,{status:'OPERATING',minutes:10});await ctx.refreshTargetAvailability();assert(ctx.targetAvailable(singleRide));assert($('rides-list').innerHTML.includes(singleRide.name));
 ctx.waits.set(singleKey,{status:'CLOSED'});await ctx.refreshTargetAvailability();assertHidden(singleRide);
 ctx.waits.set(key(singleRide),{status:'OPERATING',minutes:30});await ctx.refreshTargetAvailability();assert(ctx.targetAvailable(singleRide));assert(markers.includes(singleRide.name));
 ctx.shows.get(finished.themeparksId).status='CLOSED';await ctx.refreshTargetAvailability();assertHidden(finished);ctx.shows.get(finished.themeparksId).status='OPERATING';await ctx.refreshTargetAvailability();assert(ctx.targetAvailable(finished));
 console.log('Passed: exhausted, unknown, empty, malformed and wrong-day shows grey in lists/map and excluded from route/playlist/navigation/push; walking deadlines, moved-origin recovery, favorites intact, info focus allowed and restoration with confirmed new-day times.');
 console.log('Passed: live closure refresh removes navigation/playlist/push targets and greys list/map entries, independent Single Rider, closed show with future times, reopening, favorites and active wait timer preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
