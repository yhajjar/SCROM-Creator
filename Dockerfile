FROM oven/bun:1.3-alpine AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile

COPY src ./src
RUN bun run build

FROM oven/bun:1.3-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production \
    && addgroup -S scorm \
    && adduser -S -G scorm scorm \
    && mkdir -p /app/content /app/output \
    && chown -R scorm:scorm /app

COPY --from=build /app/dist ./dist
COPY --chown=scorm:scorm public ./public
COPY --chown=scorm:scorm fixtures ./fixtures

USER scorm

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["bun", "dist/src/server.js"]
