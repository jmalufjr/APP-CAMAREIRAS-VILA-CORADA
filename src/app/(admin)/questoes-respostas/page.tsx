import { PageHeader } from "@/components/shared/page-header";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed">{children}</p>;
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold pt-1">{children}</p>;
}

export default function QuestoesRespostasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Questões e Respostas"
        subtitle="Um guia rápido de como o sistema funciona, pensado para quem vai administrar o dia a dia do aplicativo."
      />

      <p className="text-sm text-muted-foreground max-w-3xl">
        Esta página explica, em linguagem simples, as principais partes do aplicativo: o que funciona
        sozinho, o que você pode e deve editar, e o que fazer quando alguma informação não estiver
        correta. Não é preciso entender nada de tecnologia para acompanhar — só o funcionamento das
        telas que você já usa no dia a dia.
      </p>

      <Accordion className="space-y-3 max-w-3xl">
        {/* 1. Stays */}
        <AccordionItem value="stays">
          <AccordionTrigger>
            <span className="font-heading text-base">
              1. Como funciona a sincronização com a Stays?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                A Stays é o sistema onde ficam registradas todas as reservas da pousada — quem chega,
                quem sai, quantas noites, quantos hóspedes por suíte. Para não obrigar ninguém a digitar
                essas informações duas vezes, o aplicativo busca esses dados direto da Stays e já deixa
                três telas preenchidas sozinhas: <strong>Planejamento diário</strong>,{" "}
                <strong>Chegadas &amp; saídas</strong> e <strong>Mesas do café</strong>.
              </P>

              <SubHeading>Sincronização automática, todo dia</SubHeading>
              <P>
                Isso acontece sozinho, uma vez por dia, bem cedo de manhã (antes do início do
                expediente) — você não precisa fazer nada. Ela sempre atualiza as informações de{" "}
                <strong>hoje</strong> e de <strong>amanhã</strong> nas três telas ao mesmo tempo.
              </P>

              <SubHeading>O botão “Sincronização Stays Total”</SubHeading>
              <P>
                No Resumo Executivo, logo abaixo dos 5 cards de consulta rápida, existe um botão manual
                que sincroniza as três telas de uma vez, para os casos em que você não quer esperar a
                próxima atualização automática ou precisa corrigir algo agora (até a Parte 34 esse botão
                existia separado em cada uma das três telas — foi unificado aqui porque sempre teve
                exatamente o mesmo efeito nos três lugares). Ele tem um comportamento importante:{" "}
                <strong>ignora qualquer edição manual que você já tenha feito</strong> e substitui pelo
                que a Stays informa naquele momento. Por isso, ao clicar, o sistema pede uma confirmação
                antes de prosseguir.
              </P>
              <P>
                <strong>Exemplo:</strong> você percebeu que uma suíte estava marcada errado no
                Planejamento e corrigiu manualmente para “Troca”. Se depois alguém clicar em
                “Sincronização Stays Total”, essa correção pode ser desfeita e a suíte volta a mostrar o
                que a Stays calcula — use esse botão só quando quiser mesmo descartar edições feitas e
                confiar 100% no que está registrado na Stays.
              </P>

              <SubHeading>O botão “Sincronização Stays Parcial”</SubHeading>
              <P>
                Ao lado do botão total existe um segundo botão, mais seguro pro dia a dia: ele também
                roda a sincronização com a Stays na hora, sem esperar a próxima atualização automática
                da manhã seguinte — mas, ao contrário do total, nunca apaga nada que você já editou
                manualmente hoje ou amanhã, só preenche o que ainda está do jeito que a Stays sugere.
                Use esse quando quiser só adiantar a atualização do dia (por exemplo, depois de uma
                reserva nova de última hora), sem correr o risco de perder uma correção sua.
              </P>

              <SubHeading>O que acontece quando você edita um campo manualmente</SubHeading>
              <P>
                Fora do botão de forçar, sempre que você edita à mão um dos campos que normalmente vêm
                da Stays, essa edição fica protegida: nem a sincronização automática do dia seguinte de
                manhã, nem uma nova consulta à Stays vão sobrescrever o que você escolheu, até o fim
                daquele dia específico. No dia seguinte a esse, a sincronização automática volta a
                funcionar normalmente para as datas futuras.
              </P>
              <P>
                <strong>Exemplo:</strong> a Stays indicaria “Arrumação” para a Suíte 4 amanhã, mas você
                sabe que o hóspede pediu para não ser incomodado e muda manualmente para “Sem
                trabalho”. Essa escolha fica valendo o dia todo — a sincronização automática não vai
                recriar a tarefa “Arrumação” ali, mesmo que a reserva na Stays continue exatamente
                igual.
              </P>

              <SubHeading>Todos os campos que vêm da Stays e podem ser editados por você</SubHeading>
              <List
                items={[
                  <>
                    <strong>Planejamento diário</strong>: o tipo de trabalho de cada suíte no dia
                    (Arrumação, Troca, Saída com Chegada, Somente Saída, Somente Chegada, ou “Sem
                    trabalho”).
                  </>,
                  <>
                    <strong>Chegadas</strong>: nome do hóspede, quantidade de noites da reserva e
                    quantidade de hóspedes na suíte.
                  </>,
                  <>
                    <strong>Saídas</strong>: qual suíte tem saída prevista naquele dia.
                  </>,
                  <>
                    <strong>Mesas do café</strong>: em qual mesa cada suíte ocupada vai sentar. Clique em
                    qualquer mesa no desenho pra escolher outra suíte pra ela, a qualquer momento — a
                    quantidade de hóspedes de cada suíte vem sempre da Stays, você nunca digita esse
                    número.
                  </>,
                ]}
              />
              <P>
                Alguns campos, ao contrário, <strong>nunca</strong> vêm da Stays e são sempre de
                preenchimento manual seu, sem risco de serem sobrescritos por nenhuma sincronização:
                horário previsto e observações (em Chegadas &amp; saídas), a observação do dia e a
                observação de cada mesa individual (em Mesas do café). Já o “Total de mesas”, as
                contagens por tamanho de mesa (quantas mesas têm 1, 2 ou 3 hóspedes, e quantos
                hóspedes há na Mesa 07) e a quantidade de suítes que conta para a comissão do dia não
                são editáveis nem sincronizados separadamente — eles são calculados automaticamente, na
                hora, a partir de quem está ocupando cada suíte e de quem já está sentado em cada mesa
                (ver pergunta 4).
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 2. Planejamento diário */}
        <AccordionItem value="planejamento">
          <AccordionTrigger>
            <span className="font-heading text-base">
              2. Como o app decide o que cada camareira vai fazer no dia?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                Todo dia, cada suíte ocupada recebe um tipo de trabalho, decidido a partir das reservas
                da Stays (ver pergunta 1):
              </P>
              <List
                items={[
                  <>
                    <strong>Arrumação</strong>: o hóspede vai ficar mais noites e ainda não é dia de
                    trocar a roupa de cama.
                  </>,
                  <>
                    <strong>Troca</strong>: mesma situação, mas já é o dia de trocar a roupa de cama e
                    banho (isso segue uma regra de a cada 3 noites, com pequenos ajustes conforme o
                    total de noites da reserva).
                  </>,
                  <>
                    <strong>Saída com Chegada</strong>: um hóspede sai e outro chega na mesma suíte, no
                    mesmo dia.
                  </>,
                  <>
                    <strong>Somente Saída</strong>: o hóspede sai e ninguém mais chega naquele dia.
                  </>,
                  <>
                    <strong>Somente Chegada</strong>: chega um hóspede novo, sem ninguém saindo antes.
                  </>,
                ]}
              />
              <P>
                Você pode mudar o tipo de trabalho de qualquer suíte a qualquer momento, num seletor na
                própria tela — inclusive escolher “Sem trabalho” se não houver nada a fazer ali. A
                camareira, pelo próprio celular, escolhe uma das suítes disponíveis pra trabalhar (você
                não precisa atribuir manualmente quem faz o quê), preenche um checklist de itens,
                registra qualquer problema encontrado (ver pergunta 6) e, ao final, libera a suíte como
                concluída. Você acompanha tudo isso em tempo real na tela de Planejamento.
              </P>
              <P>
                Se a camareira escolher a suíte errada ou mudar de ideia antes de terminar, ela também
                pode cancelar a própria escolha a qualquer momento: o serviço volta pra lista de
                disponíveis pra qualquer uma escolher de novo, e tudo que já tinha sido preenchido
                naquela tentativa (itens marcados, ocorrências, observação) é apagado.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 3. Chegadas & saídas */}
        <AccordionItem value="chegadas-saidas">
          <AccordionTrigger>
            <span className="font-heading text-base">3. Para que serve a tela “Chegadas &amp; saídas”?</span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                É onde você vê, de um jeito organizado, quem chega e quem sai em cada dia — nome do
                hóspede, noites, quantidade de hóspedes e horário previsto de chegada. As camareiras
                também têm acesso a essa mesma informação (só para consulta, sem poder editar), útil
                para se planejarem no dia. Por padrão a tela abre mostrando “Hoje”; use o botão
                “Amanhã” para adiantar o que vem pela frente.
              </P>
              <P>
                Além dos campos que já vêm prontos da Stays (pergunta 1), você pode cadastrar uma
                chegada ou saída manualmente do zero — útil para uma reserva feita por telefone ou
                fora da Stays, por exemplo — e sempre pode preencher o horário previsto e escrever
                observações (um pedido especial do hóspede, por exemplo).
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 4. Mesas do café */}
        <AccordionItem value="mesas">
          <AccordionTrigger>
            <span className="font-heading text-base">4. Como funciona o layout de mesas do café da manhã?</span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                A tela mostra um desenho do salão com todas as mesas na posição real, e cada mesa
                ocupada recebe a cor de destaque do tema (bem diferente da cor discreta das mesas
                vagas) — dá pra ver de relance quais já têm hóspedes marcados, sem precisar ler mesa
                por mesa. Dentro de cada mesa aparece o nome da suíte alocada ali e quantos hóspedes
                vêm dessa suíte. Só a Mesa 07 pode reunir mais de uma suíte ao mesmo tempo — todas as
                outras mesas ficam reservadas inteiras pra uma única suíte, exceto no caso raro de não
                sobrar lugar em nenhuma delas.
              </P>
              <P>
                Igual às outras telas com Hoje/Amanhã, essa aqui também abre sempre em “Hoje” — use o
                botão “Amanhã” pra organizar o café do dia seguinte com antecedência. Clique em
                qualquer mesa do desenho pra abrir uma janela com as suítes alocadas ali: adicione,
                remova, ou escolha uma suíte que já está em outra mesa (ela é movida automaticamente
                pra essa, sem duplicar — só a mesa de destino fica marcada como editada por você). É
                nessa mesma janela que fica a observação de cada mesa individual. A observação do dia
                (visível para as camareiras, útil para avisos como “evento especial hoje”) fica um
                pouco acima, fora da janela.
              </P>
              <P>
                A quantidade de suítes elegíveis para o café da manhã naquele dia (toda suíte ocupada
                nesse dia conta, esteja ela alocada numa mesa específica ou não) alimenta a comissão de
                serviços nas suítes e no café — o campo “Valor da comissão por café servido” e a
                repartição entre as camareiras ficam na tela “Comissões das camareiras” (ver pergunta 11).
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 5. Bar e frigobar */}
        <AccordionItem value="bar-frigobar">
          <AccordionTrigger>
            <span className="font-heading text-base">
              5. Como funciona o consumo de frigobar e do bar da piscina?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                Cada suíte tem uma “conta corrente” única, somando frigobar e bar da piscina juntos,
                que passa por quatro fases: aberta → fechada → reaberta (se precisar corrigir algo) →
                paga. Assim que uma conta é marcada como paga, uma conta nova e zerada já nasce
                sozinha pra aquela suíte, pronta pro próximo hóspede.
              </P>
              <P>
                O frigobar é lançado item a item, direto pela camareira, com botões de mais/menos (sem
                precisar digitar números) — cada lançamento feito durante o atendimento soma ao total
                da conta, nunca sobrescreve. Com a conta ainda aberta, a camareira pode ligar “Lançar
                consumo adicional” se precisar somar mais alguma coisa antes de fechar (por exemplo, o
                consumo do último dia do hóspede); com a conta reaberta pra corrigir algo, a edição já
                fica sempre disponível e continua somando por padrão — só se ela escolher
                explicitamente “zerar e lançar tudo novamente” é que o consumo já lançado é apagado
                pra recomeçar do zero. Essa escolha nunca fica valendo no ciclo seguinte: toda vez que
                a conta é fechada e reaberta de novo, volta a somar por padrão.
              </P>
              <P>
                Já o bar da piscina funciona por <strong>comandas</strong> — cada pedido feito pela
                piscina vira uma comanda numerada sequencialmente pelo mês (reinicia em #1 a cada
                início de mês, contando pra pousada inteira, não mais separado por suíte), que pode ser
                editada ou cancelada enquanto a conta da suíte ainda estiver aberta. A “responsável” por
                uma comanda é sempre a camareira que a lançou originalmente, mesmo que outra precise
                editar alguma coisa nela depois. Fechar a conta, reabrir e marcar como paga são ações
                feitas pela própria camareira; você, como admin, acompanha tudo pronto pra conferência
                na tela “Consumo de Bar e Frigobar”, incluindo as comandas de cada suíte.
              </P>
              <P>
                Sobre o consumo do bar da piscina incide uma taxa de serviço de 10%, que funciona como
                comissão pra equipe: cada camareira recebe os 10% referentes às comandas que ela
                lançou (ver pergunta 11). Como essa taxa não é uma cobrança obrigatória por lei, se o
                hóspede não quiser pagá-la a camareira pode isentá-la ao fechar a conta — nesse caso o
                total da conta fica sem os 10%, e a comissão daquela conta específica também deixa de
                contar pra quem lançou as comandas dela (o que ela lançou em qualquer outra conta
                continua valendo normalmente).
              </P>
              <P>
                Ao ser paga, a conta gera automaticamente um recibo em PDF e tenta enviá-lo por e-mail
                para o endereço cadastrado em “Cadastrar e-mail de envio” (menu do Resumo Executivo,
                pergunta 9 — sem precisar mexer em nada técnico). Se o envio falhar por algum motivo,
                você vê um aviso na tela e pode reenviar manualmente. O hóspede pode pagar via PIX
                direto por uma tela que a camareira abre, mostrando um QR code fixo da pousada.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 6. Ocorrências de manutenção corretiva */}
        <AccordionItem value="ocorrencias">
          <AccordionTrigger>
            <span className="font-heading text-base">
              6. O que acontece quando uma camareira encontra um problema de manutenção?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                Enquanto faz o checklist de uma suíte, a camareira pode registrar uma ocorrência —
                escolhendo uma categoria (torneira pingando, ar-condicionado com defeito, mau cheiro
                etc.) e escrevendo uma descrição. Essa ocorrência nasce como “pendente” e fica visível
                pro funcionário de manutenção, que a “seleciona” (avisando que já está cuidando
                daquilo) e depois marca como “resolvida” quando termina.
              </P>
              <P>
                Você acompanha o status de tudo isso na tela “Ocorrências” (o que está pendente,
                selecionado ou já resolvido, e por quem) e tem um ranking das categorias mais
                frequentes — útil para identificar, por exemplo, se uma mesma suíte vive dando problema
                com o mesmo item.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 7. Manutenção preventiva */}
        <AccordionItem value="preventiva">
          <AccordionTrigger>
            <span className="font-heading text-base">7. Como funciona a Manutenção Preventiva?</span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                É diferente da ocorrência corretiva da pergunta anterior: aqui não se espera um
                problema aparecer — são tarefas de manutenção recorrentes, organizadas por categoria
                (ex.: “Piscina”, “Ar-condicionado”, “Jardim”) e com uma frequência própria (a cada
                tantos dias/semanas). O funcionário de manutenção vê, toda semana, o que está pendente
                pra aquela categoria e marca como concluído (alguns itens registram só que foram
                feitos; outros pedem o nome de um técnico externo que executou o serviço).
              </P>
              <P>
                Você mesmo cadastra e edita essas categorias e itens na tela “Listas” (quantos dias
                entre uma manutenção e outra, a partir de quando cada uma começa a valer) e acompanha,
                pela tela “Manutenção Preventiva”, o que está em dia e o que está atrasado, semana a
                semana.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 8. Usuários */}
        <AccordionItem value="usuarios">
          <AccordionTrigger>
            <span className="font-heading text-base">
              8. Como cadastro uma nova camareira ou funcionário de manutenção?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                Na tela “Usuários” você cria o acesso de qualquer pessoa da equipe (camareira ou
                manutenção), escolhendo nome e uma senha inicial — a pessoa entra escolhendo o próprio
                nome numa lista, sem precisar digitar e-mail. Dali você também pode redefinir a senha
                de alguém que esqueceu, ou desativar o acesso de quem saiu da equipe, sem apagar o
                histórico do que essa pessoa já fez no sistema.
              </P>
              <P>
                O primeiro acesso de administrador (o seu) é o único que precisa ser criado direto no
                painel técnico do banco de dados, uma única vez — depois disso, toda a gestão do dia a
                dia é feita normalmente por essa tela.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 9. Resumo executivo */}
        <AccordionItem value="dashboard">
          <AccordionTrigger>
            <span className="font-heading text-base">9. O que a tela “Resumo executivo” me mostra?</span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                É a primeira tela que você vê ao entrar. No topo ficam 5 cards de “Consulta rápida do
                mês corrente”: suítes concluídas hoje, suítes no café hoje, Comissão Suítes e Café (o
                pote de comissão do café da manhã do mês, antes chamado “comissão do mês”), Comissão Bar
                (a comissão de 10% do bar somada de todas as camareiras, antes “10% bar total”) e
                ocorrências de manutenção hoje. Logo abaixo ficam os botões de sincronização com a Stays
                (ver pergunta 1).
              </P>
              <P>
                Mais abaixo tem um menu levando a 6 telas com mais detalhes, cada uma com um botão pra
                voltar:
              </P>
              <List
                items={[
                  <>
                    <strong>Serviços nas suítes</strong>: as suítes de hoje e de amanhã, e a lista dos
                    serviços concluídos nos últimos 7 dias — horário em que a camareira escolheu a
                    suíte, horário em que terminou e quanto tempo levou, útil pra acompanhar o ritmo da
                    equipe. Clicando num serviço, você abre o checklist inteiro que a camareira
                    preencheu (só pra consulta), incluindo o consumo de frigobar e bar e qualquer
                    ocorrência de manutenção daquele atendimento.
                  </>,
                  <>
                    <strong>Suítes vagas e limpas, disponíveis para alugar</strong>: duas listas, suítes
                    limpas e suítes sujas — explicado com detalhe na pergunta 10.
                  </>,
                  <>
                    <strong>Consumo de frigobar</strong>: os totais do mês atual e do mês anterior, item
                    por item, com gráficos de participação de cada um.
                  </>,
                  <>
                    <strong>Consumo de bar</strong>: o mesmo, mas com petiscos e bebidas contabilizados
                    separadamente, tanto nas tabelas quanto nos gráficos.
                  </>,
                  <>
                    <strong>Comissões das camareiras</strong>: as duas comissões da equipe, de bar e de
                    serviços nas suítes e no café — explicado com detalhe na pergunta 11.
                  </>,
                  <>
                    <strong>Cadastrar e-mail de envio</strong>: o e-mail que recebe automaticamente o
                    recibo de uma conta paga (ver pergunta 5) e pra onde você pode enviar o demonstrativo
                    de comissões (pergunta 11).
                  </>,
                ]}
              />
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 10. Suítes disponíveis para alugar */}
        <AccordionItem value="suites-disponiveis">
          <AccordionTrigger>
            <span className="font-heading text-base">
              10. Como o sistema decide quais suítes estão disponíveis pra alugar, e se estão limpas
              ou sujas?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                Essa tela (menu do Resumo Executivo, “Suítes vagas e limpas, disponíveis para alugar”)
                mostra duas listas — <strong>suítes limpas</strong> e <strong>suítes sujas</strong> —
                com todas as suítes que não têm hóspede previsto pra ficar hospedado hoje à noite. É
                sempre calculada na hora, sem nenhum horário de corte: se uma suíte “disponível” receber
                uma reserva nova a qualquer momento do dia, ela sai das duas listas imediatamente — de
                propósito, pra nunca correr o risco de mostrar uma suíte como “disponível” quando na
                verdade já tem hóspede chegando.
              </P>
              <SubHeading>Suíte com serviço previsto hoje</SubHeading>
              <List
                items={[
                  <>
                    <strong>Troca, Arrumação, Saída com Chegada ou Somente Chegada</strong>: a suíte
                    nunca aparece em nenhuma das duas listas — qualquer um desses quatro tipos de
                    serviço pressupõe que vai ter hóspede na suíte essa noite, então ela está ocupada.
                  </>,
                  <>
                    <strong>Somente Saída</strong>: a suíte é considerada disponível — entra em
                    “limpas” se esse serviço de saída já estiver concluído, ou em “sujas” se ainda não
                    tiver sido feito.
                  </>,
                ]}
              />
              <SubHeading>Suíte sem nenhum serviço previsto hoje (já vaga)</SubHeading>
              <P>
                Nesse caso a suíte sempre entra numa das duas listas — a pergunta é só limpa ou suja.
                Pra decidir, o sistema olha a <strong>última tarefa registrada</strong> pra ela, de{" "}
                <strong>qualquer tipo</strong>, entre os dias anteriores:
              </P>
              <List
                items={[
                  <>
                    Se essa última tarefa foi especificamente uma <strong>Somente Saída concluída</strong>,
                    a suíte entra em “limpas”.
                  </>,
                  <>
                    Em qualquer outro caso — a última tarefa foi de outro tipo (mesmo uma Saída com
                    Chegada), ou foi uma Somente Saída ainda não concluída, ou a suíte não tem nenhuma
                    tarefa registrada no histórico — ela entra em “sujas”.
                  </>,
                ]}
              />
              <P>
                <strong>Por que uma Saída com Chegada mais antiga não conta como sinal de limpeza,
                mesmo concluída?</strong> Porque uma Saída com Chegada sempre implica um hóspede na
                suíte naquela noite — se ela aparece como a tarefa mais recente de uma suíte que hoje
                está vaga, é sinal de que falta algum registro entre aquele dia e hoje, não uma garantia
                de que a suíte continua limpa desde então.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 11. Comissões das camareiras */}
        <AccordionItem value="comissoes">
          <AccordionTrigger>
            <span className="font-heading text-base">
              11. Como funciona o cálculo das comissões das camareiras?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                A tela “Comissões das camareiras” (menu do Resumo Executivo) mostra as{" "}
                <strong>duas comissões diferentes</strong> que a equipe recebe, uma embaixo da outra:
                a comissão de 10% do bar por camareira, e a comissão de serviços nas suítes e no café.
                As duas usam o mesmo conceito de <strong>“último período fechado”</strong>, explicado
                primeiro abaixo porque vale pras duas.
              </P>

              <SubHeading>O “último período fechado”: por que não é o mês calendário</SubHeading>
              <P>
                A comissão do mês precisa estar pronta e paga <strong>antes</strong> do mês terminar,
                não só depois — por isso o fechamento não acompanha o calendário (dia 1 a dia 31/30):
                ele fecha sempre no <strong>dia 25</strong>, sobrando até o dia 25 do mês seguinte pra
                conferir e pagar com tranquilidade. O período que fecha no dia 25 de um mês vai do dia
                26 do mês anterior até esse dia 25. Por exemplo: o período fechado em 25/09 é “o último
                período” de 26/09 até 25/10 — só no dia 25/10, quando o período seguinte fecha, é que
                ele deixa de ser “o último”.
              </P>

              <SubHeading>Comissão de 10% do bar por camareira</SubHeading>
              <P>
                Cada camareira recebe 10% do valor de toda comanda de bar da piscina que ela lançou
                originalmente (mesmo que outra camareira tenha editado a comanda depois — quem lançou
                é sempre quem recebe; ver pergunta 5). Contas cuja taxa de serviço foi isentada pelo
                hóspede não entram no cálculo. A tela mostra duas colunas lado a lado: “Mês corrente
                (estimativa)” (soma as comandas desde o dia 1º deste mês até hoje, muda dia a dia) e
                “Último período (nome do mês)” — o valor definitivo do período já fechado, que não muda
                mais. Essa segunda coluna é sempre calculada na hora, sem precisar de nenhum botão,
                porque a comissão de bar não depende de nada que você edite manualmente.
              </P>

              <SubHeading>Comissão de serviços nas suítes e no café</SubHeading>
              <P>
                O valor total a repartir (“o pote”) é o campo “Valor da comissão por café servido”
                multiplicado pela quantidade de suítes elegíveis pro café da manhã (ver pergunta 4),
                acumulado dia a dia. Pra decidir a fatia de cada camareira, você atribui a cada uma uma{" "}
                <strong>nota de 0 a 10</strong> (começa em 5, com botões de mais/menos) reconhecendo a
                qualidade do trabalho dela — pode editar quando quiser, não é uma nota mensal. O valor
                que cada camareira recebe é a <strong>média entre dois percentuais</strong>: o
                percentual dela na quantidade total de serviços concluídos no período (troca, arrumação,
                somente saída, somente chegada, saída com chegada, de todas as camareiras somadas) e o
                percentual da nota dela na soma das notas de todas. Como os dois percentuais somam 100%
                cada um, essa média também soma 100% — o total repartido sempre bate certinho com o
                pote, sem sobra nem falta.
              </P>
              <P>
                A tela mostra uma tabela do mês corrente, que é só uma <strong>estimativa</strong> que
                muda dia a dia (percentual de serviços até hoje, sobre o pote até hoje). Pra fechar de
                verdade, use o botão <strong>“Calcular comissão do último período”</strong>: ele grava a
                nota de cada camareira exatamente como está naquele instante, aplicada sobre o
                percentual de serviços e o pote já definitivos do último período fechado, e libera
                baixar um PDF ou enviar por e-mail (pra “Cadastrar e-mail de envio”, pergunta 9) um
                demonstrativo com as duas comissões de cada camareira e o total geral. Clicar de novo
                refaz o cálculo do zero — útil se você corrigir alguma nota depois de já ter calculado.
              </P>

              <SubHeading>Quem entra no cálculo</SubHeading>
              <P>
                A camareira de teste “admin-camareira” (usada só por você pra ajustes, nunca uma
                camareira de verdade) nunca entra em nenhuma das duas comissões. Já uma camareira de
                verdade que deixou de ser usuária do sistema <strong>continua aparecendo</strong> em
                qualquer tabela ou demonstrativo referente a um período em que ela de fato trabalhou —
                ela só some das telas do dia a dia (como o Planejamento), nunca do histórico de
                comissões. Na direção contrária, uma camareira recém-cadastrada só passa a contar a
                partir do momento do cadastro dela — uma consulta a um período anterior a esse (no
                Histórico, por exemplo) não mostra ela, mesmo que hoje ela já esteja ativa.
              </P>

              <SubHeading>No Histórico</SubHeading>
              <P>
                A coluna “Comissão Suítes e Café” do Histórico (ver pergunta 12) é diferente do{" "}
                <strong>“Calcular comissão do último período”</strong> descrito acima: ali, o valor é
                sempre calculado na hora pro período arbitrário que você escolher no filtro, usando a
                nota de cada camareira como está <strong>hoje</strong> — não é o retrato fechado e
                congelado do botão “Calcular”, que é específico do último período de ~1 mês, fechado
                sempre no dia 25.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 12. Histórico */}
        <AccordionItem value="historico">
          <AccordionTrigger>
            <span className="font-heading text-base">12. Para que serve a tela “Histórico”?</span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                É onde você olha pra trás: escolhe um período (um mês, uma semana, datas específicas) e
                vê tabelas com tudo o que aconteceu naquele intervalo — serviços realizados por suíte,
                por tipo e por camareira (incluindo o tempo médio que cada uma leva do início ao fim de
                um serviço), ocorrências de manutenção mais comuns, consumo de frigobar e bar, mesas do
                café e a coluna “Comissão Suítes e Café” (usando, pra cada mês fechado, o valor
                congelado daquele mês — ver pergunta 4). A tabela “Por camareira” vem dividida em duas:
                uma com os serviços realizados (por tipo, total e duração média), outra com as
                ocorrências de manutenção, a “Comissão Bar” (contas cuja taxa foi isentada pelo hóspede
                não entram — ver pergunta 5) e a “Comissão Suítes e Café” de cada camareira no período
                escolhido — essa última sempre calculada na hora pro período que você escolher, com a
                nota de cada camareira como está hoje (diferente do “Calcular comissão do último
                período” da pergunta 11, que é um retrato fechado de um período de aproximadamente um
                mês, sempre fechado no dia 25). A camareira de teste “admin-camareira” nunca aparece em
                nenhuma das colunas de comissão. Também dá pra exportar essas informações em uma
                planilha (CSV), caso queira analisar os números em outro programa ou guardar um
                relatório.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 13. Compras */}
        <AccordionItem value="compras">
          <AccordionTrigger>
            <span className="font-heading text-base">
              13. Como funcionam as compras, e como elas se relacionam com o resto do aplicativo?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                “Compra” e “despesa” são, aqui dentro, a mesma coisa: qualquer dinheiro que a pousada
                gasta, seja um saco de farinha ou a visita de um encanador. Tudo isso é lançado numa
                única tela, chamada <strong>“Lançar compras e despesas”</strong> — ela está no menu
                principal “Compras” (pro administrador) e também no menu do funcionário de manutenção
                (os dois podem lançar). A camareira não lança compra nenhuma: ela só avisa quando algo
                está acabando e dá baixa manual num item (ver pergunta 14).
              </P>

              <SubHeading>Como uma compra é registrada, campo por campo</SubHeading>
              <List
                items={[
                  <>
                    <strong>Data</strong>, <strong>fornecedor</strong> (opcional) e{" "}
                    <strong>forma de pagamento</strong> (Pix, cartão de crédito, cartão de débito,
                    transferência bancária, dinheiro ou boleto).
                  </>,
                  <>
                    <strong>Link ou código da nota fiscal</strong> (opcional) — pode digitar, ou apontar a
                    câmera do celular pro QR code da nota e deixar o aplicativo ler sozinho.
                  </>,
                  <>
                    <strong>Observações</strong> livres.
                  </>,
                  <>
                    <strong>Foto ou PDF da nota/recibo</strong> (opcional) — tire uma foto na hora ou
                    escolha um arquivo já salvo no celular.
                  </>,
                  <>
                    Com a foto/PDF anexado, o botão <strong>“Ler nota com IA”</strong> faz a inteligência
                    artificial ler a nota sozinha e já preencher fornecedor, data, forma de pagamento e os
                    itens comprados — sempre vale conferir os dados antes de salvar, já que a leitura
                    pode errar, principalmente em notas manuscritas ou mal fotografadas.
                  </>,
                  <>
                    <strong>Itens da compra</strong> (opcional): se a nota tiver vários produtos diferentes
                    (uma compra de supermercado, por exemplo), cada um vira uma linha, com descrição,
                    quantidade e custo unitário. Se a despesa não tiver “itens” de verdade (uma conta de
                    luz, o honorário de um contador), não é preciso cadastrar nenhuma linha — só o valor
                    total.
                  </>,
                ]}
              />

              <SubHeading>Pra onde cada linha (ou o valor total) é classificada</SubHeading>
              <P>
                Toda compra ou despesa precisa cair numa de duas “gavetas”, nunca as duas ao mesmo
                tempo: um <strong>item de custo</strong> ou um <strong>ativo permanente</strong>.
              </P>
              <List
                items={[
                  <>
                    <strong>Item de custo</strong>: é a etiqueta que diz o que foi comprado — “farinha de
                    trigo”, “detergente”, “salário das camareiras”, “conta de luz”. Essas etiquetas moram
                    numa estrutura de 3 níveis chamada <strong>Plano de Contas</strong>: cada item de
                    custo pertence a um ou mais <strong>subcentros</strong> (uma categoria menor, como
                    “Alimentos” ou “Materiais de limpeza”), e cada subcentro pertence a um ou mais{" "}
                    <strong>centros de custo</strong> (a área grande da pousada: Hospedagem, Café da
                    manhã, Bar da piscina ou Frigobar). Quando um item/subcentro pertence a mais de um
                    subcentro/centro, o valor é repartido entre eles por um percentual (que sempre precisa
                    somar 100%). Esse cadastro completo fica na tela{" "}
                    <strong>“Plano de Contas”</strong> (menu “Listas” → “Plano de Contas” →{" "}
                    <strong>“Plano de itens de custo”</strong>), com 3 listas editáveis — itens de custo,
                    subcentros e centros. Ao lançar a compra, você escolhe um item de custo já existente,
                    ou cria um novo ali mesmo, sem precisar ir até “Listas” — nesse momento você também
                    diz se esse item novo “representa um item de estoque” (pergunta 14) e a quais
                    subcentros ele pertence.
                  </>,
                  <>
                    <strong>Ativo permanente</strong>: bens que não se consomem (geladeira, televisão,
                    liquidificador, ferramentas maiores etc.). Ao lançar uma compra desse tipo, você
                    escolhe a categoria do bem (Máquinas, Aparelhos, Metais e louças de banho),
                    opcionalmente um item já catalogado (ex.: “Liquidificador”), marca, modelo, garantia e
                    o local onde vai ficar guardado. Categorias e catálogo são geridos em{" "}
                    <strong>“Plano de Contas” → “Plano de itens de ativo permanente”</strong>; cada bem
                    comprado nasce sozinho, já com esses dados, na tela <strong>“Ativo Permanente”</strong>{" "}
                    (menu principal), organizada por categoria.
                  </>,
                ]}
              />

              <SubHeading>A tela “Lista de compras”</SubHeading>
              <P>
                Essa tela (menu “Compras”) junta dois sinais diferentes de “isso precisa ser comprado”,
                item por item:
              </P>
              <List
                items={[
                  <>
                    <strong>Sugestão calculada pelo sistema</strong>: baseada em quanto o item costuma ser
                    consumido e na quantidade de “dias de folga” configurada pra ele (quantos dias de
                    estoque a pousada quer sempre ter de reserva — editável, item por item, na tela
                    “Itens de estoque e ciclo de compras”, ver pergunta 14). Se o admin sabe que não
                    precisa comprar aquilo agora, pode “dispensar” essa sugestão — ela só reaparece se o
                    saldo daquele item mudar de novo (uma compra nova ou mais consumo). As dispensas
                    ativas aparecem numa seção própria, com um botão “Reativar”.
                  </>,
                  <>
                    <strong>Pedidos da equipe</strong>: a camareira e o funcionário de manutenção têm,
                    cada um no próprio menu, uma tela <strong>“Pedidos de compra”</strong> onde avisam
                    “isso está acabando”, escolhendo o item e a quantidade. Na “Lista de compras”, você
                    vê a soma de todos os pedidos pendentes daquele item e quem pediu. Assim que alguém
                    lança uma compra desse item em “Lançar compras e despesas”, todos os pedidos
                    pendentes dele são resolvidos automaticamente — não é preciso marcar nada à parte.
                  </>,
                ]}
              />

              <SubHeading>Todas as relações das compras com o resto do aplicativo</SubHeading>
              <List
                items={[
                  <>
                    <strong>Estoque</strong>: toda compra de um item marcado “representa estoque” entra
                    sozinha no saldo dele — visível na tela “Itens de estoque e ciclo de compras”, sem
                    nenhum lançamento separado (pergunta 14).
                  </>,
                  <>
                    <strong>Custos</strong>: toda compra/despesa (menos ativo permanente) alimenta as
                    telas “Custos” e “Demonstrativo de Despesas” (menu “Custos e Despesas”), que somam os
                    valores conforme a classificação escolhida no lançamento (pergunta 15).
                  </>,
                  <>
                    <strong>Ativo permanente</strong>: compras lançadas assim nunca entram em nenhum
                    cálculo de custo — só aparecem na “Relação de Ativo Permanente”.
                  </>,
                  <>
                    <strong>Inventário (contagem física)</strong>: o saldo que nasce das compras (e das
                    baixas) é exatamente o número comparado contra a contagem física de verdade, na tela
                    “Contagem de estoque” (pergunta 14).
                  </>,
                  <>
                    <strong>Ficha técnica do bar da piscina</strong>: quando um item de custo representa
                    estoque e é ingrediente de algum petisco/drink (ficha técnica cadastrada em “Ficha
                    técnica de petiscos e drinks”, menu Compras), comprar esse ingrediente sobe o estoque
                    dele, e vender o petisco/drink numa comanda desce o estoque sozinho, sem nenhuma baixa
                    manual (pergunta 14 tem o detalhe completo).
                  </>,
                  <>
                    <strong>Histórico</strong>: toda compra/despesa lançada aparece na tela “Histórico”,
                    seção “Compras e despesas no período” — com total por centro de custo, total por
                    fornecedor, a lista completa (com opção de editar ou excluir uma despesa já lançada) e
                    exportação em planilha.
                  </>,
                  <>
                    <strong>Resumo Executivo</strong>: a tela “Estoque” (dentro do menu do Resumo
                    Executivo) mostra os 20 itens mais comprados no mês e desde sempre (por valor), além
                    do saldo e da previsão de dias restantes de cada item de estoque.
                  </>,
                ]}
              />
              <P>
                <strong>Quem pode fazer o quê:</strong> admin e funcionário de manutenção lançam compras
                em “Lançar compras e despesas”; camareira e funcionário de manutenção registram pedidos
                de compra e dão baixa de estoque; as telas de relatório (Custos, Demonstrativo,
                Histórico, Plano de Contas) são só do admin.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 14. Estoques */}
        <AccordionItem value="estoques">
          <AccordionTrigger>
            <span className="font-heading text-base">
              14. Como funciona o controle de estoque da pousada?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                Nem toda mercadoria comprada é controlada como “estoque” — essa é a primeira coisa
                importante de entender aqui.
              </P>

              <SubHeading>Quais mercadorias e produtos são classificados como estoque</SubHeading>
              <P>
                Dentro do Plano de Contas (tela “Plano de Contas” → “Plano de itens de custo”, menu
                Listas), cada item de custo tem uma marcação chamada “representa estoque”. Só os itens
                marcados assim têm saldo controlado e entram nas telas de estoque — os demais (salário,
                conta de luz, honorários de contabilidade, serviços em geral) são só uma despesa, sem
                quantidade nenhuma pra acompanhar.
              </P>
              <P>
                Isso também vale pra comida: dentro de “Alimentos” do Café da manhã, por exemplo, itens
                como <strong>café</strong>, <strong>farinha de trigo</strong>, <strong>manteiga</strong>,{" "}
                <strong>queijos</strong> e <strong>linguiças</strong> são controlados como estoque — mas{" "}
                <strong>frutas</strong>, <strong>ovos</strong>, <strong>legumes</strong>,{" "}
                <strong>verduras</strong> e <strong>temperos</strong>, mesmo sendo produtos físicos
                comprados o tempo todo, não são, por serem itens muito variáveis e perecíveis, sem
                sentido prático em controlar “quantos restam” com precisão. Essa escolha é feita item por
                item, no momento em que o item de custo é criado (dentro da própria tela “Lançar compras
                e despesas”, ou direto no Plano de Contas) — e pode ser revista a qualquer momento.
              </P>

              <SubHeading>Onde fica registrado o estoque</SubHeading>
              <P>
                Nenhum número de saldo fica guardado fixo em lugar nenhum. O saldo de qualquer item de
                estoque é sempre <strong>calculado na hora</strong>, somando todo o histórico de
                “movimentos” dele desde que foi cadastrado — entradas e saídas, misturadas em ordem
                cronológica. Você vê esse saldo atual, item por item, na tela{" "}
                <strong>“Itens de estoque e ciclo de compras”</strong> (menu “Compras”), junto do
                centro/subcentro a que o item pertence (vindo do Plano de Contas) e da unidade de medida
                dele (un, kg, L etc.). Essa tela é só leitura quanto à identidade do item — o único campo
                editável ali é a quantidade de “dias de folga” (explicada mais abaixo).
              </P>

              <SubHeading>Os 4 tipos de movimento que alteram o saldo</SubHeading>
              <List
                items={[
                  <>
                    <strong>Compra</strong>: toda vez que uma compra desse item é lançada em “Lançar
                    compras e despesas”, o saldo sobe pela quantidade comprada (ver pergunta 13).
                  </>,
                  <>
                    <strong>Baixa manual</strong>: qualquer pessoa da equipe (camareira, funcionário de
                    manutenção ou admin) pode registrar que usou uma certa quantidade de um item, na tela{" "}
                    <strong>“Baixa de estoque”</strong> (existe no menu de cada um dos três papéis) —
                    busca o item pelo nome ou lê o código de barras com a câmera do celular, escolhe a
                    quantidade usada com um seletor de mais/menos (sem precisar digitar número nenhum), e
                    o saldo desce na hora.
                  </>,
                  <>
                    <strong>Consumo automático do hóspede</strong>: quando um petisco ou drink do bar da
                    piscina é vendido (numa comanda) e tem uma “ficha técnica” cadastrada — quais
                    ingredientes ele usa, e em que quantidade, na tela “Ficha técnica de petiscos e
                    drinks” (menu Compras) — o estoque de cada ingrediente usado desce sozinho, no
                    momento em que a conta daquela suíte é paga. Nenhuma camareira precisa dar baixa
                    manual nesses ingredientes.
                  </>,
                  <>
                    <strong>Ajuste de contagem física</strong>: ao fechar uma contagem (explicada abaixo),
                    se o que foi contado de verdade for diferente do saldo calculado, o sistema grava um
                    ajuste pra igualar o saldo ao número contado.
                  </>,
                ]}
              />
              <P>
                Um <strong>pedido de compra</strong> (feito pela camareira ou pela manutenção, na tela
                “Pedidos de compra” de cada uma) é diferente de tudo isso: é só um aviso visual pro
                admin, nunca altera saldo nenhum.
              </P>

              <SubHeading>“Dias de folga” e o ponto de reposição</SubHeading>
              <P>
                Cada item de estoque tem uma quantidade de <strong>“dias de folga”</strong> — quantos
                dias de estoque a pousada quer sempre ter de reserva pra esse item — editável a qualquer
                momento na tela “Itens de estoque e ciclo de compras”, com um seletor de mais/menos. A
                partir disso, o sistema calcula sozinho o <strong>ponto de reposição</strong> do item
                (quanto ele deveria ter em estoque pra nunca faltar), multiplicando quanto o item costuma
                ser consumido por semana pelos dias de folga configurados. Esse ponto de reposição
                calculado é o que decide se o item aparece na “Lista de compras” (pergunta 13) — quando o
                saldo atual fica abaixo dele.
              </P>

              <SubHeading>Contagem física (o inventário)</SubHeading>
              <P>
                É o processo de comparar, de tempos em tempos, o que o sistema calcula que deveria ter em
                estoque (o “saldo teórico”) com o que realmente existe, contando os produtos físicos de
                verdade — tela <strong>“Contagem de estoque”</strong> (menu Compras).
              </P>
              <P>
                <strong>Quais produtos se sujeitam a ela:</strong> só os itens de estoque ativos (os
                marcados “representa estoque” no Plano de Contas), sempre organizados por{" "}
                <strong>grupo</strong> — um grupo reúne todos os subcentros do Plano de Contas que têm o{" "}
                <strong>mesmo nome</strong>, mesmo pertencendo a centros diferentes. Por exemplo: existe
                um subcentro “Alimentos” dentro de “Café da manhã” e outro subcentro “Alimentos” dentro
                de “Bar da piscina” — são dois cadastros diferentes no Plano de Contas, mas uma única
                contagem de “Alimentos” já junta os itens dos dois de uma vez, numa visita só, sem
                precisar contar o mesmo tipo de produto duas vezes em dois lugares separados. Também é
                possível contar “todos os itens” de uma vez, sem separar por grupo.
              </P>
              <P>
                <strong>Como é feito:</strong> na tela “Contagem de estoque”, clique em “Iniciar
                contagem” (de um grupo específico, ou de tudo) — isso abre uma sessão nova mostrando,
                lado a lado, cada item do grupo com o saldo que o sistema calcula naquele momento
                (“teórico”). Conte os produtos de verdade (na despensa, no almoxarifado, etc.) e digite,
                item por item, a quantidade contada. Quando todos os itens do grupo estiverem
                preenchidos, clique em “Fechar contagem e ajustar estoque”: o sistema grava um ajuste pra
                cada item que ficou diferente (pra mais ou pra menos) e a contagem passa a valer como
                histórico — não dá mais pra editar os números depois disso.
              </P>
              <P>
                <strong>Quando é feito:</strong> não existe uma data automática fixa. Cada grupo de
                subcentro pode ter uma “frequência de contagem” configurada, em dias (na própria tela
                “Contagem de estoque”) — se configurada, a tela avisa com destaque vermelho quando já
                passou da hora de contar aquele grupo de novo. Sem frequência configurada pra um grupo,
                nenhum aviso aparece pra ele, mas a contagem continua podendo ser feita a qualquer
                momento, por iniciativa própria.
              </P>

              <SubHeading>Quebra de estoque</SubHeading>
              <P>
                Ao fechar uma contagem, cada item ganha uma <strong>“quebra de estoque”</strong>: a
                diferença, em percentual, entre o que foi contado e o saldo teórico (por exemplo, se o
                sistema esperava 100 unidades e só havia 92 de verdade, a quebra foi de -8%). Esse
                percentual é comparado com um limite próprio de cada item — a “quebra máxima admitida”,
                editável na própria tela de contagem com um seletor de mais/menos, em passos de 1%.
                Sempre que uma contagem fecha com quebra acima desse limite, o item passa a aparecer na
                tela <strong>“Quebra de Estoque”</strong> (menu do Resumo Executivo), como um alerta pra
                investigar o motivo (furto, erro de lançamento, perda por vencimento, etc.), ordenado do
                desvio mais grave pro menos grave.
              </P>
              <P>
                O sistema também calcula uma <strong>“quebra média dos últimos 12 meses”</strong> de cada
                item, visível já durante a própria contagem (pra servir de referência de comparação) —
                e, pra essa média não ser distorcida por um erro único e grande (alguém que digitou um
                número errado numa contagem antiga, por exemplo), contagens cuja quebra foi muito fora do
                padrão normal daquele item são automaticamente deixadas fora da média, sem precisar de
                nenhuma decisão manual.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 15. Custos */}
        <AccordionItem value="custos">
          <AccordionTrigger>
            <span className="font-heading text-base">
              15. Como o aplicativo trata os custos da pousada?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                “Despesa” e “custo” não são exatamente a mesma coisa aqui dentro. A despesa é o dinheiro
                gasto, registrado em “Lançar compras e despesas” (pergunta 13) — já o custo é essa mesma
                informação, organizada e somada de um jeito que responde perguntas como “quanto custou
                hospedar um hóspede” ou “quanto custou servir o café da manhã”. Essas contas já prontas
                ficam nas telas <strong>“Custos”</strong> e <strong>“Demonstrativo de Despesas”</strong>{" "}
                (menu principal “Custos e Despesas”).
              </P>

              <SubHeading>Como o valor de cada despesa chega até o custo de um centro</SubHeading>
              <P>
                Toda despesa (menos ativo permanente, ver mais abaixo) é ligada, no momento em que é
                lançada, a um <strong>item de custo</strong>. Cada item de custo pertence a um ou mais{" "}
                <strong>subcentros</strong>, e cada subcentro pertence a um ou mais{" "}
                <strong>centros de custo</strong> (hoje a pousada tem 4: Hospedagem, Café da manhã, Bar
                da piscina e Frigobar) — tudo isso cadastrado na tela “Plano de Contas” (pergunta 13). O
                sistema soma, automaticamente, o valor de cada despesa espalhado por toda essa cadeia de
                percentuais — é essa soma final, por centro, que aparece nos cards da tela “Custos”.
              </P>
              <P>
                <strong>Exemplo prático:</strong> a conta de água da pousada serve tanto os quartos
                quanto a cozinha do café da manhã. No Plano de Contas, o item de custo “água” pode estar
                ligado ao subcentro “Gerais” de Hospedagem e também ao subcentro “Gerais” de Café da
                manhã, cada um com uma porcentagem (por exemplo, metade pra cada) — é essa divisão que
                garante que uma única conta de água apareça, com o pedaço certo, no custo de cada parte
                da pousada, em vez de inflar um centro só ou de ter que lançar a mesma conta duas vezes.
              </P>

              <SubHeading>O que a tela “Custos” mostra</SubHeading>
              <List
                items={[
                  <>
                    <strong>Um card por centro de custo</strong>, com o total gasto nele no período
                    escolhido, mais um card extra, <strong>“Hospedagem (+ café da manhã)”</strong>, que
                    soma os dois juntos — porque o café da manhã vem incluído na diária (o hóspede não
                    paga por ele separadamente), então o custo real de hospedar alguém por uma noite
                    precisa somar os dois. O card “Café da manhã” sozinho continua mostrando o mesmo
                    valor do café, à parte, só como referência.
                  </>,
                  <>
                    <strong>Custo médio por diária ocupada</strong>: o total de “Hospedagem (+ café da
                    manhã)” dividido pela quantidade de noites realmente ocupadas no período (contagem que
                    vem da integração com a Stays).
                  </>,
                  <>
                    <strong>Rateio dos custos, por item de custo</strong>: uma tabela detalhada mostrando,
                    item por item, quanto foi gasto no total e como esse valor foi dividido entre cada
                    subcentro/centro — útil pra confirmar que a divisão configurada no Plano de Contas
                    está correta.
                  </>,
                  <>
                    <strong>Café da manhã, em detalhe</strong>: quanto foi gasto em cada item desse centro
                    no período, a quantidade de hóspedes-noite (vinda da tela “Mesas do café”) e o custo
                    médio por hóspede (total do centro ÷ hóspedes-noite). Alguns itens podem aparecer já
                    agrupados sob um rótulo só (por exemplo, “Frutas e ovos” juntos) quando não há
                    controle fino de quantidade sobre eles — ver pergunta 14 sobre quais itens entram ou
                    não no controle de estoque.
                  </>,
                  <>
                    <strong>Custo médio por prato/produto servido</strong>: para cada petisco/drink do bar
                    da piscina e cada item do frigobar que tenha uma “ficha técnica” cadastrada (tela
                    “Ficha técnica de petiscos e drinks”, pergunta 13), o sistema calcula quanto custou 1
                    porção dele — multiplicando a quantidade de cada ingrediente pelo preço médio pago por
                    esse ingrediente nas compras daquele mesmo período (nunca um preço fixo digitado à
                    mão, sempre a média real do que foi pago). Um produto sem ficha técnica cadastrada
                    aparece como “sem receita cadastrada”.
                  </>,
                ]}
              />

              <SubHeading>O que a tela “Demonstrativo de Despesas” mostra</SubHeading>
              <P>
                É a mesma informação de custos, só que organizada como uma tabela mês a mês: uma linha
                por centro de custo, uma coluna por mês — útil pra comparar a evolução dos gastos ao
                longo do tempo (ver se um centro está gastando mais ou menos do que em meses anteriores).
                O período padrão é os últimos 12 meses, mas pode ser trocado por qualquer outro intervalo.
              </P>

              <SubHeading>O que nunca entra no cálculo de custo</SubHeading>
              <P>
                Uma compra lançada como <strong>ativo permanente</strong> (uma geladeira nova, por
                exemplo) nunca aparece em nenhum dos cálculos acima — comprar um bem desses não é um
                custo do período, é um bem que a pousada passa a ter, e por isso só aparece na tela
                “Relação de Ativo Permanente” (pergunta 13).
              </P>

              <SubHeading>Quais são os principais itens de custo</SubHeading>
              <P>
                Toda essa lista — centros, subcentros e itens de custo — fica sempre visível e editável
                na tela “Plano de Contas” (Listas → Plano de Contas → Plano de itens de custo), e pode
                crescer: ao lançar uma despesa nova, o admin pode criar um item de custo na hora, se
                nenhum dos já existentes encaixar. Alguns exemplos reais já cadastrados, pra dar uma
                ideia do tamanho e da variedade:
              </P>
              <List
                items={[
                  <>
                    <strong>Hospedagem</strong>: água, luz, internet, dedetização e impostos (Gerais);
                    amenities, papel higiênico, secador de cabelo (Materiais das suítes); toalhas,
                    lençóis, fronhas (Enxoval de cama e banho); salário das camareiras e dos funcionários
                    de manutenção, encargos, cesta básica, plano de saúde, transporte (Mão de obra);
                    materiais de jardim, de piscina e de manutenção, ferramentas; honorários
                    administrativos (Stays, contabilidade, financeiro, pró-labore); materiais de limpeza.
                  </>,
                  <>
                    <strong>Café da manhã</strong>: água, luz e gás (Gerais); frutas, ovos, café, pães,
                    queijos, legumes, verduras e temperos, entre muitos outros (Alimentos); salário e
                    encargos da mão de obra própria desse centro; honorários administrativos e materiais
                    de limpeza, também com cadastro próprio aqui.
                  </>,
                  <>
                    <strong>Bar da piscina e Frigobar</strong>: estrutura parecida, cada um com seus
                    próprios itens de bebida/petisco e materiais específicos.
                  </>,
                ]}
              />
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
