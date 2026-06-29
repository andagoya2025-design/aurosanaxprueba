/* =====================================================
   AUROSANAX ERP - MÓDULO ATENCIONES
   Archivo: atenciones.js
   Versión: 1.1 segura
   Objetivo:
   - Agregar historial de atenciones dentro de Historia Clínica.
   - Permitir iniciar y finalizar atención por paciente.
   - No modifica Agenda, Pacientes, Antecedentes, Examen Físico, Plan ni Recetas.
   - Primera fase: almacenamiento local de prueba para validar flujo.
===================================================== */

(function(){
  'use strict';

  const MODULO = 'AUROSANAX_ATENCIONES_V1_1';
  const STORAGE_KEY = 'aurosanax_atenciones_local_v1';

  let atencionActivaId = '';

  function $(id){ return document.getElementById(id); }

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

  function pacienteActivo(){
    try{
      if(typeof window.getPacienteActivo === 'function') return window.getPacienteActivo();
    }catch(e){}
    return null;
  }

  function idPacienteActivo(){
    const p = pacienteActivo();
    return p && (p.id_paciente || p.id || p.cedula) ? String(p.id_paciente || p.id || p.cedula) : '';
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

  function buscarCitaAtendidaHoy(idPaciente){
    try{
      const citas = Array.isArray(window.citasAgendaWeb) ? window.citasAgendaWeb : [];
      const hoy = fechaHoyISO();
      return citas.find(c => {
        const cid = c.id_paciente || c.paciente_id || c.cedula || '';
        const fecha = c.fecha_deseada || c.fecha_cita || c.fecha || '';
        const estado = String(c.estado || c.estado_cita || '').toLowerCase();
        return String(cid) === String(idPaciente) &&
               String(fecha).slice(0,10) === hoy &&
               estado.includes('atendid');
      }) || null;
    }catch(e){
      return null;
    }
  }

  function crearAtencion(){
    const p = pacienteActivo();
    const idPaciente = idPacienteActivo();

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
      id_cita: cita ? (cita.id_cita || cita.id || '') : '',
      id_historia: window.editingHistoryId || '',
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

  function finalizarAtencion(){
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
    if(idx >= 0){
      lista[idx] = Object.assign({}, lista[idx], {
        estado_atencion: 'Finalizada',
        actualizado_en: fechaHora()
      });
      guardarLocal(lista);
    }

    atencionActivaId = '';
    renderAtencionesPaciente();
  }

  function seleccionarAtencion(idAtencion){
    const a = leerLocal().find(x => String(x.id_atencion) === String(idAtencion));
    if(!a){
      alert('No se encontró la atención seleccionada.');
      return;
    }

    atencionActivaId = a.id_atencion;
    const box = $('auroAtencionActivaBox');
    if(box){
      box.style.display = 'block';
      box.innerHTML = '<i class="bi bi-eye me-1"></i> Visualizando Consulta #' +
        safe(a.numero_consulta) + ' · ' + safe(fechaVisual(a.fecha_atencion)) +
        ' · Estado: <b>' + safe(a.estado_atencion) + '</b>';
    }
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
      '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">' +
        '<div>' +
          '<h5 class="fw-bold mb-1"><i class="bi bi-journal-medical me-1"></i> Historial de atenciones</h5>' +
          '<div class="text-muted small" id="auroAtencionesResumen">Seleccione un paciente para ver sus atenciones.</div>' +
        '</div>' +
        '<div class="d-flex gap-2 flex-wrap">' +
          '<button type="button" class="btn-soft" id="btnIniciarAtencion"><i class="bi bi-play-circle me-1"></i> Iniciar atención</button>' +
          '<button type="button" class="btn-auro" id="btnFinalizarAtencion"><i class="bi bi-check-circle me-1"></i> Finalizar atención</button>' +
        '</div>' +
      '</div>' +
      '<div id="auroAtencionActivaBox" class="sheet-note mt-3" style="display:none;"></div>' +
      '<div id="auroAtencionesLista" class="mt-3"></div>';

    cardPaciente.parentNode.insertBefore(box, cardPaciente.nextSibling);

    const btnIniciar = $('btnIniciarAtencion');
    const btnFinalizar = $('btnFinalizarAtencion');

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
    const btnIniciar = $('btnIniciarAtencion');
    const btnFinalizar = $('btnFinalizarAtencion');

    if(!resumen || !lista) return;

    if(!idPaciente){
      resumen.textContent = 'Seleccione un paciente para iniciar o revisar atenciones.';
      lista.innerHTML = '<div class="text-muted small">Sin paciente activo.</div>';
      if(activaBox) activaBox.style.display = 'none';
      if(btnIniciar) btnIniciar.disabled = true;
      if(btnFinalizar) btnFinalizar.disabled = true;
      return;
    }

    const arr = atencionesPaciente(idPaciente);
    const abierta = atencionAbierta(idPaciente);

    if(btnIniciar) btnIniciar.disabled = !!abierta;
    if(btnFinalizar) btnFinalizar.disabled = !abierta;

    resumen.textContent = 'Total consultas: ' + arr.length + (arr[0] ? ' · Última: ' + fechaVisual(arr[0].fecha_atencion) : '');

    if(activaBox){
      activaBox.style.display = 'block';
      if(abierta){
        activaBox.innerHTML = '<i class="bi bi-play-circle me-1"></i> Atención abierta: <b>Consulta #' +
          safe(abierta.numero_consulta) + '</b> · ' + safe(fechaVisual(abierta.fecha_atencion)) + ' ' + safe(abierta.hora_atencion);
      }else{
        activaBox.innerHTML = '<i class="bi bi-info-circle me-1"></i> No hay atención abierta para este paciente. Presione <b>Iniciar atención</b> al comenzar la consulta.';
      }
    }

    if(!arr.length){
      lista.innerHTML = '<div class="text-muted small">Este paciente aún no tiene atenciones registradas.</div>';
      return;
    }

    lista.innerHTML =
      '<div class="table-responsive">' +
      '<table class="table table-modern align-middle mb-0">' +
      '<thead><tr><th>Consulta</th><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Estado</th><th>Acción</th></tr></thead>' +
      '<tbody>' +
      arr.map(a => {
        const badge = String(a.estado_atencion).toLowerCase() === 'abierta' ? 'badge-blue' : 'badge-ok';
        return '<tr>' +
          '<td><b>#' + safe(a.numero_consulta) + '</b></td>' +
          '<td>' + safe(fechaVisual(a.fecha_atencion)) + '</td>' +
          '<td>' + safe(a.hora_atencion || '—') + '</td>' +
          '<td>' + safe(a.tipo_atencion || '—') + '</td>' +
          '<td><span class="badge-auro ' + badge + '">' + safe(a.estado_atencion || '—') + '</span></td>' +
          '<td><button type="button" class="btn-action primary" data-atencion-id="' + safe(a.id_atencion) + '">Ver</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';

    lista.querySelectorAll('[data-atencion-id]').forEach(btn => {
      btn.addEventListener('click', function(){
        seleccionarAtencion(this.getAttribute('data-atencion-id'));
      });
    });
  }

  function iniciarModulo(){
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
        if($('historia') && $('historia').classList.contains('active')) iniciarModulo();
      });
      envolverFuncion('seleccionarPacienteHistoria', renderAtencionesPaciente);
      envolverFuncion('actualizarTarjetaPacienteHistoria', renderAtencionesPaciente);
    }, 700);
  });

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
