// Helpers compartidos por las consultas para leer parámetros de query string.

// "a, B ,c" -> ['a', 'b', 'c'] (minúsculas, sin vacíos ni repetidos).
function listaDesdeQuery(valor) {
  if (typeof valor !== 'string') return [];
  const items = valor.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...new Set(items)];
}

function enteroDesdeQuery(valor, porDefecto, { min = 0, max = Infinity } = {}) {
  const n = parseInt(valor, 10);
  if (Number.isNaN(n)) return porDefecto;
  return Math.min(Math.max(n, min), max);
}

// Escapa los metacaracteres de regex para que el término del usuario se busque
// como texto literal: "a.b" no debe significar "a, cualquier carácter, b".
function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Regex de palabra completa, insensible a mayúsculas: "sal" matchea "sal" y
// "sal gruesa" pero no "salsa"; "pollo" matchea "pollo entero".
// No usa \b: en el motor de regex de Mongo (PCRE) \b solo reconoce ASCII como
// carácter de palabra, y un término que empieza o termina con letra acentuada
// ("ají", "café", "ñoquis") no matchearía nunca. Por eso los límites son
// lookarounds sobre letras y dígitos Unicode.
function regexPalabraCompleta(termino) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaparRegex(termino)}(?![\\p{L}\\p{N}])`, 'i');
}

module.exports = { listaDesdeQuery, enteroDesdeQuery, escaparRegex, regexPalabraCompleta };
