/* Push is opt-in. Send candidate IDs/times, never GPS coordinates or child data. */
let pushSubscription=null,pushConfig=null,pushReady=false,pushSyncBusy=false,pushSyncPending=false,pushSyncAt=0,onboardingLocation=false,onboardingRequested=false,pushRegistration=null,pushEnabling=false,onboardingAutoContinue=false;
const pushPreview=()=>(location.pathname==='/'||location.pathname==='/index.html'||location.pathname==='/App/')&&location.hostname!=='abetterdisneylandparisapp.weletapi.com';
function pushSupported(){return 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;}
function pushStatus(message){$('push-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(message);$('setup-push-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(message);}
async function pushRequest(action,extra={}){const response=await fetch('index.php?push=1',{method:'POST',headers:{'Content-Type':'application/json','X-Disney-CSRF':pushConfig.csrf},body:JSON.stringify({action,language:typeof DisneyI18n==='undefined'?'en':DisneyI18n.language(),appBuild:typeof APP_BUILD==='number'?APP_BUILD:0,subscription:pushSubscription.toJSON(),...extra}),cache:'no-store',redirect:'error'});if(!response.ok)throw Error(response.status===401||response.status===403?(location.hostname==='abetterdisneylandparisapp.weletapi.com'?'Verbindung erneuern: Bitte die App neu laden.':'Bitte erneut bei weletapi anmelden.'):response.status===429?'Bitte kurz warten und erneut versuchen.':'Push-Verbindung momentan nicht verfügbar.');return response.json();}
function renderPushControls(){const on=!!pushSubscription;for(const id of ['enable-push','setup-push']){$(id).textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(on?'✓ Push aktiviert':'Push aktivieren');$(id).disabled=on||pushEnabling||!pushSupported()||pushPreview();}$('disable-push').hidden=!on;$('test-push').hidden=!on;finishSetupIfReady();}
function pushTimeout(promise,ms=12000){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Der Browser antwortet nicht. Bitte erneut versuchen.')),ms))]);}
async function initPush(){try{if(pushPreview()){pushStatus('Push ist in der lokalen Vorschau nicht verbunden.');return;}if(!pushSupported()){pushStatus('iPhone: a better Disneyland Paris App zuerst zum Home-Bildschirm hinzufügen und von dort öffnen.');return;}const r=await pushTimeout(fetch('index.php?push=1',{cache:'no-store',redirect:'error'}),8000);if(!r.ok)throw Error('Push momentan nicht verfügbar.');pushConfig=await r.json();if(!pushConfig.publicKey)throw Error('Push wird noch eingerichtet.');const registration=await pushTimeout(navigator.serviceWorker.ready,8000);pushRegistration=registration;pushSubscription=await registration.pushManager.getSubscription();if(pushSubscription&&Notification.permission==='granted'){await pushRequest('subscribe');pushStatus('Push aktiv · Nähe gilt für deinen letzten Parkbereich bis zu 15 Minuten.');}else{pushSubscription=null;pushStatus(Notification.permission==='denied'?'Push ist in den Geräteeinstellungen gesperrt.':'Aktivieren, um Show-Hinweise und kurze Wartezeiten zu erhalten.');}pushReady=true;}catch(e){pushStatus(e.message);}finally{renderPushControls();}}
async function enablePush(){
 if(pushEnabling)return;
 if(!pushReady||!pushRegistration||!pushConfig?.publicKey){pushStatus('Push wird vorbereitet. Bitte danach erneut auf „Push aktivieren“ tippen.');await initPush();return;}
 if(!pushSupported()){pushStatus('Öffne a better Disneyland Paris App über das Symbol auf dem Home-Bildschirm.');return;}
 pushEnabling=true;pushStatus('Bitte die Push-Freigabe deines Geräts bestätigen …');renderPushControls();
 try{
  const key=Uint8Array.from(atob(pushConfig.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  // Subscribe synchronously inside the click gesture: Safari shows its permission prompt here.
  const subscriptionPromise=pushRegistration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  pushSubscription=await pushTimeout(subscriptionPromise);
  await pushTimeout(pushRequest('subscribe'));
  pushStatus('Push aktiviert. Mit „Test senden“ kannst du die Zustellung prüfen.');await syncPush(true);
 }catch(e){pushSubscription=null;pushStatus(e.name==='NotAllowedError'?'Push nicht erlaubt. In den iPhone-Einstellungen unter Mitteilungen freigeben; Disney als installierte App öffnen.':e.message||'Push konnte nicht aktiviert werden. Bitte erneut versuchen.');}
 finally{pushEnabling=false;renderPushControls();}
}
async function syncPush(force=false){if(pushSyncBusy){if(force)pushSyncPending=true;return;}if(!pushSubscription||!pushConfig||!data||!activeSession||pushSyncBusy||!navigator.onLine||(!force&&Date.now()-pushSyncAt<30000))return;pushSyncBusy=true;try{const candidates=[],active=position&&position.accuracy<=80&&Date.now()-lastFix<45000&&insidePark(position.latlng),start=active?router.snap(position.latlng):null;const next=pointById.get(route?.order.find(id=>id.startsWith('ride-')&&!uninterested.has(id)&&targetAvailable(pointById.get(id))));if(active&&start.distance<=90){const distances=router.tree(start.node).ds;for(const r of data.rides){if(!parkMatches(r)||uninterested.has(r.id)||!targetAvailable(r))continue;const meters=distances[r.node]+(r.offset||0);if(!Number.isFinite(meters))continue;const favorite=favorites.has(r.id)&&!visited.has(r.id)&&!deferred.has(r.id)&&r.id!==next?.id;const extra=next?(distances[r.node]+router.tree(r.node).ds[next.node]-distances[next.node])/72:meters/72;if((r.category==='show'&&!r.approximateArea&&!r.reservedViewing&&meters<=800)||(favorite&&meters<=1200&&extra<=10))candidates.push({id:r.id,meters:Math.round(meters/25)*25,extraWalkingMinutes:Number.isFinite(extra)?Math.max(0,extra):null,favorite});}}await pushRequest('context',{context:{active:!!active,candidates,includeSingleRider:typeof appSettings!=='undefined'&&appSettings.singleRiderAlerts===true}});pushSyncAt=Date.now();}catch(e){pushStatus(e.message);}finally{pushSyncBusy=false;if(pushSyncPending){pushSyncPending=false;syncPush(true);}}}
function updateSetupLocation(){onboardingLocation=!!position&&Date.now()-lastFix<45000;$('setup-location').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(onboardingLocation?'✓ Standort erlaubt':'Standort aktivieren');$('setup-location-status').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(onboardingLocation?'GPS läuft auf deinem Gerät.':onboardingRequested?$('gps-status').textContent:'Für Live-Navigation und Hinweise in deiner Nähe. GPS bleibt im Browser.');if(onboardingLocation){try{localStorage.setItem(`${userKey}:gps-enabled`,'true');}catch{}}finishSetupIfReady();}
function finishSetupIfReady(){const ready=onboardingLocation&&!!pushSubscription&&pushReady&&!pushEnabling;$('setup-done').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(ready?'Los geht’s · Karte öffnen':'Los geht’s · auch ohne Freigaben');if(onboardingAutoContinue&&ready&&!$('setup-dialog').hidden&&!$('setup-permissions-step').hidden){onboardingAutoContinue=false;closeSetup();}}
function isInstalledApp(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}

function openSetup(){const screen=$('setup-dialog');screen.hidden=false;if(typeof screen.showModal==='function'&&!screen.open)screen.showModal();screen.setAttribute('aria-hidden','false');document.body.classList.add('setup-open');}
function closeSetup(){onboardingAutoContinue=false;const screen=$('setup-dialog');if(typeof screen.close==='function')screen.close();screen.removeAttribute('open');screen.hidden=true;screen.setAttribute('aria-hidden','true');document.body.classList.remove('setup-open');try{localStorage.setItem(`${userKey}:setup-v2`,'done');}catch{}homeView('map');}

function setupChildPhase(){$('setup-favorites-step').hidden=true;$('setup-install-step').hidden=true;$('setup-permissions-step').hidden=true;$('setup-child-step').hidden=false;$('setup-child-error').hidden=true;$('setup-child-age').value=appSettings.child?.age??'';$('setup-child-height').value=appSettings.child?.height??'';$('setup-title').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)('Für eure Familie.<br>Für euren Tag.');$('setup-dialog').scrollTop=0;}
function setupPhase(permissions){$('setup-favorites-step').hidden=true;$('setup-child-step').hidden=true;$('setup-install-step').hidden=permissions;$('setup-permissions-step').hidden=!permissions;$('setup-title').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(permissions?'Dein Tag.<br>Deine kurzen Wege.':'a better Disneyland Paris App<br>Bereit für den Park.');if(permissions)initPush();}
let setupFavoriteSelection=null;
function setupBestRides(){return data&&typeof DisneyRatings!=='undefined'?DisneyRatings.ranked(data.rides).filter(ride=>!uninterested.has(ride.id)):[];}
function updateSetupFavoriteCount(){$('setup-favorites-count').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(`${setupFavoriteSelection?.size||0} Favoriten ausgewählt`);}
function renderSetupFavorites(){
 const list=$('setup-favorites-list'),top=list.scrollTop;
 list.innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)(setupBestRides().map(ride=>{
  const rating=DisneyRatings.get(ride),score=rating.score.toLocaleString(typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale(),{minimumFractionDigits:1});
  return `<label class="setup-favorite-row"><input type="checkbox" data-setup-favorite="${esc(ride.id)}" ${setupFavoriteSelection?.has(ride.id)?'checked':''}><span><strong>${esc(ride.name)}</strong><span class="setup-favorite-meta">${esc(ride.park==='Disney Adventure World'?'Adventure World':ride.park)} · ★ ${score} / 5</span>${typeof childBadge==='function'?childBadge(ride):''}</span></label>`;
 }).join(''));
 list.scrollTop=top;updateSetupFavoriteCount();
}
function setupFavoritesPhase(){
 setupFavoriteSelection=new Set(favorites);
 for(const id of ['setup-install-step','setup-child-step','setup-permissions-step'])$(id).hidden=true;
 $('setup-favorites-step').hidden=false;
 $('setup-title').innerHTML=(typeof DisneyI18n==='undefined'?String:DisneyI18n.html)('Deine Lieblingsrides.<br>Dein Tag.');
 renderSetupFavorites();$('setup-dialog').scrollTop=0;
}
$('setup-favorites-list').addEventListener('change',event=>{
 const input=event.target.closest('[data-setup-favorite]');if(!input||!setupFavoriteSelection)return;
 const id=input.dataset.setupFavorite;if(!setupBestRides().some(ride=>ride.id===id))return;
 input.checked?setupFavoriteSelection.add(id):setupFavoriteSelection.delete(id);updateSetupFavoriteCount();
});
$('setup-favorites-save').onclick=()=>{
 const previous=favorites;favorites=new Set(setupFavoriteSelection||favorites);
 if(!save()){favorites=previous;return;}
 renderRides();renderPins();renderRoute();if(route)replan();setupPhase(true);
};
$('setup-favorites-skip').onclick=()=>setupPhase(true);
async function startOnboarding(){let done=false;try{done=localStorage.getItem(`${userKey}:setup-v2`)==='done';}catch{}onboardingAutoContinue=!done;if(!done){if(isInstalledApp())setupChildPhase();else setupPhase(false);openSetup();}else{initPush();}try{const saved=localStorage.getItem(`${userKey}:gps-enabled`)==='true';if(saved&&!pushPreview())activateGPS(false);}catch{}updateSetupLocation();const selected=new URLSearchParams(location.search).get('notice');if(selected&&pointById.has(selected))focusRideOnMap(selected);else if(pendingNoticeId){const id=pendingNoticeId;pendingNoticeId=null;focusRideOnMap(id);}}
$('setup-location').onclick=()=>{onboardingRequested=true;activateGPS(false);updateSetupLocation();};
for(const id of ['enable-push','setup-push'])$(id).onclick=enablePush;
$('setup-done').onclick=()=>{try{localStorage.setItem(`${userKey}:setup-v2`,'done');}catch{}closeSetup();};
$('disable-push').onclick=async()=>{try{await pushRequest('unsubscribe');await pushSubscription.unsubscribe();pushSubscription=null;pushStatus('Push deaktiviert.');renderPushControls();}catch(e){pushStatus(e.message);}};
$('test-push').onclick=async()=>{try{await pushRequest('test');pushStatus('Test an deinen Push-Dienst gesendet.');}catch(e){pushStatus(e.message);}};
$('setup-dialog').addEventListener('cancel',e=>{e.preventDefault();closeSetup();});
setInterval(()=>{if(data&&!document.hidden){syncPush();if(onboardingLocation&&position)updateSetupLocation();}},30000);

$('open-setup').onclick=()=>{onboardingAutoContinue=false;setupPhase(isInstalledApp());updateSetupLocation();openSetup();};

$('setup-browser').onclick=setupChildPhase;
$('setup-install-button').onclick=async()=>{if(installedPrompt){try{await installedPrompt.prompt();const choice=await installedPrompt.userChoice;installedPrompt=null;if(choice.outcome==='accepted')setupChildPhase();}catch{}}else{$('setup-install-instructions').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(/iPad|iPhone|iPod/.test(navigator.userAgent)?'Safari: Teilen → Zum Home-Bildschirm → als Web-App hinzufügen. Danach a better Disneyland Paris App über das neue App-Symbol öffnen.':'Im Browser-Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen. Danach a better Disneyland Paris App über das App-Symbol öffnen.');}};
window.addEventListener('appinstalled',()=>{if(!appReady||$('setup-dialog').hidden)return;if(!$('setup-permissions-step').hidden||!$('setup-favorites-step').hidden||!$('setup-child-step').hidden)return;setupChildPhase();});
