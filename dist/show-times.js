/* Distance calculations and precise location remain in the browser. */
(function(root){'use strict';
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}),parisDay=t=>dayFormatter.format(t);
const START_GRACE=15*60000;
const arrivalLead=ride=>ride?.eventSetting==='indoor'?10:0;
const arrivalDeadline=(start,ride)=>start+(arrivalLead(ride)?-arrivalLead(ride)*60000:START_GRACE);
// Starts remain eligible through +15 minutes, including the Paris midnight boundary.
const currentSlot=(start,now)=>Number.isFinite(start)&&(parisDay(start)===parisDay(now)||(start<=now&&now-start<=START_GRACE));
// null means unknown; only a known schedule can establish that today is finished.
function hasRemainingToday(show,now=Date.now(),fetchedAt=0,ride=null){
 if(!show||!Array.isArray(show.showtimes))return null;
 const day=parisDay(now),valid=show.showtimes.map(t=>({start:Date.parse(t.startTime),end:Date.parse(t.endTime)})).filter(t=>Number.isFinite(t.start)),slots=valid.filter(t=>parisDay(t.start)===day);
 if(show.showtimes.length&&!valid.length)return null;
 if(valid.some(t=>currentSlot(t.start,now)&&arrivalDeadline(t.start,ride)>=now))return true;
 if(!slots.length)return fetchedAt>0&&fetchedAt<=now&&parisDay(fetchedAt)===day?false:null;
 return false;
}

