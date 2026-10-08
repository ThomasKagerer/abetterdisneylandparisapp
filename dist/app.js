/* Disney ParkRoute: location stays on-device. */
'use strict';
let appSettings={singleRiderAlerts:false,child:null};
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,router,worker,userKey='disney-preview',favorites=new Set(),visited=new Set(),deferred=new Set(),uninterested=new Set(),route=null,pinnedWC=null,priorityRide=null;
let origin=[48.87050,2.77972],originLabel='Parkeingang',position=null,lastFix=0,heading=null,headingAt=0,watch=null,following=true,pickStart=false,nav=false,planning=false,generation=0,rerouteAt=0,routeOrigin=null,onlyFav=false,ratingsMode=false,original=false,installedPrompt=null,wakeLock=null,gpsWantNav=false,activeSession=true,headingUp=false;
let focusedRideId=null,pendingNoticeId=null,interactionUntil=0,lastCompassPaint=0;
function interactionPaused(){return Date.now()<interactionUntil;}
for(const event of ['pointerdown','touchstart'])document.addEventListener(event,()=>{interactionUntil=Date.now()+2000;},{capture:true,passive:true});
for(const event of ['pointerup','pointercancel','touchend','touchcancel'])document.addEventListener(event,()=>{interactionUntil=Date.now()+450;},{capture:true,passive:true});
let selectedPark='all',appReady=false;
function parkMatches(ride){return selectedPark==='all'||ride.park===selectedPark;}
function renderParkMode(){$('park-mode').value=selectedPark;$('park').value=selectedPark;}
function loadParkMode(){try{const value=localStorage.getItem(`${userKey}:park-mode`);if(['all','Disneyland Park','Disney Adventure World'].includes(value))selectedPark=value;}catch{}renderParkMode();}
async function setParkMode(value){if(!appReady)return;if(!['all','Disneyland Park','Disney Adventure World'].includes(value)||value===selectedPark)return;selectedPark=value;if($('map-object-sheet').open&&!parkMatches(pointById.get($('map-object-sheet').dataset.rideId)))closeMapObjectSheet();try{localStorage.setItem(`${userKey}:park-mode`,value);}catch{}renderParkMode();for(const state of homeViewStates.values())state.park=value;if(priorityRide&&!parkMatches(priorityRide))priorityRide=null;pinnedWC=null;save();map.closePopup();renderRides();renderPins();renderNearbyShows();if(route||nav)await replan();else renderRoute();if(typeof syncPush==='function')syncPush(true);toast(value==='all'?'Beide Parks ausgewählt':`${value} ausgewählt`);}
let activeHomeView='map';const homeViewStates=new Map();
let waits=new Map(),waitsFailed=false,waitsBusy=false,waitsFetchedAt=null,suggestion=null;const dismissedSuggestions=new Map();
const pointById=new Map(),pending=new Map(),popupWaits=new Map();let messageId=0;
const map=L.map('map',{attributionControl:false,zoomControl:false,preferCanvas:true,rotate:true,touchRotate:true,shiftKeyRotate:true,rotateControl:false}).setView([48.8715,2.7767],16);
L.control.zoom({position:'topleft',zoomInTitle:typeof DisneyI18n==='undefined'?'Zoom in':DisneyI18n.text('Zoom in'),zoomOutTitle:typeof DisneyI18n==='undefined'?'Zoom out':DisneyI18n.text('Zoom out')}).addTo(map);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
const walkLayer=L.layerGroup().addTo(map),pins=L.layerGroup().addTo(map),lineLayer=L.layerGroup().addTo(map);
let userMarker=null,accuracyCircle=null,originMarker=null,originalMap=null;
let threeMap=null,mapMode='geo';
map.on('dragstart',()=>{following=false;if(headingUp)setHeadingUp(false);renderFollow();});
map.on('click',e=>{if($('map-object-sheet').open)closeMapObjectSheet();if(!pickStart||!router)return;const pt=[e.latlng.lat,e.latlng.lng],snap=router.snap(pt);if(snap.distance>70){toast('Bitte einen Startpunkt auf einem Parkweg wählen.');return;}pickStart=false;stopGPS();position=null;origin=pt;originLabel='Gewählter Start';updateStart();replan();toast('Startpunkt gespeichert.');});
function toast(s){$('toast').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(s);$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
function metric(m){return m>=1000?(m/1000).toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{maximumFractionDigits:2})+' km':Math.round(m/5)*5+' m';}
let parkDistanceMeters=null,farFromPark=false,nearbySortPreference=null;
function tooFarFromPark(){return farFromPark;}
function navigationBlocked(){if(!tooFarFromPark())return false;toast('Mehr als 10 km vom Disneyland entfernt. Du kannst jetzt deine Favoriten auswählen.');return true;}
function loadParkProximity(){try{farFromPark=localStorage.getItem(`${userKey}:far-from-park`)==='true';}catch{farFromPark=false;}if(farFromPark)$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Letzter bekannter Standort: mehr als 10 km entfernt. Standort aktivieren, um die Entfernung neu zu prüfen.');}
function updateParkProximity(latlng){const before=tooFarFromPark();parkDistanceMeters=RouteCore.distance(latlng,[48.87050,2.77972]);farFromPark=parkDistanceMeters>10000;if(before===farFromPark)return;try{localStorage.setItem(`${userKey}:far-from-park`,String(farFromPark));}catch{}if(farFromPark){exitNav();if($('route-playlist').open)$('route-playlist').close();if(!queueCheckin)closeQueueForBrowse();}renderRides();renderRoute();renderObjectInfo();renderMapObjectSheet();}
function syncCatalogDistanceMode(){const select=$('ride-sort'),far=tooFarFromPark();$('ride-sort-distance').hidden=far;$('ride-sort-distance').disabled=far;if(far&&select.value==='distance'){nearbySortPreference='distance';select.value='name';}else if(!far&&nearbySortPreference){select.value=nearbySortPreference;nearbySortPreference=null;}}
function minutes(m){return Math.max(1,Math.ceil(m/72));}
function save(){try{localStorage.setItem(userKey,JSON.stringify({favorites:[...favorites],visited:[...visited],deferred:[...deferred],uninterested:[...uninterested],priorityRideId:priorityRide?.id||null,allowUnavailableNavigation:priorityRide?.allowUnavailableNavigation===true}));if(typeof syncPush==='function')syncPush(true);return true;}catch{toast('Favoriten können in diesem Browser nicht dauerhaft gespeichert werden.');return false;}}
function load(){try{const s=JSON.parse(localStorage.getItem(userKey)||'{}');favorites=new Set((s.favorites||[]).filter(id=>pointById.has(id)));visited=new Set((s.visited||[]).filter(id=>pointById.has(id)));uninterested=new Set((s.uninterested||[]).filter(id=>typeof id==='string'&&id.startsWith('ride-')&&pointById.has(id)));deferred=new Set((s.deferred||[]).filter(id=>favorites.has(id)&&!visited.has(id)&&!uninterested.has(id)));priorityRide=pointById.get(s.priorityRideId)||null;if(priorityRide&&(!favorites.has(priorityRide.id)||visited.has(priorityRide.id)||uninterested.has(priorityRide.id)))priorityRide=null;if(priorityRide)priorityRide.allowUnavailableNavigation=s.allowUnavailableNavigation===true;}catch{favorites=new Set();visited=new Set();uninterested=new Set();deferred=new Set();priorityRide=null;} $('favorites-only').setAttribute('aria-pressed',onlyFav);}
function rpc(type,args={},timeout=0){return new Promise((resolve,reject)=>{const id=++messageId,timer=timeout?setTimeout(()=>{pending.delete(id);reject(Error('Routenberechnung konnte nicht gestartet werden.'));},timeout):null;pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});worker.postMessage({id,type,...args});});}
function remaining(){return data.rides.filter(r=>favorites.has(r.id)&&!visited.has(r.id)&&!uninterested.has(r.id)&&(targetAvailable(r)||priorityRide?.id===r.id&&priorityRide.allowUnavailableNavigation===true)&&parkMatches(r));}
function toggleFavorite(id){if(!pointById.has(id)||!id.startsWith('ride-')||uninterested.has(id))return;favorites.has(id)?favorites.delete(id):favorites.add(id);save();renderRides();renderPins();map.closePopup();if(route)replan();else renderRoute();}
function renderHiddenTargets(){
 $('open-hidden-targets').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`Ausblenden · ${uninterested.size}`);
 const dialog=$('hidden-targets-dialog');if(!dialog.open||!data)return;
 const hidden=data.rides.filter(r=>uninterested.has(r.id)).sort((a,b)=>a.name.localeCompare(b.name,(typeof DisneyI18n==='undefined'?'de':DisneyI18n.locale())));
 $('hidden-targets-list').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(hidden.length?hidden.map(r=>`<li data-object-row="${r.id}"><div><strong>${esc(r.name)}</strong><span>${esc(r.park==='Disney Adventure World'?'Adventure World':r.park)}</span></div><button class="secondary" data-restore-interest="${r.id}" aria-label="Wieder anzeigen: ${esc(r.name)}">Wieder anzeigen</button></li>`).join(''):'<li class="hidden-targets-empty">Keine ausgeblendeten Ziele.</li>');
}
async function setUninterested(id,hidden=true){
 const ride=pointById.get(id);if(!ride||!id.startsWith('ride-')||uninterested.has(id)===hidden)return;
 const recalculate=!!route||planning||nav;
 if(hidden){
  uninterested.add(id);deferred.delete(id);
  if(priorityRide?.id===id)priorityRide=null;
  if(focusedRideId===id)focusedRideId=null;
  if(pendingNoticeId===id)pendingNoticeId=null;
  if($('queue-prompt').dataset.rideId===id)$('queue-prompt').close();
  if($('object-dialog').dataset.rideId===id)$('object-dialog').close();
  if($('map-object-sheet').dataset.rideId===id)closeMapObjectSheet();
 }else uninterested.delete(id);
 // Discard the old route immediately; a pending worker result is invalidated by replan.
 if(recalculate){route=null;routeOrigin=null;planning=false;lineLayer.clearLayers();}
 save();map.closePopup();renderHiddenTargets();renderRides();renderPins();renderRoute();renderNearbyShows();
 if(recalculate)await replan();
 toast(hidden?`${ride.name} ausgeblendet.`:`${ride.name} wird wieder angezeigt.`);
}
$('object-uninterested').onclick=()=>setUninterested($('object-dialog').dataset.rideId);
$('open-hidden-targets').onclick=()=>{$('hidden-targets-dialog').showModal();renderHiddenTargets();};
$('close-hidden-targets').onclick=()=>$('hidden-targets-dialog').close();
$('hidden-targets-list').addEventListener('click',e=>{const button=e.target.closest('[data-restore-interest]');if(button)setUninterested(button.dataset.restoreInterest,false);});
function waitInfo(ride){const mapping=ride?.queueTimes;if(!mapping)return null;return DisneyWaits.describe(waits.get(`${mapping.parkId}:${mapping.rideId}`),Date.now(),waitsFailed||!navigator.onLine);}
const singleRiderIds={'4:2':7306,'4:8':7278,'28:10848':10849,'28:10845':10846,'28:32':7277,'28:37':7279,'28:34':7280,'28:35':7281,'28:15413':15422};
function singleRiderInfo(ride){const m=ride?.queueTimes,id=m&&singleRiderIds[`${m.parkId}:${m.rideId}`];return id?DisneyWaits.describe(waits.get(`${m.parkId}:${id}`),Date.now(),waitsFailed||!navigator.onLine):null;}
let queueCheckin=null;
const queueDwell=new DisneyQueueDwell.Dwell();let queueDwellDay='',pendingCheckinId=new URLSearchParams(location.search).get('checkin');
async function observeQueueDwell(){
 if(!data||!router)return;
 const day=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});
 if(day!==queueDwellDay){queueDwellDay=day;queueDwell.id=null;try{queueDwell.notified=new Set(JSON.parse(localStorage.getItem(`${userKey}:queue-hints:${day}`)||'[]'));}catch{queueDwell.notified=new Set();}}
 const canOffer=()=>!document.hidden&&!queueCheckin&&!document.querySelector('dialog[open]')&&(typeof activeHomeView==='undefined'||activeHomeView==='map')&&!document.activeElement?.matches('input,textarea,[contenteditable="true"]');
 const valid=canOffer()&&position&&position.accuracy<=30&&Date.now()-lastFix<20000&&insidePark(position.latlng);
 let nearest=null,best=40;
 if(valid)for(const ride of data.rides){if(ride.category!=='attraction'||visited.has(ride.id)||uninterested.has(ride.id)||!targetAvailable(ride)||!parkMatches(ride))continue;const d=Math.min(RouteCore.distance(position.latlng,ride.latlng),RouteCore.distance(position.latlng,data.nodes[ride.node]));if(d<best){best=d;nearest=ride;}}
 const target=pointById.get(route?.order[0]);const arrived=valid&&target?.category==='attraction'&&!visited.has(target.id)&&!uninterested.has(target.id)&&targetAvailable(target)&&parkMatches(target)&&Math.min(RouteCore.distance(position.latlng,target.latlng),RouteCore.distance(position.latlng,data.nodes[target.node]))<=25;
 const id=queueDwell.observe(arrived?target.id:nearest?.id,Date.now(),valid,!!arrived);if(!id)return;
 try{localStorage.setItem(`${userKey}:queue-hints:${day}`,JSON.stringify([...queueDwell.notified]));}catch{}
 const ride=pointById.get(id);
 if(!arrived&&'Notification'in window&&Notification.permission==='granted'&&navigator.serviceWorker){try{const reg=await navigator.serviceWorker.getRegistration();if(reg&&canOffer()){await reg.showNotification((typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`Check-in bei ${ride.name}?`),{body:(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Du bist seit 5 Minuten in der Nähe. Stehst du an? Antippen, um den Wartezeit-Timer zu starten.'),icon:'icon-192.png',tag:`disney-checkin-${id}`,data:{rideId:id,kind:'checkin'}});return;}}catch{}}
 if(!canOffer())return;
 $('queue-prompt').dataset.rideId=id;$('queue-prompt-name').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(ride.name);$('queue-prompt-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(arrived?'Am Ziel angekommen?':'Stehst du hier an?');$('queue-prompt-text').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(arrived?'Du bist bei deinem nächsten Ride. Check-in starten und deine Restwartezeit sehen?':'Du bist seit fünf Minuten in der Nähe. Check-in starten und deine Restwartezeit sehen?');if(!$('queue-dialog').open&&!$('setup-dialog').open)$('queue-prompt').showModal();
}
$('queue-prompt-start').onclick=()=>{const id=$('queue-prompt').dataset.rideId;$('queue-prompt').close();openQueueCheckin(id);};
$('queue-prompt-dismiss').onclick=()=>$('queue-prompt').close();
function saveQueueCheckin(){try{if(queueCheckin)localStorage.setItem(`${userKey}:queue-checkin`,JSON.stringify(queueCheckin));else localStorage.removeItem(`${userKey}:queue-checkin`);}catch{}}
function loadQueueCheckin(){try{const q=JSON.parse(localStorage.getItem(`${userKey}:queue-checkin`)||'null');if(q&&pointById.has(q.id)&&Number.isFinite(q.startedAt)&&q.startedAt<=Date.now()&&Date.now()-q.startedAt<86400000&&(q.minutes===null||Number.isFinite(q.minutes)&&q.minutes>=0&&q.minutes<=600))queueCheckin=q;}catch{}renderQueueCheckin();}
function waitedTime(q,now=Date.now()){
 const seconds=Math.floor(Math.max(0,now-q.startedAt)/1000);
 return `${Math.floor(seconds/60)} Min. ${String(seconds%60).padStart(2,'0')} Sek.`;
}
function queueProgress(q,now=Date.now()){
 const elapsed=Math.max(0,now-q.startedAt),actual=`Gewartet: ${waitedTime(q,now)}`;
 if(q.minutes===null)return `${actual} · Restzeit unbekannt`;
 const remaining=Math.max(0,Math.ceil(q.minutes-elapsed/60000));
 return remaining?`${actual} · noch ca. ${remaining} Min.`:actual;
}
function recordActualWait(q,now=Date.now(),outcome='boarded'){
 const entry={id:q.id,startedAt:q.startedAt,finishedAt:now,waitedMs:Math.max(0,now-q.startedAt),outcome};
 try{const history=JSON.parse(localStorage.getItem(`${userKey}:actual-waits`)||'[]');localStorage.setItem(`${userKey}:actual-waits`,JSON.stringify([...(Array.isArray(history)?history:[]),entry]));}catch{}
 return waitedTime(q,now);
}
function actualWaitBadge(ride){
 try{const entries=JSON.parse(localStorage.getItem(`${userKey}:actual-waits`)||'[]'),entry=entries.filter(e=>e.id===ride.id&&Number.isFinite(e.waitedMs)).at(-1);return entry?`<p class="actual-wait">Tatsächlich gewartet: ${waitedTime({startedAt:entry.startedAt},entry.finishedAt)}</p>`:'';}catch{return '';}
}
function parisWaitDay(at){return new Date(at).toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});}
function nextParisMidnight(day){
 const [y,m,d]=day.split('-').map(Number),target=Date.UTC(y,m-1,d+1);let at=target;
 for(let i=0;i<3;i++){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));at=target-(Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)-at);}
 return at;
}
function dailyWaitTotals(entries,active,now=Date.now()){
 const days=new Map();
 const add=(entry,running)=>{if(!Number.isFinite(entry.startedAt)||!Number.isFinite(entry.finishedAt)||entry.finishedAt<=entry.startedAt)return;let at=entry.startedAt,end=Math.min(now,entry.finishedAt);while(at<end){const day=parisWaitDay(at),until=Math.min(end,nextParisMidnight(day));if(until<=at)break;const row=days.get(day)||{day,waitedMs:0,liveMs:0,count:0};row.waitedMs+=until-at;if(running)row.liveMs+=until-at;else row.count++;days.set(day,row);at=until;}};
 for(const entry of entries)add(entry,false);if(active)add({...active,finishedAt:now},true);
 return [...days.values()].sort((a,b)=>b.day.localeCompare(a.day));
}
function waitDuration(ms){const seconds=Math.floor(ms/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);return `${hours?hours+' Std. ':''}${minutes} Min. ${String(seconds%60).padStart(2,'0')} Sek.`;}
function renderDailyWaits(){
 let entries=[];try{const value=JSON.parse(localStorage.getItem(`${userKey}:actual-waits`)||'[]');if(Array.isArray(value))entries=value;}catch{}
 const rows=dailyWaitTotals(entries,queueCheckin),today=parisWaitDay(Date.now());
 $('daily-wait-list').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(rows.map(row=>`<li><div><strong>${row.day===today?'Heute':new Date(row.day+'T12:00:00Z').toLocaleDateString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Paris'})}</strong><span>${row.count} ${row.count===1?'erfasste Wartezeit':'erfasste Wartezeiten'}${row.liveMs?` · läuft: ${waitDuration(row.liveMs)}`:''}</span></div><b>${waitDuration(row.waitedMs)}</b></li>`).join('')||'<li class="small">Noch keine Anstehzeiten erfasst. Starte beim Anstellen einen Check-in.</li>');
}
function finishQueueForNavigation(nextId=null){
 if(!queueCheckin||nextId===queueCheckin.id)return false;
 recordActualWait(queueCheckin,Date.now(),'navigation');queueCheckin=null;saveQueueCheckin();
 if($('queue-dialog').open)$('queue-dialog').close();renderQueueCheckin();return true;
}
function renderQueueBubble(){
 const active=queueCheckin&&pointById.get(queueCheckin.id),bubble=$('queue-bubble');bubble.hidden=!active;
 document.body.classList.toggle('queue-active',!!active);if(!active)return;
 $('queue-bubble-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(active.name);$('queue-bubble-title').dataset.objectInfo=active.id;
 $('queue-bubble-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`Du stehst noch an · ${waitedTime(queueCheckin)}`);
}
function rememberQueueHint(id){
 const day=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'}),key=`${userKey}:queue-hints:${day}`;
 let handled=new Set();try{handled=new Set(JSON.parse(localStorage.getItem(key)||'[]'));}catch{}
 if(queueDwellDay===day)for(const previous of queueDwell.notified)handled.add(previous);
 handled.add(id);queueDwellDay=day;queueDwell.notified=handled;
 try{localStorage.setItem(key,JSON.stringify([...handled]));}catch{}
}
function closeQueueForBrowse(){
 if($('queue-dialog').open)$('queue-dialog').close();
 if($('queue-prompt').open)$('queue-prompt').close();
}
function openQueueCheckin(id){
 if(!queueCheckin&&navigationBlocked())return;const ride=pointById.get(id);if(!ride||ride.category!=='attraction'||(uninterested.has(id)||!targetAvailable(ride))&&queueCheckin?.id!==id)return;
 if(queueCheckin&&queueCheckin.id!==id){id=queueCheckin.id;toast('Eine Wartezeit läuft bereits. Erst beenden oder abbrechen.');}
 rememberQueueHint(id);
 $('queue-dialog').dataset.rideId=id;if(!$('queue-dialog').open)$('queue-dialog').show();document.body.classList.add('queue-sheet-open');
 const active=queueCheckin?.id===id,info=waitInfo(pointById.get(id)),mapping=pointById.get(id).queueTimes,entry=mapping&&waits.get(`${mapping.parkId}:${mapping.rideId}`);
 $('queue-minutes').value=info?.kind==='open'?entry.minutes:'';
 $('queue-source').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(info?.kind==='open'?'Aktuelle Wartezeit übernommen. Du kannst die Anzeige am Eingang eintragen.':'Keine aktuelle Wartezeit verfügbar. Optional die Minuten vom Eingang eintragen.');
 renderQueueCheckin();
}
function renderQueueCheckin(){
 renderDailyWaits();renderQueueBubble();if(typeof renderMapObjectQueueProgress==='function')renderMapObjectQueueProgress();
 const target=pointById.get(route?.order[0]),active=queueCheckin&&pointById.get(queueCheckin.id);
 $('nav-checkin').hidden=!active&&target?.category!=='attraction';
 $('nav-checkin').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(active?'Wartezeit':'Check-in');$('nav-checkin').title=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(active?`${active.name} · ${queueProgress(queueCheckin)}`:'Beim Anstellen Check-in starten');
 $('info-checkin').hidden=!active;if(active&&route?.order[0]===queueCheckin.id)$('nav-distance').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(queueProgress(queueCheckin));
 for(const button of document.querySelectorAll('[data-checkin]'))button.textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(queueCheckin?.id===button.dataset.checkin?queueProgress(queueCheckin):'Check-in · Anstellen');
 const dialog=$('queue-dialog');dialog.classList.toggle('queue-active-sheet',!!queueCheckin&&queueCheckin.id===dialog.dataset.rideId);if(!dialog.open)return;
 const ride=pointById.get(dialog.dataset.rideId),checked=queueCheckin?.id===ride?.id;
 $('queue-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(ride?.name||'Wartezeit');$('queue-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(checked?queueProgress(queueCheckin):'Check-in starten, sobald du in der Warteschlange stehst.');
 $('queue-estimate').hidden=checked;$('queue-source').hidden=checked;$('queue-start').hidden=checked;$('queue-finish').hidden=!checked;$('queue-cancel').hidden=!checked;
}
$('queue-start').onclick=()=>{if(navigationBlocked())return;const id=$('queue-dialog').dataset.rideId,raw=$('queue-minutes').value.trim(),minutes=raw===''?null:Number(raw);if(minutes!==null&&(!Number.isFinite(minutes)||minutes<0||minutes>600)){toast('Bitte eine Wartezeit von 0 bis 600 Minuten eingeben.');return;}if(queueCheckin&&queueCheckin.id!==id)return;if(queueCheckin?.id===id)return;queueCheckin={id,startedAt:Date.now(),minutes};rememberQueueHint(id);saveQueueCheckin();$('queue-dialog').close();renderLines();renderPins();renderNav();toast('Check-in gestartet · Wartezeit läuft.');};
$('queue-finish').onclick=async()=>{const id=queueCheckin?.id;if(!id)return;const actual=recordActualWait(queueCheckin);queueCheckin=null;saveQueueCheckin();$('queue-dialog').close();renderQueueCheckin();await complete(id);toast(`Tatsächlich gewartet: ${actual}`);};
$('queue-cancel').onclick=()=>{if(queueCheckin)recordActualWait(queueCheckin,Date.now(),'cancelled');queueCheckin=null;saveQueueCheckin();$('queue-dialog').close();renderLines();renderPins();renderNav();};
$('queue-close').onclick=()=>$('queue-dialog').close();$('queue-dialog').addEventListener('close',()=>document.body.classList.remove('queue-sheet-open'));
$('nav-checkin').onclick=()=>openQueueCheckin(queueCheckin?.id||route?.order[0]);
$('queue-bubble-status').onclick=()=>queueCheckin&&openQueueCheckin(queueCheckin.id);
$('info-checkin').onclick=()=>queueCheckin&&openQueueCheckin(queueCheckin.id);
document.addEventListener('click',event=>{const button=event.target.closest('[data-checkin]');if(button)openQueueCheckin(button.dataset.checkin);});
setInterval(()=>{if(!document.hidden)renderQueueCheckin();},1000);
// Published RCDB specifications, checked 2026-10-05. Missing G values remain unknown.
const coasterFacts={
 'ride-1271516009':{source:'1444',g:5,speed:92,inversions:3},
 'ride-11251453535':{source:'959',speed:71,inversions:3},
 'ride-1011446599':{source:'956',speed:65,inversions:0},
 'ride-40362832':{source:'957',inversions:1},
 'ride-11263162318':{source:'3306',inversions:0},
 'ride-51547889':{source:'1170',inversions:0}
};
function objectInfo(ride){
 const type=ride.type==='roller_coaster'?'Achterbahn':ride.category==='show'?'Show / Parade':ride.category==='character'?'Figurenbegegnung':ride.serviceType==='water'?'Trinkwasserstelle':ride.serviceType==='restaurant'?DisneyRestaurantSearch.description(ride):(ride.id.startsWith('wc-')||ride.id.startsWith('service-'))?'Toilette':'Attraktion',facts=coasterFacts[ride.id];
 let html=`<p class="object-meta">${esc([type,ride.land].filter(Boolean).join(' · '))}</p>`;
 html+=ageBadge(ride,true);
 if(Number.isFinite(ride.minHeightCm))html+=`<p>${ride.minHeightCm?`Mindestgröße: ${ride.minHeightCm} cm`:'Keine Mindestgröße'}${ride.accompaniedBelowCm?` · unter ${ride.accompaniedBelowCm} cm begleitet`:''}</p>`;
 if(ride.intensity==='strong')html+='<p>Intensive Attraktion</p>';
 if(ride.bookingRequired)html+='<p>Reservierung in der Disney-App erforderlich</p>';
 if(ride.type==='roller_coaster'){
  html+=`<p class="coaster-specs">${facts?.speed?`Bis ca. ${facts.speed} km/h · `:''}${Number.isFinite(facts?.inversions)?`${facts.inversions} Überschläge<br>`:''}<strong>${Number.isFinite(facts?.g)?`G-Kräfte: bis ${facts.g.toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()))} g`:'G-Kräfte: keine verlässliche Angabe'}</strong></p>`;
  if(facts)html+=`<a class="object-source" href="https://rcdb.com/${facts.source}.htm" target="_blank" rel="noopener">Fahrdaten: RCDB · 05.10.2026</a>`;
 }
 if(ride.officialUrl)html+=`<a class="object-source" href="${esc(typeof DisneyI18n==='undefined'?ride.officialUrl:DisneyI18n.sourceUrl(ride.id,ride.officialUrl))}" target="_blank" rel="noopener">Offizielle Disney-Infos</a>`;
 return html;
}
let showTravelCache=null;
function showWalkingMinutes(ride){
 if(!router)return null;
 const key=origin.join(',');
 if(!showTravelCache||showTravelCache.key!==key||showTravelCache.router!==router){const snap=router.snap(origin);showTravelCache={key,router,snap,ds:snap.distance<=90?router.tree(snap.node).ds:null};}
 if(!showTravelCache.ds)return null;
 const meters=showTravelCache.ds[ride.node]+showTravelCache.snap.distance+(ride.offset||0);
 return Number.isFinite(meters)?Math.ceil(Math.max(0,meters)/72):Infinity;
}
function showAvailable(ride,now=Date.now()){
 if(ride?.category!=='show')return true;
 const live=shows.get(ride.themeparksId),remaining=DisneyShows.hasRemainingToday(live,now,showsScheduleAt,ride);
 if(remaining!==true)return false;
 const walk=showWalkingMinutes(ride);
 return walk!==null&&DisneyShows.canAttendToday(live,now,showsScheduleAt,walk,ride)===true;
}
function targetAvailable(ride,now=Date.now()){
 if(!ride)return false;
 const m=ride.queueTimes,key=m&&`${m.parkId}:${m.rideId}`,singleId=key&&singleRiderIds[key];
 if(DisneyWaits.isClosed(key&&waits.get(key),singleId&&waits.get(`${m.parkId}:${singleId}`)))return false;
 if(ride.category==='show'&&shows.get(ride.themeparksId)?.status==='CLOSED')return false;
 return showAvailable(ride,now);
}
function nextShowBadge(ride,now=Date.now()){
 if(ride.category!=='show')return '';
 const live=shows.get(ride.themeparksId),slot=DisneyShows.nextPerformance(live,now);
 if(!slot)return `<span class="next-show-time muted">${live&&Array.isArray(live.showtimes)?'Heute keine weitere Show bestätigt':'Spielzeiten noch nicht bestätigt'}</span>`;
 const clock=t=>new Date(t).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}),mins=Math.ceil((slot.start-now)/60000);
 return `<span class="next-show-time">${slot.state==='running'?`Läuft seit ${clock(slot.start)}${slot.language?' · '+esc(slot.language):''}`:`Nächste Show: ${clock(slot.start)}${slot.language?' · '+esc(slot.language):''} · ${mins===0?'beginnt jetzt':'in '+mins+' Min.'}`}${ride.eventSetting==='indoor'&&slot.state==='upcoming'?`<small>Spätestens ${clock(DisneyShows.arrivalDeadline(slot.start,ride))} da sein</small>`:''}</span>`;
}
function showSchedule(ride,now=Date.now()){
 if(ride.category!=='show')return '';
 const live=shows.get(ride.themeparksId),slots=DisneyShows.today(live,now),fresh=showsFetchedAt>0&&now-showsFetchedAt<=300000;
 const indoor=ride.eventSetting==='indoor';
 const clock=t=>new Date(t).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});
 return `<section class="show-schedule"><h3>Spielzeiten heute</h3>${indoor?'<p class="event-arrival">Indoor · Mindestens 10 Min. vor Beginn da sein</p>':ride.eventSetting==='outdoor'?'<p class="event-arrival">Outdoor</p>':''}${!fresh?'<p class="small">Spielzeiten derzeit nicht aktuell bestätigt.</p>':''}${live?.status==='CLOSED'?'<p>Show derzeit geschlossen</p>':''}${slots.length?`<ul>${slots.map(t=>`<li class="show-time ${t.state}"><strong>${clock(t.start)}${Number.isFinite(t.end)&&t.end>t.start?' – '+clock(t.end):''}${t.language?' · '+esc(t.language):''}</strong><span>${t.state==='past'?(t.start===now?'Beginnt jetzt':'Beginn vor '+Math.ceil((now-t.start)/60000)+' Min.'):t.state==='running'?'Läuft gerade':'in '+Math.ceil((t.start-now)/60000)+' Min.'}${indoor?`<small>Spätestens ${clock(DisneyShows.arrivalDeadline(t.start,ride))} da sein</small>`:''}</span></li>`).join('')}</ul>`:'<p>Keine Spielzeiten für heute veröffentlicht.</p>'}<a class="object-source" href="https://www.themeparks.wiki/" target="_blank" rel="noopener">Spielzeiten: ThemeParks.wiki · Ortszeit Paris</a></section>`;
}
const waitHistories=new Map();
function waitHistoryDay(now=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function waitHistoryKey(ride){return `${ride.queueTimes.parkId}:${ride.queueTimes.rideId}:${waitHistoryDay()}`;}
function waitHistoryMarkup(ride){
 if(ride.category==='show'||(ride.id.startsWith('wc-')||ride.id.startsWith('service-')))return '';
 if(!ride.queueTimes)return '<section class="wait-history"><h3>Wartezeiten im Tagesverlauf</h3><p class="small">Für dieses Ziel werden keine Wartezeiten veröffentlicht.</p></section>';
 const record=waitHistories.get(waitHistoryKey(ride)),payload=record?.payload,typical=record?.view!=='today';
 const heading=`<h3>${typical?'Durchschnitt im Tagesverlauf':'Wartezeiten heute'}</h3>`,toggle=`<div class="history-view-toggle" role="group" aria-label="Statistik-Zeitraum"><button type="button" data-history-view="average" aria-pressed="${typical}">Ø Tagesverlauf</button><button type="button" data-history-view="today" aria-pressed="${!typical}">Heute</button></div>`;
 if(!payload)return `<section class="wait-history">${heading}<p class="small" role="status">${record?.error?'Tagesverlauf momentan nicht verfügbar.':navigator.onLine?'Tagesverlauf wird geladen …':'Offline · Tagesverlauf nicht geladen.'}</p></section>`;
 const ids=[ride.queueTimes.rideId,singleRiderIds[`${ride.queueTimes.parkId}:${ride.queueTimes.rideId}`]].filter(Number.isInteger);
 const series=ids.map((id,i)=>{
  const source=(typical?payload.typical?.series:payload.series)?.find(s=>s.id===id);
  const samples=typical?(source?.samples||[]).filter(s=>Number.isInteger(s.minute)&&s.minute>=0&&s.minute<1440&&s.minute%15===0&&Number.isFinite(s.minutes)&&s.minutes>=0&&s.minutes<=600).map(s=>({...s,at:s.minute,until:s.minute+15})):(source?.samples||[]).filter(s=>Number.isInteger(s.at)&&Number.isInteger(s.minutes)&&s.minutes>=0&&s.minutes<=600&&s.at*1000<=Date.now()&&waitHistoryDay(s.at*1000)===payload.date);
  return {label:i?'Single Rider':'Normal',tone:i?'single':'regular',days:source?.days||0,range:source?.range,meanMinutes:source?.meanMinutes,hasMean:!!source&&Object.prototype.hasOwnProperty.call(source,'meanMinutes'),samples:samples.sort((a,b)=>a.at-b.at)};
 });
 const samples=series.flatMap(s=>s.samples),stale=record.error||payload.stale||!Number.isFinite(payload.fetchedAt)||Date.now()-payload.fetchedAt*1000>=300000;
 if(!samples.length)return `<section class="wait-history">${heading}${toggle}<p class="small">${typical?'Noch keine Messwerte innerhalb bestätigter regulärer Öffnungszeiten für den Durchschnitt.':'Für heute noch keine Messwerte gespeichert.'}</p>${stale?'<p class="small">Letzter Stand · Aktualisierung derzeit nicht bestätigt.</p>':''}</section>`;
 const timeLabel=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.floor(m%60)).padStart(2,'0')}`;
 const clock=at=>typical?timeLabel(at):new Date(at*1000).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});
 const minute=at=>{if(typical)return at;const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at*1000);return Number(parts.find(p=>p.type==='hour').value)*60+Number(parts.find(p=>p.type==='minute').value);};
 const ranges=typical?series.map(s=>s.range).filter(r=>Number.isInteger(r?.startMinute)&&Number.isInteger(r.endMinute)&&r.startMinute>=0&&r.endMinute<=1440&&r.endMinute>r.startMinute):[];
 const nowParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(Date.now());
 const nowMinute=Number(nowParts.find(p=>p.type==='hour').value)*60+Number(nowParts.find(p=>p.type==='minute').value),start=ranges.length?Math.min(...ranges.map(r=>r.startMinute)):Math.floor(Math.min(...samples.map(s=>minute(s.at)))/60)*60,baseEnd=ranges.length?Math.max(...ranges.map(r=>r.endMinute)):Math.min(1440,Math.max(start+60,Math.ceil(Math.max(...samples.map(s=>minute(s.until||s.at)))/60)*60)),end=typical?baseEnd:Math.min(1440,Math.max(baseEnd,Math.ceil(nowMinute/60)*60)),max=Math.max(20,Math.ceil(Math.max(...samples.map(s=>s.minutes))/20)*20),x=at=>36+(minute(at)-start)/(end-start)*280,y=minutes=>144-minutes/max*116;
 const chartSeries=series.map(s=>({label:s.label,samples:s.samples.map((p,i)=>({from:minute(p.at),to:minute(p.until||p.at)+(p.until?0:Math.min(15,s.samples[i+1]?Math.max(0,minute(s.samples[i+1].at)-minute(p.at)):15)),minutes:p.minutes}))}));
 const nowX=36+(nowMinute-start)/(end-start)*280,nowLine=`<g class="history-now" style="display:${nowMinute>=start&&nowMinute<=end?'':'none'}"><line x1="${nowX}" x2="${nowX}" y1="28" y2="144"/><text x="${Math.max(75,Math.min(280,nowX))}" y="24" text-anchor="middle">Jetzt ${timeLabel(nowMinute)}</text></g>`;
 const grid=[0,max/2,max].map(v=>`<line x1="36" y1="${y(v)}" x2="316" y2="${y(v)}"/><text x="29" y="${y(v)+4}" text-anchor="end">${v}</text>`).join('');
 const ticks=[start,start+(end-start)/3,start+2*(end-start)/3,end].map(m=>`<text x="${36+(m-start)/(end-start)*280}" y="169" text-anchor="middle">${timeLabel(m)}</text>`).join('');
 const number=n=>n.toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{maximumFractionDigits:1});
 const lines=series.map(s=>{const segments=[];for(const point of s.samples){const last=segments.at(-1);if(!last||point.breakBefore||point.at-(last.at(-1).until||last.at(-1).at)>(typical?0:900))segments.push([point]);else last.push(point);}return segments.map(points=>`<polyline class="history-line ${s.tone}" points="${points.flatMap(p=>[`${x(p.at)},${y(p.minutes)}`,`${x(Number.isInteger(p.until)?typical?p.until:Math.min(p.until,Date.now()/1000):p.at)},${y(p.minutes)}`]).join(' ')}"/>`).join('')+s.samples.map(p=>`<circle class="history-dot ${s.tone}" cx="${x(p.at)}" cy="${y(p.minutes)}" r="2"><title>${s.label} · ${clock(p.at)}${typical?'–'+clock(p.until):''} · ${number(p.minutes)} Min.${typical?' · '+p.days+' Tage':''}</title></circle>`).join('');}).join('');
 const stats=series.map(s=>{if(!s.samples.length)return `<p class="small">${s.label}: noch keine Messwerte.</p>`;const values=s.samples.map(p=>p.minutes),durations=s.samples.map(p=>typical?Number.isFinite(p.observedSeconds)?p.observedSeconds:0:Number.isInteger(p.until)?Math.max(0,Math.min(p.until,Date.now()/1000)-p.at):0),duration=durations.reduce((sum,n)=>sum+n,0),average=Math.round(duration?values.reduce((sum,n,i)=>sum+n*durations[i],0)/duration:values.reduce((sum,n)=>sum+n,0)/values.length),displayAverage=!typical&&s.hasMean?(Number.isFinite(s.meanMinutes)?Math.round(s.meanMinutes):null):average;return `<div class="history-series"><strong class="history-legend ${s.tone}">${s.label}${typical?' · '+s.days+(s.days===1?' erfasster Tag':' erfasste Tage'):''}</strong><dl class="history-stats"><div><dt>${typical?'Kleinstes Ø':'Minimum'}</dt><dd>${number(Math.min(...values))}<small> Min.</small></dd></div><div><dt>Ø zeitgewichtet</dt><dd>${displayAverage===null?'—':displayAverage}<small> Min.</small></dd></div><div><dt>${typical?'Größtes Ø':'Maximum'}</dt><dd>${number(Math.max(...values))}<small> Min.</small></dd></div></dl></div>`;}).join('');
 const averageNote='<p class="history-note">Durchschnitt nur ab regulärer Öffnung + 15 Min. bis Schließung − 15 Min. Extra Magic Time zählt nicht. Ohne bestätigte Parkzeiten kein Durchschnitt.</p>';
 const windowNote=!typical&&payload.averageWindows?.length?`<p class="history-note">Ø-Fenster heute: ${payload.averageWindows.map(w=>new Date(w.start*1000).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})+'–'+new Date(w.end*1000).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})).join(', ')} Uhr.</p>`:'';
 const firstMinute=Math.min(...samples.map(s=>minute(s.at))),coverageNote=typical&&firstMinute>start?`<p class="history-note history-coverage">Messwerte bisher ab ${timeLabel(firstMinute)} Uhr. Davor fehlen gespeicherte Daten.</p>`:'';
 const note=typical?'15-Minuten-Mittel · gespeicherte Daten der letzten 30 Tage':`${samples.length} Datenpunkte · ${clock(Math.min(...samples.map(s=>s.at)))}–${clock(Math.max(...samples.map(s=>s.at)))} Uhr`;
 return `<section class="wait-history">${heading}${toggle}<p class="history-note">${stale?'Letzter Stand · ':''}${note}</p>${coverageNote}<svg class="history-chart" data-chart-start="${start}" data-chart-end="${end}" data-chart-view="${typical?'average':'today'}" data-chart-series="${esc(JSON.stringify(chartSeries))}" viewBox="0 0 336 180" role="img" aria-label="${typical?'Durchschnittliche Wartezeiten in 15-Minuten-Fenstern':'Wartezeiten heute'} in Minuten, Uhrzeit Paris"><text x="36" y="16">Min.</text><g class="history-grid">${grid}${ticks}</g>${lines}${nowLine}<line class="history-selection" hidden y1="28" y2="144"/></svg><p class="history-cursor" aria-live="polite">Über das Diagramm wischen, um Uhrzeit und Werte abzulesen.</p>${stats}${averageNote}${windowNote}<p class="history-note">${typical?'Je Zeitfenster zählt nur die tatsächlich erfasste Dauer offener Warteschlangen.':'Nur Messwerte offener Warteschlangen. Unveränderte Werte werden fortgeschrieben.'} Lücken bedeuten keine Messung, nicht 0 Minuten. Ortszeit Paris.</p><a class="object-source" href="https://queue-times.com/" target="_blank" rel="noopener">Powered by Queue-Times.com</a><a class="object-source" href="https://www.themeparks.wiki/" target="_blank" rel="noopener">Parkzeiten: ThemeParks.wiki</a></section>`;
}
async function refreshWaitHistory(ride){
 if(!ride.queueTimes||ride.category==='show'||!navigator.onLine)return;
 const key=waitHistoryKey(ride),previous=waitHistories.get(key);
 if(previous?.busy||previous&&Date.now()-previous.at<60000)return;
 const record={...previous,at:Date.now(),busy:true,error:false};waitHistories.set(key,record);
 try{
  const m=ride.queueTimes,single=singleRiderIds[`${m.parkId}:${m.rideId}`],preview=(location.pathname==='/'||location.pathname==='/index.html'||location.pathname==='/App/')&&location.hostname!=='abetterdisneylandparisapp.weletapi.com';
  const url=preview?'wait-history-preview.json':`index.php?waitHistory=1&park=${m.parkId}&ride=${m.rideId}${single?`&single=${single}`:''}`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let response;
  try{response=await fetch(url,{cache:'no-store',redirect:'error',signal:controller.signal});}finally{clearTimeout(timer);}
  if(!response.ok)throw Error('History unavailable');const payload=await response.json();
  if(payload.date!==waitHistoryDay()||!Array.isArray(payload.series))throw Error('Wrong history day');
  record.payload=payload;
 }catch{record.error=true;}finally{record.busy=false;if($('wait-history-dialog').open&&$('wait-history-dialog').dataset.rideId===ride.id)renderWaitHistoryDialog();}
}
let waitHistoryParent=null;
function renderWaitHistoryDialog(){
 const dialog=$('wait-history-dialog');if(!dialog.open)return;
 const ride=pointById.get(dialog.dataset.rideId);if(!ride)return;
 const scroll=$('wait-history-content').scrollTop;
 $('wait-history-content').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(waitHistoryMarkup(ride));$('wait-history-content').scrollTop=scroll;
 refreshWaitHistory(ride);
}
function openWaitHistory(id){
 const ride=pointById.get(id);if(!ride||uninterested.has(id)||!ride.queueTimes)return;
 const dialog=$('wait-history-dialog');dialog.dataset.rideId=id;$('wait-history-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(ride.name);
 waitHistoryParent=null;
 for(const name of ['map-object-sheet','object-dialog','route-playlist'])if($(name).open){waitHistoryParent=name;$(name).close();break;}
 $('wait-history-content').scrollTop=0;dialog.showModal();renderWaitHistoryDialog();
}
$('wait-history-close').onclick=()=>$('wait-history-dialog').close();
$('wait-history-dialog').addEventListener('close',()=>{if(objectParentDialog==='wait-history-dialog')return;const parent=waitHistoryParent;waitHistoryParent=null;if(parent){if(parent==='map-object-sheet'){$(parent).show();renderMapObjectSheet();}else{$(parent).showModal();if(parent==='object-dialog')renderObjectInfo();else renderPlaylist();}}});
let objectParentDialog=null;
const unavailablePhotos=new Set();
function objectPhotoList(ride){
 const entry=typeof DisneyGuide==='undefined'?null:DisneyGuide.get(ride.id);
 return (entry?.photos||[]).filter(photo=>/^photos\/[a-f0-9]{16}\.(?:webp|gif)$/.test(photo.src)&&!unavailablePhotos.has(photo.src));
}
function objectPhotos(ride){
 const photos=objectPhotoList(ride);if(!photos.length)return '';
 return `<section class="object-photos" aria-label="Fotos: ${esc(ride.name)}"><div class="object-photo-strip ${photos.length===1?'single':''}" data-photo-ride="${esc(ride.id)}">${photos.map((photo,index)=>`<button class="object-photo" data-photo-index="${index}" aria-label="Foto ${index+1} von ${photos.length} vergrößern: ${esc(ride.name)}"><img src="${esc(photo.src)}" alt="${esc(ride.name)} · Foto ${index+1}" loading="lazy" decoding="async"><span aria-hidden="true">⤢</span></button>`).join('')}</div><p class="object-photo-caption">${esc(photos[0].credit)}${photos.length>1?` · ${photos.length} Bilder · Wischen für weitere Bilder`:''}</p></section>`;
}
function openObjectPhoto(index,rideId=$('object-dialog').dataset.rideId){
 const viewer=$('photo-dialog'),ride=pointById.get(rideId);if(!ride)return;viewer.dataset.photoRideId=ride.id;
 const photos=objectPhotoList(ride);if(!Number.isInteger(index)||index<0||index>=photos.length)return;
 viewer.dataset.photoIndex=index;$('photo-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(ride.name);
 $('photo-image').src=photos[index].src;$('photo-image').alt=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`${ride.name} · Foto ${index+1}`);$('photo-image').hidden=false;
 $('photo-position').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`${index+1} / ${photos.length} · ${photos[index].credit}`);
 $('photo-previous').hidden=$('photo-next').hidden=photos.length<2;
 $('photo-previous').disabled=index===0;$('photo-next').disabled=index===photos.length-1;
 if(!viewer.open)viewer.showModal();
}
$('object-content').addEventListener('click',event=>{const button=event.target.closest('[data-photo-index]');if(button)openObjectPhoto(Number(button.dataset.photoIndex));});
$('object-content').addEventListener('error',event=>{const image=event.target;if(!image.matches?.('.object-photo img'))return;unavailablePhotos.add(image.getAttribute('src'));const gallery=image.closest('.object-photos');image.closest('button').hidden=true;if(!gallery.querySelector('.object-photo:not([hidden])'))gallery.hidden=true;},true);
$('photo-close').onclick=()=>$('photo-dialog').close();
$('photo-previous').onclick=()=>openObjectPhoto(Number($('photo-dialog').dataset.photoIndex)-1,$('photo-dialog').dataset.photoRideId);
$('photo-next').onclick=()=>openObjectPhoto(Number($('photo-dialog').dataset.photoIndex)+1,$('photo-dialog').dataset.photoRideId);
$('photo-dialog').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();openObjectPhoto(Number($('photo-dialog').dataset.photoIndex)+(event.key==='ArrowRight'?1:-1),$('photo-dialog').dataset.photoRideId);}});
$('photo-image').onerror=()=>{$('photo-image').hidden=true;$('photo-position').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Foto gerade nicht verfügbar');};
function cachedDisneyInfo(ride){
 const entry=typeof DisneyGuide==='undefined'?null:DisneyGuide.get(ride.id);if(!entry)return '<p>Keine gespeicherten Disney-Infos für dieses Ziel.</p>';
 const date=value=>value?new Date(`${value}T12:00:00Z`).toLocaleDateString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale())):null;
 const rows=[['Park',ride.park],['Bereich',ride.land],['Erlebnis',ride.category==='show'?'Show / Parade':ride.category==='character'?'Figurenbegegnung':ride.serviceType==='water'?'Trinkwasserstelle':ride.serviceType==='restaurant'?DisneyRestaurantSearch.description(ride):'Attraktion']];
 if(Number.isFinite(ride.minHeightCm))rows.push(['Mindestgröße',ride.minHeightCm?`${ride.minHeightCm} cm`:'Keine Mindestgröße']);
 if(ride.accompaniedBelowCm)rows.push(['Begleitung',`Unter ${ride.accompaniedBelowCm} cm begleitet`]);
 if(ride.bookingRequired)rows.push(['Reservierung','In der Disney-App erforderlich']);
 const list=(title,items)=>items.length?`<section class="disney-guide-section"><h3>${title}</h3><ul>${items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></section>`:'';
 return `<p class="guide-cache-label">✓ Vorab gespeichert · ${date(entry.detailDate||entry.catalogueDate)}</p>${objectPhotos(ride)}${ageBadge(ride,true)}<dl class="disney-guide-facts">${rows.filter(([,value])=>value).map(([key,value])=>`<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${list('Das erwartet dich',entry.tags)}${list('Services',entry.services)}${list('Zugang & Hinweise',entry.access)}${showSchedule(ride)}<p class="small">${entry.detailDate?'Angaben aus dem Disney-Verzeichnis und der öffentlichen Detailseite.':'Basisangaben aus dem Disney-Verzeichnis; ergänzende Detailangaben nicht verfügbar.'} Wartezeiten und Spielzeiten werden separat live geladen.</p>${entry.moreOnOriginal?'<p class="small">Weitere individuelle Zugangsvorgaben stehen auf der Originalseite.</p>':''}${entry.sourceUrl?`<a class="secondary guide-original" href="${esc(typeof DisneyI18n==='undefined'?entry.sourceUrl:DisneyI18n.sourceUrl(ride.id,entry.sourceUrl))}" target="_blank" rel="noopener">Originalseite bei Disney ↗</a>`:'<p class="small">Für diesen Bahnhof gibt es keinen eigenen Disney-Eintrag.</p>'}`;
}
function renderObjectInfo(){
 const dialog=$('object-dialog');if(!dialog.open)return;const ride=pointById.get(dialog.dataset.rideId);if(!ride)return;
 const d=rideDistances().get(ride.id),info=waitInfo(ride),single=singleRiderInfo(ride),wc=(ride.id.startsWith('wc-')||ride.id.startsWith('service-'));
 const scrollTop=$('object-content').scrollTop,photoStrip=$('object-content').querySelector('.object-photo-strip'),photoScroll=photoStrip?.dataset.photoRide===ride.id?photoStrip.scrollLeft:0;
 const expanded=dialog.querySelector('.object-facts')?.open||false;
 $('object-content').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(`<p class="object-meta">${ride.serviceType==='restaurant'?esc(DisneyRestaurantSearch.description(ride))+' · ':''}${esc(ride.park)}${ride.eventSetting==='indoor'?' · Indoor':ride.eventSetting==='outdoor'?' · Outdoor':''}${visited.has(ride.id)?' · Besucht':''}${deferred.has(ride.id)?' · Für später':''}</p><p class="object-travel">${Number.isFinite(d)?`${minutes(d)} Min. zu Fuß · ${metric(d)} ab ${esc(originLabel)}`:tooFarFromPark()?'Navigation in der Nähe des Parks verfügbar':'Fußweg nicht verfügbar'}</p>${ageBadge(ride)}<div class="object-waits">${ride.serviceType==='restaurant'?(ratingBadge(ride)||'<span class="small">Bewertung noch nicht verfügbar</span>'):waitBadge(ride)}</div>${childBadge(ride)}${queueCheckin?.id===ride.id?`<p class="actual-wait">${esc(queueProgress(queueCheckin))}</p>`:''}${showSchedule(ride)}${objectPhotos(ride)}<details class="object-facts" ${expanded?'open':''}><summary>${ride.category==='show'?'Über diese Show':'Weitere Infos & Bewertungen'}</summary>${objectInfo(ride)}${ride.approximateArea?'<p>Bereich ungefähr · Treffpunkt vor Ort prüfen</p>':ride.approximateEntrance?'<p class="small">Zugang ungefähr · Beschilderung vor Ort folgen</p>':''}${actualWaitBadge(ride)}${ratingBadge(ride)}${info?`<p class="small">Normal: ${esc(info.detail)}</p><a class="object-source" href="https://queue-times.com/" target="_blank" rel="noopener">Powered by Queue-Times.com</a>`:''}${single?`<p class="small">Single Rider: ${esc(single.detail)}</p>`:''}</details>`);
 $('object-next').hidden=wc&&!ride.serviceType;$('object-next').disabled=tooFarFromPark()||planning||route?.order[0]===ride.id;$('object-next').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(route?.order[0]===ride.id?'Aktuelles Ziel':ride.serviceType?'Dorthin navigieren':'▶ Als Nächstes');
 $('object-favorite').hidden=wc;$('object-favorite').setAttribute('aria-pressed',favorites.has(ride.id));$('object-favorite').setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(favorites.has(ride.id)?'Favorit entfernen':'Favorisieren'));$('object-favorite').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(favorites.has(ride.id)?'♥':'♡');
 $('object-checkin').hidden=tooFarFromPark()&&queueCheckin?.id!==ride.id||ride.category!=='attraction'||!targetAvailable(ride)&&queueCheckin?.id!==ride.id;$('object-checkin').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(queueCheckin?.id===ride.id?'Wartezeit anzeigen':'Check-in');
 $('object-uninterested').hidden=wc;
 $('object-visited').hidden=wc;$('object-visited').disabled=planning;$('object-visited').className=visited.has(ride.id)?'visited-tag':'secondary';$('object-visited').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(visited.has(ride.id)?'Besucht <span aria-hidden="true">×</span>':'✓ Besucht markieren');$('object-visited').setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`${visited.has(ride.id)?'Besucht-Tag entfernen':'Als besucht markieren'}: ${ride.name}`));
 const disneyView=dialog.dataset.infoView==='disney';
 if(disneyView)$('object-content').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(cachedDisneyInfo(ride));
 $('object-content').scrollTop=scrollTop;const newStrip=$('object-content').querySelector('.object-photo-strip');if(newStrip)newStrip.scrollLeft=photoScroll;
 $('object-disney').hidden=typeof DisneyGuide==='undefined'||!DisneyGuide.get(ride.id);$('object-disney').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(disneyView?'‹ App-Infos':'Disney-Infos');$('object-disney').setAttribute('aria-pressed',disneyView);
}
function renderMapObjectQueueProgress(){
 const sheet=$('map-object-sheet');if(sheet.open&&queueCheckin?.id===sheet.dataset.rideId)$('map-object-travel').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(queueProgress(queueCheckin));
}
function renderMapObjectSheet(){
 const sheet=$('map-object-sheet');if(!sheet.open)return;
 const ride=pointById.get(sheet.dataset.rideId);if(!ride||uninterested.has(ride.id)){sheet.close();return;}
 const queued=queueCheckin?.id===ride.id;sheet.classList.toggle('queue-active-sheet',queued);$('map-object-queue-actions').hidden=!queued;
 const paint=(el,html)=>{if(el._paintedHTML!==html){el.innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(html);el._paintedHTML=html;}};
 const full=sheet.classList.contains('surface-fullscreen')||sheet.classList.contains('sheet-large');$('map-object-expanded').hidden=!full;if(full){const nearby=nearbyShowChoices(ride),index=nearby.findIndex(r=>r.id===ride.id);paint($('map-object-expanded-switch'),(ride.category==='show'?`<div class="nearby-show-switch"><button type="button" data-nearby-show-step="-1" ${index<=0?'disabled':''} aria-label="Vorherige Show">‹</button><span>${nearby.length>1?`${index+1} / ${nearby.length} Shows in der Nähe`:'Keine weiteren Shows in der Nähe'}</span><button type="button" data-nearby-show-step="1" ${index<0||index>=nearby.length-1?'disabled':''} aria-label="Nächste Show">›</button></div><button class="secondary" data-open-show-list>Alle Shows heute</button>`:''));paint($('map-object-expanded-schedule'),showSchedule(ride));paint($('map-object-expanded-photos'),objectPhotos(ride));paint($('map-object-expanded-info'),objectInfo(ride));}
 $('map-object-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(ride.name);$('map-object-meta').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)((ride.serviceType==='restaurant'?DisneyRestaurantSearch.description(ride)+' · ':'')+ride.park+(ride.eventSetting==='indoor'?' · Indoor':ride.eventSetting==='outdoor'?' · Outdoor':'')+(queued?' · Du stehst hier an':visited.has(ride.id)?' · Besucht':''));
 const fresh=position&&position.accuracy<=80&&Date.now()-lastFix<45000&&insidePark(position.latlng),snap=router?.snap(fresh?position.latlng:origin);
 const meters=!tooFarFromPark()&&snap&&snap.distance<=90?router.tree(snap.node).ds[ride.node]+snap.distance+(ride.offset||0):Infinity;
 $('map-object-travel').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(queued?queueProgress(queueCheckin):Number.isFinite(meters)?`${minutes(meters)} Min. zu Fuß · ${metric(meters)}${fresh?' ab deinem Standort':` ab ${originLabel}`}`:tooFarFromPark()?'Navigation in der Nähe des Parks verfügbar':'Fußweg aktuell nicht verfügbar');
 paint($('map-object-ages'),ageBadge(ride));
 $('map-object-waits').hidden=queued&&!full;$('map-object-waits').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(ride.serviceType==='restaurant'?(ratingBadge(ride)||'<span class="small">Bewertung noch nicht verfügbar</span>'):waitBadge(ride));
 const available=targetAvailable(ride);$('map-object-checkin').hidden=tooFarFromPark()&&queueCheckin?.id!==ride.id||ride.category!=='attraction'||!available||queued;$('map-object-checkin').disabled=planning;const wc=(ride.id.startsWith('wc-')||ride.id.startsWith('service-'));
 let hint=!available?(ride.category==='show'?'Heute keine erreichbare Vorstellung':'Derzeit geschlossen'):'';
 if(ride.approximateArea)hint=[hint,'Bereich ungefähr · Treffpunkt vor Ort prüfen'].filter(Boolean).join(' · ');
 if(ride.category==='show'&&available){const walk=showWalkingMinutes(ride),next=DisneyShows.today(shows.get(ride.themeparksId),Date.now()).find(t=>walk!==null&&DisneyShows.arrivalDeadline(t.start,ride)>=Date.now()+walk*60000);if(next)hint=`Vorstellung um ${new Date(next.start).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})} Uhr${next.language?' · '+next.language:''}${ride.eventSetting==='indoor'?' · spätestens '+new Date(DisneyShows.arrivalDeadline(next.start,ride)).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})+' da sein':''}`;}
 $('map-object-hint').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(hint);$('map-object-hint').hidden=!hint;
 $('map-object-next').hidden=wc&&!ride.serviceType||queued;$('map-object-next').disabled=tooFarFromPark()||planning||route?.order[0]===ride.id;$('map-object-next').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(route?.order[0]===ride.id?'Aktuelles Ziel':ride.serviceType?'Dorthin navigieren':'▶ Als Nächstes');
 $('map-object-favorite').hidden=wc;$('map-object-favorite').setAttribute('aria-pressed',favorites.has(ride.id));$('map-object-favorite').setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(favorites.has(ride.id)?'Favorit entfernen':'Favorisieren'));$('map-object-favorite').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(favorites.has(ride.id)?'♥':'♡');
}
function openMapObjectSheet(id){
 const ride=pointById.get(id);if(!ride||uninterested.has(id))return;
 focusedRideId=id;following=false;setHeadingUp(false);renderFollow();
 const sheet=$('map-object-sheet');sheet.dataset.rideId=id;renderPins();
 if(!sheet.open)sheet.show();renderMapObjectSheet();map.panTo(ride.latlng,{animate:false});markShowTargets();
}
function closeMapObjectSheet(){$('map-object-sheet').close();}
$('map-object-close').onclick=closeMapObjectSheet;
$('map-object-sheet').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeMapObjectSheet();}});
$('map-object-sheet').addEventListener('close',()=>{const sheet=$('map-object-sheet');if(sheet.open||waitHistoryParent==='map-object-sheet'||objectParentDialog==='map-object-sheet')return;if(focusedRideId===sheet.dataset.rideId)focusedRideId=null;renderPins();});
$('map-object-title').onclick=()=>openObjectInfo($('map-object-sheet').dataset.rideId);
$('queue-prompt-name').onclick=()=>openObjectInfo($('queue-prompt').dataset.rideId);
$('queue-title').onclick=()=>openObjectInfo($('queue-dialog').dataset.rideId);
$('nav-target').onclick=()=>route?.order.length&&openObjectInfo(route.order[0]);
$('wait-history-title').onclick=()=>{if(waitHistoryParent==='object-dialog')$('wait-history-dialog').close();else openObjectInfo($('wait-history-dialog').dataset.rideId);};
$('map-object-finish').onclick=()=>{if(queueCheckin?.id===$('map-object-sheet').dataset.rideId)return $('queue-finish').onclick();};
$('map-object-cancel').onclick=()=>{if(queueCheckin?.id===$('map-object-sheet').dataset.rideId)return $('queue-cancel').onclick();};
$('map-object-more').onclick=()=>openObjectInfo($('map-object-sheet').dataset.rideId);
$('map-object-favorite').onclick=()=>{toggleFavorite($('map-object-sheet').dataset.rideId);renderMapObjectSheet();};
$('map-object-checkin').onclick=()=>{const id=$('map-object-sheet').dataset.rideId;closeMapObjectSheet();openQueueCheckin(id);};
$('map-object-next').onclick=async()=>{const id=$('map-object-sheet').dataset.rideId;if(await (pointById.get(id)?.serviceType?navigateFacility(id):visitNext(id)))closeMapObjectSheet();};
function openObjectInfo(id){const ride=pointById.get(id);if(!ride||uninterested.has(id))return;for(const parent of ['map-object-sheet','queue-dialog','queue-prompt','route-playlist','shows-dialog','wait-history-dialog','facilities-dialog'])if($(parent).open){objectParentDialog=parent;$(parent).close();}map.closePopup();$('object-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(ride.name);$('object-dialog').dataset.rideId=id;$('object-dialog').dataset.infoView='app';$('object-content').scrollTop=0;if(!$('object-dialog').open){$('object-dialog').showModal();if(typeof window!=='undefined'){$('object-dialog').dataset.historyToken=String(Date.now())+Math.random();window.history.pushState({...window.history.state,disneyObjectInfo:$('object-dialog').dataset.historyToken},'');$('object-dialog').dataset.historyEntry='true';}}renderObjectInfo();if(ride.category==='show')refreshShows();}
$('object-disney').onclick=()=>{const dialog=$('object-dialog');dialog.dataset.infoView=dialog.dataset.infoView==='disney'?'app':'disney';renderObjectInfo();$('object-content').scrollTop=0;};
$('object-close').onclick=()=>$('object-dialog').close();
$('object-dialog').addEventListener('close',()=>{if(waitHistoryParent==='object-dialog')return;if(typeof window!=='undefined'&&$('object-dialog').dataset.historyEntry==='true'){$('object-dialog').dataset.historyEntry='false';window.history.back();}const parent=objectParentDialog;objectParentDialog=null;if(parent){if(parent==='map-object-sheet'||parent==='queue-dialog'){$(parent).show();if(parent==='map-object-sheet')renderMapObjectSheet();else renderQueueCheckin();}else{$(parent).showModal();if(parent==='route-playlist')renderPlaylist();else if(parent==='wait-history-dialog')renderWaitHistoryDialog();else if(parent==='shows-dialog')renderShowList();}}});
$('object-map').onclick=()=>{const id=$('object-dialog').dataset.rideId;objectParentDialog=null;$('object-dialog').close();focusRideOnMap(id);};
$('object-next').onclick=async()=>{const id=$('object-dialog').dataset.rideId;if(!await (pointById.get(id)?.serviceType?navigateFacility(id):visitNext(id)))return;objectParentDialog=null;$('object-dialog').close();homeView('map');showNavigationMap();};
$('object-favorite').onclick=()=>{toggleFavorite($('object-dialog').dataset.rideId);renderObjectInfo();};
$('object-checkin').onclick=()=>{const id=$('object-dialog').dataset.rideId;objectParentDialog=null;$('object-dialog').close();openQueueCheckin(id);};
$('object-visited').onclick=async()=>{const id=$('object-dialog').dataset.rideId;if(planning)return;if(visited.has(id)){if(!window.confirm((typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Besucht-Tag entfernen?')))return;visited.delete(id);save();renderRides();renderPins();if(route)await replan();}else await complete(id);renderObjectInfo();};
document.addEventListener('click',event=>{
 const historyView=event.target.closest('[data-history-view]');if(historyView){const ride=pointById.get($('wait-history-dialog').dataset.rideId),record=ride?.queueTimes&&waitHistories.get(waitHistoryKey(ride));if(record&&['average','today'].includes(historyView.dataset.historyView)){record.view=historyView.dataset.historyView;renderWaitHistoryDialog();}return;}
 const history=event.target.closest('[data-wait-history]');if(history){openWaitHistory(history.dataset.waitHistory);return;}
 const pin=event.target.closest('[data-result-map]');if(pin){$('search').blur();$('facilities-search').blur();if($('facilities-dialog').open)$('facilities-dialog').close();focusRideOnMap(pin.dataset.resultMap);return;}
 const info=event.target.closest('[data-object-info]');if(info){openObjectInfo(info.dataset.objectInfo);return;}
 const row=event.target.closest('[data-object-row]');if(row&&!event.target.closest('button,a,input,select,label'))openObjectInfo(row.dataset.objectRow);
});
// A horizontal right swipe returns without interfering with vertical content scrolling.
let objectSwipeStart=null;
$('object-dialog').addEventListener('touchstart',event=>{objectSwipeStart=event.touches.length===1&&(document.documentElement.dir==='rtl'?event.touches[0].clientX>=innerWidth-32:event.touches[0].clientX<=32)?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
$('object-dialog').addEventListener('touchcancel',()=>{objectSwipeStart=null;},{passive:true});
$('object-dialog').addEventListener('touchend',event=>{const start=objectSwipeStart;objectSwipeStart=null;if(!start||!event.changedTouches.length)return;const dx=(event.changedTouches[0].clientX-start.x)*(document.documentElement.dir==='rtl'?-1:1),dy=event.changedTouches[0].clientY-start.y;if(dx>=90&&Math.abs(dy)<Math.min(70,dx*.5))$('object-dialog').close();},{passive:true});
window.addEventListener('popstate',()=>{const dialog=$('object-dialog');if(dialog.dataset.historyEntry!=='true'||window.history.state?.disneyObjectInfo===dialog.dataset.historyToken)return;dialog.dataset.historyEntry='false';if(waitHistoryParent==='object-dialog'){$('wait-history-dialog').close();}if(dialog.open)dialog.close();});
function ageData(ride){return typeof DisneyGuide==='undefined'?null:DisneyGuide.get(ride.id);}
function ageGroupsText(groups,compact=false){
 const labels={'All Ages':'Alle Altersgruppen','Preschoolers':'Kleine Kinder','From the age of 1 year':'Ab 1 Jahr','Kids':'Kinder','Tweens':'Ältere Kinder','Teens':'Jugendliche','Adults':'Erwachsene'};
 if(groups.includes('From the age of 1 year'))return 'Ab 1 Jahr';
 if(groups.includes('All Ages'))return 'Alle Altersgruppen';
 if(compact&&['Kids','Tweens','Teens','Adults'].every(g=>groups.includes(g)))return 'Kinder bis Erwachsene';
 if(compact&&['Tweens','Teens','Adults'].every(g=>groups.includes(g)))return 'Ältere Kinder bis Erwachsene';
 return groups.map(g=>labels[g]).filter(Boolean).join(', ');
}
function ageMatches(ride,group='all'){
 if(!group||group==='all')return true;
 const groups=ageData(ride)?.ageGroups||[];
 return groups.includes(group)||groups.includes('All Ages');
}
function ageBadge(ride,detail=false){
 const entry=ageData(ride);if(!entry||!['attraction','show','character'].includes(ride.category))return '';
 const groups=entry.ageGroups||[],recommendation=entry.ageRecommendation;
 const source=entry.ageSourceUrl;
 let html=groups.length?`<span class="age-disney">Disney: ${esc(ageGroupsText(groups,!detail))}</span>`:'<span class="age-disney">Disney: Altersangabe fehlt</span>';
 if(recommendation)html+=`<span class="age-tip">Kindertipp: ${esc(recommendation.label)} · <a href="${esc(recommendation.sourceUrl)}" target="_blank" rel="noopener">${esc(recommendation.publisher)}</a></span>`;
 if(detail){if(source)html+=`<a class="age-source" href="${esc(source)}" target="_blank" rel="noopener">Disney-Altersgruppen ↗</a>`;if(recommendation)html+=`<span class="age-note">${esc(recommendation.note)}</span>`;}
 return `<div class="age-info">${html}</div>`;
}
function childBadge(ride){const info=DisneyChild.describe(ride,appSettings.child);return info?.kind==='no'?`<span class="child-badge ${info.kind}" title="${esc(info.detail)}">${esc(info.text)}</span>`:'';}
function waitBadge(ride){const info=waitInfo(ride),single=singleRiderInfo(ride);const badge=(value,label)=>value?`<button type="button" data-wait-history="${ride.id}" class="wait-badge ${value.kind} ${value.comparison?.tone||'normal'}" title="${esc(value.detail)}" aria-label="${esc(label+value.text)} · Tagesstatistik für ${esc(ride.name)} öffnen">${label}${esc(value.text)}</button>`:'';return typeof appSettings!=='undefined'&&appSettings.singleRiderAlerts&&single?badge(single,'Single Rider: ')+badge(info,'Normal: '):badge(info,single?'Normal: ':'')+badge(single,'Single Rider: ');}

function ratingBadge(ride){const restaurant=restaurantRating(ride),r=restaurant||DisneyRatings.get(ride);if(restaurant)return `<a class="rating-badge" href="${esc(r.url)}" target="_blank" rel="noopener">★ ${r.score.toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{minimumFractionDigits:1})} / 5 · ${r.count} Bewertungen · Tripadvisor</a><span class="small">Gespeicherte Bewertung · abgerufen ${r.checkedAt}</span>`;return r?`<a class="rating-badge" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="Bewertungen bei ExploreThemeParks: ${esc(ride.name)}">★ ${r.score.toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{minimumFractionDigits:1})} / 5 · ${r.count} Bewertungen${r.count<10?' · wenige Bewertungen':''}</a>`:'';}
function rideSearchText(ride){return (ride.name+' '+(typeof DisneyI18n==='undefined'?'':DisneyI18n.aliases(ride.id))+' '+(ride.officialName||'')+' '+(ride.land||'')+' '+ride.park+' '+(ride.park==='Disney Adventure World'?'Adventure World Walt Disney Studios':'')).toLowerCase();}
function rideDistances(){
 const result=new Map();if(tooFarFromPark()||!router||!data)return result;
 const snap=router.snap(origin);if(snap.distance>90)return result;
 const ds=router.tree(snap.node).ds;
 for(const ride of [...data.rides,...(data.toilets||[]),...(data.services||[])])result.set(ride.id,ds[ride.node]+snap.distance+(ride.offset||0));
 return result;
}
function sortRides(rides,mode,distances){
 const now=Date.now(),priority=new Map(rides.map(r=>[r.id,!targetAvailable(r,now)?2:r.category==='show'&&!DisneyShows.startsSoon(shows.get(r.themeparksId),now)?1:0]));
 return [...rides].sort((a,b)=>{
  const group=priority.get(a.id)-priority.get(b.id);if(group)return group;
  if(mode==='distance'){const da=distances.get(a.id)??Infinity,db=distances.get(b.id)??Infinity;if(da!==db)return da-db;}
  if(mode==='rating'){const da=(restaurantRating(a)||DisneyRatings.get(a))?.score??-1,db=(restaurantRating(b)||DisneyRatings.get(b))?.score??-1;if(da!==db)return db-da;}
  return a.name.localeCompare(b.name,(typeof DisneyI18n==='undefined'?'de':DisneyI18n.locale()));
 });
}
let lastRideDistancePaint=0;
function restaurantRow(point,distance){
 const rating=restaurantRating(point);
 return `<div data-object-row="${point.id}" class="ride-row restaurant-row"><div class="ride-info"><button class="ride-name object-open" data-object-info="${point.id}" aria-label="Infos: ${esc(point.name)}">${esc(point.name)}</button><span class="ride-meta">${esc(DisneyRestaurantSearch.description(point))}${selectedPark==='all'?' · '+esc(point.park==='Disney Adventure World'?'Adventure World':point.park):''}</span><div class="ride-summary"><span class="ride-distance" ${tooFarFromPark()?'hidden':''}>${Number.isFinite(distance)?`${minutes(distance)} Min. zu Fuß · ${metric(distance)}`:'Fußweg nicht verfügbar'}</span>${rating?`<a class="ride-rating" href="${esc(rating.url)}" target="_blank" rel="noopener" aria-label="Tripadvisor: ${esc(point.name)}, ${rating.score} von 5, ${rating.count} Bewertungen">★ ${rating.score.toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{minimumFractionDigits:1})}</a>`:''}</div></div><button type="button" class="result-pin" data-result-map="${point.id}" aria-label="Auf Karte zeigen: ${esc(point.name)}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></button></div>`;
}
function renderRides(){
 $('search-clear').hidden=!$('search').value.length;
 if(!data)return;syncCatalogDistanceMode();
 renderHiddenTargets();
 const query=$('search').value.trim().toLowerCase(),category=$('category').value,ageGroup=$('age-group').value||'all',restaurants=category==='restaurant';
 for(const id of ['age-group','favorites-only','show-visited','ratings-small'])$(id).disabled=restaurants;
 $('rides-view').classList?.toggle('restaurant-catalog',restaurants);
 $('search').placeholder=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(restaurants?'Restaurant, Café oder Küche suchen …':'Ride, Show oder Park suchen …');
 let rides=restaurants?(data.services||[]).filter(r=>r.serviceType==='restaurant'&&parkMatches(r)&&DisneyRestaurantSearch.matches(r,query)):data.rides.filter(r=>!uninterested.has(r.id)&&parkMatches(r)&&ageMatches(r,ageGroup)&&rideSearchText(r).includes(query)&&(category==='all'||r.category===category)&&(!onlyFav||favorites.has(r.id))&&($('show-visited').checked||!visited.has(r.id)));
 if(ratingsMode&&!restaurants)rides=DisneyRatings.ranked(rides,$('ratings-small').checked);
 const distances=rideDistances();rides=sortRides(rides,$('ride-sort').value||'distance',distances);lastRideDistancePaint=Date.now();$('ratings-intro').hidden=!ratingsMode||restaurants;
 $('rides-list').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(rides.length?rides.map(r=>{
  if(restaurants)return restaurantRow(r,distances.get(r.id));
  const d=distances.get(r.id),rating=DisneyRatings.get(r),type=r.category==='show'?'Show / Parade':r.category==='character'?'Figurenbegegnung':'Attraktion';
  return `<div data-object-row="${r.id}" class="ride-row ${!targetAvailable(r)?'unavailable':''} ${visited.has(r.id)?'visited':''}"><div class="ride-info"><button class="ride-name object-open" data-object-info="${r.id}" aria-label="Infos: ${esc(r.name)}">${esc(r.name)}</button><span class="ride-meta">${esc(type)}${r.eventSetting==='indoor'?' · Indoor':r.eventSetting==='outdoor'?' · Outdoor':''}${r.approximateArea?' · Bereich ungefähr':''}${selectedPark==='all'?' · '+esc(r.park==='Disney Adventure World'?'Adventure World':r.park):''}</span><div class="ride-summary"><span class="ride-distance" ${tooFarFromPark()?'hidden':''}>${Number.isFinite(d)?`${minutes(d)} Min. zu Fuß · ${metric(d)}`:'Fußweg nicht verfügbar'}</span>${rating?`<span class="ride-rating">★ ${rating.score.toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{minimumFractionDigits:1})}<span class="sr-only"> von 5, ${rating.count} Bewertungen</span></span>`:''}</div>${ageBadge(r)}${nextShowBadge(r)}${!targetAvailable(r)?`<span class="availability-label">${r.category==='show'?'Heute keine bestätigte erreichbare Vorstellung':'Derzeit geschlossen'}</span>`:''}${waitBadge(r)}${childBadge(r)}${visited.has(r.id)?`<button class="visited-tag" data-favorite-visited="${r.id}" aria-label="Besucht-Tag entfernen: ${esc(r.name)}">Besucht <span aria-hidden="true">×</span></button>`:activeHomeView==='favorites'?`<button class="ride-checkin quiet" data-favorite-visited="${r.id}" aria-label="Als besucht markieren: ${esc(r.name)}">✓ Besucht markieren</button>`:''}</div><div class="ride-result-actions"><button type="button" class="result-pin" data-result-map="${r.id}" aria-label="Auf Karte zeigen: ${esc(r.name)}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></button><button class="heart" data-id="${r.id}" aria-label="${favorites.has(r.id)?'Favorit entfernen':'Favorisieren'}: ${esc(r.name)}" aria-pressed="${favorites.has(r.id)}">${favorites.has(r.id)?'♥':'♡'}</button></div></div>`;
 }).join(''):'<div class="empty-state"><strong>Keine passenden Ziele</strong><p>Ändere die Suche oder Filter. Besuchte Ziele kannst du unter „Filter“ einblenden.</p><button class="secondary" data-reset-filters>Filter zurücksetzen</button></div>');
 $('catalog-count').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(`${rides.length} ${restaurants?(rides.length===1?'Restaurant':'Restaurants'):activeHomeView==='favorites'?($('show-visited').checked?'Favoriten':'unbesuchte Favoriten'):(rides.length===1?'Ziel':'Ziele')} · ${selectedPark==='all'?'Beide Parks':selectedPark==='Disney Adventure World'?'Adventure World':'Disneyland Park'}<span class="catalog-origin">${tooFarFromPark()?(restaurants?'Navigation in Parknähe verfügbar':'Mehr als 10 km entfernt · Favoriten für deinen Besuch auswählen'):'Entfernungen ab '+esc(originLabel)}</span>`);
 $('filter-count').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)([!restaurants&&ageGroup!=='all',selectedPark!=='all',category!==(ratingsMode?'attraction':'all'),!restaurants&&onlyFav&&activeHomeView!=='favorites',!restaurants&&!$('show-visited').checked,!restaurants&&ratingsMode&&$('ratings-small').checked].filter(Boolean).length||'');
 $('fav-count').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)([...favorites].filter(id=>!uninterested.has(id)&&pointById.has(id)).length);$('plan').disabled=tooFarFromPark()||!remaining().length||planning;
}
$('rides-list').addEventListener('click',async e=>{const facility=e.target.closest('[data-facility-next]');if(facility){await navigateFacility(facility.dataset.facilityNext);return;}const b=e.target.closest('[data-id]');if(b)toggleFavorite(b.dataset.id);const visit=e.target.closest('[data-favorite-visited]');if(!visit)return;const id=visit.dataset.favoriteVisited;if(!visited.has(id)){await complete(id);return;}if(!window.confirm((typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Besucht-Tag entfernen?')))return;visited.delete(id);save();renderRides();if(route||nav)await replan();else renderRoute();renderPins();});
$('rides-list').addEventListener('change',async e=>{const checkbox=e.target.closest('[data-visited]');if(!checkbox)return;const id=checkbox.dataset.visited;if(checkbox.checked)visited.add(id);else visited.delete(id);save();renderRides();if(route||nav)await replan();else renderRoute();renderPins();});
function renderPins(){
 if(!data)return;popupWaits.clear();pins.clearLayers();const order=route?.order||[];
 for(const r of [...data.rides,...data.toilets,...(data.services||[])]){
  const queued=typeof queueCheckin!=='undefined'&&queueCheckin?.id===r.id;
  if(uninterested.has(r.id))continue;if(r.id.startsWith('ride-')&&!parkMatches(r)&&r.id!==focusedRideId&&!queued)continue;
  const wc=(r.id.startsWith('wc-')||r.id.startsWith('service-')),available=targetAvailable(r),idx=available?order.indexOf(r.id):-1;
  if(!wc&&!queued&&r.id!==focusedRideId&&r.id!==order[0]){const filter=$('map-filter').value;if((filter==='favorites'&&!favorites.has(r.id))||(filter!=='all'&&filter!=='favorites'&&r.category!==filter))continue;}
  if(wc&&!parkMatches(r)&&idx<0&&r.id!==focusedRideId)continue;if(wc&&idx<0&&r.id!==focusedRideId&&!facilityVisible(r))continue;
  const rating=restaurantRating(r);const html=`<div class="map-pin ${queued?'queued':''} ${available?'':'unavailable'} ${visited.has(r.id)?'visited':''} ${idx===0?'next':''} ${wc?'wc':favorites.has(r.id)?'favorite':''}">${queued?'⌛':idx>=0?idx+1:visited.has(r.id)?'✓':wc?(r.serviceType==='water'?'💧':r.serviceType==='restaurant'?'♨':'WC'):favorites.has(r.id)?'♥':r.category==='show'?'♫':r.category==='character'?'☺':'✦'}${r.serviceType==='restaurant'&&rating?`<span class="map-restaurant-rating">★ ${rating.score.toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{minimumFractionDigits:1})}</span>`:''}</div>`;
  const marker=L.marker(r.latlng,{icon:L.divIcon({html,className:'',iconSize:[30,30],iconAnchor:[15,15]}),title:r.name}).addTo(pins);
  marker.getElement()?.setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(r.name+(queued?' · Du stehst hier an':'')));popupWaits.set(r.id,{marker});marker.on('click',()=>openMapObjectSheet(r.id));
 }
 markShowTargets();updatePopupWaits();if(typeof syncThreeView==='function')syncThreeView();
}
function markShowTargets(){
 for(const [id,item] of popupWaits){
  const ride=pointById.get(id),next=route?.order[0]===id;
  const highlighted=ride?.category==='show'&&targetAvailable(ride)&&(id===focusedRideId||next);
  item.marker.getElement()?.querySelector('.map-pin')?.classList.toggle('show-target',highlighted);
  item.marker.setZIndexOffset(highlighted?2000:targetAvailable(ride)?0:-500);
  if(highlighted){
   const label=`${next?'NÄCHSTE SHOW':'AUSGEWÄHLTE SHOW'} · ${ride.name}`;
   if(item.showLabel!==label){item.marker.unbindTooltip();item.marker.bindTooltip(esc(typeof DisneyI18n==='undefined'?label:DisneyI18n.text(label)),{permanent:true,direction:'bottom',offset:[0,18],className:'show-target-label'});item.showLabel=label;}
  }else if(item.showLabel){item.marker.unbindTooltip();item.showLabel=null;}
 }
}
function focusRideOnMap(id){if(!appReady){pendingNoticeId=id;return;}const ride=pointById.get(id);if(!ride)return;if(uninterested.has(id)){toast('Dieses Ziel ist unter „Ausblenden“ ausgeblendet.');return;}focusedRideId=id;homeView('map');showNavigationMap();following=false;setHeadingUp(false);renderFollow();renderPins();map.setView(ride.latlng,18,{animate:false});openMapObjectSheet(id);}
function updatePopupTravel(){renderMapObjectSheet();}
function updatePopupWaits(){renderObjectInfo();renderMapObjectSheet();}
function renderRoute(){const far=tooFarFromPark();$('manual').disabled=$('entrance').disabled=far;$('route-planning-note').hidden=far;renderSuggestions();renderPlaylist();const left=remaining();$('plan').disabled=far||!left.length||planning;$('start-nav').disabled=far||!route?.order.length||planning;$('start-nav').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(nav?'Zur Navigation':'Navigation starten');$('wc').disabled=far||!route?.order.length||planning;$('resume-skipped').hidden=!remaining().some(r=>deferred.has(r.id));$('resume-skipped').disabled=planning;$('nav-skip').disabled=planning||!route?.order.length;$('arrived').disabled=planning;$('plan').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(planning?'Route wird berechnet …':route?'Route neu berechnen':'Route berechnen');if(!route?.order.length){$('route-summary').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(left.length?`${left.length} Rides ausgewählt`:(favorites.size?'Für heute keine weiteren offenen Favoriten.':'Deine Route beginnt mit einem ♥.'));$('route-method').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(far?'Du bist mehr als 10 km vom Disneyland entfernt. Wähle jetzt deine Favoriten. Navigation ist in der Nähe des Parks verfügbar.':left.length?'Berechne jetzt die Besuchsreihenfolge.':'Wähle die Rides aus, die ihr besuchen möchtet.');$('stops').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)('');lineLayer.clearLayers();renderNav();return;}
$('route-summary').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`${metric(route.distance)} · ca. ${minutes(route.distance)} Min.`);$('route-method').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`${route.order.filter(x=>x.startsWith('ride-')).length} Rides${pinnedWC?(pinnedWC.serviceType?' + Pause':' + WC-Pause'):''} · Immer der nächste Ride nach kürzestem Fußweg${left.some(r=>deferred.has(r.id))?' · übersprungene Rides zum Schluss':''} · ab ${originLabel}`);
$('stops').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(route.order.map((id,i)=>{const r=pointById.get(id),wc=(id.startsWith('wc-')||id.startsWith('service-'));return `<li class="stop" data-object-row="${id}"><span class="stop-number">${i+1}</span><div>${i===0?'<span class="next-label">ALS NÄCHSTES</span>':''}<button class="object-open" data-object-info="${id}" aria-label="Infos: ${esc(r.name)}">${wc?esc(r.serviceType?r.name:'WC-Pause'):esc(r.name)}</button>${deferred.has(id)?'<span class="deferred-label">Für später</span>':''}${waitBadge(r)}<p>${metric(route.legs[i].distance)} · ca. ${minutes(route.legs[i].distance)} Min. zu Fuß</p>${!wc?`<button class="visit-next route-next" data-route-next="${id}" aria-label="Visit next: ${esc(r.name)}" ${planning||i===0?'disabled':''}>▶ Als Nächstes</button>`:''}<button class="done" data-complete="${id}">${wc?'Pause erledigt':'✓ Besucht'}</button>${wc?` <button class="done" data-cancel="true">Pause entfernen</button>`:i===0?` <button class="done skip-stop" data-skip="${id}" ${planning?'disabled':''}>Für jetzt überspringen</button>`:''}</div></li>`;}).join(''));renderNav();}
function renderPlaylist(){const sheet=$('route-playlist');if(!sheet.open)return;$('playlist-wait-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)($('wait-status').textContent);const order=route?.order||[];$('playlist-summary').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(planning?'Route wird aktualisiert …':order.length?`${order.length} Stopps · ${metric(route.distance)} · ca. ${minutes(route.distance)} Min. zu Fuß`:'Alle ausgewählten Ziele sind erledigt.');$('playlist-resume').hidden=!remaining().some(r=>deferred.has(r.id));$('playlist-resume').disabled=planning;$('playlist-stops').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(order.map((id,i)=>{const target=pointById.get(id),wc=(id.startsWith('wc-')||id.startsWith('service-'));return `<li data-object-row="${id}" class="playlist-stop ${i===0?'current':''} ${deferred.has(id)?'postponed':''}"><span class="playlist-number" aria-hidden="true">${i===0?'▶':i+1}</span><div class="playlist-info">${i===0?`<span class="playlist-now">${priorityRide?.id===id?'ALS NÄCHSTES GEWÄHLT':'JETZT AUF DEM WEG'}</span>`:priorityRide?.id===id?'<span class="playlist-now">NÄCHSTER RIDE NACH DER WC-PAUSE</span>':''}<button class="object-open" data-object-info="${id}" aria-label="Infos: ${esc(target.name)}">${wc?'WC-Pause':esc(target.name)}</button><span class="playlist-meta">${metric(route.legs[i].distance)} · ca. ${minutes(route.legs[i].distance)} Min.${i===0?' ab deinem Start':''}${deferred.has(id)?' · Für später':''}</span>${childBadge(target)}${waitBadge(target)}<div class="playlist-row-actions">${!wc?`<button class="visit-next" data-playlist-next="${id}" aria-label="Visit next: ${esc(target.name)}" ${planning||i===0?'disabled':''}>▶ Als Nächstes</button>`:''}<button data-playlist-complete="${id}" aria-label="${wc?'Pause erledigt':'Als besucht markieren'}: ${esc(target.name)}" ${planning?'disabled':''}>✓ ${wc?'Pause erledigt':'Besucht'}</button>${i===0?`<button data-playlist-skip="true" aria-label="Für jetzt überspringen: ${esc(target.name)}" ${planning?'disabled':''}>⏭ Überspringen</button>`:deferred.has(id)?`<button data-playlist-resume="${id}" ${planning?'disabled':''}>Wieder aufnehmen</button>`:''}</div></div></li>`;}).join(''));}
$('open-playlist').onclick=()=>{if(!route?.order.length)return;$('route-playlist').showModal();renderPlaylist();};
function closePlaylist(){$('route-playlist').close();$('open-playlist').focus();}
$('close-playlist').onclick=closePlaylist;$('playlist-map').onclick=closePlaylist;
$('playlist-resume').onclick=async()=>{deferred.clear();save();await replan();};
$('playlist-stops').addEventListener('click',async e=>{if(planning)return;const next=e.target.closest('[data-playlist-next]');if(next){await visitNext(next.dataset.playlistNext);return;}const done=e.target.closest('[data-playlist-complete]'),skip=e.target.closest('[data-playlist-skip]'),resume=e.target.closest('[data-playlist-resume]');if(done)await complete(done.dataset.playlistComplete);else if(skip)await skipCurrent();else if(resume){deferred.delete(resume.dataset.playlistResume);save();await replan();}});
function renderLines(){
 lineLayer.clearLayers();if(typeof queueCheckin!=='undefined'&&queueCheckin||!route?.legs[0]){if(typeof syncThreeView==='function')syncThreeView();return;}
 refreshActiveLeg();const path=route.legs[0].path;
 L.polyline(path,{color:'#fff',weight:10,opacity:1,interactive:false}).addTo(lineLayer);
 L.polyline(path,{color:'#245eda',weight:6,opacity:1,dashArray:null,interactive:false}).addTo(lineLayer);if(typeof syncThreeView==='function')syncThreeView();
}
function refreshActiveLeg(){
 if(!route?.order.length||!router)return;
 const target=pointById.get(route.order[0]),snap=router.snap(origin);
 if(!target||snap.distance>90)return;
 try{
  const walking=router.leg(snap.node,target.node);
  route.legs[0]={distance:walking.distance+snap.distance,path:[[...origin],...walking.path]};
  route.distance=route.legs.reduce((sum,leg)=>sum+leg.distance,0);
 }catch{}
}
function updateStart(){if(originMarker)map.removeLayer(originMarker);originMarker=L.circleMarker(origin,{radius:7,color:'#fff',weight:3,fillColor:'#192f68',fillOpacity:1}).bindTooltip(typeof DisneyI18n==='undefined'?originLabel:DisneyI18n.text(originLabel)).addTo(map);$('gps-chip').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(tooFarFromPark()?'Mehr als 10 km entfernt · Favoriten auswählen':`Start: ${originLabel}${position?' · ± '+Math.round(position.accuracy)+' m':' · kein Live-GPS'}`);if(['all','favorites','best'].includes(activeHomeView)&&Date.now()-lastRideDistancePaint>6000&&!interactionPaused())renderRides();if(typeof syncThreeView==='function')syncThreeView();}
async function replan({fit=false}={}){if(!data||tooFarFromPark())return;playerDismissed=false;try{localStorage.removeItem(`${userKey}:navigation-stopped`);}catch{}const token=++generation,left=remaining();if(priorityRide&&!left.some(r=>r.id===priorityRide.id)){priorityRide=null;save();}if(left.length&&left.every(r=>deferred.has(r.id))){deferred.clear();save();}if(!left.length&&!pinnedWC){route=null;renderRoute();renderPins();if(nav)exitNav();return;}const planOrigin=[...origin],snap=router.snap(planOrigin);if(snap.distance>90){route=null;renderRoute();renderPins();toast('Standort liegt außerhalb des erfassten Wegenetzes. Wähle einen Start im Park.');return;}planning=true;renderRoute();try{const prefix=[...(pinnedWC?[pinnedWC]:[]),...(priorityRide?[priorityRide]:[])];const optimized=await rpc('optimize',{start:prefix.length?prefix[prefix.length-1].node:snap.node,stops:left.filter(r=>r.id!==priorityRide?.id),deferredIds:[...deferred]});if(token!==generation)return;let candidate=optimized;if(prefix.length){candidate=await rpc('assemble',{start:snap.node,stops:[...prefix,...optimized.order.map(id=>pointById.get(id))]});candidate.exact=false;}if(token!==generation)return;route=candidate;routeOrigin=planOrigin;renderLines();renderPins();if(fit)fitRoute();}catch(e){if(token!==generation)return;route=null;toast(e.message);}finally{if(token===generation){planning=false;renderRoute();}}}
let regionalRail=null,regionalRailLoading=null,regionalRailStops=[];
async function showRegionalRail(){
 if(!appReady)return;
 try{
  if(!regionalRail){
   if(!regionalRailLoading)regionalRailLoading=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await fetch('park-scene.json',{redirect:'error',signal:controller.signal});if(!response.ok)throw Error('Rail scene');const scene=await response.json();if(!scene.regionalRail?.tracks?.features?.length)throw Error('Rail geometry');return scene.regionalRail;}finally{clearTimeout(timer);}})();
   regionalRail=await regionalRailLoading;
   L.geoJSON(regionalRail.tracks,{interactive:false,style:f=>({color:f.properties.tunnel?'#ae3654':'#eb2132',weight:3,opacity:.85,dashArray:f.properties.tunnel?'6 6':null})}).addTo(walkLayer);
   for(const station of regionalRail.stations){const icon=L.divIcon({className:'rail-leaflet-station',html:'<span class="rail-station-dot"></span><span class="rail-stop-name">RER A · '+esc(station.name)+'</span>',iconSize:[10,10],iconAnchor:[0,0]});const marker=L.marker([station.coordinates[1],station.coordinates[0]],{icon,interactive:false}).addTo(walkLayer);regionalRailStops.push({marker,endpoint:station.endpoint});}
   const labels=()=>{for(const {marker,endpoint} of regionalRailStops)marker.getElement()?.classList.toggle('show-label',endpoint||map.getZoom()>=13);};map.on('zoomend',labels);labels();
  }
  $('map-settings').close();homeView('map');following=false;setHeadingUp(false);renderFollow();if(mapMode==='original')showMap('geo');
  if(mapMode==='3d'&&threeMap)await threeMap.fitBounds(regionalRail.bounds);else map.fitBounds(regionalRail.bounds,{padding:[45,100],maxZoom:12,animate:false});
 }catch{regionalRailLoading=null;toast('Bahnstrecke konnte nicht geladen werden.');}
}
$('show-rer').onclick=showRegionalRail;
function fitRoute(){const points=route?.legs[0]?.path;if(points?.length)map.fitBounds(L.latLngBounds(points),{padding:[55,nav?180:60],maxZoom:18});else map.fitBounds([[48.8635,2.771],[48.8756,2.7808]],{padding:[40,50]});following=false;renderFollow();}
function tab(which){if(document.body.classList.contains('functions-open')){const active=which==='route'?'route':['all','best','favorites'].includes(activeHomeView)?activeHomeView:ratingsMode?'best':onlyFav?'favorites':'all';if(active!==activeHomeView){homeView(active);return;}for(const name of ['map','favorites','all','best','route','info'])$('home-'+name).setAttribute('aria-pressed',name===active||(name==='all'&&active==='best'));}$('rides-view').hidden=which!=='rides';$('route-view').hidden=which!=='route';$('rides-tab').setAttribute('aria-selected',which==='rides');$('route-tab').setAttribute('aria-selected',which==='route');}
function openWCChoice(){if(planning||!route?.order.length)return;if(pinnedWC){toast('Die WC-Pause ist bereits eingeplant.');return;}const next=pointById.get(route.order[0]);$('wc-choice').dataset.target=next.id;$('wc-keep-name').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(next.name);$('wc-choice').showModal();}
async function wcPause(mode='keep',requestedId=null){if(navigationBlocked())return;if(planning||!route?.order.length)return;try{if(pinnedWC){toast('Die WC-Pause ist bereits als nächster Stopp eingeplant.');return;}const snap=router.snap(origin),next=pointById.get(requestedId)&&remaining().some(r=>r.id===requestedId)?pointById.get(requestedId):pointById.get(route.order[0]),toilet=await rpc('toilet',{start:snap.node,next});if(!toilet)throw Error('Keine erreichbare Toilette gefunden.');finishQueueForNavigation(toilet.id);pinnedWC=toilet;priorityRide=mode==='keep'&&next?.id.startsWith('ride-')?next:null;save();tab('route');await replan();const direct=router.leg(snap.node,next.node).distance,via=router.leg(snap.node,toilet.node).distance+router.leg(toilet.node,next.node).distance,detour=Math.max(0,via-direct);toast(mode==='keep'?`WC-Pause auf dem Weg zu ${next.name} · ${metric(detour)} zusätzlicher Weg.`:'WC-Pause eingeplant · danach der nächstgelegene Ride.');}catch(e){pinnedWC=null;toast(e.message);}}
async function complete(id){if(!pointById.has(id))return;if(queueCheckin?.id===id){recordActualWait(queueCheckin);queueCheckin=null;saveQueueCheckin();renderQueueCheckin();}if((id.startsWith('wc-')||id.startsWith('service-')))pinnedWC=null;else{visited.add(id);deferred.delete(id);if(priorityRide?.id===id)priorityRide=null;}save();renderRides();await replan();if(!route?.order.length)toast('Geschafft! Alle ausgewählten Rides sind besucht.');}
$('stops').addEventListener('click',e=>{if(planning)return;const next=e.target.closest('[data-route-next]');if(next){visitNext(next.dataset.routeNext);return;}const skip=e.target.closest('[data-skip]');if(skip){skipCurrent();return;}const done=e.target.closest('[data-complete]'),cancel=e.target.closest('[data-cancel]');if(done)complete(done.dataset.complete);if(cancel){pinnedWC=null;replan();}});
async function skipCurrent(){if(planning||!route?.order.length)return;const id=route.order[0];if((id.startsWith('wc-')||id.startsWith('service-'))){pinnedWC=null;await replan();toast(id.startsWith('service-')?'Pause entfernt.':'WC-Pause entfernt.');return;}if(remaining().filter(r=>!deferred.has(r.id)).length<2){toast('Das ist der letzte aktive Ride. Du kannst übersprungene Rides wieder aufnehmen.');return;}finishQueueForNavigation();if(priorityRide?.id===id)priorityRide=null;deferred.add(id);save();await replan();toast('Für später vorgemerkt – bleibt unbesucht.');}
$('nav-skip').addEventListener('click',skipCurrent);$('resume-skipped').addEventListener('click',async()=>{deferred.clear();save();await replan();toast('Alle unbesuchten Rides sind wieder aktiv.');});
function syncThreeView(){if(threeMap)threeMap.sync();}
function threeMapState(){return {rides:data?.rides||[],path:route?.legs[0]?.path||null,waiting:!!queueCheckin,queued:queueCheckin?.id,position,heading:heading!==null&&Date.now()-headingAt<15000?heading:null,stale:Date.now()-lastFix>=20000,focused:focusedRideId,next:route?.order[0],points:[...popupWaits].map(([id,item])=>{const r=pointById.get(id),pin=item.marker.getElement()?.querySelector('.map-pin');return r&&pin?{id,name:r.name,latlng:r.latlng,html:pin.outerHTML}:null;}).filter(Boolean)};}
let mapDiagnostics=null;
function diagnosticStatus(state,id){const text=state==='sent'?'Fehlerbericht gesendet · ID '+id:state==='sending'?'Fehlerbericht wird gesendet …':state==='pending'?'Bericht gespeichert · wird bei Verbindung erneut gesendet.':'Noch kein Bericht gesendet.';for(const name of ['diagnostic-status'])if($(name))$(name).textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(text);}
function ensureMapDiagnostics(){if(!mapDiagnostics&&typeof DisneyDiagnostics!=='undefined')mapDiagnostics=DisneyDiagnostics.create({build:APP_BUILD,onModelNeeded:()=>DisneyDiagnostics.promptModel(document),onStatus:diagnosticStatus});return mapDiagnostics;}
function mapDiagnosticEvent(event){ensureMapDiagnostics()?.record(event);}
function sendMapDiagnostic(){return ensureMapDiagnostics()?.send();}
for(const id of ['diagnostic-send'])if($(id))$(id).onclick=sendMapDiagnostic;
function showMap(kind){
 if(!['geo','original','3d'].includes(kind))return;
 mapMode=kind;original=kind==='original';$('three-error').hidden=true;$('map').hidden=kind!=='geo';$('original-map').hidden=!original;$('three-map').hidden=kind!=='3d';
 for(const [id,value] of [['geo-tab','geo'],['original-tab','original'],['three-tab','3d']])$(id).setAttribute('aria-pressed',kind===value);
 document.body.classList.toggle('map-3d',kind==='3d');document.querySelector('.map-tools').classList.toggle('original-controls',original);
 try{localStorage.setItem(userKey+':map-type',kind);}catch{}
 $('map-caption').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(original?'<a href="https://brochure.disneylandparis.com/HCP/EN/bdlp/common/data/catalogue.pdf" target="_blank" rel="noopener">© Disney</a> · Originalplan · nicht maßstabsgetreu':`${kind==='3d'?'3D · Gebäude stilisiert':'Fußwege'} · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://prim.iledefrance-mobilites.fr/fr/jeux-de-donnees/traces-du-reseau-ferre-idf" target="_blank" rel="noopener">Île-de-France Mobilités</a>`);
 if(kind==='3d'){
  try{if(typeof Disney3D==='undefined')throw Error('3D-Modul konnte nicht geladen werden.');
  if(!threeMap)threeMap=Disney3D.create(map,{state:threeMapState,onDiagnostic:mapDiagnosticEvent,onSelect:openMapObjectSheet,onClick:pt=>map.fire('click',{latlng:L.latLng(pt)}),onInteraction:()=>{following=false;setHeadingUp(false);renderFollow();},onBearing:updateNorth,onRecovering:()=>{if(mapMode==='3d'){$('three-error').hidden=true;$('map-caption').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('3D wird wiederhergestellt …');}},onReady:()=>{if(mapMode==='3d'){$('three-error').hidden=true;$('map-caption').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)('3D · Gebäude stilisiert · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://prim.iledefrance-mobilites.fr/fr/jeux-de-donnees/traces-du-reseau-ferre-idf" target="_blank" rel="noopener">Île-de-France Mobilités</a>');}},onError:error=>{if(mapMode==='3d'){$('three-error').hidden=false;}}});
  updateNorth();return Promise.resolve(threeMap.open()).catch(error=>{console.error('3D-Start:',error);if(mapMode==='3d')$('three-error').hidden=false;});
  }catch(error){console.error('3D-Start:',error);if(mapMode==='3d')$('three-error').hidden=false;}
 }else{
  threeMap?.close();
  if(original){if(!originalMap){originalMap=L.map('original-map',{attributionControl:false,crs:L.CRS.Simple,minZoom:-2,maxZoom:2,zoomControl:false,rotate:true,touchRotate:true,shiftKeyRotate:true,rotateControl:false});L.control.zoom({zoomInTitle:typeof DisneyI18n==='undefined'?'Zoom in':DisneyI18n.text('Zoom in'),zoomOutTitle:typeof DisneyI18n==='undefined'?'Zoom out':DisneyI18n.text('Zoom out')}).addTo(originalMap);originalMap.on('rotate',updateNorth);L.imageOverlay('disney-original.png',[[0,0],[1980,2200]],{attribution:'© Disney · März 2026'}).addTo(originalMap);}originalMap.invalidateSize();originalMap.fitBounds([[920,0],[1980,1310]]);}else{map.invalidateSize();updateOrientation();}
 }
 updateNorth();
}
function loadMapMode(){let value='3d';try{const saved=localStorage.getItem(userKey+':map-type');if(['geo','original','3d'].includes(saved))value=saved;}catch{}return showMap(value);}
function showNavigationMap(){showMap(mapMode==='3d'?'3d':'geo');}
function activeMap(){return mapMode==='3d'&&threeMap?threeMap:original&&originalMap?originalMap:map;}
function renderOrientation(){const fresh=heading!==null&&Date.now()-headingAt<15000;$('heading-up').setAttribute('aria-pressed',headingUp);$('heading-up').title=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(headingUp?(fresh?'Karte folgt dem Richtungspfeil':'Gehrichtung aktiv · warte auf Kompass oder Bewegung'):'Karte automatisch in Gehrichtung ausrichten');}
function setHeadingUp(enabled){headingUp=enabled;try{localStorage.setItem(`${userKey}:heading-up`,JSON.stringify(enabled));}catch{}renderOrientation();if(enabled)updateOrientation();}
function updateOrientation(){renderOrientation();if(interactionPaused()||!headingUp||original||heading===null||Date.now()-headingAt>=15000)return;const target=(360-heading)%360,current=map.getBearing(),delta=((target-current+540)%360)-180;if(Math.abs(delta)>=2)map.setBearing(target);}
function renderDirection(){if(!route?.legs[0])return;const target=pointById.get(route.order[0]),start=position?.latlng||origin,path=route.legs[0].path,ahead=path.find(p=>RouteCore.distance(start,p)>22)||target.latlng;$('direction').style.transform=`rotate(${bearing(start,ahead)+map.getBearing()}deg)`;}
function updateNorth(){renderDirection();}
map.on('rotate',updateNorth);map.on('rotatestart',()=>setHeadingUp(false));$('heading-up').onclick=()=>{setHeadingUp(!headingUp);if(headingUp){showNavigationMap();following=true;renderFollow();if(position&&insidePark(position.latlng))map.setView(position.latlng,Math.max(17,map.getZoom()),{animate:false});if(watch===null)activateGPS();else requestCompass();}};
function stopGPS(){if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;lastFix=0;heading=null;renderOrientation();if(userMarker){map.removeLayer(userMarker);userMarker=null;}if(accuracyCircle){map.removeLayer(accuracyCircle);accuracyCircle=null;}}
function compassEvent(e){let h=null;if(Number.isFinite(e.webkitCompassHeading)&&(!Number.isFinite(e.webkitCompassAccuracy)||e.webkitCompassAccuracy>=0&&e.webkitCompassAccuracy<50))h=e.webkitCompassHeading;else if(e.absolute&&Number.isFinite(e.alpha))h=(360-e.alpha+(screen.orientation?.angle||0))%360;if(h!==null){heading=h;headingAt=Date.now();if(interactionPaused()||Date.now()-lastCompassPaint<200)return;lastCompassPaint=Date.now();updateUser();renderDirection();}}
let compassAttached=false;async function requestCompass(){try{if(!window.DeviceOrientationEvent)return;if(typeof DeviceOrientationEvent.requestPermission==='function'){const allowed=await DeviceOrientationEvent.requestPermission();if(allowed!=='granted')return;}if(!compassAttached){window.addEventListener('deviceorientationabsolute',compassEvent);window.addEventListener('deviceorientation',compassEvent);compassAttached=true;}}catch{}}
function bearing(a,b){const r=Math.PI/180,p=a[0]*r,q=b[0]*r,l=(b[1]-a[1])*r;return(Math.atan2(Math.sin(l)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(l))/r+360)%360;}
async function activateGPS(wantNav=false){if(wantNav&&navigationBlocked())return;gpsWantNav=wantNav;requestCompass();if(!navigator.geolocation){toast('Dieser Browser unterstützt keinen Live-Standort.');return;}if(watch!==null){refreshGPSFix();return;}if(!window.isSecureContext){toast('Live-Standort braucht eine sichere HTTPS-Verbindung.');return;}$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Standort wird ermittelt …');watch=navigator.geolocation.watchPosition(handleGPSPosition,err=>{gpsWantNav=false;const msg=err.code===1?'Standortzugriff abgelehnt. Aktiviere ihn in den Browser-Einstellungen.':err.code===2?'Kein GPS-Signal. Du kannst den Start auf der Karte wählen.':'Standort nicht rechtzeitig gefunden. Wir versuchen es weiter.';$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(msg);$('nav-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(msg);if(typeof updateSetupLocation==='function')updateSetupLocation();toast(msg);if(err.code===1){stopGPS();position=null;updateStart();}}, {enableHighAccuracy:true,maximumAge:0,timeout:20000});}
function insidePark(p){return p[0]>48.8628&&p[0]<48.8763&&p[1]>2.769&&p[1]<2.7825;}
function updateUser(){if(!interactionPaused())updatePopupTravel();if(typeof updateSetupLocation==='function')updateSetupLocation();updateOrientation();if(!position)return;observeQueueDwell();const fresh=heading!==null&&Date.now()-headingAt<15000;const html=`<span class="user-marker">${fresh?`<span class="cone" style="transform:rotate(${heading}deg)"></span>`:''}</span>`;const icon=L.divIcon({html,className:'',iconSize:[22,22],iconAnchor:[11,11]});if(!userMarker)userMarker=L.marker(position.latlng,{icon,zIndexOffset:1000,rotateWithView:true}).addTo(map);else userMarker.setLatLng(position.latlng).setIcon(icon);if(!accuracyCircle)accuracyCircle=L.circle(position.latlng,{radius:position.accuracy,color:'#2876f8',weight:1,fillOpacity:.08,interactive:false}).addTo(map);else accuracyCircle.setLatLng(position.latlng).setRadius(position.accuracy);if(typeof syncThreeView==='function')syncThreeView();}
function renderFollow(){$('follow').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(following?'Standort folgt':'Standort folgen');$('locate').setAttribute('aria-pressed',following);}
async function lockScreen(){try{if('wakeLock'in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
let playerDismissed=false;
function playerVisible(){return !tooFarFromPark()&&!(typeof queueCheckin!=='undefined'&&queueCheckin)&&!!route?.order.length&&!playerDismissed&&!document.body.classList.contains('functions-open')&&(nav||document.body.classList.contains('expanded')||document.body.classList.contains('map-home'));}
function enterNav(){if(navigationBlocked())return;playerDismissed=false;if(!route?.order.length)return;if(!position||Date.now()-lastFix>20000||!insidePark(position.latlng)||position.accuracy>80){toast('Für Live-Navigation brauchen wir einen genauen Standort im Park.');return;}finishQueueForNavigation();showNavigationMap();nav=true;following=true;document.body.classList.remove('functions-open');document.body.classList.remove('expanded');document.body.classList.add('nav-mode');$('navigation').hidden=false;map.invalidateSize();map.setView(position.latlng,18,{animate:false});renderFollow();renderNav();lockScreen();homeView('map');}
function exitNav(){playerDismissed=true;nav=false;gpsWantNav=false;following=false;++generation;planning=false;route=null;routeOrigin=null;pinnedWC=null;try{localStorage.setItem(`${userKey}:navigation-stopped`,'true');}catch{}setHeadingUp(false);renderFollow();lineLayer.clearLayers();if(data){renderRoute();renderPins();}document.body.classList.remove('nav-mode','expanded');$('fullscreen').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('⛶');$('navigation').hidden=true;if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});wakeLock?.release().catch(()=>{});wakeLock=null;map.invalidateSize();}
function renderNav(){renderQueueCheckin();if(typeof syncPush==='function')syncPush();renderNearbyShows();renderOrientation();renderSuggestions();$('navigation').hidden=!playerVisible();if(!route?.order.length)return;const target=pointById.get(route.order[0]),leg=route.legs[0];$('nav-label').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Als Nächstes');const targetWait=waitInfo(target);$('nav-wait').hidden=!targetWait;$('nav-wait-source').hidden=!targetWait;$('nav-wait').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(waitBadge(target));$('nav-wait').className='nav-wait nav-queue-times';$('nav-wait').title=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(targetWait?.detail||'');const after=pointById.get(route.order[1]);$('nav-next').hidden=!after;$('nav-next').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(after?`Danach: ${after.name} · ${metric(route.legs[1].distance)}`:'');$('nav-skip').setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)((target.id.startsWith('wc-')||target.id.startsWith('service-'))?'Pause entfernen':'Für jetzt überspringen'));$('nav-skip').title=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)((target.id.startsWith('wc-')||target.id.startsWith('service-'))?'Pause entfernen':'Für jetzt überspringen');$('nav-target').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)((target.id.startsWith('wc-')||target.id.startsWith('service-'))?(target.serviceType?target.name:'WC-Pause'):target.name);$('nav-distance').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(queueCheckin?.id===target.id?queueProgress(queueCheckin):`${metric(leg.distance)} · ca. ${minutes(leg.distance)} Min. zu Fuß`);$('arrived').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)((target.id.startsWith('wc-')||target.id.startsWith('service-'))?'Pause erledigt':'Ride besucht');renderDirection();const fresh=position&&Date.now()-lastFix<20000;const near=position&&RouteCore.distance(position.latlng,data.nodes[target.node])<25;let text=!fresh?(nav?'GPS-Signal fehlt · Navigation pausiert.':`Route ab ${originLabel} · Live-Standort aktivieren.`):position.accuracy>80?'GPS ungenau · warte auf ein besseres Signal.':near?'Ziel in der Nähe. Nach dem Besuch als erledigt markieren.':heading===null||Date.now()-headingAt>15000?'Gehrichtung wird beim Gehen erkannt.':`Live-Navigation · GPS ± ${Math.round(position.accuracy)} m`;if(!navigator.onLine)text+=' · Offline';$('nav-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(text);}
$('search').addEventListener('focus',closeQueueForBrowse);$('search').addEventListener('input',renderRides);$('park').addEventListener('change',()=>setParkMode($('park').value));$('category').addEventListener('change',renderRides);$('favorites-only').onclick=()=>{onlyFav=!onlyFav;$('favorites-only').setAttribute('aria-pressed',onlyFav);renderRides();};$('rides-tab').onclick=()=>homeView(ratingsMode?'best':onlyFav?'favorites':'all');$('route-tab').onclick=()=>homeView('route');$('plan').onclick=async()=>{homeView('route');showNavigationMap();playerDismissed=false;await replan({fit:true});};$('start-nav').onclick=()=>nav?homeView('map'):activateGPS(true);$('gps').onclick=()=>activateGPS(false);$('manual').onclick=()=>{if(navigationBlocked())return;homeView('map');showNavigationMap();pickStart=true;toast('Tippe auf deinen Startpunkt auf der Wegekarte.');map.getContainer().scrollIntoView({block:'start',behavior:'smooth'});};$('entrance').onclick=()=>{if(navigationBlocked())return;stopGPS();position=null;origin=[48.8705,2.77972];originLabel='Parkeingang';$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Planung ab dem Parkeingang · kein Live-GPS');$('gps').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('◎ Live-Standort aktivieren');updateStart();replan();};$('geo-tab').onclick=()=>showMap('geo');$('original-tab').onclick=()=>showMap('original');$('three-tab').onclick=()=>showMap('3d');$('three-retry').onclick=()=>showMap('3d');$('three-use-geo').onclick=()=>showMap('geo');$('wc').onclick=openWCChoice;$('nav-wc').onclick=openWCChoice;for(const mode of ['keep','nearest'])$('wc-'+mode).onclick=async()=>{const id=$('wc-choice').dataset.target;$('wc-choice').close();await wcPause(mode,id);};$('wc-cancel').onclick=()=>$('wc-choice').close();$('arrived').onclick=()=>route?.order[0]&&complete(route.order[0]);$('exit-nav').onclick=exitNav;$('fit').onclick=()=>{$('map-settings').close();showNavigationMap();fitRoute();};$('locate').onclick=()=>{showNavigationMap();following=true;renderFollow();if(position&&insidePark(position.latlng))map.setView(position.latlng,18);else activateGPS();};$('follow').onclick=()=>{following=true;renderFollow();if(position)map.setView(position.latlng,18);};$('fullscreen').onclick=()=>{if(nav){exitNav();return;}document.body.classList.toggle('expanded');renderNav();$('fullscreen').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(document.body.classList.contains('expanded')?'✕':'⛶');map.invalidateSize();originalMap?.invalidateSize();};$('reset-visited').onclick=()=>{visited.clear();save();renderRides();replan();};$('restore-defaults').onclick=()=>{favorites=new Set(data.defaultFavorites||[]);save();renderRides();if(route)replan();else{renderRoute();renderPins();}toast('Standard-Favoriten wiederhergestellt. Besuchte Ziele bleiben abgehakt.');};
async function promptAppInstallation(){
 const prompt=installedPrompt;if(!prompt)return false;installedPrompt=null;
 try{await prompt.prompt();return(await prompt.userChoice).outcome==='accepted';}catch{if(typeof refreshPlatformHelp==='function')refreshPlatformHelp();return false;}
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installedPrompt=e;});$('install').onclick=async()=>{if(installedPrompt)await promptAppInstallation();else{if(typeof refreshPlatformHelp==='function')refreshPlatformHelp();$('install-help').showModal();}};$('close-install').onclick=()=>$('install-help').close();
function renderSuggestions(){suggestion=null;if(route?.order.length&&!waitsBusy&&!waitsFailed&&navigator.onLine){const start=router.snap(origin);if(pinnedWC)start.node=pinnedWC.node;const next=pointById.get(route.order.find(id=>id.startsWith('ride-')));if(start.distance<=90&&next){for(const ride of remaining()){if(deferred.has(ride.id)||ride.id===next.id||(dismissedSuggestions.get(ride.id)||0)>Date.now()||!ride.queueTimes)continue;const entry=waits.get(`${ride.queueTimes.parkId}:${ride.queueTimes.rideId}`);const walk=router.tree(start.node).ds[ride.node];if(!Number.isFinite(walk)||walk>1200)continue;const extra=Math.max(0,(walk+router.tree(ride.node).ds[next.node]-router.tree(start.node).ds[next.node])/72);const singleId=DisneyWaits.singleRiderId(ride.queueTimes),single=singleId&&waits.get(`${ride.queueTimes.parkId}:${singleId}`),chance=DisneyWaits.bestOpportunity(entry,single,extra,typeof appSettings!=='undefined'&&appSettings.singleRiderAlerts);if(chance&&(!suggestion||chance.benefit>suggestion.benefit))suggestion={...chance,id:ride.id,name:ride.name};}}}const markup=suggestion?`<span class="suggestion-label">KURZE SCHLANGE · WILLST DU WECHSELN?</span><strong>${esc(suggestion.name)}</strong><span>${esc(suggestion.lane||'Normal')}: ${suggestion.minutes} Min. statt zuletzt meist ${suggestion.baseline} Min. · ca. ${suggestion.extraWalkingMinutes} Min. zusätzlicher Fußweg</span><div><button data-insert-suggestion="${suggestion.id}" ${planning?'disabled':''}>Ja, wechseln</button><button data-dismiss-suggestion="${suggestion.id}" aria-label="Bisheriges Ziel behalten">Bisheriges Ziel</button></div>`:'';for(const id of ['wait-suggestion','nav-suggestion','playlist-suggestion']){$(id).hidden=!suggestion;$(id).innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(markup);}}
async function visitNext(id){
 if(navigationBlocked())return false;const ride=pointById.get(id);if(planning||!ride||!id.startsWith('ride-')||uninterested.has(id))return false;
 const unavailable=!targetAvailable(ride);
 if(unavailable){
  const warning=ride.category==='show'?'Für diese Show ist heute keine erreichbare Vorstellung mehr bestätigt.':'Dieser Ride ist derzeit geschlossen.';
  if(!window.confirm((typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`${ride.name}\n\n${warning}\n\nBist du sicher, dass du trotzdem dorthin navigieren möchtest?`)))return false;
 }
 finishQueueForNavigation(id);playerDismissed=false;
 if(priorityRide)delete priorityRide.allowUnavailableNavigation;
 priorityRide=ride;priorityRide.allowUnavailableNavigation=unavailable;
 favorites.add(id);visited.delete(id);deferred.delete(id);save();renderRides();await replan();
 if($('route-playlist').open){$('route-playlist').scrollTop=0;const content=$('route-playlist').querySelector('.sheet-scroll');if(content)content.scrollTop=0;}
 toast(`${ride.name} als nächstes Ziel eingeplant${pinnedWC?(pinnedWC.serviceType?' · nach der Pause':' · nach der WC-Pause'):''}${unavailable?' · trotz fehlender Verfügbarkeit':''}.`);
 return !!route?.order.includes(id);
}

async function acceptSuggestion(id){const ride=pointById.get(id);if(planning||!ride||!remaining().some(r=>r.id===id))return;const m=ride.queueTimes,entry=m&&waits.get(`${m.parkId}:${m.rideId}`);if(waitsBusy||waitsFailed||!navigator.onLine){toast('Die Wartezeit ist nicht mehr aktuell. Bitte aktualisieren.');return;}renderSuggestions();if(suggestion?.id!==id){toast('Dieser Vorschlag ist nicht mehr aktuell. Das bisherige Ziel bleibt erhalten.');return;}await visitNext(id);}
for(const id of ['wait-suggestion','nav-suggestion','playlist-suggestion'])$(id).addEventListener('click',e=>{const insert=e.target.closest('[data-insert-suggestion]'),dismiss=e.target.closest('[data-dismiss-suggestion]');if(insert)acceptSuggestion(insert.dataset.insertSuggestion);else if(dismiss){dismissedSuggestions.set(dismiss.dataset.dismissSuggestion,Date.now()+15*60*1000);renderSuggestions();}});
function renderWaitStatus(){updatePopupWaits();const entries=data.rides.filter(r=>r.queueTimes).map(r=>waits.get(`${r.queueTimes.parkId}:${r.queueTimes.rideId}`)).filter(Boolean),dates=entries.map(x=>Date.parse(x.updatedAt)).filter(Number.isFinite),latest=dates.length?Math.max(...dates):null,stale=waitsFailed||!navigator.onLine||entries.some(x=>x.stale||!Number.isFinite(Date.parse(x.updatedAt))||Date.now()-Date.parse(x.updatedAt)>15*60*1000);$('wait-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(!entries.length?(waitsBusy?'Wartezeiten werden geladen …':'Wartezeiten momentan nicht verfügbar'):stale?`Wartezeiten teilweise veraltet${latest?' · Stand '+new Date(latest).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}):''}`:`Wartezeiten · Stand ${new Date(latest).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})} · Quelle aktualisiert ca. alle 5 Min.`);$('refresh-waits').disabled=waitsBusy;}
async function refreshWaits(){if(!activeSession||waitsBusy)return;waitsBusy=true;renderWaitStatus();try{const preview=(location.pathname==='/'||location.pathname==='/index.html'||location.pathname==='/App/')&&location.hostname!=='abetterdisneylandparisapp.weletapi.com',url=preview?'wait-preview.json':'index.php?waits=1';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetch(url,{cache:'no-store',redirect:'error',signal:controller.signal});}finally{clearTimeout(timeout);}if(!response.ok)throw Error('Wartezeiten nicht verfügbar');const payload=await response.json();if(!Array.isArray(payload.parks))throw Error('Ungültige Wartezeiten');const next=new Map();for(const park of payload.parks){if(![4,28].includes(park.id)||!Array.isArray(park.rides))continue;for(const ride of park.rides){if(!Number.isInteger(ride.id))continue;next.set(`${park.id}:${ride.id}`,{...ride,stale:!!park.stale});}}if(!next.size)throw Error('Keine Wartezeiten');waits=next;waitsFailed=false;waitsFetchedAt=payload.fetchedAt;}catch{waitsFailed=true;}finally{waitsBusy=false;await refreshTargetAvailability();renderWaitStatus();renderRides();renderRoute();renderWaitHistoryDialog();}}
$('refresh-waits').onclick=refreshWaits;
function connection(){renderNearbyShows();$('connection').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(navigator.onLine?'Online':'Offline');if(data){renderWaitStatus();renderRides();renderRoute();}renderNav();}window.addEventListener('online',()=>{connection();checkSession();if(data){refreshWaits();refreshShows();}});window.addEventListener('offline',connection);document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkSession();if(nav)lockScreen();if(data){refreshWaits();refreshShows();}}});window.addEventListener('pagehide',()=>{stopGPS();wakeLock?.release().catch(()=>{});});
async function checkSession(){if((location.pathname==='/index.html'||location.pathname==='/'||location.pathname==='/App/')&&location.hostname!=='abetterdisneylandparisapp.weletapi.com')return;try{const response=await fetch('index.php?session=1',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok){throw Error('auth');}const session=await response.json();if(!session.user)throw Error('auth');if(userKey!=='disney-preview'&&userKey!==`disney:${session.user}`)throw Error('auth');return session;}catch(e){if(!navigator.onLine||location.hostname==='abetterdisneylandparisapp.weletapi.com')return null;activeSession=false;stopGPS();exitNav();worker?.terminate();favorites.clear();visited.clear();document.body.innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)('<main style="padding:40px;font-family:system-ui"><h1>Bitte erneut anmelden</h1><p>Deine weletapi-Sitzung ist abgelaufen.</p><a href="/auth/?path=%2Ffiles%2F.internal%2FDisney%2F">Zur Anmeldung</a></main>');}}
window.addEventListener('DOMContentLoaded',async()=>{try{const session=await checkSession();if(!activeSession)return;if(session?.user)userKey=`disney:${session.user}`;loadPreferences();loadParkProximity();data=await window.DisneyStartup.loadJSON('park-data.json?v=42',8494350);if(typeof DisneyI18n!=='undefined')DisneyI18n.localizePoints([...data.rides,...data.toilets,...(data.services||[])]);router=new RouteCore.Router(data);for(const r of [...data.rides,...data.toilets,...(data.services||[])])pointById.set(r.id,r);loadQueueCheckin();worker=new Worker('route-worker.js?v=116');worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.result);};worker.onerror=()=>{for(const p of pending.values())p.reject(Error('Routenberechnung konnte nicht gestartet werden.'));pending.clear();};await rpc('init',{data},15000);load();loadParkMode();loadMapFilter();appReady=true;$('park-mode').disabled=false;try{headingUp=JSON.parse(localStorage.getItem(`${userKey}:heading-up`)||'false')===true;}catch{}renderOrientation();for(const path of data.paths)L.polyline(path,{color:'#b1c0b5',weight:2,opacity:.6,interactive:false}).addTo(walkLayer);renderRides();renderRoute();renderPins();updateStart();connection();refreshWaits();refreshShows();window.DisneyStartup?.status('Parkkarte wird geladen …');await loadMapMode();window.DisneyStartup?.finish();startOnboarding();if(new URLSearchParams(location.search).get('view')==='info'){homeView('info');const url=new URL(location.href);url.searchParams.delete('view');window.history.replaceState(window.history.state,'',url);}if(pendingCheckinId){if(!queueCheckin)openQueueCheckin(pendingCheckinId);pendingCheckinId=null;const url=new URL(location.href);url.searchParams.delete('checkin');window.history.replaceState(window.history.state,'',url);}try{playerDismissed=localStorage.getItem(`${userKey}:navigation-stopped`)==='true';}catch{}if(!playerDismissed&&remaining().length)await replan();setInterval(()=>{if(!document.hidden)refreshWaits();},60000);setInterval(()=>{renderWaitStatus();renderRides();renderRoute();checkSession();},30000);if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register((location.hostname==='abetterdisneylandparisapp.weletapi.com'?'/':'')+'sw.js?v='+APP_BUILD,{scope:location.hostname==='abetterdisneylandparisapp.weletapi.com'?'/':'./',updateViaCache:'none'}).catch(()=>{});if(document.modelContext?.registerTool){const lifecycle=new AbortController();for(const tool of [{name:'set_disney_favorites',description:'Set the complete selection of Ride favorites on this device.',inputSchema:{type:'object',properties:{rideIds:{type:'array',items:{type:'string'}}},required:['rideIds'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!Array.isArray(input.rideIds)||input.rideIds.some(id=>!pointById.has(id)||!id.startsWith('ride-')))throw Error('Unknown Ride ID');favorites=new Set(input.rideIds);save();renderRides();renderPins();if(route)await replan();return{favorites:[...favorites]};}},{name:'calculate_disney_route',description:'Calculate and display a walking route for the current favorites, starting at the current planned origin.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:async()=>{if(!remaining().length)throw Error('No rides selected');await replan();if(!route)throw Error('Route unavailable');tab('route');return{stops:route.order,distanceMetres:Math.round(route.distance),exact:route.exact};}}])Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}}catch(e){console.error('App-Start:',e);window.DisneyStartup?.fail(e);$('rides-list').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(`<p>Die Karte konnte nicht geladen werden.</p><p class="small">${esc(e.message)}</p><button class="primary" id="reload">Erneut versuchen</button>`);$('reload').onclick=()=>location.reload();toast(e.message);}});
let shows=new Map(),showsFetchedAt=0,showsScheduleAt=0,showsBusy=false,nearbyShows=[],targetAvailabilityKey='',showListMode='nearby';
async function refreshTargetAvailability(){
 if(!data)return;
 const ended=data.rides.filter(r=>!targetAvailable(r)),key=ended.map(r=>r.id).sort().join(',');
 if(key===targetAvailabilityKey)return;targetAvailabilityKey=key;
 const recalculate=!!route||planning||nav;
 if(priorityRide&&!targetAvailable(priorityRide)&&!priorityRide.allowUnavailableNavigation){priorityRide=null;save();}
 if(focusedRideId&&!targetAvailable(pointById.get(focusedRideId))&&!$('map-object-sheet').open){focusedRideId=null;map.closePopup();}
 const promptId=$('queue-prompt').dataset.rideId;if(promptId&&!targetAvailable(pointById.get(promptId)))$('queue-prompt').close();
 if(recalculate){route=null;routeOrigin=null;planning=false;lineLayer.clearLayers();}
 renderRides();renderPins();renderRoute();renderNearbyShows();
 if(recalculate)await replan();
 if(typeof syncPush==='function')syncPush(true);
}
function renderNearbyShows(){if(!data)return;nearbyShows=navigator.onLine&&Date.now()-lastFix<45000?DisneyShows.nearby(data,shows,router,position,Date.now(),showsFetchedAt).filter(x=>parkMatches(x.ride)&&!uninterested.has(x.ride.id)&&targetAvailable(x.ride)):[];document.body.classList.toggle('has-show-hint',!!nearbyShows.length);const box=$('nearby-shows');if(box){box.hidden=!nearbyShows.length;if(nearbyShows.length){const first=nearbyShows[0],label=`♫ ${first.ride.name} · ${new Date(first.start).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})}${first.language?' · '+first.language:''} · ${first.walkMinutes} Min. zu Fuß${nearbyShows.length>1?` · +${nearbyShows.length-1}`:''}`;if(box.dataset.showId!==first.ride.id){box.innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)('<button type="button" aria-label="Show auf der Karte anzeigen"></button>');box.dataset.showId=first.ride.id;box.firstElementChild.onclick=()=>focusRideOnMap(box.dataset.showId);}if(box.firstElementChild.textContent!==label)box.firstElementChild.textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(label);}else{box.replaceChildren();delete box.dataset.showId;}}if($('info-shows-status')){const count=showListEntries().length;$('info-shows-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(count?`${count} Shows heute erreichbar`:'Keine erreichbaren Vorstellungen bestätigt. Standort freigeben, um Entfernungen zu sehen.');}if($('shows-dialog').open)renderShowList();}
function showListEntries(mode=typeof showListMode==='undefined'?'nearby':showListMode){
 if(!data||!navigator.onLine||tooFarFromPark()&&mode!=='all')return [];
 const all=mode==='all',entries=all?DisneyShows.allToday(data,shows,router,position||{latlng:origin},Date.now(),showsFetchedAt):Date.now()-lastFix<45000?DisneyShows.nearby(data,shows,router,position,Date.now(),showsFetchedAt):[];
 const visible=entries.filter(x=>parkMatches(x.ride)&&!uninterested.has(x.ride.id)&&(all||targetAvailable(x.ride)));return tooFarFromPark()?visible.map(x=>({...x,meters:Infinity})).sort((a,b)=>a.ride.name.localeCompare(b.ride.name,(typeof DisneyI18n==='undefined'?'de':DisneyI18n.locale()))):visible;
}
function renderShowList(){$('shows-nearby-tab').setAttribute('aria-selected',showListMode==='nearby');$('shows-today-tab').setAttribute('aria-selected',showListMode==='all');$('shows-list-note').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(showListMode==='all'?(tooFarFromPark()?'Alle bestätigten Shows heute · Name A–Z.':'Alle bestätigten Shows heute · Nach Entfernung sortiert.'):'Bis 800 m Fußweg · Beginn innerhalb von 45 Minuten. Einlass vor Ort prüfen.');$('shows-list').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(showListEntries().map(x=>`<div class="show-list-item" data-object-row="${x.ride.id}"><button class="object-open" data-object-info="${x.ride.id}" aria-label="Infos: ${esc(x.ride.name)}">${esc(x.ride.name)}</button><p>${x.ride.eventSetting==='indoor'?'Indoor · 10 Min. vorher da sein<br>':x.ride.eventSetting==='outdoor'?'Outdoor<br>':''}Heute ${new Date(x.start).toLocaleTimeString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})}${x.language?' · '+esc(x.language):''} · ${x.closed?'Derzeit geschlossen':x.tooLate?'Heute nicht mehr rechtzeitig erreichbar':x.finished?'Heute beendet':x.started?(x.minutes?'Beginn vor '+x.minutes+' Min.':'Beginnt jetzt'):'in '+x.minutes+' Min.'}<br>${Number.isFinite(x.meters)?`${metric(x.meters)} · ca. ${x.walkMinutes} Min. zu Fuß`:'Entfernung nicht verfügbar'}</p><button class="secondary" data-show-next="${x.ride.id}" ${tooFarFromPark()?'disabled':''}>▶ Als Nächstes</button></div>`).join('')||'<p>Keine erreichbaren Vorstellungen für heute bestätigt.</p>');$('shows-list').onclick=async e=>{const b=e.target.closest('[data-show-next]');if(!b||planning)return;renderNearbyShows();const id=b.dataset.showNext;if(!showListEntries().some(x=>x.ride.id===id)){toast('Dieser Show-Hinweis ist nicht mehr aktuell.');return;}if(!await visitNext(id))return;$('shows-dialog').close();if(!nav){document.body.classList.add('functions-open');tab('route');}};}
async function refreshShows(){if(!activeSession||showsBusy||!navigator.onLine)return;showsBusy=true;try{const preview=(location.pathname==='/'||location.pathname==='/index.html'||location.pathname==='/App/')&&location.hostname!=='abetterdisneylandparisapp.weletapi.com';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);let response;try{response=await fetch(preview?'shows-preview.json':'index.php?shows=1',{cache:'no-store',redirect:'error',signal:controller.signal});}finally{clearTimeout(timeout);}if(!response.ok)throw Error('shows');const payload=await response.json();if(payload.stale||!Array.isArray(payload.shows)||!Number.isFinite(payload.fetchedAt))throw Error('stale');shows=new Map(payload.shows.map(x=>[x.id,x]));showsFetchedAt=payload.fetchedAt*1000;showsScheduleAt=showsFetchedAt;}catch{showsFetchedAt=0;}finally{showsBusy=false;await refreshTargetAvailability();renderNearbyShows();renderObjectInfo();}}
setInterval(()=>{if(data&&!document.hidden)refreshShows();},60000);setInterval(()=>{if(data&&!document.hidden){refreshTargetAvailability();renderNearbyShows();}},15000);
function rememberHomeView(){if(activeHomeView==='map')return;homeViewStates.set(activeHomeView,{search:$('search').value,park:$('park').value,category:$('category').value,ageGroup:$('age-group').value,onlyFav,small:$('ratings-small').checked,sort:nearbySortPreference||$('ride-sort').value,showVisited:$('show-visited').checked,filtersOpen:$('filter-options').open,scroll:document.querySelector('.panel').scrollTop});}
function homeView(view){
 if(!['map','favorites','all','best','route','info'].includes(view))return;
 rememberHomeView();
 if(view!=='map')closeQueueForBrowse();
 if(view!=='map'&&$('map-object-sheet').open)closeMapObjectSheet();
 activeHomeView=view;$('functions-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(({favorites:'Favoriten',all:'Entdecken',best:'Entdecken',route:'Deine Route',info:'Info'})[view]||'Disney');document.body.classList.toggle('route-page',view==='route');$('info-view').hidden=view!=='info';
 document.body.classList.toggle('info-open',view==='info');document.body.classList.toggle('ratings-open',view==='best');document.body.classList.remove('expanded');document.body.classList.toggle('functions-open',view!=='map');
 for(const name of ['map','favorites','all','best','route','info'])$('home-'+name).setAttribute('aria-pressed',name===view||(name==='all'&&view==='best'));
 $('explore-all').setAttribute('aria-pressed',view==='all');document.body.classList.toggle('catalog-page',['all','best','favorites'].includes(view));document.body.classList.toggle('favorites-page',view==='favorites');
 if(view==='info'){checkAppUpdate();$('rides-view').hidden=true;$('route-view').hidden=true;renderNearbyShows();}if(view==='route')tab('route');
 if(['all','favorites','best'].includes(view)){
  const state=homeViewStates.get(view);ratingsMode=view==='best';onlyFav=state?.onlyFav??(view==='favorites');$('favorites-only').setAttribute('aria-pressed',onlyFav);
  $('search').value=state?.search||'';$('park').value=selectedPark;$('category').value=state?.category||(ratingsMode?'attraction':'all');$('age-group').value=state?.ageGroup||'all';$('ratings-small').checked=state?.small||false;nearbySortPreference=null;$('ride-sort').value=state?.sort||'distance';$('show-visited').checked=state?.showVisited??true;$('filter-options').open=state?.filtersOpen||false;
  tab('rides');renderRides();
 }
 document.querySelector('.panel').scrollTop=homeViewStates.get(view)?.scroll||0;
 if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 map.invalidateSize();renderNav();
}
function tapHomeView(view){
 const selected=activeHomeView===view||view==='all'&&activeHomeView==='best';
 if(selected&&view!=='map'){
  const panel=document.querySelector('.panel');panel.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  const state=homeViewStates.get(activeHomeView);if(state)state.scroll=0;return;
 }
 homeView(view);
}
for(const view of ['map','favorites','all','best','route','info'])$('home-'+view).onclick=()=>tapHomeView(view);
$('explore-all').onclick=()=>homeView('all');
function resetBrowseFilters(){
 $('search').value='';$('age-group').value='all';$('category').value=ratingsMode?'attraction':'all';onlyFav=activeHomeView==='favorites';$('favorites-only').setAttribute('aria-pressed',onlyFav);$('show-visited').checked=true;$('ratings-small').checked=false;$('ride-sort').value='distance';if(selectedPark!=='all')setParkMode('all');else renderRides();
}
$('filters-reset').onclick=resetBrowseFilters;
$('rides-list').addEventListener('click',event=>{if(event.target.closest('[data-reset-filters]'))resetBrowseFilters();});
$('map-search').onclick=()=>{homeView('all');$('search').focus();};
$('map-options').onclick=()=>$('map-settings').showModal();
for(const id of ['map-settings-close','map-settings-done'])$(id).onclick=()=>$('map-settings').close();
$('map-filter').onchange=()=>{renderPins();try{localStorage.setItem(`${userKey}:map-filter`,$('map-filter').value);}catch{}};
let mapFacilities={toilets:false,water:false,restaurants:false};
function facilityVisible(point){return point.id.startsWith('wc-')?mapFacilities.toilets:point.serviceType==='water'?mapFacilities.water:point.serviceType==='restaurant'?mapFacilities.restaurants:false;}
function restaurantRating(point){return typeof DisneyRestaurantRatings!=='undefined'?DisneyRestaurantRatings.get(point):null;}
function loadMapFacilities(){try{const saved=JSON.parse(localStorage.getItem(`${userKey}:map-facilities`)||'{}');for(const kind of ['toilets','water','restaurants'])mapFacilities[kind]=saved?.[kind]===true;}catch{}for(const kind of ['toilets','water','restaurants'])$('map-show-'+kind).checked=mapFacilities[kind];}
for(const kind of ['toilets','water','restaurants'])$('map-show-'+kind).onchange=()=>{mapFacilities[kind]=$('map-show-'+kind).checked;try{localStorage.setItem(`${userKey}:map-facilities`,JSON.stringify(mapFacilities));}catch{toast('Karteneinstellungen konnten nicht gespeichert werden.');}renderPins();};
function loadMapFilter(){loadMapFacilities();try{const filter=localStorage.getItem(`${userKey}:map-filter`);if(['all','attraction','show','favorites'].includes(filter))$('map-filter').value=filter;}catch{}}
$('age-group').onchange=renderRides;$('show-visited').onchange=renderRides;$('ride-sort').onchange=()=>{nearbySortPreference=null;renderRides();};$('ratings-small').onchange=renderRides;$('close-functions').onclick=()=>homeView('map');$('close-shows').onclick=()=>$('shows-dialog').close();

$('install-panel').onclick=()=>$('install').click();

$('info-shows').onclick=()=>{renderNearbyShows();renderShowList();$('shows-dialog').showModal();};

$('park-mode').onchange=()=>setParkMode($('park-mode').value);

if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='disney-open-checkin'&&typeof event.data.id==='string'){if(appReady)openQueueCheckin(event.data.id);else pendingCheckinId=event.data.id;}if(event.data?.type==='disney-open-notice'&&typeof event.data.id==='string')focusRideOnMap(event.data.id);});

// Installed iOS apps can retain a shorter JS viewport after the root fills the screen.
// Use the rendered app height there; browser tabs and keyboard still use the visual area.
const viewportProbe=document.createElement('div');viewportProbe.id='viewport-probe';viewportProbe.setAttribute('aria-hidden','true');document.body.append(viewportProbe);
document.body.classList.toggle('app-standalone',navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches);
let fullViewportHeight=window.innerHeight,viewportMapHeight=0;
function syncAppViewport(){
 const vv=window.visualViewport,visualHeight=vv?.height||window.innerHeight;
 const layoutHeight=Math.max(viewportProbe.getBoundingClientRect().height,document.documentElement.clientHeight||0,window.innerHeight||0,visualHeight);
 fullViewportHeight=layoutHeight;
 const editing=document.activeElement?.matches('input,textarea,[contenteditable="true"]');
 const keyboard=!!editing&&(vv?.scale||1)===1&&layoutHeight-visualHeight>120;
 const uiTop=keyboard?Math.max(0,vv?.offsetTop||0):0;
 const visibleHeight=Math.min(visualHeight,window.innerHeight||visualHeight,document.documentElement.clientHeight||visualHeight);
 const appHeight=document.body.classList.contains('app-standalone')&&!keyboard?document.body.getBoundingClientRect().height:visibleHeight;
 const uiHeight=Math.min(appHeight||visibleHeight,layoutHeight-uiTop);
 document.body.classList.toggle('keyboard-open',keyboard);
 document.documentElement.style.setProperty('--app-viewport-height',`${uiHeight}px`);
 document.documentElement.style.setProperty('--app-viewport-top',`${uiTop}px`);
 document.documentElement.style.setProperty('--map-ui-bottom-inset',`${Math.max(0,layoutHeight-uiTop-uiHeight)}px`);
 document.documentElement.style.setProperty('--map-viewport-height',`${layoutHeight}px`);
 if(layoutHeight!==viewportMapHeight){viewportMapHeight=layoutHeight;window.requestAnimationFrame(()=>{map.invalidateSize({pan:false,animate:false});originalMap?.invalidateSize({pan:false,animate:false});});}
}
window.visualViewport?.addEventListener('resize',syncAppViewport);window.visualViewport?.addEventListener('scroll',syncAppViewport);window.addEventListener('resize',syncAppViewport);document.addEventListener('focusin',syncAppViewport);document.addEventListener('focusout',syncAppViewport);syncAppViewport();
window.addEventListener('pageshow',syncAppViewport);document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.requestAnimationFrame(syncAppViewport);});
$('search-clear').addEventListener('pointerdown',event=>event.preventDefault());
$('search-clear').onclick=()=>{$('search').value='';renderRides();$('search').focus({preventScroll:true});syncAppViewport();};
$('search-done').onclick=()=>{$('search').blur();syncAppViewport();};$('search').addEventListener('keydown',event=>{if(event.key==='Enter'){$('search').blur();syncAppViewport();}});

$('restore-defaults-info').onclick=()=>$('restore-defaults').click();

const bottomNav=document.querySelector('.bottom-nav');
function syncBottomNavHeight(){if(bottomNav?.offsetHeight)document.documentElement.style.setProperty('--bottom-nav-height',`${bottomNav.offsetHeight}px`);}
if(typeof ResizeObserver!=='undefined'&&bottomNav)new ResizeObserver(syncBottomNavHeight).observe(bottomNav);
window.addEventListener('resize',syncBottomNavHeight);syncBottomNavHeight();

const APP_BUILD=116;

let appUpdateBusy=false,latestAppBuild=null,announcedAppBuild=null;
function renderAppVersion(){
 const available=latestAppBuild>APP_BUILD;$('home-info').classList.toggle('has-update',available);$('home-info').setAttribute('aria-label',(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(available?'Info · Update verfügbar':'Info'));$('app-update-card').classList.toggle('update-available',available);
 $('app-version').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`App-Version ${APP_BUILD}${latestAppBuild?` · Server ${latestAppBuild}`:''}`);
 $('app-update-reload').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(latestAppBuild>APP_BUILD?'Update installieren':'App neu laden');
 $('app-update-check').disabled=appUpdateBusy;$('app-update-reload').disabled=appUpdateBusy;
}
async function checkAppUpdate(){
 if(appUpdateBusy)return false;
 appUpdateBusy=true;renderAppVersion();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const preview=(location.pathname==='/'||location.pathname==='/index.html'||location.pathname==='/App/')&&location.hostname!=='abetterdisneylandparisapp.weletapi.com';
  const response=await fetch(preview?'index.html':`index.php?version=1&t=${Date.now()}`,{cache:'no-store',redirect:'error',signal:controller.signal});
  if(!response.ok)throw Error('Update-Prüfung momentan nicht möglich.');
  const version=preview?{build:Number((await response.text()).match(/app\.js\?v=(\d+)/)?.[1])}:await response.json(),build=Number(version.build);
  if(!Number.isInteger(build)||build<1)throw Error('Update-Prüfung momentan nicht möglich.');
  latestAppBuild=build;
  $('app-update-details').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(build>APP_BUILD&&Array.isArray(version.items)?version.items.filter(x=>typeof x==='string').join(' · '):'');$('app-update-details').hidden=!$('app-update-details').textContent;
  $('app-update-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(build>APP_BUILD?'Neue Version verfügbar. Antippen, um sie zu laden.':'Du verwendest die aktuelle Version.');
  if(build>APP_BUILD&&announcedAppBuild!==build){announcedAppBuild=build;toast('Update verfügbar · unter Info installieren.');}
  return true;
 }catch{
  $('app-update-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(navigator.onLine?'Update-Prüfung momentan nicht möglich.':'Offline · Version kann gerade nicht geprüft werden.');
  return false;
 }finally{clearTimeout(timer);appUpdateBusy=false;renderAppVersion();}
}
async function reloadAppUpdate(){
 if(!await checkAppUpdate())return;
 appUpdateBusy=true;renderAppVersion();$('app-update-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Aktuelle App wird geladen …');
 if('serviceWorker'in navigator){try{const registration=await navigator.serviceWorker.getRegistration('./');if(registration)await Promise.race([registration.update(),new Promise(resolve=>setTimeout(resolve,8000))]);}catch{}}
 const url=new URL(location.href);url.searchParams.set('_update',Date.now());location.replace(url.href);
}
$('app-update-check').onclick=checkAppUpdate;$('app-update-reload').onclick=reloadAppUpdate;renderAppVersion();
window.addEventListener('DOMContentLoaded',checkAppUpdate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAppUpdate();});
setInterval(()=>{if(!document.hidden)checkAppUpdate();},120000);

$('nav-details-toggle').onclick=()=>{
 const expanded=$('nav-details').hidden;
 $('nav-details').hidden=!expanded;
 $('navigation').classList.toggle('details-open',expanded);
 $('nav-details-toggle').setAttribute('aria-expanded',expanded);
 $('nav-details-toggle').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(expanded?'Weniger ▴':'Mehr ▾');
};


function facilityEntries(kind,query=''){
 if(!data||!router)return [];
 const snap=router.snap(origin);if(snap.distance>90)return [];
 const distances=router.tree(snap.node).ds,text=query.trim().toLocaleLowerCase('de-DE');
 return (data.services||[]).filter(p=>p.serviceType===kind&&parkMatches(p)&&(kind==='restaurant'?DisneyRestaurantSearch.matches(p,text):p.name.toLocaleLowerCase('de-DE').includes(text))).map(point=>({point,meters:distances[point.node]+snap.distance})).filter(x=>Number.isFinite(x.meters)).sort((a,b)=>a.meters-b.meters||a.point.name.localeCompare(b.point.name,(typeof DisneyI18n==='undefined'?'de':DisneyI18n.locale())));
}
function renderFacilities(){
 const dialog=$('facilities-dialog'),kind=dialog.dataset.kind||'water';
 $('facilities-search-clear').hidden=!$('facilities-search').value.length;
 $('facilities-title').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(kind==='water'?'Trinkwasserstellen':'Restaurants');
 for(const name of ['water','restaurant'])$('facilities-'+name).setAttribute('aria-selected',kind===name);
 const entries=facilityEntries(kind,$('facilities-search').value);
 $('facilities-origin').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`${entries.length} Orte · Fußweg ab ${originLabel}`);
 $('facilities-list').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(entries.length?entries.map(({point:p,meters})=>`<article class="facility-row"><div class="facility-heading"><button class="object-open" data-object-info="${p.id}">${esc(p.name)}</button><button type="button" class="result-pin" data-result-map="${p.id}" aria-label="Auf Karte zeigen: ${esc(p.name)}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></button></div>${p.serviceType==='restaurant'?`<p class="ride-meta">${esc(DisneyRestaurantSearch.description(p))}</p>`:''}<p>${minutes(meters)} Min. zu Fuß · ${metric(meters)}</p>${ratingBadge(p)||'<p class="small">Bewertung noch nicht verfügbar</p>'}<button class="primary" data-facility-next="${p.id}" ${planning?'disabled':''}>Dorthin navigieren</button></article>`).join(''):'<p>Keine passenden erreichbaren Orte gefunden.</p>');
}
function openFacilities(kind){if(!data)return;closeQueueForBrowse();$('facilities-dialog').dataset.kind=kind;$('facilities-search').value='';renderFacilities();if(!$('facilities-dialog').open)$('facilities-dialog').showModal();}
async function navigateFacility(id){
 if(navigationBlocked())return false;const point=pointById.get(id);if(planning||!point?.serviceType||!parkMatches(point))return false;
 const snap=router.snap(origin);if(snap.distance>90||!Number.isFinite(router.tree(snap.node).ds[point.node])){toast('Für diesen Ort ist kein Fußweg verfügbar.');return false;}
 const next=pointById.get(route?.order.find(id=>id.startsWith('ride-')));
 finishQueueForNavigation(id);playerDismissed=false;pinnedWC=point;priorityRide=next&&remaining().some(r=>r.id===next.id)?next:null;save();
 $('facilities-dialog').close();homeView('map');showNavigationMap();await replan({fit:true});toast(`${point.name} als Pause eingeplant.`);return !!route?.order.includes(id);
}
$('nav-water').onclick=()=>openFacilities('water');$('nav-restaurant').onclick=()=>openFacilities('restaurant');
$('facilities-water').onclick=()=>{$('facilities-dialog').dataset.kind='water';renderFacilities();};$('facilities-restaurant').onclick=()=>{$('facilities-dialog').dataset.kind='restaurant';renderFacilities();};
$('facilities-search-clear').addEventListener('pointerdown',event=>event.preventDefault());$('facilities-search-clear').onclick=()=>{$('facilities-search').value='';renderFacilities();$('facilities-search').focus({preventScroll:true});};
$('facilities-search').addEventListener('input',renderFacilities);$('facilities-close').onclick=()=>$('facilities-dialog').close();
$('facilities-list').addEventListener('click',e=>{const button=e.target.closest('[data-facility-next]');if(button)navigateFacility(button.dataset.facilityNext);});

function loadPreferences(){appSettings=DisneyPreferences.load(localStorage,userKey);renderPreferences();}
function renderPreferences(){$('alerts-single-rider').checked=appSettings.singleRiderAlerts;$('child-enabled').checked=!!appSettings.child;$('child-age').value=appSettings.child?.age??'';$('child-height').value=appSettings.child?.height??'';$('child-fields').hidden=!appSettings.child;}
function storePreferences(){try{localStorage.setItem(userKey+':preferences',JSON.stringify(appSettings));}catch{toast('Einstellungen konnten nicht gespeichert werden.');return false;}renderRides();renderObjectInfo();renderPlaylist();renderNav();if($('map-object-sheet').open)renderMapObjectSheet();if(typeof syncPush==='function')syncPush(true);return true;}
$('alerts-single-rider').onchange=()=>{appSettings.singleRiderAlerts=$('alerts-single-rider').checked;storePreferences();};
$('child-enabled').onchange=()=>{$('child-fields').hidden=!$('child-enabled').checked;if(!$('child-enabled').checked){appSettings.child=null;storePreferences();}};
function saveChildProfile(child){appSettings.child=child;const saved=storePreferences();renderPreferences();return saved;}
$('child-save').onclick=()=>{if(!$('child-enabled').checked){saveChildProfile(null);return;}const child=DisneyPreferences.childFromFields($('child-age').value,$('child-height').value);if(!child){toast('Bitte Alter (0–17 Jahre) und Größe (40–220 cm) eintragen.');return;}if(saveChildProfile(child))toast('Angaben zum jüngsten Kind gespeichert.');};
$('setup-child-save').onclick=()=>{const child=DisneyPreferences.childFromFields($('setup-child-age').value,$('setup-child-height').value),error=$('setup-child-error');error.hidden=false;if(!child){error.textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Bitte Alter (0–17 Jahre) und Größe (40–220 cm) eintragen.');return;}if(!saveChildProfile(child)){error.textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Die Angaben konnten nicht gespeichert werden. Bitte erneut versuchen.');return;}error.hidden=true;setupFavoritesPhase();};
$('setup-child-skip').onclick=()=>{if(!saveChildProfile(null))return;setupFavoritesPhase();};

