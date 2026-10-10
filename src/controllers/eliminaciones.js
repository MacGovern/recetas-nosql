// Borrados compartidos entre el borrado propio (recetas/opiniones) y la
// moderación. Estas funciones NO deciden permisos: reciben el documento ya
// leído y verificado por el controlador que las llama (autoría o rol).
//
// No hay transacciones (Mongo local standalone): cada escritura se confirma
// por separado y un fallo a mitad de camino deja datos a medio borrar.

async function eliminarRecetaYDependencias(db, receta) {
  // No hay borrado en cascada de Mongo: el orden es opiniones → favoritos → receta.
  await db.collection('opiniones').deleteMany({ recetaId: receta._id });
  await db.collection('usuarios').updateMany(
    { favoritos: receta._id },
    { $pull: { favoritos: receta._id } },
  );
  await db.collection('recetas').deleteOne({ _id: receta._id });
}

async function eliminarOpinionYActualizarPuntaje(db, opinion) {
  await db.collection('opiniones').deleteOne({ _id: opinion._id });

  // Si este updateOne fallara después del deleteOne, el puntaje quedaría
  // desfasado respecto a las opiniones reales (sin transacción).
  await db.collection('recetas').updateOne({ _id: opinion.recetaId }, [
    {
      $set: {
        'puntaje.suma': { $subtract: ['$puntaje.suma', opinion.estrellas] },
        'puntaje.cantidad': { $subtract: ['$puntaje.cantidad', 1] },
      },
    },
    {
      $set: {
        'puntaje.promedio': {
          $cond: [
            { $eq: ['$puntaje.cantidad', 0] },
            0,
            { $round: [{ $divide: ['$puntaje.suma', '$puntaje.cantidad'] }, 2] },
          ],
        },
      },
    },
  ]);
}

module.exports = { eliminarRecetaYDependencias, eliminarOpinionYActualizarPuntaje };
