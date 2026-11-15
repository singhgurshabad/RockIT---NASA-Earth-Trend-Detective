# RockIT web app. Build from the rockit/ folder.
# The data service address is read from .env.production at BUILD time
# (Next.js bakes NEXT_PUBLIC_ variables into the browser code).

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Cloud Run sets PORT (8080 by default); the standalone server reads it.
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
