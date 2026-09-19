const opinionesSchema = {
  $jsonSchema: {
    bsonType: 'object',
    title: 'opinion',
    required: ['recetaId', 'usuario', 'comentario', 'estrellas', 'fecha'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'objectId' },
      recetaId: { bsonType: 'objectId' },
      usuario: {
        bsonType: 'object',
        required: ['_id', 'nombre'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'objectId' },
          nombre: { bsonType: 'string' },
        },
      },
      comentario: { bsonType: 'string' },
      estrellas: { bsonType: 'int', minimum: 1, maximum: 5 },
      fecha: { bsonType: 'date' },
    },
  },
};

module.exports = { opinionesSchema };
