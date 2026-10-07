<?php
require $argv[1];
$secret=str_repeat('a',64);$id=str_repeat('b',64);
$valid=$id.'.'.hash_hmac('sha256','device:'.$id,$secret);
if(disney_public_token($valid,$secret)!==$id)throw new Exception('Signed device rejected');
foreach(['',$id,$id.'.'.str_repeat('0',64),str_repeat('c',64).'.'.substr($valid,65),$valid.'/../'] as $bad){
    if(disney_public_token($bad,$secret)!==null)throw new Exception('Forged device accepted');
}
if(disney_public_token($valid,str_repeat('c',64))!==null)throw new Exception('Wrong app key accepted');
echo "Passed: signed host-only device identity; altered, unsigned and wrong-key cookies rejected.\n";
