FROM node:24-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main"]
