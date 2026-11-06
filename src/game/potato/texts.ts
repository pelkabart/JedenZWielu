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
  round2: 'Każda dobra odpowiedź podnosi mnożnik, najwyżej do 3. Pierwszy błąd zabiera tylko osłonę, każdy kolejny tyle szans, ile wynosi mnożnik.',
  sprint: '60 sekund na punkty. Dobra odpowiedź to 5 punktów. Błąd to 1 sekunda mniej i najpierw osłona, potem szansa.',
  duel: 'Dobra odpowiedź daje 10 punktów. Błąd odbiera szansę. Zostaje ostatni gracz.',
  finished: '',
};
