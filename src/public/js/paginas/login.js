import { api } from '../api.js';
import { iniciarNav } from '../nav.js';
import { establecer } from '../sesion.js';
import { leerParam, limpiarAlerta, mostrarError, rutaSegura } from '../ui.js';

const form = document.getElementById('form-login');
const alertas = document.getElementById('alertas');
const boton = form.querySelector('button[type="submit"]');
const destino = rutaSegura(leerParam('next'));

const estado = await iniciarNav();
if (estado.autenticado) location.replace(destino);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarAlerta(alertas);
  boton.disabled = true;
  try {
    const { usuario } = await api.post(
      '/api/auth/login',
      { email: form.email.value, password: form.password.value },
      { redirigir401: false }, // 401 acá = credenciales inválidas, no sesión vencida
    );
    establecer(usuario);
    location.assign(destino);
  } catch (err) {
    mostrarError(alertas, err);
    boton.disabled = false;
  }
});
