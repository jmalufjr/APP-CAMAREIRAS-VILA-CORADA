# PRD — Regras de Negócio (Integração com a API da Stays)

> Regras de negócio para a próxima fase do projeto: consumo de dados de
> reserva vindos da API da Stays e sua interação com a edição manual do
> admin nas telas já existentes do app. Texto original do proprietário,
> organizado em markdown.

## 1. Regra de preferência entre edição do admin e sincronização com a Stays

Todas as funcionalidades do app que passarão a receber dados da Stays
continuam **editáveis pelo admin**, exatamente como hoje.

**Regra de preferência**: toda vez que o admin editar algum campo
sincronizado, esse campo **deixa de ser sincronizado com a Stays até o dia
a que ele se refere**, voltando a sincronizar no dia seguinte a esse dia.

- Exemplo: se o admin editar hoje (ou amanhã) alguma mesa do café da manhã
  referente ao café **de amanhã**, essa edição tem preferência sobre a
  sincronização até amanhã, para aquele dia específico. Os dados do café
  da manhã do dia seguinte a amanhã (ou seja, depois de amanhã) continuam
  sincronizando normalmente.

**Aba padrão (Hoje/Amanhã)**: nas telas do admin que têm os menus "Hoje" e
"Amanhã" (Planejamento Diário, Chegadas & Saídas, Mesas do Café), o padrão
de visualização é sempre a aba **"Hoje"**, sem exceção — mesmo depois de
navegar pra "Amanhã" e sair da tela, ao voltar ela mostra "Hoje" de novo
*(revisado em 17/09/2026 — antes a tela de Mesas do Café tinha "Amanhã"
como padrão; decisão revertida a pedido do proprietário)*.

**Sincronização automática e forçada** *(implementado em 16/09/2026 — ver
CLAUDE.md Parte 14)*: além da sincronização automática por cron (que
sempre respeita a regra de preferência acima), cada uma das três telas
(Planejamento Diário, Chegadas & Saídas, Mesas do Café) tem um botão
"Forçar sincronização com a Stays" — uma sincronização manual que
**ignora** a regra de preferência e sobrescreve qualquer edição do admin
com os dados atuais da Stays. Esse botão nunca sobrescreve, porém, um
serviço do Planejamento Diário já reivindicado, em andamento, concluído ou
cancelado por uma camareira — isso é trabalho em curso, não uma
preferência de edição do admin, e nunca é descartado.

**Exclusão explícita sem linha viva** *(implementado em 16/09/2026 — ver
CLAUDE.md Parte 15)*: a regra de preferência também vale quando o admin
apaga uma linha de propósito, mesmo sem sobrar nada pra marcar como
travado — por exemplo, ao escolher "Sem trabalho" pra uma suíte no
Planejamento Diário, ou ao remover uma suíte de uma mesa (seção 4) sem
realocá-la em outra. Nesses dois casos, o sistema grava um registro à
parte ("suíte X excluída de propósito no dia Y") que impede a
sincronização automática ou manual não forçada de recriar essa tarefa/
realocar essa suíte — a sincronização forçada continua sendo a única
forma de reverter essa exclusão sem desfazê-la manualmente primeiro.

## 2. Planejamento Diário

Regras para definir qual dos cinco tipos de trabalho se aplica a cada
suíte no dia.

### Arrumação e Troca

Aplicam-se quando **não há check-out nem check-in** naquela suíte naquele
dia — ou seja, o hóspede vai permanecer pelo menos mais uma noite. Nesse
caso, a decisão entre Arrumação ou Troca depende da quantidade de noites
total da reserva.

**Regra geral**: a troca só ocorre a partir do dia seguinte à **3ª noite**
de estadia (troca de roupa de cama e de banho a cada 3 noites).

**Regras específicas por duração da reserva**:

| Noites de reserva | Trocas | Quando ocorrem |
|---|---|---|
| 4 noites | 1 troca | Após a 2ª noite |
| 5 ou 6 noites | 1 troca | Após a 3ª noite (regra geral) |
| 7 noites | 2 trocas | Após a 3ª noite; e após a 5ª noite (divide ao meio as 4 noites restantes após a 1ª troca) |
| 8 ou 9 noites | 2 trocas | Após a 3ª noite; e após a 6ª noite |
| 10 noites | 3 trocas | Após a 3ª noite; após a 6ª noite; e após a 8ª noite (em vez da 9ª — divide ao meio as 4 noites restantes após a 2ª troca) |
| ... | ... | E assim por diante, seguindo a mesma lógica |

