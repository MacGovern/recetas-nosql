// A diferencia de las otras cuatro colecciones, este schema NO usa
// additionalProperties: false. El modelo de "recetas" es deliberadamente
// variable (tipo y sus campos derivados son opcionales y distintos por
// receta) y se justifica en que documentos futuros puedan traer campos
// nuevos sin migrar los viejos. Restringir additionalProperties rompería
// esa premisa, así que acá solo se tipan y validan los campos conocidos
// cuando están presentes, sin prohibir otros.
const recetasSchema = {
  $jsonSchema: {
    bsonType: 'object',
    title: 'receta',
    required: [
      'titulo', 'autor', 'porciones', 'tiempoPreparacionMin', 'tiempoCoccionMin',
      'dificultad', 'categorias', 'ingredientes', 'pasos', 'puntaje',
      'fechaPublicacion',
    ],
    properties: {
      _id: { bsonType: 'objectId' },
      titulo: { bsonType: 'string', minLength: 1 },
      autor: {
        bsonType: 'object',
        required: ['_id', 'nombre'],
        additionalProperties: false,
        properties: {
          _id: { bsonType: 'objectId' },
          nombre: { bsonType: 'string' },
        },
      },
      porciones: { bsonType: 'int', minimum: 1 },
      tiempoPreparacionMin: { bsonType: 'int', minimum: 0 },
      tiempoCoccionMin: { bsonType: 'int', minimum: 0 },
      dificultad: { enum: ['facil', 'media', 'dificil'] },
      paisOrigen: { bsonType: 'string', minLength: 2, maxLength: 2 },
      // tipo y sus campos derivados son opcionales y variables: una receta
      // guarda solo los suyos (temperaturaHornoC para horno, tipoVaso para
      // trago, tipoLenia+puntoCoccion para asado; olla no agrega ninguno).
      tipo: { enum: ['horno', 'trago', 'asado', 'olla'] },
      temperaturaHornoC: { bsonType: 'int' },
      tipoVaso: { bsonType: 'string' },
      tipoLenia: { bsonType: 'string' },
      puntoCoccion: { bsonType: 'string' },
      categorias: {
        bsonType: 'array',
        minItems: 1,
        items: { bsonType: 'objectId' },
      },
      ingredientes: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: ['nombre', 'cantidad', 'unidad'],
          properties: {
            nombre: { bsonType: 'string' },
            cantidad: { bsonType: ['int', 'double'], minimum: 0 },
            unidad: { bsonType: 'string' },
            sustituciones: {
              bsonType: 'array',
              items: { bsonType: 'string' },
            },
          },
        },
      },
      pasos: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: ['orden', 'tipo', 'contenido'],
          properties: {
            orden: { bsonType: 'int', minimum: 1 },
            tipo: { enum: ['texto', 'temporizador', 'video'] },
            contenido: { bsonType: 'string' },
            minutos: { bsonType: 'int', minimum: 0 },
            url: { bsonType: 'string' },
            segundos: { bsonType: 'int', minimum: 0 },
          },
          // Polimorfismo por tipo: cada rama exige sólo los campos propios.
          anyOf: [
            { properties: { tipo: { enum: ['texto'] } } },
            {
              properties: { tipo: { enum: ['temporizador'] } },
              required: ['minutos'],
            },
            {
              properties: { tipo: { enum: ['video'] } },
              required: ['url', 'segundos'],
            },
          ],
        },
      },
      puntaje: {
        bsonType: 'object',
        required: ['suma', 'cantidad', 'promedio'],
        additionalProperties: false,
        properties: {
          suma: { bsonType: ['int', 'long'], minimum: 0 },
          cantidad: { bsonType: ['int', 'long'], minimum: 0 },
          promedio: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 },
        },
      },
      fechaPublicacion: { bsonType: 'date' },
    },
  },
};

module.exports = { recetasSchema };
