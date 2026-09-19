const usuariosSchema = {
  $jsonSchema: {
    bsonType: 'object',
    title: 'usuario',
    required: ['nombre', 'email', 'passwordHash', 'rol', 'fechaRegistro'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'objectId' },
      nombre: { bsonType: 'string', minLength: 1 },
      email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
      passwordHash: { bsonType: 'string' },
      rol: { enum: ['usuario', 'moderador', 'admin'] },
      fechaRegistro: { bsonType: 'date' },
      favoritos: {
        bsonType: 'array',
        items: { bsonType: 'objectId' },
      },
    },
  },
};

module.exports = { usuariosSchema };
