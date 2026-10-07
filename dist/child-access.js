(function(root){'use strict';
function describe(ride,child=null){
 if(ride.category!=='attraction'||!child||!Number.isFinite(child.height))return null;
 child={...child,name:'Jüngstes Kind'};
 const min=ride.minHeightCm;if(!Number.isFinite(min))return {kind:'unknown',text:`${child.name}: Größenregel prüfen`,detail:'Keine verifizierte Größenangabe hinterlegt.'};
 if(child.height<min)return {kind:'no',text:`${child.name}: ✕ zu klein · ab ${min} cm`,detail:`${child.height} cm; es fehlen ${min-child.height} cm zur Mindestgröße. Quelle: offizielles Disney-Verzeichnis.`};
 return {kind:'yes',text:`${child.name}: ✓ ${min===0?'keine Mindestgröße':`ab ${min} cm`}${ride.accompaniedBelowCm&&child.height<ride.accompaniedBelowCm?' · nur begleitet':''}`,detail:`${child.name}, ${child.age} Jahre, ${child.height} cm: Größenanforderung erfüllt.${ride.accompaniedBelowCm&&child.height<ride.accompaniedBelowCm?` Unter ${ride.accompaniedBelowCm} cm ist Begleitung erforderlich.`:''}${ride.intensity==='strong'?' Intensive Attraktion; passend zur Größe bedeutet nicht automatisch passend für das Kind.':''} Einlassregeln am Eingang gelten. Quelle: offizielles Disney-Verzeichnis.`};
}
root.DisneyChild={describe};if(typeof module!=='undefined')module.exports=root.DisneyChild;
})(typeof self!=='undefined'?self:globalThis);
