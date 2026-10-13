import { answerLayout, COMPACT_BELOW, KEYBOARD_GAP } from '../answerLayout';

describe('answerLayout', () => {
  it('bez klawiatury panel jest w zwykłym miejscu', () => {
    expect(answerLayout({ windowHeight: 390, keyboardHeight: 0, safeTop: 0 })).toEqual({
      keyboardOpen: false,
      available: 390,
      compact: false,
      bottom: 0,
    });
  });

  it('z klawiaturą panel stoi tuż nad nią', () => {
    const layout = answerLayout({ windowHeight: 390, keyboardHeight: 150, safeTop: 0 });
    expect(layout.keyboardOpen).toBe(true);
    expect(layout.bottom).toBe(150 + KEYBOARD_GAP);
    expect(layout.available).toBe(390 - 150 - 2 * KEYBOARD_GAP);
    expect(layout.compact).toBe(false);
  });

  it('gdy nad klawiaturą jest mało miejsca, przechodzi w tryb kompaktowy', () => {
    // Typowy telefon w poziomie: ok. 360 dp wysokości, klawiatura ok. 230 dp.
    const layout = answerLayout({ windowHeight: 360, keyboardHeight: 230, safeTop: 0 });
    expect(layout.available).toBeLessThan(COMPACT_BELOW);
    expect(layout.compact).toBe(true);
  });

  it('uwzględnia wycięcie ekranu u góry i nie zwraca ujemnego miejsca', () => {
    const withNotch = answerLayout({ windowHeight: 360, keyboardHeight: 200, safeTop: 24 });
    expect(withNotch.available).toBe(360 - 200 - 2 * KEYBOARD_GAP - 24);
    expect(answerLayout({ windowHeight: 300, keyboardHeight: 400, safeTop: 0 }).available).toBe(0);
  });
});
