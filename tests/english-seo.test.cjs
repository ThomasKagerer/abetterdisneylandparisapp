'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=__dirname+'/../dist/',html=fs.readFileSync(root+'introduction.html','utf8');
assert(html.includes('<html lang="en">'));
assert.match(html,/<title>a better Disneyland Paris App – 3D map, wait times and routes<\/title>/);
for(const [attribute,prefix] of [['name="description"','Plan your day at Disneyland Paris:'],['property="og:title"','a better Disneyland Paris App – your day at Disneyland Paris'],['property="og:description"','Choose favorites,'],['property="og:locale"','en_GB']]){
 const tag=html.match(new RegExp('<meta[^>]*'+attribute+'[^>]*>'))?.[0];assert(tag?.includes('content="'+prefix),attribute);
}
assert(html.includes('Navigation that actually works.'));
assert(!html.includes('dein Tag in Disneyland Paris'));
const schema=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);assert(schema.description.startsWith('Independent Disneyland Paris web app'));
// A fresh localization engine must understand English HTML before any translations have run.
const ctx={DisneyMessages:require('../dist/i18n-messages.js'),DisneyOfficialNames:{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'i18n.js','utf8'),ctx);
const node={nodeType:3,nodeValue:'Navigation that actually works.'},body={nodeType:1,tagName:'BODY',childNodes:[node],hasAttribute:()=>false};
const doc={documentElement:{},body,querySelector:()=>null,querySelectorAll:()=>[]};
ctx.DisneyI18n.init(doc,{getItem:()=> 'de'});assert.equal(node.nodeValue,'Navigation, die funktioniert.');assert.equal(doc.documentElement.lang,'de');
ctx.DisneyI18n.setLanguage('fr',{persist:false,notify:false});ctx.DisneyI18n.apply(doc);assert.equal(node.nodeValue,'Une navigation qui fonctionne.');
ctx.DisneyI18n.setLanguage('en',{persist:false,notify:false});ctx.DisneyI18n.apply(doc);assert.equal(node.nodeValue,'Navigation that actually works.');
console.log('Passed: raw crawler HTML, title, description, Open Graph and structured data default to English; fresh browser localization still switches English HTML to German/French.');
