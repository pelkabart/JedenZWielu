import { buildCatalog } from './catalog';

// Metro dołącza do paczki wszystkie pasujące pliki, więc nowy folder ze skórką nie wymaga zmian w kodzie.
const context = require.context('../../assets/skins', true, /\.png$/);

export const skinCatalog = buildCatalog(context.keys().map((path) => ({ path, asset: context(path) })));
