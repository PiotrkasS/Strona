FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    php-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

RUN npx playwright install chromium --with-deps

COPY . .

RUN npm run build

EXPOSE 8000

CMD ["php", "-S", "0.0.0.0:8000", "router.php"]
