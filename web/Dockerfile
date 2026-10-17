# Painel web e telas de campo do SYNQ OS (Next.js). Aplicação do Coolify; a porta é a variável PORT (padrão 3000).
#
# O contexto do build é a RAIZ do repositório, não `web/`: a Vitória importa `shared/vitoria`, que fica fora de `web/`.
#   docker build -f web/Dockerfile .
# O `web` fica em /app/web e o `shared` em /app/shared, para os caminhos relativos (`../../../shared`) continuarem valendo.
FROM node:24-slim AS construir

RUN npm install --global pnpm@11.21.0
WORKDIR /app/web

# Dependências primeiro, para o cache de camadas sobreviver a mudanças só no código.
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY web ./
COPY shared /app/shared
RUN pnpm build

FROM node:24-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

WORKDIR /app/web

# Mantém as dependências completas: o `next start` carrega o next.config.ts, que precisa delas.
COPY --from=construir /app/web/package.json /app/web/pnpm-lock.yaml /app/web/pnpm-workspace.yaml /app/web/next.config.ts /app/web/tsconfig.json ./
COPY --from=construir /app/web/node_modules ./node_modules
COPY --from=construir /app/web/.next ./.next
COPY --from=construir /app/web/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/next", "start"]
