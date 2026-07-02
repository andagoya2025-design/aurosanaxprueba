/****************************************************************
 AUROSANAX ERP
 plan.js
 MODULACIÓN PLAN - FASE 5 EVALUACIONES
 ---------------------------------------------------------------
 OBJETIVO:
 - Mantener Fase 3 estable.
 - Agregar módulo de Evaluaciones y mantener utilidades:
   auroPlanSetValue()
   auroPlanGetValue()
 - Integrar EVALUACIONES sin romper medicamentos, órdenes ni interconsultas.
 - NO tocar botón Guardar historia / Actualizar plan.
 - NO usar MutationObserver.
 - NO interceptar navegación.
 - NO tocar Dashboard, Pacientes, Agenda, Atenciones ni Recetas emitidas.

 CONTIENE:
 - Estado temporal por id_atencion.
 - Limpieza del Plan al cambiar consulta.
 - Medicamentos del Plan.
 - Órdenes médicas.
 - Interconsulta:
   * agregar interconsulta temporal
   * eliminar interconsulta temporal
   * recopilar interconsulta desde campos visibles
   * limpiar interconsulta
   * guardar/restaurar por consulta
 - Responsive móvil Android/teléfono.
****************************************************************/


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

function escapeHtmlPlan(txt){
    return String(txt || '').replace(/[&<>'"]/g, c => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        "'":'&#39;',
        '"':'&quot;'
    }[c]));
}

function escapeHtmlMed(txt){
    return escapeHtmlPlan(txt);
}

