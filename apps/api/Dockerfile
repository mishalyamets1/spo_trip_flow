FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-fund --no-audit
COPY apps/api apps/api
RUN npm run build -w @tripflow/api
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
