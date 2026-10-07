<?php
// Fixed public park calendars. Extra Magic Time never supplies regular hours.
declare(strict_types=1);
function disney_normalize_park_hours(array $payload): array {
    $zone=new DateTimeZone('Europe/Paris');$days=[];
    foreach (($payload['schedule'] ?? []) as $slot) {
        if (!is_array($slot)||($slot['type'] ?? '')!=='OPERATING'||!is_string($slot['date'] ?? null)||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$slot['date']))continue;
        $open=is_string($slot['openingTime'] ?? null)?strtotime($slot['openingTime']):false;$close=is_string($slot['closingTime'] ?? null)?strtotime($slot['closingTime']):false;
        if ($open===false||$close===false||$close<=$open||$close-$open>86400||(new DateTimeImmutable('@'.$open))->setTimezone($zone)->format('Y-m-d')!==$slot['date'])continue;
        $days[$slot['date']][$open.':'.$close]=['open'=>$open,'close'=>$close];
    }
    return array_map('array_values',$days);
}
function disney_park_hours(int $park): array {
    if (!in_array($park,[4,28],true))return [];
    $path=disney_wait_directory().'/hours-'.$park.'.json';$cache=is_file($path)?json_decode((string)@file_get_contents($path),true):null;
    return is_array($cache)&&is_array($cache['days'] ?? null)?$cache['days']:[];
}
function disney_refresh_park_hours(int $park): void {
    $entities=[4=>'dae968d5-630d-4719-8b06-3d107e944401',28=>'ca888437-ebb4-4d50-aed2-d227f7096968'];
    if (!isset($entities[$park])||!function_exists('curl_init'))return;
    $directory=disney_wait_directory();$path=$directory.'/hours-'.$park.'.json';$cache=is_file($path)?json_decode((string)@file_get_contents($path),true):null;$now=time();
    if (is_array($cache)&&is_int($cache['fetchedAt'] ?? null)&&$now-$cache['fetchedAt']<3600)return;
    $lock=@fopen($path.'.lock','c');if(!$lock)return;
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return;}
    try {
        $days=disney_park_hours($park);$month=(new DateTimeImmutable('now',new DateTimeZone('Europe/Paris')))->modify('first day of this month');$received=false;
        foreach([$month->modify('-1 month'),$month] as $date) {
            $url='https://api.themeparks.wiki/v1/entity/'.$entities[$park].'/schedule/'.$date->format('Y/m');$handle=curl_init($url);
            curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>8,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_USERAGENT=>'weletapi-Disney/1.0',CURLOPT_HTTPHEADER=>['Accept: application/json']]);
            $body=curl_exec($handle);$status=curl_getinfo($handle,CURLINFO_RESPONSE_CODE);curl_close($handle);
            $payload=is_string($body)&&strlen($body)<2000000?json_decode($body,true):null;
            if($status!==200||!is_array($payload)||!is_array($payload['schedule'] ?? null)||($payload['id'] ?? null)!==$entities[$park])continue;
            $normalized=disney_normalize_park_hours($payload);if(!$normalized)continue;
            $days=array_replace($days,$normalized);$received=true;
        }
        if(!$received)return;
        $cutoff=$month->modify('-31 days')->format('Y-m-d');$days=array_filter($days,fn($date)=>$date>=$cutoff,ARRAY_FILTER_USE_KEY);ksort($days);
        $tmp=tempnam($directory,'hours-');if($tmp!==false){file_put_contents($tmp,json_encode(['fetchedAt'=>$now,'days'=>$days,'source'=>'ThemeParks.wiki']));chmod($tmp,0600);rename($tmp,$path);}
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function disney_average_windows(array $hours): array {
    $windows=[];
    foreach($hours as $date=>$slots){
        if(!is_array($slots))continue;
        $valid=array_values(array_filter($slots,fn($slot)=>is_array($slot)&&is_int($slot['open'] ?? null)&&is_int($slot['close'] ?? null)&&$slot['close']>$slot['open']));usort($valid,fn($a,$b)=>$a['open']<=>$b['open']);$merged=[];
        foreach($valid as $slot){$last=count($merged)-1;if($last>=0&&$slot['open']<=$merged[$last]['close'])$merged[$last]['close']=max($merged[$last]['close'],$slot['close']);else $merged[]=$slot;}
        foreach($merged as $slot)if($slot['close']-$slot['open']>1800)$windows[]=['date'=>$date,'start'=>$slot['open']+900,'end'=>$slot['close']-900];
    }
    usort($windows,fn($a,$b)=>$a['start']<=>$b['start']);return $windows;
}
