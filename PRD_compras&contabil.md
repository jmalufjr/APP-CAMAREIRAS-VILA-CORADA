# PRD — Módulo de Compras, Despesas, Controle de Estoque e Contábil

> Documento de estudo e proposta, preparado antes de qualquer implementação.
> Segue o mesmo formato dos demais `PRD_*.md` deste projeto: um registro
> vivo que vai sendo atualizado conforme decisões forem tomadas e a
> implementação avançar. **Plano aprovado e implementado (seções 1-14, e a
> segunda leva na seção 15) na branch `feature/compras` — testado
> localmente, aguardando aprovação pra merge em `main`/produção.** As
> seções 16-21 documentam mais seis levas feitas depois dessa aprovação,
> ainda na mesma branch. A seção 22 registra um novo documento do
> proprietário (15/10/2026) pedindo uma reformulação profunda deste módulo
> num sistema contábil formal de partidas dobradas — **recebido e ainda em
> fase de esclarecimento de dúvidas, nenhuma parte dele foi implementada
> ainda** (ver seção 22 para o estado exato da consulta).
>
> Este arquivo mudou de nome de `PRD_compras.md` para
> `PRD_compras&contabil.md` em 15/10/2026, a pedido do proprietário, pra
> refletir esse novo escopo contábil somado ao que já existia.

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

## 19. Sexta leva — dupla natureza de consumo (prato/ingrediente), categoria de gasto N-pra-N e identificação de item por IA

> Pedido grande, em texto corrido, do proprietário — mudança de concepção
> do módulo de estoque, não um ajuste pontual. Antes de implementar,
> investiguei a fundo o que já existia (ficha técnica, categoria única
> por item, mecanismo de leitura de nota por IA) e levei 4 pontos
> críticos pro proprietário decidir antes de tocar em código — todos
> aceitos na opção recomendada. Raciocínio completo na conversa; resumo
> de cada decisão abaixo.

### 19.1 As 4 decisões confirmadas antes de implementar

1. **"Lista de pratos" reaproveita o cardápio já existente** (poolbar
   da piscina/frigobar), em vez de ser um catálogo novo e desconectado.
   Motivo decisivo: o app já tinha um gatilho real
   (`deduct_inventory_on_bill_payment`) que desconta estoque sozinho
   quando a conta é paga, **só olhando pra `poolbar_items`/`minibar_items`**
   — um catálogo de "pratos" separado não dispararia esse desconto quando
   o hóspede pedisse de verdade, a menos que fosse ligado de volta ao
   cardápio (uma 3ª camada redundante). A tela "Lista de pratos: natureza
   do consumo" é uma gestão nova da ficha técnica (`inventory_item_recipes`)
   a partir do PRATO, não um cadastro novo.
2. **Pratos/drinks sem receita real conhecida ficam sem ficha técnica**,
   pro proprietário preencher depois — só existia 1 ficha técnica real no
   banco inteiro (ovo → Americano). Inventar proporção de receita (quanto
   camarão, quanta farinha) arriscaria descontar estoque errado sem
   ninguém notar.
3. **Categoria de gasto deixa de ser um campo da compra inteira** e passa
   a existir só por item — o relatório financeiro "por categoria" muda de
   forma (soma pelos itens, não mais pela despesa inteira).
4. **Identificação do item comprado por IA**: confirmado viável
   reaproveitar a mesma chamada que já lê a nota fiscal (`receipt-ai.ts`),
   sem infraestrutura nova.

### 19.2 Modelo de dados

Migration `061_pratos_categorias_multiplas.sql`:

- **Categoria de gasto virou N-pra-N**: nova tabela
  `inventory_item_categories` (inventory_item_id, category_id) substitui
  o antigo `inventory_items.category_id` (coluna única, removida depois
  do backfill) — um item como "Coca-Cola Zero lata" pode estar em "Bar da
  piscina" **e** "Frigobar" ao mesmo tempo. RLS mesmo padrão de
  `inventory_items` (select autenticado, insert/delete admin+manutenção —
  sem update, não há campo pra mudar numa linha de ligação). A view
  `inventory_count_line_history` (Parte 18) foi reescrita pra ler a nova
  tabela (um item com 2+ categorias mostra as duas juntas, separadas por
  "/") — precisou ser trocada **antes** de a coluna antiga ser apagada,
  já que uma view não deixa derrubar uma coluna que ela ainda lê.
- **Nova categoria "Frigobar"** (`is_inventory_category = true`) — não
  existia nenhuma categoria própria pra frigobar até aqui, só "Bar da
  piscina"; o próprio pedido do proprietário já citava "frigobar" como
  categoria esperada de um item.
- **Ficha técnica, dois campos explícitos em vez de um número só**:
  `inventory_item_recipes.portions_per_order` (ambíguo) virou
  `portions_count` (quantidade de porções do ingrediente que vão no
  prato) × `amount_per_portion` (quanto, na unidade PRÓPRIA do
  ingrediente — kg/L/un, já cadastrada no item — tem 1 porção). Total
  consumido por pedido = `portions_count * amount_per_portion`. A ficha
  técnica real já existente (ovo → Americano, 0.963) foi migrada
  preservando o total (`portions_count = 1, amount_per_portion = 0.963`)
  — nunca zera um dado já calculado, mesma regra geral do projeto. O
  gatilho `deduct_inventory_on_bill_payment` foi atualizado pra multiplicar
  pelos dois campos novos.
- **`expenses.category_id` removido** — a despesa em si não tem mais
  categoria própria (ver 19.1, item 3).
- `portion_weight_kg` (em `inventory_items`, conversão "porção → kg" pra
  lista de compras) **não foi tocado** — é um conceito diferente do novo
  `amount_per_portion` (que é por RECEITA, não por item), apesar do nome
  parecido; confirmado lendo o uso real em `purchase-list.ts` antes de
  decidir não misturar os dois.

Migration `062_itens_consumo_direto.sql` — dado real, não um palpite:
6 itens de estoque "consumo autônomo" direto (Água com gás, Água sem
gás, Água de Coco, Café expresso, Cerveja, Refrigerante — os produtos do
cardápio vendidos prontos, sem composição, diferente dos pratos/drinks
preparados) com ficha técnica 1-pra-1 (`portions_count=1,
amount_per_portion=1`) pro(s) produto(s) vendável(is) correspondente(s)
— **não é uma estimativa**: 1 unidade vendida = 1 unidade consumida do
próprio item, por definição. 5 deles existem tanto no frigobar quanto no
bar da piscina (ficha técnica dupla, uma pra cada canal, mesmo
ingrediente); "Água de Coco" só existe no bar da piscina. Os demais
pratos/drinks preparados (10 petiscos + 5 drinks misturados + Campari +
Gim Tônica) ficaram **sem** ficha técnica — natureza de consumo = só
"consumo autônomo" por ora, até o proprietário preencher a receita real.

### 19.3 "Natureza de consumo" não é um campo — é derivada

Não existe uma coluna "natureza_consumo" nem um enum: um item é sempre
"consumo autônomo" (baixa manual, ou venda direta se ele próprio for
vendido no bar/frigobar); se tiver 1+ fichas técnicas em
`inventory_item_recipes`, é **também** consumido indiretamente por cada
prato ligado. A UI mostra isso só pela presença/ausência dos vínculos —
sem campo redundante pra manter sincronizado.

### 19.4 Nova tela "Lista de pratos: natureza do consumo"

`/compras/pratos`, novo item do menu de "Estoque" (ver `src/app/(admin)/compras/page.tsx`),
logo abaixo de "Categorias de gasto" (renomeada de "Categorias de
despesa" — ver 19.6) e acima de "Grupos de giro", exatamente como pedido.
Lista TODOS os itens de `poolbar_items` (agrupados em "Petiscos"/"Bebidas")
e `minibar_items` ("Frigobar") — não um catálogo novo — cada um mostrando
sua ficha técnica atual (ingrediente, porções × quantidade/porção = total)
com edição/remoção in-line, e um seletor pra adicionar um novo ingrediente
(escolhido entre os itens de estoque já cadastrados). Pratos sem nenhuma
ficha técnica mostram "ainda sem receita cadastrada" em vez de uma lista
vazia sem explicação.
`src/lib/actions/inventory-items.ts` ganhou `getDishesWithIngredients()`
(pivota a MESMA tabela `inventory_item_recipes` a partir do prato, não do
ingrediente) e `updateInventoryItemRecipeQuantities` (edição in-line das
quantidades, sem precisar apagar e recriar o vínculo).

### 19.5 "Itens de estoque" — categoria múltipla e ficha técnica com 2 campos

- `inventory-item-form-dialog.tsx`: o seletor único de categoria virou
  uma grade de checkboxes (mesmo padrão não-controlado já usado em
  "Suítes que usam este item", `checklist-items-panel.tsx` — `name`/`value`/
  `defaultChecked` num `<form>` nativo, lido no servidor via
  `formData.getAll("category_ids")`) — exige pelo menos 1 marcada.
- `inventory-items-panel.tsx`: mostra `category_names.join(" / ")` em vez
  de uma categoria só.
- `inventory-item-recipes-section.tsx` (ficha técnica vista do
  ingrediente, dentro do card do item): dois campos numéricos (porções ×
  quantidade/porção, na unidade do item) em vez de um só.

### 19.6 "Lançar Compra" — categoria só por item, e identificação por IA

- **Campo "Categoria" saiu do 2º card (cabeçalho da compra)** —
  confirmado com o proprietário que o relatório financeiro "por
  categoria" mudaria de forma (19.1, item 3). "Categoria do novo item"
  (dentro do bloco "Criar novo item de estoque", já existia desde a Parte
  16) virou uma grade de checkboxes (controlada via `onCheckedChange`,
  diferente do form de "Itens de estoque" porque aqui cada linha de item
  tem seu próprio estado React dinâmico, não um form nativo único).
- `getExpenseSummaryByCategory` (Histórico) reescrita: antes somava
  `expenses.total_amount` por `expenses.category_id`; agora soma
  `expense_items.subtotal` por categoria do ITEM vinculado — um item em 2
  categorias soma o próprio subtotal nas duas. Item sem vínculo de
  estoque, ou despesa sem item nenhum (só valor total manual), cai em
  "Sem categoria" (nunca desaparece da soma, só perde a categorização).
  `getExpenses`/`ExpenseListRow.category_name` passou a mostrar as
  categorias de TODOS os itens daquela despesa, juntas.
- **Identificação do item por IA** (`receipt-ai.ts`): o mesmo prompt que
  já lia a nota passou a receber, no fim da instrução, uma lista numerada
  dos itens já cadastrados, e a devolver `matched_catalog_index` (o
  número da linha, não um UUID — token curto, bem menos sujeito a erro de
  transcrição do modelo do que pedir pra ele ecoar um id de volta) por
  item comprado, convertido pro id real em JavaScript depois. Instrução
  explícita no prompt pra reconhecer variação de descrição (marca,
  abreviação) como o mesmo produto — ex.: "água mineral s/gás Indaiá" =
  "Água mineral sem gás" já cadastrada — mas só quando tiver confiança
  real, nunca arriscando juntar produtos diferentes. Em
  `expense-form.tsx`, o resultado da IA tem prioridade sobre o casamento
  por nome exato já existente (que continua como reforço pros casos sem
  match da IA). `nfce_url` também passou a ser extraído pela IA (campo
  novo no JSON do prompt) e pré-preenchido no formulário, igual aos
  outros campos já lidos automaticamente.
- Renomeação "categoria de despesa" → "categoria de gasto" em todo texto
  visível (3 lugares: menu de "Estoque", título de "Categorias de gasto",
  placeholder do campo de nova categoria) — identificadores internos
  (`expense_categories`, `category_id` como nome de coluna onde ainda
  existe) não mudaram, mesma convenção já usada pra "Quarto" → "Suíte"
  (Parte 12 do app principal).

### 19.7 Testado

Simulado diretamente no banco local (Docker) e via sessão autenticada
real (`next dev` local):

- Migrations `061`/`062` aplicadas com sucesso; dados confirmados direto
  no Postgres: os 6 itens "consumo autônomo" com as categorias certas
  (5 em "Bar da piscina / Frigobar", "Água de Coco" só em "Bar da
  piscina") e 11 fichas técnicas 1-pra-1 (5 × 2 canais + Água de Coco + a
  ficha técnica real do ovo preservada com o mesmo total de antes).
- **Gatilho de baixa automática testado com dado real, não só ficha
  técnica sintética**: lançado 3 "Refrigerante" no frigobar de uma conta
  de teste, marcada como paga — confirmado um `inventory_movements` de
  -3 criado sozinho (igual já funcionava antes desta parte, agora
  passando pelos dois campos novos) e o saldo do item caindo de acordo;
  tudo desfeito depois (movimento apagado, linha de frigobar removida,
  conta devolvida pro status original).
- `createInventoryItem` com 2 categorias ao mesmo tempo: confirmado
  `category_ids`/`category_names` corretos na leitura de volta.
- `addInventoryItemRecipe`/`updateInventoryItemRecipeQuantities`/
  `removeInventoryItemRecipe` chamados a partir da visão do PRATO (não do
  ingrediente) — ligar, editar quantidade e remover um ingrediente de
  "Bolinho de Bacalhau (10un)" com um item de teste, cada etapa conferida
  lendo `getDishesWithIngredients()` de volta.
- Telas via sessão real: `/compras/pratos` mostra as 3 seções
  (Petiscos/Bebidas/Frigobar) com "Americano" mostrando sua receita real
  e os demais "ainda sem receita cadastrada"; `/compras/nova` sem o campo
  "Categoria" no cabeçalho (confirmado por ausência total da palavra
  "Categoria" na página renderizada antes de qualquer item ser
  adicionado); `/compras/categorias` com o título "Categorias de gasto".
- **Não testado com uma chamada real de IA** (ANTHROPIC_API_KEY está
  configurada no ambiente local, mas fabricar uma imagem/PDF de nota
  fiscal de teste convincente ficou fora do orçamento desta leva) — a
  lógica de conversão índice→id foi conferida por leitura cuidadosa do
  código (índice 1-based na lista mostrada à IA, convertido de volta pra
  posição 0-based do array antes de ler o id) em vez de teste funcional
  ponta a ponta; o mecanismo de chamada à IA em si (imagem/PDF → JSON) já
  era código existente, não alterado por esta parte — vale validar na
  prática assim que o proprietário testar com uma nota real.
- `npm run lint`/`npm run build` limpos, com `/compras/pratos` aparecendo
  na árvore de build. Rotas de API temporárias usadas no teste
  (`/api/test-pratos`) removidas depois.

## 20. Sétima leva — módulo "Custos e Despesas"

> Pedido em texto corrido, pedindo estudo do setor hoteleiro antes de
> implementar ("aguarde a minha decisão"). Pesquisei o padrão mundial do
> setor (USALI — Sistema Uniforme de Contas pra Indústria Hoteleira) e
> trouxe uma proposta com pontos críticos pro proprietário decidir, em
> duas rodadas (a segunda ajustando o rateio de custos fixos pra 3-4
> centros de custo, com percentuais específicos dados pelo proprietário).
> Só depois disso foi implementado.

### 20.1 O que o estudo do setor trouxe

USALI separa custos **diretos** (ligados a um serviço/produto específico,
ex.: ficha técnica de um prato) de custos **indiretos/fixos** (água, luz,
limpeza, pessoal — que não têm uma regra natural de alocação) — e a
prática mundial recomendada é **não** forçar os indiretos pra dentro do
custo de cada prato/diária sem uma regra explícita, justamente por ser
sempre uma estimativa, nunca um valor exato. Confirmado com o
proprietário: o modelo dele (3 tipos de gasto — itens de estoque
variáveis, ativo permanente sem natureza de custo, despesas operacionais
fixas) já era, na prática, uma versão simplificada e correta disso — a
pesquisa só refinou 3 pontos (ver 20.2) e validou o resto.

### 20.2 Decisões confirmadas com o proprietário antes de implementar

1. **Custo médio do item no mês = média ponderada** (soma gasta ÷ soma
   comprada), não a média simples do preço unitário por compra que o
   proprietário tinha descrito originalmente — é o padrão contábil
   ("custo médio ponderado"), mais fiel ao gasto real e mais simples de
   calcular.
2. **Lacuna real encontrada e corrigida**: despesas sem item de estoque
   vinculado (salário, honorários, conta de serviço avulsa) ficariam sem
   categoria no Demonstrativo, porque desde a Parte 19 a categoria só
   existia no item de estoque. Corrigido com uma categoria também na
   PRÓPRIA linha de despesa (usada só quando não há item vinculado).
3. **Rateio dos custos fixos entre centros de custo**: numa primeira
   proposta (2 centros, Hospedagem/Bar-Frigobar), o proprietário pediu
   pra reformular com **3 centros de custo de verdade** (Hospedagem,
   Café da Manhã, Serviço de Bar) e um **4º só pra "Luz"** (Frigobar,
   pelas geladeiras em cada quarto) — com os percentuais exatos abaixo,
   dados diretamente pelo proprietário, não pesquisados.
4. **Natureza de custo por categoria, editável**: toda categoria de gasto
   ganhou um campo "natureza" (custo direto / custo fixo / não é custo) e,
   quando fixa, os 4 percentuais de rateio — tudo editável pelo
   proprietário, pra que o Demonstrativo/Custos se atualizem sozinhos ao
   editar uma categoria, sem precisar programar nada de novo.

### 20.3 Tabela final de rateio implementada

| Categoria (custo fixo) | Hospedagem | Café da manhã | Serviço de bar | Frigobar |
|---|---|---|---|---|
| Água | 40% | 30% | 30% | 0% |
| Luz | 80% | 10% | 5% | 5% |
| Gás | 0% | 50% | 50% | 0% |
| Internet | 80% | 10% | 10% | 0% |
| Limpeza, Enxoval, Manutenção predial, Serviços profissionais, Impostos e taxas, Outras | 70% | 15% | 15% | 0% |
| Piscina, Jardim | 100% | 0% | 0% | 0% |
| Pessoal (salários/encargos) | 50% | 30% | 20% | 0% |

"Consumo (luz/água/internet)" (1 categoria só) virou 4 categorias
separadas — reaproveitando a linha existente como "Água" (preserva
qualquer item/despesa já vinculada) e criando "Luz"/"Gás"/"Internet"
novas. Café da manhã/Bar da piscina/Frigobar continuam como categorias
de **custo direto** (já calculadas por ficha técnica ou rateio por
hóspede, não usam os 4 percentuais) e Ativos permanentes como **não é
custo** (nunca entra em nenhum cálculo).

### 20.4 Modelo de dados

Migration `063_custos_e_despesas.sql`:

- `expense_categories` ganhou `cost_nature` (enum `custo_direto` /
  `custo_fixo` / `nao_custo`) e os 4 `alloc_*_pct` (hospedagem/café da
  manhã/bar/frigobar) — constraint no banco garantindo que os 4 somem
  exatamente 100 quando `cost_nature = 'custo_fixo'` (pra "custo_direto"/
  "nao_custo" os percentuais existem na coluna mas não são usados por
  nenhum cálculo).
- `expense_items` ganhou `category_id` (nullable) — usado só quando a
  linha NÃO tem `inventory_item_id` (ver 20.2, item 2). Quando tem item
  vinculado, a categoria continua vindo das categorias do item
  (`inventory_item_categories`, Parte 19), sem mudança.
- `inventory_items` ganhou `cost_report_group` (texto nullable) — permite
  marcar, por exemplo, "Frutas e ovos" em vários itens pra que apareçam
  somados como 1 linha só no detalhamento do custo do café da manhã por
  item (pedido explícito do proprietário, por não haver controle fino de
  estoque sobre eles).

### 20.5 Cálculos implementados (`src/lib/cost-accounting.ts` + `src/lib/actions/cost-accounting.ts`)

- **Custo médio ponderado de um item no período**: `weightedAverageUnitCost`
  — soma de `subtotal` ÷ soma de `quantity` de todas as compras do item no
  período; `null` (nunca 0) quando não houve nenhuma compra.
- **Custo de 1 porção de um prato**: soma, por ingrediente da ficha
  técnica (Parte 19), de `portions_count × amount_per_portion × custo
  médio do ingrediente no período`.
- **Custo do café da manhã**: gasto total da categoria "Café da manhã" no
  período ÷ hóspedes-noite (soma de `daily_breakfast_room_assignments.guest_count`
  no período) = custo por hóspede; detalhamento por item (agrupando por
  `cost_report_group` quando definido).
- **Diárias ocupadas no período**: soma de
  `daily_breakfast_settings.eligible_suites_count`, com o mesmo fallback
  já usado pela comissão de café da manhã (Parte 27) pra datas sem esse
  valor — reaproveitado, não reinventado.
- **Centros de custo**: cada categoria de custo FIXO é rateada pelos seus
  4 percentuais; Café da manhã/Bar da piscina/Frigobar (custo direto) vão
  inteiros pro seu próprio centro. "Hospedagem" soma também o total de
  "Café da manhã" por dentro — embutido na diária, nunca cobrado à parte
  do hóspede — mas "Café da manhã" continua aparecendo como linha própria
  no relatório (não é um erro de duplicação, são dois recortes do mesmo
  gasto: quanto custa rodar o café, e quanto custa a diária incluindo o
  café).
- **Custo médio por diária ocupada**: custo total de "Hospedagem" ÷
  diárias ocupadas no período.
- **Demonstrativo de Despesas**: gasto por categoria, mês a mês — nunca
  persiste nada, só lê a categorização atual de cada item/linha a cada
  carregamento, por isso reagrupa sozinho quando uma categoria é editada
  (exatamente como pedido).
- **Convenção reaproveitada da Parte 19**: um item/linha em 2+ categorias
  soma o próprio valor em cada uma (nunca divide) — mesma regra já usada
  em `getExpenseSummaryByCategory`, mantida aqui por consistência entre
  os relatórios.

### 20.6 Telas

Novo menu principal **"Custos e Despesas"** (entre "Ativo Permanente" e
"Listas"), com 3 submenus:
- **"Categorias de gasto"** — mudou de lugar (saiu de dentro de
  "Estoque", que perdeu esse item de menu) — mesma tela de sempre, com um
  card novo por categoria: seletor de natureza de custo e, quando "custo
  fixo", os 4 steppers de rateio (±1%, mesmo padrão já usado em todo o
  projeto) com soma ao vivo (vermelha se ≠100%, botão "Salvar" desabilitado
  até fechar em 100%).
