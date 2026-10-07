<?php
// Called only after index.php verifies the signed-in active user.
declare(strict_types=1);
function disney_push_dir(): string { return '/var/lib/weletapi-disney-push'; }
function disney_push_language($value): string { return in_array($value,['de','fr','it','es','zh-Hans','ja','ko','ar'],true)?$value:'de'; }
function disney_push_valid_subscription(array $s): bool {
    $u=parse_url($s['endpoint'] ?? '');$host=strtolower($u['host'] ?? '');
    $allowed=$host==='web.push.apple.com'||substr($host,-19)==='.web.push.apple.com'||$host==='fcm.googleapis.com'||$host==='updates.push.services.mozilla.com';
    $decode=fn($v)=>is_string($v)?base64_decode(strtr($v,'-_','+/'),true):false;
    $p=$decode($s['keys']['p256dh'] ?? null);$a=$decode($s['keys']['auth'] ?? null);
    return $allowed&&($u['scheme'] ?? '')==='https'&&empty($u['user'])&&empty($u['pass'])&&(!isset($u['port'])||$u['port']===443)&&strlen($s['endpoint'])<=2048&&strlen($u['path'] ?? '')>1&&is_string($p)&&strlen($p)===65&&ord($p[0])===4&&is_string($a)&&strlen($a)===16;
}
function disney_push_response(string $user,string $csrf): void {
    header('Content-Type: application/json; charset=utf-8');$dir=disney_push_dir();
    if($_SERVER['REQUEST_METHOD']==='GET'){$keys=is_file($dir.'/enabled')?json_decode((string)@file_get_contents($dir.'/vapid.json'),true):null;echo json_encode(['publicKey'=>$keys['publicKey'] ?? null,'csrf'=>$csrf]);return;}
    if(!is_file($dir.'/enabled')){http_response_code(503);echo '{"error":"Push disabled"}';return;}
    if($_SERVER['REQUEST_METHOD']!=='POST'||!hash_equals($csrf,(string)($_SERVER['HTTP_X_DISNEY_CSRF'] ?? ''))||($_SERVER['HTTP_ORIGIN'] ?? '')!==(defined('DISNEY_PUBLIC_ORIGIN')?DISNEY_PUBLIC_ORIGIN:'https://weletapi.com')){http_response_code(403);echo '{"error":"Forbidden"}';return;}
    $body=file_get_contents('php://input',false,null,0,32769);$input=strlen($body)<=32768?json_decode($body,true):null;$s=$input['subscription'] ?? null;
    if(!is_array($s)||!disney_push_valid_subscription($s)){http_response_code(400);echo '{"error":"Invalid subscription"}';return;}
    $id=hash('sha256',$s['endpoint']);$path=$dir.'/subscriptions/'.$id.'.json';$lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX)){http_response_code(503);return;}
    try {
        $old=is_file($path)?json_decode((string)file_get_contents($path),true):null;
        if($old&&($old['user'] ?? '')!==$user){http_response_code(403);echo '{"error":"Subscription owner"}';return;}
        $action=$input['action'] ?? '';
        if($action==='unsubscribe'){if(is_file($path))unlink($path);echo '{"ok":true}';return;}
        if(!in_array($action,['subscribe','context','test'],true)||($action!=='subscribe'&&!$old)){http_response_code(400);echo '{"error":"Action"}';return;}
        $state=$old ?? ['user'=>$user,'subscription'=>$s,'createdAt'=>time(),'context'=>null];
        if($action==='subscribe')$state['subscription']=$s;
        $state['language']=disney_push_language($input['language'] ?? ($state['language'] ?? 'de'));
        if(is_int($input['appBuild'] ?? null)&&$input['appBuild']>0&&$input['appBuild']<1000000)$state['appBuild']=$input['appBuild'];
        if($action==='context'){
            $context=is_array($input['context'] ?? null)?$input['context']:[];$catalog=json_decode(file_get_contents(__DIR__.'/ride-summary.json'),true);$ids=array_column($catalog['rides'],'id');$entries=[];
            foreach(array_slice(is_array($context['candidates'] ?? null)?$context['candidates']:[],0,100) as $c){if(!is_array($c)||!in_array($c['id'] ?? '',$ids,true))continue;$m=$c['meters'] ?? null;$extra=$c['extraWalkingMinutes'] ?? null;if(!is_numeric($m)||$m<0||$m>1300)continue;$entries[]=['id'=>$c['id'],'meters'=>round($m),'extraWalkingMinutes'=>is_numeric($extra)?max(0,min(30,(float)$extra)):null,'favorite'=>($c['favorite'] ?? false)===true];}
            $state['context']=empty($context['active'])?null:['at'=>time(),'candidates'=>$entries,'includeSingleRider'=>($context['includeSingleRider'] ?? false)===true];
        }
        if($action==='test'){
            if(time()-($state['testAt'] ?? 0)<30){http_response_code(429);echo '{"error":"Please wait"}';return;}$state['testAt']=time();
        }
        $state['updatedAt']=time();if(defined('DISNEY_PUBLIC_ORIGIN'))$state['publicApp']=true;$tmp=tempnam($dir.'/subscriptions','sub-');file_put_contents($tmp,json_encode($state));chmod($tmp,0600);rename($tmp,$path);
        if($action==='test'){
            $command='/usr/bin/node '.escapeshellarg((getenv('DISNEY_PUSH_SENDER') ?: $dir.'/sender.cjs')).' --test '.escapeshellarg($path);
            $pipes=[];$process=proc_open($command,[0=>['pipe','r'],1=>['pipe','w'],2=>['file','/dev/null','a']],$pipes);
            if(!is_resource($process)){http_response_code(503);echo '{"error":"Push unavailable"}';return;}
            fclose($pipes[0]);$output=stream_get_contents($pipes[1]);fclose($pipes[1]);$code=proc_close($process);
            if($code!==0){http_response_code(502);echo '{"error":"Push delivery failed"}';return;}
        }
        echo '{"ok":true}';
    } finally {flock($lock,LOCK_UN);fclose($lock);}
}
