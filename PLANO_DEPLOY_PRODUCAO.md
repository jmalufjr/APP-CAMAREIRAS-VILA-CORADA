# Plano de deploy para produção — Módulo Contábil e Compras

> Registro e roteiro (17/10/2026). Leva para produção tudo que foi feito na
> branch `feature/compras`: Módulo Contábil (compras, despesas, estoque,
> plano de contas, partidas dobradas, balancetes, livros, exportações), novo
> papel "Gerente operacional", novo desenho de menus (Módulo operacional,
> Sincronização, Integração). Detalhes técnicos completos:
> `PRD_compras&contabil.md` (seções 22 a 32).

## Ponto de retorno (versão ANTES deste merge)

| O quê | Valor |
|---|---|
| Commit do `main` antes do merge | `bdce9ad19a3eb4ef0434950e766be2f6dbc0dc17` ("Fotos numa ocorrência de manutenção…") |
| Tag no GitHub | `producao-antes-modulo-contabil` (aponta pro commit acima) |
| Branch de segurança no GitHub | `backup/main-antes-modulo-contabil` |
| Deploy de produção na Vercel (rollback instantâneo) | `dpl_23hAXZ2HtazGYPtKefqDycbTRGnc` — `app-camareiras-vila-corada-o5rixm6p9-v-corada.vercel.app` |

## Por que a ORDEM importa

O app novo depende de 30 migrations do banco (053 a 082) que **o banco de
produção ainda não tem**. Subir o código antes das migrations derruba telas
(ex.: o app novo chama funções e tabelas que não existem lá). Por isso:

> **1) backup → 2) migrations no banco → 3) merge/push do código → 4) conferir.**

As migrations só podem ser rodadas por quem tem acesso ao painel do
Supabase de produção (o Claude Code não tem esse acesso). O ensaio abaixo foi
feito numa cópia do banco com o desenho exato do `main` atual.

## Ensaio já feito (17/10/2026)

Criei uma cópia descartável do banco no estado do `main` (schema + seed),
apliquei `01-etapa-A` e `02-etapa-B` e comparei com o banco local migrado:
**mesmas colunas e mesmas políticas de segurança**, sem erro. Depois rodei o
`03-reverter` e confirmei que as três funções de comanda voltaram à
assinatura antiga. O que o ensaio **não** cobre: dados reais de produção
(ver "Riscos conhecidos").

## Passo a passo

### 0) Antes de tudo — backup do banco (obrigatório)
Supabase de produção → **Project Settings → Database → Backups** (baixe o
mais recente ou clique em fazer um backup manual, se o plano permitir). Se o
plano não oferece backup, rode no seu computador (precisa da *connection
string* em Project Settings → Database):

```
pg_dump "postgresql://postgres:SENHA@HOST:5432/postgres" --schema=public --data-only -f backup-dados-producao.sql
pg_dump "postgresql://postgres:SENHA@HOST:5432/postgres" --schema=public --schema-only -f backup-estrutura-producao.sql
```

Guarde os dois arquivos fora do repositório. **Sem backup, não avance.**

### 1) Banco — etapa A
SQL Editor (produção) → colar `supabase/producao/01-etapa-A-enums.sql` →
Run. Adiciona dois valores de enum (`boleto`, `gerente_operacional`). Pode
repetir sem problema.

### 2) Banco — etapa B
SQL Editor → colar `supabase/producao/02-etapa-B-migrations.sql` → Run.
Está **dentro de uma transação única**: se qualquer comando falhar, nada é
aplicado e o banco continua como estava (copie a mensagem de erro e me
envie). Deve terminar em `COMMIT`.

### 3) Variáveis de ambiente na Vercel
Nenhuma é obrigatória. **Opcional:** `ANTHROPIC_API_KEY` (leitura de nota
fiscal por IA na tela "Lançar Compra" — sem ela o botão "Ler nota com IA"
avisa que não está configurado e tudo continua manual). As demais já existem.

