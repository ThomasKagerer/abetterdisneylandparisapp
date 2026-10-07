/* Reviewed on-device localization. No text, search, GPS or profile is sent to a translation service. */
(function(root){'use strict';
const messages=root.DisneyMessages||(typeof module!=='undefined'?require('./i18n-messages.js'):[]),official=root.DisneyOfficialNames||(typeof module!=='undefined'?require('./official-names.js'):{});
const languages=[['de','Deutsch','de-DE'],['en','English','en-GB'],['fr','Français','fr-FR'],['it','Italiano','it-IT'],['es','Español','es-ES'],['zh-Hans','简体中文','zh-CN'],['ja','日本語','ja-JP'],['ko','한국어','ko-KR'],['ar','العربية','ar-u-hc-h23']];
const valid=new Set(languages.map(x=>x[0])),key='disney:language',cache=new Map(),reverse=new Map(),nodeSources=new WeakMap();let current='en',storage=null;
const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('de-DE');
const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const exact=new Map(),patterns=[];
for(const [source,values] of messages){const normalized=norm(source);if(/\{\d+\}/.test(source)){let i=0;const chunks=source.split(/\{\d+\}/);if(chunks.join('').replace(/[^\p{L}]/gu,'').length<2)continue;patterns.push({source,values,regex:new RegExp('^'+chunks.map(escapeRegex).join('(.*?)')+'$','iu'),specificity:chunks.join('').length});}else exact.set(normalized,{source,values});}
patterns.sort((a,b)=>b.specificity-a.specificity);
function resolve(value){const raw=String(value||'').replace('_','-');if(/^zh(?:-|$)/i.test(raw))return 'zh-Hans';const base=raw.split('-')[0].toLowerCase();return valid.has(raw)?raw:valid.has(base)?base:'en';}
function language(){return current;}
function locale(value=current){return languages.find(x=>x[0]===resolve(value))[2];}
const aliasesText={'Ausgeblendete Ziele schließen':'Fenster schließen','Karteneinstellungen schließen':'Fenster schließen','Objektansicht schließen':'Zurück','Objektinfos schließen':'Zurück','Playlist schließen':'Fenster schließen','Wartezeit-Anzeige schließen':'Fenster schließen','Wartezeit-Statistik schließen':'Zurück','No rides selected':'Keine Rides ausgewählt','Route unavailable':'Route nicht verfügbar','Wrong history day':'Statistik momentan nicht verfügbar','History unavailable':'Statistik momentan nicht verfügbar','Unknown Ride ID':'Ziel nicht gefunden'};
function text(value,lang=current,depth=0){
 const source=String(value??'');lang=resolve(lang);if(lang==='de'||!source.trim()||depth>6)return source;
 const cacheKey=lang+'\0'+source;if(cache.has(cacheKey))return cache.get(cacheKey);
 const lead=source.match(/^\s*/)[0],tail=source.match(/\s*$/)[0],trimmed=source.trim();let result=null;
 const entry=exact.get(norm(trimmed));if(entry)result=entry.values[lang];else if(aliasesText[trimmed])result=text(aliasesText[trimmed],lang,depth+1);
 if(result===null&&trimmed.includes('\n\n'))result=trimmed.split(/\n\s*\n/).map(x=>text(x,lang,depth+1)).join('\n\n');
 if(result===null)for(const p of patterns){const m=p.regex.exec(trimmed);if(m){if(!p.source.includes(' · ')&&m.slice(1).some(part=>part.includes(' · ')))continue;result=p.values[lang].replace(/\{(\d+)\}/g,(_,i)=>text(m[Number(i)+1]??'',lang,depth+1));break;}}
 if(result===null){
  const icon=trimmed.match(/^([✓✕▶⏭◎☷♫★‹›Ø+·]\s*)(.+)$/s);
  if(icon){const translated=text(icon[2],lang,depth+1);if(translated!==icon[2])result=(lang==='ar'&&icon[1].includes('‹')?icon[1].replace('‹','›'):icon[1])+translated;}
 }
 if(result===null&&trimmed.endsWith(' ·'))result=text(trimmed.slice(0,-2).trimEnd(),lang,depth+1)+' ·';
 if(result===null&&trimmed.includes(', '))result=trimmed.split(', ').map(x=>text(x,lang,depth+1)).join(', ');
 if(result===null&&trimmed.includes(' · '))result=trimmed.split(' · ').map(x=>text(x,lang,depth+1)).join(' · ');
 if(result===null){const prefix=trimmed.match(/^([^:]+:)\s+(.+)$/s);if(prefix&&exact.has(norm(prefix[1].replace(/:$/,''))))result=text(prefix[1].replace(/:$/,''),lang,depth+1)+': '+text(prefix[2],lang,depth+1);}
 if(result===null&&/\.\s+[A-ZÄÖÜ]/.test(trimmed))result=trimmed.split(/(?<=\.)\s+(?=[A-ZÄÖÜ])/).map(x=>text(x,lang,depth+1)).join(' ');
 if(result===null&&trimmed.endsWith('.')){const plain=trimmed.slice(0,-1),translated=text(plain,lang,depth+1);if(translated!==plain)result=translated+'.';}
 if(result===null)result=trimmed;
 const output=lead+result+tail;if(cache.size>5000)cache.clear();cache.set(cacheKey,output);if(output!==source){if(reverse.size>10000)reverse.clear();reverse.set(output,source);}return output;
}
const cuisineKeys={american:'Amerikanische Küche',french:'Französische Küche',italian:'Italienische Küche',pizza:'Italienische Küche · Pizza',pasta:'Italienische Küche · Pasta',asian:'Asiatische Küche',oriental:'Orientalische Küche',german:'Deutsche Küche',caribbean:'Karibische Küche',indian:'Indische Küche',mexican:'Mexikanische Küche','tex-mex':'Tex-Mex · Mexikanische Küche',african:'Afrikanische Küche',barbecue:'Barbecue · Grillgerichte'};
function cuisine(code,original,lang=current){return resolve(lang)==='de'?original:text(cuisineKeys[code]||original,lang);}
function number(value,options={}){return Number(value).toLocaleString(locale(),options);}
const decode=s=>s.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[a-f\d]+);/gi,(all,k)=>k[0]==='#'?String.fromCodePoint(k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'})[k.toLowerCase()]||all);
const encode=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function html(markup,lang=current){if(resolve(lang)==='de')return String(markup??'');return String(markup??'').replace(/<[^>]*>|[^<]+/g,token=>token[0]==='<'?token.replace(/\b(aria-label|aria-description|title|placeholder|alt)="([^"]*)"/g,(_,attr,value)=>attr+'="'+encode(text(decode(value),lang))+'"'):encode(text(decode(token),lang)));}
function name(ride,lang=current){const row=official[ride?.id];if(!row)return text(ride?.originalName||ride?.name||'',lang);return row[resolve(lang)]?.name||row.fallback;}
function aliases(id){const row=official[id];return row?[row.original,row.fallback,...['de','fr','it','es'].map(l=>row[l]?.name||'')].join(' '):'';}
function localizePoints(points){for(const point of points){if((!official[point.id]&&point.serviceType!=='water'&&!point.id.startsWith('wc-'))||Object.hasOwn(point,'originalName'))continue;Object.defineProperty(point,'originalName',{value:point.name,enumerable:true});Object.defineProperty(point,'name',{get:()=>name(point),enumerable:true,configurable:true});}}
function sourceUrl(id,fallback){return official[id]?.[current]?.url||fallback;}
function apply(doc=root.document){if(!doc)return;doc.documentElement.lang=current;doc.documentElement.dir=current==='ar'?'rtl':'ltr';const manifest=doc.querySelector('link[rel=manifest]');if(manifest)manifest.setAttribute('href',current==='en'?'manifest.webmanifest':`manifest-${current}.webmanifest`);const description=doc.querySelector('meta[name=description]');if(description&&!description.hasAttribute('data-i18n-ignore'))description.setAttribute('content',text('Deine Ride-Favoriten. Ein kurzer Weg durch Disneyland Paris.'));
 const visit=node=>{if(node.nodeType===3){if(!node.nodeValue?.trim())return;let saved=nodeSources.get(node);if(!saved||saved.output!==node.nodeValue)saved={source:reverse.get(node.nodeValue)||node.nodeValue};const output=text(saved.source);if(node.nodeValue!==output)node.nodeValue=output;saved.output=output;nodeSources.set(node,saved);return;}
  if(node.nodeType!==1||['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(node.tagName))return;
  for(const attr of ['aria-label','aria-description','title','placeholder','alt'])if(node.hasAttribute(attr)){const token='i18n:'+attr;let sources=nodeSources.get(node)||{};const value=node.getAttribute(attr),saved=sources[token];const source=saved&&saved.output===value?saved.source:reverse.get(value)||value,output=text(source);if(value!==output)node.setAttribute(attr,output);sources[token]={source,output};nodeSources.set(node,sources);}
  if(!node.hasAttribute('data-i18n-ignore'))for(const child of node.childNodes)visit(child);
 };visit(doc.body);
 for(const select of doc.querySelectorAll('[data-language-picker]'))select.value=current;
}
function setLanguage(value,{persist=true,notify=true}={}){current=resolve(value);cache.clear();if(persist)try{storage?.setItem(key,current);}catch{}if(root.document)apply();syncWorker();if(notify&&root.dispatchEvent&&root.CustomEvent)root.dispatchEvent(new root.CustomEvent('disneylanguagechange',{detail:{language:current}}));return current;}
function syncWorker(){const worker=root.navigator?.serviceWorker;if(!worker)return;const send=()=>worker.controller?.postMessage({type:'disney-language',language:current});send();worker.ready?.then(reg=>reg.active?.postMessage({type:'disney-language',language:current})).catch(()=>{});}
function preferredLanguage(navigator=root.navigator){
 const preferences=navigator?.languages?.length?navigator.languages:[navigator?.language];
 // The primary browser language wins; an unsupported language falls back to English.
 return resolve(preferences[0]);
}
function init(doc=root.document,store=root.localStorage){storage=store;let saved=null;try{saved=store?.getItem(key);}catch{}current=valid.has(saved)?saved:preferredLanguage();
 for(const select of doc.querySelectorAll('[data-language-picker]')){select.replaceChildren(...languages.map(([code,label])=>{const option=doc.createElement('option');option.value=code;option.lang=code;option.dir=code==='ar'?'rtl':'ltr';option.textContent=label;return option;}));select.setAttribute('data-i18n-ignore','');select.value=current;select.addEventListener('change',()=>setLanguage(select.value));}apply(doc);syncWorker();root.navigator?.serviceWorker?.addEventListener('controllerchange',syncWorker);
}
const api={languages,resolve,preferredLanguage,language,locale,text,html,number,cuisine,name,aliases,sourceUrl,localizePoints,setLanguage,apply,init,messageCount:messages.length};root.DisneyI18n=api;if(typeof module!=='undefined')module.exports=api;
if(typeof document!=='undefined'){try{init(document,root.localStorage);}catch{storage=null;init(document,null);}root.addEventListener('DOMContentLoaded',()=>apply(document));}
})(typeof globalThis!=='undefined'?globalThis:this);
