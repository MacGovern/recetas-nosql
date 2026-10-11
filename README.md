# Recetario NoSQL

## 1. Qué es

Aplicación web de recetas de cocina: se pueden publicar recetas, opinar con estrellas, guardar favoritos y consultar rankings. Se hizo como laboratorio de **Taller de Bases de Datos NoSQL** (Tecnólogo en Informática, sede LATU) para practicar el modelado y las consultas con **MongoDB**.

**Grupo 2:** Leonardo Giménez, Matías Poy Vazquez, Ignacio Davrieux.

Todos los comandos de este documento son de **PowerShell de Windows**. Para abrirlo: botón Inicio, escribir `PowerShell` y presionar Enter.

## 2. Qué hay que tener instalado antes

| Programa | Versión | Descargar de | Cómo comprobarlo |
| --- | --- | --- | --- |
| Node.js | 22 | https://nodejs.org | `node --version` (debe empezar con `v22`) |
| MongoDB Community Server | 8, instalado como servicio de Windows en `localhost:27017` | https://www.mongodb.com/try/download/community | `Get-Service *mongo*` (debe decir `Running`) |
| Git | cualquiera reciente | https://git-scm.com/download/win | `git --version` |

Node.js trae `npm` (el instalador de paquetes). Se comprueba con `npm --version`.

Al instalar MongoDB en Windows, dejá tildada la opción **"Install MongoDB as a Service"** (es la opción por defecto).

**Si MongoDB no está corriendo**, el nombre del servicio es `MongoDB`. Para ver su estado:

```powershell
Get-Service *mongo*
```

Si dice `Stopped`, iniciarlo (puede requerir abrir PowerShell como administrador: clic derecho sobre PowerShell, "Ejecutar como administrador"):

```powershell
Start-Service MongoDB
```

Si `Get-Service *mongo*` no muestra nada, MongoDB no está instalado como servicio: volvé a ejecutar el instalador.

## 3. Instalación

1. Clonar el repositorio:

   ```powershell
   git clone https://github.com/MacGovern/recetas-nosql.git
   ```

2. Entrar a la carpeta del proyecto:

   ```powershell
   Set-Location recetas-nosql
   ```

3. Instalar las dependencias (tarda un rato la primera vez y crea la carpeta `node_modules`):

   ```powershell
   npm install
   ```

## 4. Configuración

El servidor lee su configuración de un archivo llamado `.env`, que **no está en el repositorio**. Hay una plantilla, `.env.example`. Copiala:

```powershell
Copy-Item .env.example .env
```

El archivo `.env` queda en la raíz del proyecto, con estas variables:

| Variable | Qué es | Qué valor poner |
| --- | --- | --- |
| `MONGO_URI` | Dirección de MongoDB | `mongodb://localhost:27017` (si no se define, el servidor usa ese mismo valor) |
| `DB_NAME` | Nombre de la base de datos | `recetario` (si no se define, usa ese mismo valor) |
| `PORT` | Puerto en el que escucha el servidor | `3000` (si no se define, usa 3000) |
| `SESSION_SECRET` | Texto secreto con el que se firman las cookies de sesión | Un texto largo y propio. **No tiene valor por defecto: sin esta variable el servidor no arranca.** |

> **Importante:** el `SESSION_SECRET` que trae `.env.example` (`cambiar-por-un-texto-largo-y-secreto`) es **solo un ejemplo**. Sirve para probar en tu máquina, pero en cualquier entorno real hay que cambiarlo por un texto propio y no compartirlo.

Para editar el archivo: `notepad .env`.

## 5. Cargar los datos de prueba

Con MongoDB corriendo y el `.env` listo:

```powershell
npm run seed
```

Qué hace: **borra y vuelve a crear las cinco colecciones de la aplicación** (`recetas`, `usuarios`, `opiniones`, `categorias`, `moderaciones`) dentro de la base `recetario`, con sus validaciones e índices, y las llena con datos de prueba. Todo lo que hubiera en esas colecciones se pierde. Es seguro correrlo las veces que haga falta.

Resultado esperado:

