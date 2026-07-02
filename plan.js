/****************************************************************
 AUROSANAX ERP
 plan.js
 MODULACIÓN PLAN - FASE 3
 ---------------------------------------------------------------
 OBJETIVO:
 - Mantener Fase 2 estable.
 - Agregar módulo de ÓRDENES MÉDICAS DEL PLAN.
 - NO tocar botón Guardar historia / Actualizar plan.
 - NO usar MutationObserver.
 - NO interceptar navegación.
 - NO tocar Dashboard, Pacientes, Agenda, Atenciones ni Recetas emitidas.

 CONTIENE:
 - Estado temporal por id_atencion.
 - Limpieza del Plan al cambiar consulta.
 - Medicamentos del Plan completos.
 - Órdenes médicas:
   * búsqueda / sugerencias
   * agregar orden
   * eliminar orden
   * render tabla
   * sincronización con hcExamenesSolicitados
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

window.ordenesMedicasPlanSeleccionadas = Array.isArray(window.ordenesMedicasPlanSeleccionadas)
    ? window.ordenesMedicasPlanSeleccionadas
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

    if(!window.planState){
        window.planState = {
            atencionActual:'',
            cache:{}
        };
    }

    instalarResponsivePlanAndroid();
    instalarEventosMedicamentosPlan();
    instalarEventosOrdenesMedicasPlan();
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

        ordenes: JSON.parse(
            JSON.stringify(window.ordenesMedicasPlanSeleccionadas || [])
        ),

        plan:
            document.getElementById('hcPlanTratamiento')?.value || '',

        indicaciones:
            document.getElementById('hcIndicacionesPaciente')?.value || '',

        ordenesTexto:
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

    window.ordenesMedicasPlanSeleccionadas =
        JSON.parse(JSON.stringify(data.ordenes || []));

    auroPlanSetValue('hcPlanTratamiento', data.plan || '');
    auroPlanSetValue('hcIndicacionesPaciente', data.indicaciones || '');
    auroPlanSetValue('hcExamenesSolicitados', data.ordenesTexto || '');
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
    window.ordenesMedicasPlanSeleccionadas = [];

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
   ÓRDENES MÉDICAS DEL PLAN
============================================================ */

function normalizarOrdenTexto(t){
    return String(t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .trim();
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

    if(typeof recopilarInterconsultaPlan === 'function'){
        recopilarInterconsultaPlan();
    }

    recopilarOrdenesMedicasPlan();

    renderMedicamentosPlanTabla();
    renderOrdenesMedicasTabla();
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
