/* Queue-Times.com live data presentation. Missing and closed are never 0-minute queues. */
(function(root){
// A closed Single Rider queue alone does not close the ride. Keep a known closure
// hidden until a newer update reports an operating regular or Single Rider queue.
function isClosed(standard,single){return standard?.status==='CLOSED'&&single?.status!=='OPERATING';}
function comparison(entry){
 if(entry?.status!=='OPERATING'||!Number.isInteger(entry.minutes)||entry.minutes<0||entry.minutes>600||!Number.isFinite(entry.baselineMinutes)||entry.baselineMinutes<=0||(entry.baselineWindow!=='source-all-time-average'&&(!Number.isInteger(entry.baselineSamples)||entry.baselineSamples<3)))return null;
 const percent=(entry.minutes-entry.baselineMinutes)/entry.baselineMinutes*100,tone=percent>=20?'long-red':percent>=10?'long-orange':percent<=-20?'short-green':percent<=-10?'short-yellow':'normal',rounded=Math.round(Math.abs(percent)*10)/10;
 return {percent,tone,text:`${rounded===0?'':percent>0?'+':'-'}${rounded.toLocaleString(typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale())} %`,baseline:entry.baselineMinutes,samples:entry.baselineSamples};
}
function describe(entry,now=Date.now(),unavailable=false){
 if(!entry)return {text:'Wartezeit nicht verfügbar',kind:'unknown',detail:'Für dieses Ziel liegen momentan keine Wartezeiten vor.'};
 const timestamp=Date.parse(entry.updatedAt),age=now-timestamp,stale=unavailable||entry.stale||!Number.isFinite(timestamp)||age>15*60*1000||age< -5*60*1000;
 const time=Number.isFinite(timestamp)?new Date(timestamp).toLocaleTimeString(typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale(),{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}):null;
 const wait=Number.isInteger(entry.minutes)&&entry.minutes>=0&&entry.minutes<=600?entry.minutes:null;
 const label=entry.status==='CLOSED'?'Geschlossen':entry.status==='OPERATING'&&wait!==null?`${wait} Min. Wartezeit`:'Wartezeit nicht verfügbar';
 const relative=!stale?comparison(entry):null,display=relative?`${label} · ${relative.text}`:label;
 return {comparison:relative,text:stale?`Letzter Stand: ${label}${time?' · '+time:''}`:display,kind:stale?'stale':entry.status==='CLOSED'?'closed':wait!==null&&entry.status==='OPERATING'?'open':'unknown',detail:`Queue-Times.com${time?' · Stand '+time+' Uhr (Paris)':''}${stale?' · Daten veraltet oder Verbindung unterbrochen':''}${relative?` · Normal: ${relative.baseline} Min. (${entry.baselineWindow==='source-all-time-average'?`historischer Durchschnitt von Queue-Times.com, gesamter Zeitraum${entry.baselineUpdatedAt?' · Stand '+entry.baselineUpdatedAt.slice(0,10):''}`:`Median aus ${relative.samples} Messungen; ${entry.baselineWindow==='similar-hour-30d'?'ähnliche Tageszeit, letzte 30 Tage':'letzte 6 Stunden'}`})`:entry.status==='OPERATING'&&!stale?' · Vergleichswerte werden gesammelt':''}`};
}
function opportunity(entry,extraWalkingMinutes,now=Date.now(),unavailable=false){
 if(describe(entry,now,unavailable).kind!=='open'||!Number.isFinite(entry.baselineMinutes)||(entry.baselineWindow!=='source-all-time-average'&&entry.baselineSamples<3)||!Number.isFinite(extraWalkingMinutes)||extraWalkingMinutes>10)return null;
 const saved=entry.baselineMinutes-entry.minutes;
 if(comparison(entry)?.percent> -20||!comparison(entry))return null;
 return {baseline:Math.round(entry.baselineMinutes),minutes:entry.minutes,saved:Math.round(saved),extraWalkingMinutes:Math.ceil(extraWalkingMinutes),benefit:saved-extraWalkingMinutes};
}
const singleRiders={'4:2':7306,'4:8':7278,'28:10848':10849,'28:10845':10846,'28:32':7277,'28:37':7279,'28:34':7280,'28:35':7281,'28:15413':15422};
function singleRiderId(mapping){return mapping&&singleRiders[`${mapping.parkId}:${mapping.rideId}`];}
function bestOpportunity(standard,single,extra,includeSingle=false,now=Date.now(),unavailable=false){
 const choices=[{entry:standard,lane:'Normal'},...(includeSingle?[{entry:single,lane:'Single Rider'}]:[])].map(c=>{const op=opportunity(c.entry,extra,now,unavailable);return op?{...op,lane:c.lane}:null;}).filter(Boolean);
 return choices.sort((a,b)=>a.minutes-b.minutes||b.benefit-a.benefit)[0]||null;
}
root.DisneyWaits={describe,opportunity,comparison,isClosed,bestOpportunity,singleRiderId};if(typeof module!=='undefined')module.exports=root.DisneyWaits;
})(typeof self!=='undefined'?self:globalThis);
