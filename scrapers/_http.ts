import { fetch as undiciFetch } from "undici";
import { dispatcherFor } from "./_tls";
export const USER_AGENT =
  "BijouxBot/1.0 (listings di sale d'essai a Milano e Bogotá; 1 richiesta per pagina a ogni aggiornamento)";

/**
 * One polite GET: declared UA, no retries. Deliberately no module-level cache: the Neon
 * Function stays warm across daily invocations and a cache would serve yesterday's page.
 */
export async function politeFetch(url: string): Promise<Response> {
  const dispatcher = dispatcherFor(url);
  const init = {
    headers: { "user-agent": USER_AGENT, "accept-language": "it-IT,it;q=0.9" },
    redirect: "follow" as const,
    signal: AbortSignal.timeout(20_000),
  };
  const res = dispatcher
    ? ((await undiciFetch(url, { ...init, dispatcher })) as unknown as Response)
    : await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
  return res;
}

export async function fetchText(url: string): Promise<string> {
  return (await politeFetch(url)).text();
}

export async function fetchBytes(url: string): Promise<Uint8Array> {
  return new Uint8Array(await (await politeFetch(url)).arrayBuffer());
}
