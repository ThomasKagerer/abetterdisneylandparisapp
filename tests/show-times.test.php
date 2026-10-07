<?php
require $argv[1];
$actual=disney_normalize_shows(['liveData'=>[['id'=>'valid','status'=>'OPERATING','showtimes'=>[['startTime'=>'2026-10-05T12:30:00+02:00','endTime'=>'2026-10-05T12:50:00+02:00'],['startTime'=>'invalid']]],['id'=>'ride','queue'=>['STANDBY'=>['waitTime'=>5]]]]]);
if(count($actual)!==1||count($actual[0]['showtimes'])!==1||$actual[0]['showtimes'][0]['endTime']!=='2026-10-05T12:50:00+02:00')throw new Exception('Unexpected normalization');
$languages=disney_normalize_shows(['liveData'=>[['id'=>'language','showtimes'=>[['startTime'=>'2026-10-06T13:00:00+02:00','language'=>'fr','languages'=>['fr','en',null],'type'=>'French']]]]]);
$slot=$languages[0]['showtimes'][0];if($slot['language']!=='fr'||$slot['languages']!==['fr','en']||$slot['type']!=='French')throw new Exception('Languages lost');
echo "Passed: valid showtimes only; no attraction wait times or invalid dates as shows.\n";
