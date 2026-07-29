/* ==========================================================
   AUROSANAX CLINICAL ERP
   MÓDULO: SEGURIDAD / LOGIN
   Archivo: seguridad.js
   Versión: 1.4.0
   Fecha: 2026-07-29

   OBJETIVO
   - Mantener toda la lógica fuera de login.html.
   - Cargar identidad visual desde la hoja configuracion.
   - Autenticar mediante validarLoginSeguro del Apps Script.
   - Conservar y validar la sesión.
   - Redirigir al ERP después del acceso autorizado.
   - Administrar usuarios desde Configuración.
   - Preparar la consulta de bitácora en modo solo lectura.

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
    tiempoEsperaMs: 60000
  });

  const CATALOGO_PERMISOS = Object.freeze([
    { clave: 'dashboard', etiqueta: 'Inicio / Dashboard', detalle: 'Acceso a index.html y panel principal.' },
    { clave: 'secretaria', etiqueta: 'Secretaría', detalle: 'Acceso a secretaria.html.' },
    { clave: 'formulario', etiqueta: 'Formulario interno', detalle: 'Acceso al formulario interno de agendamiento.' },
    { clave: 'pacientes', etiqueta: 'Pacientes', detalle: 'Consulta y gestión de pacientes autorizados.' },
    { clave: 'agenda', etiqueta: 'Agenda', detalle: 'Agenda interna y citas.' },
    { clave: 'disponibilidad', etiqueta: 'Disponibilidad', detalle: 'Gestión de bloques y horarios disponibles.' },
    { clave: 'historia_clinica', etiqueta: 'Historia clínica', detalle: 'Acceso clínico según alcance del usuario.' },
    { clave: 'recetas', etiqueta: 'Recetas y órdenes', detalle: 'Recetas, indicaciones y órdenes médicas.' },
    { clave: 'apoyo_ia', etiqueta: 'Apoyo con IA', detalle: 'Acceso a apoyo.html.' },
    { clave: 'reportes', etiqueta: 'Reportes', detalle: 'Consulta de reportes autorizados.' },
    { clave: 'configuracion', etiqueta: 'Configuración', detalle: 'Acceso general a configuracion.html.' },
    { clave: 'configuracion_medicos', etiqueta: 'Config.: Médicos', detalle: 'Pestaña Médicos dentro de Configuración.' },
    { clave: 'configuracion_servicios', etiqueta: 'Config.: Servicios', detalle: 'Pestaña Servicios dentro de Configuración.' },
    { clave: 'configuracion_horarios', etiqueta: 'Config.: Horarios', detalle: 'Pestaña Horarios rápidos.' },
    { clave: 'configuracion_centro', etiqueta: 'Config.: Datos del centro', detalle: 'Información institucional.' },
    { clave: 'configuracion_seguridad', etiqueta: 'Config.: Seguridad', detalle: 'Usuarios, roles y bitácora.' },
    { clave: 'usuarios', etiqueta: 'Gestión de usuarios', detalle: 'Crear, editar y restablecer usuarios.' },
    { clave: 'bitacora', etiqueta: 'Bitácora', detalle: 'Consultar auditoría del sistema.' }
  ]);

  const PERMISOS_POR_ROL = Object.freeze({
    ADMINISTRADOR: CATALOGO_PERMISOS.reduce(function (salida, permiso) {
      salida[permiso.clave] = true;
      return salida;
    }, {}),
    MEDICO_PRINCIPAL: {
      dashboard: true, secretaria: true, formulario: true, pacientes: true,
      agenda: true, disponibilidad: true, historia_clinica: true, recetas: true,
      apoyo_ia: true, reportes: true, configuracion: true,
      configuracion_medicos: true, configuracion_servicios: true,
      configuracion_horarios: true, configuracion_centro: false,
      configuracion_seguridad: false, usuarios: false, bitacora: false
    },
    MEDICO_COLABORADOR: {
      dashboard: true, secretaria: false, formulario: false, pacientes: true,
      agenda: true, disponibilidad: false, historia_clinica: true, recetas: true,
      apoyo_ia: true, reportes: false, configuracion: false,
      configuracion_medicos: false, configuracion_servicios: false,
      configuracion_horarios: false, configuracion_centro: false,
      configuracion_seguridad: false, usuarios: false, bitacora: false
    },
    SECRETARIA: {
      dashboard: true, secretaria: true, formulario: true, pacientes: true,
      agenda: true, disponibilidad: true, historia_clinica: false, recetas: false,
      apoyo_ia: false, reportes: false, configuracion: false,
      configuracion_medicos: false, configuracion_servicios: false,
      configuracion_horarios: false, configuracion_centro: false,
      configuracion_seguridad: false, usuarios: false, bitacora: false
    }
  });

  let enviandoLogin = false;

  /* ========================================================
     INICIALIZACIÓN
     ======================================================== */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSeguridadLogin, { once: true });
  } else {
    window.setTimeout(inicializarSeguridadLogin, 0);
  }

  async function inicializarSeguridadLogin() {
    const esPaginaLogin = Boolean(document.getElementById('formLogin'));
    const esModuloAdministracion = Boolean(document.getElementById('seguridadAccesos'));

    if (esPaginaLogin) {
      enlazarEventosLogin();
      ocultarMensajes();
      enfocarUsuario();

      await cargarIdentidadCentro();

      const token = obtenerTokenSesion();
      if (token) {
        await validarSesionExistenteYRedirigir(token);
      }
    }

    if (esModuloAdministracion) {
      await inicializarAdministracionSeguridad();
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
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
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



  function normalizarPermisosUsuario(permisos, rol) {
    const rolNormalizado = textoSeguro(rol || '').toUpperCase();
    const base = Object.assign({}, PERMISOS_POR_ROL[rolNormalizado] || {});

    if (permisos && typeof permisos === 'object' && !Array.isArray(permisos)) {
      Object.keys(permisos).forEach(function (clave) {
        base[clave] = permisos[clave] === true ||
          String(permisos[clave]).toUpperCase() === 'TRUE' ||
          String(permisos[clave]).toUpperCase() === 'SI';
      });
    }

    return base;
  }

  function tienePermiso(clave, usuario) {
    const actual = usuario || obtenerUsuarioActual() || {};
    const rol = textoSeguro(actual.rol).toUpperCase();

    if (rol === 'ADMINISTRADOR') return true;

    const permisos = normalizarPermisosUsuario(actual.permisos, rol);
    return permisos[textoSeguro(clave)] === true;
  }

  function permisosSeleccionadosFormulario() {
    const salida = {};
    document.querySelectorAll('.seg-permiso-check').forEach(function (check) {
      salida[check.value] = check.checked === true;
    });
    return salida;
  }

  function htmlPermisosUsuario(permisos, rol) {
    const seleccionados = normalizarPermisosUsuario(permisos, rol);

    return (
      '<div class="col-12">' +
        '<div class="auro-permissions">' +
          '<div class="d-flex justify-content-between align-items-start gap-2 mb-3">' +
            '<div>' +
              '<label class="form-label fw-bold mb-1">Permisos de acceso</label>' +
              '<div class="text-muted small">Seleccione las páginas y módulos autorizados para este usuario.</div>' +
            '</div>' +
            '<button class="btn-soft btn-sm" type="button" onclick="AUROSANAX_SEGURIDAD.aplicarPermisosRol()">' +
              '<i class="bi bi-magic me-1"></i> Aplicar rol' +
            '</button>' +
          '</div>' +
          '<div class="auro-permissions-grid">' +
            CATALOGO_PERMISOS.map(function (permiso) {
              return (
                '<label class="auro-permission-item">' +
                  '<input class="form-check-input seg-permiso-check" type="checkbox" value="' +
                    escaparHtml(permiso.clave) + '"' +
                    (seleccionados[permiso.clave] === true ? ' checked' : '') +
                  '>' +
                  '<span><strong>' + escaparHtml(permiso.etiqueta) + '</strong>' +
                    '<small>' + escaparHtml(permiso.detalle) + '</small></span>' +
                '</label>'
              );
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function aplicarPermisosRolFormulario() {
    const rol = valorElemento('segRol') || 'SECRETARIA';
    const permisos = normalizarPermisosUsuario({}, rol);

    document.querySelectorAll('.seg-permiso-check').forEach(function (check) {
      check.checked = permisos[check.value] === true;
    });
  }

  function aplicarVisibilidadPorPermisos(contenedor) {
    const raiz = contenedor || document;

    raiz.querySelectorAll('[data-permiso]').forEach(function (elemento) {
      const permiso = elemento.getAttribute('data-permiso') || '';
      elemento.style.display = tienePermiso(permiso) ? '' : 'none';
    });
  }

  function protegerPagina(permiso, paginaAlternativa) {
    const token = obtenerTokenSesion();
    if (!token) {
      window.location.replace(SEGURIDAD_CONFIG.paginaLogin);
      return false;
    }

    if (!tienePermiso(permiso)) {
      alert('Acceso denegado. Su usuario no tiene permiso para esta sección.');
      window.location.replace(paginaAlternativa || SEGURIDAD_CONFIG.paginaErp);
      return false;
    }

    return true;
  }

  /* ========================================================
     ADMINISTRACIÓN DE SEGURIDAD
     Usuarios, roles y bitácora dentro de configuracion.html
     Toda la lógica permanece en este mismo seguridad.js.
     ======================================================== */

  let usuariosSeguridad = [];
  let usuarioEditandoId = '';
  let bitacoraSeguridad = [];
  let sesionAdministrativaValidada = false;
  let inicializacionAdministrativaEnCurso = false;
  let bitacoraInicializada = false;

  async function inicializarAdministracionSeguridad() {
    if (inicializacionAdministrativaEnCurso) return;
    inicializacionAdministrativaEnCurso = true;

    const botonCrear = document.getElementById('btnNuevoUsuario');

    if (botonCrear && botonCrear.dataset.auroSeguridadInit !== '1') {
      botonCrear.dataset.auroSeguridadInit = '1';
      botonCrear.disabled = false;
      botonCrear.addEventListener('click', manejarClickNuevoUsuario);
    }

    mostrarEstadoAdministracion('Validando sesión administrativa…', false);

    const token = obtenerTokenSesion();
    if (!token) {
      sesionAdministrativaValidada = false;
      bloquearAdministracionSeguridad(
        'No existe una sesión activa. Inicie sesión como Administrador.'
      );
      inicializacionAdministrativaEnCurso = false;
      return;
    }

    try {
      const validacion = await apiGet('validarSesion', { token: token });

      if (!validacion || validacion.success !== true) {
        limpiarSesionLocal();
        sesionAdministrativaValidada = false;
        bloquearAdministracionSeguridad(
          'La sesión expiró o no es válida. Inicie sesión nuevamente.'
        );
        return;
      }

      actualizarSesionValidada(validacion);

      const usuarioActual =
        validacion.usuario ||
        (validacion.sesion && validacion.sesion.usuario_publico) ||
        obtenerUsuarioActual() ||
        {};

      if (!esAdministrador(usuarioActual)) {
        sesionAdministrativaValidada = false;
        bloquearAdministracionSeguridad(
          'Esta sección está disponible únicamente para el Administrador.'
        );
        return;
      }

      sesionAdministrativaValidada = true;
      habilitarAdministracionSeguridad();
      mostrarEstadoAdministracion(
        'Sesión administrativa validada. Ya puede crear y administrar usuarios.',
        false
      );

      await cargarUsuariosSeguridad();
      await cargarBitacoraSeguridad();
    } catch (error) {
      console.error('Error inicializando administración de seguridad:', error);
      sesionAdministrativaValidada = false;
      bloquearAdministracionSeguridad(
        error && error.message
          ? error.message
          : 'No se pudo inicializar la administración de seguridad.'
      );
    } finally {
      inicializacionAdministrativaEnCurso = false;
    }
  }

  async function manejarClickNuevoUsuario() {
    if (sesionAdministrativaValidada) {
      abrirFormularioUsuario('');
      return;
    }

    const token = obtenerTokenSesion();

    if (!token) {
      mostrarEstadoAdministracion(
        'Debe iniciar sesión como Administrador antes de crear usuarios.',
        true
      );

      window.setTimeout(function () {
        window.location.href = SEGURIDAD_CONFIG.paginaLogin;
      }, 700);
      return;
    }

    await inicializarAdministracionSeguridad();

    if (sesionAdministrativaValidada) {
      abrirFormularioUsuario('');
    }
  }

  function mostrarEstadoAdministracion(mensaje, esError) {
    const elemento = document.getElementById('secEstadoConexion');
    if (!elemento) return;

    elemento.style.display = 'block';
    elemento.className = esError
      ? 'notice mb-3 text-danger'
      : 'notice mb-3';

    elemento.innerHTML =
      '<i class="bi ' +
      (esError ? 'bi-exclamation-triangle' : 'bi-shield-check') +
      ' me-1"></i>' +
      escaparHtml(mensaje || '');
  }

  function esAdministrador(usuario) {
    const rol = textoSeguro(usuario && usuario.rol).toUpperCase();
    const permisos = usuario && usuario.permisos && typeof usuario.permisos === 'object'
      ? usuario.permisos
      : {};

    return rol === 'ADMINISTRADOR' || permisos.usuarios === true;
  }

  function bloquearAdministracionSeguridad(mensaje) {
    const boton = document.getElementById('btnNuevoUsuario');
    if (boton) {
      boton.disabled = false;
      boton.setAttribute('aria-disabled', 'true');
      boton.title = mensaje || 'Sesión administrativa no disponible';
    }

    mostrarEstadoAdministracion(mensaje || 'Acceso no disponible.', true);

    usuariosSeguridad = [];
    renderUsuariosSeguridad();

    const body = document.getElementById('usuariosSeguridadBody');
    if (body) {
      body.innerHTML =
        '<tr><td colspan="6" class="security-empty">' +
        '<i class="bi bi-shield-exclamation"></i>' +
        escaparHtml(mensaje || 'Acceso no disponible.') +
        '</td></tr>';
    }

    const mobile = document.getElementById('usuariosSeguridadMobile');
    if (mobile) {
      mobile.innerHTML =
        '<div class="mobile-card security-empty">' +
        '<i class="bi bi-shield-exclamation"></i>' +
        escaparHtml(mensaje || 'Acceso no disponible.') +
        '</div>';
    }
  }

  function habilitarAdministracionSeguridad() {
    const boton = document.getElementById('btnNuevoUsuario');
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute('aria-disabled');
      boton.title = 'Crear un nuevo usuario autorizado';
    }
  }

  async function cargarUsuariosSeguridad() {
    const token = exigirTokenAdministrativo();

    try {
      const respuesta = await apiGet('listarUsuariosSeguros', { token: token });
      usuariosSeguridad = Array.isArray(respuesta) ? respuesta : [];
      renderUsuariosSeguridad();
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      usuariosSeguridad = [];
      renderUsuariosSeguridad();

      const body = document.getElementById('usuariosSeguridadBody');
      if (body) {
        body.innerHTML =
          '<tr><td colspan="6" class="security-empty">' +
          '<i class="bi bi-exclamation-triangle"></i>' +
          escaparHtml(error.message || 'No se pudieron cargar los usuarios.') +
          '</td></tr>';
      }
    }
  }

  function renderUsuariosSeguridad() {
    actualizarResumenUsuarios();

    const body = document.getElementById('usuariosSeguridadBody');
    const mobile = document.getElementById('usuariosSeguridadMobile');

    if (!body && !mobile) return;

    if (!usuariosSeguridad.length) {
      const vacio =
        '<i class="bi bi-person-lock"></i>' +
        '<b>Todavía no existen usuarios registrados.</b><br>' +
        '<span>Presione Crear usuario para agregar la primera cuenta autorizada.</span>';

      if (body) {
        body.innerHTML =
          '<tr><td colspan="6" class="security-empty">' + vacio + '</td></tr>';
      }
      if (mobile) {
        mobile.innerHTML =
          '<div class="mobile-card security-empty">' + vacio + '</div>';
      }
      return;
    }

    if (body) {
      body.innerHTML = usuariosSeguridad.map(function (u) {
        return (
          '<tr>' +
            '<td><b>' + escaparHtml(u.usuario || '—') + '</b></td>' +
            '<td>' + escaparHtml(u.nombre_completo || '—') + '</td>' +
            '<td>' + etiquetaRol(u.rol) + '</td>' +
            '<td>' + etiquetaEstadoUsuario(u.estado) + '</td>' +
            '<td>' + escaparHtml(formatearFechaHoraEcuador(u.ultimo_acceso)) + '</td>' +
            '<td>' +
              '<div class="d-flex flex-wrap gap-2">' +
                '<button class="btn-soft btn-sm" type="button" onclick="AUROSANAX_SEGURIDAD.abrirUsuario(\'' +
                  escaparAtributoJs(u.id_usuario || '') + '\')">Editar</button>' +
                '<button class="btn-line btn-sm" type="button" onclick="AUROSANAX_SEGURIDAD.restablecerClave(\'' +
                  escaparAtributoJs(u.id_usuario || '') + '\')">Restablecer clave</button>' +
              '</div>' +
            '</td>' +
          '</tr>'
        );
      }).join('');
    }

    if (mobile) {
      mobile.innerHTML = usuariosSeguridad.map(function (u) {
        return (
          '<div class="mobile-card">' +
            '<b>' + escaparHtml(u.nombre_completo || u.usuario || 'Usuario') + '</b>' +
            '<div class="line"><span>Usuario</span><span>' + escaparHtml(u.usuario || '—') + '</span></div>' +
            '<div class="line"><span>Rol</span><span>' + etiquetaRol(u.rol) + '</span></div>' +
            '<div class="line"><span>Estado</span><span>' + etiquetaEstadoUsuario(u.estado) + '</span></div>' +
            '<div class="line"><span>Último acceso</span><span>' +
              escaparHtml(formatearFechaHoraEcuador(u.ultimo_acceso)) +
            '</span></div>' +
            '<div class="d-grid gap-2 mt-3">' +
              '<button class="btn-soft" type="button" onclick="AUROSANAX_SEGURIDAD.abrirUsuario(\'' +
                escaparAtributoJs(u.id_usuario || '') + '\')">Editar usuario</button>' +
              '<button class="btn-line" type="button" onclick="AUROSANAX_SEGURIDAD.restablecerClave(\'' +
                escaparAtributoJs(u.id_usuario || '') + '\')">Restablecer clave</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    }
  }

  function actualizarResumenUsuarios() {
    const total = usuariosSeguridad.length;
    const administradores = contarRol('ADMINISTRADOR');
    const medicos =
      contarRol('MEDICO_PRINCIPAL') +
      contarRol('MEDICO_COLABORADOR') +
      contarRol('MEDICO');
    const secretaria = contarRol('SECRETARIA');

    establecerTexto('secTotalUsuarios', String(total));
    establecerTexto('secTotalAdministradores', String(administradores));
    establecerTexto('secTotalMedicos', String(medicos));
    establecerTexto('secTotalSecretaria', String(secretaria));
  }

  function contarRol(rol) {
    return usuariosSeguridad.filter(function (u) {
      return textoSeguro(u.rol).toUpperCase() === rol;
    }).length;
  }

  function abrirFormularioUsuario(idUsuario) {
    usuarioEditandoId = textoSeguro(idUsuario);

    const usuario = usuariosSeguridad.find(function (item) {
      return textoSeguro(item.id_usuario) === usuarioEditandoId;
    }) || {};

    const modal = document.getElementById('modalConfig');
    const titulo = document.getElementById('modalTitle');
    const cuerpo = document.getElementById('modalBody');

    if (!modal || !titulo || !cuerpo) {
      alert('No se encontró el modal de Configuración.');
      return;
    }

    titulo.textContent = usuarioEditandoId ? 'Editar usuario' : 'Crear usuario';

    cuerpo.innerHTML =
      '<div class="row g-3">' +
        '<div class="col-md-6">' +
          '<label class="form-label fw-bold">Usuario</label>' +
          '<input id="segUsuario" class="form-control" autocomplete="off" value="' +
            escaparHtml(usuario.usuario || '') + '" placeholder="Ej. secretaria01">' +
        '</div>' +
        '<div class="col-md-6">' +
          '<label class="form-label fw-bold">Nombre completo</label>' +
          '<input id="segNombreCompleto" class="form-control" value="' +
            escaparHtml(usuario.nombre_completo || '') + '" placeholder="Nombre y apellidos">' +
        '</div>' +
        '<div class="col-md-6">' +
          '<label class="form-label fw-bold">Rol</label>' +
          '<select id="segRol" class="form-select">' +
            opcionSeleccionada('ADMINISTRADOR', usuario.rol, 'Administrador') +
            opcionSeleccionada('MEDICO_PRINCIPAL', usuario.rol, 'Médico principal') +
            opcionSeleccionada('MEDICO_COLABORADOR',
              String(usuario.rol || '').toUpperCase() === 'MEDICO' ? 'MEDICO_COLABORADOR' : usuario.rol,
              'Médico colaborador') +
            opcionSeleccionada('SECRETARIA', usuario.rol || 'SECRETARIA', 'Secretaría') +
          '</select>' +
        '</div>' +
        '<div class="col-md-6">' +
          '<label class="form-label fw-bold">Estado</label>' +
          '<select id="segEstado" class="form-select">' +
            opcionSeleccionada('Activo', usuario.estado || 'Activo', 'Activo') +
            opcionSeleccionada('Inactivo', usuario.estado, 'Inactivo') +
          '</select>' +
        '</div>' +
        '<div class="col-md-6">' +
          '<label class="form-label fw-bold">Correo</label>' +
          '<input id="segEmail" type="email" class="form-control" value="' +
            escaparHtml(usuario.email || '') + '" placeholder="correo@centro.com">' +
        '</div>' +
        '<div class="col-md-6">' +
          '<label class="form-label fw-bold">Teléfono</label>' +
          '<input id="segTelefono" class="form-control" value="' +
            escaparHtml(usuario.telefono || '') + '" placeholder="0999999999">' +
        '</div>' +
        (!usuarioEditandoId
          ? '<div class="col-md-6">' +
              '<label class="form-label fw-bold">Contraseña temporal</label>' +
              '<div class="auro-password-wrap">' +
                '<input id="segClaveTemporal" type="password" class="form-control" autocomplete="new-password" placeholder="Mínimo 8 caracteres">' +
                '<button class="auro-password-eye" type="button" onclick="AUROSANAX_SEGURIDAD.alternarClave(\'segClaveTemporal\',this)" aria-label="Mostrar contraseña"><i class="bi bi-eye"></i></button>' +
              '</div>' +
            '</div>' +
            '<div class="col-md-6">' +
              '<label class="form-label fw-bold">Cambio obligatorio</label>' +
              '<select id="segCambioClave" class="form-select">' +
                '<option value="SI" selected>Sí</option>' +
                '<option value="NO">No</option>' +
              '</select>' +
            '</div>'
          : '<div class="col-md-6">' +
              '<label class="form-label fw-bold">Cambio obligatorio de clave</label>' +
              '<select id="segCambioClave" class="form-select">' +
                opcionSeleccionada('SI', usuario.requiere_cambio_clave || 'SI', 'Sí') +
                opcionSeleccionada('NO', usuario.requiere_cambio_clave, 'No') +
              '</select>' +
            '</div>') +
        htmlPermisosUsuario(usuario.permisos, usuario.rol || 'SECRETARIA') +
      '</div>' +
      '<div id="segUsuarioMsg" class="notice mt-3">' +
        'Las fechas y horas se generan en Apps Script con zona horaria America/Guayaquil.' +
      '</div>' +
      '<div class="d-flex justify-content-end gap-2 mt-3">' +
        '<button class="btn-line" type="button" onclick="cerrarModal()">Cancelar</button>' +
        '<button id="btnGuardarUsuarioSeguro" class="btn-auro" type="button" onclick="AUROSANAX_SEGURIDAD.guardarUsuario()">' +
          '<i class="bi bi-save me-1"></i> Guardar usuario' +
        '</button>' +
      '</div>';

    modal.classList.add('show');

    const selectorRol = document.getElementById('segRol');
    if (selectorRol && !usuarioEditandoId) {
      selectorRol.addEventListener('change', aplicarPermisosRolFormulario);
    }
  }

  async function guardarUsuarioDesdeConfiguracion() {
    const datos = {
      usuario: valorElemento('segUsuario').toLowerCase(),
      nombre_completo: valorElemento('segNombreCompleto'),
      rol: valorElemento('segRol') || 'SECRETARIA',
      estado: valorElemento('segEstado') || 'Activo',
      email: valorElemento('segEmail'),
      telefono: valorElemento('segTelefono'),
      requiere_cambio_clave: valorElemento('segCambioClave') || 'SI',
      permisos: permisosSeleccionadosFormulario(),
      token: exigirTokenAdministrativo()
    };

    if (!usuarioEditandoId) {
      datos.clave_temporal = valorElemento('segClaveTemporal');
    } else {
      datos.id_usuario = usuarioEditandoId;
    }

    if (!datos.usuario || !datos.nombre_completo) {
      mostrarMensajeUsuario('Ingrese usuario y nombre completo.', true);
      return;
    }

    if (!usuarioEditandoId && datos.clave_temporal.length < 8) {
      mostrarMensajeUsuario('La contraseña temporal debe tener al menos 8 caracteres.', true);
      return;
    }

    const boton = document.getElementById('btnGuardarUsuarioSeguro');
    const original = boton ? boton.innerHTML : '';

    if (boton) {
      boton.disabled = true;
      boton.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Guardando...';
    }

    try {
      const accion = usuarioEditandoId
        ? 'editarUsuarioSeguro'
        : 'crearUsuarioSeguro';

      const respuesta = await apiPost(accion, datos);

      if (!respuesta || respuesta.success !== true) {
        throw new Error(
          respuesta && respuesta.message
            ? respuesta.message
            : 'No se pudo guardar el usuario.'
        );
      }

      mostrarMensajeUsuario(respuesta.message || 'Usuario guardado correctamente.', false);
      await cargarUsuariosSeguridad();

      window.setTimeout(function () {
        if (typeof window.cerrarModal === 'function') window.cerrarModal();
        else {
          const modal = document.getElementById('modalConfig');
          if (modal) modal.classList.remove('show');
        }
      }, 550);
    } catch (error) {
      console.error('Error guardando usuario:', error);
      mostrarMensajeUsuario(error.message || 'No se pudo guardar el usuario.', true);
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.innerHTML = original;
      }
    }
  }

  function restablecerClaveUsuarioDesdeConfiguracion(idUsuario) {
    const usuario = usuariosSeguridad.find(function (item) {
      return textoSeguro(item.id_usuario) === textoSeguro(idUsuario);
    });

    if (!usuario) {
      alert('No se encontró el usuario.');
      return;
    }

    const modal = document.getElementById('modalConfig');
    const titulo = document.getElementById('modalTitle');
    const cuerpo = document.getElementById('modalBody');

    if (!modal || !titulo || !cuerpo) {
      alert('No se encontró el modal de Configuración.');
      return;
    }

    titulo.textContent = 'Restablecer contraseña';

    cuerpo.innerHTML =
      '<div class="notice mb-3">' +
        '<i class="bi bi-person-lock me-1"></i>' +
        'Usuario: <b>' + escaparHtml(usuario.nombre_completo || usuario.usuario) + '</b>' +
      '</div>' +
      '<div class="row g-3">' +
        '<div class="col-md-6">' +
          '<label class="form-label fw-bold">Contraseña temporal</label>' +
          '<div class="auro-password-wrap">' +
            '<input id="segClaveRestablecer" type="password" class="form-control" autocomplete="new-password" placeholder="Mínimo 8 caracteres">' +
            '<button class="auro-password-eye" type="button" onclick="AUROSANAX_SEGURIDAD.alternarClave(\\'segClaveRestablecer\\',this)" aria-label="Mostrar contraseña"><i class="bi bi-eye"></i></button>' +
          '</div>' +
        '</div>' +
        '<div class="col-md-6">' +
          '<label class="form-label fw-bold">Confirmar contraseña</label>' +
          '<div class="auro-password-wrap">' +
            '<input id="segClaveRestablecerConfirmar" type="password" class="form-control" autocomplete="new-password" placeholder="Repita la contraseña">' +
            '<button class="auro-password-eye" type="button" onclick="AUROSANAX_SEGURIDAD.alternarClave(\\'segClaveRestablecerConfirmar\\',this)" aria-label="Mostrar contraseña"><i class="bi bi-eye"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="segRestablecerMsg" class="notice mt-3">El usuario deberá cambiar esta contraseña en el siguiente acceso.</div>' +
      '<div class="d-flex justify-content-end gap-2 mt-3">' +
        '<button class="btn-line" type="button" onclick="cerrarModal()">Cancelar</button>' +
        '<button id="btnConfirmarRestablecer" class="btn-auro" type="button" onclick="AUROSANAX_SEGURIDAD.confirmarRestablecerClave(\\'' +
          escaparAtributoJs(usuario.id_usuario || '') + '\\')">' +
          '<i class="bi bi-key me-1"></i> Restablecer contraseña' +
        '</button>' +
      '</div>';

    modal.classList.add('show');
  }

  async function confirmarRestablecerClaveUsuario(idUsuario) {
    const clave = valorElemento('segClaveRestablecer');
    const confirmar = valorElemento('segClaveRestablecerConfirmar');
    const mensaje = document.getElementById('segRestablecerMsg');
    const boton = document.getElementById('btnConfirmarRestablecer');

    function mostrar(texto, error) {
      if (!mensaje) return;
      mensaje.className = error ? 'notice mt-3 text-danger' : 'notice mt-3';
      mensaje.innerHTML = escaparHtml(texto || '');
    }

    if (clave.length < 8) {
      mostrar('La contraseña temporal debe tener al menos 8 caracteres.', true);
      return;
    }

    if (clave !== confirmar) {
      mostrar('La confirmación no coincide.', true);
      return;
    }

    const original = boton ? boton.innerHTML : '';
    if (boton) {
      boton.disabled = true;
      boton.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Guardando...';
    }

    try {
      const respuesta = await apiPost('restablecerClaveUsuario', {
        id_usuario: idUsuario,
        clave_temporal: clave,
        requiere_cambio_clave: 'SI',
        token: exigirTokenAdministrativo()
      });

      if (!respuesta || respuesta.success !== true) {
        throw new Error(
          respuesta && respuesta.message
            ? respuesta.message
            : 'No se pudo restablecer la contraseña.'
        );
      }

      mostrar(respuesta.message || 'Contraseña restablecida correctamente.', false);
      await cargarUsuariosSeguridad();

      window.setTimeout(function () {
        if (typeof window.cerrarModal === 'function') window.cerrarModal();
      }, 700);
    } catch (error) {
      console.error('Error restableciendo contraseña:', error);
      mostrar(error.message || 'No se pudo restablecer la contraseña.', true);
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.innerHTML = original;
      }
    }
  }

  function alternarClaveDinamica(idCampo, boton) {
    const campo = document.getElementById(idCampo);
    if (!campo) return;

    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';

    if (boton) {
      const icono = boton.querySelector('i');
      if (icono) icono.className = mostrar ? 'bi bi-eye-slash' : 'bi bi-eye';
      boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
      boton.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
    }

    campo.focus();
  }


  async function cargarBitacoraSeguridad() {
    const token = exigirTokenAdministrativo();
    mostrarEstadoBitacora('Cargando eventos de seguridad…', false);

    try {
      const respuesta = await apiGet('listarBitacoraSegura', { token: token });

      if (respuesta && respuesta.success === false) {
        throw new Error(respuesta.message || 'No se pudo consultar la bitácora.');
      }

      bitacoraSeguridad = Array.isArray(respuesta) ? respuesta : [];
      prepararFiltrosBitacora();
      aplicarFiltrosBitacora();
      bitacoraInicializada = true;
    } catch (error) {
      console.error('Error cargando bitácora:', error);
      bitacoraSeguridad = [];
      actualizarResumenBitacora([]);
      renderBitacoraSeguridad([], error.message || 'No se pudo cargar la bitácora.');
      mostrarEstadoBitacora(error.message || 'No se pudo cargar la bitácora.', true);
    }
  }

  function mostrarEstadoBitacora(mensaje, esError) {
    let estado = document.getElementById('secEstadoBitacora');

    if (!estado) {
      const panel = document.getElementById('securityBitacora');
      const resumen = panel ? panel.querySelector('.security-summary') : null;

      if (panel && resumen) {
        estado = document.createElement('div');
        estado.id = 'secEstadoBitacora';
        resumen.insertAdjacentElement('afterend', estado);
      }
    }

    if (!estado) return;

    estado.className = esError
      ? 'notice mb-3 text-danger'
      : 'notice mb-3';

    estado.innerHTML =
      '<i class="bi ' +
      (esError ? 'bi-exclamation-triangle' : 'bi-journal-check') +
      ' me-1"></i>' +
      escaparHtml(mensaje || '');

    estado.style.display = mensaje ? 'block' : 'none';
  }

  function prepararFiltrosBitacora() {
    const desde = document.getElementById('bitacoraDesde');
    const hasta = document.getElementById('bitacoraHasta');
    const usuario = document.getElementById('bitacoraUsuario');
    const accion = document.getElementById('bitacoraAccion');

    [desde, hasta, usuario, accion].forEach(function (campo) {
      if (!campo) return;
      campo.disabled = false;

      if (campo.dataset.auroBitacoraInit !== '1') {
        campo.dataset.auroBitacoraInit = '1';
        campo.addEventListener('change', aplicarFiltrosBitacora);
        campo.addEventListener('input', aplicarFiltrosBitacora);
      }
    });

    if (usuario) {
      const usuarios = valoresUnicosBitacora('usuario');
      const actual = usuario.value || '';

      usuario.innerHTML =
        '<option value="">Todos los usuarios</option>' +
        usuarios.map(function (valor) {
          return '<option value="' + escaparHtml(valor) + '">' +
            escaparHtml(valor) +
          '</option>';
        }).join('');

      if (usuarios.indexOf(actual) !== -1) usuario.value = actual;
    }

    if (accion) {
      const acciones = valoresUnicosBitacora('accion');
      const actual = accion.value || '';

      accion.innerHTML =
        '<option value="">Todas las acciones</option>' +
        acciones.map(function (valor) {
          return '<option value="' + escaparHtml(valor) + '">' +
            escaparHtml(valor) +
          '</option>';
        }).join('');

      if (acciones.indexOf(actual) !== -1) accion.value = actual;
    }
  }

  function valoresUnicosBitacora(campo) {
    const vistos = {};
    const salida = [];

    bitacoraSeguridad.forEach(function (evento) {
      const valor = textoSeguro(evento && evento[campo]);
      if (!valor) return;

      const llave = valor.toLowerCase();
      if (vistos[llave]) return;

      vistos[llave] = true;
      salida.push(valor);
    });

    return salida.sort(function (a, b) {
      return a.localeCompare(b, 'es');
    });
  }

  function aplicarFiltrosBitacora() {
    const desde = valorElemento('bitacoraDesde');
    const hasta = valorElemento('bitacoraHasta');
    const usuario = valorElemento('bitacoraUsuario').toLowerCase();
    const accion = valorElemento('bitacoraAccion').toLowerCase();

    const filtrados = bitacoraSeguridad.filter(function (evento) {
      const fechaEvento = fechaBitacoraISO(evento.fecha_hora);
      const usuarioEvento = textoSeguro(evento.usuario).toLowerCase();
      const accionEvento = textoSeguro(evento.accion).toLowerCase();

      if (desde && fechaEvento && fechaEvento < desde) return false;
      if (hasta && fechaEvento && fechaEvento > hasta) return false;
      if (usuario && usuarioEvento !== usuario) return false;
      if (accion && accionEvento !== accion) return false;

      return true;
    });

    actualizarResumenBitacora(filtrados);
    renderBitacoraSeguridad(filtrados);

    mostrarEstadoBitacora(
      filtrados.length
        ? 'Bitácora actualizada: ' + filtrados.length + ' evento(s) visible(s).'
        : 'No existen eventos que coincidan con los filtros seleccionados.',
      false
    );
  }

  function fechaBitacoraISO(valor) {
    const raw = textoSeguro(valor);
    if (!raw) return '';

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[1] + '-' + match[2] + '-' + match[3];

    const fecha = convertirFechaSegura(valor);
    if (!fecha) return '';

    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');

    return y + '-' + m + '-' + d;
  }

  function actualizarResumenBitacora(eventos) {
    eventos = Array.isArray(eventos) ? eventos : [];

    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());

    const eventosHoy = eventos.filter(function (evento) {
      return fechaBitacoraISO(evento.fecha_hora) === hoy;
    }).length;

    const exitosos = eventos.filter(function (evento) {
      const resultado = textoSeguro(evento.resultado).toUpperCase();
      const accion = textoSeguro(evento.accion).toUpperCase();
      return resultado === 'EXITOSO' && accion === 'LOGIN_EXITOSO';
    }).length;

    const alertas = eventos.filter(function (evento) {
      const resultado = textoSeguro(evento.resultado).toUpperCase();
      const accion = textoSeguro(evento.accion).toUpperCase();
      return resultado === 'RECHAZADO' ||
        resultado === 'ERROR' ||
        accion === 'LOGIN_FALLIDO';
    }).length;

    establecerTexto('secEventosHoy', String(eventosHoy));
    establecerTexto('secAccesosExitosos', String(exitosos));
    establecerTexto('secAlertasSeguridad', String(alertas));
    establecerTexto(
      'secUltimoEvento',
      eventos.length
        ? formatearFechaHoraEcuador(eventos[0].fecha_hora)
        : '—'
    );
  }

  function renderBitacoraSeguridad(eventos, mensajeError) {
    eventos = Array.isArray(eventos) ? eventos : [];

    const body = document.getElementById('bitacoraSeguridadBody');
    const mobile = document.getElementById('bitacoraSeguridadMobile');

    if (!eventos.length) {
      const mensaje = mensajeError ||
        'Aún no existen eventos registrados para los filtros seleccionados.';

      const vacio =
        '<i class="bi bi-journal-check"></i>' +
        escaparHtml(mensaje);

      if (body) {
        body.innerHTML =
          '<tr><td colspan="7" class="security-empty">' +
          vacio +
          '</td></tr>';
      }

      if (mobile) {
        mobile.innerHTML =
          '<div class="mobile-card security-empty">' +
          vacio +
          '</div>';
      }

      return;
    }

    if (body) {
      body.innerHTML = eventos.map(function (evento) {
        return (
          '<tr>' +
            '<td>' + escaparHtml(formatearFechaHoraEcuador(evento.fecha_hora)) + '</td>' +
            '<td><b>' + escaparHtml(evento.usuario || 'Sistema') + '</b></td>' +
            '<td>' + escaparHtml(evento.modulo || '—') + '</td>' +
            '<td>' + escaparHtml(evento.accion || '—') + '</td>' +
            '<td>' + escaparHtml(evento.id_paciente || '—') + '</td>' +
            '<td title="' + escaparHtml(evento.dispositivo || '') + '">' +
              escaparHtml(resumirDispositivoBitacora(evento.dispositivo)) +
            '</td>' +
            '<td>' + etiquetaResultadoBitacora(evento.resultado) + '</td>' +
          '</tr>'
        );
      }).join('');
    }

    if (mobile) {
      mobile.innerHTML = eventos.map(function (evento) {
        return (
          '<div class="mobile-card">' +
            '<b>' + escaparHtml(evento.accion || 'Evento') + '</b>' +
            '<div class="line"><span>Fecha</span><span>' +
              escaparHtml(formatearFechaHoraEcuador(evento.fecha_hora)) +
            '</span></div>' +
            '<div class="line"><span>Usuario</span><span>' +
              escaparHtml(evento.usuario || 'Sistema') +
            '</span></div>' +
            '<div class="line"><span>Módulo</span><span>' +
              escaparHtml(evento.modulo || '—') +
            '</span></div>' +
            '<div class="line"><span>Resultado</span><span>' +
              etiquetaResultadoBitacora(evento.resultado) +
            '</span></div>' +
            '<div class="line"><span>Equipo</span><span>' +
              escaparHtml(resumirDispositivoBitacora(evento.dispositivo)) +
            '</span></div>' +
          '</div>'
        );
      }).join('');
    }
  }

  function resumirDispositivoBitacora(valor) {
    const raw = textoSeguro(valor);
    if (!raw) return 'No registrado';
    return raw.length > 42 ? raw.substring(0, 39) + '…' : raw;
  }

  function etiquetaResultadoBitacora(resultado) {
    const valor = textoSeguro(resultado).toUpperCase();

    if (valor === 'EXITOSO') {
      return '<span class="badgex badge-ok">Exitoso</span>';
    }

    if (valor === 'RECHAZADO') {
      return '<span class="badgex badge-danger">Rechazado</span>';
    }

    if (valor === 'ERROR') {
      return '<span class="badgex badge-danger">Error</span>';
    }

    return '<span class="badgex badge-warn">' +
      escaparHtml(resultado || 'Sin resultado') +
    '</span>';
  }


  function exigirTokenAdministrativo() {
    const token = obtenerTokenSesion();
    if (!token) {
      throw new Error('No existe una sesión administrativa activa.');
    }
    return token;
  }

  function formatearFechaHoraEcuador(valor) {
    if (!valor) return 'Sin acceso registrado';

    const fecha = convertirFechaSegura(valor);
    if (!fecha) return textoSeguro(valor);

    try {
      return new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(fecha);
    } catch (error) {
      return textoSeguro(valor);
    }
  }

  function convertirFechaSegura(valor) {
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;

    const raw = textoSeguro(valor);
    if (!raw) return null;

    const ecu = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (ecu) {
      return new Date(
        Number(ecu[1]),
        Number(ecu[2]) - 1,
        Number(ecu[3]),
        Number(ecu[4]),
        Number(ecu[5]),
        Number(ecu[6] || 0)
      );
    }

    const fecha = new Date(raw);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  function etiquetaRol(rol) {
    const valor = textoSeguro(rol).toUpperCase();
    const texto =
      valor === 'ADMINISTRADOR' ? 'Administrador' :
      valor === 'MEDICO_PRINCIPAL' ? 'Médico principal' :
      (valor === 'MEDICO_COLABORADOR' || valor === 'MEDICO') ? 'Médico colaborador' :
      valor === 'SECRETARIA' ? 'Secretaría' :
      valor || 'Sin rol';

    return '<span class="badgex badge-blue">' + escaparHtml(texto) + '</span>';
  }

  function etiquetaEstadoUsuario(estado) {
    const activo = textoSeguro(estado || 'Activo').toLowerCase() === 'activo';
    return '<span class="badgex ' + (activo ? 'badge-ok' : 'badge-warn') + '">' +
      (activo ? 'Activo' : 'Inactivo') +
    '</span>';
  }

  function opcionSeleccionada(valor, actual, etiqueta) {
    return '<option value="' + escaparHtml(valor) + '"' +
      (textoSeguro(valor).toUpperCase() === textoSeguro(actual).toUpperCase()
        ? ' selected'
        : '') +
      '>' + escaparHtml(etiqueta || valor) + '</option>';
  }

  function valorElemento(id) {
    const elemento = document.getElementById(id);
    return textoSeguro(elemento ? elemento.value : '');
  }

  function mostrarMensajeUsuario(mensaje, esError) {
    const elemento = document.getElementById('segUsuarioMsg');
    if (!elemento) return;

    elemento.innerHTML =
      '<span class="' + (esError ? 'text-danger' : 'text-success') + ' fw-bold">' +
      escaparHtml(mensaje || '') +
      '</span>';
  }

  function escaparHtml(valor) {
    return textoSeguro(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escaparAtributoJs(valor) {
    return textoSeguro(valor)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
  }



  async function validarSesionActual() {
    const token = obtenerTokenSesion();

    if (!token) {
      return {
        success: false,
        message: 'No existe una sesión activa.'
      };
    }

    try {
      const respuesta = await apiGet('validarSesion', { token: token });

      if (respuesta && respuesta.success === true) {
        actualizarSesionValidada(respuesta);
        return respuesta;
      }

      limpiarSesionLocal();
      return respuesta || {
        success: false,
        message: 'Sesión inválida o expirada.'
      };
    } catch (error) {
      return {
        success: false,
        message: error && error.message
          ? error.message
          : 'No fue posible validar la sesión.'
      };
    }
  }

  /* ========================================================
     API PÚBLICA DEL MÓDULO
     Permite que index.html use estas funciones después.
     ======================================================== */

  window.AUROSANAX_SEGURIDAD = Object.freeze({
    iniciarSesion: iniciarSesion,
    validarSesion: validarSesionExistenteYRedirigir,
    validarSesionActual: validarSesionActual,
    inicializarAdministracion: inicializarAdministracionSeguridad,
    cargarBitacora: cargarBitacoraSeguridad,
    cerrarSesion: cerrarSesion,
    obtenerToken: obtenerTokenSesion,
    obtenerSesion: obtenerSesionLocal,
    obtenerUsuario: obtenerUsuarioActual,
    limpiarSesion: limpiarSesionLocal,
    cargarUsuarios: cargarUsuariosSeguridad,
    abrirUsuario: abrirFormularioUsuario,
    guardarUsuario: guardarUsuarioDesdeConfiguracion,
    restablecerClave: restablecerClaveUsuarioDesdeConfiguracion,
    confirmarRestablecerClave: confirmarRestablecerClaveUsuario,
    alternarClave: alternarClaveDinamica,
    aplicarPermisosRol: aplicarPermisosRolFormulario,
    tienePermiso: tienePermiso,
    aplicarPermisos: aplicarVisibilidadPorPermisos,
    protegerPagina: protegerPagina,
    catalogoPermisos: CATALOGO_PERMISOS,
    formatearFechaHoraEcuador: formatearFechaHoraEcuador,
    configuracion: SEGURIDAD_CONFIG
  });

})();
