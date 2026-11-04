import type { PotatoPhase } from './engine';

/** Teksty rund: wspólne dla ekranu i lektora. */
export const PHASE_TITLE: Record<PotatoPhase, string> = {
  round1: 'Runda 1 · Odsiew',
  round2: 'Runda 2 · Bomba',
  sprint: 'Runda 3 · Sprint',
  duel: 'Runda 4 · Finał',
  finished: 'Koniec gry',
};

/** Krótki opis rundy: pokazywany na początku rundy i czytany przez lektora. */
export const PHASE_RULE: Record<PotatoPhase, string> = {
  round1: 'Każdy błąd kosztuje życie. Kto straci wszystkie, odpada.',
  round2: 'Każda dobra odpowiedź podnosi mnożnik. Błąd to wybuch: tracisz osłonę równą mnożnikowi.',
  sprint: '60 sekund na punkty. Dobra odpowiedź to punkt, błąd to 1 sekunda mniej.',
  duel: 'Dobra odpowiedź daje punkt. Błąd odbiera szansę. Zostaje ostatni gracz.',
  finished: '',
};