**Princípio por trás da regra**: minimizar o custo de lavagem e reposição
de roupa de cama/banho e o impacto ambiental (consumo de água, energia e
produtos de limpeza), mantendo a troca de base a cada 3 noites — mas,
quando sobra um período menor que 3 noites no fim da reserva, esse período
restante é dividido ao meio entre as trocas anteriores, para maximizar o
conforto do hóspede sem comprometer o princípio de economia por trás da
regra geral.

### Saída com Chegada, Somente Saída e Somente Chegada

O nome já indica a regra: o tipo de trabalho depende de haver check-out
e/ou check-in naquela suíte específica naquele dia específico.

- **Saída com Chegada**: há check-out e check-in no mesmo dia, na mesma
  suíte.
- **Somente Saída**: há check-out, sem check-in no mesmo dia.
- **Somente Chegada**: há check-in, sem check-out no mesmo dia.

## 3. Chegadas & Saídas

Aba padrão: **"Hoje"** (segue a regra geral do item 1).

### Chegadas

Para cada suíte com chegada no dia, a tela informa:

- Nome completo do hóspede
- Quantidade de noites da reserva (campo novo)
- Quantidade de hóspedes na suíte (campo novo)

Todos esses campos são editáveis pelo admin e se submetem à **regra de
preferência** do item 1.

**Exceção**: os campos **"Horário previsto"** e **"Observações"** não
recebem dados da API — são campos de edição exclusiva do admin, e **não**
se submetem à regra de preferência (editá-los não afeta a sincronização
dos demais campos).

### Saídas

O único campo impactado pela sincronização (e por sua regra de
preferência) é a **suíte**.

**Exceção**: o campo **"Observações"** é de edição exclusiva do admin e
não se submete à regra de preferência nem compromete a sincronização dos
demais campos.

*(Implementado em 16/09/2026 — botão "Sincronizar com a Stays" na tela
"Chegadas & saídas" do admin. O nome do hóspede não vem no payload da
reserva; é buscado à parte via `GET /external/v1/booking/clients/{id}`,
usando o `_idclient` da reserva — ver CLAUDE.md Parte 13.)*

## 4. Mesas do Café

- Os campos **"Valor da comissão"** e **"Observações do dia"** são de
  edição exclusiva do admin, sem se submeter à regra de preferência nem
  comprometer a sincronização dos demais campos.
- Os demais campos são sincronizados e continuam editáveis pelo admin,
  se submetendo à regra de preferência do item 1.

### "Total de mesas" e os campos novos depois dele

- **Total de mesas** (quantas mesas devem ser postas para o café da manhã)
- Mesas de 1 hóspede
- Mesas de 2 hóspedes
- Mesas de 3 hóspedes
- Hóspedes na Mesa 07

O campo **"Observação"** de cada card de mesa é de edição exclusiva do
admin, sem comprometer a sincronização dos demais campos.

*(Implementado em 16-17/09/2026 — ver CLAUDE.md Partes 14, 16 e 17. Esses
cinco campos aparecem, nessa ordem, logo acima de "Observação do dia",
tanto na tela do admin quanto na da camareira — **somente leitura nas
duas**, ao contrário do que essa seção previa originalmente para os
quatro últimos, e ao contrário do que "Total de mesas" sempre foi (um
seletor manual, até 17/09/2026). Decisão revista: nenhum desses cinco
campos é sincronizado/editável com trava própria — todos são sempre
**calculados na hora**, direto da alocação suíte↔mesa que já existe
(seção 5): "Total de mesas" é a quantidade de mesas com pelo menos 1
hóspede alocado (mesas ocupadas), e os outros quatro detalham essa mesma
alocação por tamanho de mesa. Nenhum tem valor próprio salvo, nenhum pode
ficar desatualizado em relação às suítes realmente alocadas, e nenhum
precisa de regra de preferência: mudar a alocação de uma suíte já muda
esses números automaticamente, sem precisar sincronizar nada.)*

### Regra de preenchimento das mesas (distribuição por suíte)

**Regra geral**: preencher sempre a partir das mesas mais próximas da
vista do mar. A vista do mar fica na parte inferior do layout, ou seja,
nas Mesas 5 e 9.

