import { getPlayer } from '../engine';
import type { Phase } from '../types';
import type { SoloView } from './SoloController';

// Proste kwestie prowadzącego; w etapie 5 zastąpi je pula losowych tekstów.

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

/** Zapowiedź przed pytaniem: kto teraz odpowiada. */
export function introLine(view: SoloView, playerId: string): string {
  const player = getPlayer(view.game, playerId);
  return player.isHuman ? 'Odpowiadasz Ty!' : `Odpowiada: ${player.name}`;
}

export function hostLine(view: SoloView): string {
  const { game, overlay } = view;
  const name = (id: string) => getPlayer(game, id).name;
  const isHuman = (id: string) => getPlayer(game, id).isHuman;

  if (overlay) {
    switch (overlay.kind) {
      case 'banner':
        return overlay.phase === 'stage1' ? 'Witam w grze „Jeden z Wielu”! Zaczynamy.' : `Przechodzimy do etapu: ${PHASE_TITLES[overlay.phase]}!`;
      case 'reveal':
        if (overlay.correct) return isHuman(overlay.playerId) ? 'Brawo, dobrze!' : `Dobrze, ${name(overlay.playerId)}!`;
        if (overlay.eliminated) {
          return isHuman(overlay.playerId)
            ? `Niestety, odpadasz. Poprawna odpowiedź: ${overlay.correctAnswer}.`
            : `Niestety, ${name(overlay.playerId)} odpada. Poprawna odpowiedź: ${overlay.correctAnswer}.`;
        }
        if (overlay.text === null) return `Czas minął! Poprawna odpowiedź: ${overlay.correctAnswer}.`;
        return `Niestety nie. Poprawna odpowiedź: ${overlay.correctAnswer}.`;
      case 'noBuzz':
        return `Nikt się nie zgłosił. Poprawna odpowiedź: ${overlay.correctAnswer}.`;
      case 'pick':
        if (overlay.chooserId === overlay.targetId) {
          return isHuman(overlay.chooserId) ? 'Bierzesz pytanie na siebie.' : `${name(overlay.chooserId)} bierze pytanie na siebie.`;
        }
        if (isHuman(overlay.chooserId)) return `Wskazujesz: ${name(overlay.targetId)}.`;
        return isHuman(overlay.targetId)
          ? `${name(overlay.chooserId)} wskazuje Ciebie!`
          : `${name(overlay.chooserId)} wskazuje: ${name(overlay.targetId)}.`;
      case 'buzz':
        return isHuman(overlay.playerId) ? 'Zgłaszasz się!' : `Zgłasza się ${name(overlay.playerId)}!`;
      case 'intro':
        return introLine(view, overlay.playerId);
    }
  }

  const { pending } = game;
  switch (pending.kind) {
    case 'answer':
      return isHuman(pending.playerId) ? 'Twoja kolej! Wpisz odpowiedź.' : `Odpowiada: ${name(pending.playerId)}.`;
    case 'buzz':
      return 'Kto pierwszy?';
    case 'pick':
      if (isHuman(pending.chooserId)) return pending.allowSelf ? 'Kogo wskazujesz? Możesz wziąć pytanie na siebie.' : 'Kogo wskazujesz?';
      return `${name(pending.chooserId)} wybiera…`;
    case 'none':
      return 'Dziękuję za grę!';
  }
}
