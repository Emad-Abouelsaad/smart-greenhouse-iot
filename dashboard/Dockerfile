# Build the dashboard and serve it with nginx (container image ~25 MB)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Firebase values can be passed at build time, otherwise simulation mode is used
ARG VITE_DATA_MODE=simulation
ENV VITE_DATA_MODE=$VITE_DATA_MODE
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -q -O /dev/null http://localhost/ || exit 1
