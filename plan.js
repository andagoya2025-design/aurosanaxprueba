/****************************************************************
 AUROSANAX ERP
 plan.js
 MODULACIÓN PLAN - FASE 2
 ---------------------------------------------------------------
 OBJETIVO:
 - Mantener Fase 1.3 limpia.
 - Agregar módulo de MEDICAMENTOS DEL PLAN.
 - NO tocar botón Guardar historia / Actualizar plan.
 - NO usar MutationObserver.
 - NO interceptar navegación.
 - NO tocar Dashboard, Pacientes, Agenda, Atenciones ni Recetas emitidas.

 CONTIENE:
 - Estado temporal por id_atencion.
 - Limpieza del Plan al cambiar consulta.
 - Medicamentos del Plan:
   * búsqueda / sugerencias
   * selección
   * agregar medicamento
   * eliminar medicamento
   * limpiar formulario
   * render tabla
   * sincronización Plan → Receta
 - Responsive móvil Android/teléfono.
****************************************************************/


/* ============================================================
   ESTADO TEMPORAL DEL PLAN POR ATENCIÓN
============================================================ */

window.planState = window.planState || {
    atencionActual: '',
    cache: {}
};

window.medicamentosPlanSeleccionados = Array.isArray(window.medicamentosPlanSeleccionados)
    ? window.medicamentosPlanSeleccionados
    : [];


/* ============================================================
   CATÁLOGO BASE DE MEDICAMENTOS
   Si el index ya tiene MEDICAMENTOS_AUROSANAX_BASE, se respeta.
============================================================ */

window.MEDICAMENTOS_AUROSANAX_BASE = window.MEDICAMENTOS_AUROSANAX_BASE || [
    {cat:'GINECOLOGÍA', med:'Tinidazol', pres:'500 mg tableta', via:'VO', frec:'según esquema médico', dur:'según indicación', ind:'Tomar después de alimentos'},
    {cat:'GINECOLOGÍA', med:'Metronidazol', pres:'500 mg tableta', via:'VO', frec:'cada 12 horas', dur:'7 días', ind:'Tomar después de alimentos'},
    {cat:'GINECOLOGÍA', med:'Clotrimazol', pres:'óvulo vaginal', via:'Vaginal', frec:'cada noche', dur:'7 noches', ind:'Aplicar antes de dormir'},
    {cat:'GINECOLOGÍA', med:'Fluconazol', pres:'150 mg cápsula', via:'VO', frec:'dosis única', dur:'1 día', ind:'Según indicación médica'},
    {cat:'GINECOLOGÍA', med:'Secnidazol', pres:'1 g tableta', via:'VO', frec:'dosis única', dur:'1 día', ind:'Tomar después de alimentos'},
    {cat:'DOLOR / INFLAMACIÓN', med:'Ibuprofeno', pres:'400 mg tableta', via:'VO', frec:'cada 8 horas', dur:'3 a 5 días', ind:'Tomar después de alimentos'},
    {cat:'DOLOR / INFLAMACIÓN', med:'Paracetamol', pres:'500 mg tableta', via:'VO', frec:'cada 8 horas', dur:'3 a 5 días', ind:'Si dolor o fiebre'},
    {cat:'DOLOR / INFLAMACIÓN', med:'Ketorolaco', pres:'10 mg tableta', via:'VO', frec:'cada 8 horas', dur:'máximo 3 días', ind:'Tomar después de alimentos'},
    {cat:'MEDICINA GENERAL', med:'Amoxicilina + ácido clavulánico', pres:'875/125 mg tableta', via:'VO', frec:'cada 12 horas', dur:'7 días', ind:'Tomar con alimentos'},
    {cat:'MEDICINA GENERAL', med:'Cefalexina', pres:'500 mg cápsula', via:'VO', frec:'cada 6 horas', dur:'7 días', ind:''},
    {cat:'DERMATOLOGÍA / ESTÉTICA', med:'Mupirocina', pres:'ungüento', via:'Tópica', frec:'cada 8 horas', dur:'5 a 7 días', ind:'Aplicar capa fina'},
    {cat:'DERMATOLOGÍA / ESTÉTICA', med:'Ácido fusídico', pres:'crema', via:'Tópica', frec:'cada 8 horas', dur:'7 días', ind:'Aplicar capa fina'},
    {cat:'DERMATOLOGÍA / ESTÉTICA', med:'Hidrocortisona', pres:'1% crema', via:'Tópica', frec:'cada 12 horas', dur:'3 a 5 días', ind:'Aplicar capa fina'},
    {cat:'UROLOGÍA', med:'Fenazopiridina', pres:'100 mg tableta', via:'VO', frec:'cada 8 horas', dur:'2 días', ind:'Uso sintomático según indicación'},
    {cat:'OTROS', med:'Probióticos', pres:'cápsula/sobre', via:'VO', frec:'cada día', dur:'10 a 30 días', ind:''}
];


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
    instalarEventosMedicamentosPlan();
    auroPlanRefrescarVistas();
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
   MEDICAMENTOS DEL PLAN
