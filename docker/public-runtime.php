<?php
declare(strict_types=1);
const DISNEY_PUBLIC_ORIGIN = 'https://abetterdisneylandparisapp.weletapi.com';

// A signed, host-only device cookie associates opt-in push subscriptions and
// diagnostic limits with this browser. Favorites and child data stay local.
function disney_public_token(string $cookie, string $secret): ?string {
    if (!preg_match('/\A([a-f0-9]{64})\.([a-f0-9]{64})\z/', $cookie, $parts)) return null;
    return hash_equals(hash_hmac('sha256', 'device:'.$parts[1], $secret), $parts[2]) ? $parts[1] : null;
}
function disney_public_identity(): array {
    $secret = (string)file_get_contents('/var/lib/disney-runtime/device.key');
    if (strlen($secret) !== 64) throw new RuntimeException('Device identity unavailable');
    $id = disney_public_token((string)($_COOKIE['__Host-disney-device'] ?? ''), $secret);
    if ($id === null) {
        $id = bin2hex(random_bytes(32));
        setcookie('__Host-disney-device', $id.'.'.hash_hmac('sha256', 'device:'.$id, $secret), [
            'expires'=>time()+365*86400, 'path'=>'/', 'secure'=>true,
            'httponly'=>true, 'samesite'=>'Lax',
        ]);
    }
    return ['guest-'.$id, hash_hmac('sha256', 'csrf:'.$id, $secret)];
}
