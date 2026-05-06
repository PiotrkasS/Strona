FROM mcr.microsoft.com/playwright:v1.56.0-noble

RUN apt-get update && apt-get install -y \
    php-cli \
    x11vnc \
    novnc \
    xvfb \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Start script: Xvfb + VNC + PHP server
COPY docker-start.sh /docker-start.sh
RUN dos2unix /docker-start.sh && chmod +x /docker-start.sh

EXPOSE 8000 7900

CMD ["/docker-start.sh"]
