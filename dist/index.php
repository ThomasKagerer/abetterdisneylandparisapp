<?php
// All application requests, including assets, pass this controller on weletapi.
declare(strict_types=1);
require_once '/mnt/backup/webdav/auth/qr_lib.php';
weletapi_session_start();
$user = (string)($_SESSION['uid'] ?? '');
header('Cache-Control: no-store, private');
header('Permissions-Policy: geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self), screen-wake-lock=(self), microphone=(), camera=(), payment=()');
if ($user === '' || !weletapi_user_is_active($user)) {
    session_write_close();
    if (isset($_GET['session']) || isset($_GET['asset']) || isset($_GET['version']) || isset($_GET['diagnostics'])) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error'=>'Not authenticated']);
    } else {
        header('Location: /auth/?path=' . rawurlencode('/files/.internal/Disney/'));
    }
    exit;
}
if(empty($_SESSION['disney_push_csrf']))$_SESSION['disney_push_csrf']=bin2hex(random_bytes(32));
$pushCsrf=$_SESSION['disney_push_csrf'];
session_write_close();
if(isset($_GET['diagnostics'])){require __DIR__.'/map-diagnostics.php';disney_diagnostics_response($user,$pushCsrf);exit;}
if(isset($_GET['push'])){require __DIR__.'/push-api.php';disney_push_response($user,$pushCsrf);exit;}
if (isset($_GET['shows'])) {
    require __DIR__.'/show-times.php';
    disney_show_times_response();
    exit;
}
if (isset($_GET['waitHistory'])) {
    require __DIR__.'/wait-times.php';
    disney_wait_history_response();
    exit;
}
if (isset($_GET['waits'])) {
    require __DIR__.'/wait-times.php';
    disney_wait_times_response();
    exit;
}
if (isset($_GET['session'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['user'=>$user]);
    exit;
}
if (isset($_GET['version']) || isset($_GET['diagnostics'])) {
    header('Content-Type: application/json; charset=utf-8');
    $html = file_get_contents(__DIR__.'/index.html');
    preg_match('/app\.js\?v=(\d+)/', $html ?: '', $matches);
    $build=(int)($matches[1] ?? 0);
    $notes=json_decode((string)@file_get_contents(__DIR__.'/release-notes.json'),true);
    echo json_encode(['build'=>$build,'items'=>is_array($notes)&&($notes['build'] ?? 0)===$build?($notes['items'] ?? []):[]]);
    exit;
}
$asset = (string)($_GET['asset'] ?? 'index.html');
$allowed = ['startup.js'=>'application/javascript; charset=utf-8','manifest-de.webmanifest'=>'application/manifest+json','manifest-en.webmanifest'=>'application/manifest+json','manifest-fr.webmanifest'=>'application/manifest+json','manifest-it.webmanifest'=>'application/manifest+json','manifest-es.webmanifest'=>'application/manifest+json','manifest-zh-Hans.webmanifest'=>'application/manifest+json','manifest-ja.webmanifest'=>'application/manifest+json','manifest-ko.webmanifest'=>'application/manifest+json','manifest-ar.webmanifest'=>'application/manifest+json','i18n.js'=>'application/javascript; charset=utf-8','i18n-messages.js'=>'application/javascript; charset=utf-8','official-names.js'=>'application/javascript; charset=utf-8','map-diagnostics.js'=>'application/javascript; charset=utf-8','map-3d.js'=>'application/javascript; charset=utf-8','park-models.js'=>'application/javascript; charset=utf-8','park-scene.json'=>'application/json; charset=utf-8','vendor/maplibre-gl.css'=>'text/css; charset=utf-8','vendor/maplibre-gl.mjs'=>'application/javascript; charset=utf-8','vendor/maplibre-gl-shared.mjs'=>'application/javascript; charset=utf-8','vendor/maplibre-gl-worker.mjs'=>'application/javascript; charset=utf-8','vendor/maplibre-gl.LICENSE.txt'=>'text/plain; charset=utf-8','swipe-list.js'=>'application/javascript; charset=utf-8','chart-interaction.js'=>'application/javascript; charset=utf-8','restaurant-search.js'=>'application/javascript; charset=utf-8','restaurant-ratings.js'=>'application/javascript; charset=utf-8','preferences.js'=>'application/javascript; charset=utf-8','surfaces.js'=>'application/javascript; charset=utf-8','index.html'=>'text/html; charset=utf-8','app.js'=>'application/javascript; charset=utf-8','disney-guide.js'=>'application/javascript; charset=utf-8','wait-times.js'=>'application/javascript; charset=utf-8','show-times.js'=>'application/javascript; charset=utf-8','push-client.js'=>'application/javascript; charset=utf-8','child-access.js'=>'application/javascript; charset=utf-8','ratings.js'=>'application/javascript; charset=utf-8','queue-dwell.js'=>'application/javascript; charset=utf-8','routing.js'=>'application/javascript; charset=utf-8','route-worker.js'=>'application/javascript; charset=utf-8','sw.js'=>'application/javascript; charset=utf-8','style.css'=>'text/css; charset=utf-8','park-data.json'=>'application/json; charset=utf-8','manifest.webmanifest'=>'application/manifest+json','icon.svg'=>'image/svg+xml','icon-192.png'=>'image/png','icon-512.png'=>'image/png','disney-original.png'=>'image/png','vendor/leaflet-rotate.js'=>'application/javascript; charset=utf-8','vendor/leaflet.js'=>'application/javascript; charset=utf-8','vendor/leaflet.css'=>'text/css; charset=utf-8'];
if (preg_match('~\Aphotos/[a-f0-9]{16}\.(webp|gif)\z~', $asset, $photoType)) { $allowed[$asset] = 'image/' . $photoType[1]; }
if (!isset($allowed[$asset]) || !is_file(__DIR__.'/'.$asset)) { http_response_code(404); exit; }
header('Content-Type: '.$allowed[$asset]);
header('X-Content-Type-Options: nosniff');
if ($asset === 'sw.js') { header('Service-Worker-Allowed: /files/.internal/Disney/'); }
readfile(__DIR__.'/'.$asset);
