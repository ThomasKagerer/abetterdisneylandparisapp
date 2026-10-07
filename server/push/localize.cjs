'use strict';
// The server and browser share reviewed messages and attributed Disney names.
const fs=require('node:fs'),path=require('node:path');
const production=(process.env.DISNEY_APP_DIR||'/mnt/backup/webdav/files/.internal/Disney')+'/i18n.js';
module.exports=require(fs.existsSync(production)?production:path.resolve(__dirname,'../../dist/i18n.js'));
