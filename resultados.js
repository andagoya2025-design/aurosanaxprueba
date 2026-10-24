/* AUROSANAX ERP — resultados.js
 * V1.0.0 PREINTEGRACION / ANTIRREGRESION
 * No altera Documentos, Apps Script, Sheets ni Drive.
 * Uso futuro: window.auroResultados.inicializar({contenedor: 'id-del-contenedor'}).
 * REQUIERE un contenedor independiente. No se autoinyecta al ERP.
 * La generación real de enlaces permanece BLOQUEADA hasta auditar y aprobar
 * el backend privado de tokens, autorización y entrega binaria.
 */
(function () {
  'use strict';
  if (window.auroResultados) return;

  const VERSION = '1.0.0-PREINTEGRACION';
  const state = {
    idAtencion: '', idPaciente: '', seleccion: new Set(),
    registros: [], tokenCarga: 0, cargando: false, contenedor: null
  };
  const txt = v => String(v == null ? '' : v).trim();
  const seguro = s => txt(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const doc = () => window.auroDocumentos || null;
  const contexto = () => {
    const modulo = doc();
    if (!modulo || typeof modulo.obtenerContexto !== 'function') return null;
    try { return modulo.obtenerContexto(); } catch (_) { return null; }
  };
  const valido = c => Boolean(c && c.id && c.valido === true && c.idPaciente && !c.bloqueada);
  const activos = r => !/(anulad|eliminad|inactiv)/i.test(txt(r.estado || 'Activo'));

  function limpiar() {
    state.seleccion.clear(); state.registros = [];
    state.idAtencion = ''; state.idPaciente = '';
    state.tokenCarga++;
    render();
  }
  function comprobarCambio() {
    const c = contexto();
    if (!valido(c)) { if (state.idAtencion || state.registros.length) limpiar(); return c; }
    if (state.idAtencion !== txt(c.id) || state.idPaciente !== txt(c.idPaciente)) {
      state.tokenCarga++; state.seleccion.clear(); state.registros = [];
      state.idAtencion = txt(c.id); state.idPaciente = txt(c.idPaciente);
    }
    return c;
  }
  function aviso(m) {
    const el = state.contenedor && state.contenedor.querySelector('[data-res-mensaje]');
    if (el) el.textContent = m;
  }
  function render() {
    const el = state.contenedor;
    if (!el) return;
    const c = comprobarCambioSinRender();
    const a = c && c.atencion || {};
    const registros = state.registros;
    const habilitado = valido(c);
    el.innerHTML = `
      <section class="auro-resultados" aria-label="Entrega de resultados" style="font-family:inherit;max-width:100%;">
        <h3>Entrega de resultados</h3>
        <div><strong>Paciente:</strong> ${seguro(a.nombre_paciente || '—')}</div>
        <div><strong>Médico:</strong> ${seguro(a.nombre_medico || '—')}</div>
        <div><strong>Consulta:</strong> ${seguro(c && c.numeroConsulta || '—')}</div>
        <div><strong>Atención:</strong> ${seguro(c && c.id || '—')}</div>
        <div><strong>Fecha de atención:</strong> ${seguro(a.fecha_atencion || a.fecha_apertura || a.fecha || '—')}</div>
        <p><button type="button" data-res-recargar ${habilitado && !state.cargando ? '' : 'disabled'}>Actualizar documentos</button></p>
        <div data-res-lista>${registros.length ? registros.map(r => {
          const id = txt(r.id_documento);
          return `<label style="display:block;margin:.5rem 0"><input type="checkbox" data-res-id="${seguro(id)}" ${state.seleccion.has(id) ? 'checked' : ''}> ${seguro(r.nombre_documento || id)} <small>(${seguro(r.mime_type || 'archivo')})</small></label>`;
        }).join('') : '<p>No hay documentos cargados para seleccionar.</p>'}</div>
        <p><strong>Seleccionados:</strong> <span data-res-contador>${state.seleccion.size}</span></p>
        <button type="button" data-res-generar disabled title="Pendiente de backend seguro y autorización de integración">Generar enlace seguro (pendiente)</button>
        <p data-res-mensaje role="status">${habilitado ? 'Vista de preparación. Todavía no genera enlaces ni escribe en Sheets.' : 'Seleccione una atención válida para continuar.'}</p>
      </section>`;
  }
  function comprobarCambioSinRender() {
    const c = contexto();
    if (!valido(c)) {
      state.idAtencion = ''; state.idPaciente = '';
      state.seleccion.clear(); state.registros = [];
    } else if (state.idAtencion !== txt(c.id) || state.idPaciente !== txt(c.idPaciente)) {
      state.idAtencion = txt(c.id); state.idPaciente = txt(c.idPaciente);
      state.seleccion.clear(); state.registros = [];
      state.tokenCarga++;
    }
    return c;
  }
  async function cargar() {
    const c = comprobarCambio();
    if (!valido(c)) { render(); return []; }
    const id = txt(c.id), paciente = txt(c.idPaciente);
    const token = ++state.tokenCarga;
    state.cargando = true; render(); aviso('Consultando documentos de la atención activa...');
    try {
      // Se reutiliza exclusivamente la lectura existente de Documentos.
      // No se abre ni descarga ningún archivo de Drive en esta operación.
      const modulo = doc();
      const data = await modulo.cargar();
      if (token !== state.tokenCarga) return [];
      const actual = contexto();
      if (!valido(actual) || txt(actual.id) !== id || txt(actual.idPaciente) !== paciente) {
        limpiar(); return [];
      }
      const lista = Array.isArray(data) ? data : [];
      state.registros = lista.filter(r =>
        txt(r.id_documento) && txt(r.id_atencion) === id &&
        txt(r.id_paciente) === paciente && activos(r) &&
        /^(application\/pdf|image\/jpeg)$/i.test(txt(r.mime_type))
      ).map(r => ({
        id_documento: txt(r.id_documento),
        id_atencion: id, id_paciente: paciente,
        nombre_documento: txt(r.nombre_documento), mime_type: txt(r.mime_type)
      }));
      state.seleccion.clear(); render();
      aviso(`${state.registros.length} documento(s) disponibles. No se ha generado ningún enlace.`);
      return state.registros.slice();
    } catch (e) {
      if (token === state.tokenCarga) { state.registros = []; state.seleccion.clear(); render(); aviso('No se pudieron consultar documentos: ' + txt(e.message)); }
      return [];
    } finally { state.cargando = false; if (token === state.tokenCarga) render(); }
  }
  function seleccionActual() {
    const c = comprobarCambio();
    if (!valido(c)) return [];
    return state.registros.filter(r => state.seleccion.has(r.id_documento)).map(r => r.id_documento);
  }
  function inicializar(opciones) {
    const id = txt(opciones && opciones.contenedor);
    const el = id && document.getElementById(id);
    if (!el) throw new Error('Resultados requiere un contenedor independiente existente.');
    if (state.contenedor !== el) {
      state.contenedor = el;
      el.addEventListener('click', e => {
        if (e.target.closest('[data-res-recargar]')) cargar();
      });
      el.addEventListener('change', e => {
        const input = e.target.closest('input[data-res-id]');
        if (!input) return;
        const c = comprobarCambio();
        const idDoc = txt(input.dataset.resId);
        if (!valido(c) || !state.registros.some(r => r.id_documento === idDoc)) { limpiar(); return; }
        if (input.checked) state.seleccion.add(idDoc); else state.seleccion.delete(idDoc);
        const contador = el.querySelector('[data-res-contador]');
        if (contador) contador.textContent = String(state.seleccion.size);
      });
      window.addEventListener('aurosanax:documentos-actualizados', e => {
        const c = comprobarCambio();
        if (valido(c) && txt(e.detail && e.detail.id_atencion) === txt(c.id)) cargar();
      });
    }
    render();
    return { version: VERSION, listo: true, integrado: false };
  }
  window.auroResultados = Object.freeze({
    version: VERSION, inicializar, cargar, limpiar, seleccionActual,
    // No se expone crearEnlace: hasta aprobar y probar el backend seguro.
    estado: () => ({ id_atencion: state.idAtencion, id_paciente: state.idPaciente,
      seleccionados: state.seleccion.size, documentos: state.registros.length, modo: 'SOLO_LECTURA' })
  });
})();
