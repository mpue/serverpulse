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
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
