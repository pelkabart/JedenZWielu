import { DEFAULT_SET_ID, type QuestionSet } from './types';

export type SoloEntryRoute = { pathname: '/solo'; params: { set: string } } | { pathname: '/solo/categories' };

/** Lista kategorii pojawia się tylko wtedy, gdy jest z czego wybierać. */
export function soloEntryRoute(sets: QuestionSet[]): SoloEntryRoute {
  if (sets.length > 1) return { pathname: '/solo/categories' };
  return { pathname: '/solo', params: { set: DEFAULT_SET_ID } };
}
