export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Małe dane: id, liczby, teksty. Nigdy cały stan gry (bufor trzymałby setki kopii). */
export type LogData = Record<string, unknown>;

export interface LogEntry {
  /** Numer kolejny wpisu od uruchomienia (albo od `resetLog`). */
  seq: number;
  time: number;
  level: LogLevel;
  /** Moduł, z którego pochodzi wpis, np. "sterownik". */
  tag: string;
  message: string;
  data?: LogData;
}

export type LogSink = (entry: LogEntry) => void;

export interface Logger {
  debug(message: string, data?: LogData): void;
  info(message: string, data?: LogData): void;
  warn(message: string, data?: LogData): void;
  error(message: string, data?: LogData): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Zamienia dane na tekst; obiekty z cyklem nie mogą wywrócić logowania. */
export function formatData(data: LogData): string {
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(data, (_key, value: unknown) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[cykl]';
        seen.add(value);
      }
      return value;
    });
  } catch {
    return '[nie da się sformatować]';
  }
}

export function formatEntry(entry: LogEntry): string {
  const data = entry.data ? ` ${formatData(entry.data)}` : '';
  return `[${entry.tag}] ${entry.message}${data}`;
}

/** Wypisuje wpisy do konsoli (w Expo Go widać je w terminalu z `npx expo start`). */
export const consoleSink: LogSink = (entry) => {
  const text = formatEntry(entry);
  if (entry.level === 'error') console.error(text);
  else if (entry.level === 'warn') console.warn(text);
  else console.log(text);
};

const isTest = process.env.NODE_ENV === 'test';
const isDev = (globalThis as { __DEV__?: boolean }).__DEV__ ?? true;

interface LogConfig {
  minLevel: LogLevel;
  /** `null` = wpisy trafiają tylko do bufora. */
  sink: LogSink | null;
  bufferSize: number;
}

/** W testach logi nie zaśmiecają wyjścia Jesta, w produkcji pomijamy `debug`. */
const DEFAULT_CONFIG: LogConfig = {
  minLevel: isDev ? 'debug' : 'info',
  sink: isTest ? null : consoleSink,
  bufferSize: 500,
};

let config: LogConfig = { ...DEFAULT_CONFIG };
/** Bufor cykliczny: po zapełnieniu nowe wpisy nadpisują najstarsze. */
let buffer: LogEntry[] = [];
let nextSlot = 0;
let seq = 0;

export function configureLog(patch: Partial<LogConfig>) {
  config = { ...config, ...patch };
  if (patch.bufferSize !== undefined) clearLog();
}

export function clearLog() {
  buffer = [];
  nextSlot = 0;
}

/** Przywraca ustawienia domyślne i czyści bufor (do testów). */
export function resetLog() {
  config = { ...DEFAULT_CONFIG };
  clearLog();
  seq = 0;
}

/** Wpisy z bufora od najstarszego; opcjonalnie tylko z danego modułu albo od danego poziomu. */
export function getLogEntries(filter: { tag?: string; minLevel?: LogLevel } = {}): LogEntry[] {
  const ordered = buffer.length < config.bufferSize ? buffer : [...buffer.slice(nextSlot), ...buffer.slice(0, nextSlot)];
  return ordered.filter(
    (e) =>
      (filter.tag === undefined || e.tag === filter.tag) &&
      (filter.minLevel === undefined || LEVEL_ORDER[e.level] >= LEVEL_ORDER[filter.minLevel]),
  );
}

function write(level: LogLevel, tag: string, message: string, data?: LogData) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[config.minLevel]) return;
  const entry: LogEntry = {
    seq: ++seq,
    time: Date.now(),
    level,
    tag,
    message,
    ...(data !== undefined && { data: { ...data } }),
  };

  if (buffer.length < config.bufferSize) {
    buffer.push(entry);
  } else {
    buffer[nextSlot] = entry;
  }
  nextSlot = (nextSlot + 1) % config.bufferSize;

  try {
    config.sink?.(entry);
  } catch {
    // Błąd w wypisywaniu logów nie może przerwać gry.
  }
}

export function createLogger(tag: string): Logger {
  return {
    debug: (message, data) => write('debug', tag, message, data),
    info: (message, data) => write('info', tag, message, data),
    warn: (message, data) => write('warn', tag, message, data),
    error: (message, data) => write('error', tag, message, data),
  };
}
