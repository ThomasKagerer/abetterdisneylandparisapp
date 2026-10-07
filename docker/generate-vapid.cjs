'use strict';
const fs=require('node:fs'),webpush=require('/opt/disney-push/node_modules/web-push');
fs.writeFileSync('/var/lib/weletapi-disney-push/vapid.json',JSON.stringify(webpush.generateVAPIDKeys()),{flag:'wx',mode:0o600});
