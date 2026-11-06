import { MemoryStorage } from '@/categories/testing/fakes';
import { DEFAULT_VOLUME, VolumeStore } from '@/settings/VolumeStore';

import { bindVoiceVolume, musicGain, voiceGain } from '../volume';

describe('musicGain', () => {
  it('100% = poziom bazowy utworu', () => {
    expect(musicGain(0.3, { ...DEFAULT_VOLUME, music: 100, voice: 100 })).toBeCloseTo(0.3);
  });

  it('skaluje poziom bazowy', () => {
    expect(musicGain(0.22, { ...DEFAULT_VOLUME, music: 50, voice: 100 })).toBeCloseTo(0.11);
    expect(musicGain(0.3, { ...DEFAULT_VOLUME, music: 0, voice: 100 })).toBe(0);
  });

  it('nie zależy od głośności lektora', () => {
    expect(musicGain(0.3, { ...DEFAULT_VOLUME, music: 80, voice: 0 })).toBeCloseTo(0.24);
  });

  it('wyłączona muzyka = cisza, niezależnie od suwaka', () => {
    expect(musicGain(0.3, { ...DEFAULT_VOLUME, music: 80, musicEnabled: false })).toBe(0);
    expect(musicGain(0.3, { ...DEFAULT_VOLUME, music: 80, voiceEnabled: false })).toBeCloseTo(0.24);
  });
});

describe('voiceGain', () => {
  it.each([
    [100, 1],
    [50, 0.5],
    [0, 0],
  ])('%p%% → %p', (voice, expected) => {
    expect(voiceGain({ ...DEFAULT_VOLUME, music: 100, voice })).toBeCloseTo(expected);
  });

  it('wyłączony lektor = cisza, niezależnie od suwaka i muzyki', () => {
    expect(voiceGain({ ...DEFAULT_VOLUME, voice: 70, voiceEnabled: false })).toBe(0);
    expect(voiceGain({ ...DEFAULT_VOLUME, voice: 70, musicEnabled: false })).toBeCloseTo(0.7);
  });
});

describe('bindVoiceVolume', () => {
  it('ustawia głośność od razu i przy każdej zmianie; po odpięciu przestaje', async () => {
    const store = new VolumeStore(new MemoryStorage('{"voice": 40}'));
    const player = { volume: -1, pause: jest.fn() };
    const unbind = bindVoiceVolume(player, store);
    expect(player.volume).toBe(1);

    await store.load();
    expect(player.volume).toBeCloseTo(0.4);

    store.preview('voice', 0);
    expect(player.volume).toBe(0);
    // 0% to tylko cisza: odtwarzacz nie jest zatrzymywany, więc klip skończy się normalnie.
    expect(player.pause).not.toHaveBeenCalled();

    unbind();
    store.preview('voice', 90);
    expect(player.volume).toBe(0);
  });
});
