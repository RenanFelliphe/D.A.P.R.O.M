# syntax=docker/dockerfile:1
# App Android do SYNQ OS: esta imagem NÃO roda o app, ela GERA o APK (não é publicada no Coolify). O resultado é um único arquivo, `synq-os.apk`.
#
# O contexto do build é a RAIZ do repositório, não `mobile/`: o app importa `shared/`, que fica fora de `mobile/`.
#   docker build -f mobile/Dockerfile --target saida --output type=local,dest=./apk \
#     --build-arg EXPO_PUBLIC_API_URL=https://api.exemplo.com.br .
# (`pnpm apk`, dentro de `mobile/`, monta esse comando; o passo a passo está no README do mobile.) Precisa do Docker com BuildKit.
#
# Assinatura: com os segredos `chave` (o arquivo .keystore) e `chave_senha` (um arquivo só com a senha), o APK sai assinado com a chave da
# empresa. Sem eles, o build cria uma chave descartável de demonstração: serve para instalar e testar, mas cada build gera outra e o
# Android não deixa instalar um APK por cima de outro assinado com chave diferente (desinstale antes).
#   --secret id=chave,src=./synqos.keystore --secret id=chave_senha,src=./synqos.senha
# Chave, senha e `.env` nunca entram no repositório nem na imagem: os segredos só existem durante o passo do Gradle.
#
# `--platform=linux/amd64`: o NDK e o `aapt2` do Android SDK são binários x86_64 (em Mac com Apple Silicon o Docker emula).
FROM --platform=linux/amd64 node:24-bookworm-slim AS construir

# Versão das "command-line tools" do Android SDK (número do arquivo em https://developer.android.com/studio#command-line-tools-only).
ARG CMDLINE_TOOLS=11076708
ARG PNPM=11.21.0

ENV ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    JAVA_HOME=/opt/java \
    CI=1 \
    EXPO_NO_TELEMETRY=1
ENV PATH="${PATH}:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools"

# JDK 17 (o Android Gradle Plugin 9 pede 17 ou mais) e as ferramentas para baixar o SDK. O JAVA_HOME vira um atalho fixo porque o
# caminho do JDK muda com a arquitetura.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jdk-headless unzip curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && ln -s "$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")" /opt/java \
 && npm install --global pnpm@${PNPM}

RUN mkdir -p "$ANDROID_HOME/cmdline-tools" \
 && curl -fsSL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS}_latest.zip" \
 && unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools \
 && mv /tmp/cmdline-tools/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest" \
 && rm -rf /tmp/cmdline-tools /tmp/cmdline-tools.zip \
 && (yes | sdkmanager --licenses > /dev/null) \
 && sdkmanager "platform-tools"

WORKDIR /app/mobile

# Dependências primeiro, para o cache de camadas sobreviver a mudanças só no código.
COPY mobile/package.json mobile/pnpm-lock.yaml mobile/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# As versões do SDK, do Build Tools e do NDK que esta versão do React Native pede vêm do arquivo dela, não de um número fixo aqui. Se um
# pacote não for achado pelo nome, o Gradle baixa o que faltar na hora (as licenças já foram aceitas acima).
RUN set -eu; \
    toml=node_modules/react-native/gradle/libs.versions.toml; \
    versao() { sed -n "s/^$1 = \"\(.*\)\"/\1/p" "$toml"; }; \
    sdkmanager "platforms;android-$(versao compileSdk)" "build-tools;$(versao buildTools)" "ndk;$(versao ndkVersion)" \
    || echo "AVISO: o sdkmanager não achou algum pacote; o Gradle tenta baixá-lo no build."

COPY mobile ./
COPY shared /app/shared
RUN sed -i 's/\r$//' docker/gerar-apk.sh

# Configuração do APK (não são segredos). O endereço da `api` fica gravado no APK na hora do build: é obrigatório.
ARG EXPO_PUBLIC_API_URL=
ARG EXPO_PUBLIC_WEB_URL=
ARG APP_PERMITIR_HTTP=
ARG APP_VERSION_CODE=1
# Arquiteturas do aparelho: arm64-v8a (celulares atuais), armeabi-v7a (32 bits, mais antigos) e x86_64 (emulador). Menos arquiteturas, build mais rápido.
ARG ARQUITETURAS=arm64-v8a,armeabi-v7a,x86_64
ARG GRADLE_MEMORIA=4g
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL} \
    EXPO_PUBLIC_WEB_URL=${EXPO_PUBLIC_WEB_URL} \
    APP_PERMITIR_HTTP=${APP_PERMITIR_HTTP} \
    APP_VERSION_CODE=${APP_VERSION_CODE} \
    ARQUITETURAS=${ARQUITETURAS} \
    GRADLE_MEMORIA=${GRADLE_MEMORIA}

RUN --mount=type=cache,target=/root/.gradle \
    --mount=type=secret,id=chave \
    --mount=type=secret,id=chave_senha \
    sh docker/gerar-apk.sh

# Só o APK sai da imagem: `--target saida --output type=local,dest=./apk` o grava em ./apk/synq-os.apk.
FROM scratch AS saida
COPY --from=construir /app/mobile/android/app/build/outputs/apk/release/app-release.apk /synq-os.apk