### 4) Código — merge e push
Depois dos passos 1 e 2 concluídos, me avise para eu fazer o merge de
`feature/compras` em `main` e o `git push` (o push dispara o deploy
automático na Vercel). Comandos:

```
git checkout main && git pull
git merge --no-ff feature/compras
git push origin main
```

### 5) Conferir em produção (10 minutos)
- Entrar como admin: o menu lateral deve mostrar *Módulo operacional, Módulo
  Contábil, Sincronização, Integração, Usuários, Questões e Respostas*.
- Camareira: abrir *Minhas suítes* e *Comanda* (lançar e cancelar um pedido
  de teste e apagar depois).
- Módulo Contábil → Listas contábeis → Cadastro de produtos: ver a lista.
- Módulo Contábil → Demonstrativos → Livro Diário abre sem erro.
- Usuários → criar um *Gerente operacional* de teste e entrar com ele.
- Confirmar que o cron/sincronização continuam (Sincronização → botão
  Parcial).

## Como VOLTAR atrás (se algo der errado)

Escolha pelo tamanho do problema:

**Nível 1 — só o código (1 minuto, sem perder nada).** Vercel →
projeto `app-camareiras-vila-corada` → Deployments → deploy
`dpl_23hAXZ2HtazGYPtKefqDycbTRGnc` → **Promote to Production** (ou
*Instant Rollback*). A versão antiga volta no ar na hora. **Antes disso**,
rode `supabase/producao/03-reverter-para-versao-anterior.sql` no SQL Editor:
a versão antiga chama a função `cancel_comanda` com a assinatura antiga, que
a etapa B trocou — sem o reverter, só "cancelar comanda" quebra no app
antigo. Todo o resto das mudanças do banco é aditivo e o app antigo ignora.
Nenhum dado do Módulo Contábil se perde (as tabelas ficam, só sem uso).

**Nível 2 — voltar o código no Git.** Se quiser desfazer o merge no GitHub:
`git revert -m 1 <commit-do-merge>` e push (gera um commit que desfaz, sem
reescrever histórico). A tag `producao-antes-modulo-contabil` e a branch
`backup/main-antes-modulo-contabil` guardam o estado exato anterior.

**Nível 3 — voltar o banco inteiro ao que era (perde o que foi gravado
depois).** Restaurar o backup do passo 0 no Supabase. Só em último caso:
qualquer comanda/serviço registrado depois do backup se perde.

**Para tentar de novo depois de um reverter:** rode apenas
`supabase/migrations/078_motor_lancamentos_automaticos.sql` e
`080_fonte_unica_de_rateio.sql` (recriam as funções e gatilhos; são
repetíveis) — não rode a etapa B inteira de novo (ela cria tabelas).

## Riscos conhecidos (leia antes de rodar)

1. **Migrations 075 e 079 mexem em dados por NOME** (itens de custo como
   "contabilidade", "adubo", "alicates"…). Se alguém renomeou ou apagou algum
   desses itens em produção, ele simplesmente não é tocado — não dá erro.
   Se um item novo com o mesmo nome existir, ele será reclassificado.
2. **O módulo de compras é novo em produção:** não há dados antigos nele
   (nenhuma compra, nenhum estoque). A tela *Inventário* e *Previsão de
   estoque* nascem vazias; é preciso cadastrar/ajustar produtos e lançar
   compras para ela fazer sentido.
3. **Comandas/frigobar a partir do merge passam a baixar estoque e lançar
   receita/custo no livro contábil.** Como o estoque começa em zero, a baixa
   gera saldo negativo (ex.: cerveja −10) até a primeira compra ou ajuste de
   inventário. Recomendação: lançar as compras/saldos iniciais **antes** de
   usar o bar/frigobar no novo sistema.
4. **Envio de e-mail e PDF de recibo** continuam como estavam.
5. **Lançamentos contábeis anteriores ao merge não existem** (o livro começa
   vazio em produção).
