/* =====================================================
   AUROSANAX ERP - MÓDULO RECETAS
   Archivo: recetas.js
   Versión: 1.1
   Función: vista previa profesional + PDF + historial local
            + edición independiente de recetas.
   Importante:
   - No modifica Plan automáticamente desde Recetas.
   - Mantiene sincronización Plan → Receta.
   - No modifica pacientes, agenda, dashboard, antecedentes ni examen físico.
===================================================== */

(function(){
  'use strict';

  const STORAGE_KEY = 'aurosanax_recetas_emitidas_v1';
  let recetaEditandoId = null;

  function el(id){ return document.getElementById(id); }
  function val(id){ return (el(id)?.value || '').trim(); }
  function setVal(id, value){ if(el(id)) el(id).value = value || ''; }

  function safe(text){
    return String(text || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function nl2br(text){ return safe(text).replace(/\n/g,'<br>'); }

  function fechaHoyReceta(){
    if(typeof fechaHoyISO === 'function') return fechaHoyISO();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function fechaHoraVisual(){
    const d = new Date();
    return d.toLocaleString('es-EC', {
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
    });
  }

  function fechaVisual(fecha){
    if(!fecha) return '';
    const s = String(fecha);
    if(/^\d{4}-\d{2}-\d{2}/.test(s)){
      const p = s.slice(0,10).split('-');
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return s;
  }

  function crearIdReceta(){
    return 'REC-' + Date.now() + '-' + Math.random().toString(16).slice(2,8).toUpperCase();
  }

  function obtenerPacienteActivoSeguro(){
    try{ if(typeof getPacienteActivo === 'function') return getPacienteActivo(); }catch(e){}
    return null;
  }

  function obtenerHistoriasPaciente(idPaciente){
    try{
      if(!Array.isArray(window.historiasClinicas)) return [];
      return window.historiasClinicas.filter(h => String(h.id_paciente || h.paciente_id || '') === String(idPaciente || ''));
    }catch(e){ return []; }
  }

  function obtenerUltimaHistoriaPaciente(idPaciente){
    const hs = obtenerHistoriasPaciente(idPaciente);
    if(!hs.length) return null;
    return hs.slice().sort((a,b) => {
      const fa = String(a.actualizado_en || a.fecha_atencion || a.fecha || '');
      const fb = String(b.actualizado_en || b.fecha_atencion || b.fecha || '');
      return fb.localeCompare(fa);
    })[0];
  }

  function leerRecetasStorage(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      console.warn('No se pudo leer historial local de recetas.', e);
      return [];
    }
  }

  function guardarRecetasStorage(arr){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : [])); }
    catch(e){ console.warn('No se pudo guardar historial local de recetas.', e); }
  }

  function mostrarMensajeReceta(texto, tipo){
    let box = el('recetaEstadoBox');
    const seccion = el('recetas');
    if(!seccion) return;

    if(!box){
      box = document.createElement('div');
      box.id = 'recetaEstadoBox';
      box.className = 'auro-save-status';
      const card = seccion.querySelector('.cardx');
      const row = seccion.querySelector('.row.g-3');
      if(card && row) card.insertBefore(box, row);
      else card?.prepend(box);
    }

    box.className = 'auro-save-status ' + (tipo === 'ok' ? 'ok' : '');
    box.innerHTML = texto;
  }

  function actualizarBotonGuardarReceta(){
    const btn = el('btnGuardarRecetaERP') || document.querySelector('#recetas button[onclick*="guardarRecetaERP"]');
    if(btn){
      btn.id = 'btnGuardarRecetaERP';
      btn.innerHTML = recetaEditandoId
        ? '<i class="bi bi-save me-1"></i> Actualizar receta'
        : '<i class="bi bi-save me-1"></i> Guardar receta';
    }
  }

  function limpiarFormularioReceta(){
    recetaEditandoId = null;
    setVal('recFecha', fechaHoyReceta());
    setVal('recMedico', 'Dra. Aurora Andagoya');
    setVal('recCie10', '');
    setVal('recEstado', 'Emitida');
    setVal('recDiagnostico', '');
    setVal('recMedicamento', '');
    setVal('recIndicaciones', '');
    setVal('recRecomendaciones', '');
    actualizarBotonGuardarReceta();
    mostrarMensajeReceta('<i class="bi bi-info-circle me-1"></i> Nueva receta. Puede escribir o cargar datos desde Plan.', '');
    vistaPreviaReceta();
  }

  window.obtenerDatosReceta = function(){
    const paciente = obtenerPacienteActivoSeguro();
    const ultimaHistoria = paciente ? obtenerUltimaHistoriaPaciente(paciente.id_paciente || paciente.id) : null;

    return {
      id_receta: recetaEditandoId || '',
      id_paciente: paciente?.id_paciente || paciente?.id || '',
      id_historia: ultimaHistoria?.id_historia || ultimaHistoria?.id || '',
      paciente: paciente || {},
      fecha: val('recFecha') || fechaHoyReceta(),
      medico: val('recMedico') || 'Dra. Aurora Andagoya',
      cie10: val('recCie10'),
      estado: val('recEstado') || 'Emitida',
      diagnostico: val('recDiagnostico'),
      medicamento: val('recMedicamento'),
      indicaciones: val('recIndicaciones'),
      recomendaciones: val('recRecomendaciones')
    };
  };

  function asegurarVistaPreviaReceta(){
    const seccion = el('recetas');
    if(!seccion) return null;

    let box = el('recetaPreview');
    if(box) return box;

    box = document.createElement('div');
    box.id = 'recetaPreview';
    box.className = 'cardx p-4 bg-white mt-4';
    box.innerHTML = `<div class="text-muted text-center py-4">Vista previa de receta pendiente. Complete los campos y presione <b>Vista previa</b> o <b>PDF / imprimir</b>.</div>`;

    const nota = seccion.querySelector('.clinical-note.mt-3');
    if(nota && nota.parentNode) nota.parentNode.insertBefore(box, nota.nextSibling);
    else seccion.querySelector('.cardx')?.appendChild(box);
    return box;
  }

  function construirHTMLReceta(r){
    const p = r.paciente || {};
    const nombre = p.nombre || 'Paciente no seleccionado';
    const cedula = p.cedula || '—';
    const edad = p.edad || (typeof calcularEdadDesdeFecha === 'function' ? calcularEdadDesdeFecha(p.fecha_nacimiento) : '') || '—';
    const telefono = p.telefono || p.whatsapp || '—';
    const idPaciente = p.id_paciente || p.id || '—';
    const estadoClass = String(r.estado).toLowerCase().includes('anulada') ? 'badge-danger' : 'badge-ok';

    return `
      <div class="auro-receta-documento">
        <style>
          .auro-receta-documento{font-family:Arial,system-ui,sans-serif;color:#111827;line-height:1.45;max-width:900px;margin:auto;background:#fff;}
          .auro-receta-header{border-bottom:3px solid #8b1e5a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}
          .auro-receta-brand h2{margin:0;color:#8b1e5a;font-weight:900;letter-spacing:.04em;}
          .auro-receta-brand small{color:#6b7280;font-weight:700;}
          .auro-receta-title{text-align:right;color:#111827;}
          .auro-receta-title b{display:block;font-size:20px;}
          .auro-receta-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:12px;margin-bottom:16px;}
          .auro-receta-grid div{font-size:13px;}
          .auro-receta-grid span{color:#6b7280;font-weight:700;}
          .auro-receta-section{margin-top:14px;}
          .auro-receta-section h4{margin:0 0 8px;color:#8b1e5a;font-size:15px;border-bottom:1px solid #fbcfe8;padding-bottom:5px;}
          .auro-receta-box{border:1px solid #e5e7eb;border-radius:14px;padding:12px;min-height:54px;white-space:normal;word-break:break-word;}
          .auro-rp{font-size:18px;font-weight:900;color:#111827;margin-bottom:6px;}
          .auro-receta-footer{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:42px;align-items:end;}
          .auro-firma{text-align:center;padding-top:28px;}
          .auro-linea{border-top:1px solid #111827;margin-bottom:6px;}
          .badge-auro{display:inline-block;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;}
          .badge-ok{background:#dcfce7;color:#166534;}.badge-danger{background:#fee2e2;color:#991b1b;}
          @media print{.no-print{display:none!important}.auro-receta-documento{max-width:none}.auro-receta-box{break-inside:avoid}.auro-receta-header{break-inside:avoid}}
        </style>
        <div class="auro-receta-header">
          <div class="auro-receta-brand"><h2>AUROSANAX</h2><small>Centro Médico Especializado</small><br><small>Innovando salud al cuidado de la mujer</small></div>
          <div class="auro-receta-title"><b>RECETA MÉDICA</b><small>Fecha: ${safe(fechaVisual(r.fecha))}</small><br><span class="badge-auro ${estadoClass}">${safe(r.estado)}</span></div>
        </div>
        <div class="auro-receta-grid">
          <div><span>Paciente:</span> ${safe(nombre)}</div><div><span>Cédula:</span> ${safe(cedula)}</div>
          <div><span>Edad:</span> ${safe(edad)}</div><div><span>WhatsApp:</span> ${safe(telefono)}</div>
          <div><span>ID paciente:</span> ${safe(idPaciente)}</div><div><span>Médico:</span> ${safe(r.medico)}</div>
          <div><span>CIE-10:</span> ${safe(r.cie10 || '—')}</div><div><span>Diagnóstico:</span> ${safe(r.diagnostico || '—')}</div>
        </div>
        <div class="auro-receta-section"><h4>Prescripción</h4><div class="auro-receta-box"><div class="auro-rp">Rp/</div>${nl2br(r.medicamento || 'Sin medicamentos registrados.')}</div></div>
        <div class="auro-receta-section"><h4>Indicaciones para paciente</h4><div class="auro-receta-box">${nl2br(r.indicaciones || '—')}</div></div>
        ${r.recomendaciones ? `<div class="auro-receta-section"><h4>Observaciones internas / recomendaciones</h4><div class="auro-receta-box">${nl2br(r.recomendaciones)}</div></div>` : ''}
        <div class="auro-receta-footer"><div style="font-size:12px;color:#6b7280;">Documento generado desde AUROSANAX Clinical ERP DEMO.<br>Esta receta debe ser validada con firma y sello del profesional tratante.</div><div class="auro-firma"><div class="auro-linea"></div><b>Dra. Aurora Andagoya Murillo</b><br><span>Ginecología y Obstetricia</span><br><span>Firma y sello</span></div></div>
      </div>`;
  }

  window.vistaPreviaReceta = function(){
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    if(!recetaEditandoId && typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();
    const box = asegurarVistaPreviaReceta();
    const r = window.obtenerDatosReceta();
    if(!r.paciente || !r.paciente.nombre){
      if(box) box.innerHTML = `<div class="sheet-note"><i class="bi bi-exclamation-triangle me-1"></i> Primero seleccione o abra un paciente desde Pacientes o Historia Clínica.</div>`;
      return r;
    }
    if(box) box.innerHTML = construirHTMLReceta(r);
    return r;
  };

  window.generarPDFReceta = function(recetaOpcional){
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    if(!recetaOpcional && !recetaEditandoId && typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();
    const r = recetaOpcional || window.obtenerDatosReceta();
    if(!r.paciente || !r.paciente.nombre){
      alert('Seleccione primero un paciente para generar la receta.');
      if(typeof showScreen === 'function') showScreen('pacientes');
      return;
    }
    const html = construirHTMLReceta(r);
    const ventana = window.open('', '_blank');
    if(!ventana){ alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.'); return; }
    ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Receta médica AUROSANAX</title></head><body>${html}</body></html>`);
    ventana.document.close(); ventana.focus(); setTimeout(() => ventana.print(), 300);
  };

  function recetaDesdeFormulario(){
    const r = window.obtenerDatosReceta();
    const paciente = r.paciente || {};
    return {
      id_receta: recetaEditandoId || crearIdReceta(),
      id_paciente: r.id_paciente || paciente.id_paciente || paciente.id || '',
      id_historia: r.id_historia || '',
      paciente_nombre: paciente.nombre || '', paciente_cedula: paciente.cedula || '', paciente_telefono: paciente.telefono || paciente.whatsapp || '',
      fecha_receta: r.fecha || fechaHoyReceta(), medico: r.medico || 'Dra. Aurora Andagoya', diagnostico_cie10: r.cie10 || '', diagnostico: r.diagnostico || '',
      medicamento: r.medicamento || '', indicaciones: r.indicaciones || '', recomendaciones: r.recomendaciones || '', estado: r.estado || 'Emitida',
      creado_en: '', actualizado_en: fechaHoraVisual()
    };
  }

  function cargarRecetaEnFormulario(receta){
    if(!receta) return;
    recetaEditandoId = receta.id_receta || receta.id || '';
    setVal('recFecha', receta.fecha_receta || receta.fecha || fechaHoyReceta());
    setVal('recMedico', receta.medico || 'Dra. Aurora Andagoya');
    setVal('recCie10', receta.diagnostico_cie10 || receta.cie10 || '');
    setVal('recEstado', receta.estado || 'Emitida');
    setVal('recDiagnostico', receta.diagnostico || receta.motivo || '');
    setVal('recMedicamento', receta.medicamento || receta.medicamentos || '');
    setVal('recIndicaciones', receta.indicaciones || '');
    setVal('recRecomendaciones', receta.recomendaciones || receta.observaciones || '');
    actualizarBotonGuardarReceta();
    mostrarMensajeReceta('<i class="bi bi-pencil-square me-1"></i> Editando receta. Los cambios se aplican solo a Recetas y no modifican el Plan de la historia clínica.', '');
    vistaPreviaReceta();
  }

  window.guardarRecetaERP = async function(){
    const r = recetaDesdeFormulario();
    if(!r.id_paciente || !r.paciente_nombre){ alert('Seleccione primero un paciente para guardar la receta.'); if(typeof showScreen === 'function') showScreen('pacientes'); return; }
    if(!String(r.medicamento || '').trim()){ alert('Ingrese medicamentos o prescripción antes de guardar.'); return; }

    const lista = leerRecetasStorage();
    const idx = lista.findIndex(x => String(x.id_receta) === String(r.id_receta));
    if(idx >= 0){ r.creado_en = lista[idx].creado_en || fechaHoraVisual(); lista[idx] = {...lista[idx], ...r, actualizado_en: fechaHoraVisual()}; recetaEditandoId = r.id_receta; }
    else{ r.creado_en = fechaHoraVisual(); r.actualizado_en = fechaHoraVisual(); lista.unshift(r); recetaEditandoId = r.id_receta; }
    guardarRecetasStorage(lista);
    actualizarBotonGuardarReceta(); renderHistorialRecetas();
    mostrarMensajeReceta(`<i class="bi bi-check-circle me-1"></i> Receta ${idx >= 0 ? 'actualizada' : 'guardada'} correctamente. Última actualización: ${safe(fechaHoraVisual())}.`, 'ok');
  };

  function obtenerRecetasPacienteActivo(){
    const paciente = obtenerPacienteActivoSeguro();
    const idPaciente = paciente?.id_paciente || paciente?.id || '';
    const q = val('recHistorialBuscar').toLowerCase();
    const fecha = val('recHistorialFecha');
    return leerRecetasStorage()
      .filter(r => !idPaciente || String(r.id_paciente || '') === String(idPaciente))
      .filter(r => !fecha || String(r.fecha_receta || '').slice(0,10) === fecha)
      .filter(r => !q || [r.paciente_nombre,r.paciente_cedula,r.fecha_receta,r.diagnostico_cie10,r.diagnostico,r.medicamento,r.estado].join(' ').toLowerCase().includes(q));
  }

  function asegurarHistorialRecetas(){
    const seccion = el('recetas'); if(!seccion) return null;
    let box = el('recetasHistorialBox'); if(box) return box;
    box = document.createElement('div');
    box.id = 'recetasHistorialBox'; box.className = 'cardx p-4 bg-white mt-4';
    box.innerHTML = `
      <div class="section-head"><div><h4 class="fw-bold">Recetas emitidas</h4><p class="text-muted">Historial local del paciente activo. Puede ver, editar o reimprimir.</p></div><button type="button" class="btn-soft" id="btnNuevaRecetaERP"><i class="bi bi-plus-circle me-1"></i> Nueva receta</button></div>
      <div class="row g-2 mb-3"><div class="col-md-6"><input id="recHistorialBuscar" class="form-control" placeholder="Buscar por medicamento, diagnóstico, CIE-10 o paciente"></div><div class="col-md-3"><input id="recHistorialFecha" type="date" class="form-control"></div><div class="col-md-3"><button type="button" class="btn-soft w-100" id="btnLimpiarFiltroRecetas">Limpiar filtros</button></div></div>
      <div class="table-responsive"><table class="table table-modern align-middle"><thead><tr><th>Fecha</th><th>Paciente</th><th>CIE-10</th><th>Medicamentos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="recetasHistorialBody"><tr><td colspan="6" class="text-center text-muted py-4">Sin recetas emitidas.</td></tr></tbody></table></div>`;
    const preview = asegurarVistaPreviaReceta();
    if(preview && preview.parentNode) preview.parentNode.insertBefore(box, preview); else seccion.querySelector('.cardx')?.appendChild(box);
    setTimeout(() => {
      el('btnNuevaRecetaERP')?.addEventListener('click', limpiarFormularioReceta);
      el('btnLimpiarFiltroRecetas')?.addEventListener('click', function(){ setVal('recHistorialBuscar', ''); setVal('recHistorialFecha', ''); renderHistorialRecetas(); });
      el('recHistorialBuscar')?.addEventListener('input', renderHistorialRecetas);
      el('recHistorialFecha')?.addEventListener('change', renderHistorialRecetas);
    }, 0);
    return box;
  }

  window.renderHistorialRecetas = function(){
    asegurarHistorialRecetas(); const body = el('recetasHistorialBody'); if(!body) return;
    const recetas = obtenerRecetasPacienteActivo();
    if(!recetas.length){ body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Sin recetas emitidas para este paciente.</td></tr>'; return; }
    body.innerHTML = recetas.map(r => {
      const id = safe(r.id_receta); const meds = String(r.medicamento || '').replace(/\n+/g, ' · ');
      return `<tr><td><b>${safe(fechaVisual(r.fecha_receta))}</b></td><td>${safe(r.paciente_nombre || '—')}<br><small class="text-muted">${safe(r.paciente_cedula || '')}</small></td><td>${safe(r.diagnostico_cie10 || '—')}</td><td>${safe(meds.length > 80 ? meds.slice(0,80) + '...' : meds || '—')}</td><td><span class="badge-auro ${String(r.estado).toLowerCase().includes('anulada') ? 'badge-danger' : 'badge-ok'}">${safe(r.estado || 'Emitida')}</span></td><td><div class="patient-action-group"><button type="button" class="btn-action primary" onclick="verRecetaEmitida('${id}')">Ver</button><button type="button" class="btn-action soft" onclick="editarRecetaEmitida('${id}')">Editar</button><button type="button" class="btn-action success" onclick="pdfRecetaEmitida('${id}')">PDF</button></div></td></tr>`;
    }).join('');
  };

  function buscarRecetaPorId(id){ return leerRecetasStorage().find(r => String(r.id_receta) === String(id)); }
  function recetaGuardadaAFormatoPreview(r){ return {id_receta:r.id_receta,paciente:{id_paciente:r.id_paciente,nombre:r.paciente_nombre,cedula:r.paciente_cedula,telefono:r.paciente_telefono},fecha:r.fecha_receta,medico:r.medico,cie10:r.diagnostico_cie10,estado:r.estado,diagnostico:r.diagnostico,medicamento:r.medicamento,indicaciones:r.indicaciones,recomendaciones:r.recomendaciones}; }

  window.verRecetaEmitida = function(id){ const r = buscarRecetaPorId(id); if(!r) return alert('No se encontró la receta.'); const box = asegurarVistaPreviaReceta(); if(box) box.innerHTML = construirHTMLReceta(recetaGuardadaAFormatoPreview(r)); mostrarMensajeReceta('<i class="bi bi-eye me-1"></i> Receta cargada en vista previa en modo lectura.', ''); };
  window.editarRecetaEmitida = function(id){ const r = buscarRecetaPorId(id); if(!r) return alert('No se encontró la receta.'); cargarRecetaEnFormulario(r); window.scrollTo({top: el('recetas')?.offsetTop || 0, behavior:'smooth'}); };
  window.pdfRecetaEmitida = function(id){ const r = buscarRecetaPorId(id); if(!r) return alert('No se encontró la receta.'); window.generarPDFReceta(recetaGuardadaAFormatoPreview(r)); };

  function agregarBotonVistaPrevia(){
    const seccion = el('recetas'); if(!seccion) return;
    const actions = seccion.querySelector('.section-head .d-flex');
    if(actions && !el('btnVistaPreviaReceta')){
      const btn = document.createElement('button'); btn.id = 'btnVistaPreviaReceta'; btn.type = 'button'; btn.className = 'btn-soft'; btn.innerHTML = '<i class="bi bi-eye me-1"></i> Vista previa'; btn.onclick = window.vistaPreviaReceta; actions.insertBefore(btn, actions.firstChild);
    }
  }

  function inicializarRecetas(){
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    agregarBotonVistaPrevia(); asegurarVistaPreviaReceta(); asegurarHistorialRecetas(); actualizarBotonGuardarReceta(); renderHistorialRecetas();
    mostrarMensajeReceta('<i class="bi bi-info-circle me-1"></i> Recetas funciona independiente del Plan. Si edita aquí, no se modifica la historia clínica original.', '');
  }

  document.addEventListener('DOMContentLoaded', inicializarRecetas);
  document.addEventListener('input', function(e){ const ids = ['recFecha','recMedico','recCie10','recDiagnostico','recMedicamento','recIndicaciones','recRecomendaciones']; if(ids.includes(e.target?.id || '') && el('recetaPreview')){ clearTimeout(window.__auroRecetaPreviewTimer); window.__auroRecetaPreviewTimer = setTimeout(window.vistaPreviaReceta, 250); } });
  document.addEventListener('change', function(e){ const ids = ['recFecha','recEstado']; if(ids.includes(e.target?.id || '') && el('recetaPreview')) window.vistaPreviaReceta(); });

  window.__recetasAurosanaxDebug = function(){ return {version:'1.1', totalLocal: leerRecetasStorage().length, recetaEditandoId, pacienteActivo: obtenerPacienteActivoSeguro()?.nombre || '', storageKey: STORAGE_KEY}; };
})();
