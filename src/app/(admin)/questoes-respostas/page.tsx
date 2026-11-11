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
                No menu principal <strong>“Sincronização”</strong> existe um botão manual
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
                registra qualquer problema encontrado (ver pergunta 6) e, ao final, libera a suíte. Ao
                liberar, o serviço é concluído direto — a revisão é dispensada por padrão. Se você (ou o gerente
                operacional) habilitou a revisão daquela suíte no Planejamento diário, ele NÃO fica concluído: fica
                “pendente de revisão”. Você acompanha
                tudo isso em tempo real na tela de Planejamento.
              </P>
              <P>
                <strong>Revisão por outra camareira:</strong> uma camareira diferente (nunca a mesma que
                executou) escolhe o serviço na seção “Aguardando revisão”, confere item por item marcando
                “Completo” ou “Incompleto” (inclusive o frigobar), pode registrar ocorrências de manutenção
                e observações, e encerra a revisão. Se tudo estiver completo, o serviço é concluído. Se
                algum item estiver incompleto, ele volta para a camareira que executou como “serviço de
                correção”: ela aperta “Iniciar correção”, vê só os itens incompletos, marca cada um como
                corrigido e finaliza — aí sim o serviço é concluído. No frigobar, ela vê os valores que já
                tinha lançado e pode editá-los; o novo consumo só é gravado ao finalizar a correção (se a
                conta da suíte já estiver fechada ou paga, o consumo não é alterado e aparece um aviso —
                o ajuste fica com você). Os horários de início, término e duração da revisão e da
                correção aparecem na tabela “Serviços dos últimos 7 dias” e no Histórico.
              </P>
              <P>
                <strong>Habilitar e dispensar a revisão:</strong> no Planejamento diário, a coluna “Revisão” tem uma
                chave por suíte (desligada por padrão, até a suíte ser liberada). Se uma revisão já estiver pendente e
                não houver outra camareira disponível, você (ou o gerente operacional) pode dispensá-la no card
                “Serviços pendentes de revisão” do próprio Planejamento diário: o serviço passa direto a concluído, sem revisora, e não conta serviço de
                revisão para ninguém na comissão. Na comissão, cada revisão concluída vale um serviço
                para a revisora, e o serviço só conta quando o ciclo inteiro termina. Uma suíte de
                “Somente Saída” pendente de revisão ou de correção aparece como suja em “Suítes vagas e
                limpas” até ficar totalmente concluída.
              </P>
              <P>
                Se a camareira escolher a suíte errada ou mudar de ideia antes de terminar, ela também
                pode cancelar a própria escolha a qualquer momento: o serviço volta pra lista de
                disponíveis pra qualquer uma escolher de novo, e tudo que já tinha sido preenchido
                naquela tentativa (itens marcados, ocorrências, observação) é apagado.
              </P>
              <SubHeading>Limpeza adicional (uma vez por semana, por suíte)</SubHeading>
              <P>
                Uma vez por semana (de segunda a domingo), cada suíte recebe uma <strong>limpeza adicional</strong>:
                quatro itens extras (filtro do ar condicionado, topo do armário, base da cama e espelho da cama)
                acrescentados ao checklist de uma <strong>troca</strong>, de uma <strong>saída com chegada</strong> ou
                de uma <strong>somente saída</strong>. No Planejamento Diário aparece uma etiqueta “+ Limpeza adicional”
                e, nas telas da camareira, o nome fica, por exemplo, “Troca com Limpeza adicional”.
              </P>
              <P>
                O sistema escolhe sozinho, a cada sincronização com a Stays, quais suítes recebem. Desde 11/11/2026 o limite
                de cada dia depende de quantas suítes têm serviço nele: até 5 suítes, no máximo 3 limpezas adicionais; de
                6 a 9 suítes, no máximo 2; com mais de 9 suítes, nenhuma — e nunca mais de 3 num mesmo dia. Nenhuma suíte
                recebe mais de uma por semana, e quem ficou sem na semana anterior passa na frente. A ordem de prioridade
                dos dias é segunda, terça, quarta, quinta, sexta, domingo e, por último, sábado; se a semana começar com
                feriados seguidos (só a segunda; segunda e terça; segunda a quarta…), esses dias passam a valer como o
                domingo e a ordem normal recomeça no primeiro dia seguinte; o Carnaval (segunda a quarta) sempre conta
                assim. Entre as suítes do
                dia, a preferência é somente saída, depois saída com chegada, depois troca. Serviços
                já escolhidos ou iniciados nunca são alterados.
              </P>
              <P>
                Esse serviço é feito por <strong>duas camareiras</strong>. A primeira escolhe como sempre e é a única que
                vê e preenche o checklist; a segunda escolhe depois, na seção “Limpeza adicional — falta a 2ª camareira”.
                O serviço só pode começar quando a segunda escolher, e o horário de início é o da escolha dela. Ele conta
                para as duas (comissão, histórico, registro de serviços), e nenhuma das duas pode ser a revisora. Os
                quatro itens extras são editados em “Listas operacionais → Check lists de serviços nas suítes → Limpeza
                adicional (itens extras)”, pelo admin e pelo gerente operacional.
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
                para o endereço cadastrado em “Cadastrar e-mail de envio” (menu “Integração”,
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
                Você mesmo cadastra e edita essas categorias e itens na tela “Listas operacionais” (quantos dias
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
                Existe também o papel <strong>“Gerente operacional”</strong>: ele só enxerga o Resumo
                executivo (com “Serviços nas suítes”, “Suítes vagas e limpas” e o Calendário de reservas), o Módulo
                operacional (Planejamento diário, Chegadas &amp; saídas, Mesas do café, Consumo de Bar e Frigobar e
                Comissões das camareiras), a Sincronização e, no Módulo Contábil, só Lançar compra ou despesa, a Caixa de conferência e o Relatório de despesas. Ele não vê o Resultado mensal nem as demais telas contábeis.
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
                É a primeira tela que você vê ao entrar. No topo ficam 2 cards de “Consulta rápida”:
                suítes concluídas hoje e ocorrências de manutenção hoje. (As comissões ficam na tela
                “Comissões das camareiras”, explicadas na pergunta 11.) Logo abaixo ficam os botões de sincronização com a Stays
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
                    <strong>Ticket médio de canais de venda</strong>: uma tabela, só para o admin, com os
                    próximos 6 meses. Cada suíte tem o seu bloco, com uma linha por canal: Booking, Airbnb,
                    Expedia, Decolar e Reservas diretas — os preços cadastrados na Stays variam
                    de suíte para suíte, então não há médias entre suítes. Cada mês tem 5 colunas:
                    diárias reservadas (cada noite conta no dia em que começa), preço médio cadastrado (o
                    preço de cada dia do mês na Stays com a correção do canal, dividido pelos dias do mês),
                    ticket médio cadastrado (o mesmo preço cadastrado, mas só nos dias das diárias
                    reservadas), ticket médio cobrado (o que os hóspedes realmente pagaram por diária,
                    dividindo as reservas dia a dia entre os meses, sem taxas) e a variação, que compara o
                    cobrado com o cadastrado nos mesmos dias — é o desconto ou ágio real de cada canal,
                    sem o efeito de fins de semana mais caros. A correção
                    de preço de cada canal (por exemplo 38% no Airbnb) é a mesma da Stays, em Dashboard de
                    Channel Managers, Configurações, Financeiro — como a Stays não a informa ao sistema, você
                    digita os percentuais na própria tela e atualiza se mudarem lá. Os dados são atualizados
                    todo dia sozinhos e também quando você usa os botões de sincronização com a Stays.
                  </>,
                  <>
                    <strong>Calendário de reservas - Stays</strong>: uma grade igual à do calendário da
                    Stays, com cada suíte numa linha e cada dia numa coluna. Cada reserva aparece como
                    uma barra colorida (começa à tarde do dia da entrada e termina de manhã no dia da
                    saída) com o nome do hóspede. A cor mostra a origem: azul escuro = Booking, verde =
                    Airbnb, verde claro = Decolar, azul claro = Expedia, amarelo = reserva direta (site
                    ou lançada à mão), vermelho escuro = bloqueio, laranja escuro = bloqueio de
                    manutenção e vermelho claro = outras origens. Ao lado do nome, um código mostra a
                    situação: (Pre) pré-reserva e (Con) contrato; reserva confirmada, bloqueio e
                    manutenção não levam código, e reservas canceladas não aparecem. Passando o mouse (ou
                    tocando, no celular) sobre uma barra abre um cartão com nome completo, origem,
                    situação e período. Você escolhe o período em “De” e “Até” e clica em Atualizar. É
                    só consulta: nada é alterado na Stays nem no app. O gerente operacional também vê
                    essa tela.
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
                Essa tela (menu do Resumo executivo, “Suítes vagas e limpas, disponíveis para alugar”)
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
                A tela “Comissões das camareiras” (Módulo operacional) mostra as{" "}
                <strong>duas comissões diferentes</strong> que a equipe recebe, uma embaixo da outra:
                a comissão de 10% do bar por camareira, e a comissão de serviços nas suítes e no café.
                As duas usam o mesmo conceito de <strong>“mês anterior”</strong>, explicado
                primeiro abaixo porque vale pras duas.
              </P>

              <SubHeading>O “mês anterior”</SubHeading>
              <P>
                As duas comissões são fechadas pelo <strong>mês calendário</strong>: o “mês anterior” é
                o mês completo, do dia 1º ao último dia. Por exemplo, a comissão de outubro considera de
                01/10 a 31/10 — e vale como “mês anterior” durante todo novembro.
              </P>

              <SubHeading>Comissão de 10% do bar por camareira</SubHeading>
              <P>
                Cada camareira recebe 10% do valor de toda comanda de bar da piscina que ela lançou
                originalmente (mesmo que outra camareira tenha editado a comanda depois — quem lançou
                é sempre quem recebe; ver pergunta 5). Contas cuja taxa de serviço foi isentada pelo
                hóspede não entram no cálculo. A tela mostra duas colunas lado a lado: “Mês corrente
                (estimativa)” (soma as comandas desde o dia 1º deste mês até hoje, muda dia a dia) e
                “Mês anterior (nome do mês)” — o valor definitivo do mês já encerrado, que não muda
                mais. Essa segunda coluna é sempre calculada na hora, sem precisar de nenhum botão,
                porque a comissão de bar não depende de nada que você edite manualmente.
              </P>

              <SubHeading>Comissão de serviços nas suítes e no café</SubHeading>
              <P>
                O valor total a repartir (“o pote”) é o campo “Valor da comissão por café servido”
                multiplicado pela quantidade de suítes elegíveis pro café da manhã (ver pergunta 4),
                acumulado dia a dia. Pra decidir a fatia de cada camareira, você atribui a cada uma uma{" "}
                <strong>nota de 0 a 10</strong> (começa em 10, com botões de mais/menos) reconhecendo a
                qualidade do trabalho dela — pode editar quando quiser, não é uma nota mensal. A parte de
                cada camareira vem do <strong>percentual dela na quantidade total de serviços
                concluídos</strong> no período (troca, arrumação, somente saída, somente chegada, saída
                com chegada, de todas as camareiras somadas), <strong>multiplicado pela nota dividida por
                10</strong>. Nota 10 paga a parte inteira; nota 0 zera a parte dela. Reduzir a nota de uma
                camareira reduz só a comissão dela — a das outras não muda, e o valor que sobra não é
                redistribuído (por isso o total pago pode ficar menor que o pote).
              </P>
              <P>
                A tela mostra, acima de cada tabela, o <strong>bolo de comissão</strong> (o total de suítes e
                café que seria pago se todas as camareiras tivessem nota 10). A tabela do mês corrente é só
                uma <strong>estimativa</strong> que muda dia a dia, sem notas (considera todas com nota 10). A do <strong>mês anterior</strong> é a
                oficial: a nota de cada camareira é editada direto nela (começa em 10), os valores se
                atualizam na hora — não há botão de calcular — e dá pra baixar um PDF ou enviar por e-mail
                (pra “Cadastrar e-mail de envio”, pergunta 9) o demonstrativo com as duas comissões de cada
                camareira e o total geral. No fim da tela, o card <strong>“Registro mensal das comissões”</strong>
                guarda os meses mais antigos: quando o mês vira, o mês que era “mês anterior” passa pra esse
                registro, com os valores (notas e comissões) congelados, e o mês que acabou de fechar assume o
                lugar de “mês anterior”.
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
                tabela do <strong>mês anterior</strong> descrita acima: no Histórico, o valor é
                sempre calculado na hora pro período arbitrário que você escolher no filtro, usando a
                nota atual de cada camareira (a do mês corrente) — a tabela do mês anterior usa a nota
                própria daquele mês.
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
                congelado daquele mês — ver pergunta 4). A tabela “Por camareira — serviços e comissões” mostra, pra cada
                camareira, os serviços realizados (por tipo, total e duração média), a “Comissão Bar”
                (contas cuja taxa foi isentada pelo hóspede não entram — ver pergunta 5) e a “Comissão
                Suítes e Café” no período escolhido. Essa última é calculada na hora, mês a mês, usando a
                nota gravada de cada mês (10 quando nenhuma foi gravada). A camareira de teste
                “admin-camareira” nunca aparece em nenhuma das colunas de comissão. Também dá pra exportar
                essas informações em uma planilha (CSV), caso queira analisar os números em outro
                programa ou guardar um relatório.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 13. Compras, despesas e resultado mensal (modelo simplificado, desde 11/11/2026) */}
        <AccordionItem value="compras">
          <AccordionTrigger>
            <span className="font-heading text-base">
              13. Como funcionam as compras, as despesas e o resultado mensal?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                A pousada <strong>não controla estoque</strong>. Tudo o que é comprado ou pago no mês é
                despesa do mês. A data da compra é também a data do pagamento. O objetivo é chegar, todo mês,
                perto do lucro operacional gerencial. O novo modelo vale a partir de 01/11/2026.
              </P>
              <SubHeading>Lançar uma compra ou despesa</SubHeading>
              <P>
                Em <strong>Módulo Contábil → Lançar compra ou despesa</strong> (ou pela Caixa de conferência,
                abaixo), cada item da nota recebe uma <strong>categoria de despesa</strong> (Alimentos, Materiais
                de limpeza, Despesas de consumo etc.). Na categoria Alimentos você pode marcar o{" "}
                <strong>ingrediente</strong> de produto de bar, quando for o caso.
              </P>
              <SubHeading>Categorias, prazo de consumo e centros de custo</SubHeading>
              <P>
                Em <strong>Listas contábeis → Categorias de despesa e centros de custo</strong>, cada categoria
                tem um <strong>prazo de consumo em dias</strong>. Prazo 1 = consumo imediato (cai todo no mês da
                compra). Prazo maior (ex.: 30 dias para limpeza): o valor da nota é dividido por dia, a partir
                da data da compra, e distribuído entre os meses. Há quatro centros: <strong>Hospedagem, Bar,
                Café da manhã e Frigobar</strong>. Alimentos se divide entre Bar e Café (ingrediente de bar segue
                a divisão cadastrada nele; o resto vai ao Café). Demais bebidas se divide entre Bar e Frigobar
                pelas quantidades vendidas no mês. Despesas de consumo (luz, água, gás, internet) têm divisão
                fixa entre Hospedagem, Bar e Café. Bebidas quentes vão ao Bar; as demais categorias, à
                Hospedagem. Impostos não entram em centro nenhum e aparecem só no final.
              </P>
              <SubHeading>Ativo permanente</SubHeading>
              <P>
                Um item só é ativo permanente (não é despesa do mês) se o valor for igual ou maior que o limite
                (R$ 1.200, editável) <strong>e</strong> a vida útil for maior que 12 meses (editável). Ele vai para
                o <strong>Inventário de ativo permanente</strong>. Não há depreciação.
              </P>
              <SubHeading>Itens recorrentes</SubHeading>
              <P>
                Salários, honorários e outras despesas que se repetem ficam em{" "}
                <strong>Listas contábeis → Itens recorrentes</strong>. Todo mês o sistema cria o lançamento no dia
                combinado; você só ajusta o valor quando mudar.
              </P>
              <SubHeading>Fechamento do mês e lançamentos tardios</SubHeading>
              <P>
                O mês fecha no último dia. Compras e despesas ainda podem ser lançadas até 30 dias depois: entram
                sozinhas, com a marca “lançado após o fechamento do mês”. Depois de 30 dias ficam{" "}
                <strong>em vermelho</strong> no relatório até o admin aprovar ou cancelar. O mesmo vale para a receita
                de bar, de frigobar e de hospedagem (correções da Stays).
              </P>
              <SubHeading>Caixa de conferência e importação do WhatsApp</SubHeading>
              <P>
                No grupo de compras do WhatsApp, use “Exportar conversa” (com mídia) e envie o arquivo em{" "}
                <strong>Caixa de conferência → Importar conversa</strong>. Cada foto de nota, com as mensagens do
                mesmo remetente logo depois, vira um item. A IA sugere data, fornecedor, categoria e ingrediente;{" "}
                <strong>nada é lançado sem a sua conferência</strong>: você confere com a foto, corrige e lança, ou
                descarta o que não for compra.
              </P>
              <SubHeading>Relatório de despesas e Resultado mensal</SubHeading>
              <P>
                O <strong>Relatório de despesas (regime caixa)</strong> lista cada compra e despesa em ordem da data
                da compra, para conferir com o extrato do banco. O <strong>Resultado mensal</strong> mostra, por
                centro de custo, as receitas (hospedagem bruta, comissão dos canais, hospedagem líquida, bar com taxa
                de serviço, frigobar), as despesas por categoria e o resultado, e no fim o lucro operacional. A
                receita de bar e de frigobar vale no mês em que o pedido foi lançado, e só entra depois que a conta é
                fechada.
              </P>
              <SubHeading>Ficha técnica e custo dos produtos do bar</SubHeading>
              <P>
                Em <strong>Listas contábeis → Ficha técnica</strong> você diz quais ingredientes entram em cada
                petisco ou drink. Em <strong>Custo e rentabilidade dos produtos do bar</strong> o sistema estima, mês
                a mês, o custo médio e a margem de cada produto. É uma <strong>estimativa</strong>: divide o que foi
                comprado de cada ingrediente entre os produtos, pela quantidade vendida.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="indicadores">
          <AccordionTrigger>
            <span className="text-left">14. Como são calculados os indicadores (ADR, RevPAR, NetRevPAR e ocupação)?</span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                A tela <strong>Indicadores</strong> (Resumo executivo, só para o administrador) mostra, mês a
                mês, o desempenho da pousada com os dados da Stays. Tudo é contado por <strong>diária</strong>:
                cada diária pertence ao dia em que começa (o check-in conta, o check-out não). Uma reserva
                que atravessa a virada do mês dá a cada mês a sua parte das diárias e da receita — um check-out
                no dia 1º é diária do último dia do mês anterior, e um check-in no último dia do mês é diária
                desse dia. Reservas canceladas não entram em nada. A tela separa os <strong>meses fechados</strong>{" "}
                do <strong>mês corrente e dos seguintes</strong>, que ainda mudam com novas reservas.
              </P>
              <SubHeading>As fórmulas</SubHeading>
              <List
                items={[
                  <>
                    <strong>Diárias disponíveis</strong>: número de suítes × dias do mês. O número de suítes de cada mês é fixo na tela: 1 até
                    dezembro de 2024, 5 de janeiro a setembro de 2025, 7 de outubro a dezembro de 2025 e 11 a partir de janeiro de 2026.
                  </>,
                  <>
                    <strong>ADR</strong> (diária média): receita bruta de hospedagem ÷ diárias vendidas. Só
                    entram diárias com cobrança; as gratuitas ficam fora.
                  </>,
                  <>
                    <strong>RevPAR</strong> (receita por diária disponível): receita bruta ÷ diárias disponíveis.
                  </>,
                  <>
                    <strong>NetRevPAR</strong>: (receita bruta − comissões dos canais) ÷ diárias disponíveis.
                  </>,
                  <>
                    <strong>Ocupação comercial</strong>: diárias vendidas ÷ diárias disponíveis.
                  </>,
                  <>
                    <strong>Ocupação física</strong>: (vendidas + gratuitas + bloqueadas) ÷ (disponíveis −
                    manutenção).
                  </>,
                ]}
              />
              <P>
                A <strong>receita bruta</strong> é só a de hospedagem, diária a diária, antes das comissões e
                sem impostos ou taxas. A <strong>comissão</strong> de Booking, Airbnb e Decolar vem da própria
                Stays: ela informa, em cada reserva, o valor em reais cobrado pelo canal, e o sistema reparte esse valor entre
                as diárias. A <strong>Expedia</strong> e as <strong>reservas diretas</strong> não têm comissão: a diária da
                Expedia na Stays já vem líquida, porque a Expedia cobra a comissão do hóspede e não da pousada. A comissão só
                afeta o NetRevPAR. A tabela mostra, mês a mês, a receita de hospedagem, as comissões, o total
                de noites vendidas e o total de noites disponíveis usados nas contas.
              </P>
              <SubHeading>Onde o pedido original e o padrão da STR/CoStar diferem: duas colunas</SubHeading>
              <P>
                O pedido original descontava as noites bloqueadas e as de manutenção do total de diárias disponíveis. O padrão
                internacional da STR/CoStar <strong>não faz isso</strong>: a oferta é sempre todas as suítes × todos os dias do mês — uma
                suíte só sai da conta quando é retirada do inventário por um período longo (uma reforma, por exemplo). Como os dois
                critérios são úteis, a tela mostra <strong>as duas versões lado a lado</strong>, sempre rotuladas:
              </P>
              <List
                items={[
                  <>
                    <strong>RevPAR e NetRevPAR (STR)</strong>: divididos por todas as suítes × dias do mês. <strong>(PRD)</strong>:
                    divididos pelas diárias sem bloqueio nem manutenção (coluna “Disponíveis (PRD)”).
                  </>,
                  <>
                    <strong>Ocupação comercial (STR)</strong>: vendidas ÷ todas as diárias do mês. <strong>(PRD)</strong>: vendidas ÷
                    (diárias do mês − manutenção).
                  </>,
                  <>
                    <strong>ADR</strong> e <strong>Ocupação física</strong> não têm versão dupla: o ADR é igual nos dois critérios, e a
                    ocupação física só existe no pedido original (a STR não a define).
                  </>,
                ]}
              />
              <P>
                A STR também não conta cortesias (diárias gratuitas) como vendidas nem como receita, o que coincide com o pedido. As noites
                de bloqueio e de manutenção aparecem em colunas próprias, para você ver quanto pesaram.
              </P>
              <P>
                Os números ficam guardados no app e são atualizados a cada sincronização com a Stays (manual
                ou automática). Na primeira abertura a tela importa todo o histórico, o que leva alguns
                instantes; o botão “Atualizar histórico completo” refaz essa importação quando necessário.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
