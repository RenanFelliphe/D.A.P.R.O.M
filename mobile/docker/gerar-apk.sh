#!/bin/sh
# Roda DENTRO do Dockerfile do `mobile`: gera o projeto nativo (`expo prebuild`) e monta o APK de release com o Gradle.
# Variáveis (o Dockerfile as define a partir dos `--build-arg`): EXPO_PUBLIC_API_URL (obrigatória), EXPO_PUBLIC_WEB_URL, APP_PERMITIR_HTTP,
# APP_VERSION_CODE, ARQUITETURAS e GRADLE_MEMORIA. Segredos opcionais, montados pelo BuildKit: /run/secrets/chave e /run/secrets/chave_senha.
set -eu

erro() { echo "ERRO: $*" >&2; exit 1; }

[ -n "${EXPO_PUBLIC_API_URL:-}" ] || erro "defina o endereço da api: --build-arg EXPO_PUBLIC_API_URL=https://..."
case "$EXPO_PUBLIC_API_URL" in
  https://*) ;;
  http://*) [ "${APP_PERMITIR_HTTP:-}" = "true" ] || erro "o endereço $EXPO_PUBLIC_API_URL usa http://, que o APK recusa; use https:// ou, só para teste, --build-arg APP_PERMITIR_HTTP=true" ;;
  *) erro "EXPO_PUBLIC_API_URL deve começar com https:// (ou http://, com APP_PERMITIR_HTTP=true): $EXPO_PUBLIC_API_URL" ;;
esac
echo "api do app: $EXPO_PUBLIC_API_URL | versionCode: ${APP_VERSION_CODE:-1} | arquiteturas: ${ARQUITETURAS}"

# Chave de assinatura: a da empresa (segredos) ou, sem ela, uma descartável de demonstração.
if [ -s /run/secrets/chave ] && [ -s /run/secrets/chave_senha ]; then
  export SYNQOS_KEYSTORE=/run/secrets/chave
  SYNQOS_KEYSTORE_SENHA="$(tr -d '\r\n' < /run/secrets/chave_senha)"
  export SYNQOS_KEYSTORE_SENHA
  export SYNQOS_CHAVE_ALIAS="${SYNQOS_CHAVE_ALIAS:-synqos}"
  echo "assinatura: chave da empresa (segredo 'chave')"
else
  echo "AVISO: sem os segredos 'chave' e 'chave_senha'; o APK será assinado com uma chave DESCARTÁVEL de demonstração." >&2
  export SYNQOS_KEYSTORE=/tmp/synqos-demonstracao.keystore
  export SYNQOS_KEYSTORE_SENHA=synqos-demonstracao
  export SYNQOS_CHAVE_ALIAS=synqos
  keytool -genkeypair -keystore "$SYNQOS_KEYSTORE" -storepass "$SYNQOS_KEYSTORE_SENHA" -keypass "$SYNQOS_KEYSTORE_SENHA" \
    -alias "$SYNQOS_CHAVE_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=SYNQ OS demonstracao, O=SYNQ OS" > /dev/null
fi

# Projeto nativo (android/) a partir do app.config.ts e dos plugins; não vem do repositório.
pnpm exec expo prebuild --platform android --no-install --clean

cd android
./gradlew --no-daemon assembleRelease \
  -PreactNativeArchitectures="$ARQUITETURAS" \
  "-Dorg.gradle.jvmargs=-Xmx${GRADLE_MEMORIA} -XX:MaxMetaspaceSize=1g"

apk=app/build/outputs/apk/release/app-release.apk
[ -f "$apk" ] || erro "o Gradle terminou, mas $apk não existe"

# Confere que o APK está mesmo assinado e mostra a impressão digital da chave (para comparar entre builds).
apksigner="$(find "$ANDROID_HOME/build-tools" -name apksigner | sort | tail -n 1)"
[ -n "$apksigner" ] || erro "apksigner não encontrado em $ANDROID_HOME/build-tools"
"$apksigner" verify --print-certs "$apk" | grep -E "Signer #1 certificate (DN|SHA-256)" || erro "o APK não passou na verificação de assinatura"
ls -l "$apk"
