# PRD — Comandas de Bar da Piscina

> Alteração para que o controle do serviço de bar da piscina seja realizado
> com base em comandas.

Vamos fazer alterações mais profundas nas telas que controlam o consumo do
serviço de bar da piscina, de modo que passaremos a contabilizar o consumo
através de comandas de consumo, ou seja, as camareiras passam a ter uma
tela em que registram o pedido de um determinado quarto, por meio de uma
comanda. Este pedido, ao ser registrado, será visualizado pela camareira
numa lista de comandas e também numa tela de resumo de consumo por quarto.
O admin também irá visualizar a lista de comandas e o resumo de consumo
por quarto. O processo de fechamento de conta e registro de pagamento não
será mais feito pelo admin, mas pelas camareiras. Por fim, para cada ação
realizada pelas camareiras, no que toca ao controle de consumo do serviço
de bar da piscina, deverá ficar registrado qual foi a camareira que
realizou determinada ação, já que ela fez login para entrar no sistema e a
partir daí tem acesso às telas e às ações possíveis.

## 1) Tela das camareiras "Comanda"

Somente para as camareiras, cujo acesso se dá por uma aba colocada no final
do menu principal das camareiras. A tela se divide em duas partes:

1. No topo, uma opção de retorno para a tela anterior e um botão **"Novo
   pedido"**, que, se acionado, abrirá uma nova tela contendo, inicialmente,
   uma opção de retorno para a página anterior e, em seguida, um card para
   cada item de consumo, separados nos dois blocos de Petiscos e Bebidas.
   Cada card contém apenas o nome do item com descrição e, abaixo, uma
   caixa seletora de quantidade (não deixaremos a camareira inserir
   números — a caixa deve ser de seleção de números). No final dessa tela
   haverá um botão de **"Enviar pedido"** junto com uma caixa em que
   selecionará o quarto — informação sem a qual o pedido não será
   enviado —, devendo ficar registrado qual foi a camareira que enviou
   aquele pedido. Ao enviar o pedido, retorna-se à tela anterior
   "Comanda".
2. Abaixo do botão "Novo pedido" haverá uma tabela chamada **"Lista de
   comandas"**: mostrará as comandas ativas numa lista vertical da mais
   recente para a mais antiga; cada vez que uma camareira enviar o pedido
   na tela de comandas, ele passa a ficar registrado nessa lista, contendo:
   número da comanda daquele quarto (cada comanda recebe um número
   sequencial a partir do número 1, para cada quarto); número do quarto;
   nome da camareira responsável pela última ação realizada sobre a
   comanda; e valor total da comanda (atualizado). Para cada comanda na
   lista, deverá haver a possibilidade de a camareira realizar uma ação de
   edição (um botão de edição), que abrirá novamente a tela de comanda com
   as quantidades registradas para cada item naquela comanda e o quarto a
   que pertence, com a possibilidade de edição desses dados, além da
   possibilidade de cancelamento da comanda ou de envio do pedido
   novamente. Clicando sobre a comanda na lista (fora do botão de edição),
   haverá a possibilidade de a camareira visualizar a comanda com todos os
   itens registrados.

## 2) Tela "Consumo por quartos" para a camareira

Aparecerá no menu principal logo após a aba "Comandas", **substituindo** a
tela "Consumo de Bar da Piscina" da camareira, que deixará de existir. Ou
seja, a tela "Consumo de Bar da Piscina" passa a se chamar "Consumo por
quartos" e será igual à antiga tela do admin "Consumo de Bar e Frigobar",
com todas as suas funcionalidades — a camareira passa a ser responsável por
fechar a conta de consumo de bar e frigobar por quarto e realizar todas as
demais atividades já previstas nessa tela, antes realizadas pelo admin.

Portanto, essa tela nova da camareira, para cada quarto, contabilizará o
consumo do frigobar da mesma forma que estava sendo feito anteriormente, e
contabilizará o consumo do bar agora obtendo os dados por meio das
comandas abertas por quarto.

Quando a conta for fechada para um determinado quarto, fica impedido o
lançamento de mais comandas naquele quarto até que seja informado pela
camareira o pagamento, ou seja reaberta a conta pela camareira:

- No caso de **pagamento**: as comandas somem da lista de comandas da
  camareira na tela "Comandas".
- No caso de **reabertura**: a conta é reaberta e, se forem lançadas mais
  comandas (ou editadas as existentes) naquele quarto, elas são
  adicionadas às já lançadas, reiniciando o processo de contabilização do
  consumo daquele quarto reaberto.

Ou seja, é o mesmo processo de antes, porém agora quem realiza é a
camareira, na sua tela "Consumo por quartos". Essa tela deve usar
exatamente o mesmo layout (acordeão), formato e dimensões, bem como as
funcionalidades, da tela "Consumo de Bar e Frigobar" do admin.

## 3) Para o admin

A tela "Consumo de Bar e Frigobar" (cujas funcionalidades passam para a
tela "Consumo por quartos" da camareira) passa a ser apenas para
visualização. A aba "Consumo de Bar e Frigobar" do menu principal do admin
abrirá um menu de duas abas:

### a) "Lista de comandas do bar"

Uma tabela "Lista de comandas": mostrará as comandas ativas numa lista
vertical da mais recente para a mais antiga, contendo: número da comanda
daquele quarto; número do quarto; data e hora do envio do pedido;
camareira que enviou o pedido original; status da comanda (original,
cancelada, em edição ou comanda editada); data e hora da última ação
realizada na comanda; camareira responsável pela última ação; e valor
total da comanda (atualizado). Não há possibilidade de edição ou
cancelamento por parte do admin — só visualização. Clicando sobre a
comanda, é possível visualizar todos os itens registrados. Toda vez que o
pagamento for realizado e informado pela camareira, as comandas
correspondentes daquele quarto também somem desta lista do admin.

### b) "Consumo por quartos" (admin)

Exatamente igual à antiga tela "Consumo de Bar e Frigobar" do admin, porém
apenas para leitura/visualização, sem a possibilidade de fechar a conta ou
realizar qualquer outra funcionalidade — que passam a ser feitas pela
camareira.

## Requisitos não funcionais

- Utilizar as melhores práticas de segurança e de eficiência de código
  para um processamento rápido, sem delays.
- Sempre que houver algum ponto crucial que ficou lacunoso e precisar de
  uma decisão/escolha importante para a execução, consultar o proprietário
  antes de prosseguir.
