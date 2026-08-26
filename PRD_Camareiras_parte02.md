# PRD — Camareiras Vila Corada — Parte 02: Manutenção

> Segunda parte do projeto. Documenta os requisitos originais recebidos do
> proprietário para a inclusão do módulo de manutenção (ocorrências imediatas
> e manutenção preventiva) e o planejamento de desenvolvimento derivado
> deles. Enquanto o `PRD_Camareiras_parte01.md` registra o que já foi
> construído na primeira parte do projeto, este arquivo é a fonte de verdade
> para a segunda parte — deve ser atualizado com o mesmo changelog
> incremental (seção 4) conforme decisões forem tomadas durante o
> desenvolvimento, do mesmo jeito que a parte01 foi.

## 1. Objetivo desta segunda parte

Incluir no web app Camareiras a possibilidade de controlar as atividades de
manutenção, tanto aquelas imediatas (ocorrências de manutenção) quanto
aquelas programadas (manutenção preventiva). Essa atividade está relacionada
com o trabalho das camareiras porque são elas que, na maioria das vezes,
identificam ocorrências de manutenção durante o trabalho de arrumação e
preparação dos quartos — porém não são elas capacitadas para resolver essas
necessidades de manutenção imediatas, e sim funcionários próprios de
manutenção.

## 2. Requisitos originais (texto integral recebido do proprietário)

### 2.1 Funcionários de manutenção

- O admin poderá inserir outro tipo de usuário (um ou mais) chamado apenas
  de "Funcionários de Manutenção".
- A opção "Camareiras" no menu principal do admin passa a se chamar de
  "Usuários", e nessa mesma tela em que o admin cadastra as camareiras, ele
  irá cadastrar de forma análoga os funcionários de manutenção.
- Após cadastrados, os funcionários de manutenção poderão, da mesma forma
  que as camareiras, acessar o sistema na tela de login, em que seu nome
  constará disponível no campo usuário.

### 2.2 Telas dos funcionários de manutenção

#### 2.2.1 Tela de ocorrências de manutenção

- Os funcionários de manutenção terão uma tela chamada "Ocorrências de
  Manutenção", em que serão mostradas todas as ocorrências de manutenção do
  dia corrente e do dia anterior cadastradas pelas camareiras quando
  realizarem os trabalhos nos quartos. As camareiras cadastram as
  ocorrências de manutenção após preencherem o checklist na tela de cada
  quarto escolhido, na opção "Meus quartos" em seu menu principal.
- Na tela "Ocorrências de Manutenção" dos funcionários de manutenção deverá
  conter: o quarto em que se deu a ocorrência, a categoria da ocorrência
  cadastrada pela camareira, a descrição que ela colocou, o nome da
  camareira que cadastrou aquela ocorrência, a data e o horário de cadastro. Além
  disso, para cada ocorrência nessa tela, cada funcionário de manutenção
  escolhe a ocorrência de manutenção em que vai trabalhar, aparecendo para
  ele, mais embaixo, todos os dados da ocorrência acima referidos, mais a
  opção de "ocorrência resolvida", quando, caso selecionada pelo funcionario de manutencao, encerra a ocorrencia e a retira da tela do funcionario. Uma vez escolhida a
  ocorrência por um funcionário de manutenção, ela sai das opções
  disponíveis para os demais.
- No dashboard do admin, na tela de "Ocorrências Manutenção e Observações"
  acessada pelo link "ver detalhes" no card "Ocorrências de Manutenção
  hoje", deverá conter também, para cada ocorrência, a informação de que a
  ocorrência se encontra pendente, ou já foi selecionada, ou já foi
  resolvida, bem como todas as informacoes que constam para o funcionario de manutencao, tais como o quarto em que se deu a ocorrência, a categoria da ocorrência
  cadastrada pela camareira, a descrição que ela colocou, o nome da
  camareira que cadastrou aquela ocorrência, a data e o horário de cadastro da ocorrencia, mais a data e horario de encerramento da ocorrencia. Já na tela acessada pelo link "Histórico" do card "Ocorrências
  Manutenção hoje", onde mostra "Histórico de Ocorrências Manutenção" com o
  resumo dos últimos 30 dias, deve conter a informação de quantas
  ocorrências foram resolvidas naquele periodo.
- No dashboard do admin, na opção "Histórico" do menu principal, em que se
  pode consultar por período selecionado o resumo diário, colocar a
  quantidade de ocorrências de manutenção resolvidas no período selecionado,
  mostrando essa coluna logo após a coluna que mostra a quantidade de
  ocorrências de manutenção.
