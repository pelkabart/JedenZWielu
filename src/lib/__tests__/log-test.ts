import { simulateGame } from '@/game/simulate';
import { newGame } from '@/game/testing/fixtures';
import { createRng } from '@/game/rng';

import { clearLog, configureLog, consoleSink, createLogger, formatData, formatEntry, getLogEntries, resetLog, type LogEntry } from '../log';

const log = createLogger('test');

beforeEach(() => resetLog());
afterAll(() => resetLog());

describe('createLogger', () => {
  it('zapisuje poziom, moduł, treść i dane', () => {
    log.info('Start', { seed: 7 });
    const [entry] = getLogEntries();
    expect(entry).toMatchObject({ level: 'info', tag: 'test', message: 'Start', data: { seed: 7 } });
    expect(entry.seq).toBe(1);
  });

  it('numeruje wpisy po kolei', () => {
    log.debug('a');
    log.warn('b');
    log.error('c');
    expect(getLogEntries().map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('kopiuje dane, więc późniejsza zmiana obiektu nie zmienia wpisu', () => {
    const data = { lives: 3 };
    log.info('Szanse', data);
    data.lives = 0;
    expect(getLogEntries()[0].data).toEqual({ lives: 3 });
  });
});

describe('poziomy i filtrowanie', () => {
  it('wpisy poniżej minimalnego poziomu są pomijane', () => {
    configureLog({ minLevel: 'info' });
    log.debug('pomijany');
    log.info('zapisany');
    expect(getLogEntries().map((e) => e.message)).toEqual(['zapisany']);
  });

  it('filtruje po module i od danego poziomu', () => {
    createLogger('inny').error('obcy');
    log.debug('szczegół');
    log.warn('ostrzeżenie');
    expect(getLogEntries({ tag: 'test' }).map((e) => e.message)).toEqual(['szczegół', 'ostrzeżenie']);
    expect(getLogEntries({ minLevel: 'warn' }).map((e) => e.message)).toEqual(['obcy', 'ostrzeżenie']);
  });
});

describe('bufor', () => {
  it('bufor trzyma tylko ostatnie wpisy, w kolejności', () => {
    configureLog({ bufferSize: 3 });
    for (let i = 1; i <= 7; i++) log.info(`wpis ${i}`);
    expect(getLogEntries().map((e) => e.message)).toEqual(['wpis 5', 'wpis 6', 'wpis 7']);
  });

  it('clearLog czyści bufor, ale numeracja trwa dalej', () => {
    log.info('a');
    clearLog();
    expect(getLogEntries()).toEqual([]);
    log.info('b');
    expect(getLogEntries()[0].seq).toBe(2);
  });
});

describe('wyjście logów', () => {
  it('przekazuje każdy wpis do wyjścia', () => {
    const received: LogEntry[] = [];
    configureLog({ sink: (e) => received.push(e) });
    log.info('do wyjścia');
    expect(received.map((e) => e.message)).toEqual(['do wyjścia']);
  });

  it('błąd w wyjściu logów nie przerywa programu', () => {
    configureLog({
      sink: () => {
        throw new Error('konsola nie działa');
      },
    });
    expect(() => log.error('mimo to')).not.toThrow();
    expect(getLogEntries()).toHaveLength(1);
  });

  it('consoleSink wypisuje błędy przez console.error, ostrzeżenia przez console.warn, resztę przez console.log', () => {
    const spies = (['log', 'warn', 'error'] as const).map((method) => jest.spyOn(console, method).mockImplementation(() => {}));
    configureLog({ sink: consoleSink });
    log.debug('d');
    log.info('i', { n: 1 });
    log.warn('w');
    log.error('e');
    const [logSpy, warnSpy, errorSpy] = spies;
    expect(logSpy.mock.calls).toEqual([['[test] d'], ['[test] i {"n":1}']]);
    expect(warnSpy.mock.calls).toEqual([['[test] w']]);
    expect(errorSpy.mock.calls).toEqual([['[test] e']]);
    spies.forEach((spy) => spy.mockRestore());
  });

  it('w testach domyślnie nic nie trafia do konsoli', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    log.info('cicho');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('formatowanie', () => {
  it('formatuje wpis z modułem i danymi', () => {
    log.info('Pauza', { remainingMs: 1200 });
    expect(formatEntry(getLogEntries()[0])).toBe('[test] Pauza {"remainingMs":1200}');
  });

  it('dane z cyklem da się sformatować', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(formatData({ cyclic })).toBe('{"cyclic":{"a":1,"self":"[cykl]"}}');
  });

  it('nie rzuca dla danych, których JSON nie obsługuje', () => {
    expect(formatData({ big: BigInt(1) })).toBe('[nie da się sformatować]');
  });
});

describe('logi a silnik', () => {
  it('symulacja pełnej gry nie zapisuje żadnego wpisu (silnik jest czysty)', () => {
    simulateGame(newGame(3), { rng: createRng(3) });
    expect(getLogEntries()).toEqual([]);
  });
});
