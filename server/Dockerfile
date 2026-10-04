# Tournament API. Build context is the repository root because the server
# runs the shared engine from src/engine.

FROM node:22-alpine
WORKDIR /app/server
COPY server/package.json server/package-lock.json server/.npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/src ./src
COPY server/migrations ./migrations
COPY src/engine /app/src/engine
ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000
USER node
CMD ["npx", "tsx", "src/index.ts"]
