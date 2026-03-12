# Stage 1: Build TypeScript
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# Stage 2: Production image (JS only, no dev deps)
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Run as non-root user
RUN addgroup -S serverpulse && adduser -S serverpulse -G serverpulse
USER serverpulse
EXPOSE 4000
CMD ["node", "dist/index.js"]