============================================================ */

function normalizarMedTexto(t){
    return String(t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .trim();
}

function escapeHtmlMed(txt){
    return String(txt || '').replace(/[&<>'"]/g, c => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        "'":'&#39;',
        '"':'&quot;'
    }[c]));
}

function renderMedicamentoSugerencias(){

    const input = document.getElementById('hcMedBusqueda');
    const box = document.getElementById('hcMedSugerencias');

    if(!input || !box) return;

    const q = normalizarMedTexto(input.value);

    const base = Array.isArray(window.MEDICAMENTOS_AUROSANAX_BASE)
        ? window.MEDICAMENTOS_AUROSANAX_BASE
        : [];

    const res = base
        .filter(m => !q || normalizarMedTexto(
            (m.med || '') + ' ' + (m.pres || '') + ' ' + (m.cat || '')
        ).includes(q))
        .slice(0,40);

    if(!res.length){
        box.innerHTML =
            '<div class="med-sug-item text-muted">Sin coincidencias. Puede escribirlo manualmente y agregar.</div>';
        box.classList.remove('d-none');
        return;
    }

    box.innerHTML = res.map(m => `
        <div class="med-sug-item"
             data-med="${escapeHtmlMed(m.med)}"
             data-pres="${escapeHtmlMed(m.pres)}"
             data-via="${escapeHtmlMed(m.via)}"
             data-frec="${escapeHtmlMed(m.frec)}"
             data-dur="${escapeHtmlMed(m.dur)}"
             data-ind="${escapeHtmlMed(m.ind)}">
          <div>• ${escapeHtmlMed(m.med)} <span class="text-muted">${escapeHtmlMed(m.pres)}</span></div>
          <div class="med-sug-cat">${escapeHtmlMed(m.cat)}</div>
        </div>
    `).join('');

    box.classList.remove('d-none');
}

function seleccionarMedicamentoSugerido(el){

    if(!el) return;

    auroPlanSetValue('hcMedBusqueda', el.dataset.med || '');
    auroPlanSetValue('hcMedPresentacion', el.dataset.pres || '');
    auroPlanSetValue('hcMedVia', el.dataset.via || '');
    auroPlanSetValue('hcMedFrecuencia', el.dataset.frec || '');
    auroPlanSetValue('hcMedDuracion', el.dataset.dur || '');
    auroPlanSetValue('hcMedIndicaciones', el.dataset.ind || '');

    const box = document.getElementById('hcMedSugerencias');
    if(box) box.classList.add('d-none');
}

function limpiarFormularioMedicamento(){

    [
        'hcMedBusqueda',
        'hcMedPresentacion',
        'hcMedCantidad',
        'hcMedFrecuencia',
        'hcMedDuracion',
        'hcMedIndicaciones'
    ].forEach(id => auroPlanSetValue(id, ''));

    auroPlanSetValue('hcMedVia', '');
    auroPlanSetValue('hcMedContinuo', 'No');

    const box = document.getElementById('hcMedSugerencias');
    if(box) box.classList.add('d-none');
}

function agregarMedicamentoDesdeFormulario(){

    const med = (auroPlanGetValue('hcMedBusqueda') || '').trim();

    if(!med){
        alert('Ingrese o seleccione un medicamento.');
        return;
    }

    window.medicamentosPlanSeleccionados.push({
        med,
        pres: auroPlanGetValue('hcMedPresentacion'),
        via: auroPlanGetValue('hcMedVia'),
        cantidad: auroPlanGetValue('hcMedCantidad'),
        frec: auroPlanGetValue('hcMedFrecuencia'),
        dur: auroPlanGetValue('hcMedDuracion'),
        ind: auroPlanGetValue('hcMedIndicaciones'),
        continuo: auroPlanGetValue('hcMedContinuo') || 'No'
    });

    limpiarFormularioMedicamento();
    renderMedicamentosPlanTabla();
    sincronizarPlanConReceta();
    guardarPlanTemporal();
}

function eliminarMedicamentoPlan(i){

    i = Number(i);

    if(Number.isNaN(i)) return;

    window.medicamentosPlanSeleccionados.splice(i,1);

    renderMedicamentosPlanTabla();
    sincronizarPlanConReceta();
    guardarPlanTemporal();
}

function textoRecetaMedicamentosPlan(){

    return (window.medicamentosPlanSeleccionados || []).map((m,i) => {

        const linea = [
            `${i + 1}. ${m.med || ''}`,
            m.pres || '',
            m.via || '',
            m.cantidad ? `Cantidad: ${m.cantidad}` : '',
            m.frec || '',
            m.dur ? `por ${m.dur}` : '',
            m.ind || ''
        ].filter(Boolean).join(' - ');

        return m.continuo === 'Sí'
            ? linea + ' - Tratamiento continuo'
            : linea;

    }).join('\n');
}

