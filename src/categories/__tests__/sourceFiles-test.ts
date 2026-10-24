import {
  describeSourceFileProblem,
  MAX_FILE_BYTES,
  MAX_SOURCE_FILES,
  MAX_TOTAL_BYTES,
  mimeTypeFor,
  validateSourceFiles,
  type PickedFile,
} from '../sourceFiles';

const MB = 1024 * 1024;
const file = (name: string, size = 1000): PickedFile => ({ name, size, uri: `file:///cache/${name}` });

describe('mimeTypeFor', () => {
  it.each([
    ['skrypt.pdf', 'application/pdf'],
    ['NOTATKI.PDF', 'application/pdf'],
    ['notatki.txt', 'text/plain'],
    ['readme.md', 'text/markdown'],
    ['tabela.csv', 'text/csv'],
    ['wyklad.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['slajdy.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['arkusz.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['tekst.odt', 'application/vnd.oasis.opendocument.text'],
    ['tekst.rtf', 'application/rtf'],
  ])('%s → %s', (name, mime) => {
    expect(mimeTypeFor(name)).toBe(mime);
  });

  it.each(['film.mp4', 'zdjecie.jpg', 'program.exe', 'bez-rozszerzenia', 'kropka.'])('%s nie jest obsługiwany', (name) => {
    expect(mimeTypeFor(name)).toBeNull();
  });
});

describe('validateSourceFiles', () => {
  it('przyjmuje od 1 do 9 obsługiwanych plików', () => {
    expect(validateSourceFiles([file('a.pdf')])).toBeNull();
    const nine = Array.from({ length: MAX_SOURCE_FILES }, (_, i) => file(`plik${i}.txt`));
    expect(validateSourceFiles(nine)).toBeNull();
  });

  it('przyjmuje plik dokładnie na granicy rozmiaru', () => {
    expect(validateSourceFiles([file('duzy.pdf', MAX_FILE_BYTES)])).toBeNull();
  });

  it.each([
    ['brak plików', [], { kind: 'no-files' }],
    [
      '10 plików',
      Array.from({ length: 10 }, (_, i) => file(`p${i}.txt`)),
      { kind: 'too-many-files', count: 10 },
    ],
    ['nieobsługiwany typ', [file('a.pdf'), file('film.mp4')], { kind: 'unsupported-type', name: 'film.mp4' }],
    ['pusty plik', [file('pusty.txt', 0)], { kind: 'empty-file', name: 'pusty.txt' }],
    [
      'za duży plik',
      [file('wielki.pdf', MAX_FILE_BYTES + 1)],
      { kind: 'file-too-large', name: 'wielki.pdf', size: MAX_FILE_BYTES + 1 },
    ],
    [
      'za duże razem',
      [file('a.pdf', 9 * MB), file('b.pdf', 9 * MB), file('c.pdf', 9 * MB), file('d.pdf', 9 * MB)],
      { kind: 'total-too-large', size: 36 * MB },
    ],
    ['ten sam plik dwa razy', [file('a.pdf'), file('a.pdf')], { kind: 'duplicate', name: 'a.pdf' }],
  ])('odrzuca: %s', (_, files, problem) => {
    expect(validateSourceFiles(files as PickedFile[])).toEqual(problem);
  });

  it('suma 30 MB jeszcze przechodzi', () => {
    expect(MAX_TOTAL_BYTES).toBe(30 * MB);
    expect(validateSourceFiles([file('a.pdf', 10 * MB), file('b.pdf', 10 * MB), file('c.pdf', 10 * MB)])).toBeNull();
  });
});

describe('describeSourceFileProblem', () => {
  it('opisuje każdy problem po polsku i podaje nazwę pliku', () => {
    expect(describeSourceFileProblem({ kind: 'no-files' })).toMatch(/plik/i);
    expect(describeSourceFileProblem({ kind: 'too-many-files', count: 12 })).toMatch(/9/);
    expect(describeSourceFileProblem({ kind: 'unsupported-type', name: 'film.mp4' })).toContain('film.mp4');
    expect(describeSourceFileProblem({ kind: 'empty-file', name: 'x.txt' })).toContain('x.txt');
    expect(describeSourceFileProblem({ kind: 'file-too-large', name: 'w.pdf', size: 12 * MB })).toMatch(/w\.pdf.*10 MB/);
    expect(describeSourceFileProblem({ kind: 'total-too-large', size: 40 * MB })).toMatch(/30 MB/);
    expect(describeSourceFileProblem({ kind: 'duplicate', name: 'a.pdf' })).toContain('a.pdf');
  });
});
