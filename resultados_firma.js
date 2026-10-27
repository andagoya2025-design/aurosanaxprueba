/* ============================================================================
 * AUROSANAX ERP | resultados_firma.js | 1.0.0
 * ADAPTADOR DE CONSULTA DE DOCUMENTOS FIRMADOS — SOLO LECTURA
 *
 * No reemplaza resultados.js, documentos.js ni firma_electronica.js.
 * No modifica PDFs, firmas, Sheets, Drive, tokens, enlaces ni auditorías.
 * No autoriza descargas públicas. El servidor DEBE validar cada documento
 * firmado al generar el enlace y nuevamente antes de servir su PDF original.
 *
 * CONTRATO PARA LA FUTURA INTEGRACIÓN:
 *   window.auroResultadosFirma.cargar({id_atencion, id_paciente})
 *   window.auroResultadosFirma.obtenerSnapshot()
 *   window.auroResultadosFirma.limpiar()
 *   window.auroResultadosFirma.estado()
 *
 * Se devuelve un índice mínimo, sin drive_file_id, URLs, hashes ni base64.
 * La fuente se identifica como FIRMADOS y el ID es id_firma_documento.
 * No pasar estos IDs al endpoint actual auroEntregaGenerarResultados hasta
 * incorporar y probar su resolución segura en el servidor.
 * ========================================================================== */
