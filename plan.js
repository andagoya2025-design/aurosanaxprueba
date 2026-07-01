/****************************************************************
 AUROSANAX ERP
 plan.js
 MODULACIÓN FASE 1
****************************************************************/

window.planState = {
    atencionActual: '',
    cache: {}
};

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
        renderMedicamentosPlanTabla?.();
        sincronizarPlanConReceta?.();
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

    renderMedicamentosPlanTabla?.();

    sincronizarPlanConReceta?.();
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

    renderMedicamentosPlanTabla?.();
}

function limpiarMedicamentosPlan(){

    window.medicamentosPlanSeleccionados = [];

    renderMedicamentosPlanTabla?.();

    sincronizarPlanConReceta?.();
}

document.addEventListener('DOMContentLoaded',()=>{

    inicializarPlan();

});

/*
AGREGAR EN:

abrirAtencion()
editarAtencion()
cargarHistoria()
seleccionarConsulta()

cambiarPlanPorAtencion(id_atencion);
*/
