/****************************************************************
 AUROSANAX ERP
 plan.js
 MODULACIÓN PLAN - FASE 1.3 LIMPIA
 ---------------------------------------------------------------
 OBJETIVO:
 - Mantener únicamente lógica segura del Plan.
 - NO tocar botones.
 - NO usar MutationObserver.
 - NO interceptar clics.
 - NO modificar Dashboard, Pacientes, Agenda, Atenciones ni Recetas.

 CONTIENE:
 - Estado temporal del Plan por id_atencion.
 - Limpieza del Plan al cambiar consulta.
 - Restauración temporal por consulta.
 - Limpieza de medicamentos del Plan.
 - Sincronización segura con funciones ya existentes si están cargadas.
 - Responsive móvil Android/teléfono para el bloque Plan.

 IMPORTANTE:
 - El botón Guardar historia / Actualizar plan queda en index.html.
 - guardarHistoriaClinicaERP() queda en index.html.
****************************************************************/


/* ============================================================
   ESTADO TEMPORAL DEL PLAN POR ATENCIÓN
============================================================ */

window.planState = window.planState || {
    atencionActual: '',
    cache: {}
};


/* ============================================================
   INICIALIZACIÓN
============================================================ */

function inicializarPlan(){

    if(!Array.isArray(window.medicamentosPlanSeleccionados)){
        window.medicamentosPlanSeleccionados = [];
    }

    if(!window.planState){
        window.planState = {
            atencionActual:'',
            cache:{}
        };
    }

    instalarResponsivePlanAndroid();
}


/* ============================================================
   CAMBIO DE CONSULTA / ATENCIÓN
============================================================ */

function cambiarPlanPorAtencion(idAtencion){

    inicializarPlan();

    idAtencion = String(idAtencion || '').trim();

    if(!idAtencion) return;

    guardarPlanTemporal();

    window.planState.atencionActual = idAtencion;

    cargarPlanTemporal(idAtencion);
}


/* ============================================================
   GUARDAR PLAN TEMPORAL EN MEMORIA
============================================================ */

function guardarPlanTemporal(){

    inicializarPlan();

    if(!window.planState.atencionActual) return;

    window.planState.cache[window.planState.atencionActual] = {

        medicamentos: JSON.parse(
            JSON.stringify(window.medicamentosPlanSeleccionados || [])
        ),

        plan:
            document.getElementById('hcPlanTratamiento')?.value || '',

        indicaciones:
            document.getElementById('hcIndicacionesPaciente')?.value || '',

        ordenes:
            document.getElementById('hcExamenesSolicitados')?.value || '',

        interconsulta:
            document.getElementById('hcInterconsultaResumen')?.value || '',

        evaluaciones:
            document.getElementById('hcEvaluacionesResumen')?.value || '',

        receta:
            document.getElementById('hcRecetaMedicamentos')?.value || ''
    };
}


/* ============================================================
   CARGAR PLAN TEMPORAL POR ATENCIÓN
============================================================ */

function cargarPlanTemporal(idAtencion){

    inicializarPlan();

    idAtencion = String(idAtencion || '').trim();

    limpiarPlanTemporal();

    const data = window.planState.cache[idAtencion];

    if(!data){
        auroPlanRefrescarVistas();
        return;
    }

    window.medicamentosPlanSeleccionados =
        JSON.parse(JSON.stringify(data.medicamentos || []));

    auroPlanSetValue('hcPlanTratamiento', data.plan || '');
    auroPlanSetValue('hcIndicacionesPaciente', data.indicaciones || '');
    auroPlanSetValue('hcExamenesSolicitados', data.ordenes || '');
    auroPlanSetValue('hcInterconsultaResumen', data.interconsulta || '');
    auroPlanSetValue('hcEvaluacionesResumen', data.evaluaciones || '');
    auroPlanSetValue('hcRecetaMedicamentos', data.receta || '');

    auroPlanRefrescarVistas();
}


/* ============================================================
   LIMPIAR PLAN TEMPORAL
============================================================ */

