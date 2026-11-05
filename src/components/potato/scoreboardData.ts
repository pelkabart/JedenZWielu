import { endedEarly, type PotatoState } from '@/game/potato/engine';

export interface ScoreboardRow {
  id: string;
  name: string;
  isHuman: boolean;
  seat: number;
  place: number;
  points: number;
  errors: number;
  /** Tylko gdy gra doszła do końca: po odpadnięciu człowieka nikt nie wygrał. */
  winner: boolean;
}

export interface ScoreboardHeadline {
  title: string;
  subtitle: string;
  /** Czyja postać stoi obok tabeli: zwycięzcy albo gracza, który odpadł. */
  heroId: string | null;
  won: boolean;
}

const ROW_MAX = 46;
const ROW_MIN = 30;
/** Nagłówek tabeli, przyciski, uwaga i odstępy, czyli wszystko poza wierszami. */
export const SCOREBOARD_CHROME_HEIGHT = 146;

/** Wiersze w kolejności rankingu. Finał wygrywa ostatni w grze, więc nie sortujemy po punktach. */
export function scoreboardRows(game: PotatoState): ScoreboardRow[] {
  const early = endedEarly(game);
  const ranked = (game.ranking ?? []).flatMap((id) => game.players.filter((p) => p.id === id));
  return ranked.map((p, index) => ({
    id: p.id,
    name: p.name,
    isHuman: p.isHuman,
    seat: p.seat,
    place: index + 1,
    points: p.points,
    errors: p.errors,
    winner: index === 0 && !early,
  }));
}

export function scoreboardHeadline(game: PotatoState): ScoreboardHeadline {
  const rows = scoreboardRows(game);
  if (endedEarly(game)) {
    const me = rows.find((r) => r.isHuman);
    return { title: 'Odpadasz!', subtitle: me ? `Miejsce ${me.place} z ${rows.length}` : '', heroId: me?.id ?? null, won: false };
  }
  const winner = rows[0];
  if (!winner) return { title: 'Koniec gry', subtitle: '', heroId: null, won: false };
  return {
    title: winner.isHuman ? 'Wygrywasz!' : `Wygrywa ${winner.name}`,
    subtitle: `${winner.points} pkt`,
    heroId: winner.id,
    won: true,
  };
}

/** Wyjaśnienie pod tabelą, gdy sama kolejność mogłaby zdziwić. */
export function scoreboardNote(game: PotatoState): string | null {
  if (endedEarly(game)) return 'Kolejność wg stanu gry w chwili Twojego odpadnięcia.';
  const rows = scoreboardRows(game);
  const pointsOutOfOrder = rows.some((row, i) => i > 0 && row.points > rows[i - 1].points);
  return pointsOutOfOrder ? 'Wygrywa ten, kto najdłużej zostanie w grze.' : null;
}

/** Wysokość wiersza tak, żeby cała tabela i przyciski zmieściły się na ekranie. */
export function scoreboardRowHeight(availableHeight: number, rowCount: number): number {
  const fit = (availableHeight - SCOREBOARD_CHROME_HEIGHT) / Math.max(1, rowCount);
  return Math.floor(Math.max(ROW_MIN, Math.min(ROW_MAX, fit)));
}