(function aurosanaxResultadosFirmaV1() {
  'use strict';

  const NOMBRE = 'AUROSANAX_RESULTADOS_FIRMA';
  const VERSION = '1.0.0';
  const TIPOS = Object.freeze([
    'RECETA', 'RECOMENDACION', 'CERTIFICADO', 'ORDEN_MEDICA'
  ]);
  const texto = v => String(v == null ? '' : v).trim();
  const estado = {
    atencion: '', paciente: '', documentos: [],
    listo: false, cargando: false, error: '', secuencia: 0
  };

  function normalizarContexto(contexto) {
    const c = contexto || {};
    return {
      atencion: texto(c.id_atencion || c.idAtencion),
      paciente: texto(c.id_paciente || c.idPaciente)
    };
  }

  function contextoActual() {
    try {
      const c = window.auroDocumentos?.obtenerContexto?.();
      if (!c || c.valido !== true || c.bloqueada) return null;
      const atencion = texto(c.id);
      const paciente = texto(c.idPaciente);
      return atencion && paciente ? {atencion, paciente} : null;
    } catch (_) { return null; }
  }

  function contextoCoincide(atencion, paciente) {
    const actual = contextoActual();
    return !!actual && actual.atencion === atencion && actual.paciente === paciente;
  }

  function vaciar() {
    estado.secuencia += 1;
    estado.atencion = '';
    estado.paciente = '';
    estado.documentos = [];
    estado.listo = false;
    estado.cargando = false;
    estado.error = '';
  }

  function respuestaDocumentos(respuesta) {
    const candidatos = [respuesta, respuesta?.data, respuesta?.resultado];
    const salida = [];
    const vistos = new Set();
    for (const candidato of candidatos) {
      if (!candidato || typeof candidato !== 'object') continue;
      for (const grupo of [candidato.documentos, candidato.registros, candidato.documento]) {
        const lista = Array.isArray(grupo) ? grupo :
          (grupo && typeof grupo === 'object' ? [grupo] : []);
        for (const registro of lista) {
          if (!registro || typeof registro !== 'object') continue;
          const id = texto(registro.id_firma_documento);
          if (!id || vistos.has(id)) continue;
          vistos.add(id);
          salida.push(registro);
        }
      }
    }
    return salida;
  }

  function documentoSeguro(registro, tipoConsultado, atencion, paciente) {
    const id = texto(registro.id_firma_documento);
    const tipo = texto(registro.tipo_documento).toUpperCase();
    const firma = texto(registro.estado_firma).toUpperCase();
    const idAtencion = texto(registro.id_atencion);
    const idPaciente = texto(registro.id_paciente);
    const mime = texto(registro.mime_type || registro.mime).toLowerCase();
    // Fail closed: no se infiere la pertenencia desde la consulta o el nombre.
    if (!id || tipo !== tipoConsultado || !TIPOS.includes(tipo)) return null;
    if (firma !== 'FIRMADO' || idAtencion !== atencion || idPaciente !== paciente) return null;
    if (mime && mime !== 'application/pdf') return null;
    const nombre = texto(registro.nombre_archivo || registro.nombre_documento) ||
      (tipo.replace(/_/g, ' ') + ' firmado.pdf');
    const tamano = Number(registro.tamano_bytes);
    return Object.freeze({
      fuente: 'FIRMADOS',
      id_firma_documento: id,
      id_atencion: atencion,
      id_paciente: paciente,
      tipo_documento: tipo,
      nombre_documento: nombre,
      mime_type: 'application/pdf',
      extension: 'pdf',
      tamano_bytes: Number.isFinite(tamano) && tamano >= 0 ? tamano : 0,
      estado_firma: 'FIRMADO'
    });
  }

  function snapshot() {
    const coincide = contextoCoincide(estado.atencion, estado.paciente);
    if (!estado.listo || !coincide) {
      return {listo: false, id_atencion: '', id_paciente: '', documentos: []};
    }
    return {
      listo: true,
      id_atencion: estado.atencion,
      id_paciente: estado.paciente,
      documentos: estado.documentos.map(d => ({...d}))
    };
  }

  async function cargar(contexto) {
    const c = normalizarContexto(contexto);
    if (!c.atencion || !c.paciente || !contextoCoincide(c.atencion, c.paciente)) {
      vaciar();
      throw new Error('Seleccione una atención válida del mismo paciente en Documentos.');
    }
    const api = window.auroFirmaElectronica;
    if (!api || typeof api.consultarDocumentosFirmados !== 'function') {
      vaciar();
      throw new Error('La consulta persistente de firma electrónica no está disponible.');
    }
    const secuencia = ++estado.secuencia;
    estado.atencion = c.atencion;
    estado.paciente = c.paciente;
    estado.documentos = [];
    estado.listo = false;
    estado.cargando = true;
    estado.error = '';
    try {
      // Se consulta cada tipo explícitamente: el contrato actual usa RECETA
      // como filtro predeterminado si no se especifica tipo_documento.
      const respuestas = await Promise.all(TIPOS.map(tipo =>
        api.consultarDocumentosFirmados({
          tipo_documento: tipo,
          id_atencion: c.atencion,
          id_paciente: c.paciente
        })
      ));
      if (secuencia !== estado.secuencia || !contextoCoincide(c.atencion, c.paciente)) {
        if (secuencia === estado.secuencia) vaciar();
        return snapshot();
      }
      const unicos = new Map();
      for (let i = 0; i < TIPOS.length; i++) {
        const respuesta = respuestas[i];
        if (respuesta?.success === false) {
          throw new Error('El servidor rechazó la consulta de ' + TIPOS[i] + '.');
        }
        for (const registro of respuestaDocumentos(respuesta)) {
          const seguro = documentoSeguro(registro, TIPOS[i], c.atencion, c.paciente);
          if (seguro && !unicos.has(seguro.id_firma_documento)) {
            unicos.set(seguro.id_firma_documento, seguro);
          }
        }
      }
      estado.documentos = [...unicos.values()];
      estado.listo = true;
      return snapshot();
    } catch (error) {
      if (secuencia === estado.secuencia) {
        estado.documentos = [];
        estado.listo = false;
        estado.error = texto(error?.message || error);
      }
      throw error;
    } finally {
      if (secuencia === estado.secuencia) estado.cargando = false;
    }
  }

  function estadoPublico() {
    return Object.freeze({
      version: VERSION,
      listo: snapshot().listo,
      cargando: estado.cargando,
      cantidad: snapshot().documentos.length,
      error: estado.error,
      modo: 'SOLO_LECTURA',
      integracion_enlaces: 'PENDIENTE_BACKEND'
    });
  }

  if (window.auroResultadosFirma) {
    console.warn(NOMBRE + ': ya está cargado; no se sobrescribe.');
    return;
  }
  window.auroResultadosFirma = Object.freeze({
    version: VERSION,
    tipos: TIPOS,
    cargar,
    obtenerSnapshot: snapshot,
    limpiar: vaciar,
    estado: estadoPublico
  });
})();
