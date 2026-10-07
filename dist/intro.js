/* Existing Home Screen installs keep opening the app after its move. */
(function(){'use strict';
 if(navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches){location.replace('/App/'+location.search);return;}
 const language=document.getElementById('intro-language');
 function metadata(){
  language.value=DisneyI18n.language();
  document.title=DisneyI18n.text('a better Disneyland Paris App – 3D-Karte, Wartezeiten und Routen');
  document.querySelector('meta[name=description]').content=DisneyI18n.text('Plane deinen Tag in Disneyland Paris: Favoriten, interaktive 3D-Parkkarte, Live-Wartezeiten, Showzeiten und Fußwege. Kostenlos im Browser, ohne Anmeldung.');
  document.querySelector('meta[property="og:title"]').content=DisneyI18n.text('a better Disneyland Paris App – dein Tag in Disneyland Paris');
  document.querySelector('meta[property="og:description"]').content=DisneyI18n.text('Favoriten auswählen, Wartezeiten im Blick behalten und den Weg zum nächsten Erlebnis finden. Direkt im Browser, ohne Anmeldung.');
  document.querySelector('meta[property="og:locale"]').content=({en:'en_GB',de:'de_DE',fr:'fr_FR',it:'it_IT',es:'es_ES','zh-Hans':'zh_CN',ja:'ja_JP',ko:'ko_KR',ar:'ar_AR'})[language.value];
 }
 metadata();window.addEventListener('DOMContentLoaded',metadata);window.addEventListener('disneylanguagechange',metadata);

 if('IntersectionObserver' in window&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}},{threshold:.08});
  document.documentElement.classList.add('reveal-ready');
  document.querySelectorAll('.feature-card').forEach(card=>observer.observe(card));
 }

})();
