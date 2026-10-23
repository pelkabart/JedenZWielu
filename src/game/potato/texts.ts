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
  duel: 'Dobra odpowiedź daje Ci szansę i odbiera szansę rywalom. Zostaje ostatni gracz.',
  finished: '',
};

/** Legenda na pasku: co oznaczają kropki i liczby oraz jaki jest aktualny mnożnik. */
export function legendFor(phase: PotatoPhase, multiplier: number): string {
  switch (phase) {
    case 'round1':
      return 'Kropki to życia. Odpadasz przy 0.';
    case 'round2':
      return `Mnożnik: ×${multiplier}. Kropki to osłona. Odpadasz przy 0.`;
    case 'sprint':
      return 'Liczba przy graczu to punkty w sprincie.';
    case 'duel':
      return 'Kropki to szanse. Odpadasz przy 0.';
    case 'finished':
      return '';
  }
}