- As ocorrências de manutenção, somente quando marcadas como resolvidas pelo
  funcionário de manutenção, é que saem da tela de "Ocorrências de
  Manutenção" dos funcionários de manutenção e da tela "Ocorrências
  Manutenção e Observações" acessada pelo link "ver detalhes" no card
  "Ocorrências Manutenção hoje" do dashboard do admin. Ou seja, em ambas
  essas telas conterão no mínimo as ocorrências do dia corrente e do dia
  anterior, porém aquelas que ainda não foram resolvidas permanecerão em tais
  telas até que sejam marcadas como resolvidas pelo funcionário de
  manutenção.

#### 2.2.2 Tela de "Manutenção Preventiva"

- Os trabalhos de manutenção preventiva serão divididos em categorias, e
  estas em itens de manutenção — as diversas atividades de manutenção a
  serem realizadas em cada categoria, como por exemplo o item "troca do
  ânodo de sacrifício" da categoria "boiler da casa". Os itens de manutenção
  serão divididos entre aqueles que podem ser executados por pessoal não
  técnico internos (funcionários de manutenção) e por pessoal técnico externo.
- Os funcionários de manutenção terão uma segunda tela chamada "Manutenção
  Preventiva", em que serão mostrados primeiro os trabalhos de manutenção
  preventiva previstos para o dia corrente e para o dia seguinte,
  informando a descrição resumida de cada trabalho. Ocorre o mesmo processo de escolha de trabalhos de manutencao preventiva que o processo de escolha de ocorrencias de manutencao. Tambem devera haver o mesmo sitema de classificacao de pendente, selecionada, concluida.
  - Deverá haver um link em
  cada trabalho para uma tela de checklist de manutenção daquele trabalho —
  que contera dois check lists por categoria, um apenas com os itens de manutencao executáveis por funcionário não técnico (pelos funcionarios de manutencao) previstos para aquela data — em
  que o funcionário de manutenção dá um check em cada item do checklist
  realizado e, ao final, conclui o trabalho, ficando registrado qual foi o
  funcionário que concluiu aquele trabalho de manutenção e qual a data em que foi concluido; outro com os itens de manutencao executáveis por funcionário técnico externo, previstos para aquela data, apenas para leitura, ou seja, nao havendo possibilidade para
  que o funcionário de manutenção de um check em cada item do checklist
  realizado, mas, ao final, o funcionario de manutencao seleciona que o trabalho foi concluido, registrando em campo proprio, de isercao de texto, qual foi o tecnico externo que realizou aquele trabalho, ficando registrado qual foi o
  funcionário de manutencao que supervisionou aquele trabalho de manutenção por tecnico externo e qual a data em que foi concluido.
- Mais abaixo, na tela de "Manutenção Preventiva", deverá haver um resumo dos
  próximos trinta dias das categorias de manutenção e respectivos itens
  previstos para o período, tanto os executáveis por funcionários internos não técnicos
  (não técnicos) quanto os que exigem técnicos especializados (externos).
- As categorias de manutenção iniciais serão: ar condicionados, boiler da
  casa, boiler do prédio, bombas pressurizadoras, bomba de irrigação,
  cisterna, bomba do poço, fossa séptica prédio e fossa séptica chalés.
- Definir, com base nas melhores práticas do setor de hotelaria e de
  administração de propriedades, no máximo dez itens de manutenção para cada
  categoria acima, divididos entre executáveis por agentes técnicos e por
  não técnicos (funcionários de manutenção), com as respectivas
  periodicidades necessárias e descrições explicativas detalhadas.
- Os itens executáveis por agentes não técnicos comporão os checklists de
  manutenção preventiva exibidos aos funcionários de manutenção — eles
  apenas visualizam esses itens e a categoria a que se referem, podem marcar
  que o item foi realizado e, ao final, encerrar aquela manutenção
  preventiva. Os itens que só podem ser realizados por equipe técnica
  aparecerão em seguida na mesma tela, apenas para leitura e para informar a conclusao ao final.
- Para o admin, deverá haver uma opção no menu principal chamada "Manutenção Preventiva", que da acesso a uma tela mostrando todas as atividades de manutenção,
  primeiro para o dia corrente e o dia seguinte, de forma detalhada, tais como categoria de manutencao, item de manutencao, data prevista, tempo faltante da data corrente ate a data prevista, status de excucao (pendente, selecionada, concluida), data de conclusao, funcionario de manutencao executante ou responsavel, tecnico externo executante se houver etc., depois para os próximos
  dois meses, de forma resumida, exibindo cada item de manutenção e sua categoria previstos
  para realização, dia a dia, separados entre técnico e não técnico.
