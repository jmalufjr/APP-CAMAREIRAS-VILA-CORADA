# PRD — Modelo contábil simplificado (sem estoque) e entrada de compras por WhatsApp

Decisões do proprietário em 11/11/2026. Vigência: a partir de **01/11/2026** (não há compras antigas; meses anteriores são desconsiderados).

## 1. Princípios
- Tudo o que é comprado/pago no mês é despesa do mês. **Acaba o controle de estoque** (baixa, inventário, previsão, quebra, validade, lista de compras, avisos, pedidos de compra).
- Não há compra a prazo: **data da compra = data do pagamento**. Regimes caixa e competência se confundem no lançamento.
- O consumo de bar/frigobar **deixa de lançar custo**; só a receita permanece (reconhecida quando a conta é **fechada**).
- Sem depreciação. Ativo permanente = item de valor ≥ R$ 1.200 (valor editável), controlado só em inventário próprio; não vai ao resultado.

## 2. Categorias de despesa (editáveis, podem ser incluídas/excluídas)
Alimentos, Bebidas quentes, Demais bebidas, Materiais de limpeza, Amenities, Materiais de piscina, Materiais de lavanderia, Materiais de jardinagem (inclui inseticidas e venenos), Despesas de consumo (gás, luz, água, internet), Despesas de pessoal administrativo (honorários comercial, contábil, financeiro, redes sociais), Despesas de marketing, Materiais de escritório, Despesas de pessoal operacional (salários e encargos), Despesas de reforma e manutenção, Impostos.
Cada categoria tem **prazo de consumo em dias** (editável). Prazo 1 = consumo imediato, sem rateio no tempo; prazo ≥ 2 = a nota é dividida por dia e distribuída pelos meses a partir da data da compra.

## 3. Centros de custo e rateios
Centros: **Hospedagem, Bar, Café da manhã, Frigobar**. Impostos = não alocável (aparece só no fim).
- **Alimentos**: aparece em Bar e Café. Item que a IA/lançamento reconhece como **ingrediente de produto de bar** (lista de ingredientes) segue o rateio bar × café cadastrado no ingrediente; os demais alimentos vão 100% ao Café.
- **Demais bebidas**: rateio Bar × Frigobar **calculado no mês** pela proporção entre quantidade vendida nas comandas de bar e quantidade lançada no frigobar.
- **Bebidas quentes**: 100% Bar (editável).
- **Despesas de consumo**: única com rateio fixo entre Hospedagem, Bar e Café (percentuais editáveis).
- Demais categorias: 100% Hospedagem.
- Frigobar tem uma só categoria (Demais bebidas); custo **total** do frigobar, sem custo por item.

## 4. Rateio no tempo
Valor diário = total da nota ÷ prazo da categoria; distribui-se a partir da data da compra nos dias de cada mês. Aplica-se por linha/categoria.

## 5. Fechamento do mês
- Fecha no último dia do mês. Lançamentos de até **30 dias** após o fechamento entram automaticamente no mês da nota, com a marca "lançado após o fechamento" no relatório.
- Depois de 30 dias: ficam em **vermelho**, aguardando o admin **aprovar** (registra no mês fechado) ou **cancelar**.

## 6. Telas finais
- **Resultado mensal** (gerado após fechado o mês): receitas por centro (hospedagem bruta, comissão dos canais, hospedagem líquida, bar, frigobar), despesas por categoria dentro de cada centro, resultado por centro e total; impostos no final.
- **Relatório de despesas (regime caixa)**: todas as compras/despesas individualmente, em ordem cronológica da data da nota/compra, com marca de lançamento posterior ao fechamento; base da futura conciliação bancária (buscar pagamento numa **janela de dias** em torno da data).
- **Ficha técnica de produtos** (petiscos e drinks): ingredientes com composição por unidade vendida; custo médio mensal e rentabilidade média mensal por produto (**estimativa**: compras do mês do ingrediente divididas entre os produtos na proporção das quantidades vendidas × composição).
- **Categorias de despesa e centros de custo**, **Ingredientes**, **Inventário de ativo permanente** (editável, com inclusão manual e limite editável), **Itens recorrentes** (salários, honorários etc., repetem todo mês), **Pagamentos** (mantido).
- Saem: Demonstrativos e Relatórios atuais, Exportações para o sistema financeiro, Cadastro de produtos, Cadastro de despesas, Plano de contas, todas as telas de estoque.

## 7. Receita de hospedagem
Vem da **API da Stays** (já usada nos Indicadores): receita bruta, comissão dos canais (conta separada) e receita líquida.

