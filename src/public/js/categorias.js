// Catálogo de categorías: se pide una sola vez por carga de página y se reutiliza.
import { api } from './api.js';

let promesa = null;
let porId = new Map();

// Devuelve el arreglo [{ _id, slug, nombre, descripcion }] ordenado por nombre.
export function cargarCategorias() {
  if (!promesa) {
    promesa = api
      .get('/api/categorias')
      .then(({ categorias }) => {
        porId = new Map(categorias.map((c) => [c._id, c]));
        return categorias;
      })
      .catch((err) => {
        promesa = null; // no cachear el fallo: el próximo intento vuelve a pedir
        throw err;
      });
  }
  return promesa;
}

// Solo tiene datos después de que cargarCategorias() resolvió.
export function nombreCategoria(id) {
  return porId.get(id)?.nombre ?? '(categoría desconocida)';
}
