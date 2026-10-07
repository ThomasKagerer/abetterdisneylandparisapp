/* Runs before app dependencies; a failed download must leave a usable retry. */
(function(root){'use strict';
 const screen=document.getElementById('startup-screen'),spinner=document.getElementById('startup-spinner'),label=document.getElementById('startup-status'),retry=document.getElementById('startup-retry'),bar=document.getElementById('startup-progress'),detail=document.getElementById('startup-download');
 let done=false,criticalFailure=false,timer,jokes;
 const translate=s=>typeof DisneyI18n==='undefined'?s:DisneyI18n.text(s);
 const messages=['Donald wird heruntergeladen …','Mickey sucht seine Handschuhe …','Die sieben Zwerge zählen die Datenpakete …','Goofy sortiert die Achterbahnen …','Tinker Bell streut etwas Feenstaub …','Die Teetassen drehen eine Proberunde …'];
 function heartbeat(){clearTimeout(timer);timer=setTimeout(fail,60000);}
 function stopJokes(){clearInterval(jokes);jokes=null;}
 function status(message){if(done||criticalFailure)return;stopJokes();label.textContent=translate(message);heartbeat();}
 function fail(error){if(done)return;clearTimeout(timer);stopJokes();spinner.hidden=true;screen.setAttribute('aria-busy','false');label.textContent=translate(error?.name==='StartupDownloadError'?error.message:'Die App konnte nicht gestartet werden. Bitte erneut versuchen.');retry.textContent=translate('Erneut versuchen');retry.hidden=false;}
 function finish(){if(criticalFailure)return;done=true;clearTimeout(timer);stopJokes();screen.setAttribute('aria-busy','false');screen.hidden=true;for(const element of document.querySelectorAll('[data-startup-inert]'))element.removeAttribute('inert');}
 function progress(loaded,total,complete=false){if(done||criticalFailure)return;heartbeat();bar.hidden=false;detail.hidden=false;const percent=total>0?Math.min(complete?100:99,Math.floor(loaded/total*100)):null;if(percent===null)bar.removeAttribute('value');else bar.value=percent;detail.textContent=translate('Kartendaten')+' · '+(percent===null?(loaded/1048576).toFixed(1)+' MB':percent+' %');}
 async function loadJSON(url,total){
  const controller=new AbortController();let idle,reader;
  const touch=()=>{clearTimeout(idle);idle=setTimeout(()=>controller.abort(),45000);heartbeat();};
  let joke=0;status(messages[0]);jokes=setInterval(()=>{if(!done&&!criticalFailure)label.textContent=translate(messages[++joke%messages.length]);},4000);progress(0,total);touch();
  try{
   const response=await fetch(url,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Kartendaten nicht verfügbar.');touch();
   if(!response.body?.getReader){const data=await response.json();progress(total,total,true);return data;}
   reader=response.body.getReader();const decoder=new TextDecoder(),parts=[];let loaded=0;
   while(true){const chunk=await reader.read();if(chunk.done)break;loaded+=chunk.value.byteLength;parts.push(decoder.decode(chunk.value,{stream:true}));touch();progress(loaded,total);}
   parts.push(decoder.decode());const data=JSON.parse(parts.join(''));progress(loaded,loaded,true);return data;
  }catch(error){if(controller.signal.aborted){const interrupted=Error('Der Download ist ins Stocken geraten. Bitte erneut versuchen.');interrupted.name='StartupDownloadError';throw interrupted;}throw error;
  }finally{clearTimeout(idle);stopJokes();reader?.releaseLock();}
 }
 heartbeat();
 root.addEventListener('error',event=>{if(done)return;const source=event.target;if(source?.tagName==='SCRIPT'){
  // Decorative 3D modules may fail independently; showMap exposes their retry.
  if(/\/(?:map-3d|park-models|map-diagnostics)\.js(?:\?|$)/.test(source.src))return;
  criticalFailure=true;fail();
 }else if(event.filename&&/\/app\.js(?:\?|$)/.test(event.filename)){criticalFailure=true;fail();}},true);
 retry.addEventListener('click',()=>{retry.disabled=true;const url=new URL(root.location.href);url.searchParams.set('_update',Date.now());root.location.replace(url.href);});
 root.DisneyStartup={status,progress,loadJSON,fail,finish};
})(window);
