const { recetasSchema } = require('./recetas.schema');
const { usuariosSchema } = require('./usuarios.schema');
const { opinionesSchema } = require('./opiniones.schema');
const { categoriasSchema } = require('./categorias.schema');
const { moderacionesSchema } = require('./moderaciones.schema');

module.exports = {
  recetas: recetasSchema,
  usuarios: usuariosSchema,
  opiniones: opinionesSchema,
  categorias: categoriasSchema,
  moderaciones: moderacionesSchema,
};
