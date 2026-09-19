const moderacionesSchema = {
  $jsonSchema: {
    bsonType: 'object',
    title: 'moderacion',
    required: ['moderador', 'tipoContenido', 'contenidoId', 'motivo', 'instantanea', 'fecha'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'objectId' },
      moderador: {
        bsonType: 'object',
        required: ['_id', 'nombre'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'objectId' },
          nombre: { bsonType: 'string' },
        },
      },
      tipoContenido: { enum: ['receta', 'opinion'] },
      contenidoId: { bsonType: 'objectId' },
      motivo: { bsonType: 'string', minLength: 1 },
      // Los tres subcampos son opcionales/tipados: el spec no define una
      // regla condicional por tipoContenido, así que no se fuerza ninguna
      // combinación específica (confirmado con el equipo).
      instantanea: {
        bsonType: 'object',
        additionalProperties: false,
        properties: {
          autorNombre: { bsonType: 'string' },
          recetaTitulo: { bsonType: 'string' },
          texto: { bsonType: 'string' },
        },
      },
      fecha: { bsonType: 'date' },
    },
  },
};

module.exports = { moderacionesSchema };
