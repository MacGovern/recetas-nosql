const indexDefinitions = {
  recetas: [
    { key: { 'ingredientes.nombre': 1 } },
    { key: { categorias: 1, 'puntaje.promedio': -1 } },
    { key: { paisOrigen: 1, 'puntaje.promedio': -1 } },
    { key: { 'puntaje.promedio': -1 } },
    { key: { titulo: 'text' } },
    { key: { 'autor._id': 1, fechaPublicacion: -1 } },
  ],
  opiniones: [
    { key: { recetaId: 1, fecha: -1 } },
    { key: { recetaId: 1, 'usuario._id': 1 }, options: { unique: true } },
  ],
  usuarios: [
    { key: { email: 1 }, options: { unique: true } },
  ],
  categorias: [
    { key: { slug: 1 }, options: { unique: true } },
  ],
  moderaciones: [
    { key: { fecha: -1 } },
  ],
};

module.exports = { indexDefinitions };
