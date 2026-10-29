FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-fund --no-audit
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_ORIGIN=http://api:4000
RUN npm run build -w @tripflow/web
ENV NODE_ENV=production
RUN chown -R node:node /app/apps/web/.next
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@tripflow/web"]
