#!/bin/sh
# VFS has no copy-on-write: construct one runtime filesystem and import one layer.
set -eu
image=${DISNEY_IMAGE:-disney-public:build110}
source_dir=$(pwd)
cache=/mnt/backup/docker-projects/disney-public/runtime-cache
bundle=/mnt/backup/docker-projects/disney-public/runtime-bundle
mkdir -p "$cache" "$bundle"
lock_hash=$(sha256sum docker/package-lock.json | cut -d ' ' -f1)
if [ ! -f "$cache/package-hash" ] || [ "$(cat "$cache/package-hash")" != "$lock_hash" ]; then
    docker create --name disney-public-node-build --mount "type=bind,src=$source_dir/docker,dst=/input,readonly" \
        node:22-bookworm-slim sh -c 'set -e; mkdir -p /tmp/package; cp /input/package*.json /tmp/package/; cd /tmp/package; npm ci --omit=dev --ignore-scripts --no-audit --no-fund'
    docker start --attach disney-public-node-build
    test "$(docker inspect --format '{{.State.ExitCode}}' disney-public-node-build)" = 0
    docker cp disney-public-node-build:/usr/local/bin/node "$cache/node"
    docker cp disney-public-node-build:/tmp/package/node_modules "$cache/"
    docker rm disney-public-node-build
    printf '%s' "$lock_hash" > "$cache/package-hash"
fi
mkdir -p "$bundle/var/www/html" "$bundle/opt/disney" "$bundle/opt/disney-push" \
    "$bundle/opt/disney-tests" "$bundle/usr/local/bin" "$bundle/usr/local/etc/php/conf.d" \
    "$bundle/etc/apache2/sites-enabled" "$bundle/etc/apache2/mods-available"
cp -a dist/. "$bundle/var/www/html/"
cp -a docker/. "$bundle/opt/disney/"
cp -a docker/public-index.php "$bundle/var/www/html/index.php"
cp -a server/push/*.cjs "$bundle/opt/disney-push/"
cp -a "$cache/node_modules" "$bundle/opt/disney-push/"
cp -a "$cache/node" "$bundle/usr/local/bin/node"
cp -a tests/*.test.php "$bundle/opt/disney-tests/"
cp -a docker/php.ini "$bundle/usr/local/etc/php/conf.d/disney.ini"
cp -a docker/apache.conf "$bundle/etc/apache2/sites-enabled/disney.conf"
cp -a docker/mpm-prefork.conf "$bundle/etc/apache2/mods-available/mpm_prefork.conf"
if ! docker container inspect disney-public-image-build >/dev/null 2>&1; then
    docker create --name disney-public-image-build php:8.3-apache-bookworm sh -c 'set -e; docker-php-ext-enable opcache; php -r '\''exit(extension_loaded("curl") ? 0 : 1);'\''; a2enmod rewrite headers; rm -f /etc/apache2/sites-enabled/000-default.conf; : > /etc/apache2/ports.conf; mkdir -p /tmp/apache2; chown www-data:www-data /tmp/apache2; chmod -R a-w /var/www/html /opt/disney /opt/disney-push; php -l /var/www/html/index.php; apache2ctl -t'
fi
docker cp "$bundle/." disney-public-image-build:/
docker start --attach disney-public-image-build
test "$(docker inspect --format '{{.State.ExitCode}}' disney-public-image-build)" = 0
docker export disney-public-image-build | docker import \
    --change 'ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin APACHE_CONFDIR=/etc/apache2 APACHE_ENVVARS=/etc/apache2/envvars PHP_INI_DIR=/usr/local/etc/php DISNEY_APP_DIR=/var/www/html DISNEY_APP_URL=/App/ DISNEY_PUSH_DIR=/var/lib/weletapi-disney-push DISNEY_PUSH_SENDER=/opt/disney-push/sender.cjs NODE_OPTIONS=--max-old-space-size=64' \
    --change 'USER www-data' --change 'EXPOSE 8080' \
    --change 'CMD ["sh", "/opt/disney/web-start.sh"]' - "$image"
docker rm disney-public-image-build
docker image inspect "$image" --format 'Flat runtime image {{.Id}}'
