/**
 * Logi serwera: jeden wiersz JSON na wpis (stdout/stderr). Azure Container Apps zbiera je do Log Analytics,
 * gdzie da się filtrować po polach. Tak jak w aplikacji: tylko małe wartości (id, liczby), nigdy całe wiadomości.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogData = Record<string, unknown>;

export interface LogEntry {
  time: string;
  level: LogLevel;
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

export const stdoutSink: LogSink = (entry) => {
  const line = JSON.stringify(entry);
  if (entry.level === 'error' || entry.level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
};

/** W testach nic nie wypisujemy, w produkcji pomijamy `debug` (Log Analytics liczy za ilość danych). */
let sink: LogSink | null = process.env.NODE_ENV === 'test' ? null : stdoutSink;
let minLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

export function configureLog(options: { sink?: LogSink | null; minLevel?: LogLevel }) {
  if (options.sink !== undefined) sink = options.sink;
  if (options.minLevel !== undefined) minLevel = options.minLevel;
}

export function createLogger(tag: string): Logger {
  const write = (level: LogLevel, message: string, data?: LogData) => {
    if (!sink || LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    sink({ time: new Date().toISOString(), level, tag, message, ...(data ? { data } : {}) });
  };
  return {
    debug: (m, d) => write('debug', m, d),
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
  };
}