function limpiarPlanTemporal(){

    window.medicamentosPlanSeleccionados = [];

    const campos = [
        'hcPlanTratamiento',
        'hcIndicacionesPaciente',
        'hcRecetaMedicamentos',
        'hcExamenesSolicitados',
        'hcInterconsultaResumen',
        'hcEvaluacionesResumen'
    ];

    campos.forEach(id => auroPlanSetValue(id, ''));

    auroPlanRefrescarVistas();
}


/* ============================================================
   LIMPIAR SOLO MEDICAMENTOS DEL PLAN
============================================================ */

function limpiarMedicamentosPlan(){

    window.medicamentosPlanSeleccionados = [];

    auroPlanRefrescarVistas();
}


/* ============================================================
   SINCRONIZACIÓN AUXILIAR ANTES DE GUARDAR
   Puede llamarse desde index.html antes de guardarHistoriaClinicaERP()
============================================================ */

function auroSincronizarPlanAntesGuardar(){

    if(typeof recopilarEvaluacionesPlan === 'function'){
        recopilarEvaluacionesPlan();
    }

    if(typeof recopilarInterconsultaPlan === 'function'){
        recopilarInterconsultaPlan();
    }

    if(typeof recopilarOrdenesMedicasPlan === 'function'){
        recopilarOrdenesMedicasPlan();
    }

    if(typeof renderMedicamentosPlanTabla === 'function'){
        renderMedicamentosPlanTabla();
    }

    if(typeof sincronizarPlanConReceta === 'function'){
        sincronizarPlanConReceta();
    }

    guardarPlanTemporal();
}


/* ============================================================
   REFRESCAR VISTAS DEL PLAN
============================================================ */

function auroPlanRefrescarVistas(){

    if(typeof renderMedicamentosPlanTabla === 'function'){
        renderMedicamentosPlanTabla();
    }

    if(typeof sincronizarPlanConReceta === 'function'){
        sincronizarPlanConReceta();
    }

    if(typeof renderOrdenesMedicasTabla === 'function'){
        renderOrdenesMedicasTabla();
    }

    if(typeof recopilarEvaluacionesPlan === 'function'){
        recopilarEvaluacionesPlan();
    }

    if(typeof recopilarInterconsultaPlan === 'function'){
        recopilarInterconsultaPlan();
    }
}


/* ============================================================
   UTILIDAD SEGURA
============================================================ */

function auroPlanSetValue(id, value){
    const el = document.getElementById(id);
    if(el) el.value = value || '';
}


/* ============================================================
   RESPONSIVE PLAN ANDROID / TELÉFONO
============================================================ */

function instalarResponsivePlanAndroid(){

    if(document.getElementById('auroPlanResponsiveAndroidStyle')) return;

    const style = document.createElement('style');
    style.id = 'auroPlanResponsiveAndroidStyle';

    style.textContent = `
      @media(max-width:760px){

        #hc_plan .hc-plan-narrow,
        #hc_plan .hc-plan-row-small{
          width:100%!important;
          max-width:none!important;
        }

        #hc_plan .receta-medicamentos-box,
        #hc_plan .ordenes-medicas-box,
        #hc_plan .interconsulta-box,
        #hc_plan .evaluaciones-box{
          padding:12px!important;
          border-radius:14px!important;
        }

        #hc_plan .table-responsive{
          display:block!important;
          overflow-x:auto!important;
          -webkit-overflow-scrolling:touch!important;
        }

        #hc_plan table{
          min-width:850px!important;
        }

        #hc_plan button{
          min-height:42px!important;
          white-space:normal!important;
        }

        #hc_plan .row.g-3{
          row-gap:12px!important;
        }

        #hc_plan textarea,
        #hc_plan input,
        #hc_plan select{
          font-size:14px!important;
        }
      }
    `;

    document.head.appendChild(style);
}


/* ============================================================
   INICIO SEGURO
============================================================ */

document.addEventListener('DOMContentLoaded', function(){
    inicializarPlan();
});

setTimeout(function(){
    inicializarPlan();
}, 800);
