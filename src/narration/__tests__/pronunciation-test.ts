import { toSpeakable } from '../pronunciation';

describe('toSpeakable', () => {
  it('cyfry rzymskie po imieniu czyta jak liczebnik', () => {
    expect(toSpeakable('Poprawna odpowiedź: Mieszko I.')).toBe('Poprawna odpowiedź: Mieszko Pierwszy.');
    expect(toSpeakable('Bolesław I Chrobry')).toBe('Bolesław Pierwszy Chrobry');
    expect(toSpeakable('Jan III Sobieski i Zygmunt II August')).toBe('Jan Trzeci Sobieski i Zygmunt Drugi August');
    expect(toSpeakable('Kazimierz IV')).toBe('Kazimierz Czwarty');
  });

  it('polskie litery w imieniu nie przeszkadzają', () => {
    expect(toSpeakable('Władysław II Jagiełło')).toBe('Władysław Drugi Jagiełło');
  });

  it('nie rusza zwykłego tekstu', () => {
    for (const text of [
      'W którym roku odbyła się bitwa pod Grunwaldem?',
      'Kiedy wybuchła I wojna światowa?',
      'Poprawna odpowiedź: Au.',
      'Ile jest planet? Ile Inków?',
      'Pani Krysia, Twoje pytanie.',
    ]) {
      expect(toSpeakable(text)).toBe(text);
    }
  });
});
