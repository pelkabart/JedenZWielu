import { pickModelAsset } from '../modelAsset';

describe('pickModelAsset', () => {
  it('bierze folder z konfiguracji, gdy jest w APK', () => {
    expect(pickModelAsset('models/vits-piper-pl-91b2fede', ['vits-piper-pl-91b2fede'])).toEqual({
      asset: 'models/vits-piper-pl-91b2fede',
      mismatch: false,
    });
  });

  it('gdy nazwa z Metro nie pasuje do APK, bierze folder z APK zamiast pustej kopii', () => {
    expect(pickModelAsset('models/vits-piper-pl-976a80a8', ['vits-piper-pl-91b2fede', 'other-model'])).toEqual({
      asset: 'models/vits-piper-pl-91b2fede',
      mismatch: true,
    });
  });

  it('działa bez konfiguracji', () => {
    expect(pickModelAsset(null, ['vits-piper-pl-aaaa0000'])).toEqual({
      asset: 'models/vits-piper-pl-aaaa0000',
      mismatch: true,
    });
  });

  it('bez modelu w APK zwraca null', () => {
    expect(pickModelAsset('models/vits-piper-pl-91b2fede', ['sherpa-onnx-whisper'])).toEqual({
      asset: null,
      mismatch: false,
    });
  });
});
