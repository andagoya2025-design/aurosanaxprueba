/**
 * ==========================================================
 * AUROSANAX ERP
 * MÓDULO: SEGURIDAD
 * Archivo: seguridad.js
 * ==========================================================
 */

/* ---------- Variables globales ---------- */

let usuarioActual = null;
let rolActual = null;
let tokenSesion = null;

/* ---------- Inicialización ---------- */

document.addEventListener("DOMContentLoaded", iniciarLogin);

/* ---------- Cargar pantalla ---------- */

function iniciarLogin() {

    cargarConfiguracionCentro();

    ocultarError();

    const txtUsuario = document.getElementById("txtUsuario");

    if (txtUsuario) {
        txtUsuario.focus();
    }

}

/* ---------- Configuración del centro ---------- */

function cargarConfiguracionCentro() {

    // Aquí luego leeremos:
    // Logo
    // Nombre del centro
    // Colores

}

/* ---------- Login ---------- */

function iniciarSesion() {

    const usuario = document.getElementById("txtUsuario").value.trim();

    const clave = document.getElementById("txtClave").value;

    if (!usuario || !clave) {

        mostrarError("Ingrese usuario y contraseña.");

        return;

    }

    ocultarError();

    // Aquí luego llamaremos:
    // validarLoginSeguro()

}

/* ---------- Validar sesión ---------- */

function validarSesion() {

}

/* ---------- Cerrar sesión ---------- */

function cerrarSesion() {

}

/* ---------- Mostrar error ---------- */

function mostrarError(texto) {

    const div = document.getElementById("lblError");

    div.innerHTML = texto;

    div.style.display = "block";

}

/* ---------- Ocultar error ---------- */

function ocultarError() {

    const div = document.getElementById("lblError");

    div.style.display = "none";

}