function canAttendToday(show,now=Date.now(),fetchedAt=0,walkingMinutes=0,ride=null){
 const remaining=hasRemainingToday(show,now,fetchedAt,ride);if(remaining!==true)return remaining;
 if(!Number.isFinite(walkingMinutes)||walkingMinutes<0)return false;
 const arriveBy=now+Math.ceil(walkingMinutes)*60000;
 return show.showtimes.some(t=>{const start=Date.parse(t.startTime);return currentSlot(start,now)&&arrivalDeadline(start,ride)>=arriveBy;});
}
// Only the catalogue order uses this window; later shows remain navigable.
function startsSoon(show,now=Date.now(),windowMinutes=30){
 if(!show||show.status==='CLOSED'||!Array.isArray(show.showtimes))return false;
 return show.showtimes.some(t=>{
  const start=Date.parse(t.startTime),end=Date.parse(t.endTime);
  if(!Number.isFinite(start)||parisDay(start)!==parisDay(now))return false;
  if(start>now)return start-now<=windowMinutes*60000;
  return Number.isFinite(end)&&end>start?now<end:now-start<=START_GRACE;
 });
}
function languageLabel(slot){
 const names={en:'Englisch',english:'Englisch',anglais:'Englisch',fr:'Französisch',french:'Französisch',français:'Französisch',de:'Deutsch',german:'Deutsch',deutsch:'Deutsch',es:'Spanisch',spanish:'Spanisch',it:'Italienisch',italian:'Italienisch',nl:'Niederländisch',dutch:'Niederländisch'};
 const raw=slot?.languages??slot?.language??slot?.type,values=Array.isArray(raw)?raw:typeof raw==='string'?raw.split(/[,/;+&]/):[];
 return [...new Set(values.map(x=>{if(typeof x!=='string')return '';const key=x.trim().toLowerCase();return names[key]||names[key.split(/[-_]/)[0]]||'';}).filter(Boolean))].join(' / ');
}
function performanceSlots(show){
 const byStart=new Map();
 for(const t of Array.isArray(show?.showtimes)?show.showtimes:[]){const start=Date.parse(t.startTime),end=Date.parse(t.endTime);if(!Number.isFinite(start))continue;const language=languageLabel(t),old=byStart.get(start);if(old){if(Number.isFinite(end)&&(!Number.isFinite(old.end)||end>old.end))old.end=end;if(language&&!old.languages.includes(language))old.languages.push(language);}else byStart.set(start,{start,end,languages:language?[language]:[]});}
 return [...byStart.values()].sort((a,b)=>a.start-b.start).map(({languages,...t})=>({...t,language:languages.join(' / ')}));
}
function nextPerformance(show,now=Date.now()){
 if(!Array.isArray(show?.showtimes))return null;
 const slots=performanceSlots(show).filter(t=>parisDay(t.start)===parisDay(now));
 const next=slots.find(t=>t.start>=now);if(next)return {...next,state:'upcoming'};
 const running=slots.find(t=>t.start<now&&(Number.isFinite(t.end)&&t.end>t.start?now<t.end:now-t.start<=START_GRACE));
 return running?{...running,state:'running'}:null;
}
function nearby(data,shows,router,position,now=Date.now(),fetchedAt=0,limits={}){
 if(!position||position.accuracy>80||now-fetchedAt>300000||now-fetchedAt<0)return [];
 const snap=router.snap(position.latlng);if(snap.distance>90)return [];
 const distances=router.tree(snap.node).ds,result=[];
 for(const ride of data.rides){
  if(ride.category!=='show'||ride.reservedViewing||ride.approximateArea||!ride.themeparksId)continue;
  const live=shows.get(ride.themeparksId);if(!live||live.status!=='OPERATING')continue;
  const meters=distances[ride.node]+(ride.offset||0)+snap.distance;if(!Number.isFinite(meters)||meters>(limits.maxMeters??800))continue;
  const walkMinutes=Math.max(1,Math.ceil(meters/72));
  const upcoming=(live.showtimes||[]).map(t=>Date.parse(t.startTime)).filter(t=>currentSlot(t,now)&&t-now<=(limits.maxMinutes??45)*60000&&arrivalDeadline(t,ride)>=now+walkMinutes*60000).sort((a,b)=>a-b)[0];
  if(upcoming)result.push({ride,language:performanceSlots(live).find(t=>t.start===upcoming)?.language||'',start:upcoming,minutes:Math.ceil(Math.abs(upcoming-now)/60000),started:upcoming<=now,meters,walkMinutes});
 }
 const seen=new Set();return result.sort((a,b)=>a.meters-b.meters||a.start-b.start).filter(x=>!seen.has(x.ride.themeparksId)&&seen.add(x.ride.themeparksId));
}
function today(show,now=Date.now()){
 const seen=new Set();
 return performanceSlots(show).filter(t=>currentSlot(t.start,now)&&t.start+START_GRACE>=now&&!seen.has(t.start)&&seen.add(t.start)).map(t=>({...t,state:Number.isFinite(t.end)&&t.end>t.start&&t.start<=now&&t.end>now?'running':t.start<=now?'past':'upcoming'}));
}
function allToday(data,shows,router,position,now=Date.now(),fetchedAt=0){
 if(now-fetchedAt>300000||now<fetchedAt)return [];
 const snap=position&&router.snap(position.latlng),ds=snap&&snap.distance<=90?router.tree(snap.node).ds:null,result=[];
 for(const ride of data.rides){
  if(ride.category!=='show'||ride.reservedViewing||!ride.themeparksId)continue;
  const live=shows.get(ride.themeparksId),slots=(live?.showtimes||[]).map(t=>Date.parse(t.startTime)).filter(t=>Number.isFinite(t)&&parisDay(t)===parisDay(now)).sort((a,b)=>a-b);if(!slots.length)continue;
  const meters=ds?ds[ride.node]+(ride.offset||0)+snap.distance:Infinity,walkMinutes=Number.isFinite(meters)?Math.max(1,Math.ceil(meters/72)):null;
  const upcoming=slots.find(t=>arrivalDeadline(t,ride)>=now+(walkMinutes||0)*60000),start=upcoming??slots.at(-1);
  result.push({ride,language:performanceSlots(live).find(t=>t.start===start)?.language||'',start,meters,walkMinutes,minutes:Math.ceil(Math.abs(start-now)/60000),started:start<=now,finished:upcoming===undefined,tooLate:upcoming===undefined&&start>now,arriveBy:arrivalDeadline(start,ride),closed:live.status==='CLOSED'});
 }
 const seen=new Set();return result.sort((a,b)=>a.meters-b.meters||a.start-b.start||a.ride.name.localeCompare(b.ride.name)).filter(x=>!seen.has(x.ride.themeparksId)&&seen.add(x.ride.themeparksId));
}
root.DisneyShows={languageLabel,arrivalLead,arrivalDeadline,nearby,today,hasRemainingToday,canAttendToday,startsSoon,nextPerformance,allToday};if(typeof module!=='undefined')module.exports=root.DisneyShows;
})(typeof self!=='undefined'?self:globalThis);
