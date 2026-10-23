const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { modelVersion } = require('../withVoiceModel');

describe('withVoiceModel – wersja modelu', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-model-'));
    fs.mkdirSync(path.join(dir, 'espeak-ng-data', 'voices'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'espeak-ng-data', 'voices', 'pl'), 'voice');
    fs.writeFileSync(path.join(dir, 'tokens.txt'), 'tokens');
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('liczy skrót ze ścieżek z „/” – tak samo na Windowsie i na Linuksie (EAS)', () => {
    const expected = crypto
      .createHash('sha1')
      .update('espeak-ng-data/voices/pl')
      .update('voice')
      .update('tokens.txt')
      .update('tokens')
      .digest('hex')
      .slice(0, 8);
    expect(modelVersion(dir)).toBe(expected);
  });
});
