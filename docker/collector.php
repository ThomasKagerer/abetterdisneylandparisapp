<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require '/var/www/html/wait-times.php';
require '/var/www/html/show-times.php';
function disney_collect_public(): void {
    ob_start();disney_wait_times_response();$waits=json_decode(ob_get_clean(),true);
    ob_start();disney_show_times_response();$shows=json_decode(ob_get_clean(),true);
    $active=[];$now=time();
    foreach(glob('/var/lib/weletapi-disney-push/subscriptions/*.json') as $file){
        if(!preg_match('/[a-f0-9]{64}\.json$/',$file))continue;
        $state=json_decode((string)file_get_contents($file),true);
        if(($state['publicApp'] ?? false)!==true||!preg_match('/\Aguest-[a-f0-9]{64}\z/',$state['user'] ?? ''))continue;
        if($now-($state['updatedAt'] ?? 0)>90*86400){unlink($file);continue;}
        $active[]=$state['user'];
    }
    if(!$active)return;
    $pipes=[];$process=proc_open('/usr/local/bin/node /opt/disney-push/sender.cjs',[0=>['pipe','r'],1=>STDOUT,2=>STDERR],$pipes);
    if(!is_resource($process))throw new RuntimeException('Push worker unavailable');
    fwrite($pipes[0],json_encode(['waits'=>$waits,'shows'=>$shows,'activeUsers'=>array_values(array_unique($active))]));
    fclose($pipes[0]);if(proc_close($process)!==0)throw new RuntimeException('Push collection failed');
}
$cycle=0;
do {
    $started=time();
    try {
        if($cycle%5===0){foreach([4,28] as $park){disney_refresh_historical_values($park);disney_refresh_park_hours($park);}}
        disney_collect_public();
        fwrite(STDERR,date('c')." Public park data refreshed.\n");
    } catch(Throwable $error){fwrite(STDERR,date('c')." Park-data worker retrying next cycle.\n");}
    $cycle++;
    if(in_array('--once',$argv,true))break;
    sleep(max(1,60-(time()-$started)));
} while(true);
