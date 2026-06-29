/* =====================================================
   AUROSANAX ERP - MÓDULO ATENCIONES
   Archivo: atenciones.js
   Versión: 1.0
   Función:
   - Crear y manejar atenciones médicas por paciente.
   - Mostrar historial de atenciones dentro de Historia Clínica.
   - No modifica Pacientes, Agenda, Antecedentes, Examen Físico, Plan ni Recetas.
   - Trabaja como capa clínica superior: Paciente → Cita → Atención → Historia/Plan/Receta.

   Requiere hoja Google Sheets:
   atenciones

   Columnas sugeridas:
   id_atencion | numero_consulta | id_paciente | id_cita | id_historia |
   id_medico | fecha_atencion | hora_atencion | tipo_atencion |
   estado_atencion | creado_por | creado_en | actualizado_en
===================================================== */

(function(){
  'use strict';

  const MODULO = 'AUROSANAX_ATENCIONES_V1';
  const STORAGE_KEY = 'aurosanax_atenciones_local_v1';

  let atencionActivaId = '';

  function el(id){ return document.getElementById(id); }

  function safe(text){
    return String(text || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function fechaHoyLocal(){
    if(typeof window.fechaHoyISO === 'function') return window.fechaHoyISO();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function horaActual(){
    const d = new Date();
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  function fechaHoraVisual(){
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

  function obtenerPacienteActivoSeguro(){
    try{
      if(typeof window.getPacienteActivo === 'function') return window.getPacienteActivo();
    }catch(e){}
    return null;
  }

  function obtenerIdPacienteActivo(){
    const p = obtenerPacienteActivoSeguro();
    return p?.id_paciente || p?.id || '';
  }

  function obtenerMedicoActual(){
    return 'MED-001';
  }

  function obtenerUsuarioActual(){
    return 'AUROSANAX ERP';
  }

  function crearIdAtencion(){
    const d = new Date();
    const stamp =
      d.getFullYear() +
      String(d.getMonth()+1).padStart(2,'0') +
      String(d.getDate()).padStart(2,'0') +
      String(d.getHours()).padStart(2,'0') +
      String(d.getMinutes()).padStart(2,'0') +
      String(d.getSeconds()).padStart(2,'0');
    return 'ATN-' + stamp + '-' + Math.floor(Math.random() * 900 + 100);
  }

  function leerAtencionesLocal(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      console.warn(MODULO, 'No se pudo leer atenciones local.', e);
      return [];
    }
  }

  function guardarAtencionesLocal(arr){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
    }catch(e){
      console.warn(MODULO, 'No se pudo guardar atenciones local.', e);
    }
  }

  function normalizarAtencion(a){
    return {
      id_atencion: a.id_atencion || a.id || crearIdAtencion(),
      numero_consulta: Number(a.numero_consulta || 0),
      id_paciente: a.id_paciente || '',
      id_cita: a.id_cita || '',
      id_historia: a.id_historia || '',
      id_medico: a.id_medico || obtenerMedicoActual(),
      fecha_atencion: a.fecha_atencion || fechaHoyLocal(),
      hora_atencion: a.hora_atencion || horaActual(),
      tipo_atencion: a.tipo_atencion || '',
      estado_atencion: a.estado_atencion || 'Abierta',
      creado_por: a.creado_por || obtenerUsuarioActual(),
      creado_en: a.creado_en || fechaHoraVisual(),
      actualizado_en: a.actualizado_en || fechaHoraVisual()
    };
  }

  function getAtencionesPaciente(idPaciente){
    const id = idPaciente || obtenerIdPacienteActivo();
    if(!id) return [];

    return leerAtencionesLocal()
      .map(normalizarAtencion)
      .filter(a => String(a.id_paciente) === String(id))
      .sort((a,b) => {
        const na = Number(a.numero_consulta || 0);
        const nb = Number(b.numero_consulta || 0);
        if(na !== nb) return nb - na;
        return String(b.fecha_atencion + ' ' + b.hora_atencion).localeCompare(String(a.fecha_atencion + ' ' + a.hora_atencion));
      });
  }

  function getAtencionAbiertaPaciente(idPaciente){
    return getAtencionesPaciente(idPaciente).find(a => String(a.estado_atencion || '').toLowerCase() === 'abierta') || null;
  }

  function calcularSiguienteNumeroConsulta(idPaciente){
    const atenciones = getAtencionesPaciente(idPaciente);
    const max = atenciones.reduce((m,a) => Math.max(m, Number(a.numero_consulta || 0)), 0);
    return max + 1;
  }

  function inferirTipoAtencion(numeroConsulta){
    return Number(numeroConsulta) <= 1 ? 'Primera vez' : 'Control';
  }

  function obtenerCitaAtendidaPacienteHoy(idPaciente){
    try{
      const citas = Array.isArray(window.citasAgendaWeb) ? window.citasAgendaWeb : [];
      const hoy = fechaHoyLocal();

      return citas.find(c => {
        const cid = c.id_paciente || c.paciente_id || '';
        const estado = String(c.estado || c.estado_cita || '').toLowerCase();
        const fecha = c.fecha_deseada || c.fecha_cita || c.fecha || '';
        return String(cid) === String(idPaciente) &&
               String(fecha).slice(0,10) === hoy &&
               estado.includes('atendida');
      }) || null;
    }catch(e){
      return null;
    }
  }

  function obtenerUltimaHistoriaPaciente(idPaciente){
    try{
      const historias = Array.isArray(window.historiasClinicas) ? window.historiasClinicas : [];
      return historias
        .filter(h => String(h.id_paciente || h.paciente_id || '') === String(idPaciente || ''))
        .sort((a,b) => String(b.actualizado_en || b.fecha_apertura || '').localeCompare(String(a.actualizado_en || a.fecha_apertura || '')))[0] || null;
    }catch(e){
      return null;
    }
  }

  function crearAtencionObjeto(){
    const paciente = obtenerPacienteActivoSeguro();
    const idPaciente = paciente?.id_paciente || paciente?.id || '';
    if(!idPaciente) return null;

    const cita = obtenerCitaAtendidaPacienteHoy(idPaciente);
    const historia = obtenerUltimaHistoriaPaciente(idPaciente);
    const numero = calcularSiguienteNumeroConsulta(idPaciente);

    return normalizarAtencion({
      id_atencion: crearIdAtencion(),
      numero_consulta: numero,
      id_paciente: idPaciente,
      id_cita: cita?.id_cita || cita?.id || '',
      id_historia: historia?.id_historia || historia?.id || '',
      id_medico: cita?.id_medico || obtenerMedicoActual(),
      fecha_atencion: String(cita?.fecha_deseada || cita?.fecha_cita || fechaHoyLocal()).slice(0,10),
      hora_atencion: cita?.hora_deseada || cita?.hora_inicio || horaActual(),
      tipo_atencion: inferirTipoAtencion(numero),
      estado_atencion: 'Abierta',
      creado_por: obtenerUsuarioActual(),
      creado_en: fechaHoraVisual(),
      actualizado_en: fechaHoraVisual()
    });
  }

  function asegurarBloqueAtenciones(){
    const historia = el('historia');
    if(!historia) return null;

    let box = el('auroAtencionesBox');
    if(box) return box;

    box = document.createElement('div');
    box.id = 'auroAtencionesBox';
    box.className = 'cardx p-3 mb-3';
    box.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <h5 class="fw-bold mb-1"><i class="bi bi-journal-medical me-1"></i> Historial de atenciones</h5>
          <div class="text-muted small" id="auroAtencionesResumen">Seleccione un paciente para ver sus atenciones.</div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button type="button" class="btn-soft" id="btnIniciarAtencion">
            <i class="bi bi-play-circle me-1"></i> Iniciar atención
          </button>
          <button type="button" class="btn-auro" id="btnFinalizarAtencion">
            <i class="bi bi-check-circle me-1"></i> Finalizar atención
          </button>
        </div>
      </div>
      <div id="auroAtencionActivaBox" class="sheet-note mt-3" style="display:none;"></div>
      <div id="auroAtencionesLista" class="mt-3"></div>
    `;

    const cardPaciente = el('hcPatientCard');
    if(cardPaciente && cardPaciente.parentNode){
      cardPaciente.parentNode.insertBefore(box, cardPaciente.nextSibling);
    }else{
      historia.querySelector('.cardx')?.prepend(box);
    }

    setTimeout(() => {
      el('btnIniciarAtencion')?.addEventListener('click', window.iniciarAtencionActual);
      el('btnFinalizarAtencion')?.addEventListener('click', window.finalizarAtencionActual);
    }, 0);

    return box;
  }

  function renderAtencionesPaciente(){
    asegurarBloqueAtenciones();

    const paciente = obtenerPacienteActivoSeguro();
    const idPaciente = paciente?.id_paciente || paciente?.id || '';

    const resumen = el('auroAtencionesResumen');
    const lista = el('auroAtencionesLista');
    const activaBox = el('auroAtencionActivaBox');
    const btnIniciar = el('btnIniciarAtencion');
    const btnFinalizar = el('btnFinalizarAtencion');

    if(!idPaciente){
      if(resumen) resumen.textContent = 'Seleccione un paciente para iniciar o revisar atenciones.';
      if(lista) lista.innerHTML = '<div class="text-muted small">Sin paciente activo.</div>';
      if(activaBox) activaBox.style.display = 'none';
      if(btnIniciar) btnIniciar.disabled = true;
      if(btnFinalizar) btnFinalizar.disabled = true;
      return;
    }

    if(btnIniciar) btnIniciar.disabled = false;

    const atenciones = getAtencionesPaciente(idPaciente);
    const abierta = getAtencionAbiertaPaciente(idPaciente);
    atencionActivaId = abierta?.id_atencion || atencionActivaId || '';

    if(resumen){
      const ultima = atenciones[0];
      resumen.textContent = `Total consultas: ${atenciones.length} ${ultima ? '· Última: ' + fechaVisual(ultima.fecha_atencion) : ''}`;
    }

    if(abierta){
      if(activaBox){
        activaBox.style.display = 'block';
        activaBox.innerHTML = `<i class="bi bi-play-circle me-1"></i> Atención abierta: <b>Consulta #${safe(abierta.numero_consulta)}</b> · ${safe(fechaVisual(abierta.fecha_atencion))} ${safe(abierta.hora_atencion || '')}`;
      }
      if(btnIniciar) btnIniciar.disabled = true;
      if(btnFinalizar) btnFinalizar.disabled = false;
    }else{
      if(activaBox){
        activaBox.style.display = 'block';
        activaBox.innerHTML = `<i class="bi bi-info-circle me-1"></i> No hay atención abierta para este paciente. Presione <b>Iniciar atención</b> cuando el médico comience la consulta.`;
      }
      if(btnFinalizar) btnFinalizar.disabled = true;
    }

    if(lista){
      if(!atenciones.length){
        lista.innerHTML = '<div class="text-muted small">Este paciente aún no tiene atenciones registradas.</div>';
      }else{
        lista.innerHTML = `
          <div class="table-responsive">
            <table class="table table-modern align-middle mb-0">
              <thead>
                <tr>
                  <th>Consulta</th>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${atenciones.map(a => `
                  <tr>
                    <td><b>#${safe(a.numero_consulta)}</b></td>
                    <td>${safe(fechaVisual(a.fecha_atencion))}</td>
                    <td>${safe(a.hora_atencion || '—')}</td>
                    <td>${safe(a.tipo_atencion || '—')}</td>
                    <td><span class="badge-auro ${String(a.estado_atencion).toLowerCase()==='abierta' ? 'badge-blue' : 'badge-ok'}">${safe(a.estado_atencion || '—')}</span></td>
                    <td><button type="button" class="btn-action primary" onclick="seleccionarAtencion('${safe(a.id_atencion)}')">Ver</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
      }
    }
  }

  window.iniciarAtencionActual = function(){
    const paciente = obtenerPacienteActivoSeguro();
    const idPaciente = paciente?.id_paciente || paciente?.id || '';

    if(!idPaciente){
      alert('Seleccione primero un paciente desde Pacientes o Historia Clínica.');
      return;
    }

    const abierta = getAtencionAbiertaPaciente(idPaciente);
    if(abierta){
      atencionActivaId = abierta.id_atencion;
      renderAtencionesPaciente();
      alert('Este paciente ya tiene una atención abierta.');
      return;
    }

    const nueva = crearAtencionObjeto();
    if(!nueva){
      alert('No se pudo crear la atención. Verifique el paciente activo.');
      return;
    }

    const lista = leerAtencionesLocal();
    lista.unshift(nueva);
    guardarAtencionesLocal(lista);

    atencionActivaId = nueva.id_atencion;
    renderAtencionesPaciente();
    console.log(MODULO, 'Atención iniciada:', nueva);
  };

  window.finalizarAtencionActual = function(){
    const paciente = obtenerPacienteActivoSeguro();
    const idPaciente = paciente?.id_paciente || paciente?.id || '';

    if(!idPaciente){
      alert('Seleccione primero un paciente.');
      return;
    }

    const abierta = getAtencionAbiertaPaciente(idPaciente);
    if(!abierta){
      alert('No hay atención abierta para finalizar.');
      return;
    }

    const confirmar = confirm('¿Finalizar la atención actual? Después quedará como consulta registrada en el historial.');
    if(!confirmar) return;

    const lista = leerAtencionesLocal();
    const idx = lista.findIndex(a => String(a.id_atencion) === String(abierta.id_atencion));
    if(idx >= 0){
      lista[idx] = {
        ...lista[idx],
        estado_atencion: 'Finalizada',
        actualizado_en: fechaHoraVisual()
      };
      guardarAtencionesLocal(lista);
    }

    atencionActivaId = '';
    renderAtencionesPaciente();
    console.log(MODULO, 'Atención finalizada:', abierta.id_atencion);
  };

  window.seleccionarAtencion = function(idAtencion){
    const a = leerAtencionesLocal().find(x => String(x.id_atencion) === String(idAtencion));
    if(!a){
      alert('No se encontró la atención seleccionada.');
      return;
    }

    atencionActivaId = a.id_atencion;

    const box = el('auroAtencionActivaBox');
    if(box){
      box.style.display = 'block';
      box.innerHTML = `<i class="bi bi-eye me-1"></i> Visualizando Consulta #${safe(a.numero_consulta)} · ${safe(fechaVisual(a.fecha_atencion))} · Estado: <b>${safe(a.estado_atencion)}</b>`;
    }

    console.log(MODULO, 'Atención seleccionada:', a);
  };

  window.getAtencionActiva = function(){
    if(!atencionActivaId) return null;
    return leerAtencionesLocal().find(a => String(a.id_atencion) === String(atencionActivaId)) || null;
  };

  window.getIdAtencionActiva = function(){
    return window.getAtencionActiva()?.id_atencion || '';
  };

  window.renderAtencionesPaciente = renderAtencionesPaciente;

  function inicializarModuloAtenciones(){
    asegurarBloqueAtenciones();
    renderAtencionesPaciente();
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(inicializarModuloAtenciones, 500);
  });

  document.addEventListener('click', function(e){
    const btnHistoria = e.target?.closest?.('button[onclick*="showScreen(\'historia\'"], button[onclick*="showScreen(\"historia\""]');
    if(btnHistoria){
      setTimeout(inicializarModuloAtenciones, 300);
    }
  });

  window.__atencionesAurosanaxDebug = function(){
    return {
      modulo: MODULO,
      version: '1.0',
      storageKey: STORAGE_KEY,
      totalLocal: leerAtencionesLocal().length,
      pacienteActivo: obtenerPacienteActivoSeguro()?.nombre || '',
      atencionActivaId,
      atencionActiva: window.getAtencionActiva()
    };
  };

})();
