#!/bin/sh
# Run on the Docker host from an unpacked, reviewed Disneyland source bundle.
set -eu
ssd_device=$(findmnt -n -o SOURCE --mountpoint /mnt/backup)
project_device=$(findmnt -n -o SOURCE -T "$(pwd)")
docker_device=$(findmnt -n -o SOURCE -T "$(docker info --format '{{.DockerRootDir}}')")
if [ "$ssd_device" != "$project_device" ] || [ "$ssd_device" != "$docker_device" ]; then
    printf 'App project and Docker data must both be on the mounted SSD.\n' >&2
    exit 1
fi
image=${DISNEY_IMAGE:-disney-public:build110}
if [ "${DISNEY_REUSE_IMAGE:-0}" != 1 ]; then
    if [ "$(docker info --format '{{.Driver}}')" = vfs ]; then sh docker/build-flat.sh; else docker build -t "$image" .; fi
fi
docker image inspect "$image" --format 'Built {{.Id}}'
docker network inspect disney-public >/dev/null 2>&1 || docker network create disney-public
for volume in disney-public-runtime disney-public-waits disney-public-diagnostics disney-public-push; do
    docker volume inspect "$volume" >/dev/null 2>&1 || docker volume create "$volume"
done
mounts='--mount type=volume,src=disney-public-runtime,dst=/var/lib/disney-runtime --mount type=volume,src=disney-public-waits,dst=/var/lib/weletapi-disney-waits --mount type=volume,src=disney-public-diagnostics,dst=/var/lib/weletapi-disney-diagnostics --mount type=volume,src=disney-public-push,dst=/var/lib/weletapi-disney-push'
# This one-shot initialization has no host filesystem or Docker socket mounted.
if [ "${DISNEY_INITIALIZED:-0}" != 1 ]; then
    docker run --rm --user 0 --network none $mounts "$image" sh -c 'set -e; for file in /var/www/html/*.php /opt/disney/*.php; do php -l "$file"; done; php /opt/disney-tests/public-runtime.test.php /opt/disney/public-runtime.php; php /opt/disney-tests/push-api.test.php /var/www/html/push-api.php; php /opt/disney-tests/map-diagnostics.test.php /var/www/html/map-diagnostics.php; php /opt/disney-tests/show-times.test.php /var/www/html/show-times.php; php /opt/disney-tests/wait-times.test.php /var/www/html/wait-times.php; apache2ctl -t; php /opt/disney/initialize.php'
fi
# VFS can take minutes to create a writable layer. Keep the current app
# serving until the replacement is completely created (ports bind on start).
stamp=$(date +%Y%m%d-%H%M%S)
candidate=disney-public-web-next-$stamp
previous=disney-public-web-previous-$stamp
switched=0
candidate_id=''
rollback() {
    result=$?
    set +e
    trap - EXIT
    if [ "$switched" = 1 ]; then
        current_id=$(docker inspect --format '{{.Id}}' disney-public-web 2>/dev/null || true)
        if [ -n "$candidate_id" ] && [ "$current_id" = "$candidate_id" ]; then
            docker stop disney-public-web >/dev/null 2>&1 || true
            docker rename disney-public-web "disney-public-web-failed-$stamp" || true
        fi
        if docker container inspect "$previous" >/dev/null 2>&1; then
            docker rename "$previous" disney-public-web
            docker start disney-public-web
        elif [ -n "$current_id" ] && [ "$current_id" != "$candidate_id" ]; then
            docker start disney-public-web
        fi
    fi
    exit "$result"
}
trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
candidate_id=$(docker create --name "$candidate" --restart unless-stopped --network disney-public \
    --health-cmd 'php -r '\''$r=@file_get_contents("http://127.0.0.1:8080/index.php?version=1");exit(is_array(json_decode($r?:"",true))?0:1);'\''' \
    --health-interval 30s --health-timeout 5s --health-start-period 20s --health-retries 3 \
    --mount "type=bind,src=$(pwd)/dist,dst=/var/www/html,readonly" \
    --mount "type=bind,src=$(pwd)/docker/collector.php,dst=/opt/disney/collector.php,readonly" \
    --mount "type=bind,src=$(pwd)/docker/public-index.php,dst=/var/www/html/index.php,readonly" \
    --env DISNEY_APP_URL=/App/ \
    --publish 127.0.0.1:18081:8080 --read-only --cap-drop ALL \
    --security-opt no-new-privileges --memory 256m --memory-swap 512m --cpus 1.5 --pids-limit 100 \
    --tmpfs /tmp:rw,noexec,nosuid,size=32m,mode=1777 \
    --tmpfs /var/run/apache2:rw,noexec,nosuid,size=1m,uid=33,gid=33,mode=0755 \
    --log-opt max-size=10m --log-opt max-file=3 $mounts "$image")
switched=1
if docker container inspect disney-public-web >/dev/null 2>&1; then
    docker stop disney-public-web
    docker rename disney-public-web "$previous"
fi
docker rename "$candidate" disney-public-web
docker start disney-public-web
version_file=/mnt/backup/docker-projects/disney-public/tools/started-version.json
mkdir -p /mnt/backup/docker-projects/disney-public/tools
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl --connect-timeout 2 --max-time 5 --fail --silent http://127.0.0.1:18081/index.php?version=1 > "$version_file"; then ready=1; break; fi
    sleep 2
done
[ "$ready" = 1 ]
switched=0
trap - EXIT INT TERM
cat "$version_file"
printf '\nDocker app listening on loopback port 18081.\n'
