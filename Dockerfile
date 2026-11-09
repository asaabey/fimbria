FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3000 DB_PATH=/app/data/app.sqlite
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/schemas ./schemas
COPY package.json ./
COPY scripts/teacher-container.mjs ./scripts/teacher-container.mjs
RUN mkdir data && chown node:node data
USER node
EXPOSE 3000
CMD ["node","dist/server/index.js"]
