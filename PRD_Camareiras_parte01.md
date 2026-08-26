# PROJECT ARCHITECTURE: Camareiras Vila Corada

> Esta é a versão atualizada do PRD original (`PRD Camareiras.rtf`), revisada para
> refletir todas as decisões e alterações de requisitos feitas ao longo do
> desenvolvimento do web app até o presente momento. A seção 8 lista, em
> detalhe, tudo que mudou em relação ao documento original.

## 1. CONTEXT & PROBLEM

O trabalho das camareiras é essencial para a qualidade do serviço de
hospedagem em uma pousada. Porém, quando se trata de pousadas pequenas, quando
os proprietários são quem supervisionam eles mesmos, normalmente essa
supervisão se dá de forma pouco organizada e sem um sistema de registro das
atividades, que forme uma base de dados de consulta. O resultado é que, muitas
vezes, pela falta de organização, o proprietário se perde no controle da
atividade das camareiras e, ao não possuir uma base de dados de consulta,
também não consegue fazer uma análise mais assertiva das causas de eventuais
ocorrências.

## 2. PROPOSED SOLUTION

### O QUE FOI CONSTRUÍDO

Um web app de gestão do serviço das camareiras que permite ao
proprietário/admin estabelecer a ordem dos trabalhos diários, definindo quais
suítes no dia seguinte (ou no próprio dia, ver seção 8) necessitarão de:

- **Arrumação** — limpeza simples de quarto já ocupado por hóspede;
- **Preparação Chegada** — preparação completa do quarto para a chegada de um
  novo hóspede;
- **Troca** — troca de roupa de cama e toalhas de um quarto ocupado, sem
  necessidade de arrumação completa.

O admin também define a quantidade de mesas do café da manhã a serem
preparadas para o dia seguinte, a quantidade de hóspedes por mesa (até 10 por
mesa), observações por mesa, e o layout editável (arrastável) das mesas.

**Diferente da concepção original do PRD, o admin não escolhe mais qual
camareira vai realizar cada trabalho** (ver seção 8.1) — ele apenas define
quais quartos precisam de qual tipo de trabalho no dia; cada camareira, ao
logar, vê a lista de quartos ainda sem responsável e escolhe ela mesma qual
quarto vai realizar. Uma vez escolhido, o quarto sai da lista de disponíveis
para as demais.

O proprietário(admin) pode editar, incluindo, alterando ou excluindo, a lista
de quartos da pousada (que começa com 11 quartos, numerados de 1 a 11); pode
também editar a lista de mesas disponíveis para o café da manhã, o layout das
mesas, a lista de camareiras, os checklists de arrumação/preparação
chegada/troca, as categorias de ocorrências manutenção e o valor por mesa de
café da manhã da comissão das camareiras.

O web app também tem como usuárias as camareiras, que acessam a lista de
quartos disponíveis para arrumação, preparação chegada ou troca no dia,
escolhem qual quarto vão realizar, e então acessam o checklist daquele quarto,
em que dão um check em cada item e, ao final, podem registrar alguma
ocorrência manutenção durante o trabalho e adicionar observações finais, com
um botão de liberação/assinatura de entrega do quarto ao final — a partir do
que fica registrado no sistema quem fez o trabalho em cada quarto em cada dia.
As ocorrências manutenção estão predefinidas em categorias, com uma caixa de
seleção para a escolha por parte da camareira. Elas também têm acesso apenas
para visualização ao layout das mesas que serão arrumadas no dia (hoje e
amanhã), à quantidade de hóspedes por mesa e às observações que o admin
inseriu para cada mesa. Também têm acesso de leitura à tela de Chegadas &
Saídas (ver seção 8.4). As camareiras não têm acesso a mais nenhum dado, nem
podem editar ou realizar qualquer tarefa a não ser marcar como feito cada item
do checklist, registrar ocorrências manutenção, escolher qual quarto vão
realizar entre os disponíveis, além de poder selecionar seu login e inserir
sua senha na tela de login.

