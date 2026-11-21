import type { PlayerView } from '@/multiplayer/protocol';

export type LobbySlot =
  | { kind: 'player'; id: string; nick: string; initial: string; host: boolean; you: boolean; label: string }
  | { kind: 'empty'; id: string };

/** Czysta funkcja dla `PlayerSlots`: gracze w kolejności dołączenia, potem puste miejsca do `maxPlayers`. */
export function lobbySlots(players: PlayerView[], youId: string, maxPlayers: number): LobbySlot[] {
  const taken: LobbySlot[] = players.slice(0, maxPlayers).map((p) => {
    const you = p.id === youId;
    const role = [p.host ? 'host' : null, you ? 'ty' : null].filter(Boolean).join(', ');
    return {
      kind: 'player',
      id: p.id,
      nick: p.nick,
      initial: (p.nick.trim()[0] ?? '?').toLocaleUpperCase('pl'),
      host: p.host,
      you,
      label: role ? `${p.nick} (${role})` : p.nick,
    };
  });
  const empty: LobbySlot[] = Array.from({ length: Math.max(0, maxPlayers - taken.length) }, (_, i) => ({
    kind: 'empty',
    id: `empty-${i}`,
  }));
  return [...taken, ...empty];
}
