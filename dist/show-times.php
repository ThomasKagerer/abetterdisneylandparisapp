<?php
// Authenticated by index.php; fetch only public park data, never location/user data.
declare(strict_types=1);
function disney_normalize_shows(array $payload): array {
    $shows=[];
    foreach (($payload['liveData'] ?? []) as $item) {
        if (!is_array($item) || !is_string($item['id'] ?? null) || !is_array($item['showtimes'] ?? null)) continue;
        $times=[];
        foreach ($item['showtimes'] as $slot) {
            $start=$slot['startTime'] ?? null; $end=$slot['endTime'] ?? null;
            if (is_string($start) && strtotime($start)!==false) {
                $time=['startTime'=>$start,'endTime'=>is_string($end)&&strtotime($end)!==false ? $end : $start];
                foreach (['language','languages','type'] as $field) {
                    $value=$slot[$field] ?? null;
                    if(is_string($value)&&strlen($value)<=80)$time[$field]=$value;
                    elseif($field==='languages'&&is_array($value))$time[$field]=array_values(array_filter(array_slice($value,0,8),fn($v)=>is_string($v)&&strlen($v)<=40));
                }
                $times[]=$time;
            }
        }
        $shows[]=['id'=>$item['id'],'status'=>$item['status'] ?? 'UNKNOWN','showtimes'=>$times,'updatedAt'=>$item['lastUpdated'] ?? null];
    }
    return $shows;
}
function disney_show_times_response(): void {
    header('Content-Type: application/json; charset=utf-8');
    $path='/var/lib/weletapi-disney-waits/shows.json';$cache=is_file($path)?json_decode((string)@file_get_contents($path),true):null;
    $now=time();$fresh=is_array($cache)&&($cache['fetchedAt'] ?? 0)>$now-60;
    if (!$fresh) {
        $lock=@fopen($path.'.lock','c');
        if ($lock && flock($lock,LOCK_EX|LOCK_NB)) {
            $handle=curl_init('https://api.themeparks.wiki/v1/entity/e8d0207f-da8a-4048-bec8-117aa946b2c2/live');
            curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>6,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_USERAGENT=>'weletapi-Disney/1.0',CURLOPT_HTTPHEADER=>['Accept: application/json']]);
            $body=curl_exec($handle);$status=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);curl_close($handle);
            $payload=is_string($body)&&strlen($body)<3000000?json_decode($body,true):null;
            if ($status===200 && is_array($payload) && is_array($payload['liveData'] ?? null)) {
                $cache=['fetchedAt'=>$now,'shows'=>disney_normalize_shows($payload)];
                $tmp=tempnam(dirname($path),'shows-');if($tmp!==false){file_put_contents($tmp,json_encode($cache));chmod($tmp,0600);rename($tmp,$path);}
                $fresh=true;
            }
            flock($lock,LOCK_UN);
        }
        if($lock)fclose($lock);
    }
    echo json_encode(['fetchedAt'=>$cache['fetchedAt'] ?? null,'stale'=>!is_array($cache)||($cache['fetchedAt'] ?? 0)<$now-300,'shows'=>$cache['shows'] ?? [],'source'=>'ThemeParks.wiki']);
}
