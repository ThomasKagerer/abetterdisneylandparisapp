#!/bin/bash
set -u
mkdir -p /tmp/apache2
apache2-foreground &
web_pid=$!
php -d memory_limit=192M /opt/disney/collector.php &
worker_pid=$!
stop_children() {
    trap - TERM INT EXIT
    kill "$web_pid" "$worker_pid" 2>/dev/null || true
    wait "$web_pid" "$worker_pid" 2>/dev/null || true
}
trap 'stop_children; exit 0' TERM INT
trap stop_children EXIT
wait -n "$web_pid" "$worker_pid"
# Either required process exiting restarts the complete app under Docker.
exit 1
