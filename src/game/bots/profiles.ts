import { shuffle, type Rng } from '../rng';
import type { Category } from '../types';

/**
 * - predator: dobija gracza z najmniejszą liczbą szans,
 * - tactician: eliminuje najgroźniejszego rywala,
 * - avenger: oddaje temu, kto ostatnio go wskazał,
 * - chaotic: wskazuje losowo.
 */
export type Personality = 'predator' | 'tactician' | 'avenger' | 'chaotic';

export type Gender = 'male' | 'female';

/** Ilu botów danej płci może wejść do gry (każdy musi dostać własną skórkę). */
export type GenderLimits = Record<Gender, number>;

export interface BotProfile {
  id: string;
  name: string;
  /** Decyduje o puli skórek. */
  gender: Gender;
  personality: Personality;
  /** Bazowa szansa na poprawną odpowiedź (0–1) przy pytaniu o średniej trudności. */
  knowledge: number;
  /** Premia/kara do wiedzy w danych kategoriach. */
  categoryBonus: Partial<Record<Category, number>>;
  /** Zakres czasu odpowiedzi w ms (przed mnożnikiem poziomu trudności). */
  answerTimeMs: [number, number];
  /** Zakres czasu reakcji na przycisk w finale, w ms. */
  buzzTimeMs: [number, number];
  /** Jak chętnie zgłasza się w finale, gdy zna odpowiedź (0–1). */
  eagerness: number;
  /** Szansa, że zgłosi się, choć nie zna odpowiedzi (blef). */
  recklessness: number;
  /** Jak chętnie w finale bierze kolejne pytanie na siebie (0–1). */
  confidence: number;
}

export const BOT_PROFILES: BotProfile[] = [
  {
    id: 'profesor',
    name: 'Profesor Zenon',
    gender: 'male',
    personality: 'tactician',
    knowledge: 0.72,
    categoryBonus: { Historia: 0.15, Nauka: 0.15, Sport: -0.2 },
    answerTimeMs: [4500, 9000],
    buzzTimeMs: [1800, 3800],
    eagerness: 0.7,
    recklessness: 0.02,
    confidence: 0.75,
  },
  {
    id: 'krysia',
    name: 'Pani Krysia',
    gender: 'female',
    personality: 'avenger',
    knowledge: 0.62,
    categoryBonus: { Kultura: 0.2, Przyroda: 0.1, Nauka: -0.1 },
    answerTimeMs: [3500, 8000],
    buzzTimeMs: [1500, 3500],
    eagerness: 0.75,
    recklessness: 0.05,
    confidence: 0.55,
  },
  {
    id: 'bartek',
    name: 'Bartek',
    gender: 'male',
    personality: 'predator',
    knowledge: 0.58,
    categoryBonus: { Sport: 0.25, Kultura: -0.1 },
    answerTimeMs: [2000, 5500],
    buzzTimeMs: [700, 2200],
    eagerness: 0.9,
    recklessness: 0.15,
    confidence: 0.7,
  },
  {
    id: 'ola',
    name: 'Ola',
    gender: 'female',
    personality: 'chaotic',
    knowledge: 0.55,
    categoryBonus: { Rozmaitości: 0.15, Geografia: 0.1 },
    answerTimeMs: [2500, 7000],
    buzzTimeMs: [1000, 3000],
    eagerness: 0.8,
    recklessness: 0.1,
    confidence: 0.5,
  },
  {
    id: 'marek',
    name: 'Kapitan Marek',
    gender: 'male',
    personality: 'predator',
    knowledge: 0.66,
    categoryBonus: { Geografia: 0.2, Historia: 0.05, Kultura: -0.1 },
    answerTimeMs: [3000, 7000],
    buzzTimeMs: [1200, 3000],
    eagerness: 0.8,
    recklessness: 0.05,
    confidence: 0.65,
  },
  {
    id: 'zosia',
    name: 'Zosia',
    gender: 'female',
    personality: 'tactician',
    knowledge: 0.64,
    categoryBonus: { Nauka: 0.15, Przyroda: 0.15, Historia: -0.1 },
    answerTimeMs: [2500, 6500],
    buzzTimeMs: [900, 2600],
    eagerness: 0.85,
    recklessness: 0.04,
    confidence: 0.6,
  },
  {
    id: 'wiesiek',
    name: 'Wiesiek',
    gender: 'male',
    personality: 'avenger',
    knowledge: 0.52,
    categoryBonus: { Sport: 0.15, Rozmaitości: 0.1, Nauka: -0.15 },
    answerTimeMs: [3000, 8500],
    buzzTimeMs: [1100, 3400],
    eagerness: 0.7,
    recklessness: 0.2,
    confidence: 0.8,
  },
  {
    id: 'julia',
    name: 'Julia',
    gender: 'female',
    personality: 'chaotic',
    knowledge: 0.6,
    categoryBonus: { Kultura: 0.15, Geografia: 0.05, Sport: -0.1 },
    answerTimeMs: [2000, 6000],
    buzzTimeMs: [800, 2400],
    eagerness: 0.8,
    recklessness: 0.08,
    confidence: 0.45,
  },
];

/** Profil o przeciętnych parametrach, którym w symulacjach zastępujemy człowieka. */
export const AVERAGE_PLAYER_PROFILE: BotProfile = {
  id: 'average-human',
  name: 'Gracz',
  gender: 'male',
  personality: 'predator',
  knowledge: 0.6,
  categoryBonus: {},
  answerTimeMs: [3000, 8000],
  buzzTimeMs: [1000, 3000],
  eagerness: 0.8,
  recklessness: 0.05,
  confidence: 0.6,
};

export function getBotProfile(id: string): BotProfile {
  const profile = BOT_PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error(`Nieznany profil bota "${id}"`);
  return profile;
}

/**
 * Losuje przeciwników. `limits` ogranicza liczbę botów każdej płci; jeśli limity nie wystarczą
 * na cały skład, brakujące miejsca dostają pozostałe boty, bo gra musi wystartować.
 */
export function pickOpponents(rng: Rng, count: number, limits?: GenderLimits): BotProfile[] {
  if (count > BOT_PROFILES.length) throw new Error(`Za mało profili botów (${BOT_PROFILES.length})`);
  const shuffled = shuffle(rng, BOT_PROFILES);
  if (!limits) return shuffled.slice(0, count);

  const left = { ...limits };
  const allowed = shuffled.filter((profile) => left[profile.gender]-- > 0);
  const rest = shuffled.filter((profile) => !allowed.includes(profile));
  return [...allowed, ...rest].slice(0, count);
}