O proprietário/admin pode visualizar um dashboard com resumo do trabalho de
arrumação, preparação chegada e troca do dia, quais quartos foram
finalizados, quantas ocorrências manutenção foram registradas hoje (com links
para o detalhe do dia e para o histórico de 30 dias), o resumo dos quartos
para o dia seguinte, o layout de mesas de café da manhã do dia e do dia
seguinte (com hóspedes e observações por mesa), e a totalização mensal de
mesas de café e da comissão das camareiras.

O proprietário admin tem acesso a uma tela, em formato de tabela, com dados
históricos filtráveis por período, de: quantidade de mesas de café da manhã,
quantidade de hóspedes de café da manhã, quantidade de quartos
arrumados/preparados/trocados (total e por camareira), quantidade de
ocorrências manutenção (total e por camareira), o ranking das 10 categorias de
ocorrência manutenção mais frequentes no período, e o valor da comissão das
camareiras — tudo exportável em CSV.

O proprietário/admin pode editar a lista de quartos, os itens dos checklists
de arrumação/preparação chegada/troca, bem como as categorias de ocorrências
manutenção, criando, alterando ou excluindo itens. As categorias de
ocorrências manutenção iniciais são: cama, cortina, parede quarto, parede
banheiro, porta quarto, porta banheiro, janela banheiro, janela quarto,
iluminação quarto, iluminação banheiro, tomada quarto, tomada banheiro,
aparelho de TV, ar condicionado, secador de cabelo, máquina de café, pia,
chuveiro, vaso sanitário, vidro do box, bancadas, piso quarto, piso banheiro,
forro quarto, forro banheiro, ralo, espelho, **mau cheiro quarto** e **mau
cheiro banheiro**. Cada quarto contém itens próprios de checklist de
arrumação/preparação chegada/troca, sendo possível ter listas distintas para
cada tipo de trabalho.

### DIFERENCIAIS

Interface moderna e minimalista com shadcn/ui, dashboard visual com gráficos,
filtros por período, deploy contínuo na Vercel (já em produção). Todo o
desenvolvimento foi guiado pelo Claude Code como agente de codificação.

A aplicação é responsiva (com menu mobile em Sheet), com autenticação via
Supabase Auth e dados persistidos no Supabase (PostgreSQL), protegidos por Row
Level Security.

## 3. FUNCTIONAL REQUIREMENTS

### FEATURES IMPLEMENTADAS

- Login e Autenticação
- Dashboard
- Planejamento diário (com seletor Hoje/Amanhã)
- Chegadas & Saídas (admin edita, camareira lê)
- Busca e Filtros (histórico por período)
- CRUD de itens (quartos, camareiras, checklists, categorias de ocorrência,
  mesas, comissão)
- Categorias e itens
- Gráficos (Recharts)
- Responsivo (Mobile)
- Landing Page
- Exportar CSV (histórico geral e ranking de categorias de ocorrência)
- Modo claro/escuro (dois temas escuros + claro)

### DETALHAMENTO DAS FEATURES

**Login e Autenticação**: Supabase Auth com nome/senha. Login exibe uma lista
pré-cadastrada de usuários (admin + camareiras ativas) para seleção — não é
digitado nome de usuário livremente. Proteção de rotas autenticadas e por
papel (admin vs. camareira) via middleware.

**Dashboard**: visão consolidada com cards (quartos concluídos hoje, mesas de
café hoje, comissão do mês, ocorrências manutenção hoje com links para
detalhe/histórico), listas de quartos de hoje/amanhã, gráfico mensal de
mesas/comissão, e visualização das mesas de café hoje/amanhã com observações.

**Planejamento diário**: admin define, quarto a quarto, se haverá arrumação,
preparação chegada, troca ou nenhum trabalho — para hoje ou amanhã (seletor de
data). A coluna "Camareira responsável" é somente leitura, mostrando
"Aguardando escolha" até uma camareira escolher o quarto, e destacando com cor
diferente quando o trabalho já foi entregue/assinado.

