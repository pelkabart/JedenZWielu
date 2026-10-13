import { allowedTypos, isCorrectAnswer, levenshtein, normalizeAnswer } from '../answers';

describe('normalizeAnswer', () => {
  it('usuwa wielkość liter, polskie znaki i interpunkcję', () => {
    expect(normalizeAnswer('  Maria Skłodowska-Curie! ')).toBe('maria sklodowska curie');
    expect(normalizeAnswer('ŻÓŁW')).toBe('zolw');
    expect(normalizeAnswer('Wisła')).toBe('wisla');
  });

  it('skleja liczby z separatorem dziesiętnym', () => {
    expect(normalizeAnswer('42,195')).toBe('42195');
    expect(normalizeAnswer('42.195')).toBe('42195');
  });
});

describe('levenshtein', () => {
  it('liczy odległość edycyjną', () => {
    expect(levenshtein('kot', 'kot')).toBe(0);
    expect(levenshtein('kot', 'kit')).toBe(1);
    expect(levenshtein('canberra', 'kanbera')).toBe(2);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('allowedTypos', () => {
  it('nie toleruje literówek w liczbach i krótkich słowach', () => {
    expect(allowedTypos('1410')).toBe(0);
    expect(allowedTypos('42195')).toBe(0);
    expect(allowedTypos('rysy')).toBe(0);
  });

  it('toleruje więcej literówek w dłuższych odpowiedziach', () => {
    expect(allowedTypos('ottawa')).toBe(1);
    expect(allowedTypos('adam mickiewicz')).toBe(2);
  });
});

describe('isCorrectAnswer', () => {
  it('akceptuje dowolną z poprawnych odpowiedzi', () => {
    const accepted = ['Ocean Spokojny', 'Spokojny', 'Pacyfik'];
    expect(isCorrectAnswer('pacyfik', accepted)).toBe(true);
    expect(isCorrectAnswer('ocean spokojny', accepted)).toBe(true);
    expect(isCorrectAnswer('Atlantyk', accepted)).toBe(false);
  });

  it('akceptuje odpowiedź bez polskich znaków', () => {
    expect(isCorrectAnswer('dab', ['dąb'])).toBe(true);
    expect(isCorrectAnswer('wodor', ['wodór'])).toBe(true);
  });

  it('akceptuje drobne literówki w długich odpowiedziach', () => {
    expect(isCorrectAnswer('Mickiewic', ['Adam Mickiewicz', 'Mickiewicz'])).toBe(true);
    expect(isCorrectAnswer('Otawa', ['Ottawa'])).toBe(true);
  });

  it('wymaga dokładnej liczby', () => {
    expect(isCorrectAnswer('1410', ['1410'])).toBe(true);
    expect(isCorrectAnswer('1411', ['1410'])).toBe(false);
    expect(isCorrectAnswer('42,195', ['42', '42,195'])).toBe(true);
    expect(isCorrectAnswer('42,196', ['42', '42,195'])).toBe(false);
  });

  it('wymaga dokładnych krótkich odpowiedzi', () => {
    expect(isCorrectAnswer('Rio', ['Rio de Janeiro', 'Rio'])).toBe(true);
    expect(isCorrectAnswer('Ryo', ['Rio'])).toBe(false);
    expect(isCorrectAnswer('Ag', ['Au'])).toBe(false);
  });

  it('odrzuca brak odpowiedzi i pusty tekst', () => {
    expect(isCorrectAnswer(null, ['Rysy'])).toBe(false);
    expect(isCorrectAnswer('   ', ['Rysy'])).toBe(false);
    expect(isCorrectAnswer('?!', ['Rysy'])).toBe(false);
  });
});