- As categorias de manutenção previamente definidas estarão listadas na tela
  correspondente do admin (onde são editados os checklists pelo admin), bem
  como cada item de manutenção de cada categoria, divididos entre execução
  por técnico e por não técnico, podendo ser criados, alterados ou excluídos
  pelo admin — incluindo periodicidade, descrição e tipo de execução
  (técnico/não técnico).

### 2.3 Observações finais do proprietário

- Evitar mudar qualquer outro item do projeto que não esteja contemplado
  acima. Se for realmente necessária a mudança de algum item não
  contemplado nesta segunda parte, pedir sempre autorização antes, dando
  alternativas quando possível.
- Nos itens criados a partir destas instruções, manter estritamente a mesma
  identidade visual e, quando possível, funcionamento análogo de links,
  menus e telas daquelas já existentes no projeto criadas a partir do
  `PRD_Camareiras_parte01.md`.
- Seguir as boas práticas de segurança para não permitir a exposição e o
  acesso indevido de chaves e senhas.

## 3. Escopo técnico derivado (leitura do requisito à luz do código atual)

Estas conclusões técnicas não fazem parte do texto original do proprietário,
mas são a interpretação necessária para implementar os requisitos acima
dentro dos padrões já estabelecidos na parte 1 (Server Actions, RLS,
migrations numeradas, `src/lib/task-type.ts` como modelo de rótulos
centralizados etc.). Qualquer divergência relevante em relação a esta leitura
deve ser confirmada com o proprietário antes de codificar.

- **Papel de usuário**: hoje o app distingue apenas `admin` e `camareira`
  (provavelmente um enum/coluna de papel na tabela de usuários e checado no
  middleware). Será necessário um terceiro papel, `manutencao`, com sua
  própria route-group (`src/app/(manutencao)/`), sidebar própria e proteção
  de rota no middleware — seguindo exatamente o padrão hoje usado para
  `camareira`.
- **Tela "Usuários"**: renomear a tela e o item de menu "Camareiras" →
  "Usuários" no admin, adicionando um seletor de papel (Camareira /
  Funcionário de Manutenção) no formulário de cadastro, reaproveitando o
  fluxo existente de criação via Supabase Auth Admin API e reset de senha.
- **Ocorrências de manutenção — ciclo de vida**: a tabela de ocorrências
  precisa de um status (`pendente` → `em_andamento`/`selecionada` →
  `resolvida`) e referência a qual funcionário de manutenção selecionou/
  resolveu a ocorrência, além do timestamp de resolução. As telas
  admin já existentes (`/ocorrencias`, `/ocorrencias/[data]`,
  `/ocorrencias/historico`) e o `/historico` geral precisam ser atualizadas
  para exibir/filtrar por esse status, sem quebrar o que já existe.
- **Manutenção preventiva — modelagem de dados**: novas tabelas para
  categorias de manutenção, itens de manutenção (com periodicidade, tipo de
  execução técnico/não técnico, descrição) e agendamentos/ocorrências de
  execução programada (instâncias geradas a partir da periodicidade,
  vinculando data prevista, item, e — quando concluída por não técnico —
  funcionário responsável e data de conclusão). É necessário um mecanismo de
  geração das ocorrências futuras a partir da periodicidade (ex.: função ou
  rotina que garante que sempre existam ocorrências previstas cobrindo pelo
  menos os próximos 60 dias).
- **Conteúdo inicial das categorias/itens**: as 9 categorias de manutenção
  foram definidas pelo proprietário; os itens de manutenção de cada
  categoria (até 10 por categoria, com periodicidade, descrição e
  técnico/não técnico) serão definidos com base em melhores práticas do
  setor de hotelaria/administração predial e caberá ao Claude Code propor a
  lista completa como parte do seed de dados, sujeita a revisão do admin
  (que pode editar tudo depois pela tela de administração).
- **Identidade visual**: nenhuma nova paleta, tema ou componente visual deve
  ser introduzido — reaproveitar exatamente os componentes shadcn/ui, cards,
  cores por tema e padrões de layout (sidebars, DateSwitcher, tabelas
  filtráveis, CSV export) já usados na parte 1.