**Chegadas & Saídas**: tela exclusiva do admin (com seletor Hoje/Amanhã) para
cadastrar chegadas previstas (quarto, nome do hóspede, horário previsto,
observações) e saídas previstas (quarto, observações) do dia. Camareiras têm
acesso de leitura, com abas Hoje/Amanhã.

**CRUD de itens**: criar, editar e excluir camareiras, quartos, itens de
checklist (por tipo de trabalho), categorias de ocorrências manutenção, valor
da comissão das camareiras por mesa, mesas do café (incluindo layout
arrastável e observações por mesa). Campos de cadastro das camareiras: nome,
telefone, e-mail.

**Ocorrências Manutenção**: registradas pela camareira durante o trabalho em
um quarto, com categoria + descrição livre. Visíveis ao admin em duas telas:
detalhe (hoje/ontem, por quarto, e por data específica via
`/ocorrencias/[data]`) e histórico resumido de 30 dias (com ranking das 10
categorias mais frequentes). O histórico geral (`/historico`) também traz a
contagem de ocorrências por dia/camareira e o ranking das 10 categorias mais
frequentes no período filtrado, exportável em CSV.

## 4. USER PERSONAS

**Proprietário/admin** (um usuário): responsável por organizar o trabalho,
informando diariamente (ou com um dia de antecedência): os quartos que serão
arrumados, preparados (chegada) ou trocados, a quantidade de mesas do café da
manhã e o layout, a quantidade de hóspedes por mesa, as chegadas e saídas
previstas, bem como responsável pela criação de usuárias camareiras (podendo
resetar a senha de acesso de cada uma delas) e da lista de quartos existentes.
**Não atribui mais manualmente qual camareira realiza qual quarto** — essa
escolha passou a ser da própria camareira (ver seção 8.1). Faz login com a
opção "admin", já predisponível no campo de usuário da tela de login, com
senha própria.

**Camareiras** (uma ou mais usuárias): acesso restrito para visualização da
lista de quartos disponíveis (ainda sem responsável) para arrumação,
preparação chegada ou troca no dia, a quantidade de mesas do café da manhã e o
layout, a quantidade de hóspedes e observações por mesa, e as chegadas/saídas
previstas. Escolhem, dentre os quartos disponíveis, qual vão realizar; ao
escolher, o quarto some da lista para as demais camareiras. Preenchem o
checklist de arrumação/preparação chegada/troca daquele quarto, registram
ocorrências manutenção e observações finais, e assinam a entrega
(liberação) do quarto ao final. Fazem login com seu nome de usuário e senha,
porém o web app somente permite login de usuária camareira previamente criada
pelo admin, já constando o nome pré-cadastrado no campo de usuário da tela de
login (assim como a opção "admin").

## 5. TECHNICAL STACK

### TECNOLOGIAS SELECIONADAS

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui (sobre `@base-ui/react`)
- Supabase (Postgres + Auth + Row Level Security)
- Vercel
- Claude Code
- Recharts
- next-themes
- Git / GitHub

### DETALHES DA STACK

**Frontend**: Next.js 16 (App Router) com TypeScript, Tailwind CSS v4 e
shadcn/ui para componentes de UI. Gráficos com Recharts. Alternância de tema
(claro / escuro-bordô / escuro-azul) com `next-themes`.

**Backend/BaaS**: Supabase (PostgreSQL + Auth + Row Level Security). Sem
backend separado — toda mutação passa por Server Actions do Next.js, que usam
o cliente Supabase autenticado do usuário (RLS aplicada) ou, quando
necessário (criação/edição de login de camareiras), o cliente com service
role key, nunca exposto ao navegador.

**Deploy**: Vercel (integração contínua via GitHub, branch `main`) — já em
produção.

**Desenvolvimento**: Claude Code como agente de codificação. Versionamento
com Git/GitHub.

## 6. DESIGN LANGUAGE

### INSPIRAÇÕES VISUAIS

shadcn/ui Dashboard Template como referência de layout de dashboard moderno,
minimalista e responsivo. Interface clara e limpa, fontes sem serifa para
texto, cards com bordas suaves.

