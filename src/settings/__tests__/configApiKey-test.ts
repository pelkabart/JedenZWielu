import { formatEntry, getLogEntries, resetLog } from '@/lib/log';

import { resolveApiKey } from '../configApiKey';

const KEY = 'sk-proj-TESTOWY0123456789abcdWXYZ';

beforeEach(() => resetLog());

describe('resolveApiKey', () => {
  it('przyjmuje poprawny klucz i przycina białe znaki', () => {
    expect(resolveApiKey(KEY)).toBe(KEY);
    expect(resolveApiKey(`  ${KEY}\n`)).toBe(KEY);
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it.each([undefined, '', '   '])('brak klucza (%j) to pusty tekst, bez ostrzeżenia', (raw) => {
    expect(resolveApiKey(raw)).toBe('');
    expect(getLogEntries({ minLevel: 'warn' })).toEqual([]);
  });

  it.each([
    ['zły początek', 'pk-proj-TESTOWY0123456789abcdWXYZ'],
    ['za krótki', 'sk-abc'],
    ['spacja w środku', 'sk-proj-TESTOWY 0123456789abcdWXYZ'],
    ['za długi', `sk-${'a'.repeat(300)}`],
  ])('odrzuca: %s, z ostrzeżeniem, ale bez treści klucza w logach', (_name, raw) => {
    expect(resolveApiKey(raw)).toBe('');
    expect(getLogEntries({ minLevel: 'warn' })).toHaveLength(1);
    expect(getLogEntries().map(formatEntry).join('\n')).not.toContain(raw);
  });
});
