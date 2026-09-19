const categoriasSchema = {
  $jsonSchema: {
    bsonType: 'object',
    title: 'categoria',
    required: ['slug', 'nombre', 'descripcion'],
    additionalProperties: false,
    properties: {
      _id: { bsonType: 'objectId' },
      slug: { bsonType: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
      nombre: { bsonType: 'string', minLength: 1 },
      descripcion: { bsonType: 'string' },
    },
  },
};

module.exports = { categoriasSchema };
