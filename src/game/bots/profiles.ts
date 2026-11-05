import { shuffle, type Rng } from "../rng";
import type { Category } from "../types";

export interface BotProfile {
  id: string;
  name: string;
  /**
   * Stała skórka bota: folder w `assets/skins`, np. `male/005` to `assets/skins/male/005/`.
   * Dopóki tego folderu nie ma, bot nie jest losowany do gry.
   */
  skinId: string;
  /** Bazowa szansa na poprawną odpowiedź (0–1) przy pytaniu o średniej trudności. */
  knowledge: number;
  /** Premia/kara do wiedzy w danych kategoriach. */
  categoryBonus: Partial<Record<Category, number>>;
}

export const BOT_PROFILES: BotProfile[] = [
  {
    id: "karol",
    name: "Karol",
    skinId: "male/001",
    knowledge: 0.67,
    categoryBonus: {
      Matematyka: 0.15,
      "Kuchnia i kulinaria": -0.1,
      Sport: 0.2,
    },
  },
  {
    id: "agata",
    name: "Agata",
    skinId: "female/101",
    knowledge: 0.62,
    categoryBonus: { Kultura: 0.2, Przyroda: 0.1, Nauka: -0.1 },
  },
  {
    id: "wiesiek",
    name: "Architekt Wiesiek",
    skinId: "male/002",
    knowledge: 0.6,
    categoryBonus: { Sport: 0.1, Kultura: -0.1, Architektura: 0.25 },
  },
  {
    id: "ola",
    name: "Ola",
    skinId: "female/102",
    knowledge: 0.55,
    categoryBonus: { Rozmaitości: 0.15, Geografia: 0.1 },
  },
  {
    id: "marek",
    name: "Kapitan Marek",
    skinId: "male/003",
    knowledge: 0.66,
    categoryBonus: { Geografia: 0.2, Historia: 0.05, Kultura: -0.1 },
  },
  {
    id: "krysia",
    name: "Pani Krysia",
    skinId: "female/103",
    knowledge: 0.62,
    categoryBonus: {
      "Kuchnia i kulinaria": 0.2,
      Przyroda: 0.15,
      Historia: -0.1,
    },
  },
  {
    id: "tadeusz",
    name: "Pan Tadeusz",
    skinId: "male/004",
    knowledge: 0.69,
    categoryBonus: {
      Nauka: 0.15,
      Rozmaitości: 0.15,
      Sport: -0.1,
      Matematyka: 0.2,
    },
  },
  {
    id: "maria",
    name: "Naukowiec Maria",
    skinId: "female/104",
    knowledge: 0.7,
    categoryBonus: {
      Chemia: 0.25,
      Geografia: 0.05,
      Sport: -0.2,
      Biologia: 0.15,
    },
  },
  {
    id: "gortat",
    name: 'Marcin "Młot"',
    skinId: "male/005",
    knowledge: 0.55,
    categoryBonus: { Historia: -0.2, Matematyka: -0.25, Sport: 0.2 },
  },
  {
    id: "robert",
    name: "Prezes Robert",
    skinId: "male/006",
    knowledge: 0.64,
    categoryBonus: {
      "Technika i wynalazki": 0.2,
      Informatyka: 0.2,
      Ekonomia: 0.15,
      "Kuchnia i kulinaria": -0.1,
    },
  },
  {
    id: "basia",
    name: "Pani Basia",
    skinId: "female/105",
    knowledge: 0.57,
    categoryBonus: {
      "Kuchnia i kulinaria": 0.2,
      "Polska i tradycje": 0.15,
      "Technika i wynalazki": -0.1,
    },
  },
  {
    id: "julia",
    name: "Julia",
    skinId: "female/106",
    knowledge: 0.62,
    categoryBonus: {
      Literatura: 0.2,
      "Język polski": 0.15,
      Sport: -0.1,
      Geografia: 0.2,
      Kultura: 0.1,
    },
  },
];

export function getBotProfile(id: string): BotProfile {
  const profile = BOT_PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error(`Nieznany profil bota "${id}"`);
  return profile;
}

/**
 * Losuje przeciwników. Z `availableSkinIds` wchodzą tylko boty, których skórka istnieje. Jeśli takich botów
 * nie wystarczy na cały skład, brakujące miejsca dostają pozostałe, bo gra musi wystartować.
 */
export function pickOpponents(
  rng: Rng,
  count: number,
  availableSkinIds?: ReadonlySet<string>,
): BotProfile[] {
  if (count > BOT_PROFILES.length)
    throw new Error(`Za mało profili botów (${BOT_PROFILES.length})`);
  const shuffled = shuffle(rng, BOT_PROFILES);
  if (!availableSkinIds) return shuffled.slice(0, count);

  const withSkin = shuffled.filter((profile) =>
    availableSkinIds.has(profile.skinId),
  );
  const rest = shuffled.filter(
    (profile) => !availableSkinIds.has(profile.skinId),
  );
  return [...withSkin, ...rest].slice(0, count);
}