function normalizarTextoPlan(t){
    return String(t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .trim();
}


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

window.ordenesMedicasPlanSeleccionadas = Array.isArray(window.ordenesMedicasPlanSeleccionadas)
    ? window.ordenesMedicasPlanSeleccionadas
    : [];

window.interconsultasPlanSeleccionadas = Array.isArray(window.interconsultasPlanSeleccionadas)
    ? window.interconsultasPlanSeleccionadas
    : [];


/* ============================================================
   CATÁLOGO BASE DE MEDICAMENTOS
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
   CATÁLOGO BASE DE ÓRDENES MÉDICAS
============================================================ */

window.ORDENES_MEDICAS_AUROSANAX_BASE = window.ORDENES_MEDICAS_AUROSANAX_BASE || [
    {cat:'LABORATORIOS', orden:'Biometría hemática completa'},
    {cat:'LABORATORIOS', orden:'Glucosa en ayunas'},
    {cat:'LABORATORIOS', orden:'Insulina basal'},
    {cat:'LABORATORIOS', orden:'Hemoglobina glicosilada HbA1c'},
    {cat:'LABORATORIOS', orden:'Perfil lipídico'},
    {cat:'LABORATORIOS', orden:'Perfil hepático'},
    {cat:'LABORATORIOS', orden:'Perfil renal'},
    {cat:'LABORATORIOS', orden:'TSH'},
    {cat:'LABORATORIOS', orden:'T4 libre'},
    {cat:'LABORATORIOS', orden:'Vitamina D'},
    {cat:'LABORATORIOS', orden:'Ferritina'},
    {cat:'LABORATORIOS', orden:'Uroanálisis'},
    {cat:'LABORATORIOS', orden:'Urocultivo + antibiograma'},
    {cat:'GINECOLOGÍA', orden:'Papanicolaou'},
    {cat:'GINECOLOGÍA', orden:'Colposcopia'},
    {cat:'GINECOLOGÍA', orden:'Biopsia cervical'},
    {cat:'GINECOLOGÍA', orden:'Cultivo vaginal'},
    {cat:'GINECOLOGÍA', orden:'Examen fresco de secreción vaginal'},
    {cat:'GINECOLOGÍA', orden:'Prueba HPV'},
    {cat:'IMÁGENES', orden:'Ecografía transvaginal'},
    {cat:'IMÁGENES', orden:'Ecografía pélvica'},
    {cat:'IMÁGENES', orden:'Ecografía mamaria'},
    {cat:'IMÁGENES', orden:'Mamografía bilateral'},
    {cat:'IMÁGENES', orden:'Densitometría ósea'},
    {cat:'OBSTETRICIA', orden:'Ecografía obstétrica'},
    {cat:'OBSTETRICIA', orden:'Ecografía morfológica'},
    {cat:'OBSTETRICIA', orden:'Doppler obstétrico'},
    {cat:'OBSTETRICIA', orden:'Monitoreo fetal'},
    {cat:'MATERNO FETAL', orden:'Valoración materno fetal'},
    {cat:'CARDIOLOGÍA', orden:'Electrocardiograma'},
    {cat:'CARDIOLOGÍA', orden:'Ecocardiograma'},
    {cat:'PROCEDIMIENTOS', orden:'Láser CO2 fraccionado'},
    {cat:'PROCEDIMIENTOS', orden:'Depilación láser diodo'},
    {cat:'PROCEDIMIENTOS', orden:'HIFU'},
    {cat:'PROCEDIMIENTOS', orden:'PRP'},
    {cat:'OTROS', orden:'Control médico'}
];


/* ============================================================
   INICIALIZACIÓN
============================================================ */

function inicializarPlan(){

    if(!Array.isArray(window.medicamentosPlanSeleccionados)){
        window.medicamentosPlanSeleccionados = [];
    }

    if(!Array.isArray(window.ordenesMedicasPlanSeleccionadas)){
        window.ordenesMedicasPlanSeleccionadas = [];
    }

    if(!Array.isArray(window.interconsultasPlanSeleccionadas)){
        window.interconsultasPlanSeleccionadas = [];
    }

    if(!window.planState){
        window.planState = {
            atencionActual:'',
            cache:{}
        };
    }

    instalarResponsivePlanAndroid();
    instalarEventosMedicamentosPlan();
    instalarEventosOrdenesMedicasPlan();
    instalarEventosEvaluacionesPlan();
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

    if(!window.planState){
        window.planState = { atencionActual:'', cache:{} };
    }

    if(!window.planState.atencionActual) return;

    window.planState.cache[window.planState.atencionActual] = {

        medicamentos: JSON.parse(
            JSON.stringify(window.medicamentosPlanSeleccionados || [])
        ),

        ordenes: JSON.parse(
            JSON.stringify(window.ordenesMedicasPlanSeleccionadas || [])
        ),

        interconsultas: JSON.parse(
            JSON.stringify(window.interconsultasPlanSeleccionadas || [])
        ),

        plan:
            document.getElementById('hcPlanTratamiento')?.value || '',

        indicaciones:
            document.getElementById('hcIndicacionesPaciente')?.value || '',

        ordenesTexto:
            document.getElementById('hcExamenesSolicitados')?.value || '',

        interconsultaTexto:
            document.getElementById('hcInterconsultaResumen')?.value || '',

        evaluaciones:
            document.getElementById('hcEvaluacionesResumen')?.value || '',

        evaluacionesChecks:
            auroPlanCapturarEvaluaciones(),

        receta:
            document.getElementById('hcRecetaMedicamentos')?.value || ''
    };
}


/* ============================================================
   CARGAR PLAN TEMPORAL POR ATENCIÓN
============================================================ */

function cargarPlanTemporal(idAtencion){

    idAtencion = String(idAtencion || '').trim();

    limpiarPlanTemporal();

    const data = window.planState.cache[idAtencion];

    if(!data){
        auroPlanRefrescarVistas();
        return;
    }

    window.medicamentosPlanSeleccionados =
        JSON.parse(JSON.stringify(data.medicamentos || []));

    window.ordenesMedicasPlanSeleccionadas =
        JSON.parse(JSON.stringify(data.ordenes || []));

    window.interconsultasPlanSeleccionadas =
        JSON.parse(JSON.stringify(data.interconsultas || []));

    auroPlanSetValue('hcPlanTratamiento', data.plan || '');
    auroPlanSetValue('hcIndicacionesPaciente', data.indicaciones || '');
    auroPlanSetValue('hcExamenesSolicitados', data.ordenesTexto || '');
    auroPlanSetValue('hcInterconsultaResumen', data.interconsultaTexto || '');
    auroPlanSetValue('hcEvaluacionesResumen', data.evaluaciones || '');
    auroPlanRestaurarEvaluaciones(data.evaluacionesChecks || {});
    auroPlanSetValue('hcRecetaMedicamentos', data.receta || '');

    auroPlanRefrescarVistas();
}


/* ============================================================
   LIMPIAR PLAN TEMPORAL
============================================================ */

function limpiarPlanTemporal(){

    window.medicamentosPlanSeleccionados = [];
    window.ordenesMedicasPlanSeleccionadas = [];
    window.interconsultasPlanSeleccionadas = [];

    const campos = [
        'hcPlanTratamiento',
        'hcIndicacionesPaciente',
        'hcRecetaMedicamentos',
        'hcExamenesSolicitados',
        'hcInterconsultaResumen',
        'hcEvaluacionesResumen',
        'hcInterconsultaTipo',
        'hcInterconsultaEspecialidad',
        'hcInterconsultaProfesional',
        'hcInterconsultaMotivo',
        'hcInterconsultaObservaciones'
    ];

    campos.forEach(id => auroPlanSetValue(id, ''));

    auroPlanSetValue('hcInterconsultaPrioridad', 'Normal');
    auroPlanSetValue('hcInterconsultaEstado', 'Pendiente');

    limpiarEvaluacionesCamposPlan();

    auroPlanRefrescarVistas();
}


/* ============================================================
   MEDICAMENTOS DEL PLAN
============================================================ */

function normalizarMedTexto(t){
    return normalizarTextoPlan(t);
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
             data-med="${escapeHtmlPlan(m.med)}"
             data-pres="${escapeHtmlPlan(m.pres)}"
             data-via="${escapeHtmlPlan(m.via)}"
             data-frec="${escapeHtmlPlan(m.frec)}"
             data-dur="${escapeHtmlPlan(m.dur)}"
             data-ind="${escapeHtmlPlan(m.ind)}">
          <div>• ${escapeHtmlPlan(m.med)} <span class="text-muted">${escapeHtmlPlan(m.pres)}</span></div>
          <div class="med-sug-cat">${escapeHtmlPlan(m.cat)}</div>
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
              <td>${escapeHtmlPlan(m.med)}</td>
              <td>${escapeHtmlPlan(m.pres)}</td>
              <td>${escapeHtmlPlan(m.via)}</td>
              <td>${escapeHtmlPlan(m.cantidad)}</td>
              <td>${escapeHtmlPlan(m.frec)}</td>
              <td>${escapeHtmlPlan(m.dur)}</td>
              <td>${escapeHtmlPlan(m.ind)}</td>
              <td>${escapeHtmlPlan(m.continuo)}</td>
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
   ÓRDENES MÉDICAS DEL PLAN
============================================================ */

function normalizarOrdenTexto(t){
    return normalizarTextoPlan(t);
}

function renderOrdenesSugerencias(){

    const input = document.getElementById('hcOrdenBusqueda');
    const box = document.getElementById('hcOrdenSugerencias');

    if(!input || !box) return;

    const q = normalizarOrdenTexto(input.value);
    const tipoFiltro = normalizarOrdenTexto(auroPlanGetValue('hcOrdenTipo'));

    const base = Array.isArray(window.ORDENES_MEDICAS_AUROSANAX_BASE)
        ? window.ORDENES_MEDICAS_AUROSANAX_BASE
        : [];

    const res = base
        .filter(o => {
            const texto = normalizarOrdenTexto((o.orden || '') + ' ' + (o.cat || ''));
            const coincideTexto = !q || texto.includes(q);
            const coincideTipo = !tipoFiltro || normalizarOrdenTexto(o.cat || '').includes(tipoFiltro);
            return coincideTexto && coincideTipo;
        })
        .slice(0,40);

    if(!res.length){
        box.innerHTML =
            '<div class="orden-sug-item text-muted">Sin coincidencias. Puede escribirlo manualmente y agregar.</div>';
        box.classList.remove('d-none');
        return;
    }

    box.innerHTML = res.map(o => `
        <div class="orden-sug-item"
             data-orden="${escapeHtmlPlan(o.orden)}"
             data-cat="${escapeHtmlPlan(o.cat)}">
          <div>• ${escapeHtmlPlan(o.orden)}</div>
          <div class="orden-sug-cat">${escapeHtmlPlan(o.cat)}</div>
        </div>
    `).join('');

    box.classList.remove('d-none');
}

function seleccionarOrdenSugerida(el){

    if(!el) return;

    auroPlanSetValue('hcOrdenBusqueda', el.dataset.orden || '');
    auroPlanSetValue('hcOrdenTipo', el.dataset.cat || '');

    const box = document.getElementById('hcOrdenSugerencias');
    if(box) box.classList.add('d-none');
}

function limpiarFormularioOrdenMedica(){

    auroPlanSetValue('hcOrdenTipo', '');
    auroPlanSetValue('hcOrdenBusqueda', '');
    auroPlanSetValue('hcOrdenObservacion', '');

    const box = document.getElementById('hcOrdenSugerencias');
    if(box) box.classList.add('d-none');
}

function agregarOrdenMedicaDesdeFormulario(){

    const orden = (auroPlanGetValue('hcOrdenBusqueda') || '').trim();

    if(!orden){
        alert('Ingrese o seleccione una orden médica.');
        return;
    }

    window.ordenesMedicasPlanSeleccionadas.push({
        orden,
        cat: auroPlanGetValue('hcOrdenTipo') || 'OTROS',
        obs: auroPlanGetValue('hcOrdenObservacion')
    });

    limpiarFormularioOrdenMedica();
    renderOrdenesMedicasTabla();
    recopilarOrdenesMedicasPlan();
    guardarPlanTemporal();
}

function eliminarOrdenMedica(i){

    i = Number(i);

    if(Number.isNaN(i)) return;

    window.ordenesMedicasPlanSeleccionadas.splice(i,1);

    renderOrdenesMedicasTabla();
    recopilarOrdenesMedicasPlan();
    guardarPlanTemporal();
}

function renderOrdenesMedicasTabla(){

    const tbody = document.getElementById('hcOrdenesTableBody');

    if(!tbody) return;

    const ordenes = window.ordenesMedicasPlanSeleccionadas || [];

    if(!ordenes.length){

        tbody.innerHTML = `
            <tr id="hcOrdenesEmpty">
              <td colspan="4" class="text-center text-muted py-3">
                <i class="bi bi-file-earmark-medical me-1"></i> Sin registros
              </td>
            </tr>
        `;

        auroPlanSetValue('hcExamenesSolicitados', '');
        return;
    }

    tbody.innerHTML = ordenes.map((o,i) => `
        <tr>
          <td>${escapeHtmlPlan(o.orden)}</td>
          <td>${escapeHtmlPlan(o.cat)}</td>
          <td>${escapeHtmlPlan(o.obs)}</td>
          <td>
            <button type="button"
                    class="btn btn-sm btn-outline-danger"
                    onclick="eliminarOrdenMedica(${i})">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
    `).join('');

    recopilarOrdenesMedicasPlan();
}

function textoOrdenesMedicasPlan(){

    return (window.ordenesMedicasPlanSeleccionadas || []).map((o,i) => {
        return [
            `${i + 1}. ${o.orden || ''}`,
            o.cat ? `Categoría: ${o.cat}` : '',
            o.obs ? `Observación: ${o.obs}` : ''
        ].filter(Boolean).join(' - ');
    }).join('\n');
}

function recopilarOrdenesMedicasPlan(){

    auroPlanSetValue('hcExamenesSolicitados', textoOrdenesMedicasPlan());

    return auroPlanGetValue('hcExamenesSolicitados');
}

function limpiarOrdenesMedicasPlan(){

    window.ordenesMedicasPlanSeleccionadas = [];

    renderOrdenesMedicasTabla();
    recopilarOrdenesMedicasPlan();
    guardarPlanTemporal();
}


/* ============================================================
   INTERCONSULTAS DEL PLAN
============================================================ */

function recopilarInterconsultaPlan(){

    const tipo = auroPlanGetValue('hcInterconsultaTipo');
    const especialidad = auroPlanGetValue('hcInterconsultaEspecialidad');
    const prioridad = auroPlanGetValue('hcInterconsultaPrioridad') || 'Normal';
    const profesional = auroPlanGetValue('hcInterconsultaProfesional');
    const estado = auroPlanGetValue('hcInterconsultaEstado') || 'Pendiente';
    const motivo = auroPlanGetValue('hcInterconsultaMotivo');
    const observaciones = auroPlanGetValue('hcInterconsultaObservaciones');

    const partes = [];

    if(tipo) partes.push('Tipo: ' + tipo);
    if(especialidad) partes.push('Especialidad: ' + especialidad);
    if(prioridad) partes.push('Prioridad: ' + prioridad);
    if(profesional) partes.push('Profesional: ' + profesional);
    if(estado) partes.push('Estado: ' + estado);
    if(motivo) partes.push('Motivo: ' + motivo);
    if(observaciones) partes.push('Observaciones: ' + observaciones);

    const textoFormulario = partes.join('\n');

    if(textoFormulario){
        auroPlanSetValue('hcInterconsultaResumen', textoFormulario);
        return textoFormulario;
    }

    const textoLista = (window.interconsultasPlanSeleccionadas || [])
        .map((it,i) => {
            return [
                `${i + 1}. ${it.especialidad || ''}`,
                it.tipo ? `Tipo: ${it.tipo}` : '',
                it.prioridad ? `Prioridad: ${it.prioridad}` : '',
                it.profesional ? `Profesional: ${it.profesional}` : '',
                it.estado ? `Estado: ${it.estado}` : '',
                it.motivo ? `Motivo: ${it.motivo}` : '',
                it.observaciones ? `Observaciones: ${it.observaciones}` : ''
            ].filter(Boolean).join(' - ');
        }).join('\n');

    auroPlanSetValue('hcInterconsultaResumen', textoLista);

    return textoLista;
}

function agregarInterconsultaPlan(){

    const especialidad = (auroPlanGetValue('hcInterconsultaEspecialidad') || '').trim();

    if(!especialidad){
        alert('Seleccione una especialidad.');
        return;
    }

    window.interconsultasPlanSeleccionadas.push({
        tipo: auroPlanGetValue('hcInterconsultaTipo'),
        especialidad,
        prioridad: auroPlanGetValue('hcInterconsultaPrioridad') || 'Normal',
        profesional: auroPlanGetValue('hcInterconsultaProfesional'),
        estado: auroPlanGetValue('hcInterconsultaEstado') || 'Pendiente',
        motivo: auroPlanGetValue('hcInterconsultaMotivo'),
        observaciones: auroPlanGetValue('hcInterconsultaObservaciones')
    });

    renderInterconsultasTabla();
    recopilarInterconsultaPlan();
    guardarPlanTemporal();
}

function eliminarInterconsultaPlan(index){

    index = Number(index);

    if(Number.isNaN(index)) return;

    window.interconsultasPlanSeleccionadas.splice(index,1);

    renderInterconsultasTabla();
    recopilarInterconsultaPlan();
    guardarPlanTemporal();
}

function limpiarFormularioInterconsulta(){

    auroPlanSetValue('hcInterconsultaTipo','');
    auroPlanSetValue('hcInterconsultaEspecialidad','');
    auroPlanSetValue('hcInterconsultaProfesional','');
    auroPlanSetValue('hcInterconsultaMotivo','');
    auroPlanSetValue('hcInterconsultaObservaciones','');
    auroPlanSetValue('hcInterconsultaPrioridad','Normal');
    auroPlanSetValue('hcInterconsultaEstado','Pendiente');
}

function renderInterconsultasTabla(){

    const tbody = document.getElementById('hcInterconsultasTableBody');

    if(!tbody) return;

    const lista = window.interconsultasPlanSeleccionadas || [];

    if(!lista.length){
        tbody.innerHTML = `
            <tr>
              <td colspan="7" class="text-center text-muted py-3">
                Sin interconsultas registradas
              </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lista.map((it,i) => `
        <tr>
          <td>${escapeHtmlPlan(it.tipo)}</td>
          <td>${escapeHtmlPlan(it.especialidad)}</td>
          <td>${escapeHtmlPlan(it.prioridad)}</td>
          <td>${escapeHtmlPlan(it.profesional)}</td>
          <td>${escapeHtmlPlan(it.estado)}</td>
          <td>${escapeHtmlPlan(it.motivo)}</td>
          <td>
            <button type="button"
                    class="btn btn-sm btn-outline-danger"
                    onclick="eliminarInterconsultaPlan(${i})">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
    `).join('');
}

function limpiarInterconsultaPlan(){

    window.interconsultasPlanSeleccionadas = [];

    limpiarFormularioInterconsulta();
    renderInterconsultasTabla();
    auroPlanSetValue('hcInterconsultaResumen','');
    guardarPlanTemporal();
}



/* ============================================================
   EVALUACIONES DEL PLAN
============================================================ */

const AURO_PLAN_EVALUACIONES = [
    {
        id: 'hcEvalMalaActitud',
        texto: 'Denota mala actitud ante el examinador.'
    },
    {
        id: 'hcEvalAnimo',
        texto: 'Alteraciones del estado de ánimo.'
    },
    {
        id: 'hcEvalAbusoNegligencia',
        texto: 'Sospecha psicológica: paciente víctima de abuso o negligencia.'
    },
    {
        id: 'hcEvalAnomaliasMotoras',
        texto: 'Evidencia actividades y anomalías motoras.'
    },
    {
        id: 'hcEvalOdontologica',
        texto: 'Requiere evaluación odontológica.'
    }
];

function auroPlanCapturarEvaluaciones(){

    const data = {};

    AURO_PLAN_EVALUACIONES.forEach(item => {
        const el = document.getElementById(item.id);
        data[item.id] = !!(el && el.checked);
    });

    return data;
}

function auroPlanRestaurarEvaluaciones(data){

    data = data || {};

    AURO_PLAN_EVALUACIONES.forEach(item => {
        const el = document.getElementById(item.id);
        if(el) el.checked = !!data[item.id];
    });

    recopilarEvaluacionesPlan();
}

function recopilarEvaluacionesPlan(){

    const seleccionadas = [];

    AURO_PLAN_EVALUACIONES.forEach(item => {
        const el = document.getElementById(item.id);
        if(el && el.checked){
            seleccionadas.push(item.texto);
        }
    });

    const texto = seleccionadas.join('\n');

    auroPlanSetValue('hcEvaluacionesResumen', texto);

    return texto;
}

function limpiarEvaluacionesCamposPlan(){

    AURO_PLAN_EVALUACIONES.forEach(item => {
        const el = document.getElementById(item.id);
        if(el) el.checked = false;
    });

    auroPlanSetValue('hcEvaluacionesResumen', '');
}

function limpiarEvaluacionesPlan(){

    limpiarEvaluacionesCamposPlan();
    guardarPlanTemporal();
}

/* ============================================================
   EVENTOS EVALUACIONES PLAN
============================================================ */

function instalarEventosEvaluacionesPlan(){

    if(window.auroPlanEvaluacionesEventosInstalados) return;
    window.auroPlanEvaluacionesEventosInstalados = true;

    document.addEventListener('change', function(e){

        const id = e.target?.id || '';

        if(AURO_PLAN_EVALUACIONES.some(item => item.id === id)){
            recopilarEvaluacionesPlan();
            guardarPlanTemporal();
        }
    });
}


/* ============================================================
   EVENTOS MEDICAMENTOS PLAN
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
   EVENTOS ÓRDENES MÉDICAS PLAN
============================================================ */

function instalarEventosOrdenesMedicasPlan(){

    if(window.auroPlanOrdenesEventosInstalados) return;
    window.auroPlanOrdenesEventosInstalados = true;

    document.addEventListener('input', function(e){
        if(e.target && e.target.id === 'hcOrdenBusqueda'){
            renderOrdenesSugerencias();
        }
    });

    document.addEventListener('focusin', function(e){
        if(e.target && e.target.id === 'hcOrdenBusqueda'){
            renderOrdenesSugerencias();
        }
    });

    document.addEventListener('change', function(e){
        if(e.target && e.target.id === 'hcOrdenTipo'){
            renderOrdenesSugerencias();
        }
    });

    document.addEventListener('click', function(e){

        const item = e.target.closest('.orden-sug-item[data-orden]');

        if(item){
            seleccionarOrdenSugerida(item);
            return;
        }

        const box = document.getElementById('hcOrdenSugerencias');

        if(
            box &&
            !e.target.closest('#hcOrdenSugerencias') &&
            e.target.id !== 'hcOrdenBusqueda'
        ){
            box.classList.add('d-none');
        }
    });
}


/* ============================================================
   SINCRONIZACIÓN AUXILIAR ANTES DE GUARDAR
============================================================ */

function auroSincronizarPlanAntesGuardar(){

    if(typeof recopilarEvaluacionesPlan === 'function'){
        recopilarEvaluacionesPlan();
    }

    recopilarInterconsultaPlan();
    recopilarOrdenesMedicasPlan();

    renderMedicamentosPlanTabla();
    renderOrdenesMedicasTabla();
    renderInterconsultasTabla();

    sincronizarPlanConReceta();
    guardarPlanTemporal();
}


/* ============================================================
   REFRESCAR VISTAS DEL PLAN
============================================================ */

function auroPlanRefrescarVistas(){

    renderMedicamentosPlanTabla();
    sincronizarPlanConReceta();

    renderOrdenesMedicasTabla();
    recopilarOrdenesMedicasPlan();

    renderInterconsultasTabla();
    recopilarInterconsultaPlan();

    if(typeof recopilarEvaluacionesPlan === 'function'){
        recopilarEvaluacionesPlan();
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
   PERSISTENCIA DEFINITIVA PLAN → GOOGLE SHEETS
   Pestaña: planes_clinicos
   Requiere Apps Script con acciones:
   - guardarPlanClinico
   - editarPlanClinico
   - buscarPlanPorAtencion
============================================================ */

function auroPlanApiUrl(){
    try{
        if(typeof API_URL !== 'undefined' && API_URL) return API_URL;
    }catch(e){}

    if(window.API_URL) return window.API_URL;

    const input = document.getElementById('appsScriptUrl');
    if(input && input.value) return input.value.trim();

    return '';
}

async function auroPlanApiGet(accion, params){

    const urlBase = auroPlanApiUrl();

    if(!urlBase){
        throw new Error('No se encontró API_URL para conectar con Apps Script.');
    }

    const query = new URLSearchParams({
        accion: accion
    });

    Object.keys(params || {}).forEach(k => {
        if(params[k] !== undefined && params[k] !== null){
            query.append(k, params[k]);
        }
    });

    const res = await fetch(urlBase + '?' + query.toString());
    return await res.json();
}

async function auroPlanApiPost(accion, data){

    const urlBase = auroPlanApiUrl();

    if(!urlBase){
        throw new Error('No se encontró API_URL para conectar con Apps Script.');
    }

    const res = await fetch(urlBase, {
        method: 'POST',
        body: JSON.stringify({
            accion: accion,
            data: data || {}
        })
    });

    return await res.json();
}

function auroPlanObtenerPacienteActivoSeguro(){

    try{
        if(typeof getPacienteActivo === 'function'){
            const p = getPacienteActivo();
            if(p) return p;
        }
    }catch(e){}

    const idSelect = document.getElementById('hcPacienteSelect')?.value || '';

    try{
        if(Array.isArray(patients)){
            return patients.find(p =>
                String(p.id_paciente || '') === String(idSelect || '')
            ) || null;
        }
    }catch(e){}

    return null;
}

function auroPlanObtenerHistoriaIdSeguro(){

    try{
        if(typeof editingHistoryId !== 'undefined' && editingHistoryId){
            return editingHistoryId;
        }
    }catch(e){}

    const h = document.getElementById('hcIdHistoria')?.value || '';
    return h || '';
}

function auroPlanObtenerMedicoIdSeguro(){

    try{
        if(typeof obtenerIdMedicoReal === 'function'){
            const id = obtenerIdMedicoReal();
            if(id) return id;
        }
    }catch(e){}

    const el = document.getElementById('hcIdMedico');
    if(el && el.value) return el.value;

    return 'MED-AUROSANAX';
}

function auroPlanPrepararDatosSheets(){

    auroSincronizarPlanAntesGuardar();

    const paciente = auroPlanObtenerPacienteActivoSeguro();

    return {
        id_atencion:
            String(window.planState?.atencionActual || '').trim(),

        id_paciente:
            paciente?.id_paciente ||
            document.getElementById('hcPacienteSelect')?.value ||
            '',

        id_historia:
            auroPlanObtenerHistoriaIdSeguro(),

        id_medico:
            auroPlanObtenerMedicoIdSeguro(),

        fecha_plan:
            new Date().toISOString(),

        plan_terapeutico:
            auroPlanGetValue('hcPlanTratamiento'),

        medicamentos_plan:
            JSON.stringify(window.medicamentosPlanSeleccionados || []),

        receta_medica:
            auroPlanGetValue('hcRecetaMedicamentos'),

        ordenes_medicas:
            auroPlanGetValue('hcExamenesSolicitados'),

        interconsulta:
            auroPlanGetValue('hcInterconsultaResumen'),

        evaluaciones_plan:
            auroPlanGetValue('hcEvaluacionesResumen'),

        indicaciones_paciente:
            auroPlanGetValue('hcIndicacionesPaciente'),

        proximo_control:
            auroPlanGetValue('hcControl'),

        estado_plan:
            auroPlanGetValue('hcEstadoHistoria') || 'Activo'
    };
}

async function buscarPlanClinicoPorAtencionDesdeSheets(idAtencion){

    idAtencion = String(idAtencion || window.planState?.atencionActual || '').trim();

    if(!idAtencion) return null;

    const data = await auroPlanApiGet(
        'buscarPlanPorAtencion',
        { id_atencion: idAtencion }
    );

    return data || null;
}

async function guardarPlanClinicoDesdeSheets(){

    const data = auroPlanPrepararDatosSheets();

    if(!data.id_atencion){
        console.warn('Plan no guardado: no existe id_atencion actual.');
        return {
            success: false,
            message: 'No existe id_atencion actual para guardar el Plan.'
        };
    }

    const existente = await buscarPlanClinicoPorAtencionDesdeSheets(
        data.id_atencion
    );

    if(existente && existente.id_plan){
        data.id_plan = existente.id_plan;
        return await auroPlanApiPost('editarPlanClinico', data);
    }

    return await auroPlanApiPost('guardarPlanClinico', data);
}

async function cargarPlanClinicoDesdeSheets(idAtencion){

    idAtencion = String(idAtencion || window.planState?.atencionActual || '').trim();

    if(!idAtencion) return null;

    const plan = await buscarPlanClinicoPorAtencionDesdeSheets(idAtencion);

    if(!plan || !plan.id_plan) return null;

    window.planState = window.planState || {
        atencionActual: idAtencion,
        cache: {}
    };

    window.planState.atencionActual = idAtencion;

    try{
        window.medicamentosPlanSeleccionados =
            JSON.parse(plan.medicamentos_plan || '[]');
    }catch(e){
        window.medicamentosPlanSeleccionados = [];
    }

    auroPlanSetValue('hcPlanTratamiento', plan.plan_terapeutico || '');
    auroPlanSetValue('hcRecetaMedicamentos', plan.receta_medica || '');
    auroPlanSetValue('hcExamenesSolicitados', plan.ordenes_medicas || '');
    auroPlanSetValue('hcInterconsultaResumen', plan.interconsulta || '');
    auroPlanSetValue('hcEvaluacionesResumen', plan.evaluaciones_plan || '');
    auroPlanSetValue('hcIndicacionesPaciente', plan.indicaciones_paciente || '');
    auroPlanSetValue('hcControl', plan.proximo_control || '');
    auroPlanSetValue('hcEstadoHistoria', plan.estado_plan || 'Activo');

    guardarPlanTemporal();
    auroPlanRefrescarVistas();

    return plan;
}

window.guardarPlanClinicoDesdeSheets = guardarPlanClinicoDesdeSheets;
window.buscarPlanClinicoPorAtencionDesdeSheets = buscarPlanClinicoPorAtencionDesdeSheets;
window.cargarPlanClinicoDesdeSheets = cargarPlanClinicoDesdeSheets;


/* ============================================================
   INICIO SEGURO
============================================================ */

document.addEventListener('DOMContentLoaded', function(){
    inicializarPlan();
});

setTimeout(function(){
    inicializarPlan();
}, 800);
