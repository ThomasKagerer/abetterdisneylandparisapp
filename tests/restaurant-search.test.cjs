'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const search=require('../dist/restaurant-search.js'),ratings=require('../dist/restaurant-ratings.js'),data=JSON.parse(fs.readFileSync(__dirname+'/../dist/park-data.json'));
const restaurants=data.services.filter(p=>p.serviceType==='restaurant');
assert.equal(restaurants.filter(p=>search.matches(p,'italienisch')).length,2);
assert(search.matches(restaurants.find(p=>p.name==='Pizzeria Bella Notte'),'italienisch pizza'));
assert(search.matches(restaurants.find(p=>p.name==='Stark Factory'),'italian'));
assert(search.matches(restaurants.find(p=>p.name==='The Lucky Nugget Saloon'),'amerikanisch mexikanisch'));
assert(search.matches(restaurants.find(p=>p.name==='Bistrot Chez Rémy'),'remy franzosisch'));
assert.equal(search.type({amenity:'fast_food'}),'Imbiss');assert.equal(search.type({amenity:'cafe'}),'Café');
assert.equal(search.description({amenity:'restaurant'}),'Restaurant','No invented cuisine for missing tags');
assert.equal(search.cuisine({cuisine:' french ; italian '}),'Französisch · Italienisch');
assert.equal(search.cuisine({cuisine:'vegan_food'}),'vegan food','Unknown tags retained');
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),els=new Map();
const ctx={$:id=>{if(!els.has(id))els.set(id,{value:'all',checked:true,setAttribute(){},addEventListener(name,fn){this[name]=fn;},focus(){this.focused=true;},blur(){this.focused=false;}});return els.get(id);},data,DisneyShows:require('../dist/show-times.js'),shows:new Map(),DisneyRestaurantSearch:search,DisneyRatings:{get:()=>null,ranked:r=>{ctx.rankedCalls++;return r;}},restaurantRating:ratings.get,rankedCalls:0,
renderHiddenTargets(){},syncCatalogDistanceMode(){},uninterested:new Set(),parkMatches:p=>ctx.selectedPark==='all'||p.park===ctx.selectedPark,ageMatches:()=>true,onlyFav:false,favorites:new Set(),visited:new Set(),ratingsMode:false,Date,selectedPark:'all',nextShowBadge:()=>'',targetAvailable:()=>true,waitBadge:()=>'',childBadge:()=>'',ageBadge:()=>'',activeHomeView:'all',originLabel:'Eingang',remaining:()=>[],planning:false,tooFarFromPark:()=>false,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),minutes:d=>Math.ceil(d/72),metric:Math.round,
router:{snap:()=>({node:0,distance:0}),tree:()=>({ds:new Array(data.nodes.length).fill(100)})},origin:[48.87,2.78],pointById:new Map([...data.rides,...data.services].map(p=>[p.id,p]))};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function rideSearchText('),source.indexOf("$('rides-list').addEventListener('click',async")),ctx);
ctx.$('search').value='';ctx.$('category').value='all';ctx.renderRides();
assert(!ctx.$('rides-list').innerHTML.includes('service-restaurant'),'Everything never includes restaurants');assert.equal((ctx.$('rides-list').innerHTML.match(/data-result-map=/g)||[]).length,data.rides.length,'Every ride/show search result has a pin');assert(ctx.$('search-clear').hidden);
ctx.$('search').value='Bella Notte';ctx.renderRides();assert(!ctx.$('rides-list').innerHTML.includes('Pizzeria Bella Notte'),'Name search alone cannot enable restaurants');
ctx.$('category').value='restaurant';ctx.$('search').value='italienisch';ctx.renderRides();let html=ctx.$('rides-list').innerHTML;
assert(!ctx.$('search-clear').hidden);assert(html.includes('Pizzeria Bella Notte')&&html.includes('Stark Factory'));assert(!html.includes('Bistrot Chez Rémy'));assert(html.includes('Restaurant · Italienisch'));
assert(!html.includes('data-id=')&&!html.includes('data-favorite-visited=')&&!html.includes('wait-badge'),'No inoperative ride actions');
assert(html.includes('data-result-map=')&&html.includes('data-object-info='));assert(!html.includes('data-facility-next='),'Navigation starts from the map after pin preview');
ctx.onlyFav=true;ctx.ratingsMode=true;ctx.$('show-visited').checked=false;ctx.$('age-group').value='Kids';ctx.renderRides();
assert(ctx.$('rides-list').innerHTML.includes('Stark Factory'));assert.equal(ctx.rankedCalls,0,'Ride ranking does not discard restaurants');assert(ctx.$('age-group').disabled);
ctx.selectedPark='Disneyland Park';ctx.renderRides();assert(!ctx.$('rides-list').innerHTML.includes('Stark Factory'));assert(ctx.$('rides-list').innerHTML.includes('Pizzeria Bella Notte'));
ctx.$('search').value='';ctx.tooFarFromPark=()=>true;ctx.renderRides();assert(ctx.$('rides-list').innerHTML.includes('data-result-map='),'Map preview stays available beyond 10 km');assert(!ctx.$('rides-list').innerHTML.includes('data-facility-next='),'No direct distant navigation');
assert(ctx.$('rides-list').innerHTML.includes('ride-distance" hidden'));
ctx.$('category').value='all';ctx.renderRides();assert(!ctx.$('age-group').disabled);assert.equal(ctx.$('age-group').value,'Kids','Ride filters preserved when returning');
const evil={id:'service-restaurant-test',name:'<img onerror="bad">',amenity:'cafe',cuisine:'<svg>',park:'Disneyland Park'};assert(!ctx.restaurantRow(evil,100).includes('<svg>'));assert(ctx.restaurantRow(evil,100).includes('&lt;img'));
console.log('Passed: explicit restaurant gate, German cuisine/type/multiword/accent search, no guessed cuisine or ride actions, irrelevant ride filters ignored and preserved, parks, 10 km lock and escaping.');

// Exercise the actual clear-button wiring against the real filtered renderer.
ctx.$('category').value='restaurant';ctx.selectedPark='all';ctx.$('search').value='italienisch';ctx.renderRides();ctx.syncAppViewport=()=>{};
vm.runInContext(source.slice(source.indexOf("$('search-clear').addEventListener('pointerdown'"),source.indexOf("$('search-done').onclick=")),ctx);
let prevented=false;ctx.$('search-clear').pointerdown({preventDefault(){prevented=true;}});assert(prevented,'Clear does not steal touch focus');ctx.$('search-clear').onclick();assert.equal(ctx.$('search').value,'');assert(ctx.$('search').focused);assert(ctx.$('search-clear').hidden);assert.equal(ctx.$('category').value,'restaurant');assert(ctx.$('rides-list').innerHTML.includes('Bistrot Chez Rémy'),'Clearing restores results under the same filter');
// Click a restaurant pin through the real delegated event and focus routine.
const preview=[],route={order:[data.rides[0].id]};Object.assign(ctx,{appReady:true,pendingNoticeId:null,route,following:true,homeView:v=>preview.push(v),showNavigationMap:()=>preview.push('selected-map'),setHeadingUp:v=>preview.push(v),renderFollow(){},renderPins(){},map:{setView:(point,zoom)=>preview.push({point,zoom})},openMapObjectSheet:id=>preview.push({sheet:id}),document:{addEventListener:(name,fn)=>ctx.delegated=fn}});
vm.runInContext(source.slice(source.indexOf('function focusRideOnMap('),source.indexOf('function updatePopupTravel(')),ctx);
vm.runInContext(source.slice(source.indexOf("document.addEventListener('click',event=>{\n"),source.indexOf('// A horizontal right swipe')),ctx);
ctx.$('facilities-dialog').open=true;ctx.$('facilities-dialog').close=()=>ctx.$('facilities-dialog').open=false;
const place=restaurants.find(p=>p.name==='Stark Factory');ctx.delegated({target:{closest:selector=>selector==='[data-result-map]'?{dataset:{resultMap:place.id}}:null}});
assert.equal(ctx.focusedRideId,place.id);assert(preview.includes('map'));assert(preview.some(x=>x?.sheet===place.id));assert(preview.some(x=>x?.zoom===18));assert.equal(ctx.route,route,'Preview never starts/replaces the route');assert(!ctx.$('facilities-dialog').open,'A modal search closes before the map opens');assert(!ctx.$('search').focused);
console.log('Passed: every result pin, clear button rerenders without clearing filters or keyboard focus, real pin event previews selected restaurant without replacing navigation, far-away preview allowed.');