**Ordem de preenchimento**:

1. Mesa 5 e Mesa 9 (entre as duas, a **Mesa 5 primeiro** — lado esquerdo
   tem preferência sobre o lado direito).
2. Pula-se as Mesas 8 e 4.
3. Mesa 3.
4. Mesa 1.
5. Se ainda houver necessidade de mais mesas, retorna-se para as Mesas 8 e
   4 (entre as duas, a **Mesa 4 primeiro**).
6. Mesa 2 e Mesa 6.
7. Mesa 7 (sempre a última a ser preenchida).

O preenchimento alterna as mesas no sentido vertical do layout (ex.: ao
preencher 5 e 9, pulam-se as mesas logo "atrás" delas — 8 e 4 — antes de
seguir para as mesas mais distantes da vista do mar).

**Regras de capacidade e exceções**:

- **Mesa 1**: capacidade máxima de **3 hóspedes**. Tem preferência de
  preenchimento quando a suíte tem exatamente 3 hóspedes.
- **Mesa 7**: capacidade máxima de **8 hóspedes**. É preenchida depois da
  Mesa 1 no caso de suítes de 3 hóspedes (ou seja, se houver mais de uma
  suíte com 3 hóspedes, a primeira vai pra Mesa 1 e a próxima pra Mesa 7)
  — ou, alternativamente, quando todas as demais regras já tiverem sido
  aplicadas e ainda sobrar mais de uma suíte para alocar, essas suítes
  vão para a Mesa 7.
- **Demais mesas** (2, 3, 4, 5, 6, 8, 9): usadas para suítes de 1 ou 2
  hóspedes, respeitando a capacidade máxima de cada uma.

## 5. Exibição visual no layout de mesas

*(Implementado em 16/09/2026, já disponível tanto na tela do admin quanto
na tela da camareira — ver CLAUDE.md Parte 12 para os detalhes técnicos.)*

- No layout de mesas (`TableLayoutCanvas`, usado nas duas telas), cada mesa
  passa a mostrar, além do nome da mesa: o nome de cada suíte alocada
  ali ("Suíte N") seguido, logo abaixo, da quantidade de hóspedes
  correspondente ("2 hóspedes", "1 hóspede" etc.). A Mesa 7 pode mostrar
  mais de um par suíte/quantidade, empilhados, já que pode receber mais de
  uma suíte (ver seção 4 acima).
- Mesas com ocupação (pelo menos 1 hóspede) ficam na cor de **destaque**
  do tema em uso — facilita identificar de relance quais mesas já têm
  suíte(s) alocada(s) — em contraste com as mesas vagas, discretas. A
  combinação exata de cores muda por tema, ver CLAUDE.md Parte 20
  *(decisão invertida em 17/09/2026 — originalmente a mesa ocupada é que
  ficava na tonalidade mais clara/discreta, e a vaga na cor de destaque;
  o proprietário pediu pra inverter, considerando mais fácil de ler)*.
- **Como a alocação suíte↔mesa é registrada**: pelo botão "Forçar
  sincronização com a Stays" (ou pela sincronização automática por cron)
  na tela "Mesas do café" (admin), que aplica a regra de preenchimento
  automático desta seção — implementado em 16/09/2026, ver CLAUDE.md
  Parte 13 (sincronização) e Parte 14 (cron + sincronização forçada) —,
  **ou** manualmente pelo admin no mesmo lugar (cada card de mesa tem um
  seletor pra escolher a suíte e sua quantidade de hóspedes, com botão de
  remover). Reatribuir manualmente marca a suíte como travada para aquele
  dia (mesma regra de preferência da seção 1): a sincronização automática
  ou não forçada deixa de mexer nela até o dia seguinte.
- **Remover uma suíte de uma mesa (botão "×", sem escolher outra mesa)
  também obedece à regra de preferência** (implementado em 16/09/2026 —
  ver CLAUDE.md Parte 15): mesmo sem sobrar nenhuma linha de alocação pra
  carregar uma trava, o sistema grava um registro específico ("suíte X
  excluída de propósito no dia Y") que impede a sincronização automática
  ou manual não forçada de realocar essa suíte em qualquer mesa naquele
  dia — só a sincronização **forçada** ignora essa exclusão de propósito
  (mesmo comportamento do `stays_locked`).
