# PRD — Módulo de Compras, Despesas e Controle de Estoque

> Documento de estudo e proposta, preparado antes de qualquer implementação.
> Segue o mesmo formato dos demais `PRD_*.md` deste projeto: um registro
> vivo que vai sendo atualizado conforme decisões forem tomadas e a
> implementação avançar. **Plano aprovado e implementado (seções 1-14, e a
> segunda leva na seção 15) na branch `feature/compras` — testado
> localmente, aguardando aprovação pra merge em `main`/produção.**

## 1. Contexto e objetivo

O app "Camareiras Vila Corada" hoje cobre o lado operacional do dia a dia
(limpeza, manutenção, café da manhã, bar/frigobar faturado ao hóspede) e o
lado financeiro **da receita** (comissões, contas de consumo). Falta o
lado financeiro **da despesa**: o que a pousada compra, quanto gasta, e
quanto tem guardado de cada item consumível.

Hoje, pelo que entendo da conversa, existe um fluxo informal e paralelo
(fora deste app) em que uma nota/recibo fotografado é lançado manualmente
numa planilha de controle de gastos. Esse módulo novo tem a chance de
substituir esse fluxo por algo integrado ao app, sem precisar abrir mão da
praticidade que a captura por foto já proporciona — na verdade, reforçando
exatamente essa praticidade com reconhecimento automático do conteúdo da
nota.

**Dois objetivos que precisam conviver, mas que são conceitualmente
diferentes:**

1. **Registro de despesas** — tudo que a pousada gasta: desde um pacote de
   detergente até o IPTU do ano. Serve para o controle financeiro/contábil
   geral (fluxo de caixa, categorização, relatórios para a contabilidade).
2. **Controle de estoque** — só a fatia das despesas que corresponde a
   **itens consumíveis que são usados ao longo do tempo** (limpeza, café
   da manhã, bar da piscina, piscina, jardim, manutenção/elétrica/
   hidráulica). Serve para saber quanto ainda tem de cada item e quando
   repor, com o mínimo de esforço humano possível.

Um ativo permanente (TV, geladeira, freezer, boiler) é uma **despesa**,
mas não é **estoque** — não tem "saldo" que vai sendo consumido aos
poucos. Da mesma forma, salários, honorários, impostos e contas de
consumo (luz/água/internet) são despesas puras, sem nenhuma relação com
estoque. O desenho abaixo trata essas três coisas (despesa pura, ativo
permanente, item de estoque) como **três naturezas diferentes dentro do
mesmo lançamento**, não como três módulos separados — um único fluxo de
"lançar uma despesa" que se adapta ao tipo.

## 2. Boas práticas de controle de estoque para hotelaria/pousadas pequenas

Pesquisei como sistemas de gestão hoteleira (PMS) e de F&B (restaurantes,
bares) de pequeno porte tratam esse problema, já que uma pousada pequena
tem exatamente o mesmo desafio: poucas mãos disponíveis, alto número de
itens de baixo valor unitário, necessidade de não atrapalhar a operação
do dia a dia.

- **Estoque perpétuo puro** (cada entrada e saída lançada na hora, saldo
  sempre exato) é o padrão "livro-texto", mas na prática **falha em
  negócios pequenos** porque exige disciplina constante de lançamento de
  toda e qualquer saída — um copo de álcool em gel usado pela camareira
  pra limpar um espelho não vai gerar um lançamento, e o sistema vai
  gradualmente divergir da realidade sem que ninguém perceba.
- **Contagem periódica pura** (só conta fisicamente de tempos em tempos,
  sem rastrear movimento nenhum entre contagens) é simples de operar mas
  não avisa a tempo quando um item está acabando, e não indica se uma
  queda de estoque é consumo normal ou perda/furto/quebra.
- **O padrão que a indústria hoteleira/F&B de pequeno porte converge** é
  um **híbrido**: lançar automaticamente tudo que já tem um sinal
  confiável e barato de capturar (aqui, isso significa aproveitar dados
  que o app **já coleta por outro motivo** — ver seção 5.4), e usar
  contagem física periódica como rede de segurança pra tudo o mais e
  como conciliação de divergências (quebra, perda, erro de lançamento).
  Essa é a recomendação deste documento.
- **Classificação por importância (ABC)**: nem todo item merece o mesmo
  rigor. Itens de alto giro/alto valor (bebidas do bar, por exemplo)
  merecem contagem mais frequente; itens de baixo valor e baixo giro
  (um rolo de barbante do jardim) podem ficar só com um alerta de "está
  acabando" baseado na última compra, sem contagem regular. O cadastro
  de item permite marcar essa importância, mas a tela de uso do dia a
  dia não deve obrigar ninguém a pensar nisso — é um ajuste fino que o
  admin faz, não um conceito que a camareira precisa entender.
- **Ponto de reposição ("par level")**: em vez de fórmulas complexas de
  estoque de segurança, o padrão em negócios pequenos é um número simples
  por item — "abaixo de X unidades, avisa que está acabando". Fácil de
  entender, fácil de ajustar, sem exigir nenhum conhecimento técnico de
  quem usa o app no dia a dia.
- **Código de barras e leitura por câmera** já são padrão em qualquer
  sistema de estoque moderno, inclusive os voltados a pequenos negócios
  (o próprio costume de "bipar" um produto é familiar pra qualquer
  pessoa que já trabalhou em comércio) — a tecnologia pra isso roda
  inteiramente no navegador do celular, sem custo de licença.
- **IA de visão computacional para leitura de nota fiscal/cupom** é a
  evolução mais recente desse campo — substitui motores de OCR
  tradicionais (que exigem um layout relativamente padronizado pra
  funcionar bem) por um modelo que **entende o conteúdo** da imagem,
  lidando melhor com notas manuscritas, cupons amassados, ou formatos
  variados de mercadinho local — exatamente o tipo de nota que uma
  pousada pequena recebe no dia a dia (ver seção 6.2).

## 3. Como isso se encaixa no app existente (reaproveitamento)

Boa notícia: o app já tem praticamente toda a infraestrutura necessária
construída para outras finalidades, e esse módulo pode reaproveitar quase
tudo, em vez de reinventar:

- **Catálogos já existentes**: `minibar_items` (frigobar) e
  `poolbar_items` (bar da piscina) já são, na prática, metade de um
  catálogo de produtos — só faltam os campos do lado "compra/estoque"
  (custo, unidade, fornecedor, saldo). Em vez de duplicar esses
  catálogos, a proposta é que o catálogo de estoque **referencie** esses
  itens quando fizer sentido (ex.: "Coca-Cola lata" é ao mesmo tempo um
  item vendido no bar da piscina e um item de estoque) — ver seção 5.1.
- **Upload de foto com compressão + URL assinada**: a Parte 48 (fotos de
  ocorrência de manutenção, implementada há poucos dias) já construiu
  exatamente o mecanismo necessário pra fotografar um recibo/nota —
  bucket privado no Supabase Storage, compressão no navegador antes do
  envio, leitura sempre por URL assinada gerada na hora. Esse módulo
  reaproveita esse mecanismo quase sem alteração, só trocando o bucket e
  o contexto.
- **`QuantityStepper`**: o seletor +/- já usado em frigobar e comandas é
  exatamente o controle certo pra "dar baixa de X unidades" ou "registrar
  a contagem de Y unidades" — sem a camareira precisar digitar número
  nenhum, seguindo a mesma exigência já aplicada no resto do app.
- **Padrão de telas "Listas"/"Checklists"**: o submenu vertical com
  `<BackLink>` já estabelecido serve de modelo pra onde encaixar as telas
  de catálogo de itens de estoque, fornecedores e categorias de despesa.
