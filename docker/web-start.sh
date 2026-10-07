#!/bin/sh
set -eu
mkdir -p /tmp/apache2
exec /bin/bash /opt/disney/supervisor.sh
