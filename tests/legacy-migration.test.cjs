const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handlers={},calls=[];
const self={skipWaiting:async()=>calls.push('skipWaiting'),clients:{claim:async()=>calls.push('claim')},registration:{unregister:async()=>calls.push('unregister')},addEventListener:(name,handler)=>{handlers[name]=handler;}};
vm.runInNewContext(fs.readFileSync(require.resolve('../docker/legacy-migration-sw.js'),'utf8'),{self});
(async()=>{for(const name of ['install','activate']){let pending;handlers[name]({waitUntil:value=>{pending=value;}});await pending;}assert.deepEqual(calls,['skipWaiting','claim','unregister']);assert.deepEqual(Object.keys(handlers),['install','activate']);console.log('Retired worker unregisters; no redirects, navigation, storage deletion or fetch interception.');})().catch(error=>{console.error(error);process.exitCode=1;});
