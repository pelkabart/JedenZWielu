import { shuffle, type Rng } from '../rng';
import type { Category } from '../types';

export type Gender = 'male' | 'female';

/** Ilu botów danej płci może wejść do gry (każdy musi dostać własną skórkę). */
export type GenderLimits = Record<Gender, number>;

export interface BotProfile {
  id: string;
  name: string;
  /** Decyduje o puli skórek. */
  gender: Gender;
  /** Bazowa szansa na poprawną odpowiedź (0–1) przy pytaniu o średniej trudności. */
  knowledge: number;
  /** Premia/kara do wiedzy w danych kategoriach. */
  categoryBonus: Partial<Record<Category, number>>;
}

export const BOT_PROFILES: BotProfile[] = [
  {
    id: 'profesor',
    name: 'Profesor Zenon',
    gender: 'male',
    knowledge: 0.72,
    categoryBonus: { Historia: 0.15, Nauka: 0.15, Sport: -0.2 },
  },
  {
    id: 'krysia',
    name: 'Pani Krysia',
    gender: 'female',
    knowledge: 0.62,
    categoryBonus: { Kultura: 0.2, Przyroda: 0.1, Nauka: -0.1 },
  },
  {
    id: 'bartek',
    name: 'Bartek',
    gender: 'male',
    knowledge: 0.58,
    categoryBonus: { Sport: 0.25, Kultura: -0.1 },
  },
  {
    id: 'ola',
    name: 'Ola',
    gender: 'female',
    knowledge: 0.55,
    categoryBonus: { Rozmaitości: 0.15, Geografia: 0.1 },
  },
  {
    id: 'marek',
    name: 'Kapitan Marek',
    gender: 'male',
    knowledge: 0.66,
    categoryBonus: { Geografia: 0.2, Historia: 0.05, Kultura: -0.1 },
  },
  {
    id: 'zosia',
    name: 'Zosia',
    gender: 'female',
    knowledge: 0.64,
    categoryBonus: { Nauka: 0.15, Przyroda: 0.15, Historia: -0.1 },
  },
  {
    id: 'wiesiek',
    name: 'Wiesiek',
    gender: 'male',
    knowledge: 0.52,
    categoryBonus: { Sport: 0.15, Rozmaitości: 0.1, Nauka: -0.15 },
  },
  {
    id: 'julia',
    name: 'Julia',
    gender: 'female',
    knowledge: 0.6,
    categoryBonus: { Kultura: 0.15, Geografia: 0.05, Sport: -0.1 },
  },
];

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
