// Formateo para mostrar datos. Devuelve texto plano: quien lo inserta en el DOM
// usa textContent o escapeHtml.

export const ETIQUETAS_DIFICULTAD = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
export const ETIQUETAS_TIPO = { horno: 'Horno', trago: 'Trago', asado: 'Asado', olla: 'Olla' };

export function etiquetaDificultad(valor) {
  return ETIQUETAS_DIFICULTAD[valor] ?? valor;
}

export function etiquetaTipo(valor) {
  return ETIQUETAS_TIPO[valor] ?? valor;
}

// Las fechas llegan como ISO string desde el JSON.
export function formatearFecha(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-UY', { year: 'numeric', month: 'short', day: 'numeric' });
}

// 75 → "1 h 15 min", 45 → "45 min", 0 → "0 min".
export function formatearMinutos(min) {
  if (!Number.isFinite(min)) return '';
  const horas = Math.floor(min / 60);
  const resto = min % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

// Estrellas enteras para una opinión (1-5): 4 → "★★★★☆".
export function estrellasTexto(n) {
  const llenas = Math.max(0, Math.min(5, Math.round(n)));
  return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
}

// Para el listado: la proyección solo trae puntaje.promedio (sin cantidad).
// Una receta sin opiniones tiene promedio 0; con opiniones el mínimo posible es 1.
export function textoPromedio(puntaje) {
  const promedio = puntaje?.promedio;
  if (!promedio) return 'Sin opiniones';
  return `${promedio.toFixed(1)} ★`;
}

// Para el detalle: el documento completo trae suma, cantidad y promedio.
export function textoPuntaje(puntaje) {
  if (!puntaje || !puntaje.cantidad) return 'Sin opiniones';
  return `${puntaje.promedio.toFixed(1)} ★ (${puntaje.cantidad} ${puntaje.cantidad === 1 ? 'opinión' : 'opiniones'})`;
}