**Logo**: arquivos oficiais fornecidos (isotipo da palmeira) — versão em
vinho/bordô (`public/vila-corada-logo.png`) usada sobre fundos claros, versão
em creme (`public/vila-corada-logo-dark.png`) usada nos dois temas escuros. A
troca é automática conforme o tema ativo (componente `BrandLogo`). Proporção
dimensional original preservada.

**Paleta de cores** (arquivo "Vila Corada_BG.pdf"):
- Modo claro: fundo base `#F9F9F7`; texto `#5A2025`; secundária `#3B4564`;
  destaque `#2D331F`.
- Modo escuro · Bordô: fundo base `#5A2025`; texto `#F9F9F7`; secundária
  `#2D331F`; destaque `#3B4564` (secundária/destaque invertidas em relação ao
  modo claro — ver seção 8.6).
- Modo escuro · Azul (novo, não previsto no PRD original — ver seção 8.6):
  fundo base `#3B4564`; texto `#F9F9F7`; secundária `#2D331F`; destaque
  `#5A2025`; variação sutil entre fundo, cards/popover e sidebar seguindo a
  mesma estratégia proporcional do modo escuro-bordô.
- Círculos e retângulo do desenho das mesas do café: sempre `#F9F9F7` nos dois
  modos escuros (com texto na cor base do tema para contraste); mantêm a cor
  original no modo claro.

**Tipografia**: fonte de títulos prevista é **"The Seasons"** (fonte paga, da
foundry My Creative Land); como os arquivos não estavam disponíveis no
projeto, o app usa **Playfair Display** (Google Fonts) como substituta visual
até que os arquivos oficiais sejam adquiridos e adicionados (ver seção 8.7).
Fonte de textos: **Montserrat**, conforme especificado.

**Layout das mesas**: referência de conteúdo o desenho do arquivo "Layout das
Mesas.pdf" (9 mesas: 6 redondas, 1 retangular, seguindo a mesma disposição).
Capacidade de hóspedes por mesa ampliada para até 10 (ver seção 8.5),
independente do formato/tamanho da mesa.

**Checklists**: referência de conteúdo o arquivo "Check List.pdf" para os
itens de arrumação e preparação chegada; o checklist de Troca foi criado do
zero (não havia referência no PRD original — ver seção 8.2), com 9 itens
focados em troca de roupa de cama e toalhas.

## 7. PROCESS

- Build do app dividido em marcos lógicos (milestones)
- Cada marco é um incremento entregável
- Priorização da funcionalidade core primeiro, depois iteração
- Cada marco testado antes de avançar para o próximo
- Todas as mudanças de schema do banco documentadas em
  `supabase/migrations/*.sql`, numeradas sequencialmente, para aplicação no
  projeto Supabase já provisionado

---

## 8. REGISTRO DE ALTERAÇÕES EM RELAÇÃO AO PRD ORIGINAL

Esta seção documenta, em ordem cronológica de decisão, tudo que mudou em
relação ao `PRD Camareiras.rtf` original durante o desenvolvimento.

### 8.1 Camareira escolhe o próprio quarto (mudança de fluxo)

O PRD original previa que o admin "estabelece a ordem dos trabalhos diários"
e, na prática inicial da implementação, também atribuía manualmente qual
camareira faria qual quarto. Isso foi revisado: **o admin só define quais
quartos precisam de qual tipo de trabalho no dia**; cada camareira, ao entrar
em "Meus quartos", vê os quartos ainda disponíveis (sem responsável) e escolhe
ela mesma qual vai realizar, com proteção contra duas camareiras escolherem o
mesmo quarto simultaneamente. O campo "Camareira responsável" no Planejamento
diário virou somente leitura, mostrando quem escolheu e destacando em cor
diferente quando o trabalho foi entregue/assinado.

### 8.2 Terceiro tipo de trabalho: "Troca"

Adicionado um terceiro tipo de trabalho diário, **Troca** (troca de roupa de
cama e toalhas), além de Arrumação e Preparação. Inclui checklist próprio (9
itens) editável na tela de Checklists & Ocorrências Manutenção, disponível no
Planejamento diário, no fluxo de escolha da camareira, no dashboard e no
histórico.

