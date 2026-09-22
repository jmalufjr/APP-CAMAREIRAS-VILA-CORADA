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
                repartição entre as camareiras ficam na tela “Comissões das camareiras”, explicada na
                pergunta 9.
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
                lançou (ver pergunta 9). Como essa taxa não é uma cobrança obrigatória por lei, se o
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
                    <strong>Suítes vagas e limpas, disponíveis para alugar</strong>: duas listas —
                    suítes limpas e suítes sujas — só das suítes sem hóspede previsto para hoje à
                    noite (uma suíte com Troca, Arrumação, Saída com Chegada ou Somente Chegada hoje
                    nunca aparece aqui, porque está ocupada). Uma suíte entra em “limpas” quando o
                    serviço de saída dela já foi concluído; caso contrário — ou se ela já estava vaga e
                    o último serviço registrado nela não foi uma saída concluída — aparece em “sujas”.
                    Atualiza na hora: se uma suíte “disponível” receber uma reserva nova a qualquer
                    momento do dia, ela sai das duas listas imediatamente.
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
                    <strong>Comissões das camareiras</strong>: as duas comissões da equipe, uma embaixo
                    da outra, seguindo o mesmo conceito de <strong>último período fechado</strong> — que{" "}
                    <strong>não acompanha o mês calendário</strong>: fecha sempre no dia 25, não no
                    último dia do mês, pra sobrar tempo de conferir e calcular antes do mês virar. Por
                    exemplo, o período fechado em 25/09 é “o último período” de 26/09 até 25/10, quando
                    o período seguinte (fechado em 25/10) toma o lugar dele. Primeiro a{" "}
                    <strong>comissão de 10% do bar por camareira</strong>, com duas colunas lado a lado:
                    “Mês corrente (estimativa)” (soma as comandas desde o dia 1º deste mês até hoje,
                    muda dia a dia) e “Último período (nome do mês)” (o valor definitivo do período já
                    fechado, que não muda mais — calculado na hora, sem precisar de nenhum botão, já
                    que a comissão de bar não depende de nada que você edite). Depois a{" "}
                    <strong>comissão de serviços nas suítes e no café</strong>: o campo “Valor da
                    comissão por café servido” (que decide o tamanho do pote do dia, junto com a
                    quantidade de suítes elegíveis pro café), uma tabela do mês corrente mostrando, pra
                    cada camareira, o percentual de serviços que ela já concluiu no mês (troca,
                    arrumação, somente saída, somente chegada, saída com chegada) e uma{" "}
                    <strong>nota de 0 a 10</strong> que você edita quando quiser (começa em 5, com
                    botões de mais/menos) pra reconhecer a qualidade do trabalho de cada uma — o valor
                    que cada camareira recebe é uma média entre o quanto ela trabalhou e o quanto sua
                    nota representa do total de notas, sempre somando 100% entre todas. Essa tabela do
                    mês corrente é só uma estimativa que muda dia a dia; para fechar de verdade, use o
                    botão “Calcular comissão do último período” — ele grava a nota de cada camareira
                    exatamente como está naquele instante junto com os números já definitivos do último
                    período fechado, e libera baixar um PDF ou enviá-lo por e-mail com as duas
                    comissões de cada camareira e o total geral. Clicar de novo refaz o cálculo (útil
                    se você corrigir alguma nota depois). Em nenhuma das duas comissões a camareira de
                    teste “admin-camareira” (usada só por você pra ajustes, nunca uma camareira de
                    verdade) entra no cálculo — mas uma camareira de verdade que deixou de ser usuária
                    do sistema <strong>continua aparecendo normalmente</strong> em qualquer tabela ou
                    demonstrativo referente a um período em que ela de fato trabalhou; ela só some das
                    telas do dia a dia (como o Planejamento), não do histórico de comissões.
                  </>,
                  <>
                    <strong>Cadastrar e-mail de envio</strong>: o e-mail que recebe automaticamente o
                    recibo de uma conta paga (ver pergunta 5) e pra onde você pode enviar o demonstrativo
                    de comissões descrito acima.
                  </>,
                ]}
              />
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 10. Histórico */}
        <AccordionItem value="historico">
          <AccordionTrigger>
            <span className="font-heading text-base">10. Para que serve a tela “Histórico”?</span>
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
                período” da pergunta 9, que é um retrato fechado de um período de aproximadamente um
                mês, sempre fechado no dia 25). A camareira de teste “admin-camareira” nunca aparece em
                nenhuma das colunas de comissão. Também dá pra exportar essas informações em uma
                planilha (CSV), caso queira analisar os números em outro programa ou guardar um
                relatório.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
