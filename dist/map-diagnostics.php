<?php
// Called only after the existing active-user session check in index.php.
declare(strict_types=1);
function disney_diagnostic_text($value): string {
    if(!is_string($value))return '';
    $text=preg_replace(['~(?:https?://|file://|blob:)[^\s]+~i','~[\w.+-]+@[\w.-]+~','~-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+~','~-?\d{1,3}\.\d{3,}~','~[a-f0-9]{24,}~i','~[\x00-\x1f<>]~'],['[url]','[email]','[coordinates]','[number]','[token]',' '],$value);
    return substr($text ?? '',0,240);
}
function disney_normalize_diagnostic(array $input): ?array {
    $names=['open','close','attempt','library-ready','scene-ready','map-created','first-frame','source-ready','loading-move','map-load','ready','context-lost','recovering','failed','renderer-error','mesh-ready','mesh-error','roof-texture-ready','roof-texture-error','signs-ready','signs-error','roof-lettering-ready','roof-lettering-error','view-error','manual','previous-interrupted'];
    if(!is_int($input['build'] ?? null)||$input['build']<1||$input['build']>1000000||!in_array($input['reason'] ?? null,$names,true)||!is_array($input['events'] ?? null))return null;
    $env=is_array($input['environment'] ?? null)?$input['environment']:[];$safeEnv=[];
    foreach(['browser'=>['Safari','Chrome iOS','Chrome','Edge','Firefox','Other'],'platform'=>['iOS','Android','macOS','Windows','Other']] as $key=>$allowed)$safeEnv[$key]=in_array($env[$key] ?? null,$allowed,true)?$env[$key]:'Other';
    if(is_string($env['version'] ?? null)&&preg_match('/\A\d{1,3}(?:\.\d{1,3})?\z/',$env['version']))$safeEnv['version']=$env['version'];
    if(is_string($env['osVersion'] ?? null)&&preg_match('/\A\d{1,3}(?:\.\d{1,3}){0,2}\z/',$env['osVersion']))$safeEnv['osVersion']=$env['osVersion'];
    foreach(['pixelRatio'=>10,'width'=>10000,'height'=>10000] as $key=>$max)if(is_numeric($env[$key] ?? null))$safeEnv[$key]=max(0,min($max,(float)$env[$key]));
    if(is_string($env['model'] ?? null)){ $model=disney_diagnostic_text($env['model']);if(preg_match('/\A[A-Za-z][A-Za-z0-9 ()+.,_-]{1,63}\z/',$model)){$safeEnv['model']=$model;$safeEnv['modelSource']=($env['modelSource'] ?? '')==='browser'?'browser':'manual';}}
    $safeEnv['standalone']=($env['standalone'] ?? false)===true;$events=[];
    foreach(array_slice($input['events'],-32) as $event){
        if(!is_array($event)||!in_array($event['name'] ?? null,$names,true))continue;$safe=['name'=>$event['name']];
        foreach(['atMs','attempt','elapsedMs','frames','moves','sourceUpdates','pixelRatio','trees','features','vertices','bufferBytes','width','height','drawingWidth','drawingHeight','maxTextureSize','maxRenderbufferSize','zoom','pitch','httpStatus'] as $key)if(is_numeric($event[$key] ?? null))$safe[$key]=max(-1,min(1e9,(float)$event[$key]));
        foreach(['loaded','styleLoaded','sourceLoaded','contextLost','visible','roofs'] as $key)if(is_bool($event[$key] ?? null))$safe[$key]=$event[$key];
        foreach(['message','errorName','code','vendor','renderer'] as $key)if(is_string($event[$key] ?? null))$safe[$key]=disney_diagnostic_text($event[$key]);
        if(in_array($event['source'] ?? null,['park','navigation','accuracy'],true))$safe['source']=$event['source'];$events[]=$safe;
    }
    if(!$events)return null;return ['build'=>$input['build'],'reason'=>$input['reason'],'environment'=>$safeEnv,'events'=>$events];
}
function disney_store_diagnostic(string $dir,string $user,array $report,int $now): ?string {
    if(!is_dir($dir)||!is_writable($dir))throw new RuntimeException('Diagnostic storage unavailable');
    $rate=$dir.'/rate-'.hash('sha256',$user).'.json';$lock=fopen($rate.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Diagnostic lock unavailable');
    try{
        $window=is_file($rate)?json_decode((string)file_get_contents($rate),true):null;if(!is_array($window)||$now-($window['at'] ?? 0)>=3600)$window=['at'=>$now,'count'=>0];if(($window['count'] ?? 0)>=20)return null;
        $id=bin2hex(random_bytes(6));$report['id']=$id;$report['receivedAt']=$now;$tmp=tempnam($dir,'tmp-');if($tmp===false)throw new RuntimeException('Diagnostic write unavailable');
        if(file_put_contents($tmp,json_encode($report,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE))===false){unlink($tmp);throw new RuntimeException('Diagnostic write failed');}chmod($tmp,0600);rename($tmp,$dir.'/report-'.$id.'.json');
        $window['count']++;file_put_contents($rate,json_encode($window),LOCK_EX);chmod($rate,0600);chmod($rate.'.lock',0600);
        $files=glob($dir.'/report-*.json') ?: [];foreach($files as $file)if(filemtime($file)<$now-7*86400)unlink($file);$files=glob($dir.'/report-*.json') ?: [];if(count($files)>1000){usort($files,fn($a,$b)=>filemtime($a)<=>filemtime($b));foreach(array_slice($files,0,count($files)-1000) as $file)unlink($file);}
        return $id;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function disney_diagnostics_response(string $user,string $csrf): void {
    header('Content-Type: application/json; charset=utf-8');
    if($_SERVER['REQUEST_METHOD']==='GET'){echo json_encode(['csrf'=>$csrf]);return;}
    if($_SERVER['REQUEST_METHOD']!=='POST'||($_SERVER['HTTP_ORIGIN'] ?? '')!==(defined('DISNEY_PUBLIC_ORIGIN')?DISNEY_PUBLIC_ORIGIN:'https://weletapi.com')||!hash_equals($csrf,(string)($_SERVER['HTTP_X_DISNEY_CSRF'] ?? ''))){http_response_code(403);echo '{"error":"Forbidden"}';return;}
    $body=file_get_contents('php://input',false,null,0,16385);$input=strlen($body)<=16384?json_decode($body,true):null;$report=is_array($input)?disney_normalize_diagnostic($input):null;
    if(!$report){http_response_code(400);echo '{"error":"Invalid report"}';return;}
    try{$id=disney_store_diagnostic('/var/lib/weletapi-disney-diagnostics',$user,$report,time());if($id===null){http_response_code(429);echo '{"error":"Rate limit"}';return;}echo json_encode(['ok'=>true,'id'=>$id]);}catch(Throwable $e){http_response_code(503);echo '{"error":"Unavailable"}';}
}
