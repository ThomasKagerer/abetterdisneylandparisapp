(function(root){'use strict';
const kitchens={american:'Amerikanisch',french:'Französisch',italian:'Italienisch',pizza:'Italienisch · Pizza',pasta:'Italienisch · Pasta',asian:'Asiatisch',oriental:'Orientalisch',german:'Deutsch',chicken:'Hähnchen',caribbean:'Karibisch',indian:'Indisch',waffle:'Waffeln',mexican:'Mexikanisch','tex-mex':'Tex-Mex · Mexikanisch',african:'Afrikanisch',barbecue:'Barbecue · Grill',fish:'Fisch',hot_dog:'Hotdogs',coffee_shop:'Kaffee',sandwich:'Sandwiches'};
function normalize(text){return String(text||'').toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss');}
function type(point){return point.amenity==='cafe'?'Café':point.amenity==='fast_food'?'Imbiss':'Restaurant';}
function cuisine(point,lang){return String(point.cuisine||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>typeof DisneyI18n==='undefined'?kitchens[x.toLowerCase()]||x.replace(/_/g,' '):DisneyI18n.cuisine(x.toLowerCase(),kitchens[x.toLowerCase()]||x.replace(/_/g,' '),lang)).join(' · ');}
function description(point,lang){const label=typeof DisneyI18n==='undefined'?type(point):DisneyI18n.text(type(point),lang);const food=cuisine(point,lang);return label+(food?' · '+food:'');}
function searchText(point){return normalize([point.name,type(point),cuisine(point),...(typeof DisneyI18n==='undefined'?[]:DisneyI18n.languages.map(([lang])=>description(point,lang))),point.cuisine,point.park,point.park==='Disney Adventure World'?'Adventure World Walt Disney Studios':''].join(' '));}
function matches(point,query){return normalize(query).trim().split(/\s+/).every(word=>searchText(point).includes(word));}
root.DisneyRestaurantSearch={normalize,type,cuisine,description,searchText,matches};if(typeof module!=='undefined')module.exports=root.DisneyRestaurantSearch;
})(typeof globalThis!=='undefined'?globalThis:this);
