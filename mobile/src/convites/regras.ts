/**
 * As contas do convite para a APR no app: quem ainda falta convidar, que selo cada convidado leva e quanto tempo resta para responder.
 * Moram em `shared/api/apr-convite.ts` (a web usa as mesmas); a `api` confere tudo de novo, aqui só se evita ir até ela à toa.
 */
export { conviteADesfazer, faltaNoMotivoDaRecusa, quemConvidar, restanteDoConvite, seloDoConvite } from "@shared/api/apr-convite";