### 8.3 Renomeação "Preparação" → "Preparação Chegada"

O tipo de trabalho antes chamado apenas de "Preparação" foi renomeado para
"Preparação Chegada" em todas as telas, para deixar mais claro que se trata da
preparação do quarto para a chegada de um novo hóspede (em contraste com
Arrumação e Troca, que são para quartos já ocupados).

### 8.4 Nova tela: Chegadas & Saídas

Funcionalidade não prevista no PRD original. Tela exclusiva do admin para
cadastrar, com seletor Hoje/Amanhã: chegadas previstas (quarto, nome do
hóspede, horário previsto, observações) e saídas previstas (quarto,
observações). Camareiras têm acesso de leitura (abas Hoje/Amanhã).

### 8.5 Mesas do café: limite de hóspedes e observações por mesa

- Quantidade de hóspedes por mesa passou a ter limite fixo de **10**,
  independente da capacidade ("lugares") configurada para a mesa (antes o
  limite seguia a capacidade configurada, ex.: 2 para mesas redondas).
- Adicionado campo de **observações por mesa/dia**, editável pelo admin,
  visível (somente leitura) para as camareiras na tela de mesas e também nos
  cards "Mesas · hoje" / "Mesas · amanhã" do dashboard do admin.

### 8.6 Segundo tema escuro

Além do modo claro e de um modo escuro (base `#5A2025`, cor da marca), foi
adicionado um segundo modo escuro (base `#3B4564`), seguindo a mesma
estratégia de variação tonal sutil entre fundo, cards/popover e sidebar. O
seletor de tema virou um menu com 3 opções (Claro / Escuro · Bordô / Escuro ·
Azul), disponível em todas as telas (landing, login, sidebar admin e
camareira, dashboard). As cores secundária e de destaque foram invertidas
entre si no modo escuro original para melhor legibilidade.

### 8.7 Fonte de títulos

A fonte "The Seasons", especificada no PRD original, é paga e seus arquivos
não estavam disponíveis no projeto. Foi usada **Playfair Display** (Google
Fonts) como substituta visual (mesma proporção serifada de alto contraste) até
que os arquivos oficiais sejam adquiridos (via MyFonts, Type Network ou
diretamente com a foundry My Creative Land) e adicionados ao projeto.

### 8.8 Logo

O logo inicialmente recriado à mão (SVG) foi substituído pelos arquivos
oficiais fornecidos (PNG, isotipo da palmeira), em duas versões de cor
(bordô para fundos claros, creme para fundos escuros), trocadas
automaticamente conforme o tema ativo. Padronizado o uso do lettering "Vila
Corada" / "CAMAREIRAS" ao lado do logo em todas as telas (landing, login,
sidebar).

### 8.9 Categorias de ocorrência manutenção adicionadas

Incluídas duas categorias não previstas na lista original do PRD: **"Mau
cheiro quarto"** e **"Mau cheiro banheiro"**.

### 8.10 Visibilidade de ocorrências e observações para o admin

O PRD original não detalhava como o admin acessaria as ocorrências e
observações registradas pelas camareiras durante o trabalho. Foi
implementado: renomeação de "Ocorrências" para **"Ocorrências Manutenção"**
em todas as telas; card no dashboard com contagem do dia e dois links —
detalhe (hoje/ontem por quarto, e por data específica) e histórico resumido
dos últimos 30 dias (incluindo ranking das 10 categorias mais frequentes). O
histórico geral (`/historico`) também passou a trazer contagem de ocorrências
por dia/camareira e o mesmo ranking de categorias mais frequentes no período
filtrado, ambos exportáveis em CSV.

### 8.11 Deploy em produção

O app já foi implantado na Vercel (deploy contínuo a partir da branch `main`
do GitHub), com as variáveis de ambiente do Supabase configuradas com boas
práticas de segurança (chave secreta nunca exposta ao navegador — usada
apenas em Server Actions).
