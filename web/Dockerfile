# Painel web e telas de campo do SYNQ OS (Next.js). Aplicação do Coolify; a porta é a variável PORT (padrão 3000).
FROM node:24-slim AS construir

RUN npm install --global pnpm@11.21.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:24-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

WORKDIR /app

# Mantém as dependências completas: o `next start` carrega o next.config.ts, que precisa delas.
COPY --from=construir /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/next.config.ts /app/tsconfig.json ./
COPY --from=construir /app/node_modules ./node_modules
COPY --from=construir /app/.next ./.next
COPY --from=construir /app/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/next", "start"]
