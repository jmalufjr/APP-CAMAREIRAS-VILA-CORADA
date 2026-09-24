#!/usr/bin/env node
// Teste de fumaça da API de consumos (PRD_consumos-api-joao-v1.md, seção 12).
//
// Somente leitura: nunca cria, altera, fecha nem paga nenhuma conta. Nunca
// imprime o token nem payloads completos — só resultados de validação
// (OK/FALHA por checagem).
//
// Uso:
//   BASE_URL="https://.../api/integration/v1" \
//   SERVICE_TOKEN="<token>" \
//   VERCEL_BYPASS="<opcional, só em homologação>" \
//   node scripts/smoke-test-consumos.mjs
//
// Sai com código != 0 se qualquer checagem falhar.

const BASE_URL = process.env.BASE_URL;
const SERVICE_TOKEN = process.env.SERVICE_TOKEN;
const VERCEL_BYPASS = process.env.VERCEL_BYPASS; // opcional

if (!BASE_URL || !SERVICE_TOKEN) {
  console.error("FALHA: defina BASE_URL e SERVICE_TOKEN nas variáveis de ambiente.");
  process.exit(1);
}

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log(`OK   - ${label}`);
  } else {
    console.log(`FALHA - ${label}`);
    failures++;
  }
}

function withBypass(url) {
  if (!VERCEL_BYPASS) return url;
  const u = new URL(url);
  u.searchParams.set("x-vercel-protection-bypass", VERCEL_BYPASS);
  return u.toString();
}

async function callApi(path, { auth = true } = {}) {
  const url = withBypass(`${BASE_URL}${path}`);
  const headers = { "Content-Type": "application/json" };
  if (auth) headers["Authorization"] = `Bearer ${SERVICE_TOKEN}`;
  const res = await fetch(url, { headers, redirect: "manual" });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // resposta não-JSON (ex.: redirect da Vercel) — tratado pelos checks de status
  }
  return { status: res.status, body };
}

function isIsoString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

async function main() {
  console.log(`Testando ${BASE_URL} ...\n`);

  // 1. Sem token deve dar 401.
  const noAuth = await callApi("/rooms", { auth: false });
  check("GET /rooms sem token responde 401", noAuth.status === 401);
  check(
    "Erro sem token segue o formato {error:{code,message,request_id}}",
    noAuth.body?.error?.code && noAuth.body?.error?.message
  );

  // 2. GET /rooms
  const rooms = await callApi("/rooms");
  check("GET /rooms responde 200", rooms.status === 200);
  check("GET /rooms devolve um array em data", Array.isArray(rooms.body?.data));
  check("GET /rooms tem has_more: false (sem paginação)", rooms.body?.has_more === false);
  if (rooms.body?.data?.length > 0) {
    const r = rooms.body.data[0];
    check(
      "Room tem os campos obrigatórios (id, property_id, number, label, active)",
      typeof r.id === "string" &&
        r.property_id === "vila-corada" &&
        typeof r.number === "string" &&
        typeof r.label === "string" &&
        typeof r.active === "boolean"
    );
  }

  // 3. GET /stay-accounts (carga inicial)
  const accounts = await callApi("/stay-accounts?limit=25");
  check("GET /stay-accounts responde 200", accounts.status === 200);
  check("GET /stay-accounts devolve um array em data", Array.isArray(accounts.body?.data));
  check(
    "Primeira página tem snapshot_id e sync_cursor",
    typeof accounts.body?.snapshot_id === "string" && typeof accounts.body?.sync_cursor === "string"
  );

  let sampleAccountId = null;
  if (accounts.body?.data?.length > 0) {
    const a = accounts.body.data[0];
    sampleAccountId = a.account_id;
    check(
      "StayAccount tem os campos obrigatórios de topo",
      typeof a.account_id === "string" &&
        a.property_id === "vila-corada" &&
        typeof a.version === "number" &&
        ["open", "closed_pending_payment", "paid"].includes(a.status) &&
        a.currency === "BRL" &&
        Array.isArray(a.items) &&
        Array.isArray(a.payments) &&
        ["complete", "not_recorded"].includes(a.payment_data_quality) &&
        typeof a.totals === "object" &&
        isIsoString(a.created_at) &&
        isIsoString(a.updated_at)
    );
    check("payments[] nunca tem mais de 1 elemento", a.payments.length <= 1);
  } else {
    console.log("AVISO - nenhuma conta encontrada (banco vazio) — checagens de shape de StayAccount puladas.");
  }

  // 4. GET /stay-accounts/{id}, se houver alguma conta pra testar.
  if (sampleAccountId) {
    const detail = await callApi(`/stay-accounts/${sampleAccountId}`);
    check("GET /stay-accounts/{id} responde 200 pra uma conta existente", detail.status === 200);
    check(
      "Detalhe da conta bate com o account_id pedido",
      detail.body?.account_id === sampleAccountId
    );
  }

  const fakeId = "00000000-0000-0000-0000-000000000000";
  const notFound = await callApi(`/stay-accounts/${fakeId}`);
  check("GET /stay-accounts/{id} inexistente responde 404", notFound.status === 404);

  // 5. GET /changes a partir do sync_cursor da carga inicial.
  const cursor = accounts.body?.sync_cursor ?? "0";
  const changes = await callApi(`/changes?cursor=${encodeURIComponent(cursor)}`);
  check("GET /changes responde 200", changes.status === 200);
  check("GET /changes devolve um array em data", Array.isArray(changes.body?.data));
  check(
    "GET /changes sempre devolve next_cursor, mesmo com data vazio",
    typeof changes.body?.next_cursor === "string"
  );

  // 6. Cursor claramente inválido/fora da janela deve dar 400 ou 410, nunca 200 silencioso.
  const badCursor = await callApi("/changes?cursor=-1");
  check(
    "Cursor inválido responde 400 ou 410 (nunca 200)",
    badCursor.status === 400 || badCursor.status === 410
  );

  console.log(`\n${failures === 0 ? "Todos os testes passaram." : `${failures} falha(s).`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FALHA - erro inesperado ao rodar o teste de fumaça:", err.message);
  process.exit(1);
});
