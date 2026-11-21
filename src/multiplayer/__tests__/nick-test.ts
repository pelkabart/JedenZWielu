import { normalizeNick } from '../nick';
import { loadNick, saveNick } from '../nickStore';
import { isCompleteCode, normalizeCodeInput } from '../roomCode';

describe('normalizeNick (te same przypadki co na serwerze)', () => {
  it.each([
    ['  Bartek  ', 'Bartek'],
    ['Ala   ma  kota', 'Ala ma kota'],
    ['Żółw', 'Żółw'],
    ['ab', 'ab'],
    ['x'.repeat(16), 'x'.repeat(16)],
    ['a', null],
    ['   ', null],
    ['', null],
    ['x'.repeat(17), null],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeNick(raw)).toBe(expected);
  });
});

describe('kod pokoju', () => {
  it.each([
    ['abcde', 'ABCDE'],
    [' ab cd e ', 'ABCDE'],
    ['abcdefgh', 'ABCDE'],
  ])('normalizeCodeInput(%j) → %j', (raw, expected) => {
    expect(normalizeCodeInput(raw)).toBe(expected);
  });

  it.each([
    ['ABCDE', true],
    ['K7M2Q', true],
    ['ABCD', false],
    ['ABCD0', false],
    ['ABCDO', false],
    ['ABCD1', false],
    ['ABCDI', false],
  ])('isCompleteCode(%j) → %j', (code, expected) => {
    expect(isCompleteCode(code)).toBe(expected);
  });
});

describe('zapamiętany nick', () => {
  const memory = (initial: string | null) => {
    let text = initial;
    return {
      read: async () => text,
      write: async (next: string) => {
        text = next;
      },
      get text() {
        return text;
      },
    };
  };

  it('zapis i odczyt', async () => {
    const storage = memory(null);
    await saveNick(storage, 'Bartek');
    expect(await loadNick(storage)).toBe('Bartek');
  });

  it.each([null, '', 'nie json', '{"nick":5}', '[]'])('plik %j: pusty nick', async (text) => {
    expect(await loadNick(memory(text))).toBe('');
  });

  it('za długi zapisany nick jest przycinany', async () => {
    expect(await loadNick(memory(JSON.stringify({ nick: 'x'.repeat(40) })))).toBe('x'.repeat(16));
  });

  it('błąd odczytu i zapisu nie rzuca', async () => {
    const broken = {
      read: async () => {
        throw new Error('disk');
      },
      write: async () => {
        throw new Error('disk');
      },
    };
    expect(await loadNick(broken)).toBe('');
    await expect(saveNick(broken, 'Ala')).resolves.toBeUndefined();
  });
});
