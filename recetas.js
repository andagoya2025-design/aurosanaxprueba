/* =====================================================
   AUROSANAX ERP - MÓDULO RECETAS
   Archivo: recetas.js
   Versión: 1.5
   Función: vista previa profesional + PDF + historial local filtrado por paciente + paginación + acciones verticales + refresco estable
            + edición independiente de recetas + vínculo con atenciones.
   Importante:
   - No modifica Plan automáticamente desde Recetas.
   - Mantiene sincronización Plan → Receta.
   - No modifica pacientes, agenda, dashboard, antecedentes ni examen físico.
===================================================== */

(function(){
  'use strict';

  const STORAGE_KEY = 'aurosanax_recetas_emitidas_v1';
  let recetaEditandoId = null;
  let recetasPaginaActual = 1;
  const RECETAS_POR_PAGINA = 5;
  let recetasHistorialVisible = true;
  let recetaAccionesAbiertaId = '';
  let recetaGuardando = false;
  let recetaEstadoVisual = '';
  let recetaEstadoTimer = null;
  let recetaBloqueoPostGuardadoHasta = 0;
  let recetaAtencionActualId = '';
  let recetasSheetsCargadas = false;
  let recetasSheetsCargando = false;

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

  function obtenerIdMedicoReal(){
    try{
      let idMedico = '';

      if(typeof window.idMedicoActual === 'string' && window.idMedicoActual.trim()){
        idMedico = window.idMedicoActual.trim();
      }

      if(!idMedico && typeof window.getMedicoActivo === 'function'){
        const m = window.getMedicoActivo();
        idMedico = String((m && (m.id_medico || m.id || m.codigo)) || '').trim();
      }

      if(!idMedico && Array.isArray(window.medicos) && window.medicos.length){
        const nombreMedico = val('recMedico') || 'Dra. Aurora Andagoya';
        const normal = String(nombreMedico || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        const encontrado = window.medicos.find(m => {
          const nombreCompleto = String((m.nombres || '') + ' ' + (m.apellidos || ''))
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          const id = String(m.id_medico || m.id || m.codigo || '');
          return (
            (nombreCompleto && normal && (nombreCompleto.includes(normal) || normal.includes(nombreCompleto))) ||
            (normal.includes('aurora') && nombreCompleto.includes('aurora')) ||
            id.endsWith('-397')
          );
        });

        if(encontrado){
          idMedico = String(encontrado.id_medico || encontrado.id || encontrado.codigo || '').trim();
        }
      }

      if(!idMedico || idMedico === 'MED-001' || idMedico === 'MED001'){
        const nombreMedico = val('recMedico') || 'Dra. Aurora Andagoya';
        const normal = String(nombreMedico || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        if(normal.includes('aurora')){
          idMedico = 'MED-20260623160507-397';
        }
      }

      if(!idMedico) idMedico = 'MED-20260623160507-397';
      return idMedico;

    }catch(e){
      return 'MED-20260623160507-397';
    }
  }

  function obtenerCodigoCortoMedico(idMedicoOpcional){
    try{
      const idMedico = String(idMedicoOpcional || obtenerIdMedicoReal() || '').trim();
      const partes = idMedico.split('-').filter(Boolean);
      const ultimo = partes.length ? partes[partes.length - 1] : idMedico;
      const limpio = String(ultimo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      if(!limpio || limpio === '001' || limpio === 'MED001'){
        return '397';
      }

      return limpio;

    }catch(e){
      return '397';
    }
  }

  function crearIdReceta(){
    const d = new Date();

    const fecha =
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2,'0') +
      String(d.getDate()).padStart(2,'0');

    const hora =
      String(d.getHours()).padStart(2,'0') +
      String(d.getMinutes()).padStart(2,'0') +
      String(d.getSeconds()).padStart(2,'0');

    const codigoMedico = obtenerCodigoCortoMedico();
    const control = String(Math.floor(Math.random() * 90) + 10);

    return 'REC-' + fecha + '-' + hora + '-' + codigoMedico + '-' + control;
  }

  function obtenerPacienteActivoSeguro(){
    try{ if(typeof getPacienteActivo === 'function') return getPacienteActivo(); }catch(e){}
    return null;
  }

  function coincideConPacienteActivo(receta){
    const paciente = obtenerPacienteActivoSeguro();
    if(!paciente) return false;

    const idPaciente = String(paciente.id_paciente || paciente.id || '').trim();
    const cedulaPaciente = String(paciente.cedula || paciente.numero_documento || paciente.documento || '').replace(/\D/g,'');
    const nombrePaciente = String(paciente.nombre || ((paciente.nombres || '') + ' ' + (paciente.apellidos || '')))
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    const idRecetaPaciente = String(receta.id_paciente || '').trim();
    const cedulaReceta = String(receta.paciente_cedula || receta.cedula || receta.numero_documento || '').replace(/\D/g,'');
    const nombreReceta = String(receta.paciente_nombre || receta.paciente || receta.nombre || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    return (
      (idPaciente && idRecetaPaciente && idPaciente === idRecetaPaciente) ||
      (cedulaPaciente && cedulaReceta && cedulaPaciente === cedulaReceta) ||
      (nombrePaciente && nombreReceta && nombrePaciente === nombreReceta)
    );
  }


  function obtenerIdAtencionActivaSeguro(){
    try{
      if(typeof window.getIdAtencionActiva === 'function'){
        return String(window.getIdAtencionActiva() || '');
      }

      if(typeof window.getAtencionActiva === 'function'){
        const a = window.getAtencionActiva();
        return String((a && (a.id_atencion || a.id)) || '');
      }
    }catch(e){
      console.warn('No se pudo obtener id_atencion activo.', e);
    }

    return '';
  }

  async function enviarRecetaGoogleSheets(receta){
    try{
      if(!receta) return { success:false, message:'No hay receta para enviar' };

      if(typeof API_URL === 'undefined' || !API_URL){
        return { success:false, message:'API_URL no está definida' };
      }

      const data = {
        id_receta: receta.id_receta || '',
        id_paciente: receta.id_paciente || '',
        id_historia: receta.id_historia || '',
        id_medico: receta.id_medico || obtenerIdMedicoReal(),
        fecha_receta: receta.fecha_receta || fechaHoyReceta(),
        diagnostico_cie10: receta.diagnostico_cie10 || '',
        medicamento: receta.medicamento || '',
        presentacion: receta.presentacion || '',
        dosis: receta.dosis || '',
        via: receta.via || '',
        frecuencia: receta.frecuencia || '',
        duracion: receta.duracion || '',
        cantidad: receta.cantidad || '',
        indicaciones: receta.indicaciones || '',
        recomendaciones: receta.recomendaciones || '',
        id_documento: receta.id_documento || '',
        estado: receta.estado || 'Emitida',
        creado_en: receta.creado_en || fechaHoraVisual(),
        actualizado_en: fechaHoraVisual(),
        id_atencion: receta.id_atencion || obtenerIdAtencionActivaSeguro() || ''
      };

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          accion: 'guardarReceta',
          data: data
        })
      });

      return { success:true, message:'Receta enviada a Google Sheets' };

    }catch(error){
      console.error('Error enviando receta a Google Sheets:', error);
      return { success:false, message:error.message };
    }
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

  function normalizarRecetaGuardada(r){
    r = r || {};
    return {
      id_receta: r.id_receta || r.id || '',
      id_paciente: r.id_paciente || r.paciente_id || '',
      id_historia: r.id_historia || '',
      id_atencion: r.id_atencion || '',
      id_medico: r.id_medico || obtenerIdMedicoReal(),
      codigo_medico: r.codigo_medico || obtenerCodigoCortoMedico(r.id_medico || obtenerIdMedicoReal()),
      paciente_nombre: r.paciente_nombre || r.paciente || r.nombre || '',
      paciente_cedula: r.paciente_cedula || r.cedula || r.numero_documento || '',
      paciente_telefono: r.paciente_telefono || r.telefono || r.whatsapp || '',
      fecha_receta: r.fecha_receta || r.fecha || fechaHoyReceta(),
      medico: r.medico || r.nombre_medico || val('recMedico') || 'Dra. Aurora Andagoya',
      diagnostico_cie10: r.diagnostico_cie10 || r.cie10 || '',
      diagnostico: r.diagnostico || r.motivo || '',
      medicamento: r.medicamento || r.medicamentos || '',
      presentacion: r.presentacion || '',
      dosis: r.dosis || '',
      via: r.via || '',
      frecuencia: r.frecuencia || '',
      duracion: r.duracion || '',
      cantidad: r.cantidad || '',
      indicaciones: r.indicaciones || '',
      recomendaciones: r.recomendaciones || r.observaciones || '',
      id_documento: r.id_documento || '',
      estado: r.estado || 'Emitida',
      creado_en: r.creado_en || '',
      actualizado_en: r.actualizado_en || ''
    };
  }

  function mezclarRecetasLocalesYSheets(remotas){
    const mapa = new Map();

    (Array.isArray(remotas) ? remotas : []).forEach(item => {
      const r = normalizarRecetaGuardada(item);
      if(r.id_receta){
        mapa.set(String(r.id_receta), r);
      }
    });

    leerRecetasStorage().forEach(item => {
      const r = normalizarRecetaGuardada(item);
      if(r.id_receta){
        mapa.set(String(r.id_receta), Object.assign({}, mapa.get(String(r.id_receta)) || {}, r));
      }
    });

    const mezcladas = Array.from(mapa.values()).sort((a,b) =>
      String(b.actualizado_en || b.creado_en || b.fecha_receta || '').localeCompare(String(a.actualizado_en || a.creado_en || a.fecha_receta || ''))
    );

    guardarRecetasStorage(mezcladas);
    return mezcladas;
  }

  async function cargarRecetasDesdeSheets(forzar){
    try{
      if(recetasSheetsCargando) return leerRecetasStorage();
      if(recetasSheetsCargadas && !forzar) return leerRecetasStorage();

      if(typeof API_URL === 'undefined' || !API_URL){
        return leerRecetasStorage();
      }

      recetasSheetsCargando = true;

      const res = await fetch(API_URL + '?accion=listarRecetas&_=' + Date.now());
      const data = await res.json();
      const remotas = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

      const mezcladas = mezclarRecetasLocalesYSheets(remotas);
      recetasSheetsCargadas = true;
      recetasSheetsCargando = false;

      return mezcladas;

    }catch(error){
      recetasSheetsCargando = false;
      console.warn('No se pudieron cargar recetas desde Google Sheets.', error);
      return leerRecetasStorage();
    }
  }

  function mostrarMensajeReceta(texto, tipo, opciones){

    function pintarEstadoEn(contenedorId, insertador){
      let box = el(contenedorId);

      if(!box){
        box = document.createElement('div');
        box.id = contenedorId;
        box.className = 'auro-save-status';
        insertador(box);
      }

      box.className = 'auro-save-status ' + (tipo === 'ok' ? 'ok' : '');
      box.innerHTML = texto;
      box.style.display = 'block';
    }

    const seccionRecetas = el('recetas');
    if(seccionRecetas){
      pintarEstadoEn('recetaEstadoBox', function(box){
        const card = seccionRecetas.querySelector('.cardx');
        const row = seccionRecetas.querySelector('.row.g-3');
        if(card && row) card.insertBefore(box, row);
        else card?.prepend(box);
      });
    }

    /* Aviso corto junto al botón Guardar receta del Plan.
       No usa hc_plan completo para evitar interferir con el guardado del Plan clínico. */
    if(opciones && opciones.cercaBotonPlan){
      const btnPlan = obtenerBotonesGuardarReceta().find(function(btn){
        return btn && btn.closest && btn.closest('#hc_plan');
      });

      if(btnPlan){
        pintarEstadoEn('recetaEstadoBotonPlan', function(box){
          box.style.marginTop = '8px';
          box.style.marginBottom = '8px';
          const contenedorBoton = btnPlan.parentElement || btnPlan;
          if(contenedorBoton && contenedorBoton.parentNode){
            contenedorBoton.parentNode.insertBefore(box, contenedorBoton.nextSibling);
          }
        });
      }
    }
  }

  function marcarEstadoRecetaGuardadaVisual(esActualizacion){
    recetaEstadoVisual = esActualizacion ? 'actualizada' : 'guardada';
    recetaBloqueoPostGuardadoHasta = Date.now() + 2800;

    if(recetaEstadoTimer){
      clearTimeout(recetaEstadoTimer);
    }

    actualizarBotonGuardarReceta();

    recetaEstadoTimer = setTimeout(function(){
      recetaEstadoVisual = '';
      recetaBloqueoPostGuardadoHasta = 0;
      actualizarBotonGuardarReceta();
    }, 2800);
  }

  function obtenerBotonesGuardarReceta(){
    const botones = [];

    function agregar(btn){
      if(btn && !botones.includes(btn)){
        botones.push(btn);
      }
    }

    agregar(el('btnGuardarRecetaERP'));

    document.querySelectorAll('[data-auro-receta-save-btn="1"]').forEach(agregar);
    document.querySelectorAll('button[onclick*="guardarRecetaERP"], a[onclick*="guardarRecetaERP"]').forEach(agregar);

    document.querySelectorAll('button, a').forEach(btn => {
      const txt = String(btn.textContent || '').trim().toLowerCase();
      if(
        txt.includes('guardar receta') ||
        txt.includes('actualizar receta') ||
        txt.includes('guardando') ||
        txt.includes('receta guardada') ||
        txt.includes('receta actualizada')
      ){
        agregar(btn);
      }
    });

    return botones;
  }

  function actualizarBotonGuardarReceta(){
    const botones = obtenerBotonesGuardarReceta();

    botones.forEach((btn, i) => {
      if(!btn.id && i === 0){
        btn.id = 'btnGuardarRecetaERP';
      }

      btn.setAttribute('data-auro-receta-save-btn','1');

      if(recetaGuardando){
        btn.disabled = true;
        btn.setAttribute('aria-busy','true');
        btn.style.opacity = '0.65';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
        btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Guardando receta...';
        return;
      }

      if(recetaEstadoVisual){
        btn.disabled = true;
        btn.removeAttribute('aria-busy');
        btn.style.opacity = '1';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
        btn.innerHTML = recetaEstadoVisual === 'actualizada'
          ? '<i class="bi bi-check-circle me-1"></i> Receta actualizada ✓'
          : '<i class="bi bi-check-circle me-1"></i> Receta guardada ✓';
        return;
      }

      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = '';

      btn.innerHTML = recetaEditandoId
        ? '<i class="bi bi-save me-1"></i> Actualizar receta'
        : '<i class="bi bi-save me-1"></i> Guardar receta';
    });
  }

  function limpiarFormularioReceta(){
    recetaEditandoId = null;
    recetaEstadoVisual = '';
    recetaBloqueoPostGuardadoHasta = 0;
    if(recetaEstadoTimer){ clearTimeout(recetaEstadoTimer); recetaEstadoTimer = null; }
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

  function limpiarEstadoRecetaNuevaDespuesDeGuardar(){
    recetaEditandoId = null;
    recetaAtencionActualId = obtenerIdAtencionActivaSeguro() || '';

    setVal('recDiagnostico', '');
    setVal('recMedicamento', '');
    setVal('recIndicaciones', '');
    setVal('recRecomendaciones', '');

    actualizarBotonGuardarReceta();

    const box = el('recetaPreview');
    if(box){
      box.innerHTML = `<div class="text-muted text-center py-4">Receta guardada correctamente. Para una nueva atención, agregue medicamentos nuevos desde el Plan o presione <b>Nueva receta</b>.</div>`;
    }
  }

  function verificarCambioAtencionReceta(){
    const actual = obtenerIdAtencionActivaSeguro() || '';
    if(recetaAtencionActualId && actual && recetaAtencionActualId !== actual){
      recetaEditandoId = null;
      actualizarBotonGuardarReceta();
    }
    if(actual) recetaAtencionActualId = actual;
  }

  window.obtenerDatosReceta = function(){
    const paciente = obtenerPacienteActivoSeguro();
    const ultimaHistoria = paciente ? obtenerUltimaHistoriaPaciente(paciente.id_paciente || paciente.id) : null;

    return {
      id_receta: recetaEditandoId || '',
      id_paciente: paciente?.id_paciente || paciente?.id || '',
      id_historia: ultimaHistoria?.id_historia || ultimaHistoria?.id || '',
      id_atencion: obtenerIdAtencionActivaSeguro(),
      paciente: paciente || {},
      fecha: val('recFecha') || fechaHoyReceta(),
      medico: val('recMedico') || 'Dra. Aurora Andagoya',
      id_medico: obtenerIdMedicoReal(),
      codigo_medico: obtenerCodigoCortoMedico(),
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
    const idReceta = r.id_receta || '—';
    const idMedico = r.id_medico || obtenerIdMedicoReal();
    const codigoMedico = r.codigo_medico || obtenerCodigoCortoMedico(idMedico);
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
          <div class="auro-receta-title"><b>RECETA MÉDICA</b><small>ID receta: ${safe(idReceta)}</small><br><small>Fecha: ${safe(fechaVisual(r.fecha))}</small><br><span class="badge-auro ${estadoClass}">${safe(r.estado)}</span></div>
        </div>
        <div class="auro-receta-grid">
          <div><span>Paciente:</span> ${safe(nombre)}</div><div><span>Cédula:</span> ${safe(cedula)}</div>
          <div><span>Edad:</span> ${safe(edad)}</div><div><span>WhatsApp:</span> ${safe(telefono)}</div>
          <div><span>ID paciente:</span> ${safe(idPaciente)}</div><div><span>ID receta:</span> ${safe(idReceta)}</div>
          <div><span>Médico:</span> ${safe(r.medico)}</div><div><span>Código médico:</span> ${safe(codigoMedico)}</div>
          <div><span>CIE-10:</span> ${safe(r.cie10 || '—')}</div><div><span>Diagnóstico:</span> ${safe(r.diagnostico || '—')}</div>
        </div>
        <div class="auro-receta-section"><h4>Prescripción</h4><div class="auro-receta-box"><div class="auro-rp">Rp/</div>${nl2br(r.medicamento || 'Sin medicamentos registrados.')}</div></div>
        <div class="auro-receta-section"><h4>Indicaciones para paciente</h4><div class="auro-receta-box">${nl2br(r.indicaciones || '—')}</div></div>
        ${r.recomendaciones ? `<div class="auro-receta-section"><h4>Observaciones internas / recomendaciones</h4><div class="auro-receta-box">${nl2br(r.recomendaciones)}</div></div>` : ''}
        <div class="auro-receta-footer"><div style="font-size:12px;color:#6b7280;">Documento generado desde AUROSANAX Clinical ERP DEMO.<br>Esta receta debe ser validada con firma y sello del profesional tratante.<br>ID receta: ${safe(idReceta)} · Código médico: ${safe(codigoMedico)}</div><div class="auro-firma"><div class="auro-linea"></div><b>Dra. Aurora Andagoya Murillo</b><br><span>Ginecología y Obstetricia</span><br><span>Código médico: ${safe(codigoMedico)}</span><br><span>Firma y sello</span></div></div>
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
      id_atencion: r.id_atencion || obtenerIdAtencionActivaSeguro() || '',
      id_medico: r.id_medico || obtenerIdMedicoReal(),
      codigo_medico: r.codigo_medico || obtenerCodigoCortoMedico(r.id_medico || obtenerIdMedicoReal()),
      paciente_nombre: paciente.nombre || '', paciente_cedula: paciente.cedula || '', paciente_telefono: paciente.telefono || paciente.whatsapp || '',
      fecha_receta: r.fecha || fechaHoyReceta(), medico: r.medico || 'Dra. Aurora Andagoya', diagnostico_cie10: r.cie10 || '', diagnostico: r.diagnostico || '',
      medicamento: r.medicamento || '', presentacion: '', dosis: '', via: '', frecuencia: '', duracion: '', cantidad: '',
      indicaciones: r.indicaciones || '', recomendaciones: r.recomendaciones || '', id_documento: '', estado: r.estado || 'Emitida',
      creado_en: '', actualizado_en: fechaHoraVisual()
    };
  }

  function cargarRecetaEnFormulario(receta){
    if(!receta) return;
    recetaEditandoId = receta.id_receta || receta.id || '';
    recetaAtencionActualId = receta.id_atencion || obtenerIdAtencionActivaSeguro() || '';
    setVal('recFecha', receta.fecha_receta || receta.fecha || fechaHoyReceta());
    setVal('recMedico', receta.medico || 'Dra. Aurora Andagoya');
    setVal('recCie10', receta.diagnostico_cie10 || receta.cie10 || '');
    setVal('recEstado', receta.estado || 'Emitida');
    setVal('recDiagnostico', receta.diagnostico || receta.motivo || '');
    setVal('recMedicamento', receta.medicamento || receta.medicamentos || '');
    setVal('recIndicaciones', receta.indicaciones || '');
    setVal('recRecomendaciones', receta.recomendaciones || receta.observaciones || '');
    if(!receta.id_atencion) receta.id_atencion = obtenerIdAtencionActivaSeguro();
    actualizarBotonGuardarReceta();
    mostrarMensajeReceta('<i class="bi bi-pencil-square me-1"></i> Editando receta. Los cambios se aplican solo a Recetas y no modifican el Plan de la historia clínica.', '');
    vistaPreviaReceta();
  }

  window.guardarRecetaERP = async function(){
    if(recetaGuardando){
      mostrarMensajeReceta('<i class="bi bi-hourglass-split me-1"></i> La receta ya se está guardando. Espere unos segundos para evitar duplicados.', '', {cercaBotonPlan:true});
      actualizarBotonGuardarReceta();
      return;
    }

    if(Date.now() < recetaBloqueoPostGuardadoHasta){
      mostrarMensajeReceta('<i class="bi bi-check-circle me-1"></i> La receta ya fue guardada. Espere unos segundos antes de volver a presionar.', 'ok', {cercaBotonPlan:true});
      actualizarBotonGuardarReceta();
      return;
    }

    verificarCambioAtencionReceta();

    const estabaEditando = !!recetaEditandoId;

    recetaGuardando = true;
    actualizarBotonGuardarReceta();

    try{
      const r = recetaDesdeFormulario();

      if(!r.id_paciente || !r.paciente_nombre){
        alert('Seleccione primero un paciente para guardar la receta.');
        if(typeof showScreen === 'function') showScreen('pacientes');
        return;
      }

      if(!String(r.medicamento || '').trim()){
        alert('Ingrese medicamentos o prescripción antes de guardar.');
        return;
      }

      if(!r.id_atencion){
        r.id_atencion = obtenerIdAtencionActivaSeguro();
      }

      recetaAtencionActualId = r.id_atencion || recetaAtencionActualId || '';

      const lista = leerRecetasStorage();
      let idx = lista.findIndex(x => String(x.id_receta) === String(r.id_receta));

      if(!estabaEditando && idx >= 0){
        r.id_receta = crearIdReceta();
        idx = lista.findIndex(x => String(x.id_receta) === String(r.id_receta));
      }

      if(estabaEditando && idx >= 0){
        r.creado_en = lista[idx].creado_en || fechaHoraVisual();
        r.actualizado_en = fechaHoraVisual();
        lista[idx] = {...lista[idx], ...r};
      }else{
        r.creado_en = fechaHoraVisual();
        r.actualizado_en = fechaHoraVisual();
        lista.unshift(r);
      }

      guardarRecetasStorage(lista);
      recetasHistorialVisible = true;
      recetaAccionesAbiertaId = '';

      mostrarMensajeReceta('<i class="bi bi-hourglass-split me-1"></i> Guardando receta y enviando a Google Sheets...', '', {cercaBotonPlan:true});

      const resultado = await enviarRecetaGoogleSheets(r);

      await cargarRecetasDesdeSheets(true);
      recetasPaginaActual = 1;
      renderHistorialRecetas();

      if(resultado && resultado.success){
        mostrarMensajeReceta(`<i class="bi bi-check-circle me-1"></i> Receta ${estabaEditando ? 'actualizada' : 'guardada'} correctamente. Ya fue asociada a la consulta activa.`, 'ok', {cercaBotonPlan:true});
      }else{
        mostrarMensajeReceta(`<i class="bi bi-exclamation-triangle me-1"></i> Receta guardada localmente, pero no se pudo enviar a Google Sheets.`, '', {cercaBotonPlan:true});
        alert('Receta guardada localmente, pero no se pudo enviar a Google Sheets.');
      }

      if(!estabaEditando){
        limpiarEstadoRecetaNuevaDespuesDeGuardar();
      }else{
        recetaEditandoId = r.id_receta;
        vistaPreviaReceta();
      }

      if(resultado && resultado.success){
        marcarEstadoRecetaGuardadaVisual(estabaEditando);
      }else{
        actualizarBotonGuardarReceta();
      }

    }catch(error){
      console.error('Error guardando receta:', error);
      mostrarMensajeReceta('<i class="bi bi-exclamation-triangle me-1"></i> Error al guardar receta. Intente nuevamente.', '', {cercaBotonPlan:true});
      alert('Error al guardar receta: ' + (error && error.message ? error.message : error));
    }finally{
      recetaGuardando = false;
      actualizarBotonGuardarReceta();
    }
  };


  function consultaPorIdAtencion(idAtencion){
    try{
      if(!idAtencion) return '—';
      const raw = localStorage.getItem('aurosanax_atenciones_local_v1');
      const arr = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(arr)) return '—';
      const a = arr.find(x => String(x.id_atencion || '') === String(idAtencion || ''));
      return a && a.numero_consulta ? '#' + a.numero_consulta : '—';
    }catch(e){
      return '—';
    }
  }

  function recortarTexto(valor, max){
    const txt = String(valor || '').replace(/\s+/g, ' ').trim();
    if(!txt) return '—';
    return txt.length > max ? txt.slice(0, max) + '...' : txt;
  }

  function toggleAccionesReceta(id){
    recetaAccionesAbiertaId = (String(recetaAccionesAbiertaId) === String(id)) ? '' : String(id);
    renderHistorialRecetas();
  }

  function obtenerRecetasPacienteActivo(){
    const paciente = obtenerPacienteActivoSeguro();
    const mostrarTodas = el('recMostrarTodas')?.checked === true;
    const q = val('recHistorialBuscar').toLowerCase();
    const fecha = val('recHistorialFecha');

    return leerRecetasStorage()
      .filter(r => mostrarTodas || (paciente && coincideConPacienteActivo(r)))
      .filter(r => !fecha || String(r.fecha_receta || '').slice(0,10) === fecha)
      .filter(r => !q || [r.paciente_nombre,r.paciente_cedula,r.fecha_receta,r.diagnostico_cie10,r.diagnostico,r.medicamento,r.estado,r.id_atencion].join(' ').toLowerCase().includes(q))
      .sort((a,b) => String(b.actualizado_en || b.creado_en || b.fecha_receta || '').localeCompare(String(a.actualizado_en || a.creado_en || a.fecha_receta || '')));
  }

  function asegurarHistorialRecetas(){
    const seccion = el('recetas'); if(!seccion) return null;
    let box = el('recetasHistorialBox'); if(box) return box;

    box = document.createElement('div');
    box.id = 'recetasHistorialBox';
    box.className = 'cardx p-4 bg-white mt-4';
    box.innerHTML = `
      <div class="section-head">
        <div>
          <h4 class="fw-bold mb-1">Recetas emitidas</h4>
          <p class="text-muted mb-1">Historial local del paciente activo. Puede ver, editar o reimprimir.</p>
          <div class="small text-muted" id="recetasContador">Total recetas encontradas: 0</div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button type="button" class="btn-soft" id="btnToggleRecetasHistorial"><i class="bi bi-eye-slash me-1"></i> Ocultar recetas</button>
          <button type="button" class="btn-soft" id="btnNuevaRecetaERP"><i class="bi bi-plus-circle me-1"></i> Nueva receta</button>
        </div>
      </div>

      <div class="row g-2 mb-3" id="recetasFiltrosBox">
        <div class="col-md-5">
          <input id="recHistorialBuscar" class="form-control" placeholder="Buscar por medicamento, diagnóstico, CIE-10 o paciente">
        </div>
        <div class="col-md-3">
          <input id="recHistorialFecha" type="date" class="form-control">
        </div>
        <div class="col-md-2">
          <button type="button" class="btn-soft w-100" id="btnLimpiarFiltroRecetas">Limpiar</button>
        </div>
        <div class="col-md-2 d-flex align-items-center">
          <label class="small text-muted mb-0">
            <input type="checkbox" id="recMostrarTodas" class="me-1"> Mostrar todas
          </label>
        </div>
      </div>

      <style>
        @media (max-width: 768px){
          #recetasHistorialBox{padding:14px!important;}
          #recetasHistorialBox .table-responsive{display:none!important;}
          #recetasHistorialMobile{display:block!important;}
          #recetasHistorialBox .section-head{display:grid!important;grid-template-columns:1fr auto;gap:10px;align-items:start;}
          #recetasHistorialBox .section-head h4{font-size:22px!important;line-height:1.05;}
          #recetasHistorialBox .section-head .d-flex{display:grid!important;grid-template-columns:1fr;gap:8px;}
          #recetasHistorialBox .section-head button{min-width:130px;white-space:normal;}
          #recetasFiltrosBox > div{width:100%!important;}
          .auro-receta-mobile-card{border:1px solid #e5e7eb;border-radius:16px;padding:12px;margin-bottom:10px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06);}
          .auro-receta-mobile-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px;}
          .auro-receta-mobile-head b{font-size:14px;}
          .auro-receta-mobile-card .small{font-size:12px;line-height:1.35;}
          .auro-receta-mobile-card .btn-action{width:100%;margin-top:8px;}
        }
        @media (min-width: 769px){
          #recetasHistorialMobile{display:none!important;}
        }
      </style>

      <div id="recetasHistorialContenido">
        <div class="table-responsive">
          <table class="table table-modern align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>ID receta</th>
                <th>Consulta</th>
                <th>Paciente</th>
                <th>CIE-10</th>
                <th>Medicamento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="recetasHistorialBody">
              <tr><td colspan="8" class="text-center text-muted py-4">Sin recetas emitidas.</td></tr>
            </tbody>
          </table>
        </div>
        <div id="recetasHistorialMobile" style="display:none;"></div>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2" id="recetasPaginacionBox">
          <button type="button" class="btn-soft" id="btnRecetasAnterior">Anterior</button>
          <div class="small text-muted fw-bold" id="recetasPaginaInfo">Página 1 de 1</div>
          <button type="button" class="btn-soft" id="btnRecetasSiguiente">Siguiente</button>
        </div>
      </div>
    `;

    const preview = asegurarVistaPreviaReceta();
    if(preview && preview.parentNode) preview.parentNode.insertBefore(box, preview);
    else seccion.querySelector('.cardx')?.appendChild(box);

    setTimeout(() => {
      el('btnNuevaRecetaERP')?.addEventListener('click', limpiarFormularioReceta);

      el('btnToggleRecetasHistorial')?.addEventListener('click', function(){
        recetasHistorialVisible = !recetasHistorialVisible;
        renderHistorialRecetas();
      });

      el('btnLimpiarFiltroRecetas')?.addEventListener('click', function(){
        setVal('recHistorialBuscar', '');
        setVal('recHistorialFecha', '');
        recetasPaginaActual = 1;
        renderHistorialRecetas();
      });

      el('recHistorialBuscar')?.addEventListener('input', function(){
        recetasPaginaActual = 1;
        renderHistorialRecetas();
      });

      el('recHistorialFecha')?.addEventListener('change', function(){
        recetasPaginaActual = 1;
        renderHistorialRecetas();
      });

      el('recMostrarTodas')?.addEventListener('change', function(){
        recetasPaginaActual = 1;
        renderHistorialRecetas();
      });

      el('btnRecetasAnterior')?.addEventListener('click', function(){
        if(recetasPaginaActual > 1){
          recetasPaginaActual--;
          cargarRecetasDesdeSheets(false).then(renderHistorialRecetas);
        }
      });

      el('btnRecetasSiguiente')?.addEventListener('click', function(){
        const total = obtenerRecetasPacienteActivo().length;
        const totalPaginas = Math.max(1, Math.ceil(total / RECETAS_POR_PAGINA));
        if(recetasPaginaActual < totalPaginas){
          recetasPaginaActual++;
          actualizarBotonGuardarReceta();
          renderHistorialRecetas();
        }
      });
    }, 0);

    return box;
  }

  window.renderHistorialRecetas = function(){
    asegurarHistorialRecetas();

    const body = el('recetasHistorialBody');
    const contador = el('recetasContador');
    const contenido = el('recetasHistorialContenido');
    const filtros = el('recetasFiltrosBox');
    const btnToggle = el('btnToggleRecetasHistorial');
    const pagInfo = el('recetasPaginaInfo');
    const mobile = el('recetasHistorialMobile');
    const btnAnt = el('btnRecetasAnterior');
    const btnSig = el('btnRecetasSiguiente');

    if(!body) return;

    const recetas = obtenerRecetasPacienteActivo();

    if(!recetas.length && !recetasSheetsCargadas && !recetasSheetsCargando){
      if(contador) contador.textContent = 'Cargando recetas desde Google Sheets...';
      cargarRecetasDesdeSheets(false).then(function(){
        renderHistorialRecetas();
      });
      return;
    }

    if(contador){
      contador.textContent = 'Total recetas encontradas: ' + recetas.length;
    }

    if(btnToggle){
      btnToggle.innerHTML = recetasHistorialVisible
        ? '<i class="bi bi-eye-slash me-1"></i> Ocultar recetas'
        : '<i class="bi bi-eye me-1"></i> Mostrar recetas';
    }

    if(filtros) filtros.style.display = recetasHistorialVisible ? '' : 'none';
    if(contenido) contenido.style.display = recetasHistorialVisible ? '' : 'none';

    if(!recetasHistorialVisible){
      return;
    }

    const totalPaginas = Math.max(1, Math.ceil(recetas.length / RECETAS_POR_PAGINA));
    if(recetasPaginaActual > totalPaginas) recetasPaginaActual = totalPaginas;
    if(recetasPaginaActual < 1) recetasPaginaActual = 1;

    const inicio = (recetasPaginaActual - 1) * RECETAS_POR_PAGINA;
    const pagina = recetas.slice(inicio, inicio + RECETAS_POR_PAGINA);

    if(pagInfo) pagInfo.textContent = 'Página ' + recetasPaginaActual + ' de ' + totalPaginas;
    if(btnAnt) btnAnt.disabled = recetasPaginaActual <= 1;
    if(btnSig) btnSig.disabled = recetasPaginaActual >= totalPaginas;

    if(!pagina.length){
      body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Sin recetas emitidas para este paciente activo.</td></tr>';
      if(mobile) mobile.innerHTML = '<div class="text-muted small py-3">Sin recetas emitidas para este paciente activo.</div>';
      return;
    }

    body.innerHTML = pagina.map(r => {
      const idRaw = String(r.id_receta || '');
      const id = safe(idRaw);
      const menuId = safe(idRaw.replace(/[^a-zA-Z0-9_-]/g, '_'));
      const meds = recortarTexto(r.medicamento || '', 95);
      const consulta = consultaPorIdAtencion(r.id_atencion || '');
      const abierto = String(recetaAccionesAbiertaId) === String(menuId);

      const fila = `<tr>
        <td><b>${safe(fechaVisual(r.fecha_receta))}</b></td>
        <td><small class="text-muted">${safe(idRaw || '—')}</small></td>
        <td><span class="badge-auro badge-blue">${safe(consulta)}</span></td>
        <td>${safe(r.paciente_nombre || '—')}<br><small class="text-muted">${safe(r.paciente_cedula || '')}</small></td>
        <td>${safe(r.diagnostico_cie10 || '—')}</td>
        <td>${safe(meds)}</td>
        <td><span class="badge-auro ${String(r.estado).toLowerCase().includes('anulada') ? 'badge-danger' : 'badge-ok'}">${safe(r.estado || 'Emitida')}</span></td>
        <td>
          <button type="button" class="btn-action primary" onclick="toggleAccionesReceta('${menuId}')">Acciones ▾</button>
        </td>
      </tr>`;

      const detalle = abierto ? `<tr class="receta-acciones-row">
        <td colspan="8">
          <div class="cardx p-3 bg-white mt-1 mb-2" style="border-left:4px solid #8b1e5a;">
            <div class="fw-bold mb-2">Acciones de receta</div>
            <div class="d-flex flex-column gap-2" style="max-width:220px;">
              <button type="button" class="btn-action soft text-start" onclick="verRecetaEmitida('${id}')">👁 Ver receta</button>
              <button type="button" class="btn-action soft text-start" onclick="editarRecetaEmitida('${id}')">✏ Editar receta</button>
              <button type="button" class="btn-action success text-start" onclick="pdfRecetaEmitida('${id}')">📄 PDF / imprimir</button>
            </div>
          </div>
        </td>
      </tr>` : '';

      return fila + detalle;
    }).join('');

    if(mobile){
      const esMovil = (
        window.innerWidth <= 900 ||
        (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
      );

      const tablaWrap = body.closest('.table-responsive');
      if(tablaWrap){
        tablaWrap.style.display = esMovil ? 'none' : '';
      }

      mobile.style.display = esMovil ? 'block' : 'none';
      mobile.style.width = '100%';
      mobile.style.clear = 'both';

      mobile.innerHTML = pagina.map(r => {
        const idRaw = String(r.id_receta || '');
        const idSeguro = safe(idRaw);
        const meds = recortarTexto(r.medicamento || '', 140);
        const consulta = consultaPorIdAtencion(r.id_atencion || '');
        const estadoClase = String(r.estado || '').toLowerCase().includes('anulada') ? 'badge-danger' : 'badge-ok';

        return '<div class="auro-receta-mobile-card" style="display:block;border:1px solid #e5e7eb;border-radius:16px;padding:12px;margin:10px 0;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06);">' +
          '<div class="auro-receta-mobile-head" style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px;">' +
            '<div><b>' + safe(fechaVisual(r.fecha_receta)) + '</b><br><small class="text-muted">' + idSeguro + '</small></div>' +
            '<span class="badge-auro ' + estadoClase + '">' + safe(r.estado || 'Emitida') + '</span>' +
          '</div>' +
          '<div class="small"><b>Consulta:</b> ' + safe(consulta) + '</div>' +
          '<div class="small"><b>Paciente:</b> ' + safe(r.paciente_nombre || '—') + (r.paciente_cedula ? '<br><span class="text-muted">' + safe(r.paciente_cedula) + '</span>' : '') + '</div>' +
          '<div class="small"><b>CIE-10:</b> ' + safe(r.diagnostico_cie10 || '—') + '</div>' +
          '<div class="small"><b>Medicamento:</b> ' + safe(meds) + '</div>' +
          '<div class="d-grid gap-2 mt-2">' +
            '<button type="button" class="btn-action soft" onclick="verRecetaEmitida(\'' + idSeguro + '\')">👁 Ver receta</button>' +
            '<button type="button" class="btn-action soft" onclick="editarRecetaEmitida(\'' + idSeguro + '\')">✏ Editar receta</button>' +
            '<button type="button" class="btn-action success" onclick="pdfRecetaEmitida(\'' + idSeguro + '\')">📄 PDF / imprimir</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  };

  function buscarRecetaPorId(id){ return leerRecetasStorage().find(r => String(r.id_receta) === String(id)); }
  function recetaGuardadaAFormatoPreview(r){ return {id_receta:r.id_receta,id_atencion:r.id_atencion,id_medico:r.id_medico || obtenerIdMedicoReal(),codigo_medico:r.codigo_medico || obtenerCodigoCortoMedico(r.id_medico || obtenerIdMedicoReal()),paciente:{id_paciente:r.id_paciente,nombre:r.paciente_nombre,cedula:r.paciente_cedula,telefono:r.paciente_telefono},fecha:r.fecha_receta,medico:r.medico,cie10:r.diagnostico_cie10,estado:r.estado,diagnostico:r.diagnostico,medicamento:r.medicamento,indicaciones:r.indicaciones,recomendaciones:r.recomendaciones}; }

  window.toggleAccionesReceta = toggleAccionesReceta;

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


  function refrescarRecetasAlEntrar(){
    setTimeout(function(){
      try{
        if(el('recetas') && el('recetas').classList.contains('active')){
          verificarCambioAtencionReceta();
          asegurarHistorialRecetas();
          recetasPaginaActual = 1;
          renderHistorialRecetas();
        }
      }catch(e){}
    }, 250);
  }

  function envolverRecetasFuncion(nombre, despues){
    const original = window[nombre];
    if(typeof original !== 'function' || original.__auroRecetasWrapped) return;

    const nueva = function(){
      const r = original.apply(this, arguments);
      setTimeout(despues, 250);
      return r;
    };

    nueva.__auroRecetasWrapped = true;
    window[nombre] = nueva;
  }

  function inicializarRecetas(){
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    agregarBotonVistaPrevia();
    asegurarVistaPreviaReceta();
    asegurarHistorialRecetas();
    actualizarBotonGuardarReceta();
    renderHistorialRecetas();
    cargarRecetasDesdeSheets(false).then(renderHistorialRecetas);

    envolverRecetasFuncion('showScreen', refrescarRecetasAlEntrar);
    envolverRecetasFuncion('seleccionarPacienteHistoria', refrescarRecetasAlEntrar);
    envolverRecetasFuncion('actualizarTarjetaPacienteHistoria', refrescarRecetasAlEntrar);

    mostrarMensajeReceta('<i class="bi bi-info-circle me-1"></i> Recetas funciona independiente del Plan. Si edita aquí, no se modifica la historia clínica original.', '');
  }

  document.addEventListener('DOMContentLoaded', inicializarRecetas);
  document.addEventListener('input', function(e){ const ids = ['recFecha','recMedico','recCie10','recDiagnostico','recMedicamento','recIndicaciones','recRecomendaciones']; if(ids.includes(e.target?.id || '') && el('recetaPreview')){ clearTimeout(window.__auroRecetaPreviewTimer); window.__auroRecetaPreviewTimer = setTimeout(window.vistaPreviaReceta, 250); } });
  document.addEventListener('change', function(e){ const ids = ['recFecha','recEstado']; if(ids.includes(e.target?.id || '') && el('recetaPreview')) window.vistaPreviaReceta(); });

  window.cargarRecetasDesdeSheets = cargarRecetasDesdeSheets;
  window.refrescarRecetasDesdeSheets = function(){
    return cargarRecetasDesdeSheets(true).then(function(){
      renderHistorialRecetas();
      actualizarBotonGuardarReceta();
      return leerRecetasStorage();
    });
  };
  window.__recetasAurosanaxDebug = function(){ return {version:'1.5', totalLocal: leerRecetasStorage().length, sheetsCargadas: recetasSheetsCargadas, sheetsCargando: recetasSheetsCargando, recetaEditandoId, recetaGuardando, recetaAtencionActualId, pacienteActivo: obtenerPacienteActivoSeguro()?.nombre || '', codigoMedico: obtenerCodigoCortoMedico(), idMedico: obtenerIdMedicoReal(), storageKey: STORAGE_KEY}; };
})();
