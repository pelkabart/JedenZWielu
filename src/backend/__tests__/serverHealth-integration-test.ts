/**
 * Test integracyjny sprawdzania połączenia: ten sam przebieg co przycisk „Sprawdź połączenie” w Ustawieniach –
 * adres w postaci z `.env.local`, prawdziwy `checkServer` i logi, a zamiast sieci atrapa `fetch`, która odgrywa
 * odpowiedzi serwera z `server/src/app.ts` (ten sam kształt `/health`), łącznie z zimnym startem kontenera na Azure.
 */
import { formatEntry, getLogEntries, resetLog } from '@/lib/log';

import { checkServer, SERVER_TIMEOUT_MS, type HealthFetch } from '../serverHealth';

/** Tak jak wpisuje się go w `.env.local` – z ukośnikiem na końcu. */
const ENV_URL = 'https://jzw-server.kindwave-1234.westeurope.azurecontainerapps.io/';

/** Odpowiedź `/health` zgodna z `HealthResponse` z serwera. */
const health = (version: string) => ({ status: 'ok', version, time: '2026-11-03T12:00:00.000Z' });

/** Atrapa Azure Container Apps: pierwsze zapytanie trafia na uśpiony kontener (zimny start). */
function azureContainer({ coldStartMs, version }: { coldStartMs: number; version: string }) {
  let awake = false;
  const paths: string[] = [];
  const fetch: HealthFetch = (url, init) => {
    paths.push(new URL(url).pathname);
    if (!awake) {
      setTimeout(() => {
        awake = true;
      }, coldStartMs);
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('Aborted'))));
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => health(version) });
  };
  return { fetch, paths };
}

beforeEach(() => {
  resetLog();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('zimny start: pierwsza próba kończy się po czasie, ponowna łączy z serwerem', async () => {
  const azure = azureContainer({ coldStartMs: SERVER_TIMEOUT_MS + 5_000, version: '0.1.0' });
  let clock = 0;
  const now = () => clock;

  const first = checkServer(ENV_URL, { fetch: azure.fetch, now });
  jest.advanceTimersByTime(SERVER_TIMEOUT_MS);
  expect(await first).toMatchObject({ ok: false, reason: 'timeout' });

  // Gracz czyta komunikat i po chwili klika jeszcze raz.
  jest.advanceTimersByTime(10_000);
  const second = await checkServer(ENV_URL, { fetch: azure.fetch, now });
  expect(second).toEqual({ ok: true, version: '0.1.0', latencyMs: 0 });

  expect(azure.paths).toEqual(['/health', '/health']);
  const lines = getLogEntries({ tag: 'backend' }).map(formatEntry);
  expect(lines).toEqual([
    `[backend] Serwer nie odpowiedział na czas {"timeoutMs":${SERVER_TIMEOUT_MS}}`,
    '[backend] Połączenie z serwerem działa {"version":"0.1.0","latencyMs":0}',
  ]);
});

it('ciepły kontener odpowiada od razu', async () => {
  const azure = azureContainer({ coldStartMs: 0, version: '0.2.0' });
  const first = checkServer(ENV_URL, { fetch: azure.fetch });
  jest.advanceTimersByTime(SERVER_TIMEOUT_MS);
  await first;
  expect(await checkServer(ENV_URL, { fetch: azure.fetch })).toMatchObject({ ok: true, version: '0.2.0' });
});
