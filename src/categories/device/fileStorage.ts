import { File, Paths } from 'expo-file-system';

import type { TextStorage } from '../QuestionSetStore';

/** Zapis w pliku JSON w katalogu dokumentów aplikacji (usuwany razem z aplikacją). */
export function fileStorage(fileName: string): TextStorage {
  const file = new File(Paths.document, fileName);
  return {
    async read() {
      return file.exists ? file.text() : null;
    },
    async write(text) {
      // Najpierw plik tymczasowy, potem podmiana — przerwany zapis nie psuje starego pliku.
      const temp = new File(Paths.document, `${fileName}.tmp`);
      temp.create({ overwrite: true });
      temp.write(text);
      await temp.move(file, { overwrite: true });
    },
  };
}
