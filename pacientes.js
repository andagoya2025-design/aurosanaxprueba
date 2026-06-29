/*****************************************************************************************
 * AUROSANAX ERP DEMO - pacientes.js
 * FIX FASE 2 PACIENTES - RESTAURAR HISTORIA CLÍNICA VISUAL
 *
 * Este bloque fue extraído del index antiguo funcional.
 * Corrige:
 * - Resumen "Sin seleccionar"
 * - Cabecera "Seleccione un paciente"
 * - Datos generales del paciente
 *
 * IMPORTANTE:
 * Pegar este bloque AL FINAL de pacientes.js.
 * No toca renderPatients, Agenda, Dashboard ni Google Sheets.
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
    ['hcCedula','hcNacimiento','hcEdad','hcOcupacion','hcTelefono','hcCorreo','hcDireccion','hcSeguro','hcContactoEmergencia','hcTelefonoEmergencia','hcTipoSangre','hcAlergiasPaciente'].forEach(id => setValueIfExists(id, ''));
    setValueIfExists('hcSexo', '');
    setValueIfExists('hcEstadoCivil', '');
    updateClinicalSummary();
    renderModulePatientCards();
    return;
  }

  activePatientId = p.id_paciente || idPaciente;
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
}