- **"Custos"** (`/custos-despesas/custos`) — filtro de período (mesmo
  padrão de/até do Histórico, extraído pra um componente compartilhado
  novo, `src/components/shared/date-range-filter.tsx`), 4 cards dos
  centros de custo, custo médio por diária ocupada, tabela de rateio por
  categoria (transparência total — mostra o gasto bruto e os 4 valores
  rateados de cada categoria), detalhamento do café da manhã por item, e
  tabela de custo por prato/produto do cardápio (mostra "sem receita
  cadastrada" pros pratos ainda sem ficha técnica, ver Parte 19).
- **"Demonstrativo de Despesas"** (`/custos-despesas/demonstrativo`) —
  tabela categoria × mês, com total por mês no rodapé.

### 20.7 "Lançar Compra" — fechando as duas lacunas de categorização

- Linha de item **sem** vínculo de estoque (nem existente, nem "criar
  novo") ganhou um seletor de categoria próprio, obrigatório pra salvar —
  cobre salário, conta de luz avulsa, honorários etc.
- **Segunda lacuna encontrada só ao testar**: uma despesa lançada **sem
  nenhum item** (só "Valor total") não gerava nenhuma linha em
  `expense_items` — ficava completamente invisível pro Demonstrativo e
  pros Custos, apesar de ser dinheiro real gasto. Corrigido: esse cenário
  também ganhou um seletor de categoria (ao lado do campo "Valor total"),
  e o envio do formulário sintetiza 1 linha representando o valor total
  inteiro, carregando essa categoria — sem mudar o que a tela mostra (o
  admin continua só vendo o campo "Valor total" simples).

### 20.8 Testado

Simulado diretamente no banco local (Docker) e via sessão autenticada
real (`next dev` local), com um cenário fabricado isolado ao dia de hoje
(pra não misturar com dado real de produção já presente no mês):
diária ocupada = 4, hóspedes-noite de café = 5, compra de "Café da manhã"
= R$20 (item vinculado), despesa de "Pessoal" = R$1.000 (linha sem item,
categoria direto na linha), despesa de "Luz" = R$100 (idem). Conferido
contra a conta manual, bateu exato em tudo:
- Hospedagem R$910,00 (= 500 de Pessoal + 80 de Luz + 330 de Café da
  manhã, este já incluindo o rateio de Pessoal/Luz pra café).
- Café da manhã R$330,00; Serviço de bar R$205,00; Frigobar R$5,00.
- Custo por diária ocupada R$227,50 (910 ÷ 4).
- Custo do café da manhã por hóspede R$4,00 (20 ÷ 5), com "PAO FRANCES
  TESTE" aparecendo certinho no detalhamento por item.
- Rateio de Pessoal (500/300/200/0) e de Luz (80/10/5/5) corretos na
  tabela de transparência.
- Demonstrativo de Despesas mostrando as 3 categorias com os valores
  certos e o total R$1.120,00 no rodapé.
- `updateExpenseCategoryCostSettings`: soma ≠100% rejeitada com erro
  claro; soma =100% salva corretamente; valor original da categoria
  restaurado depois do teste.
- `/compras/nova`: confirmado visualmente o seletor "Categoria de gasto"
  aparecendo junto do campo "Valor total" quando não há nenhum item
  lançado.
Todos os dados fabricados (despesas, item de teste, alocações de mesa,
configuração de café da manhã do dia) removidos do banco local depois.
`npm run lint`/`npm run build` limpos, com as 4 rotas novas
(`/custos-despesas`, `/categorias`, `/custos`, `/demonstrativo`)
aparecendo na árvore de build e `/compras/categorias` removida dela.
Rota de API temporária (`/api/test-custos`) removida depois do teste.

## 21. Oitava leva — Plano de Contas (Centro → Subcentro → Item de custo), substituindo "Categoria de gasto"

> Pedido em documento corrido, logo depois da seção 20 ter acabado de
> implementar "Categorias de gasto" — o proprietário trouxe uma proposta
> de reestruturação mais profunda: uma hierarquia contábil de 3 níveis
> (Centro de custo → Subcentro de custo → Item de custo), com o plano de
> contas completo já escrito por ele (4 centros, ~25 subcentros, ~176
> itens de custo, mais um plano de itens de ativo permanente com 3
> categorias e ~34 itens de catálogo). Analisei o documento, levantei
> riscos de quebra em funcionalidades já implementadas e fiz 4 perguntas
> de esclarecimento antes de implementar (ver abaixo) — só depois da
> decisão em cada uma, e de uma correção do próprio proprietário no plano
> de contas (adicionando "Honorários administrativos" e "Materias de
> limpeza" também em Café da manhã e Bar de piscina, que na primeira
> versão só apareciam em Hospedagem), é que a implementação começou.

### 21.1 Decisões tomadas antes de implementar

- **Itens de estoque e itens de custo são dois cadastros separados,
  ligados um ao outro** (`cost_items.inventory_item_id`, opcional) — o
  proprietário rejeitou minha recomendação inicial de mesclar os dois
  num cadastro só.
- **Subcentros com o mesmo nome em centros diferentes são linhas
  distintas no banco**, mesmo compartilhando o nome (ex.: "Gerais" existe
  uma vez por centro) — confirmado explicitamente. Compartilhamento de
  verdade só acontece no nível de ITEM de custo (um item ligado, por N-N,
  a mais de um subcentro distinto).
- **Contagem física física reorganizada por NOME de subcentro**, não por
  subcentro individual nem por categoria antiga — uma contagem de
  "Alimentos" junta automaticamente os subcentros "Alimentos" de Café da
  manhã e de Bar de piscina (mesmo nome, linhas diferentes) numa sessão
  só; subcentros com nome único continuam contados isoladamente. Essa
  regra generaliza o exemplo específico que o proprietário deu
  (Alimentos/Bebidas/Materiais de limpeza) pra qualquer nome repetido,
  sem precisar de uma lista especial no código.
- **Os itens "ovos"/"água de coco" já existentes no estoque real (ligados
  de verdade a uma ficha técnica e a compras reais) foram preservados
  exatamente como estavam**, mesmo o novo documento não marcar
  explicitamente o item "ovos" (uso geral de café da manhã) como "(E)" —
  tratados como duas coisas conceitualmente diferentes (ovo avulso pro
  café vs. o item de estoque fino já rastreado pro prato "Americano").
- **Uma mudança de regra nunca zera retroativamente dado real**: as 4
  despesas reais pré-existentes no banco (POLPA de fruta, OVO BRANCO)
  foram religadas aos itens de custo corretos do plano novo durante a
  migration, em vez de ficarem orfãs.

### 21.2 Schema (migrations `064`–`067`, espelhadas em `schema.sql`)

- `064_plano_de_contas.sql`: `cost_centers`, `cost_subcenters`,
  `cost_subcenter_centers` (N-N com `alloc_pct`), `cost_items` (com
  `inventory_item_id` opcional, único por item de estoque),
  `cost_item_subcenters` (N-N com `alloc_pct`), `fixed_asset_catalog_items`;
  `expense_items` ganha `cost_item_id`/`fixed_asset_id` (nunca os dois ao
  mesmo tempo, `check` explícito) substituindo `category_id`/
  `inventory_item_id`.
- `065_plano_de_contas_seed.sql`: todo o conteúdo do plano de contas
  (4 centros, 25 subcentros — contando as repetições de nome como linhas
  distintas —, 176 itens de custo, 81 itens de estoque reais criados/
  religados) com percentual igual entre quantos subcentros/centros cada
  item/subcentro participa (arredondamento sobrando pra primeira linha,
  pra sempre somar exatamente 100%); religa as 4+2 despesas reais
  pré-existentes.
- `066_plano_de_contas_limpeza.sql`: reescreve o trigger de baixa de
  estoque (`create_movement_from_expense_item`) pra resolver o item de
  estoque via `cost_items.inventory_item_id`; dropa
  `expense_items.inventory_item_id`/`category_id`; `inventory_count_sessions`
  troca `category_id` por `subcenter_group_name`; reescreve a view
  `inventory_count_line_history`; dropa `inventory_item_categories` e
  `expense_categories` inteiras; substitui as 13 categorias antigas de
  ativo permanente pelas 3 novas (Máquinas, Metais e louças banho,
  Aparelhos) + seed de `fixed_asset_catalog_items` (34 itens).
- `067_dias_de_folga_no_item.sql`: `inventory_items.coverage_days`
  (not null, padrão 7, backfill a partir do grupo de giro antigo quando
  havia um) substitui `inventory_turnover_groups`/`turnover_group_id`
  (tabela e coluna dropadas); view `inventory_purchase_suggestions`
  reescrita pra ler `coverage_days` direto do item (sem mais a exceção
  "sem grupo = sem sugestão").
- **Gap pré-existente corrigido de passagem**: `fixed_assets`/
  `asset_categories` nunca tinham sido adicionadas a `schema.sql` em
  nenhuma leva anterior (só existiam via migration) — adicionadas agora,
  já que `expense_items.fixed_asset_id` passa a referenciá-las.

### 21.3 Telas novas e reorganizadas

- **"Plano de Contas"**, novo item do submenu "Listas"
  (`/checklists/plano-de-contas`), com 2 sub-telas: **"Plano de itens de
  custo"** (3 seções editáveis — itens de custo com vínculo de
  subcentro(s)+%, subcentros com vínculo de centro(s)+%, centros — cada
  uma com diálogo de criar/editar, percentuais validados somando 100% no
  servidor) e **"Plano de itens de ativo permanente"** (categorias +
  catálogo de itens por categoria).
- **"Itens de estoque" → "Itens de estoque e ciclo de compras"**
  (`/compras/itens`): virou **só leitura** quanto à categorização (vem
  do Plano de Contas, agrupada por centro/subcentro) — o único campo
  editável continua sendo "Dias de folga" (substitui "Grupos de giro",
  tela e tabela removidas por completo).
- **"Lançar Compra" → "Lançar compras e despesas"**
  (`expense-form.tsx`, compartilhado entre admin e manutenção): cada
  linha agora aloca a um **item de custo** (existente, escolhido num
  seletor; ou novo, criado na hora com nome + "representa estoque?" +
  vínculo de subcentro(s)+%) **ou** a um **ativo permanente** (bem novo:
  categoria, item do catálogo opcional, marca, modelo, garantia, local,
  observações) — nunca os dois ao mesmo tempo, mesmo exclusividade do
  banco (`expense_items_one_target`). Editar uma despesa cujo item já
  está ligado a um bem existente **não cria um bem duplicado** — só
  atualiza o bem já existente (`existing_fixed_asset_id`), corrigindo de
  antemão um risco real que a primeira versão desta leva (ainda dentro
  da mesma implementação, antes do teste) introduziria.
- **"Lista de pratos: natureza do consumo" → "Ficha técnica de petiscos
  e drinks"** (`/compras/pratos`): frigobar saiu da lista de pratos por
  completo (só bar da piscina agora); os 7 itens de consumo direto
  (água com/sem gás, água de coco, café expresso, campari, cerveja,
  refrigerante) continuam fora, como já era; grupos renomeados
  "Petiscos (Bar da piscina)"/"Bebidas (Bar da piscina)" →
  "Petiscos"/"Drinks"; o seletor de ingrediente passou a oferecer só
  itens de custo (que representam estoque) ligados aos subcentros
  "Alimentos", "Bebidas" ou "Materiais de bar da piscina"
  (`getFichaTecnicaIngredientOptions`), não mais qualquer item de
  estoque ativo.
- **"Contagem de estoque"** (`/compras/contagem`): sessão por grupo de
  subcentros de mesmo nome (`startCountSession(subcenterGroupName)`),
  substituindo a antiga sessão por categoria; `getSubcenterGroupCountStatus`
  no lugar de `getCategoryCountStatus`; frequência de contagem editável
  por grupo (`updateSubcenterGroupCountFrequency`, atualiza todas as
  linhas daquele nome de uma vez).
- **"Ativo Permanente"** perdeu o submenu (2 telas) e virou direto o
  conteúdo antigo de "Relação de Ativo Permanente" — bens só nascem ao
  lançar uma compra em "Lançar compras e despesas"; categorias/catálogo
  são geridos só no Plano de Contas. CRUD manual antigo de bem individual
  (`createFixedAsset`/`updateFixedAsset`/`deleteFixedAsset`) removido por
  ficar sem nenhuma tela que o chamasse.
- **"Custos" e "Demonstrativo de Despesas"**: migrados do antigo modelo
  de 4 centros fixos no código (`hospedagem`/`cafe_manha`/`servico_bar`/
  `frigobar`) pra uma cascata dinâmica item→subcentro→centro, sempre
  pelos percentuais cadastrados (`getCostCentersSummaryForPeriod`,
  `getExpenseDemonstrativoForPeriod`) — os cards/tabelas agora iteram
  sobre `summary.centerTotals`/`breakdown`, em vez de 4 chaves fixas; o
  card "Hospedagem (+ café da manhã)" soma os dois centros via
  `hospedagemTotalIncludingBreakfast` (função pura, `src/lib/cost-accounting.ts`).
  "Custos e Despesas" perdeu o item de menu "Categorias de gasto"
  (tela e tabela dropadas por completo).
- **Histórico**: "Total por categoria" → "Total por centro de custo"
  (`ExpenseSummaryCards`), derivado de `getExpenseDemonstrativoForPeriod`
  agregado por centro (sem action nova — reaproveita a mesma fonte da
  tela de Demonstrativo).

### 21.4 Bugs reais encontrados e corrigidos na mesma leva

A troca de schema deixou 3 arquivos com queries Supabase apontando pra
tabelas/colunas **já dropadas** — como `.from("nome_da_tabela")` não é
checado pelo TypeScript, `npm run build` passou limpo mesmo assim; só
apareceriam em teste real, em runtime:

- `src/lib/actions/inventory-report.ts` (`getInventoryStockReport`/
  `getTopPurchasedItems`): ainda selecionava de `inventory_item_categories`/
  `expense_categories` (dropadas) e `expense_items.inventory_item_id`
  (coluna dropada) — corrigido pra resolver categoria via `cost_items`/
  `cost_item_subcenters`/`cost_subcenters` e o valor comprado via
  `expense_items.cost_item_id → cost_items.inventory_item_id`.
- `src/lib/actions/purchase-list.ts` (`getPurchaseList`): mesma
  categoria de bug, mais uma referência a `inventory_turnover_groups`
  (tabela dropada) — campo `turnover_group_name` removido do tipo
  `PurchaseListRow` por completo (substituído por `coverage_days`, que já
  vem certo da view); `purchase-list-table.tsx` ajustada.
- Reforça, com um caso novo, a lição já registrada em CLAUDE.md sobre
  auditar **todos** os pontos de leitura/escrita de uma tabela/coluna
  sempre que uma migration a remove ou renomeia — não só os pontos óbvios
  (Server Actions do próprio módulo que estava sendo reescrito), mas
  também relatórios/exports menos visíveis que dependem dela por fora.

### 21.5 Testado

- `npm run build`/`npm run lint` limpos em múltiplas rodadas, incluindo
  depois da correção dos 3 bugs de query acima (só detectáveis em
  runtime, nunca em build/lint).
- Dados do seed confirmados direto no Postgres local: 4 centros, 25
  subcentros, 176 itens de custo, 81 itens de estoque, 3 categorias de
  ativo permanente, 34 itens de catálogo.
- Todas as telas novas/alteradas varridas via sessão autenticada real
  (login local + cookie `sb-127-auth-token`, mesma técnica já padrão no
  projeto): `/checklists/plano-de-contas/custo`,
  `/checklists/plano-de-contas/ativo-permanente`, `/compras/itens`,
  `/compras/pratos`, `/compras/nova`, `/ativo-permanente`, `/compras`,
  `/custos-despesas/custos`, `/custos-despesas/demonstrativo`,
  `/historico`, `/compras/contagem` — todas 200, sem erro de servidor,
  com o conteúdo real (nomes de centro/subcentro, "Dias de folga" nos 81
  itens, "Petiscos"/"Drinks", "Máquinas"/"Aparelhos"/"Metais e louças
  banho") confirmado presente no HTML.
- Fluxo ponta a ponta via rota de API temporária (`/api/test-plano`,
  removida depois): criar centro→subcentro→item de custo com rateio 100%;
  lançar uma despesa ligada a esse item de custo e confirmar que
  `category_name` resolve certo via a cascata; criar um item de catálogo
  de ativo permanente e lançar a compra de um bem novo ligado a ele;
  editar "dias de folga" de um item real e revertê-lo. Confirmado
  também, por outra rota temporária (`/api/test-contagem`), que iniciar
  uma contagem do grupo "Alimentos" junta certinho os subcentros de Café
  da manhã e Bar de piscina numa sessão só (26 itens). Todas as linhas
  fabricadas (despesas, bem, item de catálogo, centro/subcentro/item de
  custo, sessão de contagem) removidas do banco local depois; as duas
  rotas de API temporárias deletadas do código.

## 22. PRD Contábil — recebido em 15/10/2026, consulta em andamento

> **Nenhuma linha de código foi alterada por causa desta seção ainda.**
> O proprietário enviou um documento pedindo a reformulação do módulo
> inteiro (compras, despesas, estoque, custos) num sistema contábil
> formal de partidas dobradas, com dois papéis de usuário novos
> ("gerente operacional" e "contador" — cujas telas ficam pra depois dos
> testes locais do proprietário, por instrução explícita dele), um menu
> "Módulo Contábil" próprio reunindo tudo, cadastro de fornecedores,
> contas a pagar, conceito de "hóspede avulso" sem suíte, e uma
> reformulação do cálculo de custo do café da manhã. O documento
> termina com uma instrução explícita e repetida: **não presumir
> solução pra nenhum ponto relevante ou ambíguo — sempre consultar
> antes, esperar a decisão, só depois implementar.** Por isso, antes de
> qualquer código, foi feito um levantamento completo de como cada parte
> relacionada já funciona hoje (Plano de Contas, contas de suíte,
> comandas, estoque, ativo permanente, ficha técnica, café da manhã,
> papéis de usuário, menu do admin, forma de pagamento, a integração já
> existente com o sistema financeiro) e uma lista de pontos de decisão
> foi levada ao proprietário em conversa — ainda sem resposta no momento
> em que esta seção foi escrita. Assim que as decisões chegarem, esta
> seção será reescrita com o plano definitivo, antes de qualquer
> implementação começar.

### 22.1 Texto integral do documento recebido

> Colado aqui sem edição nenhuma, exatamente como enviado pelo
> proprietário, pra nunca depender só do histórico da conversa com o
> Claude pra recuperar o pedido original.

PRD_contabil — Sistema Gerencial de Custos, Estoques e Movimentações Financeiras da Pousada
Status: Especificação funcional e técnica para implementação
1. Objetivo do produto
Desenvolver, dentro do web app CAMAREIRAS, um modulo separado chamado de "Módulo Contábil", utilizado por dois novos usuarios que chamaremos de "gerente operacional" e de "contador", para registrar compras, despesas, vendas do bar e do frigobar, movimentações de estoque e pagamentos/recebimentos operacionais.
Parte desse modulo já está sendo utilizado pelo usuário "Camareira", tais como o registro das vendas do bar através das comandas e do frigobar pelos checklist de serviços nas suites bem como pela movimentacao da conta individual de cada suite com o registro do fechamento das contas e do seu pagamento. Além disso, a baixa de itens de estoque tambem continuara sendo possivel de ser realizada pela camareira. Tambem o registro de compra e de baixa de estoque continuara sendo realizado tambem pelo funcionario de manutencao.
A motivação principal de implementar este novo módulo, que nada mais é que uma mudanca organizacional do que já tinha sido implementado no app, tem a ver com o fato de que não estava satisfatória a forma muito simplificada que estava sendo concebida para o registro das contas do estoque e de custos. Então a mudança principal agora será a de elaborar um sistema de registro com método contábil formal, de modo que a metodologia utilizada para o registro de compras, estoques, custos, ativos em geral, seja aquela comumente conhecida e aceita da ciência contábil e assim possa ser auditável e reportada utilizando os meios já conhecidos, com uma linguagem não somente já conhecida, mas que confira uniformidade e segurança no registro.
Porém, havera uma segunda mudança que é a de transformar essas funcionalidades em um módulo separado, de modo que o seu acesso seja feito por um caminho mais claro, em telas que reunam todas as funcionalidade de forma clara e centralizada, de modo que as telas do admin passem a ter um separação em módulos, com o objetivo de uma melhor organizacao frente ao crescente número de telas do admin. Por fim, criaremos um tipo de usuário que chamaremos de gerente operacional, que terá menos telas do que as do admin de modo a facilitar o trabalho do dia a dia com o aplicativo.
Assim, teremos um sistema que deve aplicar automaticamente partidas dobradas (método da ciência contábil), calcular custos por centro de custo e gerar demonstrativos gerenciais. Deve ser simples para o usuário operacional: ele registra o fato uma vez; o sistema cria os movimentos de estoque, caixa/banco, obrigações, receitas operacionais e lançamentos contábeis gerenciais correspondentes.
O sistema não substitui a escrituração do contador nem o sistema financeiro (que é um segundo web app que está sendo desenvolvido), porém ele deve produzir dados confiáveis e exportáveis para a consolidação gerencial e para a contabilidade.
Por fim, todas as alteração que serão implementadas com base neste documento devem ser analisadas juntamente com as funcionalidades e respectivos códigos para que seja aproveitado tudo o que já foi feito, que não colida com as instruções aqui passadas, mas também para que se evite duplicidade de códigos no sistema, de modo que aquilo que não for compatível deve ser substituido, porém o que for compatível e até mesmo complementar deve ser aproveitado. Ressaltando que o presente documento altera apenas a parte de registrar compras, despesas, vendas do bar e do frigobar, movimentações de estoque e pagamentos/recebimentos operacionais, não devendo alterar outras partes do aplicativo que não estejam ligadas a essas funcionalidades.
Toda vez que surgir qualquer questão que fuja das regras aqui estabelecidas, que envolva pontos relevantes ou lacunas que devam ser melhor explicitados, não presuma uma solução sem antes me consultar. O mesmo vale para pontos que possam implicar em providência contrária ao que está sendo determinado neste documento, ou seja, se houver alguma questão relevante, mesmo que ela possa implicar em quebrar alguma regra posta aqui neste documento, faça a consulta a mim mesmo assim, porém sempre aguarde minha decisão para fazer qualquer alteração. Toda vez que for fazer qualquer sugestão ou consulta, sempre seja didático e objetivo nas suas palavras e evite o uso de jargões técnicos.
1.1 Objetivos específicos
1. Registrar compras de produtos e materiais, com itens, quantidades, custos, fornecedor, destino e forma de pagamento.
2. Registrar despesas incorridas, pagas ou pendentes, separando competência e pagamento.
3. Controlar estoque por produto e local, incluindo entradas, consumo, vendas, transferências, perdas e inventários.
4. Registrar as receitas e vendas do bar da piscina e do frigobar, bem como os respectivos recebimentos no checkout.
5. Controlar o custo dos produtos vendidos (CMV) e o custo das receitas preparadas, como petiscos e drinks.
6. Apurar separadamente os custos de hospedagem, café da manhã, bar da piscina, frigobar e administração/áreas comuns.
7. Calcular o custo do café da manhã por hóspede/serviço servido.
8. Controlar contas operacionais de caixa, bancos e fornecedores, sem duplicar o controle das receitas de hospedagem, pois estas estão sendo controladas em outro aplicativo para o qual forneceremos nossos dados via api que já fornecemos para acessar os dados de vendas do bar e frigobar.
9. Produzir relatórios gerenciais, trilha de auditoria e exportações para o sistema financeiro e a contabilidade.
10. Permitir futura integração por API ou importação de arquivos com o sistema financeiro/de reservas.
1.2 Fora do escopo inicial
● Registrar ou cobrar a receita de hospedagem, administrar suas contas a receber ou realizar conciliação bancária em tempo real dessas receitas. Isso permanece no sistema financeiro, aquela para o qual já fornecemos api para obter dados de consumo de bar e frigobar (chamarei esse sistema de apenas "sistema financeiro".
● Substituir o sistema fiscal ou a escrituração contábil oficial.
● Emitir NFC-e/NFS-e ou apurar automaticamente tributos sem projeto fiscal específico.
● Executar pagamentos diretamente no banco.
● Fazer folha de pagamento completa. O sistema pode registrar custos/despesas de pessoal e obrigações agregadas.
● Gerenciar reservas, tarifas, disponibilidade de quartos ou o processo completo de check-in/check-out.
● Tratar venda a prazo ao público. Consumos do bar e frigobar podem ficar vinculados ao hóspede durante a estadia (conforme metodologia já implementada no presente aplicativo, ou seja, por meio do controle da conta da suite combinada com o nome do hóspede), mas devem ser liquidados no checkout, sem financiamento ou parcelamento pela pousada, conforme já estávamos considerando, agora explicitamente, no aplicativo.
2. Contexto operacional e regras fundamentais
2.1 Centros de custo obrigatórios
Passaremos a ter apenas os seguintes centros de custo que não podem ser fundidos nos relatórios, abandonando a ideia de subcentros de custo (ou seja, as contas estarao classificadas diretemente nesses centros de custo, devendo ser execluidos o subcentros de custo):
1. Hospedagem — custos de operação dos quartos e da hospedagem, exceto café da manhã, bar e frigobar.
2. Café da manhã — alimentos, bebidas e mão de obra/insumos associados ao serviço de café da manhã incluído na diária.
3. Bar da piscina — venda de petiscos, cervejas, refrigerantes, drinks e demais produtos servidos no bar da piscina.
4. Frigobar — bebidas armazenadas nos frigobares e vendidas aos hóspedes.
5. Administração e áreas comuns — custos administrativos e gastos compartilhados não atribuíveis diretamente a um dos quatro centros anteriores.
Centros adicionais poderão ser cadastrados no futuro, sem alterar o histórico já lançado.
2.2 Princípios de operação
● Uma compra ou despesa é digitada uma única vez.
● O sistema gera automaticamente lançamentos equilibrados por partidas dobradas.
● A compra de item estocável aumenta o estoque; não vira despesa imediatamente só por ter sido comprada.
● O custo é reconhecido quando o item é vendido, consumido, perdido ou baixado por outro motivo justificado.
● Cada lançamento deve indicar conta contábil gerencial, centro de custo quando aplicável, data de competência, data de caixa e origem.
● O sistema deve distinguir data de competência, data do documento e data de pagamento/recebimento.
● Não se deve apagar definitivamente lançamento confirmado. Correções devem ocorrer por estorno e novo lançamento, mantendo histórico.
● O sistema deve bloquear a confirmação se o total dos débitos não for igual ao total dos créditos.
● Relatórios gerenciais devem mostrar separadamente custos, despesas, receitas do bar/frigobar, posição de caixa/bancos, estoque e obrigações.
3. Usuários, perfis e permissões
3.1 Perfis novos
"Gerente operacional" - Registrar e consultar compras, despesas, vendas, consumos, pagamentos e recebimentos operacionais. - Consultar estoque, custos, inventários e relatórios operacionais. - Não pode apagar lançamentos confirmados nem alterar períodos fechados. - Pode solicitar correção por estorno, conforme permissões definidas.
"Contador" (consulta e exportação) - Novo tipo de usuário que terá acesso de leitura a lançamentos, documentos, balancete, relatórios e exportações. - Sem permissão para editar dados operacionais.
Observação: o administrador do sistema continua com todas as funcionalidades e correspondentes permissões já existentes, incluindo gerenciar usuários, permissões, cadastros, contas, centros de custo, regras de rateio e períodos.
3.2 Segurança
● Autenticação individual; não usar uma única conta compartilhada.
● Permissões por função.
● Encerrar sessões inativas e permitir revogação de acesso.
● Criptografar o tráfego com HTTPS.
● Guardar senhas com algoritmo próprio para hash seguro; nunca em texto puro.
● Registrar usuário, data/hora e ação em toda inclusão, edição, confirmação, estorno, exportação e fechamento.
● Fazer backup automático e testar restauração periodicamente.
● Não armazenar dados completos de cartão de pagamento.
4. Navegação e telas
Menu principal do "módulo contábil" para o admin do sistema:
1. Painel
2. Compras
3. Despesas
4. Vendas e consumos
5. Estoque
6. Pagamentos e recebimentos
7. Centros de custo
8. Relatórios
9. Cadastros
10. Integrações e exportações
11. Auditoria e configurações
Lembrando que o web app deve ser responsivo e priorizar o uso em celular, com formulários curtos, seletores, pesquisa e preenchimento automático. Deve funcionar nos navegadores modernos sem exigir instalação de aplicativo.
4.1 Tela de compras
Campos obrigatórios: - Data do documento e data de competência. - Fornecedor. - Número do documento, quando houver. - Um ou mais itens. - Para cada item: produto, quantidade, unidade, custo unitário, desconto, frete/outros custos atribuíveis, tributos recuperáveis/não recuperáveis quando informados, total e local de estoque. - Centro de custo/uso pretendido. - Forma de pagamento: banco/PIX, dinheiro, cartão corporativo ou a prazo com fornecedor. - Conta financeira usada, se pago. - Vencimento, se a prazo. - Observações.
Comportamento: - Calcular subtotais e total automaticamente. - Permitir ratear itens da mesma nota entre diferentes centros de custo e locais de estoque. - Produtos estocáveis entram no estoque. - Itens de consumo imediato não estocáveis podem ser lançados diretamente como custo/despesa, com centro de custo obrigatório. - Ao confirmar, gerar entrada de estoque e lançamento contábil gerencial. - Se a compra for paga no ato, reduzir caixa/banco; se não, criar obrigação com fornecedor. - Ao pagar obrigação existente, registrar apenas a liquidação, sem reconhecer a despesa/estoque novamente. - Impedir duplicidade provável por fornecedor, número de documento, data e valor, com possibilidade de revisão autorizada.
4.2 Tela de despesas
Campos: - Data de competência. - Data do documento. - Categoria/conta de despesa ou custo. - Centro de custo. - Fornecedor/prestador, se aplicável. - Descrição. - Valor. - Forma e conta de pagamento ou indicação de pendência. - Vencimento, se houver. - Documento/recibo anexado. - Regra de rateio, se compartilhada. - Observações.
Comportamento: - Despesa paga: reconhecer despesa/custo e saída de caixa/banco no mesmo evento, salvo se for pagamento de obrigação previamente reconhecida. - Despesa ainda não paga: reconhecer despesa/custo contra obrigação a pagar. - Pagamento posterior: baixar obrigação contra banco/caixa, sem lançar a despesa novamente. - Permitir dividir uma despesa entre centros de custo; a soma dos rateios deve ser igual ao valor total. - Para despesas recorrentes, permitir copiar lançamento anterior, sem gerar pagamentos automáticos.
4.3 Tela de vendas e consumos do bar/frigobar
A receita do bar e do frigobar é responsabilidade deste Sistema.
Campos por item vendido: - Data/hora. - Setor: bar da piscina ou frigobar. - Produto vendido ou item do cardápio. - Quantidade. - Preço de venda unitário. - Desconto, se autorizado. - Identificador do hóspede/quarto ou código de consumo, limitado ao necessário. - Status: aberto na conta de consumo, pago no checkout, cancelado ou estornado. - Forma de recebimento no checkout. - Usuário responsável e observação para cancelamentos.
Regras: - A venda deve registrar receita do bar/frigobar e custo da mercadoria/ingredientes, quando o evento for confirmado segundo a política de reconhecimento configurada. - Durante a estadia, o consumo fica em uma conta transitória de consumo a liquidar no checkout, vinculada ao hóspede/quarto (conforme já estávamos fazendo no sistema com a tela "consumo por suites", porém agora devemos registrar numa conta contábil transitória de modo que ela apareça nessa conta contábil seu saldo total e o saldo de cada subconta vinculada ao hospede/quarto, de modo que as telas existentes de comandas e de consumos por suites não devem ser alteradas, nem deve ser alterada qualquer sistemática que já haviamos estabelecido para essas telas) . Isso não significa conceder crédito comercial ou permitir saldo após o checkout. - No checkout, registrar o recebimento em dinheiro, PIX, cartão ou outra forma aceita, baixar a conta transitória e emitir/registrar comprovante conforme processo operacional. - O pagamento não deve gerar uma segunda receita: apenas liquida o valor já registrado na venda. - Se o consumo for cancelado antes da venda ser concluída, não reconhecer receita nem custo; se já tiver sido confirmado, fazer estorno rastreável. - O sistema deve permitir registrar consumo sem que esteja ligado a um hóspede ou suite, para registrar o consumo de um hóspede que já fechou sua conta e acabou retornando ou para um passante, de qualquer forma, nesse caso, o lançamento da comanda desse consumidor deve ser precedido da abertura da conta de "consumo avulso", com a identificação do consumidor (mínimo de nome do consumidor, mas campos para cpf, email, endereço e telefone), devendo esse consumo ser visualizado e registrado também na tela de consumo por suite, da mesma forma que se faz para o consumo ligado ao hospede/quarto nessa tela. - O bar e o frigobar devem ter estoque e relatórios separados.
4.4 Tela de estoque
Funções: - Consultar saldo por produto e local. - Consultar custo médio e valor total. - Registrar inventário físico. - Registrar perda, vencimento, quebra, consumo interno e ajuste, exigindo motivo. - Consultar histórico completo de entradas e saídas. - Alertar para estoque abaixo do mínimo, validade próxima e diferenças de inventário.
Local de estoque único: - Depósito/estoque central. Não há transferência entre locais pois os estoques são centralizados num único local.
5. Cadastro de produtos, receitas e unidades (as telas que hoje temos, de ficha técnica dos pratos por exemplo, devem ser adaptadas e integradas a estas novas regras)
5.1 Cadastro de produto
Campos: - Código interno/SKU. - Nome e descrição. - Categoria. - Tipo: revenda, ingrediente de receita, material de consumo, material de limpeza, embalagem ou outro. - Unidade-base: unidade, garrafa, litro, mililitro, quilo, grama, pacote etc. - Conversões de unidade (ex.: garrafa de 750 ml = 0,75 litro). - Controla estoque: sim/não. - Centro de custo padrão. - Locais de estoque permitidos. - Estoque mínimo. - Prazo de validade, quando aplicável. - Custo médio atual. - Ativo/inativo.
Não excluir produtos com histórico; desativá-los.
5.2 Receitas técnicas (fichas de preparo) ( a tela que existe hoje deve ser adaptada, bem como devem ser adaptadas as funcionalidades e sistemáticas existentes hoje, aproveitando-se o que for possível)
Para petiscos e drinks: - Nome do item de cardápio. - Centro de custo: bar da piscina. - Ingredientes e quantidades por porção. - Unidade-base e conversões. - Rendimento esperado. - Perdas de preparo estimadas, quando aplicável. - Custo calculado de cada ingrediente e custo total teórico por porção. - Versão e data de vigência da ficha. - Preço de venda atual, apenas para cálculo gerencial, sem alterar a política comercial.
Quando uma porção for vendida, o sistema baixa do estoque as quantidades previstas na ficha técnica. Se houver cancelamento após o preparo, deve permitir registrar se os ingredientes foram recuperados ou perdidos; a baixa não pode ser desfeita automaticamente sem verificar a ocorrência real.
Para cervejas, refrigerantes e outras bebidas vendidas por unidade fechada, a baixa é direta por unidade. Para drinks, a baixa deve ocorrer pelos ingredientes da ficha técnica.
5.3 Café da manhã
● Centro de custo exclusivo.
● Cadastro dos insumos e das compras destinadas ao café (basta deixar uma caixa de seleção no registro da compra, para cada item, se aquele item se destina ao café da manhã). Assim, embora o estoque esteja centralizado, o custo do café da manhã será calculado com base na compra de produtos para o cafe da manhã, porque se torna inviável que quem prepare o cafe da manha registre cada item consumido naquele momento, assim será necessário fazer um calculo indireto de custo de café da manhã considerando que todos os itens perecíveis (frutas) comprados para café da manha numa semana foram consumidos naquela semana, já os itens não perecíveis serão baixados manualmente e passa ser contabilizado seu custo médio no mês considerando proporcionalmente à quantidade consumida no mes (forneça uma regra matemática, sujeita a minha aprovação, para o cálculo do custo dos itens não perecíveis no cálculo do custo do café da manha, tais como requeijão, manteiga, leite, ovos, queijo, presunto, farinhas etc.). Assim, por conta dessa regra, poderemos ter o fechamento apenas com periodicidade mensal do custo do café da manha total e por hóspedes.
● Registro do número de cafés servidos por dia (o sistema sempre parte do número de hospedes registrados, porém deve haver a possibilidade de registrar número menor de café servidos para contemplar o fato de que determinados hóspedes não tomarem café, ou seja, o sistema deve tratar número de hóspedes e número de cafés servidos como grandezas distintas).
● Possibilidade de registrar desperdício e consumo interno separadamente.
● Mão de obra e custos indiretos podem ser atribuídos ao centro de custo por lançamento direto ou rateio.
6. Plano de contas gerencial e partidas dobradas
O plano de contas deve ser editável por administrador, mas começar com a estrutura abaixo. Cada conta deve ter código, nome, natureza, grupo, indicação de uso e status.
6.1 Ativo
● Caixa.
● Banco — uma conta por conta bancária real.
● Consumos de bar/frigobar a liquidar no checkout (conta transitória).
● Estoque central de bebidas.
● Estoque central de alimentos/ingredientes.
● Estoque de materiais de limpeza e amenidades.
● Outros estoques operacionais.
● Equipamentos e imobilizado.
● Depreciação acumulada.
6.2 Passivo
● Fornecedores a pagar.
● Despesas operacionais a pagar.
● Salários/encargos a pagar (valores agregados).
● Tributos e taxas a pagar (valores informados pelo responsável/contador).
● Outras obrigações operacionais.
6.3 Receitas operacionais deste sistema
● Receita de bebidas — bar da piscina.
● Receita de petiscos — bar da piscina.
● Receita de drinks — bar da piscina.
● Receita de bebidas — frigobar.
● Descontos concedidos no bar/frigobar (conta redutora de receita).
● Cancelamentos/devoluções do bar/frigobar (conta redutora de receita).
Não criar conta de receita de hospedagem neste sistema. A receita de hospedagem é gerenciada no sistema financeiro.
6.4 Custos diretos
● CMV de bebidas — bar da piscina.
● Custo de ingredientes/petiscos — bar da piscina.
● Custo de ingredientes/drinks — bar da piscina.
● CMV de bebidas — frigobar.
● Custo de alimentos e bebidas consumidos — café da manhã.
● Materiais de limpeza e amenidades — hospedagem.
● Lavanderia — hospedagem.
● Mão de obra operacional — centro correspondente.
● Perdas e desperdícios de estoque, por centro.
6.5 Despesas operacionais e indiretas
● Energia elétrica.
● Água e esgoto.
● Gás.
● Internet e telefonia.
● Manutenção.
● Jardinagem.
● Piscina.
● Limpeza de áreas comuns.
● Contabilidade e serviços profissionais.
● Material administrativo.
● Tarifas bancárias.
● Despesas financeiras.
● Despesas com pessoal administrativo.
● Outras despesas operacionais.
As contas podem ser ampliadas sem mudar os lançamentos históricos.
6.6 Regras de partidas dobradas
Todo evento confirmado gera um ou mais lançamentos, com débitos iguais aos créditos. O usuário operacional não precisa escolher débito e crédito.
Exemplos:
Compra de 24 cervejas a R$ 4,50, paga pelo banco - Débito: Estoque Central de bebidas: R$ 108,00. - Crédito: Banco: R$ 108,00. - Efeito imediato no resultado: zero; o custo é reconhecido quando vendido, consumido ou perdido.
Compra de alimentos a prazo - Débito: Estoque Central de alimentos/ingreditentes - Crédito: Fornecedores a pagar.
Pagamento posterior ao fornecedor - Débito: Fornecedores a pagar. - Crédito: Banco.
Venda de cerveja no bar - Débito: Consumos de bar a liquidar no checkout. - Crédito: Receita de bebidas — Bar da piscina. - Débito: CMV de bebidas — Bar da piscina. - Crédito: Estoque Central de bebidas.
Recebimento no checkout - Débito: Banco ou Caixa. - Crédito: Consumos de bar a liquidar no checkout. - Não reconhecer receita novamente.
Venda de drink - Débito: Consumos de bar a liquidar no checkout. - Crédito: Receita de drinks — Bar da piscina. - Débito: Custo de ingredientes/drinks — Bar da piscina. - Crédito: Estoque central de alimentos/ingredientes, consumidos conforme a ficha técnica.
Consumo de alimentos no café da manhã - Débito: Custo de alimentos e bebidas — Café da manhã. - Crédito: Estoques Central de alimentos/ingredientes.
Conta de energia paga no ato - Débito: Despesa de energia, distribuída entre os centros de custo aplicáveis. - Crédito: Banco.
Conta de energia recebida e ainda não paga - Débito: Despesa de energia, distribuída entre os centros. - Crédito: Despesas operacionais a pagar. - Quando pagar: débito em despesas a pagar e crédito em banco.
Perda de produto - Débito: Perdas de estoque no centro de custo responsável. - Crédito: Estoque Central do produto. - Exigir motivo, quantidade, custo e usuário responsável.
6.7 Regras de custo e valorização
● Usar custo médio ponderado móvel como método padrão de custo gerencial para itens estocáveis.
● Custo de aquisição pode incluir frete e outros custos diretamente atribuíveis; descontos reduzem o custo.
● Tributos recuperáveis não compõem o custo; tributos não recuperáveis podem compor, conforme classificação validada pelo contador.
● Registrar separadamente consumo vendido, consumo interno, desperdício e perda sempre que houver informação suficiente.
● Ajustes de inventário exigem motivo e autorização conforme perfil (somente admin e gerente operacional).
● Não permitir estoque negativo por padrão. Se for necessária exceção operacional, exigir permissão especial e destacar o relatório afetado.
● Para o CMV teórico, usar as fichas técnicas; para a apuração real do período, conciliar estoque inicial, compras, transferências, saídas e estoque final contado.
● Não somar duas vezes o mesmo custo: quando uma compra entra em estoque, ela não deve ser lançada também como despesa/custo até ocorrer a saída apropriada.
7. Cálculos e indicadores gerenciais
7.1 Estoque
Por produto e local:
Estoque final = Estoque inicial + Entradas + Transferências recebidas - Saídas - Transferências enviadas - Perdas ± Ajustes
O sistema deve armazenar cada movimento individual; o saldo é calculado a partir dos movimentos e pode ser materializado para melhorar o desempenho.
7.2 CMV de bebidas e mercadorias
CMV do período = Estoque inicial + Compras líquidas + Transferências de entrada - Transferências de saída - Estoque final
Para demonstrativos gerenciais, perdas identificadas devem ser apresentadas separadamente. A fórmula operacional deve garantir que uma transferência entre centros não seja tratada como compra ou custo consolidado da pousada.
7.3 Custo das fichas técnicas
Custo teórico da porção = soma (quantidade de cada ingrediente × custo unitário convertido) + custos diretos adicionais
Custo teórico vendido = quantidade de porções vendidas × custo teórico por porção
Comparar custo teórico com consumo real, destacando diferenças. A diferença não deve ser classificada automaticamente como fraude; pode decorrer de desperdício, variação de preparo, erro de cadastro, erro de inventário ou consumo não lançado.
7.4 Café da manhã por hóspede
Métricas obrigatórias: - Custo total dos alimentos/bebidas consumidos no café da manhã. - Número de cafés servidos. - Custo de insumos por café servido. - Custos diretos adicionais atribuídos ao centro. - Custo total do café da manhã por serviço servido. - Quantidade de desperdício, se registrada.
Fórmulas: - Custo de insumos por café = custo de insumos consumidos no período ÷ número de cafés servidos. - Custo total por café = custos totais atribuídos ao centro Café da manhã ÷ número de cafés servidos.
Definir claramente que o denominador é "cafés servidos" e não "hóspedes hospedados". Se cada hóspede recebe um café por dia, ambos podem coincidir, mas o sistema não deve assumir isso, na verdade o valor de cafés servidos deve ser inicialmente igualado ao número de hóspedes hospedados, com a possibilidade de que o gerente operacional e o admin alterem esse dado para permitir considerar que alguns hóspedes não tomaram café da manhã.
Para dias sem contagem, sinalizar dado ausente; não inventar denominador nem apresentar custo unitário como zero.
7.5 Hospedagem
Calcular, quando houver dados: - Custos do centro Hospedagem. - Diárias ocupadas importadas da Stays (já existente). - Custo por diária ocupada. - Custos de hospedagem excluindo café da manhã, bar e frigobar.
7.6 Bar e frigobar
Indicadores: - Receita bruta, descontos e receita líquida por setor. - CMV por setor. - Margem bruta gerencial = receita líquida − CMV. - Margem bruta percentual = margem bruta ÷ receita líquida, quando receita líquida maior que zero. - Quantidade vendida por item. - Consumo pendente de checkout. - Perdas e diferenças de inventário. - Custo teórico versus real para petiscos e drinks.
7.7 Despesas compartilhadas
Cada regra de rateio deve conter: - Despesa/categoria aplicável. - Centros participantes. - Critério: percentual fixo, valor, medidor/consumo ou outro critério documentado. - Percentual ou parâmetro de cálculo. - Data de vigência e histórico.
A soma dos percentuais deve ser 100%. Se o rateio for manual, o usuário deve informar os valores por centro e o sistema validar a soma. Não alterar períodos encerrados quando uma regra mudar; mudanças só valem a partir da data de vigência.
8. Integração entre os dois sistemas
8.1 Princípio
O presente Sistema é a fonte oficial de compras, despesas operacionais, vendas do bar/frigobar, estoques e custos dos centros sob sua responsabilidade.
O Sistema Financeiro é a fonte oficial das receitas de hospedagem, contas a receber da hospedagem e conciliação bancária real time dessas receitas.
O presente Sistema deve permitir integração via API autenticada (o que já existe parcialmente, pois atualmente somente são fornecidos dados de consumo) e, antes disso, exportação CSV/XLSX/JSON com esquema documentado.
8.2 Assim, os dados que o presente Sistema deve enviar ao Sistema Financeiro são inicialmente
● Receitas do bar e frigobar por período e centro.
● Recebimentos de checkout por forma de pagamento.
● Custos diretos e indiretos por centro.
● Despesas por categoria.
● Saldos de estoque e valores.
● CMV e margem bruta do bar/frigobar.
● Custo do café da manhã por serviço/hóspede.
● Metadados para conciliação, trilha de auditoria e referência dos lançamentos.
O envio deve incluir período, moeda, fuso horário, identificadores únicos e data de geração. O Sistema Financeiro deve poder rejeitar ou sinalizar dados duplicados/inconsistentes sem modificar os registros de origem no nosso presente Sistema.
8.3 Regras de consolidação
● Nunca somar duas vezes uma receita ou um custo.
● Os recebimentos do bar/frigobar são liquidação da conta transitória de consumo, não nova receita.
● Transferências entre centros não alteram o resultado consolidado da pousada.
● O custo do café da manhã é custo gerencial separado; não criar receita de café da manhã, pois está incluído na diária.
9. Relatórios e demonstrativos
Todos os relatórios devem aceitar filtro por período, centro de custo, conta, produto, fornecedor e situação, conforme aplicável. Devem permitir exportação CSV/XLSX e PDF.
9.1 Painel operacional
● Compras do mês.
● Despesas do mês.
● Saldo de caixa e bancos.
● Valor do estoque por local e total.
● Consumos de bar/frigobar pendentes de checkout.
● CMV e margem bruta do bar/frigobar.
● Custo por café da manhã servido.
● Alertas de estoque baixo, validade e inventário.
● Pendências de pagamento e documentos sem anexo.
9.2 Demonstrativo gerencial por centro de custo
Colunas mínimas: - Centro de custo. - Custos diretos. - Despesas diretas. - Rateios recebidos. - Total de custos/despesas. - Receita, apenas para os centros bar da piscina e frigobar. - Margem bruta, para bar e frigobar. - Indicadores unitários aplicáveis.
O centro Café da manhã deve mostrar custo total e custo por serviço/hóspede, sem receita separada. O centro Hospedagem deve mostrar os custos da hospedagem excluindo café da manhã, bar e frigobar.
9.3 Demonstrativo de resultado gerencial parcial
Mostrar: - Receita líquida do bar. - Receita líquida do frigobar. - CMV/custo de ingredientes por centro. - Margem bruta de bar e frigobar. - Custos de hospedagem. - Custos do café da manhã. - Despesas administrativas/áreas comuns. - Total de custos e despesas operacionais registrados neste sistema.
Identificar claramente que o relatório é parcial pois não mostra receita de hospedagem. Não rotular o resultado parcial como lucro líquido total da pousada.
9.4 Movimentação de estoque
● Saldo inicial.
● Compras.
● Transferências.
● Vendas/consumo.
● Perdas e ajustes.
● Saldo calculado.
● Saldo contado.
● Diferença em quantidade e valor.
● Custo médio unitário.
9.5 Livro de lançamentos e balancete gerencial
● Data, documento, histórico, conta debitada, conta creditada, valor, centro de custo, origem, usuário e estado do lançamento.
● Balancete com saldo inicial, débitos, créditos e saldo final.
● Validação automática de que débitos e créditos totais coincidem.
● Exportação para o contador, com mapeamento de contas configurável.
Palavras finais: busque as melhores práticas e mais modernas formas de apresentação de relatórios contábeis e gerenciais, prezando por um acesso fácil desses documentos em telas inteligentemente elaboradas. Aproveite as telas existentes naquilo que for possível, considerando que o módulo contábil passa a entrar no menu principal como um menu separado dos demais e que integra todas as funcionalidades aqui descritas, em submenus e subtelas, ainda que algumas delas sejam aproveitadas de outras telas existentes de forma espalhada no aplicativo, ou seja, todas as telas, mesmo as aproveitadas, devem ser centralizadas sob o menu modulo contábil. Implemente as mudanças acima com o melhor dos seus esforços, sempre pensando na identidade visual existente do sistema da pousada, porém melhorando a visibilidade e a ergonomia sempre que possível e sempre atendo à facilidade de uso e beleza.
Esse documento deve ser fundido com o PRD_compras, de modo que esse arquivo passa a se chamar PRD_compras&contabil, salvo no projeto e editado toda vez que houver mudanças aqui.
Sempre que houver alguma dúvida não invente, pergunte! Sempre que houver alguma questão relevante não decida, pergunte! Após todas as dúvidas e questões relevantes esclarecidas, implemente localmente, teste e prepare tudo para que eu possa testar localmente. As telas dos usuários novos, gerente operacional e contador, serão decididas apos esses meus testes locais.
Mãos à obra!

### 22.2 Levantamento do que já existe hoje (feito antes de perguntar)

Antes de formular qualquer pergunta, foi mapeado em detalhe como cada
parte relacionada do app funciona hoje — contas de suíte (`room_bills`),
comandas do bar, o Plano de Contas recém-criado (seção 21), estoque,
ativo permanente, ficha técnica, café da manhã, papéis de usuário, menu
do admin, forma de pagamento, e a integração já existente com o sistema
financeiro. Os pontos de maior atrito encontrados entre o que já existe
e o que este documento pede, todos levados ao proprietário antes de
qualquer implementação:

- **Hoje toda conta/comanda é obrigatoriamente ligada a uma suíte** — não
  existe, em lugar nenhum do banco de dados, a possibilidade de uma
  conta "sem quarto". O "consumo avulso" pedido na seção 4.3 é a mudança
  mais profunda tecnicamente de todo o documento por esbarrar nisso.
- **O Plano de Contas tem hoje uma camada de ~25 subcentros** entre os 4
  centros e os ~175 itens de custo (seção 21 deste arquivo) — construída
  há poucos dias, a pedido do próprio proprietário. Esse documento pede
  removê-la. Muitos itens de custo hoje (água, luz, salário das
  camareiras, honorários administrativos, materiais de limpeza) são
  **compartilhados entre vários subcentros de centros diferentes ao
  mesmo tempo**, com percentual — a remoção da camada precisa decidir o
  que acontece com esses itens compartilhados.
- **O saldo de estoque hoje só existe em quantidade, nunca em R$** — não
  há nenhum valor monetário de estoque guardado ou calculado de forma
  permanente. O "custo médio ponderado móvel" pedido pela seção 6.7 é
  uma peça inteiramente nova.
- **Fornecedor hoje é só texto livre**, em duas colunas independentes
  (uma em despesas, outra em ativo permanente) que nem batem entre si.
  Não existe cadastro de fornecedor, nem conceito de "conta a pagar"/
  compra a prazo — despesas hoje são só um fato do passado, sem estado
  "em aberto"/"paga".
- **O estoque de uma venda do bar só desce quando a conta da suíte é
  paga**, não no momento do pedido — às vezes dias depois. O documento
  mostra o lançamento contábil da venda acontecendo no momento da venda,
  não do pagamento.
- **O menu do admin hoje é uma lista única, sem nenhum conceito de
  "módulo"** — nenhuma base de código pra reaproveitar nesse sentido,
  seria uma estrutura de navegação nova.
- **O token usado pela integração externa hoje só expõe dados de conta
  de suíte** — nenhuma infraestrutura equivalente existe pra expor
  despesas/custos/estoque/CMV, que teria que ser construída do zero.

Com esse levantamento em mãos, uma lista de pontos de decisão foi levada
ao proprietário em conversa, em duas rodadas (4 perguntas de múltipla
escolha sobre os pontos mais estruturais, mais uma lista de perguntas
em texto livre sobre os pontos restantes). Todas as respostas chegaram
em 15/10/2026 — ver seção 22.3. A implementação, dividida em levas
(cada uma testada e documentada como uma nova seção própria, a partir
da seção 23), começa a partir daqui.

### 22.3 Decisões tomadas (15/10/2026)

1. **Ordem de implementação**: a proposta de 7 levas foi aceita —
   (1) plano de contas contábil + motor de partidas dobradas, sem
   mexer nas telas existentes; (2) compras/despesas reformuladas +
   fornecedores + contas a pagar; (3) estoque com saldo em R$; (4) a
   conta transitória por trás de comandas/consumo por suítes, incluindo
   a mudança de comportamento do item 3 abaixo; (5) café da manhã; (6)
   o menu "Módulo Contábil" + relatórios; (7) só a parte de exportação
   (CSV/XLSX/PDF) da integração — a API de verdade com o sistema
   financeiro fica de fora por enquanto (ver item 9).
2. **Subcentros removidos, mas o rateio por percentual entre centros
   continua existindo** — um item de custo que hoje é compartilhado
   entre vários centros (água, luz, salário das camareiras, honorários
   administrativos, materiais de limpeza) continua podendo ser, só que
   ligando direto no centro, sem a camada de subcentro no meio. Caiu
   junto a convenção de agrupar a contagem física por nome de
   subcentro (ex.: "Alimentos" de dois centros numa sessão só) — vai
   ser repensada na Leva 3 (estoque), já que a base que a sustentava
   deixa de existir.
3. **Hóspede avulso**: implementado como uma suíte virtual "Consumo
   avulso" (sem número de quarto de verdade) — reaproveita inteiramente
   a estrutura de conta/comanda já existente, permitindo várias contas
   abertas ao mesmo tempo (uma por avulso). Decidido na Leva 4.
4. **Baixa de estoque no momento da venda, não mais no pagamento** — o
   gatilho que hoje desconta o estoque só quando a conta da suíte é
   paga será desligado; o desconto passa a acontecer na hora da
   comanda/lançamento de frigobar. Confirmado explicitamente como uma
   mudança de comportamento, ciente de que é um sistema em produção.
   Consequência direta: a pergunta "os ingredientes foram recuperados
   ou perdidos?" ao cancelar uma comanda já com estoque baixado deixa
   de ser opcional — é necessária a partir de agora.
5. **Fornecedor**: ao criar o cadastro, os nomes já digitados em
   compras/ativo permanente serão unificados automaticamente
   (ignorando maiúscula/minúscula), pra não perder a referência das
   compras antigas.
6. **Duplicidade de nota** (mesmo fornecedor/número/data/valor): o
   sistema só avisa ("tem certeza?"), nunca bloqueia de verdade.
7. **Depreciação**: a conta contábil "Depreciação acumulada" é criada
   desde já, mas sem nenhum cálculo automático — fica disponível pra
   lançamento manual, ou pra uma regra própria numa fase futura, se um
   dia for decidido.
8. **Bancos**: começa com uma única conta genérica "Banco" — contas
   reais (uma por banco de verdade) ficam pra quando precisar.
9. **Café da manhã** — a fórmula proposta inicialmente (baseada em
   variação de estoque/contagem) foi descartada por complicar à toa;
   a lógica definitiva, me corrigindo de volta pro que o próprio
   documento original já descrevia: itens perecíveis = 100% do
   comprado numa semana vira custo daquela semana; itens não
   perecíveis = o sistema soma a quantidade **baixada manualmente**
   (mesma tela "Baixa de estoque" que já existe, sem nada novo) pra
   aquele item, destinada ao centro Café da manhã, durante o mês,
   multiplicada pelo custo médio do item naquele mês — sem nenhuma
   contagem física nem cálculo de variação de estoque envolvido. Cada
   item do café da manhã ganha um campo "é perecível?" editável
   (não uma lista fixa), com os exemplos do documento como sugestão
   inicial.
10. **"Cafés servidos"**: um número por dia (não por suíte), que nasce
    igual ao total de hóspedes hospedados e só pode ser editado pra
    baixo, nunca pra cima.
11. **Menu**: os 5 itens soltos hoje no menu principal do admin
    (Lançar Compra, Lista de compras, Estoque, Ativo Permanente, Custos
    e Despesas) saem de lá e passam a existir só dentro do novo menu
    "Módulo Contábil" (Leva 6).
12. **Forma de pagamento**: separada em dois conjuntos de opções
    distintos — um pro hóspede pagando a própria conta (já existente),
    outro pra pousada pagando um fornecedor (ganha "a prazo").
13. **Integração com o sistema financeiro**: só a parte de exportação
    (arquivos CSV/XLSX/PDF, pros relatórios da Leva 6) é implementada
    agora. A parte de API de verdade entre os dois sistemas fica de
    fora até o sistema financeiro passar por mudanças próprias e os
    dois lados decidirem juntos o que exatamente será consumido.

## 23. Módulo Contábil — Leva 1: plano de contas contábil + motor de partidas dobradas

> Primeira leva do PRD Contábil (seção 22), feita direto em `main`, pós
> Parte 21. Escopo: só a fundação (contas contábeis + lançamentos de
> partidas dobradas) — nenhuma tela de compras/estoque/bar que a
> camareira ou o funcionário de manutenção já usa foi alterada
> visualmente. Inclui também a remoção da camada de subcentros do
> Plano de Contas (item de custo passa a ligar direto no centro), que
> tecnicamente precisava acontecer antes de mais nada por estar
> entrelaçada com o resto do módulo de compras.

### 23.1 Plano de contas contábil (`ledger_accounts`)

Nova tabela, editável pelo admin, com 43 contas já cadastradas de
fábrica (migration `068_contabil_plano_de_contas_e_lancamentos.sql`),
seguindo a estrutura do documento original (seção 6): 9 contas de
Ativo (Caixa, Banco — uma conta genérica única por ora, decisão
explícita do proprietário, não uma por banco real —, Consumos a
liquidar, 4 Estoques, Equipamentos e imobilizado, Depreciação
acumulada — esta última sem nenhum cálculo automático, só a conta
cadastrada pra uso futuro, também decisão explícita), 5 de Passivo
(Fornecedores a pagar, Despesas a pagar, Salários/encargos a pagar,
Tributos a pagar, Outras obrigações), 6 de Receita e 9 de Custo (bar da
piscina, frigobar, café da manhã, hospedagem), 14 de Despesa. Cada
conta tem um `code` estável (nunca editável depois de criada — é o que
o código do app usa pra saber qual conta usar em cada lançamento
automático das próximas levas), um `display_code` cosmético opcional
("1.01") e `requires_cost_center` (se todo lançamento nessa conta
precisa também informar um centro de custo — true pra Receita/Custo/
Despesa, false pra contas de posição como Caixa/Banco/Fornecedores).
Tela nova: **"Plano de contas"**, dentro do novo menu **"Módulo
Contábil"** (`/contabil/plano-de-contas`).

### 23.2 Motor de partidas dobradas (`ledger_entries`/`ledger_entry_lines`)

Um "lançamento" (`ledger_entries`) é 1 evento econômico com 2+ linhas
de débito/crédito (`ledger_entry_lines`), cada linha numa conta
contábil e, quando a conta pede, também num centro de custo. Nunca
apagado depois de confirmado — uma correção sempre nasce como um novo
lançamento de estorno. Toda a gravação passa por 2 funções `security
definer` (mesmo padrão já estabelecido no projeto pra transição de
estado sensível):

- `post_ledger_entry(...)`: recebe a lista de linhas como JSON, confere
  que a soma dos débitos bate com a soma dos créditos (1 centavo de
  tolerância pra arredondamento) **antes** de gravar qualquer coisa —
  se não bater, nada é inserido, erro claro devolvido. Resolve cada
  linha pelo `account_code` estável, nunca por um id solto vindo do
  cliente.
- `reverse_ledger_entry(...)`: marca o lançamento original como
  `estornado` e cria um novo lançamento espelhado (débito↔crédito
  invertidos), preservando os dois no histórico. Bloqueia estornar o
  mesmo lançamento duas vezes.

Tela nova: **"Livro de lançamentos"** (`/contabil/lancamentos`) — lista
os lançamentos do período (filtro de data), com um formulário de
**lançamento manual** (linhas dinâmicas, conta + centro de custo
opcional + débito/crédito + valor, valida o balanceamento no próprio
navegador antes de enviar) e um botão "Estornar" por lançamento
confirmado. Serve, por ora, tanto pra lançamentos manuais quanto de
teste — as próximas levas (compras, vendas do bar, pagamentos) vão
chamar `post_ledger_entry` automaticamente por trás das próprias
Server Actions já existentes, sem o usuário precisar passar por este
formulário manual pra cada fato do dia a dia.

### 23.3 Remoção da camada de subcentros do Plano de Contas

Decisão tomada com o proprietário (seção 22.3 item 2): o Plano de
Contas de centro de custo (o que já existia, Parte 21 — diferente do
plano de contas CONTÁBIL da seção 23.1/23.2 acima) tinha uma camada de
~25 subcentros entre os 4 centros e os ~175 itens de custo. Essa camada
foi removida — item de custo passa a ligar **direto** no centro
(`cost_item_centers`, substituindo `cost_item_subcenters` +
`cost_subcenter_centers` + a própria tabela `cost_subcenters`), mantendo
a mesma ideia de rateio por percentual de antes, só com uma cascata a
menos. Migration `069_remove_subcentros_cost_item_centers.sql` derivou
os percentuais combinados a partir do que já existia (multiplicando os
dois percentuais antigos e somando quando o mesmo centro era alcançado
por mais de um subcentro), confirmado batendo 100% exato pros 176 itens
de custo existentes antes de apagar as tabelas antigas.

Consequências diretas, todas ajustadas na mesma leva:

- Tela **"Plano de itens de custo"** perdeu a seção "Subcentros de
  custo" — só "Itens de custo" (ligados direto a 1+ centros) e "Centros
  de custo" continuam.
- **Contagem física de estoque**: o agrupamento por nome de subcentro
  (que juntava, por exemplo, o "Alimentos" de Café da manhã com o de
  Bar da piscina numa única contagem) deixou de existir — cada centro
  de custo inteiro vira um grupo de contagem próprio, mais grosso.
  `count_frequency_days` migrou do subcentro pro próprio centro.
  Aceito conscientemente por ora (decisão do proprietário, seção 22.3
  item 2) — pode ser repensado na Leva 3 (estoque), se fizer falta.
- `getFichaTecnicaIngredientOptions` (filtro de ingrediente na Ficha
  Técnica de petiscos e drinks) simplificou: antes filtrava por 3
  nomes de subcentro espalhados ("Alimentos", "Bebidas", "Materiais de
  bar da piscina"), que eram todos do centro "Bar de piscina" — agora
  filtra direto pelo centro "Bar de piscina", sem precisar da lista de
  nomes.
- `getCostCentersSummaryForPeriod`/`getExpenseDemonstrativoForPeriod`
  (telas "Custos" e "Demonstrativo de Despesas") perderam uma cascata
  de cálculo — rateiam direto item→centro, sem passar por subcentro no
  meio. A tabela "Rateio dos custos, por item de custo" perdeu a coluna
  "Subcentro".
- Tela **"Lançar compras e despesas"**: ao criar um item de custo novo
  na hora, o seletor de vínculo agora liga direto a centro(s) de custo,
  não mais a subcentro(s).

### 23.4 O que NÃO mudou nesta leva

Nenhuma tela de compras/vendas/estoque do dia a dia (Lançar compras e
despesas — exceto o detalhe do item 23.3 acima —, Lista de compras,
Baixa de estoque, Consumo por quartos, Comandas, Consumo de Bar e
Frigobar) gera lançamento contábil ainda. Os 5 itens de menu que hoje
vivem soltos (Lançar Compra, Lista de compras, Estoque, Ativo
Permanente, Custos e Despesas) continuam exatamente onde estavam — só
foi acrescentado um item novo, "Módulo Contábil", sem remover nada
ainda (a consolidação do menu é a Leva 6). Fornecedores, contas a
pagar, hóspede avulso, baixa de estoque no momento da venda e a nova
fórmula do café da manhã ficam para as próximas levas.

### 23.5 Testado

- `npm run build`/`npm run lint` limpos em múltiplas rodadas.
- Migrations `068`/`069` aplicadas com sucesso no Postgres local via
  Docker — confirmado 43 contas contábeis criadas, 263 vínculos
  item→centro derivados corretamente (ex.: "água" saiu 34%/33%/33%
  entre Bar de piscina/Café da manhã/Hospedagem, idêntico ao que já
  valia antes via subcentro), 0 itens com soma ≠ 100%, view
  `inventory_count_line_history` e a tabela `inventory_count_sessions`
  renomeada funcionando sem erro.
- Telas novas/alteradas varridas via sessão autenticada real (login
  local + cookie `sb-127-auth-token`): `/contabil`,
  `/contabil/plano-de-contas`, `/contabil/lancamentos`,
  `/checklists/plano-de-contas/custo`, `/compras/contagem`,
  `/custos-despesas/custos`, `/compras/itens`, `/compras/pratos` — todas
  200, com dado real confirmado no HTML (contas contábeis, itens de
  custo ligados a centro).
- Fluxo ponta a ponta via rota de API temporária (`/api/test-leva1`,
  removida depois), exercitando as Server Actions de verdade (não SQL
  direto): lançamento manual balanceado criado com sucesso; lançamento
  desbalanceado corretamente rejeitado com a mensagem de erro exata;
  estorno criado e status do original virando "estornado"; item de
  custo novo ligado a 2 centros (60%/40%) via `createCostItem`;
  contagem física iniciada agrupada por centro via
  `startCountSession`; despesa lançada criando um item de custo novo
  inline com `center_links`, via `createExpense`. Todas as linhas
  fabricadas (lançamentos, item de custo, sessão de contagem, despesa)
  removidas do banco local depois.

## 24. Módulo Contábil — Leva 2: fornecedores, contas a pagar e lançamento automático de compras/despesas

Segunda leva da implementação completa aprovada em 15/10/2026 (ver seção
22.3) — feita direto em `main`... na verdade em `feature/compras` (a
branch ainda não mesclada), pós Leva 1 (seção 23), sem pausa pra
aprovação entre levas (pedido explícito do proprietário: "pode fazer a
implementação completa sem ter que parar em cada leva").

### 24.1 Fornecedores (cadastro de verdade)

Nova tabela `suppliers` (migration
`070_fornecedores_contas_a_pagar.sql`): nome (único, case-insensitive),
CPF/CNPJ, e-mail, telefone, endereço, ativo. Substitui os antigos campos
de texto livre `expenses.supplier_name`/`fixed_assets.supplier_name`,
que podiam divergir entre si por causa de maiúscula/minúscula —
**backfill automático** (decisão 22.3 item 5, "posso juntar
automaticamente os nomes iguais das compras já lançadas ao criar o
cadastro? Sim"): a migration junta os nomes já digitados nas duas
tabelas (ignorando caixa), cria 1 fornecedor por nome distinto, e
reaponta `expenses`/`fixed_assets` pro `supplier_id` correspondente
antes de descartar as colunas de texto. `src/lib/actions/suppliers.ts`
(`getSuppliers`/`getSupplierOptions`/`createSupplier`/`updateSupplier`/
`deleteSupplier`) segue o mesmo padrão já usado por item de custo/item
de estoque — confere nome duplicado (`ilike`) antes de criar.

No formulário "Lançar compras e despesas" (`expense-form.tsx`), o campo
"Fornecedor" virou um seletor (existente ou "+ Criar novo fornecedor",
com nome inline) em vez de texto livre — a criação de fato acontece no
momento de salvar a despesa (`createSupplier` chamado a partir do
cliente, antes de montar o FormData da despesa), não dentro de
`createExpense`/`updateExpense` em si.

### 24.2 Contas a pagar — sem tabela própria

Decisão de modelagem (22.3 item 3 implícito, refinado nesta leva): como
1 despesa já representa exatamente 1 obrigação com 1 fornecedor, **não
existe uma tabela "contas a pagar" separada** — a própria linha de
`expenses` carrega o estado:

- `payment_status` (`pago`/`pendente`, novo enum `expense_payment_status`).
- `due_date` (vencimento, obrigatório só quando a forma de pagamento é
  "A prazo").
- `paid_at` (quando foi efetivamente paga).
- `competence_date` (data de competência contábil, pode diferir da data
  do documento — nasce igual à data se o campo ficar em branco).
- `document_number` (número da nota/cupom, usado também pra detecção de
  duplicidade — ver 24.4).

Forma de pagamento do lado FORNECEDOR ganhou um enum próprio,
`supplier_payment_method` (`banco_pix`/`dinheiro`/`cartao_corporativo`/
`a_prazo`), **separado** do `payment_method` já existente (que é do
hóspede pagando a própria conta de consumo) — decisão 22.3 item 12.
"A prazo" não é uma forma de pagamento de verdade, é a ausência dele por
ora: ao escolher essa opção, `payment_status` é automaticamente
`pendente` e o campo "Vencimento" aparece como obrigatório; qualquer
outra forma grava `payment_status = pago` com `paid_at = agora`, sem
pedir vencimento nenhum.

**Registrar o pagamento depois**: nova tela `/contabil/pagamentos`
("Pagamentos e recebimentos" — só o lado "pagamentos" por ora, já que
este app nunca teve conceito de "a receber" de hóspede, sempre à vista)
lista as despesas `pendente`, ordenadas por vencimento, com um botão
"Registrar pagamento" (diálogo pedindo a forma — banco/PIX, dinheiro ou
cartão corporativo, nunca "a prazo" de novo) chamando a nova Server
Action `payExpense(id, paymentMethod)`: atualiza a mesma linha de
`expenses` (`payment_status = pago`, `paid_at`, `payment_method`) e
posta um lançamento contábil de **liquidação** — nunca reconhece a
despesa de novo, só credita caixa/banco e debita a conta de "a pagar"
que já tinha sido creditada na criação.

### 24.3 Lançamento contábil automático por trás de toda compra/despesa

`postExpenseLedgerEntry` (função interna de `expenses.ts`, chamada por
`createExpense`/`updateExpense`) monta e posta (via `postLedgerEntry`,
Leva 1) um lançamento balanceado a cada despesa salva, sem nenhuma tela
nova pro admin entender débito/crédito:

- **Débito**: 1 linha por (item de custo × centro de custo em que ele
  está cadastrado), valor = subtotal do item × percentual do centro —
  resolvido via `resolveLedgerAccountForCostItem` (conta =
  `cost_items.ledger_account_code` se o admin já configurou, senão um
  padrão genérico: `estoque-outros` se representa estoque,
  `outras-despesas` se não — mesmo fallback documentado na Leva 1). Uma
  linha de ativo permanente debita sempre `equipamentos-imobilizado`,
  sem split por centro. Sobra de arredondamento do rateio percentual
  (ex.: item "água" 33%/34%/33%) é corrigida na última linha, garantindo
  que a soma bate exatamente o subtotal — mesmo padrão de correção já
  usado no projeto (ex.: migration 069).
- **Crédito**: 1 linha só — `fornecedores-a-pagar` (se há fornecedor) ou
  `despesas-a-pagar` (se não há) quando `payment_status = pendente`;
  `caixa` (dinheiro) ou `banco` (qualquer outra forma) quando já paga.

**Conta contábil por item de custo, agora editável**: "Plano de itens de
custo" (`cost-plan-panel.tsx`) ganhou um seletor "Conta contábil"
(opcional, "Padrão automático" se não escolher) — `createCostItem`/
`updateCostItem` (`cost-plan.ts`) ganharam um parâmetro a mais,
`ledgerAccountCode`, já desde a Leva 1 no schema (`cost_items.
ledger_account_code`) mas só exposto na UI nesta leva.

**Edição de uma despesa já lançada**: nunca edita o lançamento confirmado
— sempre estorna o antigo e posta um novo, mesma regra de sempre. **Bug
real encontrado e corrigido durante o teste desta leva**: a busca pelo
"lançamento antigo" a estornar usava só
`source_type='expenses' and source_id=X and status='confirmado'`, sem
filtrar por `origin` — uma despesa já paga tem **2** lançamentos
confirmados com o mesmo `source_id` (o de reconhecimento, `origin=
'despesa'`, e o de liquidação, `origin='pagamento'`), então
`.maybeSingle()` encontrava 2 linhas, retornava `null` silenciosamente
(sem erro visível) e o estorno nunca acontecia — mesma categoria de bug
já registrada no projeto (nunca assumir que uma busca "única" vai mesmo
achar só 1 linha). Além disso, o lançamento novo reconhecia a despesa
usando o `payment_status` ATUAL (já pago) e creditava banco/caixa
**direto**, duplicando a saída de caixa (a liquidação original já tinha
feito isso uma vez). Corrigido em duas partes: (1) a busca do lançamento
a estornar agora filtra também por `origin='despesa'`; (2) antes de
postar o novo lançamento, o código confere se já existe um lançamento de
pagamento confirmado pra essa despesa — se existir, força o novo
lançamento de reconhecimento a creditar `fornecedores-a-pagar`/
`despesas-a-pagar` (nunca caixa/banco direto), preservando o lançamento
de pagamento original como o único registro do movimento de caixa de
verdade. `deleteExpense` tinha o mesmo risco (`.maybeSingle()` numa
despesa com 2 lançamentos) — corrigido estornando **todos** os
lançamentos confirmados ligados à despesa, não só "um".

### 24.4 Duplicidade — só avisa, nunca bloqueia

Decisão 22.3 item 6. Antes de criar/editar uma despesa, confere se já
existe outra com o mesmo fornecedor + número do documento + data + valor
total — se existir e a tela ainda não tiver confirmado, devolve
`duplicateWarning: true` em vez de um erro comum; o formulário mostra
isso num `confirm()` do navegador e, se o usuário confirmar, reenvia a
mesma requisição com `confirm_duplicate=true`, que pula a checagem. Só
compara quando há número de documento informado (sem ele, o aviso seria
ruído constante).

### 24.5 Desconto, frete e tributos por item

`expense_items` ganhou 4 colunas novas (`discount`/
`freight_and_other_costs`/`recoverable_tax`/`non_recoverable_tax`),
colapsáveis no formulário ("Desconto, frete e tributos", escondido por
padrão, abre sozinho ao editar uma despesa que já tem algum desses
valores). O subtotal final de uma linha —
quantidade×custo − desconto + frete + tributo **não** recuperável — é o
único valor que afeta o lançamento contábil; o tributo **recuperável**
é só registrado pra transparência/auditoria (representa crédito a
recuperar depois, não um custo de verdade).

### 24.6 Leitura automática por IA, atualizada

`receipt-ai.ts` passou a pedir o vocabulário novo de forma de pagamento
(`banco_pix`/`dinheiro`/`cartao_corporativo`/`a_prazo`, com a regra
explícita de só devolver "a_prazo" quando o documento deixa claro que
ainda não foi pago) e a extrair `document_number` (número da nota/cupom)
— preenchido automaticamente no formulário junto com fornecedor
(casado por nome contra os já cadastrados, ou "+ Criar novo fornecedor"
se não achar), data e itens, como já acontecia antes.

### 24.7 O que NÃO mudou nesta leva

Estoque continua com saldo só em quantidade (sem valorização monetária —
Leva 3); consumo de bar/frigobar continua baixando estoque no momento do
PAGAMENTO, não da venda (Leva 4); café da manhã continua com a fórmula
antiga (Leva 5); os 5 itens de menu soltos continuam soltos (Leva 6);
nenhuma exportação pro sistema financeiro existe ainda (Leva 7).

### 24.8 Testado

- `npm run build`/`npm run lint` limpos (rota nova
  `/contabil/pagamentos` aparece na árvore).
- Migration `070` aplicada com sucesso no Postgres local via Docker —
  conferido o backfill real: 3 fornecedores distintos criados a partir
  dos nomes já digitados, 4 despesas reais corretamente reapontadas pra
  `supplier_id` (com `payment_method` mapeado como esperado:
  cartão crédito/débito → cartão corporativo, PIX → banco/PIX),
  `payment_status`/`competence_date`/`paid_at` backfilados como "já
  paga" pra tudo que existia antes.
- Fluxo ponta a ponta via rota de API temporária (`/api/test-leva2`,
  removida depois), com sessão autenticada real (login local + cookie
  `sb-127-auth-token`), exercitando as Server Actions de verdade:
  fornecedor novo criado; despesa "a prazo" com 2 itens (um split em 3
  centros — "água" 33/34/33 — outro com desconto/frete/tributos)
  lançada, conferido o lançamento contábil gerado (crédito
  `fornecedores-a-pagar`, débito `outras-despesas` por centro, com a
  sobra de arredondamento corrigida na última linha, batendo exatamente
  com o total); duplicidade detectada e, confirmada, aceita; pagamento
  registrado (lançamento de liquidação: débito `fornecedores-a-pagar`,
  crédito `banco`) e pagamento duplicado corretamente rejeitado;
  **edição de uma despesa já paga testada e o bug da seção 24.3
  encontrado e corrigido nesta mesma rodada** — confirmado depois da
  correção que o lançamento original é estornado de verdade (status
  `estornado`, estorno com débito/crédito invertidos) e que o novo
  lançamento de reconhecimento credita `fornecedores-a-pagar` (não mais
  banco direto); override de conta contábil por item de custo
  confirmado (água temporariamente configurada pra postar em "caixa"
  sem split, revertido depois); exclusão de uma despesa já paga
  confirmada estornando o único lançamento dela; `getExpenses`/
  `getExpenseWithItems`/`getExpenseSummaryBySupplier`/
  `getPendingExpenses` conferidos com os dados reais do teste. Todas as
  linhas fabricadas (despesas, itens, lançamentos, fornecedor) removidas
  do banco local depois; `cost_items.ledger_account_code` da água
  revertido pra `null`.

## 25. Módulo Contábil — Leva 3: estoque com saldo em R$ (custo médio ponderado móvel)

Terceira leva da implementação completa aprovada em 15/10/2026 (seção
22.3), pós Leva 2 (seção 24), sem pausa pra aprovação entre levas.

### 25.1 O problema e a decisão de design

Até aqui, `inventory_movements` só guardava quantidade — nunca havia
nenhum valor monetário de estoque, nem guardado nem calculado. A seção
6.7 do PRD Contábil pede "custo médio ponderado móvel" como método
padrão: a cada compra, o custo médio do item se recalcula pela proporção
entre o que já tinha em estoque e o que entrou; saídas (baixa manual,
baixa automática, ajuste de contagem) **não** mudam o custo médio, só o
reduzem/aumentam na mesma proporção.

**Decisão deliberada, para nunca haver desvio (drift)**: em vez de um
campo `avg_cost` em `inventory_items` atualizado por código a cada
movimento (risco real de um call site futuro esquecer de atualizá-lo —
já aconteceu antes neste projeto, ver "Convenções e decisões
importantes" do CLAUDE.md), **cada movimento grava seu próprio
`unit_cost`/`total_value`** no momento em que é inserido, e o "custo
médio atual"/"valor total em estoque" de um item são sempre **derivados
por soma dos movimentos** — nunca uma coluna própria. Mesma filosofia já
usada por `inventory_balances.balance` pra quantidade, agora estendida
pra dinheiro.

### 25.2 Como funciona

Duas colunas novas em `inventory_movements` (migration
`071_estoque_valorizacao.sql`): `unit_cost` (custo por unidade, 6 casas
decimais — só informativo/auditoria, nunca usado em soma) e
`total_value` (valor em R$ daquele movimento específico, assinado pelo
mesmo sinal da quantidade). Preenchidas sozinhas por um trigger `before
insert` (`compute_inventory_movement_value`, `security definer`, mesmo
padrão de toda trigger deste schema) que roda pra **todo** insert em
`inventory_movements`, não importa de onde venha:

- **Compra** (`movement_type = 'compra'`): usa o custo líquido já
  calculado na despesa (`expense_items.subtotal` — já com desconto/
  frete/tributo não recuperável aplicados, Módulo Contábil Leva 2), não
  o `unit_cost` bruto da nota. `total_value = subtotal` exatamente (sem
  recalcular via multiplicação, pra nunca divergir do valor já
  reconhecido no lançamento contábil da despesa); `unit_cost =
  subtotal ÷ quantidade`, só pra exibição.
- **Qualquer outro tipo** (baixa manual, baixa automática de consumo,
  ajuste de contagem): usa o custo médio vigente **antes** deste
  movimento — numa trigger `before insert`, consultar a própria tabela
  reflete exatamente o estado "antes", já que esta linha ainda não foi
  gravada. `total_value = quantidade × custo médio anterior` (quantidade
  já assinada, então uma saída naturalmente produz um valor negativo).

`inventory_balances` (view já existente desde sempre, usada por todo
código que lê saldo) ganhou 2 colunas novas, **sem quebrar nenhum select
existente**: `value` (soma de `total_value`) e `avg_cost` (`value ÷
balance`, 0 quando não há saldo). Nenhum outro código precisou mudar pra
continuar funcionando — a extensão é aditiva.

**Backfill do dado real já existente**: um bloco `DO` na própria
migration processa os movimentos já gravados, por item, em ORDEM
CRONOLÓGICA (a mesma lógica do trigger, só que iterando com variáveis
`v_balance`/`v_value` indo pra frente no tempo) — nunca em lote sem
ordem, já que o custo médio de um movimento depende do que veio antes
dele. Nenhum dado real foi zerado ou perdido.

### 25.3 O que NÃO mudou nesta leva

O MOMENTO em que o estoque desce continua sendo o pagamento da conta
(não a venda/comanda — isso é a Leva 4); a fórmula do café da manhã
continua a antiga (Leva 5); a contagem física continua agrupada por
centro inteiro (a convenção de agrupar por "nome de subcentro" tinha
caído com a remoção de subcentros na Leva 1, e tinha ficado marcada como
"a repensar na Leva 3" — repensada e decidida: **não** há necessidade de
mudar o agrupamento por causa da valorização monetária em si; o
agrupamento por centro inteiro, já em vigor desde a Leva 1, continua
suficiente).

### 25.4 Onde o valor aparece

Dois lugares, ambos admin-only, sem nenhuma tela nova (a tela de
relatórios dedicada é a Leva 6):

- **"Itens de estoque e ciclo de compras"** (`/compras/itens`): cada
  item ganhou "Custo médio: R$ X · Valor em estoque: R$ Y" ao lado do
  saldo já existente; um "Valor total em estoque: R$ Z" no topo da tela.
- **Resumo Executivo → Estoque** (`/dashboard/estoque`): a tabela já
  existente ganhou 2 colunas (Custo médio, Valor em estoque) + uma linha
  de rodapé com o valor total.

Telas que camareira/manutenção também usam (baixa de estoque, pedidos de
compra) **não** ganharam exibição de valor — decisão deliberada de não
expor dado financeiro a papéis que não precisam dele, mesmo o dado já
estando disponível no servidor (consistente com o resto do projeto, ex.:
"camareira nunca vê o PDF" do recibo financeiro).

### 25.5 Testado

- `npm run build`/`npm run lint` limpos.
- Migration `071` aplicada com sucesso no Postgres local via Docker —
  conferido o backfill do único movimento real já existente (compra de
  ovos, 5 unidades, R$80 no total): `unit_cost` virou 16.00, `total_value`
  80.00, e `inventory_balances` passou a mostrar `value=80.00`,
  `avg_cost=16.00` — batendo exatamente com a conta manual.
- Fluxo completo via rota de API temporária (`/api/test-leva3`, removida
  depois), com sessão autenticada real, exercitando uma sequência mista
  de movimentos sobre um item de teste isolado (criado e apagado
  depois, sem tocar em nenhum dado real): compra de 10 un a R$5 (unit_
  cost=5, total_value=50) → baixa manual de 4 (unit_cost=5, o custo
  médio antes, total_value=-20; custo médio depois continua 5, como
  esperado — saída nunca muda a média) → compra de 10 un a R$8 (unit_
  cost=8, total_value=80; custo médio depois vira 110÷16=6,875) → baixa
  manual de 6 (unit_cost=6,875, total_value=-41,25; custo médio depois
  continua 6,875) → ajuste de contagem de +2 (contagem física achou 12,
  2 a mais do que o esperado; unit_cost=6,875, total_value=13,75). Saldo
  final: 12 unidades, valor R$82,50, custo médio R$6,875 — todos os 5
  movimentos bateram exatamente com o cálculo manual esperado antes do
  teste. Telas `/compras/itens` e `/dashboard/estoque` conferidas via
  sessão autenticada real mostrando os valores corretos do item real
  (ovos: "Saldo: 5 un · Custo médio: R$ 16.00 · Valor em estoque: R$
  80.00"). Fixture de teste (item de custo, item de estoque, 2 despesas,
  sessão de contagem) removida do banco local depois.

## 26. Módulo Contábil — Leva 4: estoque desce no momento do pedido, não mais só no pagamento

Quarta leva da implementação completa aprovada em 15/10/2026 (seção
22.3, decisão/item 4), pós Leva 3 (seção 25), sem pausa pra aprovação
entre levas.

### 26.1 A mudança de comportamento

Até aqui, o estoque de frigobar/bar da piscina só descia quando a conta
do quarto era marcada como PAGA (`deduct_inventory_on_bill_payment`,
disparada por um `after update on room_bills`) — às vezes dias depois
do consumo de verdade. O documento original (PRD Contábil, seção 6.6)
mostra o lançamento contábil da venda acontecendo no momento da venda,
não do pagamento; essa leva alinha o estoque com essa mesma lógica.
Decisão confirmada explicitamente com o proprietário como mudança de
comportamento num sistema em produção (seção 22.3 item 4).

**Consequência direta, também já antecipada na decisão**: a pergunta
"os ingredientes foram recuperados ou perdidos?" ao cancelar uma
comanda deixou de ser cosmética — como o estoque já foi baixado no
momento do pedido (não mais só no pagamento), cancelar sem decidir isso
deixaria o estoque permanentemente errado num dos dois sentidos.

### 26.2 Onde cada baixa/estorno acontece agora

- **Comanda nova** (`submit_comanda`): baixa o estoque de cada
  ingrediente (via `inventory_item_recipes`, mesma soma por ingrediente
  de sempre — um ingrediente pode alimentar vários produtos do cardápio)
  logo depois de inserir os itens do pedido.
- **Comanda editada** (`edit_comanda`): primeiro ESTORNA o estoque dos
  itens ANTIGOS (já baixado quando a comanda foi lançada/editada da
  última vez), só depois substitui os itens e baixa de novo pelos itens
  NOVOS — o efeito líquido é sempre o delta, mesmo quando a edição troca
  de quarto no meio do caminho (o estorno usa a conta de ORIGEM, a baixa
  usa a de DESTINO).
- **Comanda cancelada** (`cancel_comanda`, agora com o parâmetro
  `p_ingredients_recovered boolean`, obrigatório): se `true`, estorna o
  estoque de volta; se `false`, mantém baixado. Uma chamada redundante
  numa comanda já cancelada nunca restaura de novo (checado via o status
  ANTES do update, não depois).
- **Frigobar** (`set_minibar_consumption`, função nova — substitui o
  upsert direto que existia em `setMinibarConsumption`): lê a quantidade
  ANTIGA, calcula o delta contra a NOVA informada, grava a nova
  quantidade, e baixa/estorna o estoque pelo delta — tudo atômico (um
  `select ... for update` na linha da conta e na linha do item evita
  condição de corrida entre duas chamadas concorrentes). Como a
  quantidade de frigobar sempre foi um valor ABSOLUTO (nunca um delta —
  ver Parte 08/25), e pode legitimamente DIMINUIR (reabertura "zerar e
  lançar tudo novamente", Parte 25), um delta negativo devolve estoque
  automaticamente, sem nenhum campo/pergunta nova pro frigobar (diferente
  da comanda, aqui não existe "cancelamento" — só ajuste de quantidade).

Todas as 4 funções continuam `security definer`, mesmo padrão já
estabelecido — a baixa/estorno nunca passa por uma policy de RLS direta
em `inventory_movements` (que não tem, e não ganhou, nenhuma policy de
insert pra `baixa_consumo_hospede`; só essas funções podem gravar esse
tipo de movimento, exatamente como já era antes desta leva).

### 26.3 Remoção do mecanismo antigo e migração de dados reais

`deduct_inventory_on_bill_payment`/o trigger `room_bills_deduct_inventory`
foram apagados por completo (migration
`072_estoque_baixa_no_pedido.sql`). **Antes** de apagá-los, a mesma
migration rodou um catch-up único: para toda conta AINDA NÃO PAGA (as
únicas que o mecanismo antigo ainda não tinha processado), baixa de uma
vez só o consumo de frigobar/comanda já lançado antes da mudança — sem
isso, esse consumo nunca seria baixado (o mecanismo antigo foi removido,
e o novo só vale pra lançamentos a partir de agora). Contas já `paga`
não entram no catch-up — já foram corretamente baixadas no pagamento,
sob o mecanismo antigo, e catch-up-las de novo duplicaria a baixa.
Testado contra o banco real (local): nenhuma conta aberta tinha
frigobar pendente; havia 1 comanda ativa numa conta aberta, mas o
produto dela ("Caipifruta Cachaça") não tinha ficha técnica cadastrada
— o catch-up corretamente não encontrou nada pra baixar (mesma lacuna
que já existiria sob o mecanismo antigo; não é um bug desta leva).

### 26.4 Testado

- `npm run build`/`npm run lint` limpos.
- Migration `072` aplicada com sucesso no Postgres local via Docker —
  confirmado que os dados reais pré-existentes (1 movimento de compra,
  as 2 comandas já existentes, as 4 linhas de frigobar de uma conta já
  paga) ficaram intactos depois do catch-up + remoção do trigger antigo.
- Fluxo completo via rota de API temporária (`/api/test-leva4`, removida
  depois), com sessão autenticada real como a conta de teste
  "Teste 01 camareira" (senha redefinida localmente via a API admin do
  GoTrue só para este teste) — necessário porque `submit_comanda`/
  `edit_comanda`/`cancel_comanda` exigem `is_camareira()`, então testar
  como admin falha com "not authorized" de propósito (não é bug, é a
  regra de sempre). Ingrediente/item de frigobar/item de bar fabricados
  com ficha técnica conhecida (1 frigobar = 2 unidades do ingrediente; 1
  drink = 3 unidades), sobre uma suíte real já existente, sequência
  completa: frigobar lançado em 5 (saldo -10) → reduzido pra 2 (saldo -4,
  restaurando 6) → comanda de 3 drinks (saldo -13) → editada pra 1 no
  mesmo quarto (saldo -7, estornando 9 e baixando 3) → editada de novo
  trocando de quarto pra 4 (saldo -16, estornando 3 e baixando 12) →
  cancelada SEM recuperar (saldo continua -16) → nova comanda de 2
  drinks (saldo -22) → cancelada COM recuperar (saldo volta -16) →
  cancelada de novo (redundante, com recuperar=true outra vez — saldo
  continua -16, confirmando que não restaura 2 vezes). Todos os 9
  movimentos gerados bateram exatamente com o valor calculado à mão
  antes do teste. Fixtures (ingrediente, item de frigobar, item de bar,
  fichas técnicas, comandas, movimentos) removidas do banco local
  depois.

## 27. Módulo Contábil — Leva 5: fórmula de custo do café da manhã

Quinta leva da implementação completa aprovada em 15/10/2026 (seção
22.3, itens 9 e 10), pós Leva 4 (seção 26), sem pausa pra aprovação
entre levas.

### 27.1 A fórmula (decisão 22.3 item 9)

Cada item de custo ligado ao centro "Café da manhã" entra no cálculo de
um jeito diferente, dependendo de uma propriedade nova,
`inventory_items.is_perishable` ("É perecível?", editável pelo admin em
"Itens de estoque e ciclo de compras", `/compras/itens` — nunca uma
lista fixa de nomes, mesmo com os exemplos do documento original
— frutas, ovos = perecíveis; requeijão, manteiga, leite, queijo,
presunto, farinhas = não perecíveis — servindo só de sugestão inicial
pro admin marcar manualmente):

- **Perecível**: 100% do que foi COMPRADO no período (mesma regra já
  valia pra café da manhã antes desta leva, sem distinção nenhuma —
  agora é restrita só aos itens marcados como perecíveis).
- **Não perecível**: a quantidade BAIXADA MANUALMENTE no período (mesma
  tela "Baixa de estoque" que já existe, sem nenhum campo novo nela) ×
  o custo médio ponderado móvel do item **no fim do período** — nunca o
  custo médio de hoje, o de ENTÃO, derivado dos próprios movimentos
  (possível sem nenhuma coluna nova porque cada movimento já carrega seu
  próprio `unit_cost`/`total_value` desde a Leva 3 — basta filtrar os
  movimentos até aquele instante e refazer a mesma divisão soma/soma).
- **Item de custo sem vínculo de estoque** (ex.: gás, embalagens):
  continua pela regra geral (comprado no período), já que não existe
  "baixa" nenhuma pra esses.

**Por que não precisou de nenhum campo novo de "destino" na tela de
baixa de estoque** (decisão explícita, "sem nada novo"): a atribuição a
"Café da manhã" continua vindo do MESMO percentual já cadastrado no
Plano de Contas (`cost_item_centers.alloc_pct`) — a quantidade baixada é
multiplicada por esse % de sempre, exatamente como as compras já eram
multiplicadas por ele antes. Isso também resolve o caso de um item não
perecível que teve baixa este período mas nenhuma compra (a função busca
os itens ligados ao centro direto do Plano de Contas, nunca a partir do
"quem comprou algo neste período" — diferente da cascata geral de
Custos/`summary`, que só enxerga itens com compra no próprio período).

### 27.2 "Cafés servidos" (decisão 22.3 item 10)

Novo campo `daily_breakfast_settings.guests_served` — um número por DIA
inteiro (não por suíte), que nasce igual ao total de hóspedes hospedados
(soma de `daily_breakfast_room_assignments.guest_count` naquele dia) e
só pode ser reduzido, nunca aumentado — nem além do teto calculado, nem
além de um valor já reduzido antes (`setBreakfastGuestsServed` confere
os dois). A coluna guarda só o OVERRIDE (null = "usa o teto calculado na
hora"), nunca o teto em si — mesmo princípio já usado em
`eligible_suites_count`/outras colunas deste projeto ("nunca persistir
um valor que pode ser sempre recalculado"). Editável em "Mesas do café"
(`/mesas/gerenciar`), ao lado dos outros dados do dia, com o
`QuantityStepper` de sempre (`max` = teto calculado).

Esse número é o denominador CORRETO das duas razões pedidas pelo
documento original (seção 7.4) — nunca "hóspedes-noite", que continua
calculado e exibido só como informação complementar:

- **Custo de insumos por café servido** = custo de insumos (itens de
  estoque ligados ao centro, pelas regras acima) ÷ cafés servidos.
- **Custo total por café servido** = custo de insumos + outros custos
  diretos do centro (ex.: gás) ÷ cafés servidos.

### 27.3 Divergência esperada com a cascata geral de Custos

O card "Café da manhã" dentro de "Rateio dos custos"/"Hospedagem (+
café da manhã)" (tela `/custos-despesas/custos`, cascata de
`getCostCentersSummaryForPeriod` — **não alterada nesta leva**) continua
medindo em regime de caixa puro: 100% do comprado no período, pelo %,
pra TODO item, sem distinção de perecível/não-perecível. O novo card
"Café da manhã" detalhado (com as duas razões por café servido) usa a
fórmula corrigida desta leva. Os dois números PODEM divergir pra itens
não perecíveis — decisão deliberada, documentada na própria tela (nota
explicando a diferença): a cascata geral mede dinheiro gasto; o card
detalhado mede ingrediente realmente consumido, valorizado. Juntar os
dois exigiria propagar a correção pra dentro de `summary`, usado por
outras telas que não pediram essa mudança (Demonstrativo de Despesas,
rateio geral) — fora do escopo desta leva.

### 27.4 Testado

- `npm run build`/`npm run lint` limpos.
- Migration `073` aplicada com sucesso no Postgres local via Docker.
- Fluxo completo via rota de API temporária (`/api/test-leva5`, removida
  depois), com sessão autenticada real como admin: 2 itens de custo
  fabricados (ligados 100% ao centro "Café da manhã") — um marcado
  perecível, com uma compra de R$20 dentro do período testado; outro não
  perecível, com uma compra de R$30 (10 un a R$3) **antes** do período
  (estabelecendo custo médio 3,00) e uma baixa manual de 4 unidades
  **dentro** do período. Resultado batendo exatamente com o esperado:
  item perecível = R$20,00 (comprado); item não perecível = R$12,00
  (4×R$3,00, baixado) — confirmando as duas fórmulas isoladamente, sem
  contaminação de dados reais (isolado filtrando só os 2 itens
  fabricados, já que o período de teste — últimos 3 dias — também inclui
  qualquer item real com movimento nesse intervalo). "Cafés servidos"
  testado via override direto (5), confirmando `costPerGuestInsumos =
  32/5 = 6,40`.
- **Bug real encontrado e corrigido durante este mesmo teste**: a
  primeira versão de `getWithdrawnQuantityForPeriod` comparava
  `inventory_movements.created_at` (timestamptz) contra uma string
  ingênua (`` `${from}T00:00:00` ``) pro limite inferior — mesma
  categoria de bug já registrada e corrigida antes neste projeto (Partes
  38/39), cometida de novo aqui por mim mesmo nesta leva. Descoberto
  porque o primeiro teste (período fixo em janeiro/2026, antes de este
  app ter qualquer dado real) deu TUDO zero — incluindo os próprios
  itens fabricados — e a investigação revelou que `registerStockWithdrawal`
  sempre grava `created_at = now()` (não aceita data retroativa), então
  o teste originalmente desenhado não testava o período que pensava testar.
  Corrigido usando `startOfDayBrasiliaUtc(from)` (já existente em
  `src/lib/date.ts`) em vez da string ingênua, e o teste refeito com um
  período que inclui o dia de hoje de verdade. Fixtures (2 itens de
  custo, 2 itens de estoque, 2 despesas, 1 baixa manual, o override de
  cafés servidos) removidas do banco local depois.

## 28. Módulo Contábil — Leva 6: menu consolidado + relatórios

Sexta leva da implementação completa aprovada em 15/10/2026 (seção
22.3, itens 11/13), pós Leva 5 (seção 27), sem pausa pra aprovação
entre levas.

### 28.1 Menu consolidado (decisão 22.3 item 11)

Os 5 itens que viviam soltos no menu principal do admin — Lançar
Compra (`/compras/nova`), Lista de compras (`/compras/lista`), Estoque
(`/compras`), Ativo Permanente (`/ativo-permanente`) e Custos e
Despesas (`/custos-despesas`) — saíram de lá (`app-sidebar.tsx`) e
passaram a existir só dentro do menu **"Módulo Contábil"**,
junto dos 3 que já estavam lá desde as Levas 1/2 (Plano de contas,
Livro de lançamentos, Pagamentos e recebimentos). Cada uma dessas 5
telas (e a tela "Lançar compras e despesas" dentro de "Estoque") ganhou
um `<BackLink href="/contabil">`, já que deixaram de ser destinos
diretos do menu principal. Nenhuma rota mudou de endereço — só de onde
é alcançável — e o controle de acesso (admin-only) já estava certo
desde antes, sem precisar de nenhuma mudança em `middleware.ts`.

**Fora de escopo, de propósito**: a tela "Plano de itens de custo"
(centro de custo → item de custo, dentro de "Listas") **não** se mudou
pra cá — é um cadastro diferente (classificação por ÁREA da pousada),
já documentado como não devendo ser confundido com o Plano de Contas
CONTÁBIL (classificação por TIPO de movimento) — a decisão 22.3 item 11
só nomeia os 5 itens acima.

### 28.2 Relatórios novos (decisão 22.3 item 1, PRD seção 9)

Dois relatórios pedidos pelo documento original e ainda não cobertos
por nenhuma leva anterior:

- **Saldo de caixa e bancos** (PRD seção 9.1): 2 cards no topo do hub
  "Módulo Contábil", lendo direto do livro de lançamentos —
  `getCashAndBankBalances` soma TODAS as linhas (confirmado e
  estornado misturados, nunca filtrado por status: um lançamento
  estornado já tem uma linha espelhada que cancela o original;
  filtrar por status quebraria essa simetria) das contas "caixa"/
  "banco", débito soma e crédito subtrai (contas de ativo). Sempre o
  saldo ATUAL (até agora), não filtrado por período.
- **CMV e margem bruta — Bar da piscina + Frigobar** (PRD seção 9.1/
  9.3): novo card na tela "Custos", com receita bruta (soma dos
  relatórios de consumo já existentes, pela data de PAGAMENTO), CMV
  (soma de `inventory_movements.total_value` dos movimentos
  `baixa_consumo_hospede` no período, pela data do PEDIDO/lançamento —
  Módulo Contábil Leva 4), margem bruta e margem bruta %.
  **Simplificação deliberada, documentada na própria tela**: bar e
  frigobar somados juntos, sem separar por canal (os movimentos de
  estoque não guardam de qual dos dois vieram) — e as duas datas-base
  (pagamento × pedido) podem divergir pra uma mesma venda, mesma
  divergência já aceita entre regime de caixa e regime de competência,
  não um erro de cálculo.

### 28.3 Questões e Respostas: perguntas 13/14/15 reescritas por completo

As perguntas sobre Compras, Estoques e Custos (`/questoes-respostas`)
tinham sido escritas **antes mesmo da Leva 1** deste módulo (ainda
descreviam a camada de subcentro, já removida) — ficaram
progressivamente mais desatualizadas a cada leva desde então, sem
nenhuma revisão. Reescritas nesta leva pra refletir tudo: sem
subcentro (direto item→centro); fornecedores como cadastro de
verdade; forma de pagamento separada hóspede×fornecedor, com "a
prazo" e a tela "Pagamentos e recebimentos"; desconto/frete/tributos
por item; estoque com valor em R$ (custo médio ponderado móvel);
baixa de estoque no momento do PEDIDO (não mais do pagamento), com a
pergunta "recuperou ou perdeu" ao cancelar uma comanda; contagem
física agrupada por centro inteiro (não mais por nome de subcentro);
"é perecível?" e "cafés servidos" na fórmula do café da manhã; e todo
menu relocado pra dentro de "Módulo Contábil". Lição já registrada
desde a Parte 18 do app principal, reforçada aqui: conteúdo escrito à
mão fica desatualizado silenciosamente — vale revisar a cada parte que
muda algo que ele descreve, em vez de deixar acumular várias levas de
atraso.

### 28.4 Testado

- `npm run build`/`npm run lint` limpos em múltiplas rodadas.
- Sessão autenticada real (login local + cookie `sb-127-auth-token`):
  `/contabil` confirmado mostrando "Saldo em caixa"/"Saldo em banco" e
  os 8 itens do menu (os 5 relocados + os 3 já existentes);
  `/custos-despesas/custos` confirmado mostrando o novo card "CMV e
  margem bruta"; `/dashboard` (Resumo Executivo, que inclui a barra
  lateral) confirmado SEM nenhum dos 5 itens antigos no menu principal
  do admin, com "Módulo Contábil" presente.
- **Limpeza corretiva, não um bug desta leva**: ao preparar esse teste,
  encontrados 7 lançamentos contábeis órfãos no banco local — resíduo
  de despesas de teste das Levas 3 e 5 que foram apagadas (`expenses`)
  sem que o lançamento contábil automático correspondente
  (`ledger_entries`/`ledger_entry_lines`, gerado sozinho desde a Leva
  2) fosse removido junto. Como a view de saldo de caixa/banco desta
  leva soma TODO lançamento sem filtrar por origem, esses órfãos
  inflariam o saldo mostrado. Removidos diretamente (nenhum dado real
  afetado — todo o Módulo Contábil é novo nesta branch, ainda não
  mesclada). **Lição registrada pra testes futuros**: a
  partir da Leva 2, apagar uma despesa de teste fabricada também
  precisa apagar o lançamento contábil automático dela — nunca só a
  despesa/itens/movimentos de estoque.

## 29. Módulo Contábil — Leva 7 (final): exportações para o sistema financeiro

Sétima e última leva da implementação completa aprovada em 15/10/2026
(seção 22.3, item 13), pós Leva 6 (seção 28). Com esta leva, as 7 levas
combinadas com o proprietário estão todas implementadas, testadas e
documentadas.

### 29.1 Escopo (decisão 22.3 item 13)

Só a parte de **arquivo** (CSV) da integração com o sistema financeiro
— nunca uma API de verdade entre os dois sistemas, que fica de fora até
o sistema financeiro passar por mudanças próprias e os dois lados
decidirem juntos o que será consumido. Nova tela
**"Exportações para o sistema financeiro"** (`/contabil/exportacoes`,
último item do menu "Módulo Contábil"), com um filtro de período
(mesmo `<DateRangeFilter>` já usado em "Custos") e 7 cards, cada um com
seu próprio botão "Baixar CSV" — um por categoria de dado pedida pelo
documento original (seção 8.2):

1. Receitas de bar e frigobar (por item e canal).
2. Recebimentos por forma de pagamento.
3. Custos por centro de custo.
4. Despesas por item de custo (mais detalhado que o 3, por centro).
5. Saldo de estoque e valores (sempre o saldo ATUAL — "saldo" não é
   uma soma de período, é um retrato de agora).
6. CMV e margem bruta — Bar e Frigobar.
7. Custo do café da manhã por hóspede.

**"XLSX" do documento original, satisfeito via CSV**: decisão
deliberada de não introduzir nenhuma biblioteca nova pra gerar um
`.xlsx` binário de verdade — um CSV com BOM UTF-8 já abre perfeitamente
no Excel, que é o que "XLSX" realmente pedia na prática. Evita uma
dependência nova pra um ganho marginal.

**Metadados de conciliação/auditoria** (último bullet da seção 8.2):
toda exportação começa com 4 linhas fixas — período, moeda (BRL), fuso
horário (America/Sao_Paulo) e data/hora de geração — antes do
cabeçalho de colunas de cada arquivo, via o novo helper
`csvMetadataHeader` (`src/lib/csv-export.ts`).

### 29.2 Consolidação do helper de CSV

`downloadCsv` (baixar um CSV gerado no navegador, sem rota de
servidor) já existia, duplicada em 3 arquivos (`compras-history-
table.tsx`, `history-tables.tsx`, `top-categories-table.tsx`) — extraída
pra `src/lib/csv-export.ts` (junto do novo `csvMetadataHeader`) e
reaproveitada pelos 3, sem nenhuma mudança de comportamento.

### 29.3 Peças novas por trás dos cards

- **Recebimentos por forma de pagamento** (`getReceiptsByPaymentMethodForPeriod`,
  `room-bills.ts`): mesma lógica de totais já usada por
  `getRecentlyPaidRoomBills` (reconstrói o total de cada conta a partir
  das linhas de frigobar/comanda — nunca um total persistido), só que
  com um intervalo de datas flexível em vez de "últimos N dias", já
  agregada por forma de pagamento.
- **CMV e margem bruta** (`getBarFrigobarCmvForPeriod`, Leva 6, seção
  28.2) e **custo do café da manhã** (`getBreakfastCostForPeriod`,
  Leva 5) — reaproveitados como já estavam, sem nenhuma mudança.
- **Saldo de estoque** (`getInventoryStockReport`, Leva 3/5) e
  **custos por centro/despesas por item** (`getCostCentersSummaryForPeriod`)
  — idem, reaproveitados sem mudança.

### 29.4 Testado

- `npm run build`/`npm run lint` limpos.
- Sessão autenticada real (login local + cookie `sb-127-auth-token`):
  tela `/contabil/exportacoes?from=2026-09-01&to=2026-09-30` (período
  escolhido de propósito por conter a única conta paga real do banco
  local) confirmada mostrando os 7 cards corretamente, sem erro:
  "Receitas de bar e frigobar" mostrando R$133,00 (soma exata dos itens
  de frigobar + comanda da conta real: R$7+R$6+R$30+R$90) — valor
  deliberadamente SEM a taxa de serviço de 10%, já que isso é receita
  de item vendido, não recebimento de caixa; "Recebimentos por forma de
  pagamento" mostrando 1 forma de pagamento (a conta real foi paga antes
  da Parte 41 do app principal exigir essa forma, então aparece como
  "—", corretamente) com o total JÁ incluindo a taxa de serviço
  (R$145,00 = R$133,00 + 10% sobre os R$120,00 de comanda) —
  confirmando a distinção proposital entre "receita" (sem taxa) e
  "recebimento" (com taxa, é o que o caixa de fato recebeu). Demais
  cards (custos por centro, despesas por item, estoque, CMV, café da
  manhã) confirmados exibindo contagens/valores plausíveis a partir dos
  dados reais do período, sem nenhum erro de aplicação.
- Checado, antes de fechar esta leva, que nenhum resíduo de teste
  ficou no banco local de nenhuma leva anterior (`ledger_entries`,
  `inventory_items`, `cost_items`, notas de `expenses` com "teste") —
  todos zerados, confirmando a lição da Leva 6 (apagar o lançamento
  contábil junto da despesa de teste) foi aplicada corretamente em
  todos os testes desta leva.

## 30. Resumo final das 7 levas

Com a Leva 7, a implementação completa do Módulo Contábil aprovada em
15/10/2026 está concluída:

1. **Plano de contas contábil + partidas dobradas** — fundação do motor
   de débito/crédito, sem mexer nas telas existentes.
2. **Compras/despesas reformuladas + fornecedores + contas a pagar** —
   lançamento contábil automático por trás de toda compra/despesa.
3. **Estoque com saldo em R$** — custo médio ponderado móvel, derivado
   dos movimentos, nunca um valor à parte que possa desviar.
4. **Estoque desce no pedido, não no pagamento** — comanda/frigobar
   baixam na hora; cancelar pergunta se recuperou ou perdeu.
5. **Fórmula de custo do café da manhã** — perecível × não perecível,
   "cafés servidos" como denominador correto.
6. **Menu consolidado + relatórios** — tudo dentro de "Módulo Contábil";
   saldo de caixa/banco e CMV/margem de bar+frigobar, novos.
7. **Exportações CSV pro sistema financeiro** — 7 categorias de dados,
   com metadados de conciliação; API de verdade fica pra depois.

Nenhuma leva pulou teste: cada uma foi exercitada via sessão
autenticada real (ou rota de API temporária, sempre removida depois)
contra o banco local via Docker, com fixtures fabricadas e limpas ao
final — nunca contra dados reais de produção, já que este módulo
inteiro vive na branch `feature/compras`, ainda não mesclada em `main`
nem implantada. Um bug real foi encontrado e corrigido em cada uma das
Levas 2, 4 e 5 (ver seções 24.3, 26 e 27.4 respectivamente), sempre
durante o próprio teste da leva em que foi introduzido — nenhum deixado
para trás. Esta branch ainda precisa ser revisada e mesclada em `main`
pelo proprietário antes de qualquer coisa aqui chegar à produção.

> **Correção posterior**: o proprietário apontou, depois da entrega,
> que o resumo acima não era inteiramente fiel — pontos do documento
> original ficaram sem implementar. Cada um está registrado, um por um,
> na seção 31 abaixo, à medida que é tratado.

## 31. Correções de aderência ao PRD (pós-Leva 7)

Depois da entrega das 7 levas, o proprietário (16/10/2026) apontou que
alguns pontos do documento original (seção 22.1) não tinham sido
cumpridos. Esta seção registra cada um, na ordem em que foi tratado —
com a causa (quase sempre uma omissão minha, não uma decisão
consultada), o que mudou e o que ainda depende de decisão dele.

### 31.1 Quinto centro de custo obrigatório — "Administração e áreas comuns"

**O que o PRD pede** (seção 2.1 do documento original): cinco centros
obrigatórios, que não podem ser fundidos nos relatórios — Hospedagem,
Café da manhã, Bar da piscina, Frigobar e **Administração e áreas
comuns** ("custos administrativos e gastos compartilhados não
atribuíveis diretamente a um dos quatro centros anteriores"). A
implementação tinha só os quatro primeiros (herdados do Plano de
Contas da Parte 21) — o quinto simplesmente passou despercebido nas
7 levas, nunca foi uma decisão consultada.

**O que mudou**: migration `074_centro_administracao_areas_comuns.sql`
(idempotente — `cost_centers.name` é único), espelhada no seed do
`schema.sql` pra instalações novas. O centro aparece sozinho em
"Plano de itens de custo" (Listas → Plano de Contas), no seletor de
centros ao criar/editar um item de custo e ao lançar uma compra com
item novo, e nos relatórios assim que tiver gasto. Nenhum código
precisou mudar: tudo que lê centros é dinâmico (a contagem de estoque
já esconde centros sem item de estoque ligado, então este não polui a
tela). Só os textos de "Questões e Respostas" que diziam "4 centros"
foram atualizados.

**Decisão do proprietário (16/10/2026)**: só os itens claramente
administrativos passam 100% pro novo centro — contabilidade, financeiro,
pró-labore, honorários da Stays, honorários da Invictos, impostos e
taxas (migration `075`). Luz, água e internet continuam onde estão. Os
vínculos item→centro são lidos ao vivo, sem histórico de vigência: mover
esses itens re-atribui também os períodos passados deles (ele aceitou).

### 31.2 Cadastro de produtos (PRD seção 5.1) — implementado

**Causa**: o documento original pede um Cadastro de produtos (seção 5.1
e item "Cadastros" do menu) e as 7 levas não o construíram — omissão
minha, nunca uma decisão consultada.

**Decisões do proprietário (16/10/2026)**:
1. **Tela única** "Cadastro de produtos" (Módulo Contábil → Cadastro de
   produtos) que edita juntos o item de custo e, se controla estoque, o
   item de estoque ligado — sem uma terceira entidade.
2. **Conversões de unidade valem de verdade**: na compra e na ficha
   técnica.
3. **Validade**: campo no produto + data de validade por compra +
   alerta de vencimento próximo (o mais antigo sai primeiro).

**Modelo** (migrations `076` e `077`):
- `cost_items` ganhou `is_product`, `sku` (único quando preenchido),
  `description`, `category_id` e `product_type` (revenda, ingrediente
  de receita, material de consumo, material de limpeza, embalagem,
  outro). Um gatilho garante "controla estoque ⇒ é produto". Itens que
  já controlavam estoque viraram produtos; os demais (salário, luz,
  honorários) continuam só no Plano de itens de custo, que passou a
  mostrar produtos somente-leitura com link para o cadastro.
- `product_categories` (tabela editável pelo admin), semeada com 7
  categorias a partir dos nomes dos antigos subcentros (80 de 81 itens
  classificados automaticamente).
- Unidade-base e conversões (`inventory_item_unit_conversions`, ex.:
  1 garrafa = 0,75 L). Pares métricos (L↔ml, kg↔g) são entendidos sem
  cadastro. A unidade-base não muda depois que há histórico.
- **Regra de ouro**: tudo que o sistema calcula (saldo, custo médio,
  baixa pelo pedido, relatórios) continua na unidade-base. A unidade de
  compra digitada (ex.: "caixa") e a unidade da receita (ex.: ml) são
  convertidas na hora de salvar; o que foi digitado fica guardado só
  para exibição (`expense_items.purchase_*`, `display_unit` da ficha).
- Validade: `inventory_items.shelf_life_days` e `expiry_alert_days`;
  `expense_items.expiry_date` (se em branco e o produto tem prazo, é
  calculada: data da compra + prazo). Tela **Estoque → Validade dos
  produtos** e aviso na página Estoque. Como o estoque não guarda lote
  físico, o consumo é atribuído sempre ao lote que vence primeiro
  (FIFO); o que foi comprado sem validade não gera alerta.
- Produto com histórico (compras, estoque, ficha técnica) **não é
  excluído**, só desativado — vale também para `deleteCostItem`.

**Testes** (banco local, sessão real de admin): compra de 2×4 garrafas
(0,75 L) → saldo 6 L, custo médio R$ 44,00/L, valor R$ 264,00; ficha
técnica de 100 ml → gravada como 0,1 L e exibida como 100 ml; baixa de
4 L → lote que vencia em 5 dias zerado (FIFO), lote de 90 dias fora do
aviso; exclusão de produto com histórico recusada, sem histórico aceita;
fixtures e lançamentos contábeis removidos. `tsc`, `eslint` e
`npm run build` limpos.

**Ainda não existe**: tela de gestão de fornecedores (hoje só se criam
na hora da compra) — candidata ao item "Cadastros" do menu.

### 31.3 Telas separadas: Compra e Despesa (PRD seções 4.1 e 4.2)

**Causa**: o documento original pede duas telas — Compras (itens, produto,
quantidade, unidade, estoque) e Despesas (categoria, centro, valor,
rateio, copiar recorrente). As 7 levas entregaram uma tela só ("Lançar
compras e despesas"), com a despesa como um "valor total" escondido
quando não havia itens. Omissão minha.

**O que mudou**: o mesmo formulário agora tem dois modos, com telas e
itens de menu próprios no Módulo Contábil:
- **Lançar Compra** (`/compras/nova`): só itens (produto/item de custo,
  novo item ou ativo permanente), com unidade de compra e validade; pelo
  menos 1 linha obrigatória. O funcionário de manutenção continua com a
  dele (`/manutencao/compras`).
- **Lançar Despesa** (`/despesas/nova`): categoria (só itens de custo
  que não são estoque), descrição, valor, fornecedor/prestador opcional,
  pagamento/vencimento, anexo e observações. Mostra a divisão da
  categoria entre centros de custo (o rateio vem do Plano de itens de
  custo; a soma é sempre 100%). **Copiar despesa anterior** preenche
  categoria, descrição, valor e fornecedor de uma das 30 despesas
  recentes, sem gerar pagamento.
- Editar (`/historico/compras/[id]/editar`) escolhe o modo sozinho:
  despesa só se for uma linha única, sem ajustes, em categoria que não é
  estoque nem ativo; o resto edita-se como compra.

Nada muda no banco nem na contabilização (mesma `createExpense`,
mesmos lançamentos). Ainda não existe rateio *por lançamento* diferente
do rateio da categoria — se quiser, é a próxima evolução.

### 31.4 Reorganização de menus (17/10/2026)

Pedido do proprietário:
- **Cadastro de produtos** passou a ser a única tela de produtos:
  absorveu "Itens de estoque e ciclo de compras" (saldo, custo médio,
  valor, dias de folga, perecível, mínimo) e "Plano de itens de custo".
  Os itens de custo que não são produto (salário, luz, honorários…)
  ficaram numa seção própria da mesma tela. As telas antigas foram
  removidas (`/compras/itens`, `/checklists/plano-de-contas/*`).
- **Centros de custo** foram para o final de "Plano de contas e centros
  de custos" (`/contabil/plano-de-contas`).
- **Plano de itens de ativo permanente** foi para o Módulo Contábil
  (`/contabil/plano-ativo-permanente`); o menu "Plano de Contas" de
  Listas deixou de existir.
- Novo **Módulo operacional** (`/operacional`) no menu do admin, com:
  Resumo operacional (ex-Resumo executivo), Planejamento diário,
  Chegadas & saídas, Mesas do café, Consumo de Bar e Frigobar, Listas,
  Manutenção Preventiva e Histórico. O menu lateral do admin ficou com
  Módulo operacional, Módulo Contábil, Usuários e Questões e Respostas.
  As rotas das telas não mudaram.

**Ajuste posterior (17/10/2026)**: os itens de custo que não são produto
(salário, luz, honorários…) saíram do Cadastro de produtos e ganharam a
tela própria **Cadastro de despesas** (`/contabil/despesas`), logo abaixo
de "Cadastro de produtos" no Módulo Contábil.

### 31.5 Menus do Módulo Contábil, motor de lançamentos e relatórios (17/10/2026)

**Verificação honesta pedida pelo proprietário**: antes desta leva, só
**compra/despesa** gerava lançamento contábil automático. Consumo de
bar/frigobar, café da manhã, baixa manual e ajuste de inventário **não
geravam** (estoque e conta de consumo já existiam, mas sem partidas
dobradas). Isso foi corrigido na migration `078`.

**Menus** (rotas movidas, nenhum dado mexido):
- Hub do Módulo Contábil: Lançar Compra, Lançar Despesa, Lista de
  compras, *Produtos com data de validade próximo ao vencimento*, Estoque,
  Ativo Permanente, Pagamentos e recebimentos, *Demonstrativos e
  Relatórios*, *Listas contábeis*, Exportações.
- **Listas contábeis** (`/contabil/listas`): Cadastro de produtos,
  Cadastro de despesas, Plano de contas e centros de custo, Plano de itens
  de ativo permanente, Ficha técnica de petiscos e drinks.
- **Demonstrativos e Relatórios** (`/contabil/demonstrativos`):
  Demonstrativo de despesas, Demonstrativo de Custos, Balancete analítico,
  Balancete sintético, Livro Diário, Livro Razão, Livro caixa e bancos. O
  menu "Custos e Despesas" foi apagado. "Contagem de estoque" virou
  **Inventário** (`/compras/inventario`).

**Motor de lançamentos (tudo por gatilho no banco)**:
- `ledger_entry_lines.cost_item_id`: cada linha sabe de qual produto ou
  despesa veio (base do balancete analítico).
- Compra: Dr conta de estoque do produto (centralizado, sem centro) / Cr
  caixa, banco ou fornecedor. Linha marcada **"Para o café da manhã"**
  (`expense_items.for_breakfast`): Dr Custo do café da manhã (centro Café
  da manhã) direto e a linha **não** entra no estoque.
- Despesa: Dr conta da despesa rateada nos centros pelo rateio do cadastro
  (ver 31.6 — fonte única).
- Consumo de bar/frigobar: Dr CMV / Cr estoque no momento do pedido,
  centro = onde foi consumido (`inventory_movements.consumption_center_id`,
  carimbado pelas funções de comanda/frigobar). Ao **fechar** a conta:
  Dr Consumos a liquidar / Cr receitas (petiscos, bebidas, drinks,
  frigobar) + taxa de serviço 10% em "Salários/encargos a pagar"; ao
  **reabrir**, estorna; ao **pagar**, Dr caixa (dinheiro) ou banco /
  Cr Consumos a liquidar.
- Baixa manual: agora pergunta **pra onde foi** (centro de custo ou
  perda/quebra); Dr conta de custo do destino / Cr estoque.
- Inventário concluído: falta → Dr Perdas / Cr estoque; sobra, o inverso.
- Cada linha do plano de contas dos produtos/despesas é **obrigatória e
  editável** (Cadastro de produtos e Cadastro de despesas).

**Cadastro de despesas reformulado** (migration `079`): os 95 itens que
estavam lá foram revisados — 19 ficaram como despesas de verdade (luz,
água, gás, internet, salários, honorários, impostos, etc., cada um ligado
a uma conta); 12 ferramentas (alicates, chaves, martelos, trenas, serrinha,
escada, medidores, outras ferramentas) viraram **itens do catálogo do ativo
permanente** (categoria "Ferramentas e utensílios duráveis"); os demais
(materiais de manutenção/jardinagem como adubo, alimentos do café,
descartáveis, louças, limpeza) viraram **produtos** com estoque
centralizado e conta de estoque.

**Relatórios**: lidos direto do livro (nunca persistem), todos com seletor
de período e exportação **CSV, XLSX, RTF e PDF** (`src/lib/report-export.tsx`,
`exportReport`). Balancetes têm periodicidade diária/mensal/anual e saldo
acumulado na natureza da conta. Livro caixa e bancos: filtros de período,
caixa/banco, texto da descrição e faixa de valor; o saldo é sempre o saldo
real da conta.

**Limitações conhecidas**: (1) o "Demonstrativo de Custos" ainda usa a
cascata antiga (regime de caixa pelo % do item de custo), não o livro — pode
divergir do balancete; o "Demonstrativo de despesas" já é lido do livro.
(2) Lançamentos feitos antes desta leva não têm `cost_item_id` nem
lançamentos de consumo/baixa retroativos (o módulo ainda não está em
produção). (3) O balancete analítico mostra o item só onde o lançamento
tem item (compras, despesas, baixas, consumos, inventário).

**Testes** (banco local, sessão real de admin): compra de estoque, compra
para o café (sem movimento de estoque), despesa com rateio 60/40, baixa
manual para o café e como perda, consumo de frigobar e bar (centros
certos), ajuste de inventário (falta e sobra), conta de bar+frigobar
fechada → reaberta → fechada → paga (receita, serviço, estorno e
recebimento no banco) — todas as partidas bateram e a soma de débitos
menos créditos do livro deu zero. As quatro exportações geraram arquivos
válidos (CSV com BOM, XLSX/PK, RTF, PDF). Fixtures removidas.

### 31.6 Fonte única de rateio, cadastros como única origem e Custos pelo livro (17/10/2026)

Decisões do proprietário:
1. **Uma só fonte de rateio** (`cost_item_centers`): o rateio por lançamento
   criado na 31.5 foi **removido** (migration `080` apaga
   `expense_items.center_split`). Rateio e conta do plano de contas são
   definidos **só** nos cadastros de produtos e de despesas. Perdas e
   ajustes de inventário (sem destino explícito) também seguem esse rateio
   (antes usavam só o centro principal). O Demonstrativo de Custos mostra
   o rateio cadastrado ao lado dos valores e permite editá-lo (lápis) — é o
   mesmo dado dos cadastros; a edição vale para os próximos lançamentos.
   Verificado: os 164 itens existentes mantêm o rateio (soma 100%).
2. **Lançamento nunca cria cadastro ad hoc**: o tipo de linha "criar novo
   item de custo" (com centros e % digitados) foi eliminado; o servidor
   recusa linha sem produto/despesa existente. O admin pode abrir o
   cadastro completo de produto ou de despesa de dentro do lançamento
   (botões "Cadastrar novo produto/despesa"); manutenção só escolhe o que
   existe. A leitura de nota por IA só enquadra cada item num produto já
   cadastrado (ou deixa sem correspondência — nunca inventa).
3. **Demonstrativo de Custos lido do livro contábil**: centros, rateio por
   item, café da manhã e CMV/margem do bar+frigobar agora somam as linhas do
   livro (mesma base dos balancetes), então os dois sempre batem. O custo de
   um produto de estoque aparece quando é consumido (o centro vem de onde foi
   consumido), não na compra.

Testes (local, sessão real de admin): linha sem produto recusada; compra de
estoque (Dr estoque 1.05); luz R$ 100 rateada 25/25/25/25 pelo cadastro; perda
de 2 un do açúcar (cadastro 50% bar / 50% café) → R$ 5 em cada centro;
Demonstrativo de Custos e balancete abrindo com os dados. Fixtures removidas.

### 31.7 Menus do admin: Sincronização, Integração e Listas operacionais (17/10/2026)

- **Sincronização** (`/sincronizacao`, menu principal): os botões de
  sincronização com a Stays (Total/Parcial) saíram do Resumo operacional.
- **Integração** (`/integracao`, logo após Sincronização): "Cadastrar e-mail
  de envio" e "Chaves de acesso — API de consumos" (antes no Resumo
  operacional).
- **Comissões das camareiras** (`/operacional/comissoes`): agora no menu do
  Módulo operacional, logo após "Consumo de Bar e Frigobar".
- **Listas operacionais** (antes "Listas"): "Consumo de Frigobar" virou
  "Cardápio de frigobar", "Bar da Piscina" virou "Cardápio de bar da piscina"
  e os cinco checklists (Arrumação, Troca, Saída com Chegada, Somente Saída,
  Somente Chegada) foram para o submenu "Check lists de serviços nas suítes"
  (`/checklists/servicos-suites`). Rotas dos checklists não mudaram.

### 31.8 Novo papel: gerente operacional (17/10/2026)

Papel `gerente_operacional` (migrations `081` e `082`), criado em Usuários.
Vê só **Módulo operacional**, **Módulo Contábil** e **Sincronização**:
- Módulo operacional: Resumo operacional (só "Serviços nas suítes" e "Suítes
  vagas e limpas", sem os cards do topo), Planejamento diário, Chegadas &
  saídas, Mesas do café, Consumo de Bar e Frigobar (só leitura) e Comissões
  das camareiras.
- Módulo Contábil: Lançar Compra, Lista de compras, Produtos com data de
  validade próximo ao vencimento e Baixa de estoque (que fica direto no
  hub contábil pra ele). Sem saldos de caixa/banco.
- **Segurança em camadas**: o proxy só deixa o gerente abrir as telas acima
  (qualquer outra volta pra /operacional); o banco só dá a ele as permissões
  dessas telas (`is_admin_or_gerente()` nas políticas necessárias, SELECT
  apenas em consumo; nota de qualidade da camareira por função própria
  `set_service_quality_score`, sem poder editar perfis); e as Server
  Actions sensíveis (usuários, sincronização manual) conferem o papel. Ele não
  cadastra produto/despesa na hora do lançamento (só o admin).
- Testado com um gerente real: acessa as 15 telas permitidas e é
  redirecionado nas outras 13 testadas; consegue planejar, lançar chegada,
  anotar mesas, dar nota, baixar estoque e lançar compra; é negado ao
  excluir usuário.

## 32. Colocação em produção (17/10/2026)

Registro do que foi feito para levar a branch `feature/compras` ao `main`/produção.
Roteiro, ensaio, riscos e formas de voltar atrás: **`PLANO_DEPLOY_PRODUCAO.md`**.

**Estado antes do merge**: `main` = `bdce9ad` (Parte 48, fotos em ocorrência);
produção na Vercel = deploy `dpl_23hAXZ2HtazGYPtKefqDycbTRGnc`. A branch trazia 30
migrations (053 a 082) e ~170 arquivos alterados que o banco de produção não tinha.

**Preparação feita**:
- Ponto de retorno: tag `producao-antes-modulo-contabil` e branch
  `backup/main-antes-modulo-contabil` no GitHub (ambos em `bdce9ad`).
- SQL consolidado em `supabase/producao/`: etapa A (enums, fora de transação),
  etapa B (migrations 054–082, numa transação só) e reverter (restaura as três
  funções de comanda com a assinatura antiga; desliga os gatilhos contábeis).
- **Ensaio** numa cópia do banco com o schema do `main`: etapas A e B rodaram sem
  erro e o resultado ficou idêntico ao banco local (mesmas colunas e políticas);
  o reverter devolveu `cancel_comanda(uuid)`/`submit_comanda`/`edit_comanda` à forma antiga.
- Documentação atualizada: `README.md` (variável opcional `ANTHROPIC_API_KEY`,
  seção 5.1, mapa de menus), `CLAUDE.md` (item 56 e mapa de arquivos) e este PRD.

**O que só o proprietário pode fazer** (o Claude Code não tem acesso ao painel do
Supabase de produção): backup, rodar as etapas A e B e confirmar. O push do `main` só
deve acontecer depois, pois o código novo exige as tabelas/funções novas.

**Por que o app antigo ainda funciona depois das migrations**: todas as mudanças são
aditivas (tabelas, colunas, funções, gatilhos novos), exceto `cancel_comanda`, que
mudou de assinatura — o script de reverter a restaura.