## 8. Entrada de compras
- **Caixa de conferência**: notas lidas pela IA aguardam confirmação do financeiro (a IA só escolhe categoria e identifica ingrediente).
- **Caminho 3 (primeiro, provisório)**: upload da conversa exportada do WhatsApp; foto + mensagens seguintes do mesmo remetente formam um lançamento. Novembro será lançado por aqui.
- **Caminho 1 (em paralelo)**: número oficial do WhatsApp Business; o pedido de verificação na Meta começa já.

## 9. Fora desta etapa
Integração com o sistema financeiro (notas fiscais, impostos automáticos, contas a receber), API do banco e conciliação.

## 10. Etapas de implementação
1. Novo cadastro (categorias, centros, prazos, rateios, ingredientes, limite de ativo, itens recorrentes) — sem apagar nada.
2. Novo lançamento de compra/despesa e rateio no tempo; fechamento e aprovação.
3. Corte em 01/11: consumo para de lançar custo; baixa única dos saldos antigos de estoque, sem mexer em histórico.
4. Resultado mensal e Relatório de despesas.
5. Receita de hospedagem pela Stays e comissão em conta separada.
6. Ficha técnica mensal.
7. Caixa de conferência + caminho 3.
8. Esconder e depois remover as telas de estoque; atualizar Questões e Respostas, PRDs e CLAUDE.md.
9. Caminho 1.

## 11. Pontos assumidos por padrão (editáveis)
Prazos iniciais: limpeza, lavanderia, piscina, jardinagem, amenities, escritório = 30 dias; alimentos, bebidas = 1 dia; despesas de consumo, pessoal, marketing, honorários, impostos, reforma = 1 dia. Bebidas quentes = 100% Bar. Despesas de consumo = 40% Hospedagem, 30% Café, 30% Bar até o proprietário ajustar.

## 12. Ajustes de 11/11/2026
- Bebidas quentes vão 100% para o **Bar** (corrigido).
- Todos os lançamentos de compras e despesas feitos pelo modelo velho serão **apagados** (com seus lançamentos contábeis e movimentos de estoque). Recomeça-se do zero pelo modelo novo; as compras de novembro entram pela exportação da conversa do WhatsApp assim que o sistema estiver pronto.
- Antes de apagar: ponto de retorno (marca no repositório + cópia do banco de produção).

## 13. Receitas por data de lançamento (11/11/2026)
- Receita de **bar** = comandas pela data em que foram lançadas; de **frigobar** = lançamentos datados (data do serviço na suíte ou do lançamento adicional); **hospedagem** = Stays. Valem 30 dias após o fim do mês; depois, entrada nova fica em vermelho aguardando aprovação do admin.
- Só entra como receita a conta **fechada**; conta aberta no fim do mês aparece como "a fechar". Taxa de serviço de 10% acompanha a data de cada comanda; isenta = zero.
- Frigobar passa a ter registro datado por lançamento; saldos existentes em contas abertas ficam com a data da migração.
- O resultado mensal é calculado direto das fontes datadas (compras, comandas, frigobar, Stays), não do livro de partidas dobradas, que fica só como histórico.

## 14. Status da implementação (11/11/2026)
Implementado e testado no banco local: cadastros (categorias, ingredientes, itens recorrentes, parâmetros de ativo), lançamento de compra, relatório de despesas, resultado mensal por centro, caixa de conferência + importação do WhatsApp (caminho 3), corte do custo no consumo, ficha técnica e custo mensal por produto. Falta: rodar os SQLs 25–30 na produção (ordem em CLAUDE.md, Parte 71), apagar os lançamentos antigos (SQL 29, por último), o caminho 1 (número oficial), remover definitivamente o código de estoque e, em outra etapa, integração com o sistema financeiro e conciliação bancária.

## 15. Definições de bebidas e café (11/11/2026)
- **Bebidas quentes** = destilados e demais bebidas alcoólicas que não são cerveja, mais vinhos (cachaça, uísque, vodka, gim, Campari…): 100% Bar; podem ser vendidas em dose ou ser ingredientes de drinks (a categoria aceita ingrediente).
- **Demais bebidas** = cervejas, águas, refrigerantes e água de coco: Bar × Frigobar pelas vendas do mês.
- **Café expresso** é alimento, mas o gasto do café (ingrediente "Café em pó (g)") se divide Bar × Frigobar pelas vendas do mês, como as bebidas. Novo modo de divisão do ingrediente (`ingredients.split_mode` = `bar_cafe` | `bar_frigobar`).
