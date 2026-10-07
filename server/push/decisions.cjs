'use strict';
const I=require('./localize.cjs');
function candidates(state,data,waits,shows,now,waitLib){
 if(!state.context||now-state.context.at*1000>15*60000||now<state.context.at*1000)return [];
 const lang=I.resolve(state.language),translate=value=>I.text(value,lang),result=[],points=new Map(data.rides.map(r=>[r.id,r]));
 for(const c of state.context.candidates||[]){const ride=points.get(c.id);if(!ride)continue;
  if(ride.category==='show'&&!ride.approximateArea&&!ride.reservedViewing&&c.meters<=800){const live=shows.get(ride.themeparksId),walk=Math.ceil(c.meters/72),lead=ride.eventSetting==='indoor'?10:3;if(live?.status==='OPERATING')for(const t of live.showtimes||[]){const start=Date.parse(t.startTime),delta=(start-now)/60000;if(delta<=30&&delta>=walk+lead){result.push({key:`show:${ride.id}:${start}`,kind:'show',id:ride.id,title:translate('Show beginnt bald'),body:translate(`${I.name(ride,lang)} · ${new Date(start).toLocaleTimeString(I.locale(lang),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})} · ca. ${walk} Min. Fußweg ab deinem letzten Parkbereich${ride.eventSetting==='indoor'?' · Indoor: 10 Min. vorher da sein':' · Outdoor'}`),expires:start-lead*60000});break;}}}
  if(c.favorite&&c.meters<=1200&&Number.isFinite(c.extraWalkingMinutes)&&ride.queueTimes){const live=waits.get(`${ride.queueTimes.parkId}:${ride.queueTimes.rideId}`),singleId=waitLib.singleRiderId(ride.queueTimes),single=singleId&&waits.get(`${ride.queueTimes.parkId}:${singleId}`),op=waitLib.bestOpportunity(live,single,c.extraWalkingMinutes,state.context.includeSingleRider===true,now);if(op)result.push({key:`wait:${ride.id}:${new Date(now).toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})}`,kind:'wait',id:ride.id,title:translate('Ungewöhnlich kurze Schlange'),body:translate(`${I.name(ride,lang)} · ${op.lane==='Normal'?translate('Normale Warteschlange'):translate(op.lane)}: ${op.minutes} Min. statt meist ${op.baseline} Min. · möchtest du wechseln?`),expires:now+5*60000});}
 }
 return result.sort((a,b)=>a.kind==='show'&&b.kind!=='show'?-1:b.kind==='show'&&a.kind!=='show'?1:a.expires-b.expires);
}
function updateNotice(state,build,now=Date.now()){if(!Number.isInteger(build)||build<1||(state.appBuild||0)>=build)return null;return {key:`update:${build}`,kind:'update',title:I.text('Disney · Update verfügbar',state.language),body:I.text(`Build ${build} ist bereit. Öffne Info, um das Update zu installieren.`,state.language),expires:now+86400000};}
module.exports={candidates,updateNotice};
