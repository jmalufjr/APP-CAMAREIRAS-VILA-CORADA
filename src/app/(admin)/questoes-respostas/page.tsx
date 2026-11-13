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
                para o endereço cadastrado em “Cadastrar e-mail de envio” (menu “Integração” — sem
                precisar mexer em nada técnico). Se o envio falhar por algum motivo,
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
                Existe também o papel <strong>“Gerente operacional”</strong>. Ele enxerga o Resumo executivo
                (menos “Ticket médio de canais de venda” e “Indicadores”, que são só do administrador), o Módulo operacional
                (inclusive as Comissões das camareiras e as Listas operacionais, mas, dentro das Listas operacionais, sem
                “Ocorrências Manutenção” e “Manutenção Preventiva”), a Sincronização e, no Módulo gerencial, apenas dois
                itens, <strong>só para consulta</strong>: o <strong>Resultado mensal</strong> e o{" "}
                <strong>Relatório de despesas</strong>. O gerente <strong>não lança compras nem despesas</strong>, não usa a
                Caixa de conferência, não importa a conversa do WhatsApp e não pode editar, mover nem aprovar nada: tudo isso
                é só do administrador. A divisão de trabalho é esta: o gerente manda as fotos das notas para o grupo do
                WhatsApp e exporta a conversa; o administrador importa o arquivo, confere e lança. O gerente também não vê a
                Rentabilidade de Petiscos e Drinks, o Inventário de ativo permanente nem as Listas gerenciais.
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
                “Comissões das camareiras”, no Módulo operacional, explicadas na pergunta 11; os botões de sincronização com a Stays
                ficam no menu “Sincronização”, pergunta 1.)
              </P>
              <P>
                Mais abaixo tem um menu levando a 8 telas com mais detalhes, cada uma com um botão pra
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
                    <strong>Avaliações dos hóspedes</strong>: três telas com as avaliações que os hóspedes deixam nos
                    canais (Booking, Airbnb, Expedia e o formulário da própria Stays). Em “Avaliações: conteúdo e
                    resposta” você vê cada avaliação, com as notas por item e os comentários, e pode escrever uma resposta
                    (ela fica registrada só no aplicativo). “Médias” mostra as notas por suíte, por canal e por item.
                    “Assuntos citados pelos hóspedes” mostra os temas mais elogiados e mais criticados, lidos dos comentários
                    pela IA. Avaliações novas dos últimos 7 dias ganham uma marca. O gerente operacional também vê essas
                    telas.
                  </>,
                  <>
                    <strong>Indicadores</strong>: ocupação, diária média e as demais medidas de desempenho da hospedagem —
                    explicado com detalhe na pergunta 16 (só para o administrador).
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
                (pra “Cadastrar e-mail de envio”, no menu “Integração”) o demonstrativo com as duas comissões de cada
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

        {/* 13. Lançar compras e despesas (modelo simplificado, desde 01/11/2026) */}
        <AccordionItem value="compras">
          <AccordionTrigger>
            <span className="font-heading text-base">
              13. Como lançar uma compra ou despesa, e o que o sistema faz com ela?
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                Este item é o manual de lançamento de compras e despesas. Ele explica, na ordem: as regras de base, as três
                formas de lançar, as verificações que evitam lançamento duplicado e erro de categoria, o prazo para lançar, o
                Relatório de despesas, as categorias de despesa e os centros de custo, os itens recorrentes e o ativo
                permanente. O que acontece com o dinheiro depois do lançamento (o resultado do mês) está na pergunta 14. O
                cálculo da rentabilidade de petiscos e drinks está na pergunta 15. Tudo isto vale para compras e despesas a
                partir de 01/11/2026.
              </P>

              <SubHeading>1. As regras de base</SubHeading>
              <List
                items={[
                  <>
                    O sistema <strong>não controla estoque</strong>. Ninguém “dá baixa” em nada. Tudo o que a pousada compra
                    ou paga no mês é <strong>despesa daquele mês</strong>. A única exceção é o ativo permanente (veja o
                    tópico 10).
                  </>,
                  <>
                    A <strong>data da compra é também a data do pagamento</strong>. Não existe compra a prazo nem parcelada:
                    lance a compra no dia em que ela foi paga.
                  </>,
                  <>
                    O sistema não aceita data <strong>futura</strong> nem data <strong>anterior a 01/11/2026</strong>.
                  </>,
                  <>
                    A <strong>forma de pagamento</strong> (PIX, dinheiro, cartão de débito, cartão de crédito, transferência
                    ou boleto) é só um registro, para você conferir com o extrato do banco. Ela não muda nenhum cálculo.
                  </>,
                  <>
                    <strong>Quem lança:</strong> somente o <strong>administrador</strong>. Lançar, usar a Caixa de conferência,
                    importar a conversa do WhatsApp, <strong>editar</strong> um lançamento antigo, <strong>mover</strong> uma
                    despesa e <strong>aprovar</strong> lançamento atrasado são ações dele. O gerente operacional só consulta o
                    Relatório de despesas e o Resultado mensal, e é quem envia as fotos das notas ao grupo do WhatsApp e exporta
                    a conversa.
                  </>,
                ]}
              />

              <SubHeading>2. As formas de lançar uma compra ou despesa</SubHeading>
              <P>Existem três caminhos.</P>

              <P>
                <strong>Caminho A — Lançamento manual.</strong> Vá em <strong>Módulo gerencial → Lançar compra ou
                despesa</strong>. Preencha, nesta ordem:
              </P>
              <List
                items={[
                  <>
                    <strong>Data da compra</strong> (que é a data do pagamento), <strong>Fornecedor</strong>,{" "}
                    <strong>Número da nota</strong> (opcional) e <strong>Forma de pagamento</strong>.
                  </>,
                  <>
                    Para <strong>cada item da nota</strong>: <strong>Descrição</strong>, <strong>Categoria</strong>,{" "}
                    <strong>Quantidade</strong> e <strong>Valor total (R$)</strong> daquela linha (a quantidade vezes o preço
                    de cada unidade). Se a categoria aceitar ingrediente, aparece também o campo{" "}
                    <strong>Ingrediente</strong> (veja o tópico 4). Use “Adicionar item” para notas com vários itens.
                  </>,
                  <>
                    <strong>Vida útil (meses)</strong>: só para bens duráveis, como um eletrodoméstico. Serve para o sistema
                    decidir se o item é ativo permanente (tópico 10).
                  </>,
                  <>
                    As caixas <strong>Ativo permanente</strong> e, só para o administrador, <strong>Despesa recorrente</strong>{" "}
                    (tópico 9). Em <strong>Observações</strong> você escreve o que quiser guardar sobre a compra.
                  </>,
                  <>
                    Confira o <strong>Total da nota</strong> que aparece embaixo e clique em <strong>Lançar compra</strong>.
                  </>,
                ]}
              />

              <P>
                <strong>Caminho B — Pelo WhatsApp (Caixa de conferência).</strong> É o caminho para os recibos e notas que o
                pessoal fotografa e envia no grupo de compras. O gerente exporta a conversa e o administrador faz o resto.
                Siga esta ordem:
              </P>
              <List
                items={[
                  <>
                    <strong>No celular</strong> (não no computador), abra o grupo de notas e toque em ⋮ → Mais → Exportar
                    conversa → <strong>Incluir mídia</strong>. O WhatsApp Web e o WhatsApp do computador exportam só o texto,
                    sem as fotos e sem os PDFs; por isso o celular é obrigatório.
                  </>,
                  <>
                    Envie o arquivo <strong>.zip</strong> que foi gerado para o computador (por e-mail ou Google Drive, por
                    exemplo).
                  </>,
                  <>
                    Vá em <strong>Módulo gerencial → Caixa de conferência de compras → Importar conversa do WhatsApp</strong> e
                    escolha o arquivo. Aguarde: cada nota é lida uma de cada vez e isso leva alguns instantes. Não feche a tela
                    até terminar.
                  </>,
                  <>
                    No <strong>primeiro arquivo</strong> (aquele que traz tudo desde 01/11/2026), marque a caixa{" "}
                    <strong>Primeira importação</strong>. Nesse caso a IA também aponta quais despesas parecem se repetir todo
                    mês (energia, água, internet, salários etc.) e, no fim, você cadastra as recorrentes de uma vez. Nas
                    importações seguintes não marque: os itens recorrentes novos passam a ser cadastrados à mão.
                  </>,
                  <>
                    Cada <strong>foto de nota</strong>, junto com as mensagens escritas pela mesma pessoa logo depois dela
                    (que servem de explicação, como “material de limpeza”), vira um <strong>cartão</strong> na Caixa de
                    conferência.
                  </>,
                  <>
                    Em cada cartão você tem estas opções: <strong>abrir o item</strong> (a foto fica ao lado de um formulário
                    já preenchido pela IA; você corrige o que precisar e clica em Lançar compra); <strong>Salvar</strong>{" "}
                    (lança a nota exatamente como a IA leu, sem abrir); <strong>X</strong> (descarta o que não é compra, como
                    uma conversa solta ou um comprovante repetido); e a caixa <strong>Despesa recorrente</strong> (só o
                    administrador).
                  </>,
                  <>
                    Para os cartões em que a IA classificou como Alimentos mas não achou ingrediente do bar, existe um quadro
                    à parte no topo, <strong>“Confirmar em lote”</strong> (tópico 5).
                  </>,
                ]}
              />
              <P>
                <strong>A IA nunca lança nada sozinha.</strong> Ela só prepara o cartão. Quem lança é você.
              </P>

              <P>
                <strong>Caminho C — Lançamento automático dos itens recorrentes.</strong> As despesas que se repetem todo mês
                são criadas pelo próprio sistema, todo dia de manhã, sem você precisar fazer nada (tópico 9).
              </P>

              <SubHeading>3. O que a IA preenche, e o que ela nunca faz</SubHeading>
              <P>
                A IA preenche, em cada cartão: a data, o fornecedor, o número da nota, a forma de pagamento, o total, os itens
                da nota, a <strong>categoria</strong> de cada item, o <strong>ingrediente</strong> (somente quando o item é
                um dos ingredientes cadastrados em Ingredientes de bar da piscina) e, para bens duráveis, uma estimativa da
                vida útil. Ela <strong>só escolhe categorias que já existem</strong>. Ela <strong>nunca cria categoria nem
                ingrediente novo</strong>. Quando o item não corresponde a nenhum ingrediente, ela apenas escolhe a categoria
                de despesa. A foto e o texto sempre ficam disponíveis para você conferir.
              </P>

              <SubHeading>4. Ingrediente e categoria: o que o campo “Ingrediente” faz</SubHeading>
              <P>
                O campo “Ingrediente” só aparece nas categorias <strong>Alimentos</strong>,{" "}
                <strong>Bebidas quentes</strong> e <strong>Demais bebidas</strong>. Ele serve para marcar que aquele item é
                um insumo de algum petisco ou drink do cardápio do bar. Em Alimentos, marcar o ingrediente muda para onde vai o
                custo (parte para o Bar, parte para o Café). Nas duas categorias de bebidas, o centro de custo é o mesmo com ou
                sem ingrediente; o ingrediente só decide se aquele gasto entra na rentabilidade dos drinks (pergunta 15).
              </P>

              <SubHeading>5. As verificações que evitam lançamento duplicado e erro de categoria</SubHeading>
              <P>
                <strong>Contra lançamento duplicado, o sistema faz duas verificações:</strong>
              </P>
              <List
                items={[
                  <>
                    <strong>Mesma mensagem.</strong> Na importação do WhatsApp, o sistema guarda a identificação de cada
                    mensagem (dia, hora, quem enviou e o nome do arquivo da foto). Se você ler o mesmo arquivo de novo, as
                    mensagens que já entraram são puladas. Isso vale mesmo para as que você já lançou ou descartou.
                  </>,
                  <>
                    <strong>Compra parecida.</strong> Para cada nota, o sistema compara o conteúdo com as compras já lançadas
                    e com as outras notas que estão na Caixa. Ele considera <strong>possível duplicata</strong> quando: (a)
                    o número da nota é o mesmo e o fornecedor é parecido ou o valor é o mesmo; ou (b) o valor total é o mesmo,
                    a data tem no máximo 3 dias de diferença e o fornecedor é parecido (ou está em branco). “Parecido”
                    ignora acentos, maiúsculas e palavras como “Ltda” e “S/A”.
                  </>,
                ]}
              />
              <P>
                Quando acha uma possível duplicata, o sistema mostra um aviso em âmbar, “Possível duplicata”, na lista da Caixa
                e dentro da nota, dizendo qual compra parece igual. Essa nota <strong>sai do “Confirmar em lote” e do botão
                “Salvar” rápido</strong>: ela só é lançada se você abrir o item. Ao clicar em Lançar compra (numa nota da
                Caixa ou no lançamento manual), o sistema abre uma pergunta: “Esta compra parece já estar lançada. Lançar
                mesmo assim?”. O sistema <strong>só avisa</strong>: duas compras iguais de verdade são possíveis (por exemplo,
                duas compras no mesmo dia, no mesmo valor), e você decide. Atenção: o aviso pode não aparecer se a nota não tem
                número, se o nome do fornecedor está muito diferente ou se o valor mudou. Por isso vale conferir o Relatório de
                despesas de vez em quando.
              </P>
              <P>
                <strong>Um caso à parte: a nota que é o comprovante de uma despesa recorrente.</strong> Muitas despesas fixas
                (energia, internet, salários) também chegam como comprovante no grupo do WhatsApp. Se o fornecedor ou a
                descrição de uma nota é parecido com o nome de um <strong>item recorrente</strong>, a Caixa mostra o aviso
                informativo <strong>“Comprovante de item recorrente”</strong>. Isso <strong>não</strong> é duplicata: ao lançar a
                nota, o lançamento automático daquele mês é <strong>substituído</strong> por ela (tópico 9). Esse aviso não
                impede o “Salvar” rápido nem o lote, mas fica visível para você conferir antes.
              </P>
              <P>
                <strong>Contra erro de categoria e de destino do custo:</strong>
              </P>
              <List
                items={[
                  <>
                    Cada item mostra a linha <strong>“Destino do custo”</strong>, que diz para onde o gasto vai. Exemplos:
                    “Café 100%”, “Bar 100%”, “Hospedagem 100%”, “Bar × Frigobar, pelas vendas do mês”.
                  </>,
                  <>
                    Quando a categoria é Alimentos e não há ingrediente, o aviso fica em <strong>âmbar</strong> e diz “confira:
                    se for insumo do bar, escolha o ingrediente”. Sem ingrediente, o gasto vai 100% para o Café da manhã.
                  </>,
                  <>
                    O seletor de ingrediente mostra <strong>só os ingredientes do tipo da categoria</strong>: em Alimentos
                    só aparecem alimentos (cafés inclusive); em Bebidas quentes só bebidas quentes; em Demais bebidas só
                    demais bebidas.
                  </>,
                  <>
                    Na leitura pela IA, o <strong>ingrediente manda na categoria</strong>: se a IA identifica um ingrediente
                    (por exemplo, cachaça) e a categoria que ela escolheu não combina com o tipo dele, o sistema troca a
                    categoria pela correta (Bebidas quentes, no exemplo).
                  </>,
                  <>
                    O botão <strong>“Salvar” rápido</strong> só funciona quando o destino do custo é certo. Se falta a
                    categoria, é preciso abrir o item. Se a categoria é Alimentos e não há ingrediente, o cartão vai para o
                    quadro <strong>“Confirmar em lote”</strong>.
                  </>,
                  <>
                    <strong>Confirmar em lote:</strong> o quadro lista essas notas, com data, fornecedor, total e itens. Você
                    marca as que quiser (ou usa “Selecionar todas”) e clica em <strong>Confirmar selecionadas</strong>. O
                    sistema lança todas como despesa do <strong>Café da manhã (100%)</strong>, sem ingrediente. Se algum item
                    for, na verdade, insumo do bar, abra aquela nota (link “Abrir para conferir ou editar”) e escolha o
                    ingrediente antes de lançar. Notas sem categoria nunca entram no lote.
                  </>,
                  <>
                    <strong>Campos obrigatórios:</strong> cada item precisa de descrição, categoria (exceto ativo permanente),
                    quantidade maior que zero e valor maior que zero.
                  </>,
                  <>
                    Se mesmo assim um lançamento sair errado, o administrador corrige com o botão <strong>Editar</strong> do
                    Relatório de despesas (tópico 7).
                  </>,
                ]}
              />

              <SubHeading>6. O prazo para lançar: o mês fecha, mas há 30 dias de tolerância</SubHeading>
              <P>
                O mês “fecha” no último dia. Mesmo assim, você ainda pode lançar compras daquele mês por mais{" "}
                <strong>30 dias</strong>: elas entram sozinhas, com o selo <strong>“Lançado após o fechamento do mês”</strong>
                no relatório. Depois de 30 dias, a compra fica <strong>pendente de aprovação</strong>, em{" "}
                <strong>vermelho</strong> no relatório, e <strong>não conta no resultado do mês</strong> enquanto o
                administrador não clicar em <strong>Aprovar</strong> (ela passa a contar) ou <strong>Cancelar</strong> (ela é
                descartada). O mesmo prazo vale para <strong>editar</strong> uma despesa. A receita de bar, de frigobar e de
                hospedagem segue a mesma regra (pergunta 14). Esses 30 dias são a regra padrão do sistema.
              </P>

              <SubHeading>7. O Relatório de despesas (regime caixa)</SubHeading>
              <P>
                Fica em <strong>Módulo gerencial → Relatório de despesas</strong>. “Regime caixa” significa que cada compra
                aparece no dia em que foi paga. A tela mostra o <strong>mês</strong> que você escolher (use as setas para
                trocar de mês) e lista <strong>cada compra e despesa, uma por vez, em ordem da data</strong>. Ela serve para
                você <strong>conferir com o extrato do banco</strong> e para auditar o que foi lançado.
              </P>
              <P>Para cada compra, o relatório mostra:</P>
              <List
                items={[
                  <>
                    A <strong>data</strong>, o <strong>fornecedor</strong>, o <strong>número da nota</strong> (se houver) e o{" "}
                    <strong>valor total</strong>.
                  </>,
                  <>
                    Selos: “Lançado após o fechamento do mês”, “WhatsApp” ou “Recorrente” (de onde veio o lançamento), a forma
                    de pagamento, “Cancelado” e, em vermelho, “Mais de 30 dias após o fechamento — aguarda aprovação”.
                  </>,
                  <>
                    Os <strong>itens</strong> da compra, cada um com a categoria, o ingrediente (se houver), o valor e a linha{" "}
                    <strong>“→ destino do custo”</strong>.
                  </>,
                  <>
                    No fim, o <strong>Total do mês</strong>, que <strong>não inclui</strong> compras canceladas nem pendentes.
                    Os itens de <strong>ativo permanente</strong> não aparecem aqui, porque não são despesa do mês.
                  </>,
                ]}
              />
              <P>O administrador tem mais três recursos no relatório:</P>
              <List
                items={[
                  <>
                    <strong>Editar</strong>, em cada compra, até 30 dias depois do fim do mês dela. Dá para alterar a data, o
                    fornecedor, o número da nota, a forma de pagamento e as observações; e, em cada item, a descrição, a
                    categoria, o ingrediente, a quantidade e o valor. O total é recalculado. Se a despesa é recorrente, o item
                    recorrente correspondente (nome, categoria, valor e dia) é atualizado junto. Ao trocar a categoria de um
                    item, escolha o ingrediente de novo.
                  </>,
                  <>
                    <strong>Mover</strong>, em cada item: “Cadastrar como despesa recorrente” (cria o item recorrente; a
                    despesa deste mês <strong>continua</strong> no relatório) ou “Mover para ativo permanente” (o item vira um
                    bem do inventário e <strong>sai</strong> do relatório). O caminho de volta, de ativo permanente para
                    despesa, fica no Inventário de ativo permanente.
                  </>,
                  <>
                    <strong>Aprovar</strong> ou <strong>Cancelar</strong> as compras pendentes em vermelho.
                  </>,
                ]}
              />
              <P>
                O relatório também tem o botão <strong>Lançar compra</strong>. Os itens recorrentes do mês aparecem aqui sozinhos,
                com o selo “Recorrente” (tópico 9). Uma despesa recorrente que foi substituída pela nota real aparece como
                “Cancelado”, com a observação “Substituída pela nota de …”.
              </P>

              <SubHeading>8. Categorias de despesa, prazo de consumo e centros de custo</SubHeading>
              <P>
                As categorias ficam em <strong>Módulo gerencial → Listas gerenciais → Categorias de despesa e centros de
                custo</strong>. Toda compra é classificada em uma categoria, e cada categoria tem duas características: um{" "}
                <strong>prazo de consumo</strong> e uma <strong>regra de divisão entre os centros de custo</strong>.
              </P>
              <P>
                <strong>Prazo de consumo (em dias).</strong> Prazo 1 significa consumo imediato: a compra cai inteira no mês em
                que foi paga. Prazo maior (por exemplo, 30 dias para material de limpeza) significa que a compra é consumida
                aos poucos: o sistema divide o valor igualmente pelos dias, <strong>a partir da data da compra</strong>, e
                distribui entre os meses. Exemplo: uma compra de R$ 300,00 de material de limpeza paga no dia 20 de novembro,
                com prazo de 30 dias, vale R$ 10,00 por dia. De 20 a 30 de novembro são 11 dias, ou seja, R$ 110,00 em
                novembro; os outros R$ 190,00 caem em dezembro.
              </P>
              <P>
                <strong>Centros de custo.</strong> Existem quatro: <strong>Hospedagem, Bar, Café da manhã e Frigobar</strong>.
                O custo de cada compra é dividido entre eles pela regra da categoria. As categorias já cadastradas são estas
                (os valores iniciais podem ser editados por você):
              </P>
              <List
                items={[
                  <>
                    <strong>Alimentos</strong> (prazo de 1 dia para itens sem ingrediente): se o item tem ingrediente, o custo
                    se divide entre Bar e Café conforme o percentual do Bar cadastrado no ingrediente; sem ingrediente, vai
                    100% para o Café. Cada ingrediente de alimento tem o seu próprio prazo de consumo (30 dias quando
                    cadastrado). Você o ajusta na própria tela: clique em “Itens de Alimentos e prazo de consumo de cada um”,
                    dentro do card Alimentos. Os cafés (em pó, em cápsula, expresso) são tratados como alimentos.
                  </>,
                  <>
                    <strong>Bebidas quentes</strong> (prazo de 1 dia): destilados, vinhos e outras bebidas alcoólicas que não
                    são cerveja (cachaça, uísque, vodka, gim, Campari, vinhos…). Vão <strong>100% para o Bar</strong>.
                  </>,
                  <>
                    <strong>Demais bebidas</strong> (prazo de 1 dia): cervejas, águas, refrigerantes e água de coco. O custo se
                    divide entre <strong>Bar e Frigobar</strong> na proporção das quantidades vendidas no mês: as bebidas
                    vendidas nas comandas do bar contra as unidades lançadas no frigobar. Sem nenhuma venda no mês, divide
                    meio a meio.
                  </>,
                  <>
                    <strong>Materiais de limpeza, Amenities, Materiais de piscina, Materiais de lavanderia, Materiais de
                    jardinagem e Materiais de escritório</strong> (prazo de 30 dias): 100% Hospedagem.
                  </>,
                  <>
                    <strong>Despesas de consumo</strong> (luz, água, gás, internet; prazo de 1 dia): 40% Hospedagem, 30% Café
                    da manhã e 30% Bar.
                  </>,
                  <>
                    <strong>Despesas de pessoal administrativo, Despesas de marketing, Despesas de pessoal operacional e
                    Despesas de reforma e manutenção</strong> (prazo de 1 dia): 100% Hospedagem.
                  </>,
                  <>
                    <strong>Impostos</strong> (prazo de 1 dia): <strong>não entram em nenhum centro</strong>. Aparecem só no fim
                    do Resultado mensal, antes do lucro final.
                  </>,
                ]}
              />
              <P>
                Nesta tela você também pode <strong>criar categorias novas</strong> (botão “Nova categoria”, com nome, prazo de
                consumo e o percentual de cada centro, que deve somar 100) e desativar categorias que não usa mais. Nas
                categorias de divisão por percentuais (como Despesas de consumo e Bebidas quentes) você pode mudar o prazo e os
                percentuais. Em <strong>Alimentos</strong> e <strong>Demais bebidas</strong> a regra de divisão é fixa do
                sistema (explicada acima): só o prazo, o nome e a chave de ativa se editam. A mudança vale para os cálculos dali em diante e também quando você olha meses já lançados, porque
                o resultado é sempre recalculado com as regras do momento.
              </P>

              <SubHeading>9. Itens recorrentes</SubHeading>
              <P>
                São as despesas que se repetem todo mês, como salários, honorários, internet e aluguel. Você cadastra uma vez
                e o sistema cria o lançamento sozinho a cada mês, sem precisar digitar.
              </P>
              <P>
                <strong>Onde cadastrar:</strong> <strong>Módulo gerencial → Listas gerenciais → Itens recorrentes</strong>. O
                botão “Novo item” pede: <strong>nome</strong>, <strong>categoria</strong>, <strong>valor</strong> e{" "}
                <strong>dia do mês</strong> (de 1 a 28). Cada item tem uma chave <strong>Ativo</strong> (desligue para parar de
                lançar, sem apagar) e botões de editar, excluir e mover. Há outros três jeitos de cadastrar um item
                recorrente: marcar a caixa “Despesa recorrente” ao lançar uma compra; usar o botão Mover no Relatório de
                despesas; e a sugestão da “Primeira importação” do WhatsApp (tela “Itens recorrentes sugeridos”, onde você
                ajusta nome, categoria, valor e dia e cadastra os marcados de uma vez).
              </P>
              <P>
                <strong>Como o lançamento acontece:</strong> <strong>todo dia de manhã</strong>, junto com a atualização com a
                Stays, o sistema olha cada item recorrente <strong>ativo</strong> e cria a despesa do mês cujo{" "}
                <strong>dia combinado já chegou</strong>, com a data do dia combinado, o valor cadastrado e o selo
                “Recorrente”. Cada item é lançado <strong>uma única vez por mês</strong>. Você não precisa abrir nenhuma tela
                para isso. (A mesma conferência também acontece quando você cadastra um item e quando abre o Relatório de
                despesas, para o lançamento aparecer sem esperar a manhã seguinte.)
              </P>
              <P>
                <strong>Meses que ficaram sem lançamento.</strong> Se algum mês não foi lançado (por exemplo, o item foi
                cadastrado depois do dia combinado, ou o sistema ficou algum tempo fora do ar), o sistema lança os meses que
                faltam, até 12 meses para trás. Ele nunca lança nada antes de 01/11/2026 nem antes do mês em que o item foi
                cadastrado. Um lançamento recuperado de um mês já encerrado há mais de 30 dias fica pendente (em vermelho) no
                relatório até você aprovar ou cancelar.
              </P>
              <P>
                <strong>Como o sistema evita itens e lançamentos em duplicidade.</strong> Ao cadastrar um item recorrente novo
                (em qualquer dos caminhos), o sistema faz duas verificações <strong>automáticas</strong>, sem perguntar o
                que você já sabe:
              </P>
              <List
                items={[
                  <>
                    <strong>Procura um item recorrente parecido</strong> (ativo ou desativado): nome parecido, ou a mesma
                    categoria com o mesmo valor. Se achar, <strong>não cria um segundo item</strong>, porque os dois lançariam
                    a despesa todo mês. Na tela “Itens recorrentes”, ele mostra o item parecido e pergunta se você quer criar
                    mesmo assim (útil para casos legítimos, como dois salários diferentes). Na caixa “Despesa recorrente”, no
                    botão Mover e nas sugestões da primeira importação, ele não cria o segundo item e avisa que já existe.
                    Para mudar um item que já existe, edite-o.
                  </>,
                  <>
                    <strong>Procura um lançamento avulso parecido neste mês</strong> (feito à mão ou por nota do WhatsApp,
                    com fornecedor ou nome parecido e a mesma categoria). Se existir, o item recorrente <strong>começa a
                    valer no mês seguinte</strong>: um lançamento avulso não se repete, então não há duplicidade, e o sistema
                    informa isso na hora. Se não existir, o item já vale neste mês: o lançamento é criado na hora (se o dia
                    combinado já passou) ou no dia combinado.
                  </>,
                ]}
              />
              <P>
                <strong>A nota real prevalece sobre o lançamento automático.</strong> Muitas despesas recorrentes também chegam
                como comprovante no WhatsApp. Para não contar duas vezes, o lançamento automático funciona como um{" "}
                <strong>marcador provisório</strong>. Quando você lança a nota real daquele mês (com fornecedor ou descrição
                parecida com o item), o sistema <strong>cancela o lançamento automático desse mês</strong> e fica a nota, com o
                valor, a data e a foto verdadeiros, <strong>mesmo que o valor seja diferente</strong> (energia e água variam
                todo mês). Se o lançamento automático daquele mês ainda não tinha sido criado, o sistema marca o mês como
                coberto e não o cria depois. Na Caixa de conferência, essas notas ganham o aviso “Comprovante de item
                recorrente”. O valor cadastrado no item <strong>não muda sozinho</strong>: se a conta passou para outro
                patamar, edite o item. Se o sistema reconhecer uma nota errada como comprovante (por nomes parecidos), o
                administrador corrige no relatório.
              </P>
              <P>
                Para <strong>mudar o valor combinado</strong>, edite o item (vale a partir dos próximos lançamentos). Se o
                lançamento do mês já foi criado com o valor errado, use <strong>Editar</strong> na despesa do relatório: ela
                corrige o lançamento e atualiza o item recorrente. Quando um item é cadastrado a partir de uma compra que você
                já lançou, o mês dessa compra já está coberto e o sistema só passa a lançar a partir do mês seguinte.
              </P>

              <SubHeading>10. Ativo permanente</SubHeading>
              <P>
                Ativo permanente é um bem durável, como uma geladeira ou uma televisão. Ele <strong>não é despesa do
                mês</strong>: o dinheiro gasto não entra no Resultado mensal, porque o bem continua existindo e sendo usado.
                O sistema <strong>não calcula depreciação</strong>.
              </P>
              <P>
                <strong>O critério.</strong> Um item é ativo permanente quando as duas condições abaixo são verdadeiras ao
                mesmo tempo:
              </P>
              <List
                items={[
                  <>
                    o <strong>valor de cada unidade</strong> (o valor da linha dividido pela quantidade) é{" "}
                    <strong>igual ou maior que R$ 1.200,00</strong>; e
                  </>,
                  <>
                    a <strong>vida útil</strong> é <strong>maior que 12 meses</strong>.
                  </>,
                ]}
              />
              <P>
                Os dois números (R$ 1.200,00 e 12 meses) podem ser alterados em <strong>Listas gerenciais → Categorias de
                despesa e centros de custo</strong>, no card <strong>“Ativo permanente”</strong> (campos “Valor mínimo do
                item” e “Vida útil mínima”, e o botão “Salvar parâmetros”).
              </P>
              <P>
                <strong>Como o item é marcado.</strong> Ao preencher o valor, a quantidade e a vida útil de um item, o sistema
                marca sozinho a caixa “Ativo permanente” se o critério for atendido. A IA estima a vida útil dos bens
                duráveis que lê na nota. Você pode marcar ou desmarcar a caixa à mão, e o botão <strong>Mover</strong> do
                Relatório de despesas também faz essa mudança depois do lançamento.
              </P>
              <P>
                <strong>O que acontece.</strong> O item não entra como despesa e some do Relatório de despesas. O sistema
                cria o bem no <strong>Inventário de ativo permanente</strong> (<strong>Módulo gerencial → Inventário de ativo
                permanente</strong>), com o nome, a data e o valor da compra. O inventário mostra os bens agrupados por
                categoria, com marca e modelo, local, data da compra, valor, garantia e fornecedor (quando essas informações
                existem), e o valor total. Cada bem tem um botão <strong>Mover</strong> que o devolve para despesa (você
                escolhe a categoria da despesa; o sistema só aceita isso para compras a partir de 01/11/2026).
              </P>
              <P>
                <strong>Categorias e tipos de bens.</strong> Ficam em <strong>Listas gerenciais → Plano de itens de ativo
                permanente</strong>: você organiza as categorias (por exemplo, “Máquinas”) e, dentro de cada uma, os tipos de
                bem (por exemplo, “Liquidificador”). Um bem novo, quando criado a partir de uma compra, entra na primeira
                categoria da lista.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 14. Resultado mensal */}
        <AccordionItem value="resultado-mensal">
          <AccordionTrigger>
            <span className="font-heading text-base">14. Como é calculado o Resultado mensal?</span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                O <strong>Resultado mensal</strong> (<strong>Módulo gerencial → Resultado mensal</strong>, para o
                administrador e, só para consulta, para o gerente operacional) mostra, mês a mês, quanto a pousada ganhou e quanto gastou, separado por{" "}
                <strong>centro de custo</strong>, e termina com o <strong>lucro operacional gerencial</strong> do mês. Use as
                setas no alto para trocar de mês. O resultado é calculado na hora, sempre que você abre a tela, a partir das
                compras lançadas, das contas de bar e frigobar e dos dados da Stays. Nada precisa ser “fechado” à mão.
              </P>
              <P>
                No alto da tela, uma linha de status diz em que fase está o mês: <strong>“Mês em andamento — resultado
                parcial”</strong> (o mês ainda não acabou), <strong>“Mês fechado”</strong> (acabou, mas ainda aceita
                lançamentos tardios por 30 dias) ou <strong>“Mês consolidado”</strong> (a tolerância de 30 dias terminou). Ela
                também informa quantas despesas foram lançadas depois do fechamento.
              </P>

              <SubHeading>1. O bloco “Receitas”</SubHeading>
              <List
                items={[
                  <>
                    <strong>Hospedagem bruta:</strong> a soma do valor das diárias vendidas no mês, vindo da Stays (é a mesma
                    base da tela Indicadores). Entram reservas confirmadas, pré-reservas e contratos; reservas canceladas não
                    entram; diárias gratuitas valem zero; taxas e impostos da reserva ficam de fora. Cada diária pertence ao
                    dia em que começa, então uma reserva que atravessa a virada do mês dá a cada mês a sua parte.
                  </>,
                  <>
                    <strong>(−) Comissão dos canais de venda:</strong> o que os canais cobram da pousada. Para Booking, Airbnb
                    e Decolar, é o valor em reais que a própria Stays informa em cada reserva. Para a Expedia, é o percentual
                    cadastrado na tela Indicadores, aplicado sobre a receita dela. Reservas diretas não têm comissão.
                  </>,
                  <>
                    <strong>Hospedagem líquida:</strong> a hospedagem bruta menos a comissão dos canais. É esse valor que
                    conta como receita do centro Hospedagem.
                  </>,
                  <>
                    <strong>Bar — consumo:</strong> a soma de (quantidade × preço no momento do pedido) de todas as comandas
                    do bar da piscina <strong>lançadas no mês</strong>, sem as comandas canceladas. A data que vale é a data
                    em que a comanda foi lançada, não a do pagamento.
                  </>,
                  <>
                    <strong>Bar — taxa de serviço:</strong> 10% sobre o consumo do bar, salvo nas contas em que a camareira
                    isentou a taxa (nessas, é zero).
                  </>,
                  <>
                    <strong>Frigobar:</strong> a soma de (quantidade × preço) de tudo o que foi lançado no frigobar{" "}
                    <strong>naquele mês</strong>.
                  </>,
                  <>
                    <strong>Total das receitas:</strong> hospedagem líquida + bar (consumo e taxa) + frigobar.
                  </>,
                ]}
              />
              <P>
                <strong>Regra importante sobre bar e frigobar:</strong> só contam as contas já <strong>fechadas ou
                pagas</strong>. Uma conta ainda aberta ou reaberta não entra enquanto não for fechada. O que está nessa
                situação aparece numa frase abaixo das receitas: “Contas ainda abertas, a fechar (não contam enquanto não
                fecharem): bar R$ … · frigobar R$ …”. Se uma conta só for fechada <strong>depois de 30 dias do fim do
                mês</strong>, a receita dela fica num quadro vermelho no alto, <strong>“Aguardando aprovação do
                admin”</strong>, e só entra no resultado se você clicar em <strong>Aprovar</strong> (clicando em Cancelar,
                ela é descartada). Com a hospedagem é parecido: passados os 30 dias, o valor do mês fica “congelado”; se a
                Stays corrigir esse mês depois (por exemplo, uma reserva alterada), a diferença aparece no quadro vermelho com
                o botão <strong>Aceitar correção</strong>.
              </P>

              <SubHeading>2. Um bloco para cada centro de custo</SubHeading>
              <P>
                Em seguida vêm quatro blocos: <strong>Hospedagem, Bar, Café da manhã e Frigobar</strong>. Cada um mostra:
              </P>
              <List
                items={[
                  <>
                    <strong>Receita:</strong> Hospedagem = a hospedagem líquida; Bar = consumo mais taxa de serviço;
                    Frigobar = o total do frigobar; <strong>Café da manhã = zero</strong>, porque o café é oferecido junto
                    com a diária e não tem venda própria.
                  </>,
                  <>
                    Uma linha <strong>“(−) nome da categoria”</strong> para cada categoria de despesa que teve gasto nesse
                    centro no mês, já com a parte que cabe a ele.
                  </>,
                  <>
                    <strong>Total das despesas</strong> do centro e <strong>Resultado do centro</strong> (receita menos
                    despesas). O resultado do Café da manhã sai <strong>negativo</strong> e isso é normal: ele mostra quanto o
                    café custou no mês.
                  </>,
                ]}
              />
              <P>
                <strong>De onde vêm as despesas de cada centro.</strong> O sistema pega cada compra do mês e faz três passos:
                (1) <strong>descobre quanto da compra pertence a este mês</strong>, pelo prazo de consumo da categoria
                (uma compra com prazo de 30 dias é dividida por dia entre os meses; veja o tópico 8 da pergunta 13); (2){" "}
                <strong>divide esse valor entre os centros</strong>, pela regra da categoria (por exemplo, Despesas de
                consumo: 40% Hospedagem, 30% Café, 30% Bar; Alimentos com ingrediente: conforme o percentual do Bar do
                ingrediente); (3) <strong>soma</strong> tudo por categoria e centro. Exemplo: R$ 1.000,00 de energia
                elétrica pagos no mês viram R$ 400,00 de despesa da Hospedagem, R$ 300,00 do Café da manhã e R$ 300,00 do
                Bar.
              </P>
              <P>
                O custo das categorias “Demais bebidas” se divide entre Bar e Frigobar na proporção das quantidades vendidas
                no mês. Essa proporção aparece, em porcentagem do Bar, na nota no pé da tela (“Demais bebidas foram divididas
                entre Bar e Frigobar na proporção das quantidades do mês (Bar X%)”).
              </P>

              <SubHeading>3. O bloco “Resultado total”</SubHeading>
              <List
                items={[
                  <>
                    <strong>Receitas:</strong> o total das receitas.
                  </>,
                  <>
                    <strong>(−) Despesas dos centros:</strong> a soma das despesas dos quatro centros.
                  </>,
                  <>
                    <strong>Resultado antes dos impostos:</strong> receitas menos despesas dos centros.
                  </>,
                  <>
                    <strong>(−) Impostos:</strong> tudo o que foi lançado na categoria Impostos, que não pertence a nenhum
                    centro.
                  </>,
                  <>
                    <strong>Lucro operacional gerencial do mês:</strong> o resultado antes dos impostos menos os impostos.
                    É o número final do mês.
                  </>,
                ]}
              />

              <SubHeading>4. O que não entra no resultado</SubHeading>
              <List
                items={[
                  <>Itens de <strong>ativo permanente</strong> e qualquer <strong>depreciação</strong>.</>,
                  <>Controle de <strong>estoque</strong> (não existe).</>,
                  <>Compras <strong>canceladas</strong> e compras <strong>pendentes de aprovação</strong>.</>,
                  <>Compras com data <strong>anterior a 01/11/2026</strong>.</>,
                  <>Contas de bar e frigobar ainda <strong>não fechadas</strong>.</>,
                ]}
              />

              <SubHeading>5. Como conferir um número</SubHeading>
              <P>
                Para conferir as despesas, abra o <strong>Relatório de despesas</strong> do mesmo mês: cada compra mostra o
                destino do custo. Para conferir a hospedagem, compare com a tela <strong>Indicadores</strong>. Para conferir
                o bar e o frigobar, veja “Consumo de Bar e Frigobar”. Os itens recorrentes do mês entram sozinhos, no dia
                combinado, e aparecem no Relatório de despesas.
              </P>
            </div>
          </AccordionPanel>
        </AccordionItem>

        {/* 15. Rentabilidade de Petiscos e Drinks */}
        <AccordionItem value="rentabilidade">
          <AccordionTrigger>
            <span className="font-heading text-base">15. Como é calculada a Rentabilidade de Petiscos e Drinks?</span>
          </AccordionTrigger>
          <AccordionPanel>
            <div className="space-y-3">
              <P>
                A tela <strong>Rentabilidade de Petiscos e Drinks</strong> (<strong>Módulo gerencial → Rentabilidade de
                Petiscos e Drinks</strong>, só para o administrador) responde a uma pergunta: <strong>quanto cada petisco e
                cada drink do cardápio custou no mês, e quanto sobrou da venda dele?</strong> Use as setas no alto para
                trocar de mês. É uma <strong>estimativa</strong>, e ela só considera os <strong>ingredientes</strong>.
              </P>

              <SubHeading>1. As três peças que alimentam o cálculo</SubHeading>
              <P>
                <strong>Peça 1 — O Cardápio de bar da piscina</strong> (<strong>Módulo operacional → Listas operacionais →
                Cardápio de bar da piscina</strong>). É a lista de tudo o que o bar vende, com o preço. Cada item tem uma
                categoria, e só há três opções: <strong>Petiscos</strong>, <strong>Drinks</strong> e{" "}
                <strong>Outras bebidas</strong>. Os Drinks atuais são as caipirinhas, caipiroskas e caipifrutas, o gin
                tônica, o Campari e a taxa de rolha; as demais bebidas (cervejas, águas, refrigerantes, sucos…) são Outras
                bebidas. <strong>Só Petiscos e Drinks aparecem na Rentabilidade.</strong> Os itens de Outras bebidas não têm
                custo nem margem acompanhados aqui. O custo deles continua entrando normalmente no Resultado mensal, no centro
                de custo que corresponde a eles. Ao cadastrar um item novo, você escolhe a categoria, escreve o nome, define o
                preço e, para Petiscos e Drinks, preenche a ficha técnica.
              </P>
              <P>
                <strong>Peça 2 — Os Ingredientes de bar da piscina</strong> (<strong>Listas operacionais → Ingredientes de
                bar da piscina</strong>, logo abaixo do Cardápio). É a lista de todos os insumos usados nas receitas. O nome
                traz a unidade de medida, por exemplo “Cachaça (ml)”, “Farinha de trigo (g)” ou “Limão (un)”. Para cada
                ingrediente você informa:
              </P>
              <List
                items={[
                  <>
                    O <strong>Tipo</strong>: Alimento (cafés inclusive), Bebida quente (destilados, vinhos…) ou Demais bebidas
                    (cervejas, águas, refrigerantes).
                  </>,
                  <>
                    Para os <strong>alimentos</strong>: como o gasto se divide e o prazo de consumo. A divisão pode ser{" "}
                    <strong>Bar × Café da manhã</strong> (você informa o percentual que vai para o Bar; o resto vai para o
                    Café) ou <strong>Bar × Frigobar pelas vendas do mês</strong> (usada no café, que também é vendido no
                    frigobar). O <strong>prazo de consumo</strong> (em dias) começa em 30 e pode ser ajustado.
                  </>,
                  <>
                    Para as <strong>bebidas</strong>: nada além do tipo, porque elas seguem o prazo e a divisão da categoria
                    de despesa (Bebidas quentes ou Demais bebidas).
                  </>,
                ]}
              />
              <P>
                Os ingredientes são cadastrados <strong>antes</strong> de criar o petisco ou drink que os usa. O sistema
                nunca cria ingrediente sozinho.
              </P>
              <P>
                <strong>Peça 3 — A ficha técnica</strong> (botão <strong>“Ficha técnica”</strong> em cada item do Cardápio). É
                a receita do item: quais ingredientes entram e <strong>quanto de cada um vai em uma unidade vendida</strong>
                (por exemplo, um pastel de queijo leva 90 g de farinha de trigo e 120 g de queijo muçarela). Regras: use{" "}
                <strong>a mesma medida do ingrediente em todos os produtos</strong> (se o ingrediente é em gramas, escreva
                sempre em gramas); <strong>Petiscos e Drinks só são cadastrados com a ficha técnica</strong> (pelo menos um
                ingrediente) e a ficha nunca pode ficar vazia; para Outras bebidas a ficha é opcional. Na lista do Cardápio, o
                item sem ficha aparece com o aviso “Sem ficha técnica”.
              </P>

              <SubHeading>2. Como a compra entra no cálculo</SubHeading>
              <P>
                Ao lançar uma compra (pergunta 13), a linha que é um insumo do cardápio é ligada a um{" "}
                <strong>ingrediente</strong>. <strong>Só as compras ligadas a um ingrediente entram na Rentabilidade.</strong>{" "}
                Uma compra sem ingrediente (por exemplo, gás ou papel) entra no Resultado mensal, mas não aqui. A{" "}
                <strong>quantidade comprada não é usada</strong> em nenhuma conta; vale o <strong>valor em reais</strong>.
              </P>

              <SubHeading>3. O cálculo, passo a passo</SubHeading>
              <List
                items={[
                  <>
                    <strong>Passo 1 — Vendas do mês.</strong> Para cada produto, o sistema soma as unidades vendidas e a
                    receita (unidades × preço na hora do pedido), nas comandas lançadas no mês, sem as canceladas.
                  </>,
                  <>
                    <strong>Passo 2 — Custo do mês de cada ingrediente.</strong> O sistema pega as compras ligadas ao
                    ingrediente e <strong>distribui o valor pelo prazo de consumo</strong> (alimentos: o prazo do próprio
                    ingrediente; bebidas: o prazo da categoria). Do valor que cabe ao mês, fica só a <strong>parte do
                    Bar</strong>: nos alimentos, o percentual do Bar cadastrado no ingrediente (ou a proporção Bar × Frigobar
                    das vendas, no caso do café); nas Bebidas quentes, 100%; nas Demais bebidas, a proporção Bar × Frigobar
                    das vendas do mês.
                  </>,
                  <>
                    <strong>Passo 3 — Divisão entre os produtos.</strong> O custo do ingrediente é repartido entre os
                    produtos que o usam, <strong>proporcionalmente ao “peso” de cada um</strong>: o peso é as{" "}
                    <strong>unidades vendidas × a quantidade do ingrediente na ficha técnica</strong>.
                  </>,
                  <>
                    <strong>Passo 4 — Os números da tela.</strong> O sistema soma o que cada produto recebeu de todos os
                    ingredientes (isso é o <strong>Custo estimado</strong>), divide pelas unidades vendidas (o{" "}
                    <strong>Custo médio por unidade</strong>), subtrai da receita (o <strong>Resultado</strong>) e divide o
                    resultado pela receita (a <strong>Margem</strong>, em porcentagem).
                  </>,
                ]}
              />
              <P>
                <strong>Exemplo.</strong> Em um mês, a parte do Bar da farinha de trigo foi R$ 50,00. Os produtos que usam
                farinha venderam: Pastel de Queijo, 10 unidades (90 g cada, peso 900); Pastel de Camarão, 5 unidades (90 g,
                peso 450); Filé de Camarão com Macaxeira, 5 unidades (30 g, peso 150). O peso total é 1.500. Então o Pastel de
                Queijo recebe R$ 30,00, o Pastel de Camarão R$ 15,00 e o Filé de Camarão R$ 5,00 do custo da farinha. O
                mesmo é feito com cada ingrediente, e os resultados de cada produto são somados.
              </P>

              <SubHeading>4. O que a tela mostra</SubHeading>
              <P>
                Uma tabela com uma linha por produto: <strong>Produto</strong>, <strong>Vendidos</strong>,{" "}
                <strong>Receita</strong>, <strong>Custo estimado</strong>, <strong>Custo médio / un.</strong>,{" "}
                <strong>Resultado</strong> e <strong>Margem</strong>. Produtos sem ficha técnica trazem o aviso “sem ficha
                técnica”. Embaixo aparece o custo total de ingredientes do Bar no mês. Se algum valor ficou{" "}
                <strong>sem produto</strong> para receber (ingrediente comprado, mas que nenhum produto vendido no mês usa na
                ficha), a tela informa o valor “não atribuído a nenhum produto”.
              </P>

              <SubHeading>5. Os limites da estimativa</SubHeading>
              <List
                items={[
                  <>
                    O custo é <strong>o que foi gasto no mês dividido entre os produtos vendidos</strong>, e não o custo
                    exato de cada porção. Comprar muito de um ingrediente num mês e vender pouco faz o custo médio daquele mês
                    subir.
                  </>,
                  <>
                    Só entram <strong>ingredientes</strong>. Gás, gelo, mão de obra e outras despesas do bar não fazem parte
                    do custo mostrado aqui (elas aparecem no Resultado mensal).
                  </>,
                  <>
                    Sobras e perdas não são consideradas.
                  </>,
                  <>
                    A tela usa a <strong>ficha técnica atual</strong> para qualquer mês que você consultar. Se você mudar uma
                    receita, os meses antigos também passam a ser calculados com a receita nova.
                  </>,
                ]}
              />

              <SubHeading>6. Quando algo parece errado</SubHeading>
              <List
                items={[
                  <>
                    <strong>Um produto aparece sem custo:</strong> confira se ele tem ficha técnica e se as compras dos
                    ingredientes dele foram lançadas <strong>ligadas ao ingrediente</strong>.
                  </>,
                  <>
                    <strong>Uma compra de insumo foi lançada sem o ingrediente:</strong> o administrador abre o Relatório de
                    despesas, clica em <strong>Editar</strong> (até 30 dias depois do fim do mês) e escolhe o ingrediente.
                  </>,
                  <>
                    <strong>Item novo no cardápio:</strong> faça, nesta ordem: (1) cadastre os ingredientes novos em
                    Ingredientes de bar da piscina; (2) crie o item no Cardápio de bar da piscina, preenchendo a ficha técnica;
                    (3) ao lançar as próximas compras, ligue cada insumo ao ingrediente.
                  </>,
                  <>
                    <strong>O Resultado mensal não muda por causa disto:</strong> os custos de todas as compras continuam
                    entrando nele, de acordo com os centros de custo. A Rentabilidade apenas olha mais de perto os petiscos e
                    drinks.
                  </>,
                ]}
              />
            </div>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem value="indicadores">
          <AccordionTrigger>
            <span className="text-left">16. Como são calculados os indicadores (ADR, RevPAR, NetRevPAR e ocupação)?</span>
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
