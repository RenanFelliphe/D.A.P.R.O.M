/**
 * Publica uma atualização pelo ar (EAS Update) no canal `preview`, o mesmo do APK (`pnpm atualizar --message "o que mudou"`).
 *
 * O `eas update` monta o JavaScript na máquina e grava nele os `EXPO_PUBLIC_*` que encontrar (o `.env` do `mobile`, que no
 * desenvolvimento aponta para a `api` local). Para a atualização nunca levar os aparelhos a outro endereço, este script repassa as
 * variáveis do perfil `preview` do `eas.json`, as mesmas do APK; elas vencem o `.env`. Os demais argumentos vão direto ao `eas update`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const PERFIL = "preview";

interface EasJson {
  build: Record<string, { channel?: string; env?: Record<string, string> }>;
}

/** No Windows o `pnpm` só roda pelo shell, que junta os argumentos com espaço: a mensagem precisa de aspas para chegar inteira. */
function entreAspas(argumento: string): string {
  return /[\s"]/.test(argumento) ? `"${argumento.replace(/"/g, '\\"')}"` : argumento;
}

function principal(): number {
  const eas = JSON.parse(readFileSync(path.resolve(__dirname, "..", "eas.json"), "utf8")) as EasJson;
  const perfil = eas.build[PERFIL];
  if (!perfil?.channel || !perfil.env?.EXPO_PUBLIC_API_URL) {
    console.error(`eas.json: o perfil "${PERFIL}" precisa de channel e de EXPO_PUBLIC_API_URL.`);
    return 1;
  }

  console.log(`Canal ${perfil.channel}, api ${perfil.env.EXPO_PUBLIC_API_URL}`);
  // `--environment` puxa as variáveis do ambiente guardadas na Expo (hoje nenhuma); sem ele, o `eas update` sem terminal recusa.
  const argumentos = ["dlx", "eas-cli", "update", "--channel", perfil.channel, "--environment", PERFIL, "--platform", "android", ...process.argv.slice(2)];
  const resultado = spawnSync("pnpm", process.platform === "win32" ? argumentos.map(entreAspas) : argumentos, {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, ...perfil.env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return resultado.status ?? 1;
}

process.exit(principal());
