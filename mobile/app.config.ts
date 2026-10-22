import type { ExpoConfig } from "expo/config";

/**
 * O endereço da `api` NÃO entra aqui: o app lê `EXPO_PUBLIC_API_URL` (ver `.env.example` e `src/config.ts`).
 * `APP_PERMITIR_HTTP=true` libera o tráfego sem TLS no build (a `api` local da máquina, em `http://`); o APK de produção fica `https`.
 */
const permitirHttp = process.env.APP_PERMITIR_HTTP === "true";

/** `APP_VERSION_CODE` (inteiro, o Dockerfile do APK repassa): cada APK novo precisa de um número maior para o Android aceitá-lo por cima do instalado. */
const versionCode = Number.parseInt(process.env.APP_VERSION_CODE ?? "", 10) || 1;

/**
 * O id do projeto na Expo (criado por `eas init`, não é segredo) liga as atualizações pelo ar (EAS Update). `EAS_PROJECT_ID=` vazio as
 * desliga. O `runtimeVersion` segue o `version`: a atualização só chega a APKs com a mesma versão, então
 * **mudou algo nativo (plugin, permissão, biblioteca nativa)? Suba o `version` e gere um APK novo**.
 */
const idDoProjetoEas = (process.env.EAS_PROJECT_ID ?? "83dbbf5f-47d7-4327-924e-e67b7e063ba2").trim();

const config: ExpoConfig = {
  name: "SYNQ OS",
  slug: "synq-os",
  scheme: "synqos",
  version: "0.2.0",
  runtimeVersion: { policy: "appVersion" },
  ...(idDoProjetoEas
    ? {
        updates: { url: `https://u.expo.dev/${idDoProjetoEas}`, checkAutomatically: "ON_LOAD" as const },
        extra: { eas: { projectId: idDoProjetoEas } },
      }
    : {}),
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icone.png",
  android: {
    package: "br.synqos.app",
    versionCode,
    adaptiveIcon: { foregroundImage: "./assets/icone-adaptivo.png", backgroundColor: "#FFFFFF" },
    // Câmera (fotos da APR, da interrupção e do encerramento) e localização (os cinco momentos da execução).
    permissions: ["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_NETWORK_STATE", "POST_NOTIFICATIONS"],
    // As notificações push passam pelo FCM: o arquivo do projeto do Firebase (`google-services.json`, nunca no repositório) vem por
    // `GOOGLE_SERVICES_JSON` (o caminho dele). Sem o arquivo, o app abre e funciona, só não recebe push (os avisos seguem no sino).
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { image: "./assets/marca.png", imageWidth: 220, resizeMode: "contain", backgroundColor: "#17212B" }],
    "expo-secure-store",
    "expo-sqlite",
    ["expo-image-picker", { cameraPermission: "O SYNQ OS usa a câmera para as fotos da APR, da interrupção por risco e do encerramento da OS.", photosPermission: false, microphonePermission: false }],
    ["expo-location", { locationWhenInUsePermission: "O SYNQ OS registra a sua localização ao iniciar, pausar, suspender, interromper e encerrar a execução, para constar no relatório da OS." }],
    "expo-document-picker",
    // A notificação push (docs/pessoas-e-equipes.md, seção 8.5): o ícone pequeno da bandeja é só a silhueta (o Android ignora a cor).
    ["expo-notifications", { icon: "./assets/icone-notificacao.png", color: "#0F5C78" }],
    ["expo-build-properties", { android: { usesCleartextTraffic: permitirHttp } }],
    // Assina o release com a chave que o Dockerfile entrega por variável de ambiente (sem ela, nada muda).
    "./plugins/assinatura-android.js",
  ],
};

export default config;
