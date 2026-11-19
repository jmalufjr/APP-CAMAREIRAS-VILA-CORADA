import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Autenticação no Google Cloud com a conta de serviço (sem biblioteca extra): assina um pedido (JWT) com a
// chave privada e troca por um token de acesso, guardado em memória até perto de vencer.
interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
  project_id: string;
}

let cachedAccount: ServiceAccount | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;

// Em produção a chave vem da variável GOOGLE_SERVICE_ACCOUNT_JSON; no computador local, do arquivo
// google-service-account.json na pasta do projeto (nunca versionado).
export function getServiceAccount(): ServiceAccount | null {
  if (cachedAccount) return cachedAccount;
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (raw) {
      cachedAccount = JSON.parse(raw) as ServiceAccount;
    } else {
      const file = path.join(process.cwd(), "google-service-account.json");
      if (fs.existsSync(file)) cachedAccount = JSON.parse(fs.readFileSync(file, "utf8")) as ServiceAccount;
    }
  } catch {
    cachedAccount = null;
  }
  return cachedAccount;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const sa = getServiceAccount();
  if (!sa) throw new Error("Chave do Google não configurada.");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key).toString("base64url");

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao autenticar no Google (${res.status}).`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}
