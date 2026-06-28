/* ==========================================================
   AUROSANAX ERP - PARCHE FASE 2 PACIENTES
   Recupera sincronización visual Historia Clínica:
   - Cabecera paciente
   - Resumen paciente
   - Datos generales
   - Tarjetas de módulos
   Pegar al FINAL de pacientes.js
   ========================================================== */

function auroNormalizarTextoComparacion(valor){
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function auroSetTextIfExists(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function auroSetValueIfExists(id, value){
  const el = document.getElementById(id);
  if(!el) return;

  if(el.tagName === 'SELECT'){
    const buscado = auroNormalizarTextoComparacion(value);
    let encontrado = false;

    Array.from(el.options).forEach(function(opt){
      if(
        auroNormalizarTextoComparacion(opt.value) === buscado ||
        auroNormalizarTextoComparacion(opt.textContent) === buscado
      ){
        el.value = opt.value;
        encontrado = true;
      }
    });

    if(!encontrado) el.value = '';
    return;
  }

  el.value = value || '';
}

function auroNormalizarFechaInput(valor){
  if(!valor) return '';

  const texto = String(valor).trim();

  if(/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const m1 = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m1){
    return m1[3] + '-' + String(m1[2]).padStart(2,'0') + '-' + String(m1[1]).padStart(2,'0');
  }

  const d = new Date(texto);
  if(!isNaN(d.getTime())){
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  return '';
}

function auroCalcularEdadDesdeFecha(fecha){
  if(!fecha) return '';
  const n = new Date(fecha);
  if(isNaN(n.getTime())) return '';

  const h = new Date();
  let e = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();

  if(m < 0 || (m === 0 && h.getDate() < n.getDate())) e--;

  return e >= 0 ? e : '';
}

function auroFormatearFechaVisual(fecha){
  if(!fecha) return '—';

  const f = auroNormalizarFechaInput(fecha);
  if(!f) return fecha;

  const p = f.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function auroNormalizarEstadoCivilPaciente(valor){
  const t = auroNormalizarTextoComparacion(valor);

  if(!t) return '';
  if(t.includes('solter')) return 'Soltero/a';
  if(t.includes('casad')) return 'Casado/a';
  if(t.includes('union') || t.includes('unión')) return 'Unión libre';
  if(t.includes('divorci')) return 'Divorciado/a';
  if(t.includes('viud')) return 'Viudo/a';
  if(t.includes('separ')) return 'Separado/a';

  return valor || '';
}

function getPacienteActivo(){
  const selectId = document.getElementById('hcPacienteSelect')?.value || '';
  const id = window.activePatientId || selectId;

  if(!Array.isArray(window.patients)) return null;

  return window.patients.find(function(p){
    return String(p.id_paciente || p.id || '') === String(id);
  }) || null;
}

function actualizarTarjetaPacienteHistoria(paciente){
  const nombre = paciente?.nombre || 'Seleccione un paciente';
  const fechaNacimiento = paciente?.fecha_nacimiento ? auroNormalizarFechaInput(paciente.fecha_nacimiento) : '';
  const edad = paciente?.edad || auroCalcularEdadDesdeFecha(fechaNacimiento) || '—';
  const imc = document.getElementById('hcIMC')?.value || '—';

  let iniciales = 'A';
  if(nombre !== 'Seleccione un paciente'){
    iniciales = String(nombre)
      .split(' ')
      .filter(Boolean)
      .slice(0,2)
      .map(function(x){ return x[0]; })
      .join('')
      .toUpperCase() || 'A';
  }

  auroSetTextIfExists('hcAvatar', iniciales);
  auroSetTextIfExists('hcCardNombre', nombre);
  auroSetTextIfExists('hcCardEstado', paciente ? (paciente.estado || 'Paciente activo') : 'Historia activa');
  auroSetTextIfExists('hcCardServicio', paciente ? (paciente.servicio || 'Ginecología') : 'AUROSANAX');
  auroSetTextIfExists('hcCardCedula', paciente?.cedula || '—');
  auroSetTextIfExists('hcCardNacimiento', fechaNacimiento ? auroFormatearFechaVisual(fechaNacimiento) : '—');
  auroSetTextIfExists('hcCardEdad', edad === '—' ? '—' : edad + ' años');
  auroSetTextIfExists('hcCardTelefono', paciente?.telefono || paciente?.whatsapp || '—');
  auroSetTextIfExists('hcCardIMC', imc);

  auroSetTextIfExists(
    'hcCardDetalle',
    paciente
      ? [
          'Sexo: ' + (paciente.sexo || 'No registrado'),
          'Ciudad: ' + (paciente.ciudad || 'No registrada'),
          'Correo: ' + (paciente.email || paciente.correo || 'No registrado')
        ].join('  ·  ')
      : 'Los datos clínicos aparecerán aquí al elegir un paciente registrado.'
  );
}

function updateClinicalSummary(){
  const paciente = getPacienteActivo();

  const nombre = paciente?.nombre || 'Sin seleccionar';

  const alergiasHidden = document.getElementById('hcAlergias')?.value?.trim() || '';
  const alergiasPaciente = document.getElementById('hcAlergiasPaciente')?.value?.trim() || '';
  const alergias = alergiasHidden || alergiasPaciente || paciente?.alergias || 'No registradas';

  const control = document.getElementById('hcControl')?.value || 'Pendiente';
  const imc = document.getElementById('hcIMC')?.value || '—';

  auroSetTextIfExists('hcPacienteResumen', nombre);
  auroSetTextIfExists('hcAlergiasResumen', alergias.length > 18 ? alergias.slice(0,18) + '...' : alergias);
  auroSetTextIfExists('hcControlResumen', control);
  auroSetTextIfExists('hcImcResumen', imc);

  actualizarTarjetaPacienteHistoria(paciente);
}

function seleccionarPacienteHistoria(){
  const idPaciente = document.getElementById('hcPacienteSelect')?.value || window.activePatientId || '';

  const p = Array.isArray(window.patients)
    ? window.patients.find(function(x){
        return String(x.id_paciente || x.id || '') === String(idPaciente);
      })
    : null;

  if(!p){
    window.activePatientId = '';

    [
      'hcCedula',
      'hcNacimiento',
      'hcEdad',
      'hcOcupacion',
      'hcTelefono',
      'hcCorreo',
      'hcDireccion',
      'hcSeguro',
      'hcContactoEmergencia',
      'hcTelefonoEmergencia',
      'hcTipoSangre',
      'hcAlergiasPaciente'
    ].forEach(function(id){
      auroSetValueIfExists(id, '');
    });

    auroSetValueIfExists('hcSexo', '');
    auroSetValueIfExists('hcEstadoCivil', '');

    updateClinicalSummary();

    if(typeof window.renderModulePatientCards === 'function'){
      window.renderModulePatientCards();
    }

    return;
  }

  window.activePatientId = p.id_paciente || p.id || idPaciente;

  const fechaNacimiento = auroNormalizarFechaInput(p.fecha_nacimiento || p.nacimiento || '');
  const edad = p.edad || auroCalcularEdadDesdeFecha(fechaNacimiento) || '';

  auroSetValueIfExists('hcCedula', p.cedula || '');
  auroSetValueIfExists('hcNacimiento', fechaNacimiento);
  auroSetValueIfExists('hcEdad', edad);
  auroSetValueIfExists('hcSexo', p.sexo || '');
  auroSetValueIfExists('hcEstadoCivil', auroNormalizarEstadoCivilPaciente(p.estado_civil || p.estadoCivil || ''));
  auroSetValueIfExists('hcOcupacion', p.ocupacion || '');
  auroSetValueIfExists('hcTelefono', p.telefono || p.whatsapp || '');
  auroSetValueIfExists('hcCorreo', p.email || p.correo || '');
  auroSetValueIfExists('hcDireccion', p.direccion || '');
  auroSetValueIfExists('hcSeguro', p.aseguradora || p.seguro_medico || p.seguro || '');
  auroSetValueIfExists('hcContactoEmergencia', p.contacto_emergencia || p.contactoEmergencia || '');
  auroSetValueIfExists('hcTelefonoEmergencia', p.telefono_emergencia || p.telefonoEmergencia || '');
  auroSetValueIfExists('hcTipoSangre', p.tipo_sangre || p.tipoSangre || '');
  auroSetValueIfExists('hcAlergiasPaciente', p.alergias || '');

  const alergiasHidden = document.getElementById('hcAlergias');
  if(alergiasHidden && !String(alergiasHidden.value || '').trim()){
    alergiasHidden.value = p.alergias || '';
  }

  updateClinicalSummary();
  actualizarTarjetaPacienteHistoria(p);

  if(typeof window.renderModulePatientCards === 'function'){
    window.renderModulePatientCards();
  }

  if(typeof window.cargarAntecedentesPersonalesCompletos === 'function'){
    try{
      window.cargarAntecedentesPersonalesCompletos(p);
    }catch(e){
      console.warn('No se pudieron cargar antecedentes desde paciente activo:', e);
    }
  }
}

/* Exponer funciones globalmente para onclick del HTML */
window.getPacienteActivo = getPacienteActivo;
window.actualizarTarjetaPacienteHistoria = actualizarTarjetaPacienteHistoria;
window.updateClinicalSummary = updateClinicalSummary;
window.seleccionarPacienteHistoria = seleccionarPacienteHistoria;

console.log('[AUROSANAX] Parche Fase 2 Pacientes cargado: sincronización visual recuperada.');
