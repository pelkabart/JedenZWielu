import { soloEntryRoute } from '../soloEntry';
import { DEFAULT_SET_ID, DEFAULT_SET_NAME, type QuestionSet } from '../types';

const set = (id: string): QuestionSet => ({
  id,
  name: id === DEFAULT_SET_ID ? DEFAULT_SET_NAME : id,
  builtIn: id === DEFAULT_SET_ID,
  createdAt: null,
  sourceFiles: [],
  questions: [],
});

describe('soloEntryRoute', () => {
  it('tylko domyślna kategoria: od razu wybór poziomu z domyślnym zestawem', () => {
    expect(soloEntryRoute([set(DEFAULT_SET_ID)])).toEqual({ pathname: '/solo', params: { set: DEFAULT_SET_ID } });
  });

  it.each([1, 2, 3])('domyślna + %i własne: lista kategorii', (count) => {
    const sets = [set(DEFAULT_SET_ID), ...Array.from({ length: count }, (_, i) => set(`w${i}`))];
    expect(soloEntryRoute(sets)).toEqual({ pathname: '/solo/categories' });
  });
});
