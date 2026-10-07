/* Runs before app dependencies; a failed download must leave a usable retry. */
(function(root){'use strict';
 const screen=document.getElementById('startup-screen'),spinner=document.getElementById('startup-spinner'),label=document.getElementById('startup-status'),retry=document.getElementById('startup-retry');
 let done=false,criticalFailure=false;
 const translate=s=>typeof DisneyI18n==='undefined'?s:DisneyI18n.text(s);
 function status(message){if(!done)label.textContent=translate(message);}
 function fail(){if(done)return;clearTimeout(timer);spinner.hidden=true;screen.setAttribute('aria-busy','false');status('Die App konnte nicht gestartet werden. Bitte erneut versuchen.');retry.textContent=translate('Erneut versuchen');retry.hidden=false;}
 function finish(){if(criticalFailure)return;done=true;clearTimeout(timer);screen.setAttribute('aria-busy','false');screen.hidden=true;for(const element of document.querySelectorAll('[data-startup-inert]'))element.removeAttribute('inert');}
 const timer=setTimeout(fail,45000);
 root.addEventListener('error',event=>{if(done)return;const source=event.target;if(source?.tagName==='SCRIPT'){
  // Decorative 3D modules may fail independently; showMap exposes their retry.
  if(/\/(?:map-3d|park-models|map-diagnostics)\.js(?:\?|$)/.test(source.src))return;
  criticalFailure=true;fail();
 }else if(event.filename&&/\/app\.js(?:\?|$)/.test(event.filename)){criticalFailure=true;fail();}},true);
 retry.addEventListener('click',()=>{retry.disabled=true;const url=new URL(root.location.href);url.searchParams.set('_update',Date.now());root.location.replace(url.href);});
 root.DisneyStartup={status,fail,finish};
})(window);
