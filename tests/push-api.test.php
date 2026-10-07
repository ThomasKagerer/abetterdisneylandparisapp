<?php
require $argv[1];
$encode=fn($x)=>rtrim(strtr(base64_encode($x),'+/','-_'),'=');$keys=['p256dh'=>$encode("\x04".str_repeat('a',64)),'auth'=>$encode(str_repeat('a',16))];
foreach(['https://web.push.apple.com/Q/abc','https://sub.web.push.apple.com/Q/abc','https://fcm.googleapis.com/fcm/send/abc','https://updates.push.services.mozilla.com/wpush/v2/abc'] as $url)if(!disney_push_valid_subscription(['endpoint'=>$url,'keys'=>$keys]))throw new Exception('Valid endpoint rejected');
foreach(['http://web.push.apple.com/Q/abc','https://web.push.apple.com.attacker.test/Q/abc','https://127.0.0.1/push','https://fcm.googleapis.com:4433/push','https://user@web.push.apple.com/Q/abc'] as $url)if(disney_push_valid_subscription(['endpoint'=>$url,'keys'=>$keys]))throw new Exception('Invalid endpoint accepted');
if(disney_push_valid_subscription(['endpoint'=>'https://web.push.apple.com/Q/abc','keys'=>['p256dh'=>'wrong','auth'=>'wrong']]))throw new Exception('Invalid keys');
foreach(['en','de','fr','it','es','zh-Hans','ja','ko','ar'] as $language)if(disney_push_language($language)!==$language)throw new Exception('Locale rejected');
foreach(['fr-FR','../../ar',null,[],123] as $language)if(disney_push_language($language)!=='en')throw new Exception('Invalid locale accepted');
echo "Passed: push host allowlist, TLS, port/userinfo and Web Push key validation.\n";
