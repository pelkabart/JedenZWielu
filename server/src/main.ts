import { createApp } from './app';
import { createLogger } from './log';

const log = createLogger('serwer');

/** Gdy zamykanie się zawiesi, proces i tak kończy się po tym czasie (Azure czeka ok. 30 s, potem zabija). */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const port = Number(process.env.PORT ?? 8080);
const version = process.env.APP_VERSION ?? 'dev';

const app = createApp({ version });

app
  .listen(port, '0.0.0.0')
  .then((actualPort) => log.info('Serwer działa', { port: actualPort, version }))
  .catch((e: unknown) => {
    log.error('Nie udało się uruchomić serwera', { port, error: e instanceof Error ? e.message : 'unknown' });
    process.exit(1);
  });

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('Zamykanie serwera', { signal, open: app.connectionCount() });
  setTimeout(() => {
    log.warn('Zamykanie trwa za długo – kończę proces', { timeoutMs: SHUTDOWN_TIMEOUT_MS });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  void app.close().then(() => process.exit(0));
};

// Container Apps wysyła SIGTERM przy skalowaniu do zera i przy wdrożeniu nowej wersji.
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
