import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { establecer } from '../sesion.js';
import { limpiarAlerta, mostrarError } from '../ui.js';

const form = document.getElementById('form-registro');
const alertas = document.getElementById('alertas');
const boton = form.querySelector('button[type="submit"]');

const estado = await iniciarNav();
if (estado.autenticado) location.replace('/index.html');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarAlerta(alertas);

  // Espejo de la validación del servidor, que sigue siendo la barrera real.
  if (form.password.value.length < 8) {
    mostrarError(alertas, { message: 'La contraseña debe tener al menos 8 caracteres.' });
    return;
  }

  boton.disabled = true;
  try {
    const { usuario } = await api.post(
      '/api/auth/register',
      { nombre: form.nombre.value, email: form.email.value, password: form.password.value },
      { redirigir401: false },
    );
    establecer(usuario); // auto-login: la barra cambia sin recargar
    location.assign('/index.html');
  } catch (err) {
    mostrarError(alertas, err.status === 409 ? { message: 'Ese email ya está registrado.' } : err);
    boton.disabled = false;
  }
});
