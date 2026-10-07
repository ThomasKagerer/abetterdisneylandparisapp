FROM node:22-bookworm-slim AS node
FROM php:8.3-apache-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && docker-php-ext-enable opcache \
    && php -r 'exit(extension_loaded("curl") ? 0 : 1);' \
    && a2enmod rewrite headers \
    && rm -f /etc/apache2/sites-enabled/* \
    && : > /etc/apache2/ports.conf
COPY docker/package*.json /opt/disney-push/
RUN cd /opt/disney-push && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY dist/ /var/www/html/
COPY server/push/*.cjs /opt/disney-push/
COPY docker/ /opt/disney/
COPY tests/*.test.php /opt/disney-tests/
COPY docker/public-index.php /var/www/html/index.php
COPY docker/apache.conf /etc/apache2/sites-enabled/disney.conf
COPY docker/mpm-prefork.conf /etc/apache2/mods-available/mpm_prefork.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/disney.ini
RUN mkdir -p /tmp/apache2 && chown www-data:www-data /tmp/apache2 \
    && chmod -R a-w /var/www/html /opt/disney /opt/disney-push
ENV DISNEY_APP_DIR=/var/www/html DISNEY_APP_URL=/App/ \
    DISNEY_PUSH_DIR=/var/lib/weletapi-disney-push \
    DISNEY_PUSH_SENDER=/opt/disney-push/sender.cjs \
    NODE_OPTIONS=--max-old-space-size=64
USER www-data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD php -r '$r=@file_get_contents("http://127.0.0.1:8080/index.php?version=1");exit(is_array(json_decode($r?:"",true))?0:1);'
CMD ["sh", "/opt/disney/web-start.sh"]
