import { getLogEntries, resetLog } from '@/lib/log';

import { checkServer, normalizeServerUrl, SERVER_TIMEOUT_MS, type HealthFetch } from '../serverHealth';

const URL = 'https://jzw.example.azurecontainerapps.io';

function fakeFetch(respond: () => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>) {
  const calls: string[] = [];
  const fetch: HealthFetch = (url) => {
    calls.push(url);
    return respond();
  };
  return { fetch, calls };
}

const json = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => resetLog());

describe('normalizeServerUrl', () => {
  it.each([
    ['https://a.io', 'https://a.io'],
    ['  https://a.io/  ', 'https://a.io'],
    ['https://a.io///', 'https://a.io'],
    ['http://192.168.1.10:8080', 'http://192.168.1.10:8080'],
    ['HTTPS://A.IO', 'HTTPS://A.IO'],
    ['', null],
    ['   ', null],
    ['a.io', null],
    ['ftp://a.io', null],
    ['https://', null],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeServerUrl(raw)).toBe(expected);
  });
});

describe('checkServer', () => {
  it('serwer działa: wersja i czas odpowiedzi', async () => {
    let t = 1000;
    const { fetch, calls } = fakeFetch(async () => {
      t += 120;
      return json(200, { status: 'ok', version: '0.1.0', time: '2026-11-03T12:00:00.000Z' })();
    });
    const result = await checkServer(`${URL}/`, { fetch, now: () => t });
    expect(result).toEqual({ ok: true, version: '0.1.0', latencyMs: 120 });
    expect(calls).toEqual([`${URL}/health`]);
  });

  it('brak adresu: nie pyta sieci', async () => {
    const { fetch, calls } = fakeFetch(json(200, {}));
    const result = await checkServer('', { fetch });
    expect(result).toMatchObject({ ok: false, reason: 'no-url' });
    expect(result.ok || result.message).toContain('EXPO_PUBLIC_SERVER_URL');
    expect(calls).toEqual([]);
  });

  it('status 500', async () => {
    const { fetch } = fakeFetch(json(500, { error: 'x' }));
    expect(await checkServer(URL, { fetch })).toMatchObject({ ok: false, reason: 'http' });
  });

  it('strona błędu 404 (np. zły target-port)', async () => {
    const { fetch } = fakeFetch(json(404, null));
    const result = await checkServer(URL, { fetch });
    expect(result).toMatchObject({ ok: false, reason: 'http' });
    expect(result.ok || result.message).toContain('404');
  });

  it('odpowiedź nie jest JSON-em', async () => {
    const { fetch } = fakeFetch(async () => ({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('html')) }));
    expect(await checkServer(URL, { fetch })).toMatchObject({ ok: false, reason: 'bad-response' });
  });

  it.each([[{ status: 'down', version: '1' }], [{ status: 'ok' }], [{ status: 'ok', version: 1 }], [[]], ['ok']])(
    'JSON bez status ok i wersji: %j',
    async (body) => {
      const { fetch } = fakeFetch(json(200, body));
      expect(await checkServer(URL, { fetch })).toMatchObject({ ok: false, reason: 'bad-response' });
    },
  );

  it('brak sieci', async () => {
    const { fetch } = fakeFetch(() => Promise.reject(new TypeError('Network request failed')));
    expect(await checkServer(URL, { fetch })).toMatchObject({ ok: false, reason: 'network' });
  });

  describe('na fałszywym zegarze', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('przekroczony czas: komunikat o uruchamianiu serwera, zapytanie przerwane', async () => {
      let signal: AbortSignal | undefined;
      const fetch: HealthFetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          signal = init.signal;
          init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
        });
      const pending = checkServer(URL, { fetch });
      jest.advanceTimersByTime(SERVER_TIMEOUT_MS - 1);
      expect(signal?.aborted).toBe(false);
      jest.advanceTimersByTime(1);
      const result = await pending;
      expect(signal?.aborted).toBe(true);
      expect(result).toMatchObject({ ok: false, reason: 'timeout' });
      expect(result.ok || result.message).toContain('uruchamiać');
    });

    it('po odpowiedzi nie zostaje żaden zegar', async () => {
      const { fetch } = fakeFetch(json(200, { status: 'ok', version: '1' }));
      await checkServer(URL, { fetch });
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  it('logi zawierają tylko małe wartości', async () => {
    const { fetch } = fakeFetch(json(200, { status: 'ok', version: '0.1.0' }));
    await checkServer(URL, { fetch });
    const entries = getLogEntries({ tag: 'backend' });
    expect(entries).toHaveLength(1);
    expect(Object.keys(entries[0].data ?? {})).toEqual(['version', 'latencyMs']);
  });
});
