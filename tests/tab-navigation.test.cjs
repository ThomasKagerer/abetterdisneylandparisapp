'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../dist/app.js','utf8'),elements=new Map(),classes=new Set(['nav-mode']),panel={scrollTop:0};
const $=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,close(){this.open=false;},setAttribute(k,v){this[k]=v;}});return elements.get(id);};
const route={order:['ride-1']},ctx={$ ,nav:true,route,activeHomeView:'map',homeViewStates:new Map(),ratingsMode:false,selectedPark:'all',onlyFav:false,document:{body:{classList:{contains:x=>classes.has(x),toggle(x,on){on?classes.add(x):classes.delete(x);},remove:x=>classes.delete(x)}},querySelector:()=>panel},map:{invalidateSize(){}},renderNav(){},renderRides(){},tab(){}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function closeQueueForBrowse('),source.indexOf('function openQueueCheckin(')),ctx);vm.runInContext(source.slice(source.indexOf('function rememberHomeView('),source.indexOf('for(const view of',source.indexOf('function rememberHomeView('))),ctx);
$('queue-dialog').open=true;$('queue-prompt').open=true;ctx.homeView('favorites');assert(!$('queue-dialog').open);assert(!$('queue-prompt').open);assert(ctx.onlyFav);$('filter-options').open=true;$('search').value='Peter';$('park').value='Disneyland Park';panel.scrollTop=220;
ctx.homeView('best');assert(ctx.ratingsMode);assert.equal($('search').value,'');$('ratings-small').checked=true;panel.scrollTop=80;
ctx.homeView('route');assert.equal(ctx.nav,true);assert.equal(ctx.route,route);assert(classes.has('nav-mode'));
ctx.homeView('favorites');assert.equal($('search').value,'Peter');assert.equal($('park').value,'all');assert.equal(panel.scrollTop,220);assert.equal($('filter-options').open,true);assert.equal($('home-all')['aria-pressed'],false);
ctx.homeView('best');assert.equal($('ratings-small').checked,true);assert.equal(panel.scrollTop,80);assert.equal($('filter-options').open,false);assert.equal($('home-all')['aria-pressed'],true,'Top Rides belongs to the Explore tab');
ctx.homeView('map');assert(!classes.has('functions-open'));assert(ctx.nav);assert.equal(ctx.route,route);
assert(!source.includes('section.requestFullscreen'),'Fullscreen must not hide sibling tab bar');
console.log('Passed: independent tab filters and scroll, navigation/route preserved on all tabs, fullscreen does not isolate map.');

ctx.window={matchMedia:()=>({matches:false})};panel.scrollTo=opts=>{panel.scrollTop=opts.top;};ctx.homeView('favorites');panel.scrollTop=700;ctx.tapHomeView('favorites');assert.equal(panel.scrollTop,0,'Single active-tab tap scrolls to top');assert.equal(ctx.homeViewStates.get('favorites').scroll,0);assert.equal($('search').value,'Peter','Retap does not reset the search');
ctx.homeView('best');panel.scrollTop=400;ctx.tapHomeView('all');assert.equal(panel.scrollTop,0);assert.equal(ctx.activeHomeView,'best','Explore is selected during Top Rides; tapping it preserves the subview');assert(ctx.ratingsMode);assert($('ratings-small').checked);
ctx.homeView('favorites');panel.scrollTop=360;ctx.tapHomeView('best');assert.equal(ctx.activeHomeView,'best');ctx.tapHomeView('favorites');assert.equal(panel.scrollTop,360,'Switching to a different tab restores its position');ctx.tapHomeView('favorites');assert.equal(panel.scrollTop,0);ctx.window.matchMedia=()=>({matches:true});ctx.tapHomeView('favorites');assert.equal(panel.scrollTop,0);
console.log('Passed: one tap on selected tab scrolls to top, Top Rides alias stays selected, filters preserved, other tab positions restored, reduced motion.');
