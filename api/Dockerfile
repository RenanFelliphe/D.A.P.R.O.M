# API do D.A.P.R.O.M (Node + TypeScript). Aplicação do Coolify; a porta é a variável PORT (padrão 3333).
#
# O TypeScript roda direto com o tsx (dependência de produção): não há etapa de build.
# Na subida a api aplica as migrações (db/migrations) e carrega os dados iniciais antes de abrir a porta.
FROM node:24-slim

ENV NODE_ENV=production \
    PORT=3333

RUN npm install --global pnpm@11.21.0

WORKDIR /app

# Dependências primeiro, para o cache de camadas sobreviver a mudanças só no código.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY tsconfig.json ./
COPY src ./src
# Lidas em tempo de execução: as migrações (migrador do Drizzle) e as ordens do SAP simulado.
COPY db/migrations ./db/migrations
COPY fixtures ./fixtures

USER node
EXPOSE 3333

# `GET /saude` só responde depois das migrações; o Coolify e o compose usam este resultado.
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "src/servidor.ts"]
