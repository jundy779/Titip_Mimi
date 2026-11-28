# Satu layanan: web Astro (statis) + API NestJS di domain yang sama, SQLite di volume /data.
FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PUBLIC_GOOGLE_CLIENT_ID=""
ENV PUBLIC_GOOGLE_CLIENT_ID=$PUBLIC_GOOGLE_CLIENT_ID
RUN npm run build

FROM node:22-bookworm-slim AS server
WORKDIR /srv
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/mimi.sqlite STATIC_DIR=/app/dist
WORKDIR /srv
COPY --from=server /srv/node_modules ./node_modules
COPY --from=server /srv/dist ./dist
COPY --from=server /srv/package.json ./
COPY --from=web /app/dist /app/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
