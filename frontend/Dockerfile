FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY frontend/package.json ./frontend/
RUN corepack enable && yarn install --immutable
COPY frontend ./frontend
WORKDIR /app/frontend
RUN yarn build

FROM nginx:1.27-alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
