/*****************************************************************************************
 * AUROSANAX ERP DEMO - pacientes.js
 * Módulo Pacientes extraído desde index.html.
 *
 * IMPORTANTE:
 * 1) En esta primera fase NO borres nada del index.html.
 * 2) Pega este contenido en pacientes.js.
 * 3) Luego conectamos el archivo desde index.html con:
 *    <script src="pacientes.js"></script>
 *
 * Este archivo contiene la lógica de:
 * - listado de pacientes
 * - búsqueda y filtro
 * - paginación
 * - última atención real desde citas atendidas
 * - nuevo paciente
 * - editar paciente
 * - WhatsApp de paciente
 * - selección de paciente para módulos clínicos
 *****************************************************************************************/

function setTextIfExists(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function getPacienteActivo(){
  const selectId = document.getElementById('hcPacienteSelect')?.value || '';

  const candidatos = [
    activePatientId,
    window.activePatientId,
    selectId,
    window.historiaActual?.id_paciente,
    window.currentHistoria?.id_paciente
  ].filter(Boolean);

  for(const id of candidatos){
    const paciente = patients.find(p =>
      String(p.id_paciente || p.id || '') === String(id)
    );
    if(paciente) return paciente;
  }

  return null;
}

function inicialesPaciente(nombre){
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if(!partes.length) return 'A';
  return partes.slice(0,2).map(x => x[0]).join('').toUpperCase();
}

function renderModulePatientCards(){
  const paciente = getPacienteActivo();
  document.querySelectorAll('[data-module-patient]').forEach(card => {
    const modulo = card.getAttribute('data-module-patient') || 'Módulo';
    if(!paciente){
      card.classList.add('empty');
      card.innerHTML = `
        <div>
          <div class="module-patient-title"><i class="bi bi-exclamation-triangle me-1"></i> ${modulo}: paciente no seleccionado</div>
          <div class="module-patient-meta"><span>Seleccione o abra un paciente desde Pacientes o Historia Clínica antes de guardar.</span></div>
        </div>
        <div class="module-patient-actions">
          <button class="btn-soft" onclick="showScreen('pacientes')"><i class="bi bi-search me-1"></i> Buscar paciente</button>
          <button class="btn-soft" onclick="showScreen('historia')"><i class="bi bi-file-medical me-1"></i> Historia clínica</button>
        </div>`;
      return;
    }
    card.classList.remove('empty');
    const edad = paciente.edad || calcularEdadDesdeFecha(paciente.fecha_nacimiento) || '—';
    card.innerHTML = `
      <div>
        <div class="module-patient-title"><i class="bi bi-person-check me-1"></i> ${modulo} de ${paciente.nombre || 'Paciente'}</div>
        <div class="module-patient-meta">
          <span>Cédula: ${paciente.cedula || '—'}</span>
          <span>Edad: ${edad}</span>
          <span>WhatsApp: ${paciente.telefono || '—'}</span>
          <span>ID: ${paciente.id_paciente || '—'}</span>
        </div>
      </div>
      <div class="module-patient-actions">
        <button class="btn-action primary" onclick="abrirHistoriaPaciente('${paciente.id_paciente || ''}')"><i class="bi bi-file-medical me-1"></i> Ver historia</button>
        <button class="btn-action success" onclick="abrirWhatsAppPaciente('${paciente.id_paciente || ''}')"><i class="bi bi-whatsapp me-1"></i> WhatsApp</button>
      </div>`;
  });
}

function validarPacienteModulo(){
  if(!getPacienteActivo()){
    alert('Seleccione primero un paciente para trabajar este módulo.');
    showScreen('pacientes');
    return false;
  }
  return true;
}

function badgeEstado(e){
  if(e==='Activa') return '<span class="badge-auro badge-ok">Activa</span>';
  if(e==='Control') return '<span class="badge-auro badge-warn">Control</span>';
  return '<span class="badge-auro badge-blue">Seguimiento</span>';
}


function auroInyectarEstiloAccionesPacientes(){
  if(document.getElementById('auro-pacientes-acciones-premium-style')) return;

  const style = document.createElement('style');
  style.id = 'auro-pacientes-acciones-premium-style';
  style.textContent = `
    .auro-patient-actions{
      position:relative;
      display:inline-block;
    }

    .auro-patient-actions-btn{
      min-width:112px;
      border:1px solid #fbcfe8;
      background:linear-gradient(135deg,#ffffff,#fff7fb);
      color:#8b1e5a;
      border-radius:13px;
      padding:7px 10px;
      font-weight:800;
      font-size:12px;
      box-shadow:0 6px 18px rgba(139,30,90,.08);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:5px;
      cursor:pointer;
    }

    .auro-patient-actions-btn:hover{
      background:#fdf2f8;
      color:#7a174f;
    }

    .auro-patient-actions-menu{
      position:absolute;
      top:calc(100% + 6px);
      right:0;
      z-index:9999;
      min-width:210px;
      background:#fff;
      border:1px solid #fbcfe8;
      border-radius:16px;
      padding:8px;
      box-shadow:0 18px 45px rgba(15,23,42,.18);
      display:none;
    }

    .auro-patient-actions.open .auro-patient-actions-menu{
      display:block;
    }

    .auro-patient-actions-item{
      width:100%;
      border:0;
      background:transparent;
      color:#374151;
      padding:9px 10px;
      border-radius:12px;
      font-weight:750;
      font-size:13px;
      display:flex;
      align-items:center;
      gap:8px;
      text-align:left;
      cursor:pointer;
    }

    .auro-patient-actions-item:hover{
      background:#fdf2f8;
      color:#8b1e5a;
    }

    .auro-patient-actions-divider{
      height:1px;
      background:#f1f5f9;
      margin:6px 4px;
    }

    .table-modern td:last-child{
      white-space:nowrap;
      overflow:visible;
    }

    .table-responsive{
      overflow:visible;
    }

    .cardx{
      overflow:visible;
    }
  `;
  document.head.appendChild(style);
}

function toggleAccionesPaciente(event, idPaciente){
  event.stopPropagation();

  document.querySelectorAll('.auro-patient-actions.open').forEach(el => {
    if(el.id !== 'acciones-paciente-' + idPaciente){
      el.classList.remove('open');
    }
  });

  const menu = document.getElementById('acciones-paciente-' + idPaciente);
  if(menu){
    menu.classList.toggle('open');
  }
}

document.addEventListener('click', function(){
  document.querySelectorAll('.auro-patient-actions.open').forEach(el => el.classList.remove('open'));
});

function accionesPacientePremiumHTML(idPaciente){
  const id = String(idPaciente || '');
  return `
    <div class="auro-patient-actions" id="acciones-paciente-${id}">
      <button type="button" class="auro-patient-actions-btn" onclick="toggleAccionesPaciente(event,'${id}')">
        <i class="bi bi-three-dots-vertical"></i> Acciones
      </button>
      <div class="auro-patient-actions-menu">
        <button type="button" class="auro-patient-actions-item" onclick="abrirHistoriaPaciente('${id}')">
          <i class="bi bi-file-medical"></i> Historia clínica
        </button>
        <button type="button" class="auro-patient-actions-item" onclick="abrirWhatsAppPaciente('${id}')">
          <i class="bi bi-whatsapp"></i> WhatsApp
        </button>
        <div class="auro-patient-actions-divider"></div>
        <button type="button" class="auro-patient-actions-item" onclick="editarPacienteModal('${id}')">
          <i class="bi bi-pencil-square"></i> Editar paciente
        </button>
      </div>
    </div>
  `;
}

function normalizarEstadoAgenda(estado){
  const e = String(estado || '').trim().toLowerCase();
  if(!e) return 'sin estado';
  if(e === 'anulada' || e === 'anulado' || e === 'cancelada' || e === 'cancelado') return 'anulada';
  if(e === 'no asistio' || e === 'no asistió' || e === 'inasistencia' || e === 'no asistio a cita' || e === 'no asistió a cita') return 'no asistio';
  if(e === 'atendida' || e === 'atendidas') return 'atendida';
  if(e === 'confirmada' || e === 'confirmado') return 'confirmada';
  if(e === 'pendiente') return 'pendiente';
  if(e === 'sin estado') return 'sin estado';
  return e;
}

function formatearFechaVisual(fecha){
  if(!fecha) return '';
  const partes = String(fecha).slice(0,10).split('-');
  if(partes.length === 3) return partes[2] + '/' + partes[1] + '/' + partes[0];
  return fecha;
}

function auroTimestampFechaAgendaPaciente(c){
  const fecha = String(c?.fecha_deseada || c?.fecha_cita || c?.fecha || '').substring(0,10);
  if(!fecha) return 0;

  const horaTxt = String(c?.hora_deseada || c?.hora_inicio || c?.hora || '').trim();
  const horaMatch = horaTxt.match(/(\d{1,2}):(\d{2})/);
  const hora = horaMatch ? String(horaMatch[1]).padStart(2,'0') + ':' + horaMatch[2] : '00:00';
  const t = new Date(fecha + 'T' + hora + ':00').getTime();
  return Number.isFinite(t) ? t : 0;
}

function auroCitaPertenecePaciente(c, p){
  if(!c || !p) return false;

  const idCita = String(c.id_paciente || c.paciente_id || '').trim();
  const idPaciente = String(p.id_paciente || '').trim();
  if(idCita && idPaciente && idCita === idPaciente) return true;

  const cedulaCita = String(c.numero_documento || c.cedula || c.documento || '').replace(/\D/g,'');
  const cedulaPaciente = String(p.cedula || p.numero_documento || '').replace(/\D/g,'');
  if(cedulaCita && cedulaPaciente && cedulaCita === cedulaPaciente) return true;

  const telCita = String(c.whatsapp || c.telefono || c.celular || '').replace(/\D/g,'');
  const telPaciente = String(p.telefono || p.whatsapp || p.celular || '').replace(/\D/g,'');
  if(telCita && telPaciente && telCita.slice(-8) === telPaciente.slice(-8)) return true;

  const nombreCita = normalizarTextoComparacion(c.nombre || c.paciente || c.nombre_paciente || c.nombre_completo || '');
  const nombrePaciente = normalizarTextoComparacion(p.nombre || ((p.nombres || '') + ' ' + (p.apellidos || '')).trim() || '');
  return !!nombreCita && !!nombrePaciente && nombreCita === nombrePaciente;
}

function auroUltimaAtencionPaciente(p){
  const citasAtendidas = (Array.isArray(citasAgendaWeb) ? citasAgendaWeb : [])
    .filter(c => normalizarEstadoAgenda(c.estado) === 'atendida' && auroCitaPertenecePaciente(c, p))
    .map(c => ({ cita: c, ts: auroTimestampFechaAgendaPaciente(c) }))
    .filter(x => x.ts > 0)
    .sort((a, b) => b.ts - a.ts);

  if(citasAtendidas.length){
    return {
      fecha: String(citasAtendidas[0].cita.fecha_deseada || '').substring(0,10),
      ts: citasAtendidas[0].ts,
      fuente: 'cita'
    };
  }

  // Si la agenda aún no terminó de cargar, se mantiene temporalmente el dato anterior para no dejar la tabla vacía.
  // Cuando cargan las citas, se recalcula desde Agenda y se evita usar fecha_registro/actualizado_en como atención.
  if(!citasAgendaWebCargadas && p.ultima){
    const fechaFallback = normalizarFechaInput(p.ultima);
    const tsFallback = fechaFallback ? new Date(fechaFallback + 'T00:00:00').getTime() : 0;
    return {fecha: fechaFallback || p.ultima, ts: Number.isFinite(tsFallback) ? tsFallback : 0, fuente: 'temporal'};
  }

  return {fecha: '', ts: 0, fuente: 'sin_atencion'};
}

function renderPatients(){
  auroInyectarEstiloAccionesPacientes();
  const q=(document.getElementById('patientSearch')?.value||'').toLowerCase();
  const f=document.getElementById('patientFilter')?.value||'';
  const rows=patients.map(p => {
    const ultimaInfo = auroUltimaAtencionPaciente(p);
    return {
      ...p,
      ultima_atencion_real: ultimaInfo.fecha,
      ultima_atencion_ts: ultimaInfo.ts
    };
  }).filter(p=>{
    const txt=[p.nombre,p.cedula,p.telefono,p.email,p.servicio,p.ciudad].join(' ').toLowerCase();
    return (!q || txt.includes(q)) && (!f || p.servicio===f);
  }).sort((a,b)=>{
    const ta = Number(a.ultima_atencion_ts || 0);
    const tb = Number(b.ultima_atencion_ts || 0);
    if(ta && tb && ta !== tb) return tb - ta;
    if(ta && !tb) return -1;
    if(!ta && tb) return 1;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', {sensitivity:'base'});
  });

  const sizeSelect = document.getElementById('patientPageSize');
  if(sizeSelect) patientPageSize = parseInt(sizeSelect.value,10) || 25;

  const totalPages = Math.max(1, Math.ceil(rows.length / patientPageSize));
  if(patientPage > totalPages) patientPage = totalPages;
  if(patientPage < 1) patientPage = 1;

  const startIndex = (patientPage - 1) * patientPageSize;
  const visibleRows = rows.slice(startIndex, startIndex + patientPageSize);

  const endIndex = Math.min(startIndex + visibleRows.length, rows.length);
  setTextIfExists('patientCountInfo', rows.length ? `Mostrando ${startIndex + 1}–${endIndex} de ${rows.length} pacientes` : 'No hay pacientes para mostrar');
  setTextIfExists('patientPageInfo', `Página ${patientPage} / ${totalPages}`);
  const prevBtn = document.getElementById('patientPrevBtn');
  const nextBtn = document.getElementById('patientNextBtn');
  if(prevBtn) prevBtn.disabled = patientPage <= 1;
  if(nextBtn) nextBtn.disabled = patientPage >= totalPages;

  document.getElementById('patientsBody').innerHTML = visibleRows.map((p,i)=>`
    <tr>
      <td><b>${p.nombre}</b><br><small class="text-muted">${p.email}</small></td>
      <td>${p.cedula}</td>
      <td>${p.telefono}</td>
      <td><span class="badge-auro">${p.servicio}</span></td>
      <td>${p.ultima_atencion_real ? formatearFechaVisual(p.ultima_atencion_real) : '—'}</td>
      <td>${badgeEstado(p.estado)}</td>
      <td>
        ${accionesPacientePremiumHTML(p.id_paciente || '')}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="text-center text-muted py-4">Sin pacientes</td></tr>';

  document.getElementById('patientsMobile').innerHTML = visibleRows.map(p=>`
    <div class="mobile-card">
      <div class="mobile-card-top"><b>${p.nombre}</b>${badgeEstado(p.estado)}</div>
      <div class="line"><span>Cédula</span><span>${p.cedula}</span></div>
      <div class="line"><span>Teléfono</span><span>${p.telefono}</span></div>
      <div class="line"><span>Servicio</span><span>${p.servicio}</span></div>
      <div class="line"><span>Última atención</span><span>${p.ultima_atencion_real ? formatearFechaVisual(p.ultima_atencion_real) : '—'}</span></div>
      <div class="d-grid gap-2 mt-2">
        <button class="btn-auro w-100" onclick="abrirHistoriaPaciente('${p.id_paciente || ''}')">Ver historia clínica</button>
        <button class="btn-soft w-100" onclick="abrirWhatsAppPaciente('${p.id_paciente || ''}')"><i class="bi bi-whatsapp me-1"></i> WhatsApp</button>
        <button class="btn-soft w-100" onclick="editarPacienteModal('${p.id_paciente || ''}')"><i class="bi bi-pencil-square me-1"></i> Editar paciente</button>
      </div>
    </div>
  `).join('') || '<div class="mobile-card text-muted">Sin pacientes</div>';
  document.getElementById('stPacientes').textContent=patients.length;
  actualizarDashboard();
}

function cambiarPaginaPacientes(delta){
  patientPage += delta;
  renderPatients();
}

function resetPatients(){
  document.getElementById('patientSearch').value='';
  document.getElementById('patientFilter').value='';
  patientPage = 1;
  renderPatients();
}

function limpiarFormularioPaciente(){
  ['pNombre','pCedula','pNacimiento','pSexo','pEstadoCivil','pOcupacion','pTelefono','pEmail','pDireccion','pSeguro','pContactoEmergencia','pTelefonoEmergencia','pTipoSangre','pAlergias','pNotas'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  const ciudad=document.getElementById('pCiudad');
  if(ciudad) ciudad.value='Guayaquil';
  const servicio=document.getElementById('pServicio');
  if(servicio) servicio.value='Ginecología';
}

function openPatientModal(){
  editingPatientId = null;
  limpiarFormularioPaciente();
  setTextIfExists('patientModalTitle','Nuevo paciente');
  setTextIfExists('patientSaveBtn','Guardar paciente');
  document.getElementById('patientModal').classList.add('show');
}

function closePatientModal(){
  document.getElementById('patientModal').classList.remove('show');
  editingPatientId = null;
}

function editarPacienteModal(idPaciente){
  if(!idPaciente){
    alert('Este paciente todavía no tiene ID. Actualice la página y vuelva a intentar.');
    return;
  }
  const p = patients.find(x => x.id_paciente === idPaciente);
  if(!p){
    alert('No se encontró el paciente en la lista cargada.');
    return;
  }
  editingPatientId = idPaciente;
  setTextIfExists('patientModalTitle','Editar paciente');
  setTextIfExists('patientSaveBtn','Actualizar paciente');
  setValueIfExists('pNombre', p.nombre || [p.nombres||'', p.apellidos||''].join(' ').trim());
  setValueIfExists('pCedula', p.cedula || '');
  setValueIfExists('pNacimiento', normalizarFechaInput(p.fecha_nacimiento || ''));
  setValueIfExists('pSexo', p.sexo || '');
  setValueIfExists('pEstadoCivil', normalizarEstadoCivilPaciente(p.estado_civil || ''));
  setValueIfExists('pOcupacion', p.ocupacion || '');
  setValueIfExists('pTelefono', p.telefono || '');
  setValueIfExists('pEmail', p.email || '');
  setValueIfExists('pDireccion', p.direccion || '');
  setValueIfExists('pCiudad', p.ciudad || 'Guayaquil');
  setValueIfExists('pSeguro', p.aseguradora || p.seguro_medico || '');
  setValueIfExists('pContactoEmergencia', p.contacto_emergencia || '');
  setValueIfExists('pTelefonoEmergencia', p.telefono_emergencia || '');
  setValueIfExists('pTipoSangre', p.tipo_sangre || '');
  setValueIfExists('pAlergias', p.alergias || '');
  setValueIfExists('pNotas', p.antecedentes_importantes || '');
  const serv=document.getElementById('pServicio');
  if(serv) serv.value = p.servicio || 'Ginecología';
  document.getElementById('patientModal').classList.add('show');
}

async function cargarPacientesDesdeSheets(){
  try{
    const res = await fetch(API_URL + '?accion=listarPacientes');
    const data = await res.json();

    patients = data.map(p => ({
      id_paciente: p.id_paciente || '',
      nombre: [p.nombres || '', p.apellidos || ''].join(' ').trim(),
      nombres: p.nombres || '',
      apellidos: p.apellidos || '',
      cedula: p.numero_documento || '',
      fecha_nacimiento: p.fecha_nacimiento || '',
      edad: p.edad || '',
      sexo: p.sexo || '',
      estado_civil: p.estado_civil || '',
      ocupacion: p.ocupacion || '',
      telefono: p.whatsapp || p.telefono || '',
      email: p.email || '',
      direccion: p.direccion || '',
      ciudad: p.ciudad || '',
      provincia: p.provincia || '',
      contacto_emergencia: p.contacto_emergencia || '',
      telefono_emergencia: p.telefono_emergencia || '',
      aseguradora: p.aseguradora || '',
      alergias: p.alergias || '',
      tipo_sangre: p.tipo_sangre || p.grupo_sanguineo || '',
      antecedentes_importantes: p.antecedentes_importantes || '',
      servicio: p.servicio_principal || 'Ginecología',
      ultima: p.actualizado_en ? new Date(p.actualizado_en).toLocaleDateString('es-EC') : '',
      estado: p.estado || 'Activa'
    }));

    renderPatients();
    actualizarSelectorPacientesHistoria();
    actualizarDashboard();
  }catch(error){
    console.warn('No se pudo cargar desde Google Sheets. Se mantiene demo local.', error);
    renderPatients();
    actualizarSelectorPacientesHistoria();
    actualizarDashboard();
  }
}

async function savePatient(){
  const nombreCompleto=document.getElementById('pNombre').value.trim();
  if(!nombreCompleto){ alert('Ingrese nombres y apellidos del paciente'); return; }

  const partes = nombreCompleto.split(' ');
  const nombres = partes.slice(0, Math.max(1, partes.length - 1)).join(' ');
  const apellidos = partes.length > 1 ? partes.slice(-1).join(' ') : '';

  const pacienteSheet = {
    tipo_documento: 'Cédula',
    numero_documento: document.getElementById('pCedula').value.trim(),
    nombres: nombres,
    apellidos: apellidos,
    fecha_nacimiento: document.getElementById('pNacimiento').value,
    sexo: document.getElementById('pSexo')?.value || '',
    estado_civil: document.getElementById('pEstadoCivil')?.value || '',
    ocupacion: document.getElementById('pOcupacion')?.value.trim() || '',
    telefono: document.getElementById('pTelefono').value.trim(),
    whatsapp: document.getElementById('pTelefono').value.trim(),
    email: document.getElementById('pEmail').value.trim(),
    direccion: document.getElementById('pDireccion').value.trim(),
    ciudad: document.getElementById('pCiudad').value.trim(),
    provincia: 'Guayas',
    aseguradora: document.getElementById('pSeguro')?.value.trim() || '',
    contacto_emergencia: document.getElementById('pContactoEmergencia')?.value.trim() || '',
    telefono_emergencia: document.getElementById('pTelefonoEmergencia')?.value.trim() || '',
    tipo_sangre: document.getElementById('pTipoSangre')?.value.trim() || '',
    alergias: document.getElementById('pAlergias')?.value.trim() || '',
    servicio_principal: document.getElementById('pServicio')?.value || 'Ginecología',
    antecedentes_importantes: document.getElementById('pNotas').value.trim(),
    estado: 'Activo',
    creado_por: 'AUROSANAX ERP'
  };

  const pacienteLocal = {
    nombre: nombreCompleto,
    nombres: pacienteSheet.nombres,
    apellidos: pacienteSheet.apellidos,
    cedula: pacienteSheet.numero_documento,
    fecha_nacimiento: pacienteSheet.fecha_nacimiento,
    sexo: pacienteSheet.sexo,
    estado_civil: pacienteSheet.estado_civil,
    ocupacion: pacienteSheet.ocupacion,
    telefono: pacienteSheet.telefono,
    email: pacienteSheet.email,
    direccion: pacienteSheet.direccion,
    ciudad: pacienteSheet.ciudad,
    provincia: pacienteSheet.provincia,
    aseguradora: pacienteSheet.aseguradora,
    contacto_emergencia: pacienteSheet.contacto_emergencia,
    telefono_emergencia: pacienteSheet.telefono_emergencia,
    tipo_sangre: pacienteSheet.tipo_sangre,
    alergias: pacienteSheet.alergias,
    antecedentes_importantes: pacienteSheet.antecedentes_importantes,
    servicio: document.getElementById('pServicio').value,
    ultima: new Date().toLocaleDateString('es-EC'),
    estado: 'Activa'
  };

  try{
    const esEdicion = !!editingPatientId;
    const payloadData = esEdicion ? {...pacienteSheet, id_paciente: editingPatientId} : pacienteSheet;

    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({
        accion: esEdicion ? 'editarPaciente' : 'guardarPaciente',
        data: limpiarObjetoParaSheets(payloadData)
      })
    });

    if(esEdicion){
      const idx = patients.findIndex(p => p.id_paciente === editingPatientId);
      if(idx >= 0){
        patients[idx] = {...patients[idx], ...pacienteLocal, id_paciente: editingPatientId};
      }
    }else{
      patients.unshift(pacienteLocal);
    }

    limpiarFormularioPaciente();
    closePatientModal();
    renderPatients();
    actualizarSelectorPacientesHistoria();
    actualizarDashboard();
    setTimeout(async () => {
      await cargarPacientesDesdeSheets();
      renderPatients();
      actualizarSelectorPacientesHistoria();
      actualizarDashboard();
    }, 1200);

    alert(esEdicion ? 'Paciente actualizado correctamente.' : 'Paciente enviado a Google Sheets correctamente.');
  }catch(error){
    console.error(error);
    alert('No se pudo guardar en Google Sheets. Revise la conexión o la implementación del Apps Script.');
  }
}

function auroLimpiarHistoriaDeOtroPaciente(idPacienteNuevo){
  const nuevoId = String(idPacienteNuevo || '').trim();
  if(!nuevoId) return;

  const idHistoriaActiva = String(
    (typeof editingHistoryId !== 'undefined' && editingHistoryId) ||
    window.editingHistoryId ||
    window.auroHistoriaSeleccionadaId ||
    window.historiaActual?.id_historia ||
    window.currentHistoria?.id_historia ||
    ''
  ).trim();

  let historiaActiva = null;

  if(window.historiaActual && String(window.historiaActual.id_paciente || '').trim()){
    historiaActiva = window.historiaActual;
  }else if(window.currentHistoria && String(window.currentHistoria.id_paciente || '').trim()){
    historiaActiva = window.currentHistoria;
  }else if(idHistoriaActiva && typeof historiasClinicas !== 'undefined' && Array.isArray(historiasClinicas)){
    historiaActiva = historiasClinicas.find((h, idx) =>
      String(h?.id_historia || h?.id || idx).trim() === idHistoriaActiva
    ) || null;
  }

  const pacienteHistoria = String(historiaActiva?.id_paciente || '').trim();

  // Solo se limpia cuando está comprobado que la historia activa pertenece a otro paciente.
  // Si corresponde al mismo paciente, se conserva intacto el modo “Actualizar historia”.
  if(pacienteHistoria && pacienteHistoria !== nuevoId){
    if(typeof editingHistoryId !== 'undefined') editingHistoryId = null;
    window.editingHistoryId = null;
    window.auroHistoriaSeleccionadaId = '';
    window.historiaActual = null;
    window.currentHistoria = null;
  }
}

function abrirHistoriaPaciente(idPaciente){
  if(!idPaciente){
    alert('Este paciente todavía no tiene ID. Actualice la página y vuelva a intentar.');
    return;
  }

  auroLimpiarHistoriaDeOtroPaciente(idPaciente);

  activePatientId = idPaciente;
  window.activePatientId = idPaciente;

  showScreen('historia');
  actualizarSelectorPacientesHistoria();

  const select = document.getElementById('hcPacienteSelect');
  if(select){
    select.value = idPaciente;
    seleccionarPacienteHistoria();
  }

  window.scrollTo({top:0, behavior:'smooth'});
}

function actualizarSelectorPacientesHistoria(){
  const select = document.getElementById('hcPacienteSelect');
  if(!select) return;

  const valorActual = select.value;
  select.innerHTML = '<option value="">Seleccione un paciente registrado</option>' + patients.map(p => {
    const nombre = p.nombre || 'Paciente sin nombre';
    return `<option value="${p.id_paciente || ''}">${nombre}</option>`;
  }).join('');

  if(valorActual) select.value = valorActual;
}

function normalizarFechaInput(valor){
  if(!valor) return '';
  const d = new Date(valor);
  if(isNaN(d.getTime())) return String(valor).slice(0,10);
  return d.toISOString().slice(0,10);
}

function calcularEdadDesdeFecha(valor){
  if(!valor) return '';
  const n = new Date(normalizarFechaInput(valor) + 'T00:00:00');
  if(isNaN(n.getTime())) return '';
  const h = new Date();
  let e = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if(m < 0 || (m === 0 && h.getDate() < n.getDate())) e--;
  return e >= 0 ? e : '';
}

function normalizarEstadoCivilPaciente(valor){
  const v = normalizarTextoComparacion(valor);
  if(!v) return '';
  if(v === 'soltera' || v === 'soltero' || v === 'soltero/a') return 'Soltero/a';
  if(v === 'casada' || v === 'casado' || v === 'casado/a') return 'Casado/a';
  if(v === 'union libre' || v === 'unión libre') return 'Unión libre';
  if(v === 'divorciada' || v === 'divorciado' || v === 'divorciado/a') return 'Divorciado/a';
  if(v === 'viuda' || v === 'viudo' || v === 'viudo/a') return 'Viudo/a';
  if(v === 'separada' || v === 'separado' || v === 'separado/a') return 'Separado/a';
  if(v === 'no especifica' || v === 'no especificado' || v === 'no especificado/a') return 'No especifica';
  return valor || '';
}

function normalizarTextoComparacion(valor){
  return String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

function setValueIfExists(id, value){
  const el = document.getElementById(id);
  if(!el) return;

  if(el.tagName === 'SELECT'){
    const buscado = normalizarTextoComparacion(value);
    let encontrado = false;
    [...el.options].forEach(opt => {
      if(normalizarTextoComparacion(opt.value) === buscado || normalizarTextoComparacion(opt.textContent) === buscado){
        el.value = opt.value;
        encontrado = true;
      }
    });
    if(!encontrado) el.value = '';
    return;
  }

  el.value = value || '';
}

function getValueIfExists(id){
  return document.getElementById(id)?.value || '';
}

function limpiarTextoParaSheets(valor){
  if(valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function limpiarObjetoParaSheets(obj){
  const limpio = {};
  Object.keys(obj || {}).forEach(k => {
    const v = obj[k];
    limpio[k] = typeof v === 'string' ? limpiarTextoParaSheets(v) : v;
  });
  return limpio;
}




/* AUROSANAX: módulo Antecedentes movido a antecedentes.js para evitar duplicados. */

function normalizarTelefonoEcuador(numero){
  let n = String(numero || '').replace(/\D/g, '');
  if(!n) return '';
  if(n.startsWith('00')) n = n.slice(2);
  if(n.startsWith('593')) return n;
  if(n.startsWith('0')) return '593' + n.slice(1);
  if(n.length === 9 && n.startsWith('9')) return '593' + n;
  return n;
}

function abrirWhatsApp(numero, mensaje){
  const tel = normalizarTelefonoEcuador(numero);
  if(!tel){
    alert('No hay número de WhatsApp registrado.');
    return;
  }
  const url = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje || '');
  window.open(url, '_blank');
}

function abrirWhatsAppPaciente(idPaciente){
  const paciente = patients.find(p => p.id_paciente === idPaciente);
  if(!paciente){
    alert('No se encontró el paciente seleccionado.');
    return;
  }
  const mensaje = `Hola ${paciente.nombre || ''},\n\nLe saluda AUROSANAX.\nQueremos realizar seguimiento a su atención médica.\n\nSi presenta alguna novedad o requiere agendar un control, estamos atentos para ayudarle.`;
  abrirWhatsApp(paciente.telefono, mensaje);
}

/*****************************************************************************************
 * AUROSANAX ERP DEMO - pacientes.js
 * FASE 2 MODULARIZACIÓN PACIENTES
 * Funciones de selección, resumen y tarjeta de paciente en Historia Clínica.
 * Movidas desde index.html para alivianar el archivo principal.
 *****************************************************************************************/

function updateClinicalSummary(){
  const sel=document.getElementById('hcPacienteSelect');
  const paciente=patients.find(p=>p.id_paciente===(sel?.value||''));
  const n=paciente?.nombre||'Sin seleccionar';
  const a=document.getElementById('hcAlergias')?.value?.trim()||paciente?.alergias||'No registradas';
  const c=document.getElementById('hcControl')?.value||'Pendiente';
  if(document.getElementById('hcPacienteResumen'))document.getElementById('hcPacienteResumen').textContent=n;
  if(document.getElementById('hcAlergiasResumen'))document.getElementById('hcAlergiasResumen').textContent=a.length>18?a.slice(0,18)+'...':a;
  if(document.getElementById('hcControlResumen'))document.getElementById('hcControlResumen').textContent=c;
  actualizarTarjetaPacienteHistoria(paciente);
}

function actualizarTarjetaPacienteHistoria(paciente){
  const nombre = paciente?.nombre || 'Seleccione un paciente';
  const iniciales = nombre !== 'Seleccione un paciente' ? nombre.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() : 'A';
  const fechaNacimiento = paciente?.fecha_nacimiento ? normalizarFechaInput(paciente.fecha_nacimiento) : '';
  const edad = paciente?.edad || calcularEdadDesdeFecha(fechaNacimiento) || '—';
  const imc = document.getElementById('hcIMC')?.value || '—';

  setTextIfExists('hcAvatar', iniciales || 'A');
  setTextIfExists('hcCardNombre', nombre);
  setTextIfExists('hcCardEstado', paciente ? (paciente.estado || 'Paciente activo') : 'Historia activa');
  setTextIfExists('hcCardServicio', paciente ? (paciente.servicio || 'Ginecología') : 'AUROSANAX');
  setTextIfExists('hcCardCedula', paciente?.cedula || '—');
  setTextIfExists('hcCardNacimiento', fechaNacimiento ? formatearFechaVisual(fechaNacimiento) : '—');
  setTextIfExists('hcCardEdad', edad === '—' ? '—' : edad + ' años');
  setTextIfExists('hcCardTelefono', paciente?.telefono || '—');
  setTextIfExists('hcCardIMC', imc);
  setTextIfExists('hcCardDetalle', paciente ? 
    ['Sexo: ' + (paciente.sexo || 'No registrado'), 'Ciudad: ' + (paciente.ciudad || 'No registrada'), 'Correo: ' + (paciente.email || 'No registrado')].join('  ·  ')
    : 'Los datos clínicos aparecerán aquí al elegir un paciente registrado.'
  );
}

function seleccionarPacienteHistoria(){
  const idPaciente = document.getElementById('hcPacienteSelect')?.value || activePatientId || '';
  const p = patients.find(x => String(x.id_paciente || x.id || '') === String(idPaciente));

  if(!p){
    activePatientId = '';
    window.activePatientId = '';
    ['hcCedula','hcNacimiento','hcEdad','hcOcupacion','hcTelefono','hcCorreo','hcDireccion','hcSeguro','hcContactoEmergencia','hcTelefonoEmergencia','hcTipoSangre','hcAlergiasPaciente'].forEach(id => setValueIfExists(id, ''));
    setValueIfExists('hcSexo', '');
    setValueIfExists('hcEstadoCivil', '');
    updateClinicalSummary();
    renderModulePatientCards();
    return;
  }

  activePatientId = p.id_paciente || idPaciente;
  window.activePatientId = activePatientId;
  const fechaNacimiento = normalizarFechaInput(p.fecha_nacimiento || '');
  const edad = p.edad || calcularEdadDesdeFecha(fechaNacimiento) || '';

  setValueIfExists('hcCedula', p.cedula || '');
  setValueIfExists('hcNacimiento', fechaNacimiento);
  setValueIfExists('hcEdad', edad);
  setValueIfExists('hcSexo', p.sexo || '');
  setValueIfExists('hcEstadoCivil', normalizarEstadoCivilPaciente(p.estado_civil || ''));
  setValueIfExists('hcOcupacion', p.ocupacion || '');
  setValueIfExists('hcTelefono', p.telefono || '');
  setValueIfExists('hcCorreo', p.email || '');
  setValueIfExists('hcDireccion', p.direccion || '');
  setValueIfExists('hcSeguro', p.aseguradora || p.seguro_medico || '');
  setValueIfExists('hcContactoEmergencia', p.contacto_emergencia || '');
  setValueIfExists('hcTelefonoEmergencia', p.telefono_emergencia || '');
  setValueIfExists('hcTipoSangre', p.tipo_sangre || '');
  setValueIfExists('hcAlergiasPaciente', p.alergias || '');

  const alergiasHidden = document.getElementById('hcAlergias');
  if(alergiasHidden && !String(alergiasHidden.value || '').trim()) alergiasHidden.value = p.alergias || '';

  updateClinicalSummary();
  actualizarTarjetaPacienteHistoria(p);
  renderModulePatientCards();

  if(typeof window.renderAtencionesPaciente === 'function'){
    setTimeout(window.renderAtencionesPaciente,300);
    setTimeout(window.renderAtencionesPaciente,800);
  }
}
