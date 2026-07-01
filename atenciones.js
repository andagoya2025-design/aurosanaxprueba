/* =====================================================
   AUROSANAX ERP - MÓDULO ATENCIONES
   Archivo: atenciones.js
   Versión: 2.0 responsive móvil tarjetas
   Objetivo:
   - Agregar historial de atenciones dentro de Historia Clínica.
   - Permitir iniciar y finalizar atención por paciente.
   - No modifica Agenda, Pacientes, Antecedentes, Examen Físico, Plan ni Recetas.
   - Guarda localmente y sincroniza con Google Sheets mediante Apps Script.
===================================================== */

(function(){
  'use strict';

  const MODULO = 'AUROSANAX_ATENCIONES_V2_0_MOBILE_CARDS';
  const STORAGE_KEY = 'aurosanax_atenciones_local_v1';

  let atencionActivaId = '';
  let consultasVisible = true;

  function $(id){ return document.getElementById(id); }

  function inyectarEstilosAtenciones(){
    if(document.getElementById('auroAtencionesResponsiveCSS')) return;

    const st = document.createElement('style');
    st.id = 'auroAtencionesResponsiveCSS';
    st.textContent = `
      #auroAtencionesBox .auro-atenciones-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      #auroAtencionesBox .auro-atencion-status{
        border-radius:14px;
        padding:10px 12px;
        margin-top:10px;
        font-size:14px;
      }

      #auroAtencionesBox .auro-atencion-status.abierta{
        background:#dcfce7;
        color:#166534;
        border:1px solid #bbf7d0;
      }

      #auroAtencionesBox .auro-atencion-status.cerrada{
        background:#f1f5f9;
        color:#334155;
        border:1px solid #e2e8f0;
      }

      #auroAtencionesBox .auro-table-mobile-note{
        display:none;
      }

      #auroAtencionesBox .auro-atenciones-mobile{
        display:none;
      }

      #auroAtencionesBox .auro-consulta-card{
        border:1px solid #e5e7eb;
        border-radius:14px;
        padding:12px;
        background:#fff;
        margin-bottom:10px;
      }

      #auroAtencionesBox .auro-consulta-card-head{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:flex-start;
        margin-bottom:8px;
      }

      @media (max-width: 768px){
        #auroAtencionesBox{
          padding:12px!important;
        }

        #auroAtencionesBox .auro-atenciones-header{
          flex-direction:column!important;
          align-items:stretch!important;
        }

        #auroAtencionesBox .auro-atenciones-title h5{
          font-size:16px!important;
          margin-bottom:2px!important;
        }

        #auroAtencionesBox .auro-atenciones-title h5 .desktop-title{
          display:none!important;
        }

        #auroAtencionesBox .auro-atenciones-title h5 .mobile-title{
          display:inline!important;
        }

        #auroAtencionesBox .auro-atenciones-actions{
          display:grid!important;
          grid-template-columns:1fr 1fr;
          gap:6px;
          width:100%;
        }

        #auroAtencionesBox .auro-atenciones-actions button{
          width:100%!important;
          font-size:12px!important;
          padding:7px 8px!important;
          white-space:normal!important;
          min-height:38px;
        }

        #auroAtencionesBox #btnFinalizarAtencion{
          grid-column: span 2;
        }

        #auroAtencionesBox .auro-atencion-status{
          font-size:12px!important;
          padding:8px 10px!important;
          line-height:1.35;
        }

        #auroAtencionesBox .auro-atenciones-desktop{
          display:none!important;
        }

        #auroAtencionesBox .auro-atenciones-mobile{
          display:block!important;
        }

        #auroAtencionesBox .auro-consulta-card{
          font-size:12px;
        }

        #auroAtencionesBox .auro-consulta-card .btn-action{
          width:100%;
          margin-top:6px;
        }

        #auroAtencionesBox .auro-table-mobile-note{
          display:none!important;
        }

        #auroAtencionesBox #auroAtencionActivaBox .row > div{
          font-size:12px;
        }

        #auroAtencionesBox #auroAtencionActivaBox table{
          min-width:650px;
          font-size:12px;
        }
      }

      @media (min-width: 769px){
        #auroAtencionesBox .auro-atenciones-title h5 .mobile-title{
          display:none!important;
        }
        #auroAtencionesBox .auro-atenciones-desktop{
          display:block!important;
        }
        #auroAtencionesBox .auro-atenciones-mobile{
          display:none!important;
        }
      }
    `;
    document.head.appendChild(st);
  }


  function safe(v){
    return String(v || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function fechaHoyISO(){
    if(typeof window.fechaHoyISO === 'function'){
      try{ return window.fechaHoyISO(); }catch(e){}
    }
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function horaActual(){
    const d = new Date();
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  function fechaHora(){
    const d = new Date();
    return d.toLocaleString('es-EC', {
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    });
  }

  function fechaVisual(fecha){
    if(!fecha) return '—';
    const s = String(fecha);
    if(/^\d{4}-\d{2}-\d{2}/.test(s)){
      const p = s.slice(0,10).split('-');
      return p[2] + '/' + p[1] + '/' + p[0];
    }
    return s;
  }

  function leerLocal(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      console.warn(MODULO, 'No se pudo leer localStorage.', e);
      return [];
    }
  }

  function guardarLocal(arr){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
    }catch(e){
      console.warn(MODULO, 'No se pudo guardar localStorage.', e);
    }
  }


  async function enviarAtencionGoogleSheets(atencion){
    try{
      if(!atencion) return { success:false, message:'No hay atención para enviar' };
      if(typeof API_URL === 'undefined' || !API_URL){
        return { success:false, message:'API_URL no está definida en index.html' };
      }

      const payload = {
        accion: 'guardarAtencion',
        data: {
          id_atencion: atencion.id_atencion || '',
          numero_consulta: Number(atencion.numero_consulta || siguienteConsulta(atencion.id_paciente || idPacienteActivo()) || 1),
          id_paciente: atencion.id_paciente || '',
          id_cita: atencion.id_cita || '',
          id_historia: atencion.id_historia || obtenerIdHistoriaActual() || '',
          id_medico: atencion.id_medico || medicoActual(),
          fecha_atencion: atencion.fecha_atencion || fechaHoyISO(),
          hora_atencion: atencion.hora_atencion || horaActual(),
          tipo_atencion: atencion.tipo_atencion || '',
          estado_atencion: atencion.estado_atencion || 'Finalizada',
          creado_por: atencion.creado_por || usuarioActual(),
          creado_en: atencion.creado_en || fechaHora(),
          actualizado_en: atencion.actualizado_en || fechaHora()
        }
      };

      const res = await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      return { success:true, message:'Atención enviada a Google Sheets' };

    }catch(error){
      console.error(MODULO, 'Error enviando atención a Google Sheets:', error);
      return { success:false, message:error.message };
    }
  }

  function pacienteActivo(){
    try{
      if(typeof window.getPacienteActivo === 'function') return window.getPacienteActivo();
    }catch(e){}
    return null;
  }

  function idPacienteActivo(){

    try{

      const p = pacienteActivo();

      if(p && (p.id_paciente || p.id || p.cedula)){
        return String(p.id_paciente || p.id || p.cedula);
      }

      if(window.activePatientId) return String(window.activePatientId);
      if(window.currentPatientId) return String(window.currentPatientId);

      if(window.pacienteActivo &&
         (window.pacienteActivo.id_paciente || window.pacienteActivo.id || window.pacienteActivo.cedula)){
        return String(
          window.pacienteActivo.id_paciente ||
          window.pacienteActivo.id ||
          window.pacienteActivo.cedula
        );
      }

      if(window.historiaActual &&
         (window.historiaActual.id_paciente || window.historiaActual.paciente_id || window.historiaActual.cedula)){
        return String(
          window.historiaActual.id_paciente ||
          window.historiaActual.paciente_id ||
          window.historiaActual.cedula
        );
      }

      if(window.currentHistoria &&
         (window.currentHistoria.id_paciente || window.currentHistoria.paciente_id || window.currentHistoria.cedula)){
        return String(
          window.currentHistoria.id_paciente ||
          window.currentHistoria.paciente_id ||
          window.currentHistoria.cedula
        );
      }

      const sel = $('hcPacienteSelect');
      if(sel && sel.value) return String(sel.value);

    }catch(e){
      console.warn(MODULO,'Error obteniendo paciente activo',e);
    }

    return '';
  }

  function medicoActual(){
    return 'Dra. Aurora Andagoya';
  }

  function usuarioActual(){
    return 'AUROSANAX ERP';
  }

  function idNuevo(){
    const d = new Date();
    const stamp =
      d.getFullYear() +
      String(d.getMonth()+1).padStart(2,'0') +
      String(d.getDate()).padStart(2,'0') +
      String(d.getHours()).padStart(2,'0') +
      String(d.getMinutes()).padStart(2,'0') +
      String(d.getSeconds()).padStart(2,'0');
    return 'ATN-' + stamp + '-' + Math.floor(Math.random()*900+100);
  }

  function normalizar(a){
    return {
      id_atencion: a.id_atencion || idNuevo(),
      numero_consulta: Number(a.numero_consulta || 0),
      id_paciente: a.id_paciente || '',
      id_cita: a.id_cita || '',
      id_historia: a.id_historia || '',
      id_medico: a.id_medico || medicoActual(),
      fecha_atencion: a.fecha_atencion || fechaHoyISO(),
      hora_atencion: a.hora_atencion || horaActual(),
      tipo_atencion: a.tipo_atencion || '',
      estado_atencion: a.estado_atencion || 'Abierta',
      creado_por: a.creado_por || usuarioActual(),
      creado_en: a.creado_en || fechaHora(),
      actualizado_en: a.actualizado_en || fechaHora()
    };
  }

  function atencionesPaciente(idPaciente){
    const id = idPaciente || idPacienteActivo();
    if(!id) return [];

    return leerLocal()
      .map(normalizar)
      .filter(a => String(a.id_paciente) === String(id))
      .sort((a,b) => {
        const na = Number(a.numero_consulta || 0);
        const nb = Number(b.numero_consulta || 0);
        if(na !== nb) return nb - na;
        return String(b.fecha_atencion + ' ' + b.hora_atencion).localeCompare(String(a.fecha_atencion + ' ' + a.hora_atencion));
      });
  }

  function atencionAbierta(idPaciente){
    return atencionesPaciente(idPaciente).find(a => String(a.estado_atencion).toLowerCase() === 'abierta') || null;
  }

  function siguienteConsulta(idPaciente){
    return atencionesPaciente(idPaciente).reduce((m,a) => Math.max(m, Number(a.numero_consulta || 0)), 0) + 1;
  }


  function obtenerIdHistoriaActual(){
    try{
      if(window.editingHistoryId){
        return String(window.editingHistoryId);
      }

      if(window.historiaActual && (window.historiaActual.id_historia || window.historiaActual.id)){
        return String(window.historiaActual.id_historia || window.historiaActual.id);
      }

      if(window.currentHistoria && (window.currentHistoria.id_historia || window.currentHistoria.id)){
        return String(window.currentHistoria.id_historia || window.currentHistoria.id);
      }

      const paciente = pacienteActivo();
      const idPaciente = paciente && (paciente.id_paciente || paciente.id || paciente.cedula)
        ? String(paciente.id_paciente || paciente.id || paciente.cedula)
        : '';

      if(idPaciente && Array.isArray(window.historiasClinicas)){
        const lista = window.historiasClinicas
          .filter(h => String(h.id_paciente || h.paciente_id || h.cedula || '') === idPaciente)
          .sort((a,b) => String(b.actualizado_en || b.creado_en || b.fecha_apertura || '').localeCompare(String(a.actualizado_en || a.creado_en || a.fecha_apertura || '')));

        if(lista.length){
          return String(lista[0].id_historia || lista[0].id || '');
        }
      }
    }catch(e){
      console.warn(MODULO, 'No se pudo obtener id_historia actual.', e);
    }

    return '';
  }

  function normalizarTextoSimple(valor){
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function obtenerDocumentoPacienteActivo(){
    const p = pacienteActivo();
    return p ? String(p.numero_documento || p.cedula || p.documento || '').replace(/\D/g,'') : '';
  }

  function buscarCitaAtendidaHoy(idPaciente){
    try{
      const citas = Array.isArray(window.citasAgendaWeb) ? window.citasAgendaWeb : [];
      const hoy = fechaHoyISO();
      const p = pacienteActivo();
      const docPaciente = obtenerDocumentoPacienteActivo();
      const nombrePaciente = normalizarTextoSimple(p ? (p.nombre || ((p.nombres || '') + ' ' + (p.apellidos || ''))) : '');

      return citas.find(c => {
        const estado = normalizarTextoSimple(c.estado || c.estado_cita || '');
        const fecha = String(c.fecha_deseada || c.fecha_cita || c.fecha || '').slice(0,10);

        const cid = String(c.id_paciente || c.paciente_id || '').trim();
        const cdoc = String(c.numero_documento || c.cedula || c.documento || '').replace(/\D/g,'');
        const cnombre = normalizarTextoSimple(c.nombre || c.paciente || c.nombre_completo || '');

        const coincidePaciente =
          (cid && String(cid) === String(idPaciente)) ||
          (docPaciente && cdoc && docPaciente === cdoc) ||
          (nombrePaciente && cnombre && nombrePaciente === cnombre);

        return coincidePaciente &&
               fecha === hoy &&
               estado.includes('atendid');
      }) || null;
    }catch(e){
      console.warn(MODULO, 'No se pudo buscar cita atendida de hoy.', e);
      return null;
    }
  }

  function crearAtencion(){
    const p = pacienteActivo();
    const idPaciente = idPacienteActivo();

    if(!idPaciente){
      setTimeout(function(){
        const nuevoId = idPacienteActivo();
        if(nuevoId) renderAtencionesPaciente();
      },300);
    }

    if(!p || !idPaciente){
      alert('Seleccione primero un paciente desde Pacientes o Historia Clínica.');
      return null;
    }

    const abierta = atencionAbierta(idPaciente);
    if(abierta){
      atencionActivaId = abierta.id_atencion;
      renderAtencionesPaciente();
      alert('Este paciente ya tiene una atención abierta.');
      return abierta;
    }

    const cita = buscarCitaAtendidaHoy(idPaciente);
    const num = siguienteConsulta(idPaciente);

    const nueva = normalizar({
      id_atencion: idNuevo(),
      numero_consulta: num,
      id_paciente: idPaciente,
      id_cita: cita ? (cita.id_cita || cita.id || cita.id_cita_web || cita.fila_origen || '') : '',
      id_historia: obtenerIdHistoriaActual(),
      id_medico: cita ? (cita.id_medico || medicoActual()) : medicoActual(),
      fecha_atencion: cita ? String(cita.fecha_deseada || cita.fecha_cita || fechaHoyISO()).slice(0,10) : fechaHoyISO(),
      hora_atencion: cita ? (cita.hora_deseada || cita.hora_inicio || horaActual()) : horaActual(),
      tipo_atencion: num === 1 ? 'Primera vez' : 'Control',
      estado_atencion: 'Abierta',
      creado_por: usuarioActual(),
      creado_en: fechaHora(),
      actualizado_en: fechaHora()
    });

    const lista = leerLocal();
    lista.unshift(nueva);
    guardarLocal(lista);
    atencionActivaId = nueva.id_atencion;
    renderAtencionesPaciente();
    return nueva;
  }

  async function finalizarAtencion(){
    const idPaciente = idPacienteActivo();
    if(!idPaciente){
      alert('Seleccione primero un paciente.');
      return;
    }

    const abierta = atencionAbierta(idPaciente);
    if(!abierta){
      alert('No hay atención abierta para finalizar.');
      return;
    }

    if(!confirm('¿Finalizar la atención actual? Quedará registrada como consulta histórica.')) return;

    const lista = leerLocal();
    const idx = lista.findIndex(a => String(a.id_atencion) === String(abierta.id_atencion));

    let atencionFinalizada = null;

    if(idx >= 0){
      atencionFinalizada = Object.assign({}, lista[idx], {
        numero_consulta: Number(lista[idx].numero_consulta || abierta.numero_consulta || siguienteConsulta(idPaciente) || 1),
        estado_atencion: 'Finalizada',
        actualizado_en: fechaHora()
      });

      lista[idx] = atencionFinalizada;
      guardarLocal(lista);
    }else{
      atencionFinalizada = Object.assign({}, abierta, {
        numero_consulta: Number(abierta.numero_consulta || siguienteConsulta(idPaciente) || 1),
        estado_atencion: 'Finalizada',
        actualizado_en: fechaHora()
      });
    }

    atencionActivaId = '';
    renderAtencionesPaciente();

    const resultado = await enviarAtencionGoogleSheets(atencionFinalizada);

    if(resultado && resultado.success){
      alert('Atención finalizada y enviada a Google Sheets.');
    }else{
      alert('Atención finalizada localmente, pero no se pudo enviar a Google Sheets. Revise Apps Script o conexión.');
    }
  }


  function leerRecetasLocales(){
    try{
      const raw = localStorage.getItem('aurosanax_recetas_emitidas_v1');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      console.warn(MODULO, 'No se pudo leer recetas locales.', e);
      return [];
    }
  }

  function recetasPorAtencion(idAtencion){
    if(!idAtencion) return [];
    return leerRecetasLocales().filter(r => String(r.id_atencion || '') === String(idAtencion));
  }

  function resumenTexto(valor, max){
    const txt = String(valor || '').replace(/\s+/g, ' ').trim();
    if(!txt) return '—';
    return txt.length > max ? txt.slice(0, max) + '...' : txt;
  }

  function ocultarDetalleAtencion(){
    const box = $('auroAtencionActivaBox');
    if(box){
      box.style.display = 'none';
      box.innerHTML = '';
    }
    atencionActivaId = '';
  }

  function renderDetalleAtencion(a){
    const box = $('auroAtencionActivaBox');
    if(!box || !a) return;

    const recetas = recetasPorAtencion(a.id_atencion);

    let recetasHTML = '';
    if(recetas.length){
      recetasHTML =
        '<div class="mt-3">' +
          '<div class="fw-bold mb-2"><i class="bi bi-prescription2 me-1"></i> Recetas asociadas a esta atención</div>' +
          '<div class="table-responsive">' +
          '<table class="table table-modern align-middle mb-0">' +
          '<thead><tr><th>Fecha</th><th>CIE-10</th><th>Medicamento</th><th>Indicaciones</th><th>Estado</th></tr></thead>' +
          '<tbody>' +
          recetas.map(r => {
            return '<tr>' +
              '<td>' + safe(fechaVisual(r.fecha_receta || r.fecha || '')) + '</td>' +
              '<td>' + safe(r.diagnostico_cie10 || r.cie10 || '—') + '</td>' +
              '<td>' + safe(resumenTexto(r.medicamento || r.medicamentos || '', 120)) + '</td>' +
              '<td>' + safe(resumenTexto(r.indicaciones || '', 100)) + '</td>' +
              '<td><span class="badge-auro badge-ok">' + safe(r.estado || 'Emitida') + '</span></td>' +
            '</tr>';
          }).join('') +
          '</tbody></table></div>' +
        '</div>';
    }else{
      recetasHTML =
        '<div class="sheet-note mt-3">' +
          '<i class="bi bi-info-circle me-1"></i> Esta atención aún no tiene recetas asociadas.' +
        '</div>';
    }

    box.style.display = 'block';
    box.innerHTML =
      '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">' +
        '<div>' +
          '<div class="fw-bold"><i class="bi bi-eye me-1"></i> Consulta #' + safe(a.numero_consulta) + '</div>' +
          '<div class="text-muted small">ID atención: ' + safe(a.id_atencion || '—') + '</div>' +
        '</div>' +
        '<div class="d-flex gap-2 align-items-center flex-wrap">' +
          '<span class="badge-auro ' + (String(a.estado_atencion).toLowerCase() === 'abierta' ? 'badge-blue' : 'badge-ok') + '">' +
            safe(a.estado_atencion || '—') +
          '</span>' +
          '<button type="button" class="btn-action soft" id="btnOcultarDetalleAtencion">Ocultar</button>' +
        '</div>' +
      '</div>' +
      '<div class="row g-2 mt-2">' +
        '<div class="col-md-3"><b>Fecha:</b><br>' + safe(fechaVisual(a.fecha_atencion)) + '</div>' +
        '<div class="col-md-3"><b>Hora:</b><br>' + safe(a.hora_atencion || '—') + '</div>' +
        '<div class="col-md-3"><b>Tipo:</b><br>' + safe(a.tipo_atencion || '—') + '</div>' +
        '<div class="col-md-3"><b>Médico:</b><br>' + safe(a.id_medico || '—') + '</div>' +
        '<div class="col-md-6"><b>ID historia:</b><br>' + safe(a.id_historia || '—') + '</div>' +
        '<div class="col-md-6"><b>ID cita:</b><br>' + safe(a.id_cita || '—') + '</div>' +
      '</div>' +
      recetasHTML;

    const btnOcultar = $('btnOcultarDetalleAtencion');
    if(btnOcultar) btnOcultar.addEventListener('click', ocultarDetalleAtencion);
  }

  function seleccionarAtencion(idAtencion){
    const a = leerLocal().find(x => String(x.id_atencion) === String(idAtencion));
    if(!a){
      alert('No se encontró la atención seleccionada.');
      return;
    }

    atencionActivaId = a.id_atencion;
    renderDetalleAtencion(normalizar(a));
  }

  function asegurarBloque(){
    const historia = $('historia');
    const cardPaciente = $('hcPatientCard');

    if(!historia || !cardPaciente) return null;

    let box = $('auroAtencionesBox');
    if(box) return box;

    box = document.createElement('div');
    box.id = 'auroAtencionesBox';
    box.className = 'cardx p-3 mb-3';
    box.innerHTML =
      '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap auro-atenciones-header">' +
        '<div class="auro-atenciones-title">' +
          '<h5 class="fw-bold mb-1"><i class="bi bi-journal-medical me-1"></i> <span class="desktop-title">Historial de atenciones</span><span class="mobile-title">Atenciones</span></h5>' +
          '<div class="text-muted small" id="auroAtencionesResumen">Seleccione un paciente para ver sus atenciones.</div>' +
        '</div>' +
        '<div class="auro-atenciones-actions">' +
          '<button type="button" class="btn-soft" id="btnToggleConsultasAtencion"><i class="bi bi-eye-slash me-1"></i> Ocultar consultas</button>' +
          '<button type="button" class="btn-soft" id="btnIniciarAtencion"><i class="bi bi-play-circle me-1"></i> Iniciar</button>' +
          '<button type="button" class="btn-auro" id="btnFinalizarAtencion"><i class="bi bi-check-circle me-1"></i> Finalizar</button>' +
        '</div>' +
      '</div>' +
      '<div id="auroAtencionActivaBox" class="mt-3" style="display:none;"></div>' +
      '<div id="auroAtencionesLista" class="mt-3"></div>';

    cardPaciente.parentNode.insertBefore(box, cardPaciente.nextSibling);

    const btnToggleConsultas = $('btnToggleConsultasAtencion');
    const btnIniciar = $('btnIniciarAtencion');
    const btnFinalizar = $('btnFinalizarAtencion');

    if(btnToggleConsultas) btnToggleConsultas.addEventListener('click', function(){
      consultasVisible = !consultasVisible;
      renderAtencionesPaciente();
    });

    if(btnIniciar) btnIniciar.addEventListener('click', crearAtencion);
    if(btnFinalizar) btnFinalizar.addEventListener('click', finalizarAtencion);

    return box;
  }

  function renderAtencionesPaciente(){
    asegurarBloque();

    const idPaciente = idPacienteActivo();
    const resumen = $('auroAtencionesResumen');
    const lista = $('auroAtencionesLista');
    const activaBox = $('auroAtencionActivaBox');
    const btnToggleConsultas = $('btnToggleConsultasAtencion');
    const btnIniciar = $('btnIniciarAtencion');
    const btnFinalizar = $('btnFinalizarAtencion');

    if(!resumen || !lista) return;

    if(!idPaciente){
      resumen.textContent = 'Seleccione un paciente para iniciar o revisar atenciones.';
      lista.innerHTML = '<div class="text-muted small">Sin paciente activo.</div>';
      if(activaBox) activaBox.style.display = 'none';
      if(btnToggleConsultas) btnToggleConsultas.disabled = true;
      if(btnIniciar) btnIniciar.disabled = true;
      if(btnFinalizar) btnFinalizar.disabled = true;
      return;
    }

    const arr = atencionesPaciente(idPaciente);
    const abierta = atencionAbierta(idPaciente);

    if(btnToggleConsultas){
      btnToggleConsultas.disabled = false;
      btnToggleConsultas.innerHTML = consultasVisible
        ? '<i class="bi bi-eye-slash me-1"></i> Ocultar consultas'
        : '<i class="bi bi-eye me-1"></i> Mostrar consultas';
    }


    if(btnIniciar){
      btnIniciar.disabled = !!abierta;
      btnIniciar.style.opacity = abierta ? '0.55' : '1';
      btnIniciar.style.cursor = abierta ? 'not-allowed' : 'pointer';
    }

    if(btnFinalizar){
      btnFinalizar.disabled = !abierta;
      btnFinalizar.style.opacity = abierta ? '1' : '0.55';
      btnFinalizar.style.cursor = abierta ? 'pointer' : 'not-allowed';
      btnFinalizar.innerHTML = abierta
        ? '<i class="bi bi-check-circle me-1"></i> Finalizar'
        : '<i class="bi bi-lock me-1"></i> Cerrada ✓';
    }

    resumen.textContent = 'Total consultas: ' + arr.length + (arr[0] ? ' · Última: ' + fechaVisual(arr[0].fecha_atencion) : '');

    if(activaBox){
      activaBox.style.display = 'block';
      if(abierta){
        activaBox.innerHTML =
          '<div class="auro-atencion-status abierta">' +
          '<b>🟢 ABIERTA</b> · Consulta #' + safe(abierta.numero_consulta) + '<br>' +
          '<span>' + safe(fechaVisual(abierta.fecha_atencion)) + ' ' + safe(abierta.hora_atencion) + '</span>' +
          '</div>';
      }else{
        activaBox.innerHTML =
          '<div class="auro-atencion-status cerrada">' +
          '<b>🔵 FINALIZADA</b> · Sin consulta abierta' +
          '</div>';
      }
    }

    if(!consultasVisible){
      lista.innerHTML = '<div class="sheet-note mt-2"><i class="bi bi-eye-slash me-1"></i> Consultas ocultas. Presione <b>Mostrar consultas</b> para verlas.</div>';
      return;
    }

    if(!arr.length){
      lista.innerHTML = '<div class="text-muted small">Este paciente aún no tiene atenciones registradas.</div>';
      return;
    }

    const filasTabla = arr.map(a => {
      const badge = String(a.estado_atencion).toLowerCase() === 'abierta' ? 'badge-blue' : 'badge-ok';
      return '<tr>' +
        '<td><b>#' + safe(a.numero_consulta) + '</b></td>' +
        '<td>' + safe(fechaVisual(a.fecha_atencion)) + '</td>' +
        '<td>' + safe(a.hora_atencion || '—') + '</td>' +
        '<td>' + safe(a.tipo_atencion || '—') + '</td>' +
        '<td><span class="badge-auro ' + badge + '">' + safe(a.estado_atencion || '—') + '</span></td>' +
        '<td><button type="button" class="btn-action primary" data-atencion-id="' + safe(a.id_atencion) + '">Ver</button></td>' +
      '</tr>';
    }).join('');

    const tarjetasMovil = arr.map(a => {
      const badge = String(a.estado_atencion).toLowerCase() === 'abierta' ? 'badge-blue' : 'badge-ok';
      return '<div class="auro-consulta-card">' +
        '<div class="auro-consulta-card-head">' +
          '<div><b>Consulta #' + safe(a.numero_consulta) + '</b><br><small class="text-muted">' + safe(fechaVisual(a.fecha_atencion)) + ' · ' + safe(a.hora_atencion || '—') + '</small></div>' +
          '<span class="badge-auro ' + badge + '">' + safe(a.estado_atencion || '—') + '</span>' +
        '</div>' +
        '<div class="small"><b>Tipo:</b> ' + safe(a.tipo_atencion || '—') + '</div>' +
        '<button type="button" class="btn-action primary" data-atencion-id="' + safe(a.id_atencion) + '">Ver consulta</button>' +
      '</div>';
    }).join('');

    lista.innerHTML =
      '<div class="auro-atenciones-desktop">' +
        '<div class="table-responsive">' +
          '<table class="table table-modern align-middle mb-0">' +
            '<thead><tr><th>Consulta</th><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Estado</th><th>Acción</th></tr></thead>' +
            '<tbody>' + filasTabla + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="auro-atenciones-mobile">' + tarjetasMovil + '</div>';

    lista.querySelectorAll('[data-atencion-id]').forEach(btn => {
      btn.addEventListener('click', function(){
        seleccionarAtencion(this.getAttribute('data-atencion-id'));
      });
    });
  }

  function iniciarModulo(){
    inyectarEstilosAtenciones();
    asegurarBloque();
    renderAtencionesPaciente();
  }

  function envolverFuncion(nombre, despues){
    const original = window[nombre];
    if(typeof original !== 'function' || original.__auroAtencionesWrapped) return;

    const nueva = function(){
      const r = original.apply(this, arguments);
      setTimeout(despues, 120);
      return r;
    };

    nueva.__auroAtencionesWrapped = true;
    window[nombre] = nueva;
  }

  document.addEventListener('DOMContentLoaded', function(){

    setTimeout(function(){

      iniciarModulo();

      envolverFuncion('showScreen', function(){
        if($('historia') && $('historia').classList.contains('active')){
          setTimeout(renderAtencionesPaciente,300);
          setTimeout(renderAtencionesPaciente,700);
        }
      });

      envolverFuncion('seleccionarPacienteHistoria', function(){
        setTimeout(renderAtencionesPaciente,100);
        setTimeout(renderAtencionesPaciente,400);
        setTimeout(renderAtencionesPaciente,900);
      });

      envolverFuncion('actualizarTarjetaPacienteHistoria', function(){
        setTimeout(renderAtencionesPaciente,100);
        setTimeout(renderAtencionesPaciente,400);
      });

      envolverFuncion('abrirHistoriaPaciente', function(){
        setTimeout(renderAtencionesPaciente,300);
        setTimeout(renderAtencionesPaciente,800);
      });

    },700);

  });

  });

  window.sincronizarAtencionesLocales = async function(){
    const lista = leerLocal();
    if(!lista.length){
      alert('No hay atenciones locales para sincronizar.');
      return;
    }

    let ok = 0;
    let fail = 0;

    for(const item of lista){
      const r = await enviarAtencionGoogleSheets(normalizar(item));
      if(r && r.success) ok++;
      else fail++;
    }

    alert('Sincronización terminada. Enviadas: ' + ok + '. Fallidas: ' + fail + '.');
  };

  window.renderAtencionesPaciente = renderAtencionesPaciente;
  window.iniciarAtencionActual = crearAtencion;
  window.finalizarAtencionActual = finalizarAtencion;
  window.seleccionarAtencion = seleccionarAtencion;
  window.getAtencionActiva = function(){
    if(!atencionActivaId) return null;
    return leerLocal().find(a => String(a.id_atencion) === String(atencionActivaId)) || null;
  };
  window.getIdAtencionActiva = function(){
    const a = window.getAtencionActiva();
    return a ? a.id_atencion : '';
  };
  window.__atencionesAurosanaxDebug = function(){
    return {
      modulo: MODULO,
      total: leerLocal().length,
      paciente_activo: idPacienteActivo(),
      atencion_activa: window.getAtencionActiva()
    };
  };

})();
