# Microserviço de emissão NF-e (sped-nfe). Roda fora da Vercel (ex.: Railway).
# O Docker traz o PHP e as extensões — nada de PHP/Composer na máquina local.
FROM php:8.2-cli

# Extensões exigidas pela sped-nfe (dom/libxml/openssl/curl/mbstring já vêm na imagem).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libxml2-dev libzip-dev libpng-dev libjpeg-dev libfreetype6-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install -j"$(nproc)" soap zip gd \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY composer.json ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-progress
COPY . .

# Railway injeta $PORT; cai para 8080 em execução local.
EXPOSE 8080
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8080} public/index.php"]
