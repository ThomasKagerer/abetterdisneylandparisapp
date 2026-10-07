'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),elements=new Map(),calls=[];
const $=id=>{
 if(!elements.has(id))elements.set(id,{open:false,dataset:{},listeners:{},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},addEventListener(name,fn){this.listeners[name]=fn;}});
 return elements.get(id);
};
const ride={id:'ride-1',name:'Ride One',category:'attraction'},show={id:'ride-2',name:'Show Two',category:'show'},route={order:[ride.id]};
let removeTag=false;const ctx={window:{history:{state:null,pushState(){},back(){}},confirm:message=>{assert.equal(message,'Besucht-Tag entfernen?');return removeTag;}},finishQueueForNavigation(){},waitHistoryParent:null,uninterested:new Set(),targetAvailable:()=>true,$ ,pointById:new Map([[ride.id,ride],[show.id,show]]),planning:false,route,nav:true,visited:new Set(),favorites:new Set(),save(){},renderRides(){},renderPins(){},renderObjectInfo(){},renderPlaylist:()=>calls.push('playlist'),renderShowList:()=>calls.push('shows'),refreshShows:()=>calls.push('sync-shows'),map:{closePopup(){}},focusRideOnMap:id=>calls.push(['focus',id]),toggleFavorite(id){ctx.favorites.has(id)?ctx.favorites.delete(id):ctx.favorites.add(id);},openQueueCheckin:id=>calls.push(['checkin',id]),homeView:view=>calls.push(['view',view]),showNavigationMap(){},replan:async()=>{},visitNext:async id=>{ctx.favorites.add(id);ctx.visited.delete(id);calls.push(['next',id]);return true;},complete:async id=>ctx.visited.add(id)};
vm.createContext(ctx);
vm.runInContext('let objectParentDialog=null;'+source.slice(source.indexOf('function openObjectInfo('),source.indexOf("document.addEventListener('click',event=>{",source.indexOf('function openObjectInfo('))),ctx);
(async()=>{
 $('route-playlist').showModal();ctx.openObjectInfo(ride.id);
 assert(!$('route-playlist').open,'Details must replace the playlist rather than stack a second sheet');assert($('object-dialog').open);
 $('object-close').onclick();assert($('route-playlist').open,'Closing details returns to the originating playlist');assert(! $('object-dialog').open);
 ctx.openObjectInfo(ride.id);$('object-map').onclick();assert(!$('route-playlist').open);assert.deepEqual(calls.at(-1),['focus',ride.id]);
 $('shows-dialog').showModal();ctx.openObjectInfo(show.id);assert(!$('shows-dialog').open);assert(calls.includes('sync-shows'));$('object-close').onclick();assert($('shows-dialog').open);
 $('shows-dialog').close();ctx.openObjectInfo(ride.id);$('object-favorite').onclick();assert(ctx.favorites.has(ride.id));$('object-favorite').onclick();assert(!ctx.favorites.has(ride.id));
 await $('object-visited').onclick();assert(ctx.visited.has(ride.id));await $('object-visited').onclick();assert(ctx.visited.has(ride.id),'Cancel preserves the tag');removeTag=true;await $('object-visited').onclick();assert(!ctx.visited.has(ride.id));
 $('object-checkin').onclick();assert.deepEqual(calls.at(-1),['checkin',ride.id]);assert(!$('object-dialog').open);assert.equal(ctx.route,route);assert(ctx.nav);
 ctx.visited.add(show.id);ctx.openObjectInfo(show.id);await $('object-next').onclick();assert(ctx.favorites.has(show.id));assert(!ctx.visited.has(show.id));assert(calls.some(x=>Array.isArray(x)&&x[0]==='next'&&x[1]===show.id));assert.deepEqual(calls.at(-1),['view','map']);assert.equal(ctx.route,route);
 vm.runInContext(source.slice(source.indexOf("$('rides-list').addEventListener('click',async e=>{"),source.indexOf("$('rides-list').addEventListener('change'")),ctx);
 ctx.visited.add(ride.id);removeTag=false;const tagEvent={target:{closest:selector=>selector==='[data-favorite-visited]'?{dataset:{favoriteVisited:ride.id}}:null}};await $('rides-list').listeners.click(tagEvent);assert(ctx.visited.has(ride.id));removeTag=true;await $('rides-list').listeners.click(tagEvent);assert(!ctx.visited.has(ride.id),'List tag removes visited status only after confirmation');
 console.log('Passed: one sheet at a time, return to playlist/shows, independent favorite/visited/check-in actions, Visit next reopens visited goals, active route preserved.');
})().catch(error=>{console.error(error);process.exitCode=1;});
