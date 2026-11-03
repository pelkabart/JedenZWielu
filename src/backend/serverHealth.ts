import { createLogger } from '@/lib/log';

const log = createLogger('backend');

/** Zimny start kontenera na Azure (min-replicas 0) potrafi trwać kilkanaście sekund. */
export const SERVER_TIMEOUT_MS = 15_000;

/** Tyle z `fetch`, ile potrzeba do GET – w testach podstawiamy atrapę. */
export interface HealthFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
export type HealthFetch = (url: string, init: { method: 'GET'; signal: AbortSignal }) => Promise<HealthFetchResponse>;

export type HealthResult =
  | { ok: true; version: string; latencyMs: number }
  | { ok: false; reason: HealthFailure; message: string };

export type HealthFailure = 'no-url' | 'timeout' | 'network' | 'http' | 'bad-response';

export interface CheckServerOptions {
  fetch?: HealthFetch;
  timeoutMs?: number;
  now?: () => number;
}

/**
 * Przycina spacje i końcowe `/`, przyjmuje tylko `http://` i `https://`.
 * Zwraca `null`, gdy adresu nie ma albo jest nieprawidłowy.
 */
export function normalizeServerUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) return null;
  return trimmed;
}

const fail = (reason: HealthFailure, message: string): HealthResult => ({ ok: false, reason, message });

function isHealthBody(body: unknown): body is { status: 'ok'; version: string } {
  if (typeof body !== 'object' || body === null) return false;
  const { status, version } = body as { status?: unknown; version?: unknown };
  return status === 'ok' && typeof version === 'string';
}

/** Pyta serwer o `GET /health`. Nigdy nie rzuca – każdy błąd to wynik z komunikatem po polsku. */
export async function checkServer(rawUrl: string, options: CheckServerOptions = {}): Promise<HealthResult> {
  const { fetch: doFetch = globalThis.fetch as unknown as HealthFetch, timeoutMs = SERVER_TIMEOUT_MS, now = Date.now } = options;

  const base = normalizeServerUrl(rawUrl);
  if (!base) {
    log.warn('Brak adresu serwera');
    return fail('no-url', 'Brak adresu serwera. Wpisz EXPO_PUBLIC_SERVER_URL=https://… w pliku .env.local i uruchom Expo ponownie.');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const started = now();

  try {
    const response = await doFetch(`${base}/health`, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      log.warn('Serwer odpowiedział błędem', { status: response.status });
      return fail('http', `Serwer odpowiedział błędem ${response.status}. Sprawdź adres i czy kontener działa.`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!isHealthBody(body)) {
      log.warn('Nieoczekiwana odpowiedź serwera');
      return fail('bad-response', 'Pod tym adresem odpowiada coś innego niż serwer gry.');
    }
    const latencyMs = now() - started;
    log.info('Połączenie z serwerem działa', { version: body.version, latencyMs });
    return { ok: true, version: body.version, latencyMs };
  } catch (e) {
    if (timedOut) {
      log.warn('Serwer nie odpowiedział na czas', { timeoutMs });
      return fail(
        'timeout',
        `Serwer nie odpowiedział w ${Math.round(timeoutMs / 1000)} s. Mógł się dopiero uruchamiać – spróbuj ponownie za chwilę.`,
      );
    }
    log.warn('Brak połączenia z serwerem', { error: e instanceof Error ? e.message : 'unknown' });
    return fail('network', 'Brak połączenia z serwerem. Sprawdź internet i adres serwera.');
  } finally {
    clearTimeout(timer);
  }
}
