(function(root){'use strict';
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function minute(at=Date.now()){const p=formatter.formatToParts(at);return Number(p.find(p=>p.type==='hour').value)*60+Number(p.find(p=>p.type==='minute').value);}
function clock(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(Math.floor(m%60)).padStart(2,'0');}
function probe(series,m){return series.map(s=>({label:s.label,value:s.samples.find(p=>m>=p.from&&m<p.to)?.minutes??null}));}
function refresh(doc){for(const svg of doc.querySelectorAll('.history-chart[data-chart-start]')){const m=minute(),a=Number(svg.dataset.chartStart),b=Number(svg.dataset.chartEnd),group=svg.querySelector('.history-now');if(!group)continue;const valid=m>=a&&m<=b;group.style.display=valid?'':'none';if(valid){const x=36+(m-a)/(b-a)*280;const line=group.querySelector('line');line.setAttribute('x1',x);line.setAttribute('x2',x);const label=group.querySelector('text');label.setAttribute('x',Math.max(75,Math.min(280,x)));label.textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)('Jetzt '+clock(m));}}}
function init(doc){let active=null;const select=(svg,e)=>{const box=svg.getBoundingClientRect(),p=Math.max(36,Math.min(316,(e.clientX-box.left)/box.width*336)),a=Number(svg.dataset.chartStart),b=Number(svg.dataset.chartEnd),m=a+(p-36)/280*(b-a);let series;try{series=JSON.parse(svg.dataset.chartSeries);}catch{return;}const line=svg.querySelector('.history-selection');line.removeAttribute('hidden');line.setAttribute('x1',p);line.setAttribute('x2',p);const values=probe(series,m),average=svg.dataset.chartView==='average';svg.parentElement.querySelector('.history-cursor').textContent=(typeof DisneyI18n==='undefined'?String:DisneyI18n.text)(clock(m)+' Uhr · '+values.map(v=>v.label+': '+(v.value===null?'keine Messung':(average?'Ø ':'')+v.value.toLocaleString((typeof DisneyI18n==='undefined'?'de-DE':DisneyI18n.locale()),{maximumFractionDigits:1})+' Min.')).join(' · '));};
 doc.addEventListener('pointerdown',e=>{const svg=e.target.closest?.('.history-chart[data-chart-start]');if(!svg)return;active={svg,id:e.pointerId};svg.setPointerCapture?.(e.pointerId);select(svg,e);});
 doc.addEventListener('pointermove',e=>{if(active?.id===e.pointerId&&active.svg.isConnected)select(active.svg,e);});
 for(const event of ['pointerup','pointercancel'])doc.addEventListener(event,()=>{active=null;});
 setInterval(()=>{if(!doc.hidden)refresh(doc);},30000);
}
root.DisneyChart={minute,clock,probe,refresh,init};if(typeof module!=='undefined')module.exports=root.DisneyChart;if(typeof document!=='undefined')init(document);
})(typeof globalThis!=='undefined'?globalThis:this);
