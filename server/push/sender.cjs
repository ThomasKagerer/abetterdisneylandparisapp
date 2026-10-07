'use strict';
const fs=require('node:fs'),path=require('node:path'),webpush=require('web-push'),{candidates,updateNotice}=require('./decisions.cjs'),I=require('./localize.cjs');
const dir=process.env.DISNEY_PUSH_DIR||__dirname,app=process.env.DISNEY_APP_DIR||'/mnt/backup/webdav/files/.internal/Disney',keys=JSON.parse(fs.readFileSync(path.join(dir,'vapid.json')));
webpush.setVapidDetails('https://weletapi.com',keys.publicKey,keys.privateKey);
const read=(file)=>{try{return JSON.parse(fs.readFileSync(file));}catch{return null;}},url=process.env.DISNEY_APP_URL||'/files/.internal/Disney/';
async function send(state,item){await webpush.sendNotification(state.subscription,JSON.stringify({...item,language:I.resolve(state.language),url,tag:item.key,contextAt:state.context?.at||null}),{TTL:Math.max(1,Math.min(item.kind==='update'?86400:300,Math.floor((item.expires-Date.now())/1000))),urgency:item.kind==='update'?'normal':'high',timeout:10000});}
(async()=>{
 if(process.argv[2]==='--test'){const file=process.argv[3];if(path.dirname(file)!==path.join(dir,'subscriptions'))throw Error('path');const state=read(file);await send(state,{key:'disney-test',kind:'test',title:I.text('Disney · Push ist bereit',state.language),body:I.text('Shows und kurze Wartezeiten können dich jetzt auch bei geschlossener App erreichen.',state.language),expires:Date.now()+60000});return;}
 let input='';for await(const chunk of process.stdin)input+=chunk;const source=JSON.parse(input),data=read(app+'/park-data.json'),lib=require(app+'/wait-times.js'),waits=new Map(),shows=new Map();
 for(const p of source.waits.parks||[])for(const r of p.rides||[])waits.set(`${p.id}:${r.id}`,{...r,stale:!!p.stale});
 if(!source.shows.stale&&Date.now()-source.shows.fetchedAt*1000<=300000)for(const s of source.shows.shows||[])shows.set(s.id,s);
 const build=Number(fs.readFileSync(app+'/index.html','utf8').match(/app\.js\?v=(\d+)/)?.[1]);
 let queued=0,failed=0;
 for(const file of fs.readdirSync(dir+'/subscriptions').filter(f=>/^[a-f0-9]{64}\.json$/.test(f))){
  const subpath=dir+'/subscriptions/'+file,state=read(subpath);if(!state||!source.activeUsers.includes(state.user))continue;
  const historypath=dir+'/subscriptions/'+file.replace('.json','.sent.json'),history=read(historypath)||{sent:{},lastAt:0},now=Date.now();
  const update=updateNotice(state,build,now),chosen=update&&!history.sent[update.key]?update:now-history.lastAt>=15*60000?candidates(state,data,waits,shows,now,lib).find(x=>!history.sent[x.key]):null;if(!chosen)continue;
  try{await send(state,chosen);history.sent[chosen.key]=now;if(chosen.kind!=='update')history.lastAt=now;history.sent=Object.fromEntries(Object.entries(history.sent).filter(([k,t])=>k===`update:${build}`||now-t<3*86400000));const tmp=historypath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(history),{mode:0o600});fs.renameSync(tmp,historypath);queued++;}
  catch(e){failed++;if([404,410].includes(e.statusCode)){const current=read(subpath);if(current?.subscription?.keys?.p256dh===state.subscription.keys.p256dh)fs.unlinkSync(subpath);}}
 }
 console.log(JSON.stringify({queued,failed}));
})().catch(()=>{console.error('Disney push failed');process.exitCode=1;});