- **Resumo Executivo/Histórico**: a estrutura de cards + menu de seções já
  existente é onde os relatórios de despesa (por categoria, por mês) e os
  alertas de reposição de estoque devem aparecer, em vez de criar uma área
  totalmente nova e desconectada.
- **Padrão de dado sempre calculado, nunca sincronizado** (Partes 16/17
  deste mesmo projeto): a lição aprendida ali — "se um valor pode ser
  derivado de outra fonte, derive sempre na hora, não persista um valor
  que pode ficar desatualizado" — se aplica diretamente ao saldo de
  estoque (ver seção 5.1): a proposta é que o saldo de cada item seja
  **sempre a soma de todos os movimentos dele**, nunca um número guardado
  à parte que alguém precisa lembrar de atualizar.

## 4. Categorias de despesa

A partir da lista que você descreveu, proponho estas categorias (nível 1
— o admin poderia criar subcategorias dentro de cada uma, se quiser mais
detalhe depois, mas isso não é necessário pra começar):

| Categoria | Gera item de estoque? | Exemplos |
|---|---|---|
| Limpeza | Sim | Detergente, desinfetante, sacos de lixo |
| Café da manhã | Sim | Pão, frutas, sucos, café, laticínios |
| Bar da piscina | Sim | Bebidas, petiscos (mesmo catálogo do bar) |
| Enxoval (cama/banho/mesa) | Sim, com contagem simples | Lençóis, toalhas, jogos americanos |
| Piscina | Sim | Cloro, produtos químicos, boias |
| Jardim | Sim | Adubo, sementes, ferramentas de consumo |
| Manutenção (elétrica/hidráulica/outros) | Sim | Fios, torneiras, parafusos, fita veda-rosca |
| Ativos permanentes | **Não** (é despesa, não estoque) | TV, geladeira, freezer, boiler |
| Consumo (luz/água/internet) | Não | Contas mensais |
| Pessoal (salários/encargos) | Não | Folha de pagamento |
| Serviços profissionais | Não | Contabilidade, gestão de vendas, gestão financeira |
| Impostos e taxas | Não | IPTU e similares |
| Outras | Depende | Categoria "escape hatch" pra não travar um lançamento |

O enxoval merece uma nota: diferente de um item consumível "de verdade"
(que acaba e precisa ser reposto), uma toalha ou lençol tem vida útil
longa e "some" por desgaste/perda, não por consumo diário. Proponho
tratá-lo como estoque, mas com contagem física **menos frequente** (ex.:
trimestral) em vez de qualquer tentativa de rastrear "qual toalha foi
usada em qual troca de cama" — isso seria exigir uma granularidade que
nenhuma pousada pequena pratica de verdade.

## 5. Desenho do controle de estoque (proposta principal)

### 5.1 Catálogo de itens de estoque

Um cadastro novo (`inventory_items`), com:

- Nome, categoria (lista da seção 4), unidade de medida (unidade, kg,
  litro, pacote, caixa...).
- Código de barras (opcional — preenchido na primeira leitura por câmera,
  ver seção 6.1).
- Ponto de reposição ("avisar quando o saldo cair abaixo de X").
- **Opcionalmente**, uma referência ao item correspondente em
  `minibar_items` ou `poolbar_items`, quando fizer sentido — é o que
  habilita a baixa automática da seção 5.4.
- O **saldo atual nunca é um número guardado à parte** — é sempre
  calculado na hora, somando todos os movimentos desse item (ver seção
  5.2 a 5.5) — mesmo princípio já usado em outras partes do app (seção 3).

### 5.2 Registro de compra (entrada de estoque)

