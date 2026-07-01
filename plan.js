/****************************************************************
 AUROSANAX ERP
 plan.js
 MODULACIÓN PLAN - FASE 1.1
 - Mantiene limpieza por id_atencion.
 - Mejora botón Guardar/Actualizar plan clínico.
 - Bloquea doble clic para evitar duplicidad.
 - Mejora responsive Android/teléfono.
 - No toca Recetas, Atenciones, Pacientes, Agenda ni Dashboard.
****************************************************************/

/* ============================================================
   ESTADO TEMPORAL DEL PLAN POR ATENCIÓN
============================================================ */
window.planState = window.planState || {
    atencionActual: '',
    cache: {}
};

window.auroPlanGuardando = false;

function inicializarPlan(){

    if(!window.medicamentosPlanSeleccionados){
        window.medicamentosPlanSeleccionados = [];
    }

    if(!window.planState){
        window.planState = {
            atencionActual:'',
            cache:{}
        };
    }

    instalarProteccionBotonPlan();
    instalarResponsivePlanAndroid();
}

function cambiarPlanPorAtencion(idAtencion){

    inicializarPlan();

    idAtencion = String(idAtencion || '').trim();

    if(!idAtencion) return;

    guardarPlanTemporal();

    planState.atencionActual = idAtencion;

    cargarPlanTemporal(idAtencion);
}

function guardarPlanTemporal(){

    if(!planState.atencionActual) return;

    planState.cache[planState.atencionActual] = {

        medicamentos: JSON.parse(
            JSON.stringify(
                window.medicamentosPlanSeleccionados || []
            )
        ),

        plan: document.getElementById('hcPlanTratamiento')?.value || '',

        indicaciones:
            document.getElementById('hcIndicacionesPaciente')?.value || ''
    };
}

function cargarPlanTemporal(idAtencion){

    limpiarPlanTemporal();

    const data = planState.cache[idAtencion];

    if(!data){
        if(typeof renderMedicamentosPlanTabla === 'function') renderMedicamentosPlanTabla();
        if(typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();
        return;
    }

    window.medicamentosPlanSeleccionados =
        JSON.parse(JSON.stringify(data.medicamentos || []));

    if(document.getElementById('hcPlanTratamiento')){
        document.getElementById('hcPlanTratamiento').value =
            data.plan || '';
    }

    if(document.getElementById('hcIndicacionesPaciente')){
        document.getElementById('hcIndicacionesPaciente').value =
            data.indicaciones || '';
    }

    if(typeof renderMedicamentosPlanTabla === 'function') renderMedicamentosPlanTabla();
    if(typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();
}

function limpiarPlanTemporal(){

    window.medicamentosPlanSeleccionados = [];

    const campos = [
        'hcPlanTratamiento',
        'hcIndicacionesPaciente',
        'hcRecetaMedicamentos'
    ];

    campos.forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.value = '';
    });

    if(typeof renderMedicamentosPlanTabla === 'function') renderMedicamentosPlanTabla();
}

