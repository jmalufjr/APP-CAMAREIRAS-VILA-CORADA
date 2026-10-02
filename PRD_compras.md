# PRD — Módulo de Compras, Despesas e Controle de Estoque

> Documento de estudo e proposta, preparado antes de qualquer implementação
> — nenhuma linha de código foi escrita ainda. Segue o mesmo formato dos
> demais `PRD_*.md` deste projeto: um registro vivo que vai sendo
> atualizado conforme decisões forem tomadas e a implementação avançar.
> **Aguardando decisão do proprietário antes de prosseguir.**

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

Aguardando sua decisão para prosseguir — seja aprovando este plano como
está, pedindo ajustes, ou escolhendo alguma das alternativas da seção 12.
