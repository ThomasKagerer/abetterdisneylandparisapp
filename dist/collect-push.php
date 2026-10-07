<?php
// Scheduled public-data collection + user-scoped push. Never callable over HTTP.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/wait-times.php';require __DIR__.'/show-times.php';require '/mnt/backup/webdav/auth/qr_lib.php';
ob_start();disney_wait_times_response();$waits=json_decode(ob_get_clean(),true);
ob_start();disney_show_times_response();$shows=json_decode(ob_get_clean(),true);
$active=[];foreach(glob('/var/lib/weletapi-disney-push/subscriptions/*.json') as $file){if(!preg_match('/[a-f0-9]{64}\.json$/',$file))continue;$s=json_decode((string)file_get_contents($file),true);$uid=$s['user'] ?? '';if($uid!==''&&weletapi_user_is_active($uid))$active[]=$uid;}
if(!$active)exit;
$pipes=[];$process=proc_open('/usr/bin/node /var/lib/weletapi-disney-push/sender.cjs',[0=>['pipe','r'],1=>STDOUT,2=>STDERR],$pipes);
if(!is_resource($process))exit(1);fwrite($pipes[0],json_encode(['waits'=>$waits,'shows'=>$shows,'activeUsers'=>array_values(array_unique($active))]));fclose($pipes[0]);exit(proc_close($process));