function limpiarMedicamentosPlan(){

    window.medicamentosPlanSeleccionados = [];

    if(typeof renderMedicamentosPlanTabla === 'function') renderMedicamentosPlanTabla();

    if(typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();
}

/* ============================================================
   BOTÓN PLAN: BLOQUEO, ESTADO VISUAL Y CERO DUPLICIDAD
============================================================ */

function auroPlanBuscarBotonPrincipal(){
    return document.querySelector('#auroPlanActionButtons button[data-auro-plan-btn="1"]') ||
           document.querySelector('button[data-auro-plan-btn="1"]');
}

function auroPlanTextoBotonNormal(){
    const esEdicion = !!window.editingHistoryId || !!document.querySelector('#auroPlanPreviosBox:not([style*="display: none"])');
    return '<i class="bi bi-list-check me-1"></i> ' + (esEdicion ? 'Actualizar plan clínico' : 'Guardar plan clínico');
}

function auroPlanSetEstadoVisual(tipo, mensaje){

    let status = document.getElementById('hcSaveStatus');
    const panel = document.getElementById('hc_plan');

    if(!status && panel){
        status = document.createElement('div');
        status.id = 'hcSaveStatus';
        status.className = 'auro-save-status';
        const acciones = document.getElementById('auroPlanActionButtons');
        if(acciones) acciones.insertAdjacentElement('afterend', status);
        else panel.insertAdjacentElement('afterbegin', status);
    }

    if(status){
        status.className = 'auro-save-status ' + (tipo || '');
        status.textContent = mensaje || '';
    }
}

async function guardarPlanClinicoSeguro(){

    if(window.auroPlanGuardando) return false;

    const btn = auroPlanBuscarBotonPrincipal();
    const textoNormal = btn ? btn.innerHTML : auroPlanTextoBotonNormal();

    try{
        window.auroPlanGuardando = true;

        if(btn){
            btn.disabled = true;
            btn.classList.add('auro-plan-btn-saving');
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
        }

        auroPlanSetEstadoVisual('', 'Guardando plan clínico...');

        if(typeof guardarPlanTemporal === 'function') guardarPlanTemporal();

        if(typeof auroSincronizarPlanAntesGuardar === 'function'){
            auroSincronizarPlanAntesGuardar();
        }else{
            if(typeof renderMedicamentosPlanTabla === 'function') renderMedicamentosPlanTabla();
            if(typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();
        }

        if(typeof window.guardarHistoriaClinicaERP === 'function'){
            const resultado = await window.guardarHistoriaClinicaERP();
            auroPlanSetEstadoVisual('ok', 'Plan clínico actualizado correctamente.');
            return resultado;
        }

        auroPlanSetEstadoVisual('error', 'No se encontró la función de guardado.');
        return false;

    }catch(error){
        console.error('Error guardando plan clínico:', error);
        auroPlanSetEstadoVisual('error', 'No se pudo guardar el plan clínico. Revise la consola.');
        return false;

    }finally{
        setTimeout(()=>{
            window.auroPlanGuardando = false;

            if(btn){
                btn.disabled = false;
                btn.classList.remove('auro-plan-btn-saving');
                btn.innerHTML = auroPlanTextoBotonNormal() || textoNormal;
            }

        }, 900);
    }
}

function instalarProteccionBotonPlan(){

    const btn = auroPlanBuscarBotonPrincipal();

    if(btn && btn.dataset.auroPlanSeguro !== '1'){
        btn.dataset.auroPlanSeguro = '1';
        btn.setAttribute('onclick', 'guardarPlanClinicoSeguro()');
        btn.innerHTML = auroPlanTextoBotonNormal();
    }
}

/* ============================================================
   RESPONSIVE PLAN ANDROID / TELÉFONO
============================================================ */

function instalarResponsivePlanAndroid(){

    if(document.getElementById('auroPlanResponsiveAndroidStyle')) return;

    const style = document.createElement('style');
    style.id = 'auroPlanResponsiveAndroidStyle';
    style.textContent = `
      .auro-save-status.error{
        border-color:#fecaca;
        background:#fef2f2;
        color:#991b1b;
      }

      .auro-plan-btn-saving{
        opacity:.85;
        cursor:not-allowed!important;
      }

      @media(max-width:760px){
        #hc_plan .hc-plan-narrow,
        #hc_plan .hc-plan-row-small{
          width:100%!important;
          max-width:none!important;
        }

        #auroPlanActionButtons,
        .auro-plan-actions{
          display:flex!important;
          flex-direction:column!important;
          gap:10px!important;
          width:100%!important;
          margin:0 0 14px!important;
        }

        #auroPlanActionButtons button,
        .auro-plan-actions button{
          width:100%!important;
          justify-content:center!important;
          min-height:44px!important;
          white-space:normal!important;
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

        #hcSaveStatus{
          font-size:12px!important;
          line-height:1.35!important;
        }
      }
    `;

    document.head.appendChild(style);
}

/* ============================================================
   OBSERVADOR: SI EL INDEX CREA EL BOTÓN DESPUÉS, LO PROTEGE
============================================================ */

function observarBotonPlan(){
    instalarProteccionBotonPlan();

    const target = document.body;
    if(!target || window.auroPlanObserverInstalado) return;

    window.auroPlanObserverInstalado = true;

    const observer = new MutationObserver(()=>{
        instalarProteccionBotonPlan();
    });

    observer.observe(target, {
        childList:true,
        subtree:true
    });
}

/* ============================================================
   INICIO
============================================================ */

document.addEventListener('DOMContentLoaded',()=>{
    inicializarPlan();
    observarBotonPlan();
});

setTimeout(()=>{
    inicializarPlan();
    observarBotonPlan();
}, 800);
