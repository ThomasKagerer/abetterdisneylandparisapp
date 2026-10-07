<?php
require ($argv[1] ?? dirname(__DIR__).'/dist/wait-times.php');
function verify(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
$rides=disney_normalize_waits(['rides'=>[['id'=>1,'is_open'=>true,'wait_time'=>0,'last_updated'=>'2026-10-05T09:30:00Z'],['id'=>2,'is_open'=>false,'wait_time'=>0,'last_updated'=>'2026-10-05T09:30:00Z']],'lands'=>[['rides'=>[['id'=>3,'wait_time'=>-1,'last_updated'=>'invalid'],['id'=>4,'is_open'=>'false','wait_time'=>25]]]]]);
verify(count($rides)===4,'Both top-level and land rides');
verify($rides[0]['minutes']===0 && $rides[0]['status']==='OPERATING','Real zero wait is retained');
verify($rides[1]['status']==='CLOSED','Closed is not zero wait');
verify($rides[2]['minutes']===null && $rides[2]['updatedAt']===null && $rides[2]['status']==='UNKNOWN','Invalid and missing data remain unknown');
verify($rides[3]['status']==='UNKNOWN','Non-boolean open flag is not trusted');
verify(disney_fetch_waits(99)===null,'Only the two fixed parks can be requested');
echo "Passed: PHP queue normalization, closed/zero/missing distinction, invalid fields, fixed park allowlist.\n";

$now=strtotime('2026-10-05T10:00:00Z');$history=['7'=>[['at'=>$now-1200,'minutes'=>40],['at'=>$now-900,'minutes'=>50],['at'=>$now-600,'minutes'=>45]]];
$entry=['id'=>7,'status'=>'OPERATING','minutes'=>10,'updatedAt'=>gmdate('c',$now)];$new=disney_wait_baselines([$entry],$history,$now);
verify($new[0]['baselineMinutes']===45 && $new[0]['baselineSamples']===3,'Baseline median from three prior samples');
verify(count($history['7'])===4,'Current sample retained');disney_wait_baselines([$entry],$history,$now);verify(count($history['7'])===4,'Repeated upstream timestamp not duplicated');
$empty=[];$first=disney_wait_baselines([$entry],$empty,$now);verify(!isset($first[0]['baselineMinutes']),'No invented baseline on first sync');
$closed=$entry;$closed['status']='CLOSED';$closed['updatedAt']=gmdate('c',$now+300);disney_wait_baselines([$closed],$history,$now+300);verify(count($history['7'])===5 && $history['7'][4]['status']==='CLOSED','Closure stored as a state change, excluded from baseline');
echo "Passed: rolling wait baselines, unique source timestamps, no invented baseline, and closed rides excluded.\n";
$long=[];for($day=1;$day<=2;$day++)for($i=0;$i<6;$i++)$long['7'][]=['at'=>$now-$day*86400-$i*300,'minutes'=>40];
$long['7'][]=['at'=>$now-86400-5*3600,'minutes'=>200];$long['7'][]=['at'=>$now-31*86400,'minutes'=>600];
$historical=disney_wait_baselines([$entry],$long,$now);
verify($historical[0]['baselineMinutes']===40 && $historical[0]['baselineSamples']===12 && $historical[0]['baselineWindow']==='similar-hour-30d','Compare similar Paris local time across days');
verify(count($long['7'])===14,'Retain 30 days and exclude older samples');
echo "Passed: multi-day normal values at similar local hour, 30-day retention, and separate current sample.\n";
$seed=['rides'=>['7'=>44],'fetchedAt'=>'2026-10-05'];$empty=[];$external=disney_wait_baselines([$entry],$empty,$now,$seed);
verify($external[0]['baselineMinutes']===44.0 && $external[0]['baselineSamples']===null && $external[0]['baselineWindow']==='source-all-time-average','Public historical average is a fallback, without inventing sample count');
$matched=disney_wait_baselines([$entry],$long,$now,$seed);verify($matched[0]['baselineMinutes']===40 && $matched[0]['baselineWindow']==='similar-hour-30d','Mature local-hour data takes priority over all-time source average');
echo "Passed: source historical fallback and mature own-history priority.\n";

$now=strtotime('2026-10-06T22:30:00Z'); // 00:30 in Paris, October 7.
$cache=['fetched'=>$now,'history'=>['7'=>[
 ['at'=>$now-600,'minutes'=>20],['at'=>$now-1200,'minutes'=>0],['at'=>$now-600,'minutes'=>30],
 ['at'=>$now-3600,'minutes'=>99],['at'=>$now+1,'minutes'=>500],['at'=>$now-1,'minutes'=>-1],['at'=>'invalid','minutes'=>5]
],'8'=>[['at'=>$now-300,'minutes'=>5]]]];
$day=disney_wait_history_payload($cache,[7,8],$now);
verify($day['date']==='2026-10-07','History uses the Paris day rather than UTC');
verify(array_column($day['series'][0]['samples'],'minutes')===[0,30] && array_column($day['series'][0]['samples'],'at')===[$now-1200,$now-600],'Today only, sorted, deduplicated, valid samples; real zero retained');
verify($day['series'][1]['samples'][0]['minutes']===5,'Separate Single Rider history');
verify(!$day['stale'],'Fresh history marked fresh');
verify(disney_wait_history_payload($cache,[7],$now+300)['stale'],'Old cache marked stale');
verify(disney_wait_history_payload($cache,[999],$now)['series'][0]['samples']===[],'Missing ride history stays empty');
echo "Passed: daily Paris queue history, unique sorted observations, zero, Single Rider, invalid/future/previous-day exclusion and stale status.\n";

$timeline=[];$base=['id'=>77,'status'=>'OPERATING','minutes'=>20,'updatedAt'=>gmdate('c',$now)];
disney_wait_baselines([$base],$timeline,$now);
$base['updatedAt']=gmdate('c',$now+60);disney_wait_baselines([$base],$timeline,$now+60);
verify(count($timeline['77'])===1 && $timeline['77'][0]['until']===$now+60,'Unchanged wait extends confirmed duration without inserting another point');
$base['minutes']=40;$base['updatedAt']=gmdate('c',$now+120);disney_wait_baselines([$base],$timeline,$now+120);verify(count($timeline['77'])===2,'Changed wait inserts a point');
$base['status']='CLOSED';$base['updatedAt']=gmdate('c',$now+180);disney_wait_baselines([$base],$timeline,$now+180);
$base['status']='OPERATING';$base['updatedAt']=gmdate('c',$now+240);disney_wait_baselines([$base],$timeline,$now+240);
$plot=disney_wait_history_payload(['fetched'=>$now+240,'history'=>$timeline],[77],$now+240);
verify(count($plot['series'][0]['samples'])===3 && $plot['series'][0]['samples'][2]['breakBefore'],'Reopening starts a new chart segment, closures are not zero waits');
verify($plot['series'][0]['samples'][0]['until']===$now+120,'Confirmed unchanged plateau extends until next change');
$base['updatedAt']=gmdate('c',$now+1800);disney_wait_baselines([$base],$timeline,$now+1800);verify(count($timeline['77'])===5,'Long observation gaps cannot extend an old plateau');
echo "Passed: unchanged values compressed, duration retained, changes/closure/reopening recorded, gap preserved.\n";

$at=strtotime('2026-10-06T08:30:00+02:00');$testHours=['2026-10-05'=>[['open'=>$at-86400-1800,'close'=>$at-86400+7200]],'2026-10-06'=>[['open'=>$at-1800,'close'=>$at+7200]],'2026-10-25'=>[['open'=>strtotime('2026-10-25T00:00:00Z'),'close'=>strtotime('2026-10-25T04:00:00Z')]]];$typical=disney_wait_typical_day([
 ['at'=>$at-86400,'until'=>$at-86400+900,'minutes'=>20,'status'=>'OPERATING'],
 ['at'=>$at,'until'=>$at+300,'minutes'=>60,'status'=>'OPERATING'],
 ['at'=>$at+300,'until'=>$at+900,'minutes'=>30,'status'=>'OPERATING'],
 ['at'=>$at+900,'until'=>$at+1800,'minutes'=>null,'status'=>'CLOSED'],
 ['at'=>$at+1800,'until'=>$at+2100,'minutes'=>0,'status'=>'OPERATING'],
 ['at'=>$at-31*86400,'until'=>$at-31*86400+900,'minutes'=>600,'status'=>'OPERATING']
],$at+3600,$testHours);
verify($typical['days']===2,'All recorded days contribute, not only today');
verify($typical['samples'][0]['minute']===510 && $typical['samples'][0]['minutes']===30.0 && $typical['samples'][0]['days']===2,'15-minute mean weights confirmed durations across days');
verify($typical['samples'][1]['minute']===540 && $typical['samples'][1]['minutes']===0.0,'Closed bucket is absent, actual open zero remains');
verify(count($typical['samples'])===2,'Old data and closures cannot create invented bins');
$boundary=disney_wait_typical_day([['at'=>$at+14*60,'until'=>$at+16*60,'minutes'=>10,'status'=>'OPERATING']],$at+3600,$testHours);
verify(array_column($boundary['samples'],'minute')===[510,525] && array_column($boundary['samples'],'observedSeconds')===[60,60],'Interval crossing a quarter hour is split precisely');
$dst=disney_wait_typical_day([['at'=>strtotime('2026-10-25T00:45:00Z'),'until'=>strtotime('2026-10-25T01:15:00Z'),'minutes'=>25,'status'=>'OPERATING']],strtotime('2026-10-25T02:00:00Z'),$testHours);
verify(array_column($dst['samples'],'minute')===[120,165],'Repeated DST hour uses Paris clock buckets');
echo "Passed: historical 15-minute means, time weights, day counts, bucket boundaries, closures, zero, 30-day window and Paris DST.\n";

$open=strtotime('2026-10-06T09:30:00+02:00');$close=strtotime('2026-10-06T22:00:00+02:00');
$hours=disney_normalize_park_hours(['schedule'=>[
 ['date'=>'2026-10-06','type'=>'EXTRA_HOURS','openingTime'=>'2026-10-06T08:30:00+02:00','closingTime'=>'2026-10-06T09:30:00+02:00'],
 ['date'=>'2026-10-06','type'=>'OPERATING','openingTime'=>'2026-10-06T09:30:00+02:00','closingTime'=>'2026-10-06T22:00:00+02:00'],
 ['date'=>'2026-10-06','type'=>'OPERATING','openingTime'=>'bad','closingTime'=>'bad'],
 ['date'=>'2026-10-05','type'=>'OPERATING','openingTime'=>'2026-10-06T09:30:00+02:00','closingTime'=>'2026-10-06T22:00:00+02:00']
]]);
verify(count($hours)===1 && $hours['2026-10-06'][0]['open']===$open,'Only valid regular opening hours, no Extra Magic Time or wrong date');
verify(disney_average_windows($hours)===[['date'=>'2026-10-06','start'=>$open+900,'end'=>$close-900]],'Fifteen minutes removed at each end');
$obs=[['at'=>$open-3600,'until'=>$open+900,'minutes'=>5,'status'=>'OPERATING'],['at'=>$open+900,'until'=>$close-900,'minutes'=>40,'status'=>'OPERATING'],['at'=>$close-900,'until'=>$close+300,'minutes'=>5,'status'=>'OPERATING']];
$trimmed=disney_wait_typical_day($obs,$close+600,$hours);
verify(count($trimmed['samples'])===48 && $trimmed['samples'][0]['minute']===585 && end($trimmed['samples'])['minute']===1290,'Only bins from 09:45 to 21:45 are included');
verify(array_unique(array_column($trimmed['samples'],'minutes'))===[40.0],'Both edge periods and Extra Magic Time are excluded');
verify(disney_wait_typical_day($obs,$close+600,[])['samples']===[],'Missing opening hours do not invent an average');
$overlap=['2026-10-06'=>[['open'=>$open,'close'=>$close],['open'=>$open,'close'=>$close]]];verify(count(disney_average_windows($overlap))===1,'Duplicate or overlapping hours cannot count the same duration twice');
$day=disney_wait_history_payload(['fetched'=>$close,'history'=>['7'=>$obs]],[7],$close+600,$hours);verify(abs($day['series'][0]['meanMinutes']-40)<0.001,'Today mean also excludes edge times while keeping actual chart points');
echo "Passed: confirmed per-day regular opening +15 / closing -15, Extra Magic exclusion, exact boundaries, unknown hours, overlap and today mean.\n";
verify($trimmed['range']===['startMinute'=>585,'endMinute'=>1305],'Chart axis spans the complete permitted park window');
$sparse=disney_wait_typical_day([['at'=>$open+7200,'until'=>$open+10800,'minutes'=>45,'status'=>'OPERATING']],$close+600,$hours);
verify($sparse['range']===['startMinute'=>585,'endMinute'=>1305] && $sparse['samples'][0]['minute']===690,'Late recording keeps early permitted hours on the axis without inventing measurements');
echo "Passed: full allowed chart axis with honest missing early data.\n";
