# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json webpack.config.ts ./
RUN npm ci
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/public/logo.png /usr/share/nginx/html/logo.png
COPY --from=build /app/public/manifest.json /usr/share/nginx/html/manifest.json
COPY --from=build /app/public/sw.js /usr/share/nginx/html/sw.js
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4000