function renderMedicamentosPlanTabla(){

    const tbody = document.getElementById('hcMedicamentosTableBody');
    const hidden = document.getElementById('hcRecetaMedicamentos');

    if(!tbody) return;

    const meds = window.medicamentosPlanSeleccionados || [];

    if(!meds.length){

        tbody.innerHTML = `
            <tr id="hcMedicamentosEmpty">
              <td colspan="9" class="text-center text-muted py-3">
                <i class="bi bi-capsule me-1"></i> Sin medicamentos agregados
              </td>
            </tr>
        `;

    }else{

        tbody.innerHTML = meds.map((m,i) => `
            <tr>
              <td>${escapeHtmlMed(m.med)}</td>
              <td>${escapeHtmlMed(m.pres)}</td>
              <td>${escapeHtmlMed(m.via)}</td>
              <td>${escapeHtmlMed(m.cantidad)}</td>
              <td>${escapeHtmlMed(m.frec)}</td>
              <td>${escapeHtmlMed(m.dur)}</td>
              <td>${escapeHtmlMed(m.ind)}</td>
              <td>${escapeHtmlMed(m.continuo)}</td>
              <td>
                <button type="button"
                        class="btn btn-sm btn-outline-danger"
                        onclick="eliminarMedicamentoPlan(${i})">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
        `).join('');
    }

    if(hidden){
        hidden.value = textoRecetaMedicamentosPlan();
    }

    if(typeof updateClinicalSummary === 'function'){
        updateClinicalSummary();
    }
}

function sincronizarPlanConReceta(){

    renderMedicamentosPlanTabla();

    const txt = auroPlanGetValue('hcRecetaMedicamentos');
    if(txt) auroPlanSetValue('recMedicamento', txt);

    const ind = auroPlanGetValue('hcIndicacionesPaciente');
    if(ind && !auroPlanGetValue('recIndicaciones')){
        auroPlanSetValue('recIndicaciones', ind);
    }

    const plan = auroPlanGetValue('hcPlanTratamiento');
    if(plan && !auroPlanGetValue('recRecomendaciones')){
        auroPlanSetValue('recRecomendaciones', plan);
    }

    const cie = auroPlanGetValue('hcCie10Principal');
    if(cie && !auroPlanGetValue('recCie10')){
        auroPlanSetValue('recCie10', cie);
    }

    const dx = auroPlanGetValue('hcDiagnosticoPrincipal');
    if(dx && !auroPlanGetValue('recDiagnostico')){
        auroPlanSetValue('recDiagnostico', dx);
    }

    const recFecha = document.getElementById('recFecha');
    if(recFecha && !recFecha.value && typeof fechaHoyISO === 'function'){
        recFecha.value = fechaHoyISO();
    }
}

function limpiarMedicamentosPlan(){

    window.medicamentosPlanSeleccionados = [];

    renderMedicamentosPlanTabla();
    sincronizarPlanConReceta();
    guardarPlanTemporal();
}


/* ============================================================
   EVENTOS MEDICAMENTOS PLAN
   Sin interceptar botones generales.
============================================================ */

function instalarEventosMedicamentosPlan(){

    if(window.auroPlanMedicamentosEventosInstalados) return;
    window.auroPlanMedicamentosEventosInstalados = true;

    document.addEventListener('input', function(e){
        if(e.target && e.target.id === 'hcMedBusqueda'){
            renderMedicamentoSugerencias();
        }
    });

    document.addEventListener('focusin', function(e){
        if(e.target && e.target.id === 'hcMedBusqueda'){
            renderMedicamentoSugerencias();
        }
    });

    document.addEventListener('click', function(e){

        const item = e.target.closest('.med-sug-item[data-med]');

        if(item){
            seleccionarMedicamentoSugerido(item);
            return;
        }

        const box = document.getElementById('hcMedSugerencias');

        if(
            box &&
            !e.target.closest('#hcMedSugerencias') &&
            e.target.id !== 'hcMedBusqueda'
        ){
            box.classList.add('d-none');
        }
    });

    document.addEventListener('change', function(e){

        const ids = [
            'hcMedPresentacion',
            'hcMedVia',
            'hcMedCantidad',
            'hcMedFrecuencia',
            'hcMedDuracion',
            'hcMedIndicaciones',
            'hcMedContinuo'
        ];

        if(ids.includes(e.target?.id || '')){
            renderMedicamentosPlanTabla();
            guardarPlanTemporal();
        }
    });
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

    renderMedicamentosPlanTabla();
    sincronizarPlanConReceta();
    guardarPlanTemporal();
}


/* ============================================================
   REFRESCAR VISTAS DEL PLAN
============================================================ */

function auroPlanRefrescarVistas(){

    renderMedicamentosPlanTabla();
    sincronizarPlanConReceta();

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
   UTILIDADES SEGURAS
============================================================ */

function auroPlanSetValue(id, value){
    const el = document.getElementById(id);
    if(el) el.value = value || '';
}

function auroPlanGetValue(id){
    const el = document.getElementById(id);
    return el ? String(el.value || '') : '';
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
