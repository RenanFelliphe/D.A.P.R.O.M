import type { ExpoConfig } from "expo/config";

/**
 * O endereço da `api` NÃO entra aqui: o app lê `EXPO_PUBLIC_API_URL` (ver `.env.example` e `src/config.ts`).
 * `APP_PERMITIR_HTTP=true` libera o tráfego sem TLS no build (a `api` local da máquina, em `http://`); o APK de produção fica `https`.
 */
const permitirHttp = process.env.APP_PERMITIR_HTTP === "true";

/** `APP_VERSION_CODE` (inteiro, o Dockerfile do APK repassa): cada APK novo precisa de um número maior para o Android aceitá-lo por cima do instalado. */
const versionCode = Number.parseInt(process.env.APP_VERSION_CODE ?? "", 10) || 1;

const config: ExpoConfig = {
  name: "SYNQ OS",
  slug: "synq-os",
  scheme: "synqos",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icone.png",
  android: {
    package: "br.synqos.app",
    versionCode,
    adaptiveIcon: { foregroundImage: "./assets/icone-adaptivo.png", backgroundColor: "#FFFFFF" },
    // Câmera (fotos da APR, da interrupção e do encerramento) e localização (os cinco momentos da execução).
    permissions: ["CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_NETWORK_STATE"],
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
    ["expo-build-properties", { android: { usesCleartextTraffic: permitirHttp } }],
    // Assina o release com a chave que o Dockerfile entrega por variável de ambiente (sem ela, nada muda).
    "./plugins/assinatura-android.js",
  ],
};

export default config;