$('shows-nearby-tab').onclick=()=>{showListMode='nearby';renderShowList();};$('shows-today-tab').onclick=()=>{showListMode='all';renderShowList();};

async function applyListAction(id,action){if(planning||!pointById.has(id))return;if(action==='hidden'){await setUninterested(id,!uninterested.has(id));return;}if(uninterested.has(id))await setUninterested(id,false);if(action==='favorite'){toggleFavorite(id);renderHiddenTargets();return;}if(action==='visited'){if(!visited.has(id)){await complete(id);return;}if(!window.confirm((typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Besucht-Tag entfernen?')))return;visited.delete(id);save();renderRides();renderHiddenTargets();if(route||nav)await replan();else renderRoute();renderPins();}}

function nearbyShowChoices(ride){const choices=showListEntries('nearby').map(x=>x.ride);if(ride?.category==='show'&&!choices.some(r=>r.id===ride.id))choices.unshift(ride);return choices;}
function switchNearbyShow(step){const sheet=$('map-object-sheet'),ride=pointById.get(sheet.dataset.rideId),choices=nearbyShowChoices(ride),index=choices.findIndex(r=>r.id===ride?.id),next=choices[index+step];if(next)openMapObjectSheet(next.id);}
$('map-object-sheet').addEventListener('surfacechange',renderMapObjectSheet);
$('map-object-expanded').addEventListener('click',e=>{const photo=e.target.closest('[data-photo-index]');if(photo){openObjectPhoto(Number(photo.dataset.photoIndex),$('map-object-sheet').dataset.rideId);return;}const b=e.target.closest('[data-nearby-show-step]');if(b){switchNearbyShow(Number(b.dataset.nearbyShowStep));return;}if(e.target.closest('[data-open-show-list]')){showListMode='all';renderShowList();$('shows-dialog').showModal();DisneySurfaces.setDetent($('shows-dialog'),'fullscreen',window);}});
let nearbyShowSwipe=null;
$('map-object-sheet').addEventListener('touchstart',e=>{const sheet=$('map-object-sheet'),ride=pointById.get(sheet.dataset.rideId);nearbyShowSwipe=sheet.classList.contains('surface-fullscreen')&&ride?.category==='show'&&e.touches.length===1&&e.touches[0].clientX>32&&!e.target.closest('.object-photo-strip,input,button')?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
$('map-object-sheet').addEventListener('touchend',e=>{const start=nearbyShowSwipe;nearbyShowSwipe=null;if(!start||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>=65&&Math.abs(dy)<Math.abs(dx)*.5)switchNearbyShow(dx<0?1:-1);},{passive:true});
$('map-object-sheet').addEventListener('touchcancel',()=>{nearbyShowSwipe=null;},{passive:true});

async function handleGPSPosition(result){const now=Date.now(),c=result.coords,at=result.timestamp;if(!c||!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||!Number.isFinite(c.accuracy)||c.accuracy<0||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||!Number.isFinite(at)||at<lastFix||now-at>20000||at-now>5000)return;const previous=position;position={latlng:[c.latitude,c.longitude],accuracy:c.accuracy};lastFix=at;updateParkProximity(position.latlng);if(tooFarFromPark()){updateUser();$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Du bist mehr als 10 km vom Disneyland entfernt. Wähle jetzt deine Favoriten.');$('gps-chip').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Mehr als 10 km entfernt · Favoriten auswählen');gpsWantNav=false;return;}if(Number.isFinite(c.heading)&&(c.speed||0)>.5){heading=c.heading;headingAt=Date.now();}else if(previous&&RouteCore.distance(previous.latlng,position.latlng)>Math.max(6,c.accuracy/2)&&Date.now()-headingAt>5000){heading=bearing(previous.latlng,position.latlng);headingAt=Date.now();}updateUser();const snap=router.snap(position.latlng);if(snap.distance>90||!insidePark(position.latlng)){$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Du bist außerhalb der Parks. Routenplanung bleibt am gewählten Start.');$('gps-chip').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Live-GPS: außerhalb der Parks');gpsWantNav=false;if(nav){$('nav-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Außerhalb der Parks · Navigation pausiert.');}return;}if(c.accuracy>80){$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`GPS ungenau (± ${Math.round(c.accuracy)} m). Warte auf ein genaueres Signal.`);$('gps-chip').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`GPS ungenau · ± ${Math.round(c.accuracy)} m`);renderNav();return;}origin=position.latlng;originLabel='Live-Standort';updateStart();if(route)renderLines();$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`Live-GPS · Genauigkeit ± ${Math.round(c.accuracy)} m`);$('gps').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('◎ Live-Standort aktiv');if(following&&(nav||headingUp)&&!interactionPaused())map.setView(position.latlng,Math.max(17,map.getZoom()),{animate:false});if(route&&!planning&&!interactionPaused()&&Date.now()-rerouteAt>6000&&(!routeOrigin||RouteCore.distance(routeOrigin,origin)>18)){rerouteAt=Date.now();await replan();}renderNav();if(gpsWantNav){gpsWantNav=false;if(!routeOrigin||RouteCore.distance(routeOrigin,origin)>15)await replan();enterNav();}}
function refreshGPSFix(){if(!navigator.geolocation)return;$('gps-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Standort wird neu bestimmt …');navigator.geolocation.getCurrentPosition(handleGPSPosition,()=>toast('Kein neuer GPS-Fix verfügbar. Bitte kurz unter freiem Himmel erneut versuchen.'),{enableHighAccuracy:true,maximumAge:0,timeout:15000});}

function renderGPSFreshness(){if(!position||watch===null)return;const age=Math.max(0,Date.now()-lastFix),fresh=age<20000;if(!fresh&&!tooFarFromPark())$('gps-chip').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`Letzter Standort · GPS seit ${Math.floor(age/1000)} Sek. nicht aktualisiert`);userMarker?.getElement()?.classList.toggle('gps-stale',!fresh);if(typeof syncThreeView==='function')syncThreeView();}
setInterval(()=>{if(!document.hidden)renderGPSFreshness();},10000);

window.addEventListener('disneylanguagechange',()=>{
 if(!data)return;
 // Keep route, sheet detents, typed fields, selections and scroll positions intact.
 const scrollers=[document.querySelector('.panel'),$('map-object-sheet').querySelector('.sheet-scroll')||$('map-object-sheet'),$('object-content'),$('wait-history-content')].filter(Boolean),positions=scrollers.map(el=>[el,el.scrollTop]);
 renderRides();renderRoute();renderPins();renderNav();renderObjectInfo();renderMapObjectSheet();renderQueueCheckin();renderShowList();renderPlaylist();renderWaitHistoryDialog();renderHiddenTargets();updateStart();renderAppVersion();renderWaitStatus();renderNearbyShows();
 if($('facilities-dialog').open)renderFacilities();
 if(!$('setup-favorites-step').hidden)renderSetupFavorites();
 DisneyI18n.apply(document);for(const [el,top] of positions)el.scrollTop=top;
 for(const sheet of document.querySelectorAll('.ios-sheet,.navigation')){const handle=sheet.querySelector('.ios-sheet-handle,.nav-resize');if(handle){const state=sheet.dataset.sheetState||'normal',labels={minimum:'Minimum',normal:'Normal',large:'Größer',fullscreen:'Vollbild'};handle.setAttribute('aria-label',DisneyI18n.text(`Sheet: ${labels[state]}. Zum Ändern ziehen oder tippen.`));}}
 if(typeof syncPush==='function')syncPush(true);
});
