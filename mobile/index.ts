/**
 * A entrada do app. A tarefa que envia a fila com o app fechado precisa estar definida **antes** de qualquer tela (o Android a chama sem
 * montar nenhum componente), então ela entra primeiro; o Expo Router vem depois, como na entrada padrão.
 */
import "./src/polyfills";
import "./src/offline/segundo-plano-nativo";
import "expo-router/entry";
