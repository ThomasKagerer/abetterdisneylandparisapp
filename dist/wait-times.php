<?php
// Included only after the existing login and active-user check in index.php.
declare(strict_types=1);
require_once __DIR__.'/park-hours.php';
function disney_normalize_waits(array $payload): array {
    $entries = is_array($payload['rides'] ?? null) ? $payload['rides'] : [];
    foreach (($payload['lands'] ?? []) as $land) {
        if (is_array($land['rides'] ?? null)) $entries = array_merge($entries, $land['rides']);
    }
    $rides = [];
    foreach ($entries as $ride) {
        if (!is_array($ride) || !is_int($ride['id'] ?? null)) continue;
        $updated = is_string($ride['last_updated'] ?? null) ? $ride['last_updated'] : null;
        $minutes = $ride['wait_time'] ?? null;
        $open = $ride['is_open'] ?? null;
        $rides[$ride['id']] = ['id'=>$ride['id'], 'status'=>$open === true ? 'OPERATING' : ($open === false ? 'CLOSED' : 'UNKNOWN'), 'minutes'=>is_int($minutes) && $minutes >= 0 && $minutes <= 600 ? $minutes : null, 'updatedAt'=>$updated !== null && strtotime($updated) !== false ? $updated : null];
    }
    return array_values($rides);
}
function disney_fetch_waits(int $park): ?array {
    // Fixed allowlist; no user-supplied URL, credentials, location or user data.
    if (!in_array($park, [4,28], true)) return null;
    $url = 'https://queue-times.com/parks/'.$park.'/queue_times.json';
    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CONNECTTIMEOUT=>2, CURLOPT_TIMEOUT=>4, CURLOPT_FOLLOWLOCATION=>false, CURLOPT_USERAGENT=>'weletapi-Disney/1.0', CURLOPT_HTTPHEADER=>['Accept: application/json']]);
        $body = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
        if ($status !== 200 || !is_string($body)) return null;
    } else {
        $context = stream_context_create(['http'=>['timeout'=>4,'header'=>"Accept: application/json\r\nUser-Agent: weletapi-Disney/1.0\r\n",'follow_location'=>0], 'ssl'=>['verify_peer'=>true,'verify_peer_name'=>true]]);
        $body = @file_get_contents($url, false, $context);
        if (!is_string($body)) return null;
    }
    if (strlen($body) > 2000000) return null;
    $payload = json_decode($body, true);
    if (!is_array($payload)) return null;
    $rides = disney_normalize_waits($payload);
    return $rides ? $rides : null;
}
function disney_wait_baselines(array $rides, array &$history, int $now, array $historical=[]): array {
    $zone=new DateTimeZone('Europe/Paris');
    foreach ($rides as &$ride) {
        $key=(string)$ride['id']; $timestamp=$ride['updatedAt'] ? strtotime($ride['updatedAt']) : false;
        $observations=array_values(array_filter($history[$key] ?? [], fn($x)=>is_array($x) && is_int($x['at'] ?? null) && $x['at'] >= $now-30*86400 && $x['at'] <= $now && (in_array($x['status'] ?? 'OPERATING',['CLOSED','UNKNOWN'],true) || is_int($x['minutes'] ?? null) && $x['minutes']>=0 && $x['minutes']<=600)));
        $samples=array_values(array_filter($observations,fn($x)=>($x['status'] ?? 'OPERATING')==='OPERATING'));
        $previous=array_values(array_filter($samples,fn($x)=>$timestamp !== false && $x['at'] < $timestamp));
        $clock=fn($at)=>(new DateTimeImmutable('@'.$at))->setTimezone($zone);
        $current=$clock($timestamp !== false ? $timestamp : $now);$minute=(int)$current->format('G')*60+(int)$current->format('i');
        $similar=array_values(array_filter($previous,function($x)use($clock,$minute){$time=$clock($x['at']);$delta=abs((int)$time->format('G')*60+(int)$time->format('i')-$minute);return min($delta,1440-$delta)<=60;}));
        $days=array_unique(array_map(fn($x)=>$clock($x['at'])->format('Y-m-d'),$similar));
        $mature=count($similar)>=12 && count($days)>=2;
        $baseline=$mature ? $similar : array_values(array_filter($previous,fn($x)=>$x['at'] >= $now-6*3600));
        if (count($baseline)>=3 && max(array_column($baseline,'at'))-min(array_column($baseline,'at')) >= 600) {
            $values=array_column($baseline,'minutes');sort($values);$n=count($values);
            $ride['baselineMinutes']=$n%2 ? $values[intdiv($n,2)] : ($values[$n/2-1]+$values[$n/2])/2;
            $ride['baselineSamples']=$n;
            $ride['baselineWindow']=count($similar)>=12 && count($days)>=2 ? 'similar-hour-30d' : 'recent-6h';
        }
        if (!$mature && is_numeric($historical['rides'][$key] ?? null) && $historical['rides'][$key]>0) {
            $ride['baselineMinutes']=(float)$historical['rides'][$key];$ride['baselineSamples']=null;$ride['baselineWindow']='source-all-time-average';$ride['baselineUpdatedAt']=$historical['fetchedAt'] ?? null;
        }
        usort($observations,fn($a,$b)=>$a['at']<=>$b['at']);
        if ($timestamp !== false && $timestamp >= $now-900 && $timestamp <= $now && ($ride['status']!=='OPERATING'||is_int($ride['minutes']))) {
            $last=count($observations)-1;$previous=$last>=0?$observations[$last]:null;
            $lastSeen=$previous['until'] ?? $previous['at'] ?? 0;$minutes=$ride['status']==='OPERATING'?$ride['minutes']:null;
            if ($timestamp>$lastSeen) {
                if ($previous && ($previous['status'] ?? 'OPERATING')===$ride['status'] && ($previous['minutes'] ?? null)===$minutes && $timestamp-$lastSeen<=900) $observations[$last]['until']=$timestamp;
                else $observations[]=['at'=>$timestamp,'until'=>$timestamp,'minutes'=>$minutes,'status'=>$ride['status']];
            }
        }
        $history[$key]=array_slice($observations,-9000);
    }
    unset($ride); return $rides;
}
function disney_wait_directory(): string { return '/var/lib/weletapi-disney-waits'; }
function disney_historical_values(int $park): array {
    if(!in_array($park,[4,28],true))return [];
    $path=disney_wait_directory().'/historical-'.$park.'.json';
    $cached=is_file($path)?json_decode((string)file_get_contents($path),true):null;
    if(is_array($cached) && is_array($cached['rides'] ?? null))return $cached;
    $seed=json_decode((string)@file_get_contents(__DIR__.'/historical-baselines.json'),true);
    return ['rides'=>$seed['parks'][(string)$park] ?? [],'fetchedAt'=>$seed['fetchedAt'] ?? null];
}
function disney_refresh_historical_values(int $park): void {
    if(!in_array($park,[4,28],true)||!function_exists('curl_init'))return;
    $directory=disney_wait_directory();$path=$directory.'/historical-'.$park.'.json';
    if(is_file($path)&&time()-filemtime($path)<86400)return;
    $lock=@fopen($directory.'/historical-'.$park.'.lock','c');if(!$lock)return;
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return;}
    try {
        $handle=curl_init('https://queue-times.com/parks/'.$park.'/stats');
        curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>8,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_USERAGENT=>'weletapi-Disney/1.0']);
        $body=curl_exec($handle);$status=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);curl_close($handle);
        if($status!==200||!is_string($body)||strlen($body)>2000000)return;
        $parts=explode('Average queue time by ride (all time)',$body,2);if(count($parts)!==2)return;
        $table=explode('</tbody>',$parts[1],2)[0];
        preg_match_all('~/parks/'.$park.'/rides/(\d+)[\s\S]*?</td>\s*<td>\s*(?:<span[^>]*>)?(\d+)~',$table,$matches,PREG_SET_ORDER);
        $values=[];foreach($matches as $match){$minutes=(int)$match[2];if($minutes>=0&&$minutes<=600)$values[$match[1]]=$minutes;}
        if(count($values)<10)return;
        $temporary=tempnam($directory,'history-');if($temporary===false)return;
        if(file_put_contents($temporary,json_encode(['source'=>'Queue-Times.com','fetchedAt'=>gmdate('c'),'rides'=>$values]))!==false)rename($temporary,$path);
        if(is_file($temporary))unlink($temporary);
    } finally {flock($lock,LOCK_UN);fclose($lock);}
}
function disney_wait_times_response(): void {
    header('Content-Type: application/json; charset=utf-8');
    $directory = disney_wait_directory();
    if (!is_dir($directory)) @mkdir($directory,0700,true);
    $parks = [];
    foreach ([4,28] as $id) {
        $path = $directory.'/park-'.$id.'.json';
        $lock = @fopen($directory.'/park-'.$id.'.lock','c');
        $locked = $lock && flock($lock, LOCK_EX | LOCK_NB);
        $cache = is_file($path) ? json_decode((string)@file_get_contents($path),true) : null;
        $valid = is_array($cache) && is_array($cache['rides'] ?? null) && is_int($cache['fetched'] ?? null);
        if ((!$valid || time()-$cache['fetched'] >= 60) && $locked) {
            $rides = disney_fetch_waits($id);
            if ($rides !== null) {
                $history = $valid && is_array($cache['history'] ?? null) ? $cache['history'] : [];
                $rides = disney_wait_baselines($rides,$history,time(),disney_historical_values($id));
                $cache = ['fetched'=>time(),'rides'=>$rides,'history'=>$history];
                $valid = true;
                $temporary = @tempnam($directory,'refresh-');
                if ($temporary !== false) {
                    if (@file_put_contents($temporary,json_encode($cache,JSON_UNESCAPED_UNICODE)) !== false) @rename($temporary,$path);
                    if (is_file($temporary)) @unlink($temporary);
                }
            }
        }
        if ($locked) flock($lock,LOCK_UN);
        if ($lock) fclose($lock);
        $parks[] = ['id'=>$id,'stale'=>!$valid || time()-$cache['fetched'] >= 300,'rides'=>$valid ? $cache['rides'] : []];
    }
    if (!$parks[0]['rides'] && !$parks[1]['rides']) http_response_code(503);
    echo json_encode(['source'=>'Queue-Times.com','fetchedAt'=>gmdate('c'),'parks'=>$parks],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
}

// Only public queue observations for the current Paris day; no user data.
function disney_wait_typical_day(array $observations, int $now, array $hours=[]): array {
    $zone=new DateTimeZone('Europe/Paris');$cutoff=$now-30*86400;$bins=[];$windows=disney_average_windows($hours);
    foreach ($observations as $i=>$sample) {
        if ($sample['status']!=='OPERATING')continue;
        $until=is_int($sample['until'] ?? null)?max($sample['at'],$sample['until']):$sample['at'];$until=min($now,$until);
        $next=$observations[$i+1] ?? null;
        if ($next&&$next['at']-$until<=900)$until=max($until,$next['at']);
        foreach($windows as $window) {
            $cursor=max($cutoff,$sample['at'],$window['start']);$end=min($until,$window['end']);
            while ($cursor<$end) {
                $time=(new DateTimeImmutable('@'.$cursor))->setTimezone($zone);$minute=(int)$time->format('G')*60+(int)$time->format('i');$bucket=intdiv($minute,15)*15;
                $seconds=min($end-$cursor,900-($minute%15)*60-(int)$time->format('s'));
                if ($seconds<=0)break;
                if (!isset($bins[$bucket]))$bins[$bucket]=['weighted'=>0,'seconds'=>0,'dates'=>[]];
                $bins[$bucket]['weighted']+=$sample['minutes']*$seconds;$bins[$bucket]['seconds']+=$seconds;$bins[$bucket]['dates'][$window['date']]=true;$cursor+=$seconds;
            }
        }
    }
    ksort($bins,SORT_NUMERIC);$points=[];$days=[];
    foreach ($bins as $minute=>$bin) {$days+=$bin['dates'];$points[]=['minute'=>$minute,'minutes'=>round($bin['weighted']/$bin['seconds'],1),'days'=>count($bin['dates']),'observedSeconds'=>$bin['seconds']];}
    $range=null;
    foreach($windows as $window){if(!isset($days[$window['date']]))continue;$a=(new DateTimeImmutable('@'.$window['start']))->setTimezone($zone);$b=(new DateTimeImmutable('@'.$window['end']))->setTimezone($zone);$startMinute=(int)$a->format('G')*60+(int)$a->format('i');$endMinute=$b->format('Y-m-d')!==$window['date']?1440:(int)$b->format('G')*60+(int)$b->format('i');$range=['startMinute'=>$range?min($range['startMinute'],$startMinute):$startMinute,'endMinute'=>$range?max($range['endMinute'],$endMinute):$endMinute];}
    if($range&&$points)$range['startMinute']=min($range['startMinute'],min(array_column($points,'minute')));
    return ['samples'=>$points,'days'=>count($days),'range'=>$range];
}
function disney_wait_history_payload(array $cache, array $rideIds, int $now, array $hours=[]): array {
    $zone=new DateTimeZone('Europe/Paris');
    $clock=(new DateTimeImmutable('@'.$now))->setTimezone($zone);$today=$clock->format('Y-m-d');$start=$clock->setTime(0,0)->getTimestamp();$series=[];$typical=[];$todayWindows=array_values(array_filter(disney_average_windows($hours),fn($w)=>$w['date']===$today));
    foreach (array_unique($rideIds) as $id) {
        $observations=[];
        foreach (($cache['history'][(string)$id] ?? []) as $sample) {
            if (!is_array($sample)||!is_int($sample['at'] ?? null)||$sample['at']>$now||$sample['at']<$now-31*86400) continue;
            $status=$sample['status'] ?? 'OPERATING';
            if ($status==='OPERATING'&&(!is_int($sample['minutes'] ?? null)||$sample['minutes']<0||$sample['minutes']>600))continue;
            if (!in_array($status,['OPERATING','CLOSED','UNKNOWN'],true))continue;
            $sample['status']=$status;$observations[$sample['at']]=$sample;
        }
        ksort($observations,SORT_NUMERIC);$observations=array_values($observations);$samples=[];$break=true;$previousUntil=null;
        foreach ($observations as $i=>$sample) {
            $until=is_int($sample['until'] ?? null)?max($sample['at'],$sample['until']):$sample['at'];$until=min($now,$until);
            $next=$observations[$i+1] ?? null;
            if ($next&&$next['at']-$until<=900)$until=max($until,$next['at']);
            if ($sample['status']!=='OPERATING') {$break=true;continue;}
            if ($until<$start)continue;
            $at=max($start,$sample['at']);$samples[]=['at'=>$at,'until'=>$until,'minutes'=>$sample['minutes'],'breakBefore'=>$break||$previousUntil!==null&&$at-$previousUntil>900];
            $previousUntil=$until;$break=false;
        }
        $weighted=0;$seconds=0;
        foreach($samples as $sample)foreach($todayWindows as $window){$duration=max(0,min($sample['until'],$window['end'])-max($sample['at'],$window['start']));$weighted+=$duration*$sample['minutes'];$seconds+=$duration;}
        $series[]=['id'=>$id,'samples'=>$samples,'meanMinutes'=>$seconds>0?$weighted/$seconds:null];$typical[]=['id'=>$id]+disney_wait_typical_day($observations,$now,$hours);
    }
    return ['averageWindows'=>$todayWindows,'hoursSource'=>'ThemeParks.wiki','averageMarginMinutes'=>15,'typical'=>['windowDays'=>30,'intervalMinutes'=>15,'series'=>$typical],'date'=>$today,'fetchedAt'=>$cache['fetched'] ?? null,'stale'=>!is_int($cache['fetched'] ?? null)||$now-$cache['fetched']>=300,'series'=>$series,'source'=>'Queue-Times.com'];
}
function disney_wait_history_response(): void {
    header('Content-Type: application/json; charset=utf-8');
    $park=filter_input(INPUT_GET,'park',FILTER_VALIDATE_INT);$ride=filter_input(INPUT_GET,'ride',FILTER_VALIDATE_INT);$single=filter_input(INPUT_GET,'single',FILTER_VALIDATE_INT);
    if (!in_array($park,[4,28],true)||!is_int($ride)||$ride<=0||($single!==null&&(!is_int($single)||$single<=0))) {http_response_code(400);echo json_encode(['error'=>'Invalid ride']);return;}
    $path=disney_wait_directory().'/park-'.$park.'.json';
    $cache=is_file($path)?json_decode((string)@file_get_contents($path),true):null;
    if (!is_array($cache)) {http_response_code(503);echo json_encode(['error'=>'History unavailable']);return;}
    echo json_encode(disney_wait_history_payload($cache,$single===null?[$ride]:[$ride,$single],time(),disney_park_hours($park)),JSON_INVALID_UTF8_SUBSTITUTE);
}
