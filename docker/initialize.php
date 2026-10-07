<?php
declare(strict_types=1);
$dirs=['/var/lib/disney-runtime','/var/lib/weletapi-disney-waits','/var/lib/weletapi-disney-diagnostics','/var/lib/weletapi-disney-push','/var/lib/weletapi-disney-push/subscriptions'];
foreach($dirs as $dir){if(!is_dir($dir))mkdir($dir,0700,true);chmod($dir,0700);chown($dir,33);chgrp($dir,33);}
$key='/var/lib/disney-runtime/device.key';
if(!is_file($key))file_put_contents($key,bin2hex(random_bytes(32)),LOCK_EX);
chmod($key,0600);chown($key,33);chgrp($key,33);
// The Docker app has independent Web Push keys; no host secrets are mounted.
$vapid='/var/lib/weletapi-disney-push/vapid.json';
if(!is_file($vapid)){
    exec('/usr/local/bin/node /opt/disney/generate-vapid.cjs', $output, $code);
    if($code!==0)throw new RuntimeException('Could not initialize Web Push');
}
chmod($vapid,0600);chown($vapid,33);chgrp($vapid,33);
$enabled='/var/lib/weletapi-disney-push/enabled';touch($enabled);chmod($enabled,0600);chown($enabled,33);chgrp($enabled,33);
echo "Independent Docker data initialized.\n";
