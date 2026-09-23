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

module.exports = { listaDesdeQuery, enteroDesdeQuery };
