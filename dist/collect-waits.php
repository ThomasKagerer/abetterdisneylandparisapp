<?php
// CLI collector invoked by the server scheduler; never a public web endpoint.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__.'/wait-times.php';
foreach([4,28] as $park)disney_refresh_historical_values($park);
ob_start();
disney_wait_times_response();
$response=json_decode(ob_get_clean(),true);
if (empty($response['parks'][0]['rides']) && empty($response['parks'][1]['rides'])) exit(1);

foreach([4,28] as $park)disney_refresh_park_hours($park);
