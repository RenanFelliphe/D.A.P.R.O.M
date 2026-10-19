import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { categoriasDoPerfil, DESCRICAO_DA_CATEGORIA, ehCategoriaObrigatoria, ROTULO_DA_CATEGORIA, type CategoriaDeEmail } from "@shared/notificacoes/avisos";
import { cliente } from "@/api/api";
import { mensagemDoErro } from "@/api/erros";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Carregando } from "@/ui/Estados";
import { ListaDeOpcoes, Opcao } from "@/ui/Opcao";
import { Tela } from "@/ui/Tela";

/**
 * Preferências de e-mail: uma chave por categoria. Desligar só tira o e-mail: o aviso continua no sino. As categorias obrigatórias
 * (segurança do campo e a própria conta) aparecem marcadas e travadas. Cada mudança é gravada na hora (`PUT /me/emails`); se falhar,
 * a chave volta como estava.
 */
export default function Emails() {
  const { eu } = useSessao();
  const consultas = useQueryClient();
  const [desligados, setDesligados] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!eu) return <Carregando />;
  const atuais = desligados ?? eu.emails?.desligados ?? [];

  const alternar = async (categoria: CategoriaDeEmail) => {
    const antes = atuais;
    const depois = antes.includes(categoria) ? antes.filter((c) => c !== categoria) : [...antes, categoria];
    setDesligados(depois);
    setSalvando(true);
    setErro(null);
    try {
      const r = await cliente.chamar<{ desligados: string[] }>("/me/emails", { metodo: "PUT", corpo: { desligados: depois } });
      setDesligados(r.desligados);
      void consultas.invalidateQueries({ queryKey: ["eu"] });
    } catch (e) {
      setDesligados(antes);
      setErro(mensagemDoErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Tela bordas={["bottom"]}>
      <Text style={estilos.texto}>Os avisos chegam sempre no sino do app. Aqui você escolhe quais também vão para o seu e-mail institucional.</Text>
      {eu.emails && !eu.emails.servidor_configurado ? (
        <Aviso tom="al">O envio de e-mails ainda não foi configurado no servidor: por enquanto os avisos ficam só no sino. As suas escolhas já valem quando ele for ligado.</Aviso>
      ) : null}
      <ListaDeOpcoes>
        {categoriasDoPerfil(eu.usuario.perfil).map((c) => {
          const obrigatoria = ehCategoriaObrigatoria(c);
          return (
            <Opcao
              key={c}
              rotulo={`${ROTULO_DA_CATEGORIA[c]}${obrigatoria ? " · sempre enviado" : ""}`}
              detalhe={DESCRICAO_DA_CATEGORIA[c]}
              marcada={obrigatoria || !atuais.includes(c)}
              desabilitada={obrigatoria}
              aoPressionar={() => !salvando && void alternar(c)}
            />
          );
        })}
      </ListaDeOpcoes>
      {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta3 },
});
