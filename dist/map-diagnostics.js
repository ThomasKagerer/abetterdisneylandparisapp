/* Technical 3D diagnostics only: no coordinates, routes, ride IDs, stack traces or account data. */
(function(root){'use strict';
const NAMES=new Set(['open','close','attempt','library-ready','scene-ready','map-created','first-frame','source-ready','loading-move','map-load','ready','context-lost','recovering','failed','renderer-error','mesh-ready','mesh-error','roof-texture-ready','roof-texture-error','signs-ready','signs-error','roof-lettering-ready','roof-lettering-error','view-error','manual','previous-interrupted']);
const MODEL_KEY='disney:diagnostic-model',MODEL_FAILURES=new Set(['context-lost','failed','previous-interrupted']);
const NUMBERS=['attempt','elapsedMs','frames','moves','sourceUpdates','pixelRatio','trees','features','vertices','bufferBytes','width','height','drawingWidth','drawingHeight','maxTextureSize','maxRenderbufferSize','zoom','pitch','httpStatus'];
const FLAGS=['loaded','styleLoaded','sourceLoaded','contextLost','visible','roofs'];
function clean(value){return String(value||'').replace(/(?:https?:\/\/|file:\/\/|blob:)[^\s]+/gi,'[url]').replace(/[\w.+-]+@[\w.-]+/g,'[email]').replace(/-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+/g,'[coordinates]').replace(/-?\d{1,3}\.\d{3,}/g,'[number]').replace(/[a-f0-9]{24,}/gi,'[token]').replace(/[\x00-\x1f<>]/g,' ').slice(0,240);}
function safeEvent(input,atMs){const e={name:NAMES.has(input?.name)?input.name:'renderer-error',atMs:Math.max(0,Math.round(atMs))};for(const k of NUMBERS)if(Number.isFinite(input?.[k]))e[k]=Math.max(-1,Math.min(1e9,input[k]));for(const k of FLAGS)if(typeof input?.[k]==='boolean')e[k]=input[k];for(const k of ['message','errorName','code','vendor','renderer'])if(typeof input?.[k]==='string')e[k]=clean(input[k]);if(['park','navigation','accuracy'].includes(input?.source))e.source=input.source;return e;}
function environment(env){const ua=env.navigator?.userAgent||'',browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/CriOS\//.test(ua)?'Chrome iOS':/Chrome\//.test(ua)?'Chrome':(/Safari\//.test(ua)||/AppleWebKit/.test(ua)&&/iPhone|iPad|iPod/.test(ua))?'Safari':'Other',version=ua.match(/(?:Edg|Firefox|CriOS|Chrome|Version)\/(\d+(?:\.\d+)?)/)?.[1]||'',platform=/iPhone|iPad|iPod/.test(ua)||/Macintosh/.test(ua)&&env.navigator?.maxTouchPoints>1?'iOS':/Android/.test(ua)?'Android':/Macintosh/.test(ua)?'macOS':/Windows/.test(ua)?'Windows':'Other';const osVersion=(ua.match(/(?:CPU(?: iPhone)? OS|Android) (\d+(?:[._]\d+){0,2})/)?.[1]||'').replace(/_/g,'.');return {browser,version,platform,osVersion,pixelRatio:Math.min(Number(env.devicePixelRatio)||1,10),width:Math.min(env.innerWidth||0,10000),height:Math.min(env.innerHeight||0,10000),standalone:!!(env.navigator?.standalone||env.matchMedia?.('(display-mode: standalone)').matches)};}
function modelName(value){const text=clean(value).slice(0,64);return /^[A-Za-z][A-Za-z0-9 ()+.,_-]{1,63}$/.test(text)?text:'';}
const modelPrompts=new WeakMap();
function promptModel(doc){
 const dialog=doc.getElementById('diagnostic-model-dialog'),input=doc.getElementById('diagnostic-model'),form=doc.getElementById('diagnostic-model-form'),skip=doc.getElementById('diagnostic-model-skip');
 if(!dialog||!input||!form||!skip)return Promise.resolve('');
 if(modelPrompts.has(dialog))return modelPrompts.get(dialog);
 const answer=new Promise(resolve=>{
  let finished=false;
  const cleanup=()=>{form.removeEventListener('submit',submit);skip.removeEventListener('click',omit);dialog.removeEventListener('close',omit);input.removeEventListener('input',clear);modelPrompts.delete(dialog);};
  const finish=value=>{if(finished)return;finished=true;cleanup();if(dialog.open)dialog.close();resolve(value);};
  const omit=()=>finish(''),clear=()=>input.setCustomValidity('');
  const submit=e=>{e.preventDefault();const model=modelName(input.value.trim());if(input.value.trim()&&!model){input.setCustomValidity(typeof DisneyI18n==='undefined'?'Bitte prüfe das iPhone-Modell.':DisneyI18n.text('Bitte prüfe das iPhone-Modell.'));input.reportValidity();return;}finish(model);};
  form.addEventListener('submit',submit);skip.addEventListener('click',omit);dialog.addEventListener('close',omit);input.addEventListener('input',clear);input.value='';clear();
  try{dialog.showModal();}catch{finish('');}
 });
 modelPrompts.set(dialog,answer);answer.then(()=>modelPrompts.delete(dialog));return answer;
}
function create(options={},env=root){
 let storage;try{storage=env.localStorage;}catch{}const started=Date.now(),events=[],key='disney:3d-diagnostic-pending',checkpoint='disney:3d-diagnostic-checkpoint';let pending=null,token=null,busy=false,timer=null,sent=0,autoModel='',modelAsked=false,modelRequest=null;
 const status=(state,id)=>{try{options.onStatus?.(state,id);}catch{}};
 const savedModel=()=>{try{return modelName(options.getModel?.())||modelName(storage?.getItem(MODEL_KEY));}catch{return '';}};
 const device=()=>{const saved=savedModel()||localModel,model=saved||autoModel;return {...environment(env),...(model?{model,modelSource:saved?'manual':'browser'}:{})};};
 function askModel(reason){
  if(modelRequest)return modelRequest;
  if(modelAsked||savedModel()||autoModel||!MODEL_FAILURES.has(reason)||environment(env).platform!=='iOS'||!options.onModelNeeded)return Promise.resolve();
  modelAsked=true;
  modelRequest=Promise.resolve().then(()=>options.onModelNeeded()).then(value=>{const model=modelName(value);if(model){localModel=model;try{storage?.setItem(MODEL_KEY,model);}catch{}}}).catch(()=>{});
  return modelRequest;
 }
 let localModel='';

 const packet=reason=>{const report={build:options.build,reason,environment:device(),events:events.slice(-32)};while(report.events.length>1&&new TextEncoder().encode(JSON.stringify(report)).byteLength>14000)report.events.shift();return report;};
 try{const android=(env.navigator?.userAgent||'').match(/Android[^;)]*;\s*([^;)]+)/)?.[1]?.replace(/\s+Build\/.*/,'');if(android&&android!=='K')autoModel=modelName(android);if(env.navigator?.userAgentData?.getHighEntropyValues)Promise.resolve(env.navigator.userAgentData.getHighEntropyValues(['model'])).then(x=>{if(x.model)autoModel=modelName(x.model);}).catch(()=>{});}catch{}
 const persist=()=>{try{if(pending)storage?.setItem(key,JSON.stringify(pending));else storage?.removeItem(key);}catch{}};
 const remember=()=>{try{storage?.setItem(checkpoint,JSON.stringify(packet('previous-interrupted')));}catch{}};
 async function flush(){
  if(busy||!pending||env.navigator?.onLine===false||sent>=10)return false;
  busy=true;let report=null,timeout=null;
  try{
   await askModel(pending.reason);
   if(!pending||env.navigator?.onLine===false)return false;
   status('sending');report=pending;report.environment=device();
   const controller=new AbortController();timeout=env.setTimeout(()=>controller.abort(),8000);
   if(!token){const r=await env.fetch('index.php?diagnostics=1',{cache:'no-store',redirect:'error',signal:controller.signal});if(!r.ok)throw Error('auth');const config=await r.json();if(!/^[a-f0-9]{64}$/.test(config.csrf||''))throw Error('auth');token=config.csrf;}
   const response=await env.fetch('index.php?diagnostics=1',{method:'POST',headers:{'Content-Type':'application/json','X-Disney-CSRF':token},body:JSON.stringify(report),cache:'no-store',redirect:'error',keepalive:true,signal:controller.signal});if(response.status===403)token=null;if(!response.ok)throw Error('send');const result=await response.json();if(!/^[a-f0-9]{12}$/.test(result.id||''))throw Error('response');sent++;if(pending===report){pending=null;persist();}status('sent',result.id);return true;
  }catch{persist();status('pending');return false;}finally{if(timeout!==null)env.clearTimeout(timeout);busy=false;if(pending&&pending!==report&&sent<10)schedule();}
 }

 function schedule(){if(timer!==null)return;timer=env.setTimeout(()=>{timer=null;flush();},700);}
 function record(input){if(!NAMES.has(input?.name))return;events.push(safeEvent(input,Date.now()-started));if(events.length>32)events.shift();if(input.name==='close'){try{storage?.removeItem(checkpoint);}catch{}}else remember();if(['context-lost','failed','renderer-error','mesh-error','roof-texture-error','signs-error','roof-lettering-error','view-error'].includes(input.name)){pending=packet(input.name);persist();askModel(input.name);schedule();}}
 function send(){events.push(safeEvent({name:'manual'},Date.now()-started));pending=packet('manual');persist();return flush();}
 try{const old=JSON.parse(storage?.getItem(key)||'null');if(old&&Number.isInteger(old.build)&&Array.isArray(old.events))pending={build:old.build,reason:NAMES.has(old.reason)?old.reason:'failed',environment:environment(env),events:old.events.slice(-32).map(e=>safeEvent(e,e.atMs||0))};const interrupted=JSON.parse(storage?.getItem(checkpoint)||'null');if(!pending&&interrupted&&Number.isInteger(interrupted.build)&&Array.isArray(interrupted.events))pending={build:interrupted.build,reason:'previous-interrupted',environment:environment(env),events:interrupted.events.slice(-31).map(e=>safeEvent(e,e.atMs||0)).concat(safeEvent({name:'previous-interrupted'},0))};if(pending){persist();askModel(pending.reason);schedule();}}catch{}
 env.addEventListener?.('online',flush);env.addEventListener?.('pagehide',()=>{try{storage?.removeItem(checkpoint);}catch{}if(pending)flush();});return {record,send,flush};
}
root.DisneyDiagnostics={create,clean,safeEvent,environment,modelName,promptModel};if(typeof module!=='undefined')module.exports=root.DisneyDiagnostics;
})(typeof globalThis!=='undefined'?globalThis:this);