Toda compra de um item de estoque gera, automaticamente, um "movimento de
entrada" igual à quantidade comprada. Isso acontece como consequência
natural de **lançar a despesa** (seção 7.1/7.4) — a camareira ou o admin
não precisa fazer duas coisas separadas ("lançar a despesa" e "dar entrada
no estoque"); é a mesma ação.

### 5.3 Baixa de estoque (saída/consumo manual)

Pra itens sem nenhum sinal automático (limpeza, piscina, jardim,
manutenção, café da manhã — ver seção 5.4 sobre por que o café da manhã
cai aqui), a camareira registra uma baixa manual e rápida: escaneia o
código de barras (ou busca pelo nome), escolhe a quantidade usada no
`QuantityStepper`, confirma. Um lançamento, poucos segundos.

### 5.4 Baixa automática a partir do que já é registrado

Esta é a parte que mais aproveita o que o app já tem: **frigobar e bar da
piscina já são lançados, item por item, pela camareira, todos os dias** —
só que para fins de **cobrança ao hóspede**, não de estoque. Em vez de
pedir que a camareira lance a mesma informação duas vezes, a proposta é
que, no momento em que uma conta de quarto é **paga** (`room_bills.status
= 'paga'`, um evento que já existe e só acontece uma vez por conta), o
sistema gere automaticamente um movimento de saída de estoque pra cada
item de frigobar/bar consumido naquela conta — mas **só** para os itens
de `minibar_items`/`poolbar_items` que o admin tiver explicitamente ligado
a um item de estoque (campo opcional da seção 5.1). Isso significa:

- Zero esforço extra pra camareira — ela já faz esse lançamento hoje, por
  outro motivo.
- O admin decide, item a item, se quer rastrear estoque daquele produto
  ou não (ex.: pode querer rastrear bebidas engarrafadas, mas não achar
  necessário rastrear "limão espremido na hora").
- O gatilho é o **pagamento**, não o lançamento em si — evita
  complicação com comandas editadas/canceladas no meio do caminho (só o
  que sobrou de pé na conta, no momento em que ela foi fechada e paga, é
  que vira baixa de estoque).

Café da manhã **não** entra nessa baixa automática, porque, diferente do
frigobar/bar, o app não registra hoje "quais itens foram servidos em cada
mesa" — só a quantidade de hóspedes. Criar esse detalhamento exigiria um
novo lançamento item a item por refeição, que é exatamente o tipo de
esforço operacional que você pediu para minimizar. A recomendação é: café
da manhã entra no estoque pelo lado da compra e da contagem física
periódica, não por uma tentativa de rastrear o consumo exato por refeição
(ver alternativa C na seção 12, caso prefira o contrário).

### 5.5 Contagem periódica (inventário físico) e conciliação

Uma tela guiada (provavelmente mensal, mas o admin escolhe a frequência,
podendo ser diferente por categoria — ver ABC na seção 2): lista os itens
de uma categoria, mostra o saldo teórico de cada um, e pede a contagem
física real. A diferença entre teórico e contado vira um "ajuste de
contagem" — um movimento de estoque que corrige o saldo e fica registrado
como histórico de quebra/perda/erro, nunca apagado silenciosamente.

### 5.6 Alertas de reposição

Qualquer item cujo saldo calculado fique abaixo do ponto de reposição
cadastrado aparece automaticamente numa lista de "precisa comprar" — no
Resumo Executivo, como mais um card de consulta rápida, no mesmo padrão
já usado pelos outros 5 cards existentes.

## 6. Tecnologias propostas pra registro rápido

### 6.1 Leitura de código de barras

Os celulares Android usados pelas camareiras (Xiaomi, Samsung) rodam
Chrome ou navegadores baseados nele, que suportam a **detecção de código
de barras nativa do navegador** (API `BarcodeDetector`) — sem precisar de
nenhuma biblioteca externa pesada, funciona apontando a câmera, sem
nenhum custo de licença. Pra cobrir qualquer navegador que não suporte
essa API nativamente (o admin usa iPhone, cujo Safari tem suporte mais
recente e variável), uma biblioteca JavaScript de fallback (ex.: ZXing)
cobre a lacuna sem exigir nenhuma mudança na experiência de quem usa.
Quando um código de barras ainda não cadastrado é lido pela primeira vez,
o sistema pode consultar uma base pública/gratuita de produtos brasileiros
(ex.: Cosmos Bluesoft) pra sugerir automaticamente o nome do produto —
confirmado uma vez pela camareira/admin, fica salvo pra sempre.

### 6.2 Leitura inteligente de nota fiscal/cupom (IA de visão)

Em vez de um motor de OCR tradicional (que exige um layout relativamente
padronizado pra funcionar bem), a proposta é usar um modelo de IA com
capacidade de visão (como o próprio Claude, já usado neste ambiente de
desenvolvimento) pra **ler a foto da nota/cupom e devolver os itens, as
quantidades e os valores já organizados** — essa abordagem lida muito
melhor com a variedade real de documentos que uma pousada recebe
(cupom de mercadinho, nota manuscrita, nota de loja de material de
construção, cada uma com um layout diferente) do que um OCR tradicional,
porque o modelo **entende o conteúdo**, não só reconhece caracteres num
layout esperado. Na prática: a camareira ou o admin tira a foto, o
sistema sugere os itens/quantidades/valores já preenchidos, e a pessoa só
confirma ou corrige — nunca digita tudo do zero. Essa tecnologia já é, na
prática, o que torna possível o fluxo que você já usa hoje fora do app
(foto → lançamento na planilha) — a proposta aqui é só trazer esse mesmo
mecanismo pra dentro do app, ligado ao estoque.

### 6.3 QR code da nota fiscal eletrônica (alternativa mais robusta, ver seção 12-B)

Notas fiscais eletrônicas de verdade (de fornecedores com CNPJ, não
cupons informais) costumam ter um QR code que aponta pro portal oficial
da nota — lendo esse QR code, é possível obter os dados **exatamente como
emitidos**, sem nenhum risco de erro de leitura. É mais preciso que a
leitura por IA, mas só funciona quando existe essa nota fiscal formal (não
cobre uma compra num mercadinho local sem nota, por exemplo) e normalmente
exige um serviço terceirizado pago pra consultar o portal de forma
confiável. Apresento como alternativa complementar, não como substituto
da leitura por foto.

### 6.4 Reaproveitamento do padrão de fotos já construído

Tecnicamente, tudo isso (seções 6.1 a 6.3) usa a mesma base já construída
na Parte 48 deste projeto (fotos de ocorrência de manutenção): um espaço
de armazenamento privado, com leitura sempre por link temporário gerado
na hora, e compressão da foto no celular antes do envio. Não é
infraestrutura nova — é a mesma infraestrutura, com um novo propósito.

## 7. Fluxos de uso propostos

### 7.1 Camareira — lançar uma compra

1. Tira foto da nota/cupom (ou escolhe uma foto já tirada).
2. O sistema lê a foto e sugere os itens, quantidades e valores.
3. A camareira confirma ou ajusta (ex.: corrige um valor mal lido),
   escolhendo a categoria de cada item numa lista já conhecida.
4. Confirma — a despesa é registrada e, para os itens de estoque, o
   saldo já sobe automaticamente.

### 7.2 Camareira — dar baixa de um item usado

1. Escaneia o código de barras do item (ou busca pelo nome).
2. Ajusta a quantidade usada no seletor +/-.
3. Confirma — pronto, sem mais passos.

### 7.3 Admin — contagem periódica de estoque

1. Abre a tela de contagem, escolhe a categoria (ex.: "Limpeza").
2. Pra cada item, vê o saldo teórico e digita/ajusta a contagem real.
3. Ao fechar a contagem, o sistema grava os ajustes e mostra um resumo
   de divergências (o que sumiu a mais do que o esperado).

### 7.4 Admin — lançar despesa não-estocável

Mesmo fluxo de "tirar foto, confirmar itens sugeridos" da seção 7.1, mas
sem nenhuma baixa/entrada de estoque envolvida — serve pra salários,
honorários, contas de consumo, impostos, ativos permanentes. O mesmo
formulário serve pros dois casos; a diferença é só se a categoria
escolhida é ou não uma categoria "de estoque".

### 7.5 Admin — relatórios

Dentro do Resumo Executivo: total de despesas do mês por categoria,
itens com estoque baixo (alerta), histórico de compras por fornecedor,
exportação em CSV (mesmo padrão já usado no Histórico geral do app).

## 8. Ativos permanentes — tratamento simplificado

Pra começar, proponho tratar um ativo permanente como **só mais uma
categoria de despesa**, sem nenhum controle de depreciação ou registro
patrimonial completo (número de série, vida útil contábil etc.) — isso
seria um módulo à parte, tipicamente de responsabilidade da própria
contabilidade terceirizada, e não foi pedido explicitamente. Se mais
adiante fizer sentido ter uma lista simples "o que a pousada tem" (pra
seguro, por exemplo), isso pode ser avaliado como uma extensão futura,
não como parte deste módulo inicial.

## 9. Modelo de dados (visão de alto nível)

Sem entrar em sintaxe de banco de dados ainda (isso fica pra quando a
implementação for aprovada), as peças novas seriam:

- **Categorias de despesa** (`expense_categories`) — lista fixa inicial,
  editável pelo admin como as demais categorias do app.
- **Fornecedores** (`suppliers`, opcional) — nome e identificação, útil
  pros relatórios, não obrigatório preencher.
- **Despesas** (`expenses`) — um lançamento (data, categoria, fornecedor,
  valor total, forma de pagamento, foto do recibo), podendo ter uma ou
  mais linhas de item.
- **Itens de uma despesa** (`expense_items`) — cada produto/linha dentro
  de uma compra, com quantidade/valor unitário, ligado (ou não) a um
  item de estoque.
- **Catálogo de itens de estoque** (`inventory_items`) — nome, categoria,
  unidade, código de barras, ponto de reposição, e a ligação opcional
  com `minibar_items`/`poolbar_items`.
- **Movimentos de estoque** (`inventory_movements`) — todo evento que
  muda o saldo de um item (compra, baixa manual, baixa automática de
  consumo, ajuste de contagem) — um registro que nunca é apagado,
  servindo de trilha de auditoria completa.
- **Sessões de contagem** (`inventory_count_sessions` +
  `inventory_count_lines`) — o registro de cada conferência física.

## 10. Plano de implementação por fases

1. **Fase 1 — Despesas gerais, sem estoque**: cadastro de categorias,
   lançamento de despesa com foto + leitura por IA, relatório básico por
   categoria/mês. Já substitui o fluxo externo da planilha.
2. **Fase 2 — Catálogo de estoque + baixa manual**: cadastro de itens de
   estoque, leitura de código de barras, baixa manual, saldo sempre
   calculado, alerta de ponto de reposição.
3. **Fase 3 — Baixa automática a partir de frigobar/bar**: ligação
   opcional entre `inventory_items` e `minibar_items`/`poolbar_items`,
   gatilho no pagamento da conta.
4. **Fase 4 — Contagem periódica/conciliação**: tela guiada de
   inventário físico, ajustes, histórico de divergências.

Cada fase é testável e utilizável isoladamente — não é preciso esperar a
Fase 4 pronta pra já começar a substituir a planilha externa pela Fase 1,
por exemplo.

## 11. Estratégia de branch e segurança do ambiente de produção

Conforme pedido, toda a implementação será feita numa branch própria
(`feature/compras`), testada inteiramente no ambiente local (Supabase via
Docker, já isolado da produção desde a Parte 08), com o merge pra `main`
só acontecendo depois de aprovação explícita. Todas as tabelas novas são
**aditivas** — nenhuma tabela existente é alterada, exceto por duas
colunas opcionais (`minibar_items.inventory_item_id`/
`poolbar_items.inventory_item_id` ou equivalente, nullable) usadas só
pela Fase 3 — o que minimiza qualquer risco pro app que já está em uso
real.

## 12. Alternativas e pontos de decisão

**A. Estilo de controle de estoque**
- **Recomendado**: híbrido (baixa automática onde já existe sinal +
  baixa manual rápida + contagem periódica de conciliação) — seção 5.
- Alternativa mais simples: só registrar compras e fazer contagem
  periódica, sem nenhuma baixa manual no meio — menos esforço de tela,
  mas o saldo "teórico" só fica atualizado depois de cada contagem (o
  alerta de reposição vira menos confiável entre uma contagem e outra).
- Alternativa mais rigorosa: estoque perpétuo completo, com baixa manual
  obrigatória de **todo** item usado, inclusive os que hoje têm baixa
  automática — mais preciso em teoria, mas historicamente é o tipo de
  disciplina que falha em negócios pequenos (seção 2).

**B. Motor de leitura de nota/recibo**
- **Recomendado**: IA de visão computacional (seção 6.2) — mais flexível
  com a variedade real de documentos, sem precisar de um layout padrão.
- Alternativa: serviço de OCR dedicado (Google Document AI, AWS Textract)
  — tende a ser mais barato por documento em grande volume, mas menos
  flexível com notas informais/manuscritas, e exige integrar mais um
  fornecedor externo.
- Alternativa: QR code da NFC-e (seção 6.3) — mais preciso quando
  disponível, mas só cobre notas fiscais formais e tipicamente exige um
  serviço pago de consulta ao portal.
- Alternativa mais simples (sem IA nenhuma): só digitação manual dos
  itens, com a foto servindo apenas de comprovante anexado — elimina
  qualquer custo de processamento de imagem, mas devolve o trabalho de
  digitar tudo, o oposto do que foi pedido.

**C. Granularidade do café da manhã**
- **Recomendado**: só compra + contagem, sem baixa por consumo (seção
  5.4) — esforço mínimo, mas o saldo entre contagens é só uma estimativa.
- Alternativa mais detalhada: a camareira registra, a cada dia, o que foi
  de fato colocado na mesa do café (ex.: "2 pães, 1 jarra de suco") —
  mais preciso, mas é um lançamento diário novo que nenhuma outra parte
  do app pede hoje, e tende a gerar cansaço/abandono do hábito com o
  tempo.

**D. Escopo da baixa automática (frigobar/bar)**
- **Recomendado**: opt-in por item, o admin decide quais produtos ligar
  (seção 5.4).
- Alternativa: ligar automaticamente todo item do catálogo de bar/
  frigobar que tiver um nome "parecido" no catálogo de estoque — menos
  trabalho de configuração inicial, mas corre risco de ligações erradas
  silenciosas (ex.: "Água" do frigobar associada por engano a "Água
  sanitária" do estoque de limpeza).

**E. Ativos permanentes**
- **Recomendado**: só uma categoria de despesa, sem controle patrimonial
  (seção 8).
- Alternativa: um registro patrimonial completo (número de série, data
  de aquisição, vida útil, depreciação) — útil pra seguro/contabilidade
  mais sofisticada, mas é essencialmente um módulo contábil à parte, fora
  do que foi pedido.

**F. Leitura de código de barras**
- **Recomendado**: API nativa do navegador com biblioteca JS de
  fallback (seção 6.1) — sem custo, funciona nos aparelhos já em uso.
- Alternativa: nenhuma leitura de código de barras, só busca por nome na
  lista de itens — mais simples de construir, mas mais lento no uso
  diário (a camareira precisa digitar/rolar uma lista em vez de só
  apontar a câmera).

## 13. Riscos conhecidos e decisões que dependem de você

- **Confirmar se o módulo deve substituir totalmente o fluxo externo da
  planilha**, ou se os dois devem conviver por um tempo (ex.: até você
  ganhar confiança no novo fluxo).
- **Confirmar a lista de categorias de despesa da seção 4** — é um
  ponto de partida, não uma lista fechada.
- **Decidir a frequência de contagem física** por categoria (seção 5.5)
  — proponho mensal como padrão, ajustável.
- **Custo de uso da IA de leitura de nota** (seção 6.2): cada leitura
  tem um custo pequeno por chamada à API — meramente simbólico no volume
  de uma pousada pequena, mas é uma variável de custo recorrente nova
  que antes não existia neste app (que hoje só paga por Supabase/Vercel/
  Resend). Vale confirmar que está de acordo.
- **Quem pode editar/apagar um lançamento de despesa já confirmado** —
  proponho que, uma vez confirmada, uma despesa só possa ser editada por
  um admin (mesmo padrão de outras transições sensíveis neste app — ver
  "Convenções e decisões importantes" do `CLAUDE.md`), mas isso é um
  ponto de confirmação, não uma decisão já tomada.

## 14. Resumo da recomendação

Um módulo que: (1) trata despesa e estoque como duas camadas do mesmo
lançamento, não dois sistemas separados; (2) usa leitura de foto por IA
pra eliminar a digitação manual de nota/recibo; (3) usa código de barras
pra tornar a baixa de estoque quase instantânea; (4) aproveita o que o
app já registra hoje (frigobar/bar) pra dar baixa automática sem esforço
extra de ninguém; (5) usa contagem física periódica como rede de
segurança, não como único mecanismo de controle; e (6) é construído numa
branch separada, testado localmente, sem nenhum risco pro app que já está
em produção.

## 15. Segunda leva — giro semanal por grupo, ficha técnica e pedidos de compra visuais

> Implementada e testada localmente após a aprovação inicial (seção 1-14
> acima). Resume as decisões tomadas numa rodada de perguntas/respostas com
> o proprietário, já refletidas no código.

### 15.1 Ponto de reposição deixou de ser só manual

Além do campo manual que o admin já preenchia (`reorder_point`), o sistema
agora também **calcula sozinho** um ponto de reposição sugerido, a partir
do consumo real recente do item:

```
giro semanal = consumo real dos últimos 60 dias ÷ 60 × 7
ponto calculado = giro semanal ÷ 7 × dias de folga do grupo do item
```

"Consumo real" conta só baixa manual + baixa automática por consumo de
hóspede — nunca compra nem ajuste de contagem. O valor manual do admin,
quando preenchido (`reorder_point > 0`), **sempre tem prioridade** sobre o
calculado; na ausência dele, usa-se o calculado. Nenhum dos dois é
obrigatório — um item sem grupo de giro e sem valor manual simplesmente
não aparece na lista de compras por cálculo nenhum (só por pedido visual
da equipe, se houver).

### 15.2 Grupos de giro — dias de folga por categoria de controle fino

Em vez de um único número de "dias de folga" para o app inteiro, o admin
cadastra **grupos de giro**, cada um com seu próprio ciclo — porque o
ciclo de compra de bebida alcoólica (a cada ~60 dias) não tem nada a ver
com o de limpeza (semanal). Grupos iniciais, com os dias de folga já
confirmados pelo proprietário (editável a qualquer momento, tela
"Grupos de giro"):

| Grupo | Dias de folga |
|---|---|
| Limpeza | 7 |
| Bebidas não alcoólicas | 7 |
| Alimentos (petiscos do bar da piscina) | 7 |
| Alimentos (café da manhã) | 7 |
| Bebidas alcoólicas | 60 |
| Materiais de piscina | 60 |
| Materiais de manutenção | 30 |

Um item de estoque pode pertencer a **no máximo um** grupo, ou a nenhum —
itens perecíveis de reposição quase diária (ex.: frutas do café da manhã,
compradas sem câmara fria pra guardar) ficam **deliberadamente fora de
qualquer grupo**: não faz sentido calcular giro pra algo que é reposto
todo dia por inspeção visual, independente de qualquer fórmula. Pra esses
itens, o controle é 100% pela tela de "Pedidos de compra" (seção 15.4).

### 15.3 Ficha técnica — ingrediente compartilhado entre vários produtos do cardápio

O vínculo original (1 item de estoque ↔ no máximo 1 produto do
frigobar/bar) não sobrevivia a um ingrediente usado em vários pratos ao
mesmo tempo — ex.: macaxeira é consumida tanto como "Macaxeira frita"
(prato próprio) quanto como acompanhamento de "Filé Mignon trinchado
c/Macaxeira" e "Filé Camarão c/Macaxeira". Foi substituído por uma
**ficha técnica** (`inventory_item_recipes`): um ingrediente pode
alimentar vários produtos (todos do frigobar OU todos do bar da piscina,
nunca os dois ao mesmo tempo por linha), cada produto com sua própria
quantidade de **porções por pedido** consumidas daquele ingrediente.

Decisão importante: **o estoque e a lista de compras sempre mostram só o
ingrediente**, nunca de qual prato ele veio nem se a origem foi frigobar
ou bar — a mesma regra vale pra qualquer item (ex.: "Refrigerante lata" é
só "Refrigerante lata" no estoque, não importa se foi vendido avulso no
frigobar ou como parte de uma comanda do bar). A baixa automática ao pagar
a conta soma, por ingrediente, tudo que veio de qualquer produto ligado a
ele (ex.: 1 Macaxeira frita + 1 Filé Mignon c/Macaxeira baixa 2+1 = 3
porções de macaxeira numa única linha de movimento).

Itens controlados por **porção** (macaxeira, camarão, filé mignon etc.)
usam `unit = "porção"` normalmente — nenhum campo novo precisou pra isso.
O que é novo é `portion_weight_kg`: peso médio de 1 porção, em kg, editável
pelo admin, usado **só** na hora de mostrar a sugestão de compra também em
kg (já que o fornecedor vende por peso, não por porção) — nunca usado pra
nada além disso.

### 15.4 Pedidos de compra — sinal visual da camareira e do funcionário de manutenção

Tela nova (`/pedidos-compra` pra camareira, `/manutencao/pedidos-compra`
pro funcionário de manutenção — o admin administra o consumo de piscina e
manutenção, por isso também tem essa tela), pra registrar "isto está
acabando" visualmente — é o único sinal que existe pros itens perecíveis
sem grupo de giro (seção 15.2), e um reforço complementar pros demais.

Decisões confirmadas:
- **Cada pedido é uma linha própria, nunca mesclada** — pedir o mesmo item
  de novo nasce um pedido novo; os pendentes **se somam** só na tela do
  admin ("Lista de compras"), que mostra apenas o total.
- Quem pediu pode **editar ou cancelar cada pedido individualmente**,
  enquanto estiver pendente. Ninguém mais pode mexer no pedido de outra
  pessoa.
- O admin só pode **cancelar o total** de um item de uma vez (todas as
  linhas pendentes daquele item, de qualquer pessoa) — nunca edita nem
  cancela um pedido individual específico.
- **Qualquer compra do item resolve automaticamente todos os pedidos
  pendentes dele**, não importa se a quantidade comprada foi suficiente
  ou não — o pedido da equipe é tratado como uma sugestão, não uma meta a
  bater. Quem continua refletindo uma compra insuficiente é a **sugestão
  calculada pelo sistema** (seção 15.1), que nunca precisa de nenhum
  ajuste manual porque é sempre recalculada a partir do saldo atual —
  uma compra menor que o necessário já aparece sozinha, na próxima
  consulta, como uma sugestão menor (nunca zero).

### 15.5 Tela "Lista de compras" do admin

Mescla as duas fontes, lado a lado, por item: a sugestão calculada
(seção 15.1, com a conversão pra kg quando aplicável) e o total pedido
visualmente pela equipe (seção 15.4). Um item aparece na lista se tiver
qualquer uma das duas coisas — nunca as duas são obrigatórias.

O admin também pode **dispensar a sugestão calculada** de um item
individualmente (botão "X" ao lado da sugestão) — ponto que tinha ficado
de fora da primeira versão desta leva e foi adicionado depois, a pedido
do proprietário. Diferente do pedido da equipe (que é um registro que
pode ser cancelado de verdade), a sugestão calculada nunca é persistida —
é sempre recalculada a partir do saldo atual. Por isso "dispensar" aqui
significa algo mais específico: o sistema guarda o saldo do item no
momento da dispensa (`inventory_suggestion_dismissals`), e ela só vale
**enquanto esse saldo não mudar de novo**. Assim que qualquer movimento
altera o saldo (nova compra, novo consumo), a dispensa fica
automaticamente obsoleta e a sugestão recalculada volta a aparecer
sozinha, sem precisar de nenhuma ação manual — mesmo espírito de "nunca
persistir o que pode ficar desatualizado" já usado no resto do módulo.
Enquanto a dispensa está ativa, o item some da lista principal (a menos
que ainda tenha um pedido pendente da equipe, caso em que a coluna da
sugestão mostra "Dispensada pelo admin" com um botão pra reativar na
hora) e aparece numa seção à parte, "Sugestões calculadas dispensadas",
com o mesmo botão de reativar — útil pra itens cuja dispensa já não tem
mais nenhum motivo visível na lista principal.

## 16. Terceira leva — itens pendentes da auditoria inicial (ver seção 17 do changelog em CLAUDE.md)

> Depois da implementação inicial (seções 1-15), uma auditoria comparando
> o que tinha sido combinado neste PRD contra o que de fato foi construído
> encontrou 6 pontos que tinham ficado de fora ou diferentes do esperado.
> O proprietário decidiu avançar em 4 deles (os outros 2 — inventário
> inicial e QR code da NFC-e — já estavam cobertos ou já eram escopo
> aceito, e a classificação ABC de importância do item foi adiada por
> enquanto). Resume as decisões desta leva.

### 16.1 Leitura de código de barras — biblioteca de reserva (ZXing)

A leitura por câmera agora tem dois caminhos: a API nativa do navegador
(`BarcodeDetector`, caminho principal, sem nenhuma biblioteca — cobre o
Android das camareiras) e, só quando ela não existe (ex.: Safari do
iPhone, usado pelo admin), a biblioteca `@zxing/browser` carregada **sob
demanda** (só baixada pelo navegador que realmente precisa dela, nunca
pesando no fluxo comum via Android). O mesmo componente
(`BarcodeScannerButton`) e a mesma prop `formats` continuam servindo os
dois casos (código de barras de produto e QR code da nota fiscal) — quem
usa o botão não percebe qual dos dois caminhos está rodando por trás.

### 16.2 Editar uma despesa já lançada

Antes só existia "apagar" (admin only). Agora existe também "editar"
(mesmo formulário de lançar, reaproveitado em modo edição, acessível pelo
lápis na linha do histórico — só aparece pro admin). A correção de
quantidade de um item **ajusta sozinha** a entrada de estoque: como
`inventory_movements.reference_expense_item_id` já tinha `on delete
cascade`, editar uma despesa apaga as linhas antigas (o que desfaz a
entrada de estoque original, em cascata, sem precisar de nenhum código
especial) e recria as linhas novas (o que gera uma entrada nova, já com a
quantidade corrigida, pelo mesmo trigger de sempre). Mais simples e mais
seguro que tentar "diffar" quantidades em cima do que já existia.

### 16.3 Relatório "por fornecedor", ao lado de "por categoria"

A tela de Histórico de compras agora mostra os dois totais lado a lado
(`getExpenseSummaryBySupplier`, mesmo padrão já existente de
`getExpenseSummaryByCategory`) — despesas sem fornecedor preenchido
entram agrupadas como "Sem fornecedor". Vale tanto pro admin quanto pra
manutenção.

### 16.4 Frequência de contagem física configurável, com aviso

Cada categoria de estoque ganhou um campo opcional, `count_frequency_days`
(dias de folga **da conferência física**, não confundir com os "dias de
folga" dos grupos de giro, que são sobre reposição de compra) — editável
direto na tela "Contagem de estoque", ao lado do botão de iniciar
contagem daquela categoria. Quando preenchido, um aviso ("Está na hora de
contar") aparece assim que o número de dias desde a última contagem
**fechada** daquela categoria (ou de uma contagem de "todos os itens",
que conta pra todas) ultrapassar esse valor. Categoria sem frequência
configurada nunca gera aviso. O mesmo contador resumido aparece como
atalho no hub "Compras e Estoque", ao lado do já existente "itens
precisam de compra".

### 16.5 Testado

Simulação direta no banco (edição de despesa corrigindo a quantidade de
10 para 6 unidades — confirmado o movimento antigo desaparecendo em
cascata e o novo refletindo exatamente 6, sem sobra nem duplicação) e
sessão real do admin e da manutenção (tela de edição carregando
pré-preenchida; botão de editar visível só pro admin; manutenção bloqueada
pelo proxy mesmo tentando acessar a URL de edição diretamente; relatório
por fornecedor aparecendo corretamente nas duas telas de histórico; tela
de contagem mostrando as 7 categorias com o campo de frequência editável).
`npm run lint`/`npm run build` limpos. O caminho de reserva do scanner
(ZXing) foi verificado por leitura cuidadosa da API real da biblioteca
instalada (não por teste funcional num Safari de verdade, que este
ambiente não tem como simular) — vale confirmar na prática assim que o
admin testar pelo iPhone dele.

## 17. Quarta leva — reorganização de menus, leitura de PDF, edição de despesa, ativo permanente

> Lote grande de mudanças de navegação e de duas lacunas reais encontradas
> pelo proprietário usando o app de verdade (seção 17.6).

### 17.1 Reorganização do menu principal do admin

- **"Lançar Compra"** (antigo "Lançar compra/despesa", dentro do hub
  "Compras e Estoque") virou item próprio do menu principal, entre
  "Resumo executivo" e "Planejamento diário".
- **"Lista de compras"** saiu do hub e também virou item próprio do menu
  principal, logo depois de "Lançar Compra".
- **"Compras e Estoque"** (o hub) virou só **"Estoque"** — ficou só com
  baixa de estoque, itens, categorias, grupos de giro e contagem física.
- **"Histórico de compras e despesas"** saiu do hub de Estoque e passou a
  aparecer como uma seção própria, ao final da tela **"Histórico"** já
  existente — reaproveitando o mesmo filtro de data da página (sem um
  filtro próprio separado, pra não duplicar controles).
- Nova tela **"Ativo Permanente"**, logo depois de "Estoque" — ver 17.4.

Pro funcionário de manutenção: o item de menu "Compras" virou **"Lançar
Compra"** e passou a abrir o formulário direto — o antigo submenu (que só
tinha "Lançar compra/despesa" e "Histórico de compras") deixou de existir.
**O funcionário de manutenção não tem mais acesso a histórico de compras
nenhum** — só lança.

### 17.2 Nota fiscal em foto ou PDF, com câmera de verdade

- O upload de recibo/nota aceita agora **foto ou PDF** (bucket e leitura
  por IA atualizados pra aceitar `application/pdf`, lido como documento,
  não como imagem).
- O botão único "Tirar/escolher foto" foi separado em dois: **"Tirar
  foto"** (abre a câmera com pré-visualização ao vivo e um botão
  "Capturar" explícito — funciona igual no celular e no computador, sem
  depender do atributo `capture` de um input de arquivo, que no desktop
  simplesmente ignora a câmera) e **"Escolher arquivo"** (seletor de
  arquivo de verdade, aceitando foto ou PDF).
- O mesmo botão "Capturar" explícito foi adicionado ao **leitor de código
  de barras** (usado na baixa de estoque e na leitura do QR da nota
  fiscal) — complementa a detecção contínua automática já existente, útil
  quando o foco/iluminação não deixam a detecção automática pegar.

### 17.3 Editar uma despesa já lançada

Rota nova `/historico/compras/[id]/editar` (reaproveita o mesmo
`ExpenseForm`, em modo edição) — admin only, acessível pelo lápis na linha
da tabela em "Histórico". Detalhes de como o ajuste de estoque acontece
sozinho na edição já estão na seção 16.2.

### 17.4 Ativo Permanente

Tela nova no menu principal, com dois submenus:

- **"Relação de Ativo Permanente"**: lista somente leitura, agrupada por
  categoria, com todos os campos (marca/modelo, data da compra, valor,
  garantia, fornecedor, local).
- **"Itens de ativo permanente"**: cadastro de categorias e dos itens em
  si (nome, categoria, marca, modelo, data e valor da compra, garantia,
  fornecedor, local, observações).

13 categorias iniciais já cadastradas (televisores, ar-condicionados,
frigobares/geladeiras, boilers/aquecedores, bombas, camas/colchões,
móveis, eletrodomésticos de cozinha, equipamentos de lavanderia,
computadores/notebooks, veículos, ferramentas/manutenção, outros) —
**nenhum item ainda**, serão inseridos no inventário físico inicial.
Deliberadamente **fora** do catálogo de "itens de estoque": um ativo
permanente não tem saldo que se consome.

### 17.5 Relatório de estoque no Resumo Executivo

O card "Compras e Estoque" do Resumo Executivo deixou de ser um simples
link pro hub de Estoque — agora é ele mesmo um relatório
(`/dashboard/estoque`): dois gráficos de barra horizontal lado a lado (20
itens mais comprados no mês e desde sempre, por valor) e uma tabela
agrupada por categoria com, por item, quantidade comprada no mês, saldo
atual, estimativa de dias restantes (saldo ÷ consumo médio diário, a
partir do mesmo giro já usado na Lista de compras) e um aviso quando o
item está na lista de compras.

### 17.6 Bug real: compra lida pela IA não virava item de estoque — causa e correção

O proprietário relatou ter lançado duas compras reais (frutas e polpa de
fruta) sem encontrá-las depois em "Itens de estoque". Investigando as
duas despesas já registradas no banco:

- A compra de **frutas** foi lançada **sem nenhuma linha de item**
  (só o valor total, R$ 41,95) — nesse caso nunca haveria onde vincular
  um item de estoque, porque não existe nenhuma linha. Pra aproveitar
  essa despesa específica, é preciso editá-la (seção 17.3) e acrescentar
  a linha do item.
- A compra de **polpa de fruta** tinha 4 linhas de item (uma por sabor),
  mas **nenhuma delas tinha `inventory_item_id` vinculado** — porque até
  então o sistema só permitia *vincular* a um item **já existente**; nunca
  criava um item novo a partir de uma compra. Como "polpa de fruta" nunca
  tinha sido cadastrada manualmente em "Itens de estoque", a pessoa que
  lançou a compra (ou a própria leitura por IA) deixou essas linhas sem
  vínculo, por não ter como criar o item ali mesmo.

**Correção**: o seletor "Vincular a item de estoque" de cada linha ganhou
uma terceira opção, **"+ Criar novo item de estoque"** — ao escolher, a
linha pede a categoria (obrigatória) e a unidade do item novo; ao salvar,
o item é criado automaticamente e já fica vinculado a essa compra. Pra
nunca duplicar um item por engano (ex.: "Frutas" cadastrado manualmente
num dia, "frutas" criado por uma compra depois), toda criação confere
antes por nome exato (sem diferenciar maiúscula/minúscula) contra o
catálogo já existente — se achar, usa o item que já existe em vez de
criar outro. Quando a leitura por IA identifica um item cujo nome já bate
com um item existente, o vínculo já vem pré-selecionado sozinho, sem
precisar de nenhuma ação manual.

As duas despesas reais que motivaram esse relato foram preservadas
intactas (não apagadas, nem alteradas) — o proprietário pode agora
editá-las e vincular/criar os itens de estoque correspondentes, usando a
tela de edição nova (seção 17.3).

### 17.7 Testado

Simulação completa via chamadas reais às Server Actions (não só SQL
direto): lançamento com "criar novo item" pra dois itens diferentes
("Frutas Teste", "Polpa de Frutas Teste"), confirmando a criação e o
vínculo corretos; segunda compra com o nome em caixa diferente
("frutas teste") confirmando que reaproveita o item existente em vez de
duplicar (saldo final bateu exatamente com a soma das duas compras);
edição de uma despesa reduzindo a quantidade de um item, confirmando o
ajuste automático do saldo; upload de um PDF de teste de verdade,
confirmando a extensão salva (.pdf, não mais .jpg fixo) e o Content-Type
correto servido pela URL assinada. Sessão real do admin e da manutenção
confirmando a navegação nova (ordem do menu, rotas antigas retornando 404,
rotas novas carregando os dados certos) e que o realce de item ativo no
menu não duplica entre itens com o mesmo prefixo de URL (ex.: "Estoque" e
"Lançar Compra"). `npm run lint`/`npm run build` limpos.

### 17.8 Bug real encontrado pelo proprietário testando: contagem física duplicada

Ao clicar em "Iniciar contagem" pra "Bar da piscina", a tela seguinte
(`/compras/contagem/[sessionId]`) apareceu em branco (404) — causa foi o
cache de rotas do **modo de desenvolvimento** (Turbopack) ficar
desatualizado depois de uma leva grande de arquivos apagados/renomeados
de uma vez (seção 17, inteira) — resolvido reiniciando o servidor local;
a mesma URL passou a carregar normalmente depois disso. Não afeta o
build de produção (`npm run build` já vinha limpo o tempo todo).

**Efeito colateral real, esse sim corrigido no código**: cada tentativa
falha de abrir a tela (o clique no botão "Iniciar contagem" funcionava,
só a navegação seguinte que falhava) criava uma **sessão de contagem
nova**, já que `startCountSession` não conferia se já existia uma sessão
"em_andamento" pra aquela categoria antes de criar outra — chegaram a
existir 4 sessões vazias duplicadas pra "Bar da piscina" ao mesmo tempo.
Corrigido em duas camadas, mesmo padrão já usado no projeto pra "1 conta
aberta por quarto" (`room_bills`):

- Na Server Action: antes de criar, busca se já existe uma sessão aberta
  pra essa categoria (ou pra "todos os itens") e, se existir, devolve o
  id dela em vez de criar outra.
- No banco: índice único parcial (`inventory_count_sessions_one_open_per_category`,
  migration 059) garantindo, mesmo numa corrida entre duas requisições
  simultâneas, que nunca existam duas sessões "em_andamento" pra mesma
  categoria — se a trava do banco pegar a corrida antes da checagem da
  Server Action, o código busca a sessão que "venceu" e devolve ela
  normalmente, sem mostrar erro pra quem clicou.

As 3 sessões vazias duplicadas (nenhuma tinha nenhuma contagem
preenchida) foram apagadas; a sessão original do proprietário foi
preservada intacta, pronta pra ele continuar de onde parou.

**Testado**: chamada repetida da Server Action pra mesma categoria
devolvendo sempre o mesmo `sessionId` (sem criar duplicata, confirmado
também direto no banco); categoria diferente continua funcionando
normalmente. `npm run lint`/`npm run build` limpos.

## 18. Quinta leva — quebra de estoque, média de 12 meses e exclusão de outlier

> Pedido do proprietário, direto, sem rodada de análise prévia: registrar,
> a cada contagem física fechada, o quanto o saldo do sistema desviou da
> contagem real ("quebra de estoque"), comparar isso com a média do item
> nos últimos 12 meses, e marcar como outlier (fora da conta da média)
> qualquer contagem velha cujo desvio em relação à média, na época, tenha
> sido anormalmente grande — tudo configurável por item, sem digitação
> (só os steppers +/-1% já usados em outras partes do projeto).

### 18.1 Modelo de dados

Migration `060_inventory_shrinkage_tracking.sql` (schema espelhado):

- `inventory_items` ganhou dois limites, sempre positivos, com padrão
  igual pra todos os itens e editáveis por item:
  - `quebra_maxima_admitida_pct` (padrão 20%) — acima disso (em módulo),
    a contagem é tratada como "fora do padrão" nas telas de alerta.
  - `indice_relativo_maximo_pct` (padrão 200%) — acima disso, a contagem
    é tratada como outlier e excluída da média de 12 meses de contagens
    *futuras*.
- `inventory_count_lines` ganhou três números, calculados e gravados
  **uma única vez**, no momento em que a sessão é fechada — fatos
  congelados sobre aquela contagem específica, nunca recalculados depois
  (mesmo que os limites do item mudem mais tarde):
  - `quebra_pct`: percentual de diferença (saldo sistema → contagem
    física), com o mesmo sinal da diferença (pode ser negativo — falta —
    ou positivo — sobra).
  - `quebra_12m_pct`: média de `quebra_pct` das contagens fechadas do
    mesmo item nos últimos 12 meses ANTES desta, excluindo qualquer uma
    cujo `indice_relativo_pct` (o dela, congelado na época) seja maior
    que o `indice_relativo_maximo_pct` **atual** do item — mudar o limite
    hoje só afeta decisões de inclusão/exclusão em médias futuras, nunca
    reescreve o que já foi calculado (mesma regra já registrada em
    CLAUDE.md: "mudança de regra de cálculo nunca deve zerar
    retroativamente um valor já calculado").
  - `indice_relativo_pct`: sempre positivo (valor absoluto),
    `|quebra_pct ÷ quebra_12m_pct| × 100` — o quão fora do padrão aquela
    contagem ficou em relação à própria média histórica do item.
- View `inventory_count_line_history` (nova): uma linha por contagem
  **fechada**, já com nome do item, categoria, os limites **atuais** do
  item (de propósito não congelados, só os três números acima o são) e a
  data da contagem anterior do mesmo item via `lag() over (partition by
  inventory_item_id order by closed_at)` — evita recalcular "qual foi a
  contagem anterior" em JavaScript em três lugares diferentes (tela de
  contagem, Histórico, Resumo Executivo).

### 18.2 Por que os três números são calculados uma vez só, e não sempre ao vivo

Contraria, à primeira vista, a convenção já estabelecida no projeto de
"nunca persistir o que pode ficar desatualizado, sempre calcular na hora"
(Partes 16/17 do app principal). A diferença aqui é que `quebra_12m_pct`
de uma contagem depende de quais contagens anteriores foram excluídas como
outlier, o que depende do `indice_relativo_pct` **delas**, que por sua vez
dependia da média que existia **na época de cada uma** — uma cadeia
sequencial, não um valor independente recalculável a qualquer momento sem
andar a história inteira do item contagem por contagem. A solução: cada
contagem, ao fechar, grava o que calculou lendo só o histórico já
congelado até aquele ponto; consultas futuras (a tela de contagem viva, o
Histórico, o alerta do Resumo Executivo) só leem esses números já prontos
e decidem inclusão/exclusão usando o limite **atual** do item — a única
parte que seria sensata recalcular ao vivo, e é exatamente a única parte
que realmente é.

### 18.3 Tela "Contagem de Estoque" — card por item em vez de linha de tabela

A lista de linhas de contagem (`count-session-panel.tsx`) deixou de ser
uma tabela (ficaria ilegível com 11 colunas) e virou um card por item,
igual ao padrão já usado em "Itens de estoque". Cada card mostra:

- 1ª linha: contagem física (editável), diferença, quebra de estoque
  (calculada ao vivo conforme a camareira/admin digita, ainda sem
  persistir nada), quebra 12 meses (do histórico já fechado — nunca da
  própria sessão, que ainda não fechou) e data da contagem anterior.
- 2ª linha: quebra máxima admitida (stepper ±1%, sempre positivo), índice
  de quebra relativo (calculado ao vivo a partir da quebra de estoque
  atual ÷ quebra 12 meses) e índice de quebra relativo máximo (stepper
  ±1%). Os dois steppers reaproveitam `QuantityStepper`
  (`src/components/shared/quantity-stepper.tsx`) sem nenhuma mudança no
  componente — ele já aceita qualquer inteiro via `min`/`onChange`, então
  "1%, 2%, 3%..." é só mais um uso do mesmo padrão já usado em
  frigobar/comanda.
- Texto em vermelho quando a quebra de estoque (em módulo) excede a
  quebra máxima admitida, ou quando o índice relativo excede o índice
  relativo máximo — sinal visual de que aquela contagem, se fechada assim,
  provavelmente vai virar outlier ou disparar o alerta do Resumo
  Executivo.

### 18.4 Novo card no Histórico e nova tela "Quebra de Estoque" no Resumo Executivo

- Componente compartilhado `src/components/shared/inventory-shrinkage-table.tsx`
  (mesmas 12 colunas nos dois lugares, pedido explícito do proprietário)
  reaproveitado por:
  - Um card novo, "Histórico de contagem de estoque", ao final da tela
    **Histórico** do admin — usa o mesmo filtro `from`/`to` já existente
    na página, sem filtro próprio.
  - Nova tela **"Quebra de Estoque"**, item de menu novo no Resumo
    Executivo entre "Compras e Estoque" e "Comissões das camareiras" —
    lista os itens cuja **última** contagem fechada tem quebra de estoque
    (em módulo) maior que a quebra máxima admitida daquele item, ordenado
    do desvio mais grave pro menos grave.
- `getInventoryCountHistoryForPeriod(from, to)` e
  `getItemsAboveShrinkageThreshold()`, as duas novas em
  `src/lib/actions/inventory-counts.ts`, lêem direto da view
  `inventory_count_line_history` — a segunda agrupa por item e pega só a
  linha mais recente de cada um antes de filtrar/ordenar.
- **Decisão de interpretação, não explicitada no pedido original**: tanto
  o card do Histórico quanto a tela de alerta comparam a quebra de
  estoque **em módulo** (valor absoluto) contra a quebra máxima admitida
  — não só o lado negativo (falta). Coerente com o resto da especificação
  (o índice de quebra relativo também é sempre em módulo) e com o próprio
  nome "quebra máxima admitida" soar como um teto de desvio aceitável,
  tanto pra falta quanto pra sobra — uma sobra grande também costuma
  indicar erro de contagem/lançamento, não só uma falta. Se o proprietário
  quiser restringir o alerta só ao lado negativo, é uma mudança pequena e
  localizada nesses dois pontos.

### 18.5 `computeTrailingShrinkageAverage`/`twelveMonthsAgoIso` separadas em módulo próprio

`src/lib/inventory-shrinkage.ts` — mesmo motivo já documentado no projeto
pra `commission-math.ts`: um arquivo `"use server"` só pode exportar
Server Actions assíncronas, então a função pura de cálculo da média
(testável isolada, sem I/O) não podia morar dentro de
`inventory-counts.ts`.

### 18.6 Testado

Simulado diretamente no banco local (Docker), sem depender de dados de
produção: fabricadas 3 contagens fechadas históricas pro mesmo item (há
~10, ~7 e ~3 meses) com valores escolhidos pra forçar exatamente o cenário
do outlier — a contagem de ~7 meses atrás com um índice relativo de 500%
(bem acima do limite padrão de 200%) — e uma quarta contagem aberta hoje.
Confirmado, lendo a tela de contagem real (sessão autenticada,
`next dev` local):

- "Quebra 12 meses" mostrado na tela ANTES de fechar a contagem de hoje:
  -11% (média de -10% e -12%, **excluindo** corretamente o -50% da
  contagem de ~7 meses atrás, cujo índice relativo congelado de 500%
  excede o limite de 200%) — confirma a exclusão de outlier funcionando
  olhando só pra tela, sem precisar olhar o banco.
- "Data da contagem anterior": a contagem de ~3 meses atrás (a mais
  recente antes de hoje), não a mais antiga nem a excluída — confirma o
  `lag()` por data, não por qualquer critério de inclusão na média.
- Fechando a contagem de hoje (contagem física 9, saldo sistema 10): os
  três números gravados bateram exatamente com o esperado por conta
  manual — `quebra_pct = -10.00`, `quebra_12m_pct = -11.00`,
  `indice_relativo_pct = 90.91`.
- Abrindo uma QUINTA contagem depois de fechar a quarta: "Quebra 12
  meses" recalculado pra -10.7% (média de -10, -12 e -10, ainda excluindo
  o outlier de -50%) — confirma que a contagem recém-fechada já entra
  como histórico pra próxima, sem precisar de nenhum passo manual.
- Baixando a quebra máxima admitida do item pra 5% (via a Server Action
  dos steppers) e recarregando a tela "Quebra de Estoque": o item passou
  a aparecer corretamente (quebra de -10% excede 5%), com todas as 12
  colunas certas (datas, saldo, contagem, diferença, quebra, quebra 12
  meses, os dois limites, índice relativo e índice relativo máximo).
  Restaurado o limite padrão (20%) depois, confirmando que o item some do
  alerta de novo (-10% não excede 20%).
- Card "Histórico de contagem de estoque" (com um período de 1 ano no
  filtro) mostrando as 4 contagens do item com as datas certas.

Toda a simulação (sessões, linhas de contagem, e o ajuste real de estoque
de -1 que o fechamento da contagem de teste gerou de verdade via a RPC
existente) foi apagada do banco local depois, com o saldo real do item
confirmado restaurado ao valor de antes do teste. `npm run lint`/
`npm run build` limpos, com a rota `/dashboard/quebra-estoque` aparecendo
na árvore de build.

### 15.6 Testado

Simulação direta no banco local, sob as regras de segurança reais (RLS) de
cada papel: ficha técnica com ingrediente real do cardápio compartilhado
entre 2 pratos diferentes (soma correta, 1 única linha de movimento);
giro semanal e ponto calculado conferidos à mão contra a fórmula; compra
insuficiente resolvendo pedidos pendentes mesmo assim, com a sugestão
calculada continuando a refletir a diferença sozinha; pedidos
individuais se somando sem mesclar; edição e cancelamento individual
bloqueados entre pessoas diferentes (RLS); cancelamento em massa do admin
afetando pedidos de mais de uma pessoa ao mesmo tempo. Sessão real
(cookie de autenticação) dos três papéis confirmando acesso correto às
telas novas e bloqueio cruzado entre papéis. `npm run lint`/`npm run
build` limpos.