## 4. Registro de decisões e mudanças (a preencher durante o desenvolvimento)

> Igual à seção 8 do `PRD_Camareiras_parte01.md`: cada decisão relevante
> tomada durante esta segunda parte (inclusive qualquer desvio autorizado
> pelo proprietário em relação à seção 2 acima) deve ser registrada aqui,
> em ordem cronológica, à medida que o desenvolvimento avança.

**Status: implementação concluída e testada pelo proprietário em
localhost** (branch `feature/manutencao`, ainda não mesclada em `main` nem
implantada em produção no momento em que esta seção foi escrita).

### 4.1 Papel "Funcionário de Manutenção" e ciclo de vida das ocorrências

Implementado exatamente como especificado na seção 2.1/2.2.1: novo papel
`manutencao`, tela "Camareiras" renomeada para "Usuários" (com seletor de
papel no cadastro), tela `/manutencao/ocorrencias` para o funcionário
selecionar/resolver ocorrências, e status
pendente/selecionada/resolvida com datas/horários e responsáveis visíveis
para o admin em `/ocorrencias`, `/ocorrencias/historico` (coluna
"Resolvidas") e `/historico` geral (coluna "Ocorrências resolvidas").

**Desvio técnico**: a primeira versão do ciclo de seleção/resolução usava
uma única policy de RLS de UPDATE combinando os dois estados, que falhou em
teste real (erro "new row violates row-level security policy" ao resolver
uma ocorrência já selecionada — o Postgres não conseguia validar o `with
check` da transição). Corrigido substituindo a policy por duas funções
`security definer` (`select_occurrence`/`resolve_occurrence`), o mesmo
padrão já usado por `is_admin()`/`is_manutencao()`. Esse padrão (funções
`security definer` em vez de policies de UPDATE combinadas) foi adotado
também para toda a manutenção preventiva a partir daí.

### 4.2 Manutenção Preventiva

Categorias e itens implementados conforme a seção 2.2.2, com as 9
categorias definidas pelo proprietário e até 10 itens cada, propostos por
boas práticas de hotelaria/administração predial (seed em
`supabase/migrations/010_manutencao_preventiva.sql`). Modelo de dados:
cada item guarda seu ciclo atual (`next_due_date`, status,
selecionado por) e, ao ser concluído, grava uma linha em
`maintenance_completions` (histórico) e agenda a próxima data pela
periodicidade — não existe uma tabela separada de "agendamentos futuros"
pré-gerados, o que simplificou bastante a implementação em relação à ideia
inicial (seção 3).

**Dois ajustes de UX pedidos pelo proprietário após ver a primeira versão**
(autorizados por ele, registrados aqui como desvio da leitura inicial da
seção 3):

- O dashboard do admin (`/manutencao-preventiva`) inicialmente tinha 3
  tabelas separadas (pendentes/selecionadas hoje-amanhã, concluídas
  hoje-amanhã, próximos dois meses). Foi refeito para **2 seções**: uma
  tabela única "Pendentes, selecionadas e concluídas, esta semana" (escopo:
  semana útil corrente, segunda a sexta) juntando as duas primeiras
  tabelas, e "Planejamento semanal" — resumo semana a semana (categorias,
  execução técnico/não técnico/ambos, status agregado) num intervalo
  filtrável (padrão: 6 meses atrás a 6 meses à frente), cada semana com
  link para uma página só daquela semana.
- A tela do funcionário de manutenção (`/manutencao/preventiva`) também foi
  ajustada: os cards de trabalho passaram a ser por **categoria + semana**
  (não só categoria), mostrando primeiro os cards da semana corrente e
  depois os de semanas anteriores ainda não resolvidas (atrasadas), cada
  card indicando a semana a que pertence. A tabela "Próximos 30 dias" foi
  substituída por "Próximas quatro semanas", reaproveitando o mesmo
  componente de planejamento semanal do admin, em modo somente leitura.

### 4.3 Regra de segurança seguida à risca

Nenhuma das novas Server Actions ou funções SQL usa a
`SUPABASE_SERVICE_ROLE_KEY` fora de `src/lib/supabase/admin.ts`; RLS
habilitada em todas as tabelas novas (`maintenance_categories`,
`maintenance_items`, `maintenance_completions`); toda transição de estado
sensível (selecionar/resolver ocorrência, selecionar/concluir manutenção
preventiva) passa por função `security definer` com checagem explícita de
papel, em vez de depender só de policies de RLS combinadas.
