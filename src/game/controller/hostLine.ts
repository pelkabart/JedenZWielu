import { getPlayer } from '../engine';
import type { Phase } from '../types';
import type { SoloView } from './SoloController';

// Proste kwestie prowadzącego; w etapie 5 zastąpi je pula losowych tekstów.
// Każde zdanie jest nagrane głosem lektora (scripts/narration), więc po zmianie tekstu trzeba nagrać je ponownie.

export const PHASE_TITLES: Record<Phase, string> = {
  stage1: 'Etap I',
  stage2: 'Etap II',
  final: 'Finał',
  finished: 'Koniec gry',
};

export const PHASE_RULES: Record<Phase, string> = {
  stage1: 'Każdy z graczy dostaje jedno pytanie. Zła odpowiedź kosztuje szansę.',
  stage2: 'Kto odpowie dobrze, wskazuje następną osobę. Gramy, aż zostanie trójka.',
  final: 'Zgłaszajcie się do pytań! Za dobrą odpowiedź 10 punktów. Pula: 50 pytań.',
  finished: '',
};

/** Zapowiedzi etapów słowami — cyfry rzymskie źle brzmią czytane przez lektora. */
const PHASE_ANNOUNCEMENTS: Record<Phase, string> = {
  stage1: 'Witam w grze „Jeden z Wielu”! Zaczynamy.',
  stage2: 'Przechodzimy do drugiego etapu!',
  final: 'Przechodzimy do finału!',
  finished: 'Koniec gry!',
};

/** Zapowiedź przed pytaniem: kto teraz odpowiada. */
export function introLine(view: SoloView, playerId: string): string {
  const player = getPlayer(view.game, playerId);
  return player.isHuman ? 'Odpowiadasz Ty!' : `Odpowiada: ${player.name}`;
}

/** Zdanie z poprawną odpowiedzią — osobno, żeby nagrywać je raz na pytanie, a nie dla każdego gracza. */
const correctAnswerLine = (answer: string) => `Poprawna odpowiedź: ${answer}.`;

/**
 * Co mówi prowadzący, jako lista zdań. Lektor czyta je po kolei;
 * w dymku są połączone w jeden tekst (`hostLine`).
 */
export function hostSpeech(view: SoloView): string[] {
  const { game, overlay } = view;
  const name = (id: string) => getPlayer(game, id).name;
  const isHuman = (id: string) => getPlayer(game, id).isHuman;
  /** Przed pytaniem i w trakcie odpowiedzi bota ten sam tekst — lektor nie powtarza go po przeczytaniu pytania. */
  const askLine = (id: string) => (isHuman(id) ? 'Pytanie dla Ciebie.' : `${name(id)}, Twoje pytanie.`);

  if (overlay) {
    switch (overlay.kind) {
      case 'banner':
        return [PHASE_ANNOUNCEMENTS[overlay.phase]];
      case 'reveal': {
        if (overlay.correct) return [isHuman(overlay.playerId) ? 'Brawo, dobrze!' : `Dobrze, ${name(overlay.playerId)}!`];
        const answer = correctAnswerLine(overlay.correctAnswer);
        if (overlay.eliminated) {
          return [isHuman(overlay.playerId) ? 'Niestety, odpadasz.' : `Niestety, ${name(overlay.playerId)} odpada.`, answer];
        }
        return [overlay.text === null ? 'Czas minął!' : 'Niestety nie.', answer];
      }
      case 'noBuzz':
        return ['Nikt się nie zgłosił.', correctAnswerLine(overlay.correctAnswer)];
      case 'pick':
        if (overlay.chooserId === overlay.targetId) {
          return [isHuman(overlay.chooserId) ? 'Bierzesz pytanie na siebie.' : `${name(overlay.chooserId)} bierze pytanie na siebie.`];
        }
        if (isHuman(overlay.chooserId)) return [`Wskazujesz: ${name(overlay.targetId)}.`];
        return [
          isHuman(overlay.targetId) ? `${name(overlay.chooserId)} wskazuje Ciebie!` : `${name(overlay.chooserId)} wskazuje: ${name(overlay.targetId)}.`,
        ];
      case 'buzz':
        return [isHuman(overlay.playerId) ? 'Zgłaszasz się!' : `Zgłasza się ${name(overlay.playerId)}!`];
      case 'intro':
        return [introLine(view, overlay.playerId)];
      case 'reading': {
        const { pending } = game;
        return [pending.kind === 'answer' ? askLine(pending.playerId) : 'Pytanie do wszystkich.'];
      }
    }
  }

  const { pending } = game;
  switch (pending.kind) {
    case 'answer':
      return [isHuman(pending.playerId) ? 'Twoja kolej! Wpisz odpowiedź.' : askLine(pending.playerId)];
    case 'buzz':
      return ['Kto pierwszy?'];
    case 'pick':
      if (isHuman(pending.chooserId)) return [pending.allowSelf ? 'Kogo wskazujesz? Możesz wziąć pytanie na siebie.' : 'Kogo wskazujesz?'];
      return [`${name(pending.chooserId)} wybiera…`];
    case 'none':
      return ['Dziękuję za grę!'];
  }
}

export function hostLine(view: SoloView): string {
  return hostSpeech(view).join(' ');
}
