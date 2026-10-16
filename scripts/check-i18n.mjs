// Verifica los diccionarios de idioma (src/i18n/locales):
//   · los 6 idiomas tienen exactamente las mismas claves,
//   · cada traducción usa las mismas variables {x} que el español,
//   · ninguna traducción está vacía,
//   · toda clave t('…') escrita literalmente en el código existe en español.
// Uso: npm run i18n:check   (sale con código 1 si algo falla)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = process.cwd();
const IDIOMAS = ['es', 'en', 'de', 'pt', 'it', 'fr'];
const variables = (texto) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const diccionarios = {};
for (const lang of IDIOMAS) {
  const ruta = join(RAIZ, 'src', 'i18n', 'locales', `${lang}.js`);
  diccionarios[lang] = (await import(pathToFileURL(ruta).href)).default;
}

const errores = [];
const base = diccionarios.es;
const clavesBase = Object.keys(base);

for (const lang of IDIOMAS.slice(1)) {
  const d = diccionarios[lang];
  const faltan = clavesBase.filter((k) => !(k in d));
  const sobran = Object.keys(d).filter((k) => !(k in base));
  if (faltan.length) errores.push(`[${lang}] faltan ${faltan.length} claves: ${faltan.slice(0, 8).join(', ')}${faltan.length > 8 ? '…' : ''}`);
  if (sobran.length) errores.push(`[${lang}] claves que no existen en español: ${sobran.join(', ')}`);
}

for (const lang of IDIOMAS) {
  for (const [clave, texto] of Object.entries(diccionarios[lang])) {
    if (!String(texto).trim()) errores.push(`[${lang}] ${clave}: traducción vacía`);
    else if (clave in base && variables(texto) !== variables(base[clave])) {
      errores.push(`[${lang}] ${clave}: variables distintas ({${variables(texto)}} en vez de {${variables(base[clave])}})`);
    }
  }
}

// Claves literales usadas en el código
const usadas = new Map();
const recorrer = (dir) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (ruta.includes(`${sep}i18n${sep}locales`)) continue;
      recorrer(ruta);
    } else if (/\.(jsx?|mjs)$/.test(nombre)) {
      const codigo = readFileSync(ruta, 'utf8');
      for (const m of codigo.matchAll(/\bt\(\s*'([a-z_0-9]+\.[a-z_0-9]+)'/g)) {
        if (!usadas.has(m[1])) usadas.set(m[1], relative(RAIZ, ruta));
      }
    }
  }
};
recorrer(join(RAIZ, 'src'));
for (const [clave, archivo] of usadas) {
  if (!(clave in base)) errores.push(`${archivo}: usa t('${clave}') pero no existe en los diccionarios`);
}

if (errores.length) {
  console.error(`✗ i18n: ${errores.length} problema(s)\n` + errores.map((e) => ' - ' + e).join('\n'));
  process.exit(1);
}
console.log(`✓ i18n: ${clavesBase.length} claves × ${IDIOMAS.length} idiomas coinciden; ${usadas.size} claves usadas en el código existen.`);