```
Base "recetario" sembrada con éxito:
  - 6 categorías
  - 8 usuarios (contraseña de prueba para todos: Test1234!)
      usuario   ana.fernandez@recetario.test
      usuario   bruno.silva@recetario.test
      usuario   camila.rossi@recetario.test
      usuario   diego.martinez@recetario.test
      usuario   elena.souza@recetario.test
      usuario   facundo.lopez@recetario.test
      moderador gabriela.nunez@recetario.test
      admin     admin@recetario.test
  - 12 recetas
  - 59 opiniones
```

Si en cambio aparece `Error al sembrar la base`, mirá la sección 9.

## 6. Levantar el servidor

```powershell
npm run dev
```

Debe aparecer el mensaje:

```
Servidor escuchando en http://localhost:3000
```

Abrí **http://localhost:3000** en el navegador: se ve la página de inicio con el listado de recetas. Otra forma de comprobar que el servidor y la base responden es abrir http://localhost:3000/api/health, que muestra `{"ok":true,"db":"recetario"}`.

`npm run dev` usa `nodemon`: si cambiás un archivo del código, el servidor se reinicia solo. La ventana de PowerShell queda ocupada mientras el servidor corre.

**Para detenerlo:** en esa ventana presioná `Ctrl + C`.

## 7. Usuarios de prueba

La contraseña de **todos** es `Test1234!`. Es solo para pruebas locales: no la uses en ningún entorno real.

| Email | Rol |
| --- | --- |
| ana.fernandez@recetario.test | usuario |
| bruno.silva@recetario.test | usuario |
| camila.rossi@recetario.test | usuario |
| diego.martinez@recetario.test | usuario |
| elena.souza@recetario.test | usuario |
| facundo.lopez@recetario.test | usuario |
| gabriela.nunez@recetario.test | moderador |
| admin@recetario.test | admin |

## 8. Qué probar con cada rol

- **Visitante** (sin iniciar sesión): navegar el listado y el detalle de las recetas, buscar y filtrar, y ver la página de Agregaciones.
- **Usuario** (por ejemplo `ana.fernandez@recetario.test`): publicar y editar sus recetas, opinar en las de otros y guardar recetas en favoritos.
- **Moderador** (`gabriela.nunez@recetario.test`): hace todo lo del usuario y además elimina recetas y opiniones ajenas indicando un motivo (no las propias).
- **Admin** (`admin@recetario.test`): administra usuarios (cambiar entre usuario y moderador, crear administradores), categorías y consulta el registro de moderaciones; no publica ni opina.

## 9. Problemas comunes

**MongoDB no está corriendo.** `npm run seed` o `npm run dev` fallan al conectarse. Ver el estado con `Get-Service *mongo*` e iniciarlo con `Start-Service MongoDB` (sección 2).

**Falta `SESSION_SECRET`.** El servidor corta al iniciar con el mensaje "Falta SESSION_SECRET en el entorno". Revisá que exista el archivo `.env` (sección 4) y que tenga esa variable.

**El puerto está ocupado.** Otro programa usa el puerto 3000. Para ver cuál:

```powershell
Get-NetTCPConnection -LocalPort 3000
```

Podés cerrar ese programa o cambiar `PORT` en el `.env` (por ejemplo `PORT=3001`) y abrir http://localhost:3001.

**Hay que volver a iniciar sesión después de cada seed.** `npm run seed` recrea los usuarios con identificadores nuevos, así que una sesión abierta antes deja de valer. Cerrá sesión (o entrá a `login.html`) y volvé a ingresar.

**Cambié un archivo y no veo el cambio.** Usá `npm run dev`; con `npm start` el servidor no se reinicia solo.

## 10. Estructura de carpetas

```
recetas-nosql/
├── index.js               Arranque del servidor Express
├── package.json           Dependencias y scripts
├── .env.example           Plantilla de configuración (copiar a .env)
└── src/
    ├── config/            Lectura de variables de entorno (env.js)
    ├── consultas/         Las seis consultas con agregaciones de MongoDB
    ├── controllers/       Lógica de cada recurso (recetas, opiniones, usuarios, moderación, admin)
    ├── db/
    │   ├── schemas/       Validaciones $jsonSchema de cada colección
    │   └── seed/          Datos de prueba y script de carga
    ├── middleware/        Sesión y control de acceso por rol
    ├── routes/            Rutas de la API (/api/...)
    └── public/            Frontend: páginas HTML, css/ y js/
```
