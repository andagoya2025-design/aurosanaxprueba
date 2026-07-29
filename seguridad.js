/* ==========================================================
   AUROSANAX CLINICAL ERP
   MÓDULO: SEGURIDAD / LOGIN
   Archivo: seguridad.js
   Versión: 1.0.0
   Fecha: 2026-07-29

   OBJETIVO
   - Mantener toda la lógica fuera de login.html.
   - Cargar identidad visual desde la hoja configuracion.
   - Autenticar mediante validarLoginSeguro del Apps Script.
   - Conservar y validar la sesión.
   - Redirigir al ERP después del acceso autorizado.

   NO MODIFICA
   - Base de datos.
   - Apps Script.
   - Index.
   - Módulos clínicos.
   ========================================================== */

(function () {
  'use strict';

  /* ========================================================
     CONFIGURACIÓN TÉCNICA
     Para localizar rápidamente el endpoint, buscar:
     AUROSANAX_SEGURIDAD_ENDPOINT_PROTEGIDO
     ======================================================== */

  const AUROSANAX_SEGURIDAD_ENDPOINT_PROTEGIDO =
    'https://script.google.com/macros/s/AKfycbxaB6gz0bXnLnCKOBwEU8jGhRGqrql2o83OeG5_xc6ijnnEoG9L9_v9sMgK5OphMs7mow/exec';

  const SEGURIDAD_CONFIG = Object.freeze({
    apiUrl: AUROSANAX_SEGURIDAD_ENDPOINT_PROTEGIDO,
    paginaErp: 'index.html',
    paginaLogin: 'login.html',
    claveToken: 'aurosanax_seguridad_token',
    claveSesion: 'aurosanax_seguridad_sesion',
    claveUsuario: 'aurosanax_seguridad_usuario',
    claveExpiracion: 'aurosanax_seguridad_expira_en',
    tiempoEsperaMs: 25000
  });

  let enviandoLogin = false;

  /* ========================================================
     INICIALIZACIÓN
     ======================================================== */

  document.addEventListener('DOMContentLoaded', inicializarSeguridadLogin);

  async function inicializarSeguridadLogin() {
    enlazarEventosLogin();
    ocultarMensajes();
    enfocarUsuario();

    await cargarIdentidadCentro();

    const token = obtenerTokenSesion();
    if (token) {
      await validarSesionExistenteYRedirigir(token);
    }
  }

  function enlazarEventosLogin() {
    const form = document.getElementById('formLogin');
    const btnMostrarClave = document.getElementById('btnMostrarClave');
    const usuario = document.getElementById('txtUsuario');
    const clave = document.getElementById('txtClave');

    if (form && form.dataset.auroSeguridadInit !== '1') {
      form.dataset.auroSeguridadInit = '1';
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        iniciarSesion();
      });
    }

    if (btnMostrarClave && btnMostrarClave.dataset.auroSeguridadInit !== '1') {
      btnMostrarClave.dataset.auroSeguridadInit = '1';
      btnMostrarClave.addEventListener('click', alternarVisibilidadClave);
    }

    [usuario, clave].forEach(function (campo) {
      if (!campo || campo.dataset.auroSeguridadInit === '1') return;

      campo.dataset.auroSeguridadInit = '1';
      campo.addEventListener('input', ocultarMensajes);
    });
  }

  /* ========================================================
     IDENTIDAD DEL CENTRO
     ======================================================== */

  async function cargarIdentidadCentro() {
    try {
      const configuracion = await apiGet('obtenerConfiguracion');

      if (!configuracion || typeof configuracion !== 'object' || Array.isArray(configuracion)) {
        aplicarIdentidadPredeterminada();
        return;
      }

      const nombre = textoSeguro(configuracion.nombre_clinica) || 'AUROSANAX';
      const subtitulo =
        textoSeguro(configuracion.subtitulo_login) ||
        textoSeguro(configuracion.nombre_sistema) ||
        'Clinical ERP · Inicio de sesión';

      const colorPrincipal =
        normalizarColor(configuracion.color_principal) || '#7a174f';

      const colorSecundario =
        normalizarColor(configuracion.color_secundario) || '#c23b83';

      establecerTexto('nombreCentro', nombre);
      establecerTexto('subtituloCentro', subtitulo);
      aplicarColoresInstitucionales(colorPrincipal, colorSecundario);
      aplicarLogoCentro(configuracion.logo_url || configuracion.logo_file_id || '');

      document.title = nombre + ' - Inicio de sesión';
    } catch (error) {
      console.warn('No se pudo cargar la identidad del centro:', error);
      aplicarIdentidadPredeterminada();
    }
  }

  function aplicarIdentidadPredeterminada() {
    establecerTexto('nombreCentro', 'AUROSANAX');
    establecerTexto('subtituloCentro', 'Clinical ERP · Inicio de sesión');
    aplicarColoresInstitucionales('#7a174f', '#c23b83');
    mostrarLogoFallback();
  }

  function aplicarColoresInstitucionales(principal, secundario) {
    const root = document.documentElement;
    if (!root) return;

    root.style.setProperty('--primary', principal);
    root.style.setProperty('--primary-2', principal);
    root.style.setProperty('--primary-3', secundario);
  }

  function aplicarLogoCentro(valorLogo) {
    const img = document.getElementById('logoCentro');
    const fallback = document.getElementById('logoFallback');

    if (!img || !fallback) return;

    const urls = construirUrlsLogo(valorLogo);

    if (!urls.length) {
      mostrarLogoFallback();
      return;
    }

    let indice = 0;

    function probarSiguienteUrl() {
      if (indice >= urls.length) {
        mostrarLogoFallback();
        return;
      }

      const url = urls[indice++];
      img.onload = function () {
        img.style.display = 'block';
        fallback.style.display = 'none';
      };

      img.onerror = probarSiguienteUrl;
      img.src = agregarMarcaTiempo(url);
    }

    probarSiguienteUrl();
  }

  function construirUrlsLogo(valor) {
    const raw = textoSeguro(valor);
    if (!raw) return [];

    const id = extraerDriveFileId(raw);

    if (id) {
      return [
        'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w400',
        'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(id),
        raw
      ];
    }

    return [raw];
  }

  function extraerDriveFileId(valor) {
    const raw = textoSeguro(valor);
    if (!raw) return '';

    let match = raw.match(/\/file\/d\/([^/]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    match = raw.match(/[?&]id=([^&]+)/);
    if (match && match[1]) return decodeURIComponent(match[1]);

    if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;

    return '';
  }

  function mostrarLogoFallback() {
    const img = document.getElementById('logoCentro');
    const fallback = document.getElementById('logoFallback');

    if (img) {
      img.style.display = 'none';
      img.removeAttribute('src');
    }

    if (fallback) fallback.style.display = 'grid';
  }

  function agregarMarcaTiempo(url) {
    if (!url) return '';
    return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  }

  /* ========================================================
     AUTENTICACIÓN
     ======================================================== */

  async function iniciarSesion() {
    if (enviandoLogin) return;

    const usuarioInput = document.getElementById('txtUsuario');
    const claveInput = document.getElementById('txtClave');

    const usuario = textoSeguro(usuarioInput ? usuarioInput.value : '').toLowerCase();
    const clave = claveInput ? String(claveInput.value || '') : '';

    ocultarMensajes();

    if (!usuario || !clave) {
      mostrarError('Ingrese usuario y contraseña.');
      if (!usuario && usuarioInput) usuarioInput.focus();
      else if (claveInput) claveInput.focus();
      return;
    }

    enviandoLogin = true;
    establecerEstadoBoton(true, 'Verificando acceso...');

    try {
      const respuesta = await apiPost('validarLoginSeguro', {
        usuario: usuario,
        clave: clave,
        dispositivo: obtenerDescripcionDispositivo()
      });

      if (!respuesta || respuesta.success !== true || !respuesta.token) {
        throw new Error(
          respuesta && respuesta.message
            ? respuesta.message
            : 'No fue posible validar las credenciales.'
        );
      }

      guardarSesionSegura(respuesta);
      mostrarEstado('Acceso autorizado. Ingresando al sistema...');
      limpiarClave();

      window.setTimeout(function () {
        window.location.replace(SEGURIDAD_CONFIG.paginaErp);
      }, 450);
    } catch (error) {
      console.error('Error de inicio de sesión:', error);
      mostrarError(
        error && error.message
          ? error.message
          : 'No se pudo iniciar sesión. Verifique la conexión.'
      );
      limpiarClave();
      enfocarClave();
    } finally {
      enviandoLogin = false;
      establecerEstadoBoton(false, 'Iniciar sesión');
    }
  }

  /* ========================================================
     SESIÓN
     ======================================================== */

  async function validarSesionExistenteYRedirigir(token) {
    establecerEstadoBoton(true, 'Validando sesión...');

    try {
      const respuesta = await apiGet('validarSesion', { token: token });

      if (respuesta && respuesta.success === true) {
        actualizarSesionValidada(respuesta);
        mostrarEstado('Sesión activa. Ingresando al sistema...');

        window.setTimeout(function () {
          window.location.replace(SEGURIDAD_CONFIG.paginaErp);
        }, 250);

        return;
      }

      limpiarSesionLocal();
    } catch (error) {
      console.warn('No se pudo validar la sesión existente:', error);
      limpiarSesionLocal();
    } finally {
      establecerEstadoBoton(false, 'Iniciar sesión');
    }
  }

  async function cerrarSesion() {
    const token = obtenerTokenSesion();

    try {
      if (token) {
        await apiPost('cerrarSesion', { token: token });
      }
    } catch (error) {
      console.warn('El servidor no confirmó el cierre de sesión:', error);
    } finally {
      limpiarSesionLocal();
      window.location.replace(SEGURIDAD_CONFIG.paginaLogin);
    }
  }

  function guardarSesionSegura(respuesta) {
    const segundos = Number(respuesta.expira_en_segundos || 0);
    const expiraEn = segundos > 0
      ? Date.now() + segundos * 1000
      : 0;

    const sesion = {
      token: respuesta.token,
      id_sesion: respuesta.id_sesion || '',
      usuario: respuesta.usuario || {},
      requiere_cambio_clave: respuesta.requiere_cambio_clave === true,
      expira_en: expiraEn
    };

    sessionStorage.setItem(SEGURIDAD_CONFIG.claveToken, respuesta.token);
    sessionStorage.setItem(SEGURIDAD_CONFIG.claveSesion, JSON.stringify(sesion));
    sessionStorage.setItem(
      SEGURIDAD_CONFIG.claveUsuario,
      JSON.stringify(respuesta.usuario || {})
    );

    if (expiraEn) {
      sessionStorage.setItem(
        SEGURIDAD_CONFIG.claveExpiracion,
        String(expiraEn)
      );
    } else {
      sessionStorage.removeItem(SEGURIDAD_CONFIG.claveExpiracion);
    }
  }

  function actualizarSesionValidada(respuesta) {
    const sesionActual = obtenerSesionLocal() || {};

    const usuario =
      respuesta.usuario ||
      (respuesta.sesion && respuesta.sesion.usuario_publico) ||
      sesionActual.usuario ||
      {};

    const sesion = Object.assign({}, sesionActual, {
      token: obtenerTokenSesion(),
      usuario: usuario
    });

    sessionStorage.setItem(
      SEGURIDAD_CONFIG.claveSesion,
      JSON.stringify(sesion)
    );

    sessionStorage.setItem(
      SEGURIDAD_CONFIG.claveUsuario,
      JSON.stringify(usuario)
    );
  }

  function obtenerTokenSesion() {
    const token = sessionStorage.getItem(SEGURIDAD_CONFIG.claveToken) || '';
    const expiraEn = Number(
      sessionStorage.getItem(SEGURIDAD_CONFIG.claveExpiracion) || 0
    );

    if (expiraEn && Date.now() >= expiraEn) {
      limpiarSesionLocal();
      return '';
    }

    return token;
  }

  function obtenerSesionLocal() {
    try {
      const raw = sessionStorage.getItem(SEGURIDAD_CONFIG.claveSesion);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function obtenerUsuarioActual() {
    try {
      const raw = sessionStorage.getItem(SEGURIDAD_CONFIG.claveUsuario);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function limpiarSesionLocal() {
    sessionStorage.removeItem(SEGURIDAD_CONFIG.claveToken);
    sessionStorage.removeItem(SEGURIDAD_CONFIG.claveSesion);
    sessionStorage.removeItem(SEGURIDAD_CONFIG.claveUsuario);
    sessionStorage.removeItem(SEGURIDAD_CONFIG.claveExpiracion);
  }

  /* ========================================================
     API
     ======================================================== */

  async function apiGet(accion, parametros) {
    const query = new URLSearchParams({
      accion: accion,
      t: String(Date.now())
    });

    Object.entries(parametros || {}).forEach(function (entrada) {
      const clave = entrada[0];
      const valor = entrada[1];

      if (valor !== undefined && valor !== null) {
        query.append(clave, String(valor));
      }
    });

    const respuesta = await fetchConTiempoLimite(
      SEGURIDAD_CONFIG.apiUrl + '?' + query.toString(),
      { method: 'GET', cache: 'no-store' }
    );

    if (!respuesta.ok) {
      throw new Error('Error de conexión HTTP ' + respuesta.status + '.');
    }

    return await respuesta.json();
  }

  async function apiPost(accion, data) {
    const respuesta = await fetchConTiempoLimite(
      SEGURIDAD_CONFIG.apiUrl,
      {
        method: 'POST',
        body: JSON.stringify({
          accion: accion,
          data: data || {}
        })
      }
    );

    if (!respuesta.ok) {
      throw new Error('Error de conexión HTTP ' + respuesta.status + '.');
    }

    return await respuesta.json();
  }

  async function fetchConTiempoLimite(url, opciones) {
    const controlador = new AbortController();
    const temporizador = window.setTimeout(function () {
      controlador.abort();
    }, SEGURIDAD_CONFIG.tiempoEsperaMs);

    try {
      return await fetch(
        url,
        Object.assign({}, opciones || {}, {
          signal: controlador.signal
        })
      );
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('La conexión tardó demasiado. Intente nuevamente.');
      }
      throw error;
    } finally {
      window.clearTimeout(temporizador);
    }
  }

  /* ========================================================
     INTERFAZ
     ======================================================== */

  function alternarVisibilidadClave() {
    const claveInput = document.getElementById('txtClave');
    const boton = document.getElementById('btnMostrarClave');

    if (!claveInput || !boton) return;

    const mostrar = claveInput.type === 'password';
    claveInput.type = mostrar ? 'text' : 'password';
    boton.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
    boton.setAttribute(
      'aria-label',
      mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'
    );

    claveInput.focus();
  }

  function establecerEstadoBoton(cargando, texto) {
    const boton = document.getElementById('btnLogin');
    const textoBoton = document.getElementById('btnLoginTexto');

    if (!boton) return;

    boton.disabled = Boolean(cargando);
    boton.classList.toggle('loading', Boolean(cargando));

    if (textoBoton) {
      textoBoton.textContent = texto || (
        cargando ? 'Verificando...' : 'Iniciar sesión'
      );
    }
  }

  function mostrarError(mensaje) {
    const error = document.getElementById('lblError');
    const estado = document.getElementById('lblEstado');

    if (estado) {
      estado.style.display = 'none';
      estado.textContent = '';
    }

    if (error) {
      error.textContent = mensaje || 'Ocurrió un error.';
      error.style.display = 'block';
    }
  }

  function mostrarEstado(mensaje) {
    const error = document.getElementById('lblError');
    const estado = document.getElementById('lblEstado');

    if (error) {
      error.style.display = 'none';
      error.textContent = '';
    }

    if (estado) {
      estado.textContent = mensaje || '';
      estado.style.display = mensaje ? 'block' : 'none';
    }
  }

  function ocultarMensajes() {
    const error = document.getElementById('lblError');
    const estado = document.getElementById('lblEstado');

    if (error) {
      error.style.display = 'none';
      error.textContent = '';
    }

    if (estado) {
      estado.style.display = 'none';
      estado.textContent = '';
    }
  }

  function establecerTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor || '';
  }

  function limpiarClave() {
    const clave = document.getElementById('txtClave');
    if (clave) clave.value = '';
  }

  function enfocarUsuario() {
    const usuario = document.getElementById('txtUsuario');
    if (usuario) usuario.focus();
  }

  function enfocarClave() {
    const clave = document.getElementById('txtClave');
    if (clave) clave.focus();
  }

  /* ========================================================
     UTILIDADES
     ======================================================== */

  function textoSeguro(valor) {
    return String(
      valor === undefined || valor === null ? '' : valor
    ).trim();
  }

  function normalizarColor(valor) {
    const color = textoSeguro(valor);
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '';
  }

  function obtenerDescripcionDispositivo() {
    const partes = [
      navigator.platform || '',
      navigator.userAgent || ''
    ].filter(Boolean);

    return partes.join(' | ').substring(0, 500);
  }

  /* ========================================================
     API PÚBLICA DEL MÓDULO
     Permite que index.html use estas funciones después.
     ======================================================== */

  window.AUROSANAX_SEGURIDAD = Object.freeze({
    iniciarSesion: iniciarSesion,
    validarSesion: validarSesionExistenteYRedirigir,
    cerrarSesion: cerrarSesion,
    obtenerToken: obtenerTokenSesion,
    obtenerSesion: obtenerSesionLocal,
    obtenerUsuario: obtenerUsuarioActual,
    limpiarSesion: limpiarSesionLocal,
    configuracion: SEGURIDAD_CONFIG
  });

})();
