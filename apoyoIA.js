/****************************************************************
 AUROSANAX ERP DEMO
 Archivo: apoyoIA.js
 Versión: 1.1.0
 Responsabilidad: lógica funcional del módulo Apoyo Cognitivo con IA.
 Fecha/hora clínica: America/Guayaquil.
****************************************************************/
(() => {
  "use strict";

  const STORAGE_KEY = "aurosanax_apoyoIA_borrador_v1";
  const SESSION_INPUT_KEYS = [
    "aurosanax_apoyoIA_contexto",
    "apoyoIA_contexto",
    "diagnostico_apoyoIA",
    "aurosanax_diagnostico_actual"
  ];
  const SESSION_OUTPUT_KEY = "aurosanax_apoyoIA_resultado";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const refs = {};
  let promptBaseGenerado = "";
  let toastInstance = null;
  let modalDatosInstance = null;
  let autosaveTimer = null;
  let contextoEntradaActual = {};

  function normalizarTexto(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor).trim();
  }

  function escaparTextoPlano(valor) {
    return normalizarTexto(valor)
      .replace(/\u0000/g, "")
      .replace(/\r\n/g, "\n");
  }

  function ahoraEcuador() {
    const fecha = new Date();

    const fechaTexto = new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(fecha);

    const horaTexto = new Intl.DateTimeFormat("es-EC", {
      timeZone: "America/Guayaquil",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(fecha);

    const isoLocal = obtenerIsoEcuador(fecha);

    return {
      fecha: fechaTexto,
      hora: horaTexto,
      iso: isoLocal
    };
  }

  function obtenerIsoEcuador(fecha = new Date()) {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(fecha);

    const mapa = {};
    for (const parte of partes) {
      if (parte.type !== "literal") mapa[parte.type] = parte.value;
    }

    return `${mapa.year}-${mapa.month}-${mapa.day}T${mapa.hour}:${mapa.minute}:${mapa.second}-05:00`;
  }

  function actualizarReloj() {
    const ahora = ahoraEcuador();

    if (refs.fechaActual) refs.fechaActual.textContent = ahora.fecha;
    if (refs.horaActual) refs.horaActual.textContent = ahora.hora.slice(0, 5);
  }

  function mostrarToast(mensaje, tipo = "info") {
    if (!refs.toastApp || !window.bootstrap) return;

    const icono = $(".toast-header > i", refs.toastApp);
    const mapaClase = {
      success: "text-success",
      danger: "text-danger",
      warning: "text-warning",
      info: "text-primary"
    };

    icono.className = `bi bi-heart-pulse-fill me-2 ${mapaClase[tipo] || mapaClase.info}`;
    refs.toastMensaje.textContent = mensaje;
    refs.toastHora.textContent = ahoraEcuador().hora.slice(0, 5);

    if (!toastInstance) {
      toastInstance = new bootstrap.Toast(refs.toastApp, {
        delay: 3400,
        autohide: true
      });
    }

    toastInstance.show();
  }

  function parsearJsonSeguro(texto) {
    try {
      return JSON.parse(texto);
    } catch (_error) {
      return null;
    }
  }

  function primerValor(objeto, rutas, defecto = "") {
    for (const ruta of rutas) {
      const partes = ruta.split(".");
      let valor = objeto;

      for (const parte of partes) {
        if (valor === null || valor === undefined || typeof valor !== "object") {
          valor = undefined;
          break;
        }
        valor = valor[parte];
      }

      const texto = normalizarTexto(valor);
      if (texto) return texto;
    }

    return defecto;
  }

  function leerContextoSesion() {
    for (const clave of SESSION_INPUT_KEYS) {
      const bruto = sessionStorage.getItem(clave);
      if (!bruto) continue;

      const json = parsearJsonSeguro(bruto);

      if (json && typeof json === "object") {
        return {
          clave,
          datos: json
        };
      }
    }

    return {
      clave: "",
      datos: {}
    };
  }

  function asignarTextoResumen(elemento, valor) {
    if (!elemento) return;

    const texto = normalizarTexto(valor);

    elemento.textContent = texto || "No disponible";
    elemento.classList.toggle("empty-value", !texto);
  }

  function hidratarDesdeContexto() {
    const contexto = leerContextoSesion();
    const datos = contexto.datos || {};
    contextoEntradaActual = datos;

    const paciente = datos.paciente || datos.patient || {};
    const profesional = datos.profesional || datos.medico || datos.doctor || {};
    const diagnostico = datos.diagnostico || datos.diagnosis || {};
    const consulta = datos.consulta || datos.atencion || {};

    asignarTextoResumen(
      refs.pacienteNombre,
      primerValor(
        { datos, paciente },
        [
          "paciente.nombreCompleto",
          "paciente.nombre",
          "paciente.nombres",
          "datos.nombrePaciente",
          "datos.pacienteNombre"
        ]
      )
    );

    asignarTextoResumen(
      refs.pacienteIdentificacion,
      primerValor(
        { datos, paciente },
        [
          "paciente.identificacion",
          "paciente.cedula",
          "paciente.documento",
          "datos.identificacionPaciente"
        ]
      )
    );

    asignarTextoResumen(
      refs.pacienteEdad,
      primerValor(
        { datos, paciente },
        [
          "paciente.edad",
          "datos.edadPaciente"
        ]
      )
    );

    asignarTextoResumen(
      refs.pacienteSexo,
      primerValor(
        { datos, paciente },
        [
          "paciente.sexo",
          "paciente.genero",
          "datos.sexoPaciente"
        ]
      )
    );

    asignarTextoResumen(
      refs.pacienteHistoria,
      primerValor(
        { datos, paciente },
        [
          "paciente.historiaClinica",
          "paciente.numeroHistoria",
          "datos.historiaClinica"
        ]
      )
    );

    asignarTextoResumen(
      refs.profesionalNombre,
      primerValor(
        { datos, profesional },
        [
          "profesional.nombreCompleto",
          "profesional.nombre",
          "datos.nombreProfesional"
        ]
      )
    );

    const especialidad = primerValor(
      { datos, profesional, consulta },
      [
        "profesional.especialidad",
        "consulta.especialidad",
        "datos.especialidad"
      ]
    );

    if (especialidad) {
      const opcionExiste = Array.from(refs.especialidad.options)
        .some((opcion) => opcion.value === especialidad);

      if (opcionExiste) {
        refs.especialidad.value = especialidad;
      } else {
        refs.especialidad.value = "Otra";
      }
    }

    refs.tipoConsulta.value = primerValor(
      { datos, consulta },
      [
        "consulta.tipo",
        "datos.tipoConsulta"
      ]
    );

    refs.motivoConsulta.value = primerValor(
      { datos, consulta },
      [
        "consulta.motivo",
        "datos.motivoConsulta",
        "datos.motivo"
      ]
    );

    refs.resumenClinico.value = primerValor(
      { datos, consulta },
      [
        "consulta.resumenClinico",
        "datos.resumenClinico",
        "datos.resumen",
        "datos.integracionClinica.resumen",
        "datos.integracionClinica",
        "consulta.analisisClinico"
      ]
    );

    refs.diagnosticoPrincipal.value = primerValor(
      { datos, diagnostico },
      [
        "diagnostico.principal",
        "diagnostico.descripcion",
        "datos.diagnosticoPrincipal",
        "datos.diagnostico"
      ]
    );

    refs.diagnosticosDiferenciales.value = primerValor(
      { datos, diagnostico },
      [
        "diagnostico.diferenciales",
        "datos.diagnosticosDiferenciales"
      ]
    );

    refs.codigoCie10.value = primerValor(
      { datos, diagnostico },
      [
        "diagnostico.cie10",
        "diagnostico.codigoCie10",
        "datos.cie10",
        "datos.codigoCie10"
      ]
    );

    refs.alertasClinicas.value = primerValor(
      { datos, paciente, consulta },
      [
        "paciente.alertas",
        "paciente.alergias",
        "consulta.alertas",
        "datos.alertasClinicas",
        "datos.alergias"
      ]
    );

    const hayDatos = Boolean(
      refs.motivoConsulta.value ||
      refs.resumenClinico.value ||
      refs.diagnosticoPrincipal.value ||
      contexto.clave
    );

    actualizarEstadoContexto(hayDatos);
    actualizarContadores();
  }

  function actualizarEstadoContexto(hayDatos) {
    refs.estadoContextoTexto.textContent = hayDatos ? "Datos cargados" : "Sin datos";
    refs.estadoContextoPunto.classList.toggle("is-ready", hayDatos);
  }

  function obtenerObjetivosSeleccionados() {
    return $$("#objetivosGrupo input[type='checkbox']:checked")
      .map((input) => input.value)
      .filter(Boolean);
  }

  function construirPrompt() {
    const objetivos = obtenerObjetivosSeleccionados();
    const objetivoExtra = normalizarTexto(refs.objetivoPersonalizado.value);

    if (objetivoExtra) objetivos.push(objetivoExtra);

    const lineas = [
      "ACTÚA COMO APOYO COGNITIVO CLÍNICO PARA UN PROFESIONAL DE LA SALUD.",
      "",
      "IMPORTANTE:",
      "- No reemplaces el juicio clínico ni emitas una decisión médica autónoma.",
      "- No inventes datos, resultados, antecedentes, dosis ni diagnósticos.",
      "- Señala de forma explícita la incertidumbre y la información faltante.",
      "- Prioriza la seguridad del paciente y las banderas rojas.",
      "- Distingue con claridad entre hechos del caso, inferencias y recomendaciones generales.",
      "- La respuesta será revisada y validada por un profesional de la salud.",
      "",
      "CONFIGURACIÓN DEL ANÁLISIS:",
      `- Especialidad: ${normalizarTexto(refs.especialidad.value) || "No especificada"}`,
      `- Tipo de consulta: ${normalizarTexto(refs.tipoConsulta.value) || "No especificado"}`,
      `- Profundidad: ${normalizarTexto(refs.nivelProfundidad.value)}`,
      `- Lenguaje: ${normalizarTexto(refs.tipoLenguaje.value)}`,
      `- Marco de referencia: ${normalizarTexto(refs.marcoReferencia.value)}`,
      "",
      "CONTEXTO CLÍNICO:",
      `- Motivo de consulta: ${normalizarTexto(refs.motivoConsulta.value) || "No informado"}`,
      `- Resumen clínico integrado: ${normalizarTexto(refs.resumenClinico.value) || "No informado"}`,
      `- Diagnóstico principal o impresión diagnóstica: ${normalizarTexto(refs.diagnosticoPrincipal.value) || "No informado"}`,
      `- Diagnósticos diferenciales considerados: ${normalizarTexto(refs.diagnosticosDiferenciales.value) || "No informados"}`,
      `- Código(s) CIE-10: ${normalizarTexto(refs.codigoCie10.value) || "No informado"}`,
      `- Alergias, alertas o contraindicaciones: ${normalizarTexto(refs.alertasClinicas.value) || "No informadas"}`,
      "",
      "OBJETIVOS SOLICITADOS:",
      objetivos.length
        ? objetivos.map((objetivo, indice) => `${indice + 1}. ${objetivo}`).join("\n")
        : "1. Realizar una integración clínica estructurada del caso.",
      "",
      "ESTRUCTURA DE RESPUESTA:",
      "1. Resumen clínico relevante.",
      "2. Análisis razonado del problema principal.",
      "3. Diagnósticos diferenciales priorizados y argumentos a favor/en contra.",
      "4. Información clínica faltante que podría cambiar la interpretación.",
      "5. Banderas rojas, riesgos o criterios de derivación urgente.",
      "6. Exámenes o evaluaciones complementarias a considerar, con su finalidad.",
      "7. Opciones generales de manejo o seguimiento que el profesional podría valorar.",
      "8. Limitaciones, incertidumbres y puntos que requieren verificación.",
      "9. Conclusión clínica breve y accionable para revisión médica."
    ];

    if (refs.incluirBanderasRojas.checked === false) {
      const indice = lineas.findIndex((linea) =>
        linea.startsWith("5. Banderas rojas")
      );
      if (indice >= 0) lineas.splice(indice, 1);
    }

    if (refs.incluirLimitaciones.checked === false) {
      const indice = lineas.findIndex((linea) =>
        linea.startsWith("8. Limitaciones")
      );
      if (indice >= 0) lineas.splice(indice, 1);
    }

    if (refs.incluirFuentes.checked) {
      lineas.push(
        "",
        "REFERENCIAS:",
        "Cuando sea posible, menciona guías clínicas, consensos o fuentes de alta calidad,",
        "sin fabricar citas y aclarando cuando no puedas verificar una referencia."
      );
    }

    return lineas.join("\n");
  }

  function generarPrompt() {
    const prompt = construirPrompt();
    refs.promptClinico.value = prompt;
    promptBaseGenerado = prompt;
    actualizarContadores();
    programarAutoguardado();
    mostrarToast("Prompt clínico generado correctamente.", "success");
  }

  async function copiarAlPortapapeles(texto, mensajeExito) {
    const contenido = normalizarTexto(texto);

    if (!contenido) {
      mostrarToast("No hay contenido para copiar.", "warning");
      return false;
    }

    try {
      await navigator.clipboard.writeText(contenido);
      mostrarToast(mensajeExito, "success");
      return true;
    } catch (_error) {
      const auxiliar = document.createElement("textarea");
      auxiliar.value = contenido;
      auxiliar.setAttribute("readonly", "");
      auxiliar.style.position = "fixed";
      auxiliar.style.opacity = "0";
      document.body.appendChild(auxiliar);
      auxiliar.select();

      try {
        document.execCommand("copy");
        mostrarToast(mensajeExito, "success");
        return true;
      } catch (_errorSecundario) {
        mostrarToast("No fue posible copiar automáticamente.", "danger");
        return false;
      } finally {
        auxiliar.remove();
      }
    }
  }

  async function pegarDesdePortapapeles() {
    if (!navigator.clipboard?.readText) {
      mostrarToast(
        "El navegador no permite pegar automáticamente. Use el pegado manual.",
        "warning"
      );
      refs.respuestaIA.focus();
      return;
    }

    try {
      const texto = await navigator.clipboard.readText();

      if (!normalizarTexto(texto)) {
        mostrarToast("El portapapeles está vacío.", "warning");
        return;
      }

      refs.respuestaIA.value = texto;
      actualizarContadores();
      programarAutoguardado();
      mostrarToast("Respuesta pegada correctamente.", "success");
    } catch (_error) {
      mostrarToast(
        "No se concedió permiso para leer el portapapeles. Pegue manualmente.",
        "warning"
      );
      refs.respuestaIA.focus();
    }
  }

  function recopilarDatos() {
    const ahora = ahoraEcuador();

    return {
      version: "1.0.0",
      modulo: "Apoyo Cognitivo con IA",
      zonaHoraria: "America/Guayaquil",
      actualizadoEn: ahora.iso,
      identificacionRegistro: {
        id_atencion: normalizarTexto(
          contextoEntradaActual.id_atencion ||
          contextoEntradaActual.consulta?.id_atencion
        ),
        id_paciente: normalizarTexto(
          contextoEntradaActual.id_paciente ||
          contextoEntradaActual.paciente?.id_paciente
        ),
        numero_consulta: normalizarTexto(
          contextoEntradaActual.numero_consulta ||
          contextoEntradaActual.consulta?.numero
        ),
        estado: "borrador",
        guardadoBaseDatos: false
      },
      paciente: {
        nombre: refs.pacienteNombre.textContent === "No disponible"
          ? ""
          : refs.pacienteNombre.textContent,
        identificacion: refs.pacienteIdentificacion.textContent === "No disponible"
          ? ""
          : refs.pacienteIdentificacion.textContent,
        edad: refs.pacienteEdad.textContent === "No disponible"
          ? ""
          : refs.pacienteEdad.textContent,
        sexo: refs.pacienteSexo.textContent === "No disponible"
          ? ""
          : refs.pacienteSexo.textContent,
        historiaClinica: refs.pacienteHistoria.textContent === "No disponible"
          ? ""
          : refs.pacienteHistoria.textContent
      },
      profesional: {
        nombre: refs.profesionalNombre.textContent === "No disponible"
          ? ""
          : refs.profesionalNombre.textContent
      },
      consulta: {
        especialidad: refs.especialidad.value,
        tipo: refs.tipoConsulta.value,
        motivo: escaparTextoPlano(refs.motivoConsulta.value),
        resumenClinico: escaparTextoPlano(refs.resumenClinico.value),
        analisisClinico: escaparTextoPlano(
          contextoEntradaActual.consulta?.analisisClinico ||
          contextoEntradaActual.integracionClinica?.analisis
        ),
        conducta: escaparTextoPlano(
          contextoEntradaActual.consulta?.conducta ||
          contextoEntradaActual.integracionClinica?.conducta
        ),
        alertasClinicas: escaparTextoPlano(refs.alertasClinicas.value)
      },
      diagnostico: {
        principal: escaparTextoPlano(refs.diagnosticoPrincipal.value),
        diferenciales: escaparTextoPlano(refs.diagnosticosDiferenciales.value),
        cie10: escaparTextoPlano(refs.codigoCie10.value)
      },
      configuracion: {
        objetivos: obtenerObjetivosSeleccionados(),
        objetivoPersonalizado: escaparTextoPlano(refs.objetivoPersonalizado.value),
        profundidad: refs.nivelProfundidad.value,
        lenguaje: refs.tipoLenguaje.value,
        marcoReferencia: refs.marcoReferencia.value,
        incluirLimitaciones: refs.incluirLimitaciones.checked,
        incluirBanderasRojas: refs.incluirBanderasRojas.checked,
        incluirFuentes: refs.incluirFuentes.checked
      },
      contenido: {
        prompt: escaparTextoPlano(refs.promptClinico.value),
        respuestaIA: escaparTextoPlano(refs.respuestaIA.value),
        observacionesMedicas: escaparTextoPlano(refs.observacionesMedicas.value)
      },
      controlCalidad: {
        datosMinimosRevisados: refs.checkDatosMinimos.checked,
        privacidadRevisada: refs.checkPrivacidad.checked,
        respuestaSeraVerificada: refs.checkVerificacion.checked,
        responsabilidadProfesionalAceptada: refs.checkResponsabilidad.checked
      },
      auditoria: {
        zonaHoraria: "America/Guayaquil",
        creadoEn: normalizarTexto(
          contextoEntradaActual.creadoEn ||
          contextoEntradaActual.auditoria?.creadoEn
        ) || ahora.iso,
        actualizadoEn: ahora.iso,
        origen: normalizarTexto(contextoEntradaActual.origen) || "apoyoIA.html",
        versionEsquema: "1.0.0"
      }
    };
  }

  function aplicarDatos(datos) {
    if (!datos || typeof datos !== "object") return false;

    const consulta = datos.consulta || {};
    const diagnostico = datos.diagnostico || {};
    const configuracion = datos.configuracion || {};
    const contenido = datos.contenido || {};
    const control = datos.controlCalidad || {};

    if (consulta.especialidad !== undefined) {
      refs.especialidad.value = consulta.especialidad;
    }

    if (consulta.tipo !== undefined) {
      refs.tipoConsulta.value = consulta.tipo;
    }

    refs.motivoConsulta.value = consulta.motivo || "";
    refs.resumenClinico.value = consulta.resumenClinico || "";
    refs.alertasClinicas.value = consulta.alertasClinicas || "";

    refs.diagnosticoPrincipal.value = diagnostico.principal || "";
    refs.diagnosticosDiferenciales.value = diagnostico.diferenciales || "";
    refs.codigoCie10.value = diagnostico.cie10 || "";

    $$("#objetivosGrupo input[type='checkbox']").forEach((input) => {
      input.checked = Array.isArray(configuracion.objetivos)
        ? configuracion.objetivos.includes(input.value)
        : false;
    });

    refs.objetivoPersonalizado.value = configuracion.objetivoPersonalizado || "";
    refs.nivelProfundidad.value =
      configuracion.profundidad || "Clínico estructurado";
    refs.tipoLenguaje.value =
      configuracion.lenguaje || "Técnico para profesional de salud";
    refs.marcoReferencia.value =
      configuracion.marcoReferencia || "Guías clínicas y evidencia disponible";

    refs.incluirLimitaciones.checked =
      configuracion.incluirLimitaciones !== false;
    refs.incluirBanderasRojas.checked =
      configuracion.incluirBanderasRojas !== false;
    refs.incluirFuentes.checked =
      configuracion.incluirFuentes === true;

    refs.promptClinico.value = contenido.prompt || "";
    refs.respuestaIA.value = contenido.respuestaIA || "";
    refs.observacionesMedicas.value = contenido.observacionesMedicas || "";

    refs.checkDatosMinimos.checked = control.datosMinimosRevisados === true;
    refs.checkPrivacidad.checked = control.privacidadRevisada === true;
    refs.checkVerificacion.checked = control.respuestaSeraVerificada === true;
    refs.checkResponsabilidad.checked =
      control.responsabilidadProfesionalAceptada === true;

    promptBaseGenerado = refs.promptClinico.value;
    actualizarContadores();
    return true;
  }

  function guardarBorrador(mostrarConfirmacion = true) {
    try {
      const datos = recopilarDatos();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));

      refs.estadoBorrador.innerHTML =
        '<i class="bi bi-cloud-check"></i> Guardado ' +
        ahoraEcuador().hora.slice(0, 5);

      if (mostrarConfirmacion) {
        mostrarToast("Borrador guardado en este navegador.", "success");
      }

      return true;
    } catch (_error) {
      if (mostrarConfirmacion) {
        mostrarToast("No fue posible guardar el borrador local.", "danger");
      }
      return false;
    }
  }

  function cargarBorrador(mostrarConfirmacion = true) {
    const bruto = localStorage.getItem(STORAGE_KEY);

    if (!bruto) {
      if (mostrarConfirmacion) {
        mostrarToast("No existe un borrador guardado.", "warning");
      }
      return false;
    }

    const datos = parsearJsonSeguro(bruto);

    if (!datos) {
      if (mostrarConfirmacion) {
        mostrarToast("El borrador guardado no es válido.", "danger");
      }
      return false;
    }

    aplicarDatos(datos);

    if (mostrarConfirmacion) {
      mostrarToast("Borrador cargado correctamente.", "success");
    }

    return true;
  }

  function eliminarBorrador() {
    const confirmar = window.confirm(
      "¿Desea eliminar el borrador local de este módulo?"
    );

    if (!confirmar) return;

    localStorage.removeItem(STORAGE_KEY);
    refs.estadoBorrador.innerHTML =
      '<i class="bi bi-cloud-slash"></i> Sin borrador';
    mostrarToast("Borrador local eliminado.", "success");
  }

  function programarAutoguardado() {
    clearTimeout(autosaveTimer);

    refs.estadoBorrador.innerHTML =
      '<i class="bi bi-cloud-arrow-up"></i> Cambios pendientes';

    autosaveTimer = setTimeout(() => {
      guardarBorrador(false);
    }, 900);
  }

  function actualizarContador(elemento, contador) {
    if (!elemento || !contador) return;
    contador.textContent = String(elemento.value.length);
  }

  function actualizarContadores() {
    actualizarContador(refs.motivoConsulta, refs.contadorMotivo);
    actualizarContador(refs.resumenClinico, refs.contadorResumen);
    actualizarContador(refs.promptClinico, refs.contadorPrompt);
    actualizarContador(refs.respuestaIA, refs.contadorRespuesta);
  }

  function exportarJson() {
    const datos = recopilarDatos();
    const contenido = JSON.stringify(datos, null, 2);
    const blob = new Blob([contenido], {
      type: "application/json;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    const fechaArchivo = ahoraEcuador().iso
      .replace(/[:]/g, "-")
      .replace("T", "_")
      .replace("-05-00", "");

    enlace.href = url;
    enlace.download = `AUROSANAX_ApoyoIA_${fechaArchivo}.json`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);

    mostrarToast("Archivo JSON exportado.", "success");
  }

  function mostrarVistaJson() {
    const datos = recopilarDatos();
    refs.vistaJson.textContent = JSON.stringify(datos, null, 2);

    if (!modalDatosInstance) {
      modalDatosInstance = new bootstrap.Modal(refs.modalDatos);
    }

    modalDatosInstance.show();
  }

  function guardarEnSesion() {
    try {
      const datos = recopilarDatos();
      sessionStorage.setItem(SESSION_OUTPUT_KEY, JSON.stringify(datos));
      mostrarToast("Datos guardados en la sesión del ERP.", "success");
      return true;
    } catch (_error) {
      mostrarToast("No fue posible guardar los datos en sesión.", "danger");
      return false;
    }
  }

  function volverADiagnostico() {
    guardarEnSesion();

    const destino =
      document.body.dataset.diagnosticoUrl ||
      sessionStorage.getItem("aurosanax_url_diagnostico") ||
      "index.html";

    window.location.href = destino;
  }

  function continuarAlPlan() {
    const checksObligatorios = [
      refs.checkDatosMinimos,
      refs.checkPrivacidad,
      refs.checkVerificacion,
      refs.checkResponsabilidad
    ];

    const completos = checksObligatorios.every((check) => check.checked);

    if (!completos) {
      mostrarToast(
        "Complete el control de calidad antes de continuar al Plan.",
        "warning"
      );
      refs.checkDatosMinimos.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      return;
    }

    guardarEnSesion();

    const destino =
      document.body.dataset.planUrl ||
      sessionStorage.getItem("aurosanax_url_plan") ||
      "index.html";

    sessionStorage.setItem("aurosanax_abrir_modulo", "plan");
    window.location.href = destino;
  }

  function limpiarFormularioCompleto() {
    const confirmar = window.confirm(
      "¿Desea limpiar el contenido generado y la respuesta de IA?"
    );

    if (!confirmar) return;

    refs.promptClinico.value = "";
    refs.respuestaIA.value = "";
    refs.observacionesMedicas.value = "";
    promptBaseGenerado = "";
    actualizarContadores();
    programarAutoguardado();
    mostrarToast("Contenido de IA limpiado.", "success");
  }

  function restaurarPrompt() {
    if (promptBaseGenerado) {
      refs.promptClinico.value = promptBaseGenerado;
      actualizarContadores();
      programarAutoguardado();
      mostrarToast("Prompt restaurado a la última versión generada.", "success");
      return;
    }

    generarPrompt();
  }

  function registrarEventos() {
    refs.btnGenerarPrompt.addEventListener("click", generarPrompt);

    refs.btnCopiarPrompt.addEventListener("click", () => {
      copiarAlPortapapeles(
        refs.promptClinico.value,
        "Prompt copiado al portapapeles."
      );
    });

    refs.btnRestaurarPrompt.addEventListener("click", restaurarPrompt);

    refs.btnLimpiarPrompt.addEventListener("click", () => {
      const confirmar = window.confirm("¿Desea limpiar el prompt actual?");
      if (!confirmar) return;

      refs.promptClinico.value = "";
      actualizarContadores();
      programarAutoguardado();
      mostrarToast("Prompt limpiado.", "success");
    });

    refs.btnPegarRespuesta.addEventListener("click", pegarDesdePortapapeles);

    refs.btnCopiarRespuesta.addEventListener("click", () => {
      copiarAlPortapapeles(
        refs.respuestaIA.value,
        "Respuesta copiada al portapapeles."
      );
    });

    refs.btnLimpiarRespuesta.addEventListener("click", () => {
      const confirmar = window.confirm(
        "¿Desea limpiar la respuesta y las observaciones médicas?"
      );
      if (!confirmar) return;

      refs.respuestaIA.value = "";
      refs.observacionesMedicas.value = "";
      actualizarContadores();
      programarAutoguardado();
      mostrarToast("Respuesta limpiada.", "success");
    });

    refs.btnGuardarBorrador.addEventListener("click", () => guardarBorrador(true));
    refs.btnCargarBorrador.addEventListener("click", () => cargarBorrador(true));
    refs.btnEliminarBorrador.addEventListener("click", eliminarBorrador);
    refs.btnExportarJson.addEventListener("click", exportarJson);
    refs.btnVistaDatos.addEventListener("click", mostrarVistaJson);

    refs.btnCopiarJson.addEventListener("click", () => {
      copiarAlPortapapeles(
        refs.vistaJson.textContent,
        "JSON copiado al portapapeles."
      );
    });

    refs.btnVolverSuperior.addEventListener("click", volverADiagnostico);
    refs.btnVolverInferior.addEventListener("click", volverADiagnostico);
    refs.btnGuardarSesion.addEventListener("click", guardarEnSesion);
    refs.btnContinuarPlan.addEventListener("click", continuarAlPlan);
    refs.btnImprimir.addEventListener("click", () => window.print());

    [refs.abrirChatGPT, refs.abrirGemini, refs.abrirCopilot].forEach((enlace) => {
      enlace.addEventListener("click", async () => {
        if (normalizarTexto(refs.promptClinico.value)) {
          await copiarAlPortapapeles(
            refs.promptClinico.value,
            "Prompt copiado. La plataforma se abrirá en una pestaña nueva."
          );
        }
      });
    });

    const elementosConAutoguardado = [
      refs.especialidad,
      refs.tipoConsulta,
      refs.motivoConsulta,
      refs.resumenClinico,
      refs.diagnosticoPrincipal,
      refs.diagnosticosDiferenciales,
      refs.codigoCie10,
      refs.alertasClinicas,
      refs.objetivoPersonalizado,
      refs.nivelProfundidad,
      refs.tipoLenguaje,
      refs.marcoReferencia,
      refs.incluirLimitaciones,
      refs.incluirBanderasRojas,
      refs.incluirFuentes,
      refs.promptClinico,
      refs.respuestaIA,
      refs.observacionesMedicas,
      refs.checkDatosMinimos,
      refs.checkPrivacidad,
      refs.checkVerificacion,
      refs.checkResponsabilidad,
      ...$$("#objetivosGrupo input[type='checkbox']")
    ];

    elementosConAutoguardado.forEach((elemento) => {
      elemento.addEventListener("input", () => {
        actualizarContadores();
        programarAutoguardado();
      });

      elemento.addEventListener("change", programarAutoguardado);
    });

    window.addEventListener("beforeunload", () => {
      guardarBorrador(false);
    });

    window.addEventListener("keydown", (evento) => {
      const esGuardar =
        (evento.ctrlKey || evento.metaKey) &&
        evento.key.toLowerCase() === "s";

      if (esGuardar) {
        evento.preventDefault();
        guardarBorrador(true);
      }

      const esGenerar =
        (evento.ctrlKey || evento.metaKey) &&
        evento.key === "Enter";

      if (esGenerar) {
        evento.preventDefault();
        generarPrompt();
      }
    });
  }

  function capturarReferencias() {
    const ids = [
      "fechaActual",
      "horaActual",
      "btnVistaDatos",
      "btnVolverSuperior",
      "btnVolverInferior",
      "btnContinuarPlan",
      "btnGuardarSesion",
      "btnImprimir",
      "estadoContexto",
      "estadoContextoPunto",
      "estadoContextoTexto",
      "pacienteNombre",
      "pacienteIdentificacion",
      "pacienteEdad",
      "pacienteSexo",
      "pacienteHistoria",
      "profesionalNombre",
      "especialidad",
      "tipoConsulta",
      "motivoConsulta",
      "resumenClinico",
      "diagnosticoPrincipal",
      "diagnosticosDiferenciales",
      "codigoCie10",
      "alertasClinicas",
      "objetivoPersonalizado",
      "nivelProfundidad",
      "tipoLenguaje",
      "marcoReferencia",
      "incluirLimitaciones",
      "incluirBanderasRojas",
      "incluirFuentes",
      "promptClinico",
      "respuestaIA",
      "observacionesMedicas",
      "checkDatosMinimos",
      "checkPrivacidad",
      "checkVerificacion",
      "checkResponsabilidad",
      "btnGenerarPrompt",
      "btnCopiarPrompt",
      "btnRestaurarPrompt",
      "btnLimpiarPrompt",
      "btnPegarRespuesta",
      "btnCopiarRespuesta",
      "btnLimpiarRespuesta",
      "btnGuardarBorrador",
      "btnCargarBorrador",
      "btnExportarJson",
      "btnEliminarBorrador",
      "abrirChatGPT",
      "abrirGemini",
      "abrirCopilot",
      "estadoBorrador",
      "contadorMotivo",
      "contadorResumen",
      "contadorPrompt",
      "contadorRespuesta",
      "modalDatos",
      "vistaJson",
      "btnCopiarJson",
      "toastApp",
      "toastMensaje",
      "toastHora"
    ];

    ids.forEach((id) => {
      refs[id] = document.getElementById(id);
    });
  }

  function inicializarRespaldo() {
    capturarReferencias();
    actualizarReloj();
    setInterval(actualizarReloj, 30000);

    hidratarDesdeContexto();
    cargarBorrador(false);
    registrarEventos();
    actualizarContadores();

    if (!normalizarTexto(refs.promptClinico.value)) {
      refs.estadoBorrador.innerHTML =
        '<i class="bi bi-cloud-check"></i> Borrador local';
    }
  }

  let moduloInicializado = false;

  function init() {
    if (moduloInicializado) return;
    moduloInicializado = true;
    inicializarRespaldo();
  }

  window.AurosanaxApoyoIA = {
    version: "1.1.0",
    init,
    recopilarDatos,
    aplicarDatos,
    generarPrompt,
    guardarEnSesion,
    guardarBorrador,
    cargarBorrador,
    limpiarFormularioCompleto
  };

  // Alias temporal para conservar compatibilidad con integraciones anteriores.
  window.AurosanaxApoyoIABridge = window.AurosanaxApoyoIA;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
