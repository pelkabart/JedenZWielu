import type { PotatoPhase } from './engine';

/** Teksty rund: wspólne dla ekranu i lektora. */
export const PHASE_TITLE: Record<PotatoPhase, string> = {
  round1: 'Runda 1 · Odsiew',
  round2: 'Runda 2 · Bomba',
  sprint: 'Runda 3 · Sprint',
  duel: 'Runda 4 · Finał',
  finished: 'Koniec gry',
};

export const PHASE_RULE: Record<PotatoPhase, string> = {
  round1: 'Dobra odpowiedź przekazuje ziemniaka. Zła kosztuje życie.',
  round2: 'Każde dobre podanie podnosi mnożnik. Wybuch zabiera osłonę.',
  sprint: '60 sekund. Dobra odpowiedź to punkt, błąd to −1 s.',
  duel: 'Dobra odpowiedź: +1 szansa dla Ciebie, −1 dla rywali.',
  finished: '',
};
