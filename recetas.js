/* ==========================================================
   AUROSANAX ERP - recetas.js
   Modularización segura del módulo Recetas
   No elimina funciones existentes del index.
   ========================================================== */

window.addEventListener('DOMContentLoaded', () => {

  const fecha = document.getElementById('recFecha');

  if (fecha && !fecha.value) {
    fecha.value = fechaHoyISOReceta();
  }

});

function fechaHoyISOReceta() {
  const hoy = new Date();
  return hoy.toISOString().split('T')[0];
}

function obtenerDatosReceta() {

  const paciente =
    typeof getPacienteActivo === 'function'
      ? getPacienteActivo()
      : null;

  return {

    paciente: paciente || {},

    fecha:
      document.getElementById('recFecha')?.value || '',

    medico:
      document.getElementById('recMedico')?.value || '',

    cie10:
      document.getElementById('recCie10')?.value || '',

    estado:
      document.getElementById('recEstado')?.value || '',

    diagnostico:
      document.getElementById('recDiagnostico')?.value || '',

    medicamentos:
      document.getElementById('recMedicamento')?.value || '',

    indicaciones:
      document.getElementById('recIndicaciones')?.value || ''

  };

}

function vistaPreviaReceta() {

  const r = obtenerDatosReceta();

  console.log('RECETA AUROSANAX', r);

  return r;
}
