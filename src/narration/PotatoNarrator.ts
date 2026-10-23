import { createLogger } from '@/lib/log';
import type { PotatoView } from '@/game/potato/controller/PotatoController';
import { PHASE_RULE, PHASE_TITLE } from '@/game/potato/texts';

import type { Voice } from './NarrationDirector';

const log = createLogger('lektor');

/** To, co z gry rund udostępnia sterownik lektorowi. */
export interface PotatoSource {
  subscribe(listener: () => void): () => void;
  getView(): PotatoView;
  setSpeaking(speaking: boolean): void;
}

/** Co prowadzący mówi w danym widoku. Pusta lista = milczy. */
export function narrationFor(view: PotatoView): string[] {
  const { overlay, awaitingPick, game } = view;
  const name = (id: string | null) => game.players.find((p) => p.id === id)?.name ?? '';
  if (overlay?.kind === 'finished') {
    return ['Koniec gry!', `Wygrywa ${name(game.ranking?.[0] ?? null)}.`];
  }
  if (overlay?.kind === 'round') return [PHASE_TITLE[overlay.phase], PHASE_RULE[overlay.phase]];
  if (overlay?.kind === 'reveal') {
    return overlay.correct ? ['Brawo, dobrze!'] : ['Niestety.', `Poprawna odpowiedź: ${overlay.correctAnswer}.`];
  }
  if (awaitingPick) return ['Komu podajesz ziemniaka?'];
  if (overlay !== null || game.question === null || game.holderId === null) return [];
  const holder = game.players.find((p) => p.id === game.holderId);
  const who = holder?.isHuman ? 'Odpowiadasz Ty!' : `Odpowiada: ${holder?.name ?? ''}.`;
  return [who, game.question.question];
}

/**
 * Głos prowadzącego w grze rund: mówi za każdym razem, gdy zmienia się to, co ma powiedzieć.
 * Sterownik czeka z licznikami, dopóki lektor mówi (`setSpeaking`); pauza wstrzymuje głos.
 */
export class PotatoNarrator {
  private lastKey: string | null = null;
  private currentId = 0;
  private speaking = false;
  private voicePaused = false;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly source: PotatoSource,
    private readonly voice: Voice,
  ) {
    this.unsubscribe = source.subscribe(this.sync);
    this.sync();
  }

  dispose() {
    this.unsubscribe();
    this.currentId = 0;
    this.speaking = false;
    this.safely('stop', () => this.voice.stop());
    this.safely('dispose', () => this.voice.dispose());
    this.source.setSpeaking(false);
  }

  private readonly sync = () => {
    const view = this.source.getView();
    const texts = narrationFor(view);
    const key = texts.length > 0 ? `${view.game.cursor}|${texts.join('|')}` : null;

    if (key !== null && key !== this.lastKey) {
      this.lastKey = key;
      this.say(texts);
    }
    if (view.paused && this.speaking && !this.voicePaused) {
      this.voicePaused = true;
      this.safely('pause', () => this.voice.pause());
    } else if (!view.paused && this.voicePaused) {
      this.voicePaused = false;
      this.safely('resume', () => this.voice.resume());
    }
  };

  private say(texts: string[]) {
    const id = ++this.currentId;
    if (this.speaking) this.safely('stop', () => this.voice.stop());
    this.speaking = true;
    this.voicePaused = false;
    this.source.setSpeaking(true);
    log.debug('Prowadzący mówi', { sentences: texts.length });
    let spoken: Promise<void>;
    try {
      spoken = this.voice.say(texts);
    } catch (error) {
      spoken = Promise.reject(error);
    }
    spoken.then(
      () => this.finished(id, null),
      (error: unknown) => this.finished(id, error),
    );
  }

  private finished(id: number, error: unknown) {
    if (error !== null) {
      log.error('Błąd lektora', { error: error instanceof Error ? error.message : String(error) });
    }
    // Przerwana wypowiedź może skończyć się później; liczy się tylko bieżąca.
    if (id !== this.currentId) return;
    this.speaking = false;
    this.voicePaused = false;
    this.source.setSpeaking(false);
  }

  private safely(action: string, fn: () => void) {
    try {
      fn();
    } catch (error) {
      log.error('Błąd lektora', { action, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
