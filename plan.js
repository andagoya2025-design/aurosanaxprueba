/****************************************************************
 AUROSANAX ERP
 plan.js
 ACTUALIZACIÓN QUIRÚRGICA: CONTEXTO UNIFICADO POR ATENCIÓN v20
 MODULACIÓN PLAN - FASE 5 EVALUACIONES / NAVEGACIÓN SEGURA
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
 - Persistencia JSON uniforme para medicamentos, órdenes, interconsultas y evaluaciones.
 - Captura automática de interconsulta al actualizar el Plan.
 - Edición segura de medicamentos sin alterar persistencia por id_atencion.
 - Vías visibles con nombre completo, conservando valores internos compatibles.
 - Ayudas rápidas para frecuencia, duración e indicaciones.
 - Ampliación controlada de la tabla solo en escritorio.
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
   UX CLÍNICA SEGURA PARA MEDICAMENTOS
   - No modifica nombres de propiedades ni estructura JSON.
   - Mantiene compatibilidad con protocolos, Plan y Recetas.
============================================================ */

window.auroPlanMedicamentoEditandoIndice =
    Number.isInteger(window.auroPlanMedicamentoEditandoIndice)
        ? window.auroPlanMedicamentoEditandoIndice
        : null;

const AURO_PLAN_VIAS_COMPLETAS = {
    'VO': 'Vía oral',
    'ORAL': 'Vía oral',
    'VÍA ORAL': 'Vía oral',
    'VIA ORAL': 'Vía oral',
    'IM': 'Vía intramuscular',
    'INTRAMUSCULAR': 'Vía intramuscular',
    'VÍA INTRAMUSCULAR': 'Vía intramuscular',
    'VIA INTRAMUSCULAR': 'Vía intramuscular',
    'IV': 'Vía intravenosa',
    'INTRAVENOSA': 'Vía intravenosa',
    'VÍA INTRAVENOSA': 'Vía intravenosa',
    'VIA INTRAVENOSA': 'Vía intravenosa',
    'SC': 'Vía subcutánea',
    'SUBCUTÁNEA': 'Vía subcutánea',
    'SUBCUTANEA': 'Vía subcutánea',
    'VÍA SUBCUTÁNEA': 'Vía subcutánea',
    'VIA SUBCUTANEA': 'Vía subcutánea',
    'VAGINAL': 'Vía vaginal',
    'VÍA VAGINAL': 'Vía vaginal',
    'VIA VAGINAL': 'Vía vaginal',
    'TÓPICA': 'Vía tópica',
    'TOPICA': 'Vía tópica',
    'VÍA TÓPICA': 'Vía tópica',
    'VIA TOPICA': 'Vía tópica',
    'SUBLINGUAL': 'Vía sublingual',
    'VÍA SUBLINGUAL': 'Vía sublingual',
    'VIA SUBLINGUAL': 'Vía sublingual',
    'OFTÁLMICA': 'Vía oftálmica',
    'OFTALMICA': 'Vía oftálmica',
    'VÍA OFTÁLMICA': 'Vía oftálmica',
    'VIA OFTALMICA': 'Vía oftálmica',
    'ÓTICA': 'Vía ótica',
    'OTICA': 'Vía ótica',
    'VÍA ÓTICA': 'Vía ótica',
    'VIA OTICA': 'Vía ótica',
    'INHALATORIA': 'Vía inhalatoria',
    'VÍA INHALATORIA': 'Vía inhalatoria',
    'VIA INHALATORIA': 'Vía inhalatoria',
    'RECTAL': 'Vía rectal',
    'VÍA RECTAL': 'Vía rectal',
    'VIA RECTAL': 'Vía rectal',
    'NASAL': 'Vía nasal',
    'VÍA NASAL': 'Vía nasal',
    'VIA NASAL': 'Vía nasal'
};

const AURO_PLAN_FRECUENCIAS_RAPIDAS = [
    'Dosis única',
    'Cada 4 horas',
    'Cada 6 horas',
    'Cada 8 horas',
    'Cada 12 horas',
    'Cada 24 horas',
    'Cada mañana',
    'Cada noche',
    'Dos veces al día',
    'Tres veces al día',
    'Según necesidad',
    'Según esquema médico'
];

const AURO_PLAN_DURACIONES_RAPIDAS = [
    '1 día',
    '2 días',
    '3 días',
    '5 días',
    '7 días',
    '10 días',
    '14 días',
    '21 días',
    '30 días',
    '3 a 5 días',
    '5 a 7 días',
    '7 noches',
    'Tratamiento continuo',
    'Según evolución',
    'Según indicación médica'
];

const AURO_PLAN_INDICACIONES_RAPIDAS = [
    'Tomar después de alimentos.',
    'Tomar antes de alimentos.',
    'Tomar con alimentos.',
    'Aplicar antes de dormir.',
    'Aplicar por la noche.',
    'Aplicar una capa fina.',
    'Agitar antes de usar.',
    'Uso externo.',
    'Completar el tratamiento.',
    'No suspender aunque mejoren los síntomas.',
    'Según necesidad.',
    'Según indicación médica.'
];

function auroPlanNombreViaCompleta(valor){
    const original = String(valor || '').trim();
    if(!original) return '';

    const clave = original
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .trim();

    const coincidencia = Object.keys(AURO_PLAN_VIAS_COMPLETAS).find(k =>
        k.normalize('NFD').replace(/[\u0300-\u036f]/g,'') === clave
    );

    return coincidencia
        ? AURO_PLAN_VIAS_COMPLETAS[coincidencia]
        : original;
}

function auroPlanInstalarDatalist(idCampo, idLista, opciones, placeholder){
    const campo = document.getElementById(idCampo);
    if(!campo) return;

    if(placeholder && !String(campo.getAttribute('placeholder') || '').trim()){
        campo.setAttribute('placeholder', placeholder);
    }

    if(campo.tagName === 'INPUT'){
        let lista = document.getElementById(idLista);

        if(!lista){
            lista = document.createElement('datalist');
            lista.id = idLista;
            document.body.appendChild(lista);
        }

        lista.innerHTML = (opciones || [])
            .map(op => `<option value="${escapeHtmlPlan(op)}"></option>`)
            .join('');

        campo.setAttribute('list', idLista);
        campo.setAttribute('autocomplete', 'off');
    }
}

function auroPlanInstalarAyudaIndicaciones(){
    const campo = document.getElementById('hcMedIndicaciones');
    if(!campo || document.getElementById('auroPlanIndicacionRapida')) return;

    const selector = document.createElement('select');
    selector.id = 'auroPlanIndicacionRapida';
    selector.className = 'form-select form-select-sm auro-plan-ayuda-select';
    selector.setAttribute('aria-label', 'Sugerencias rápidas de indicaciones');

    selector.innerHTML =
        '<option value="">Elegir indicación rápida...</option>' +
        AURO_PLAN_INDICACIONES_RAPIDAS
            .map(op => `<option value="${escapeHtmlPlan(op)}">${escapeHtmlPlan(op)}</option>`)
            .join('');

    selector.addEventListener('change', function(){
        const valor = String(selector.value || '').trim();
        if(!valor) return;

        const actual = String(campo.value || '').trim();

        if(!actual){
            campo.value = valor;
        }else if(!normalizarTextoPlan(actual).includes(normalizarTextoPlan(valor))){
            campo.value = actual.replace(/\s+$/,'') + '\n' + valor;
        }

        campo.dispatchEvent(new Event('input', {bubbles:true}));
        selector.value = '';
        campo.focus();
    });

    campo.insertAdjacentElement('afterend', selector);
}

function auroPlanActualizarOpcionesVia(){
    const campo = document.getElementById('hcMedVia');
    if(!campo) return;

    if(campo.tagName === 'SELECT'){
        Array.from(campo.options || []).forEach(op => {
            const valor = String(op.value || '').trim();
            if(!valor) return;
            op.textContent = auroPlanNombreViaCompleta(valor);
        });
    }else if(campo.tagName === 'INPUT'){
        auroPlanInstalarDatalist(
            'hcMedVia',
            'auroPlanViasLista',
            [
                'Vía oral',
                'Vía intramuscular',
                'Vía intravenosa',
                'Vía subcutánea',
                'Vía vaginal',
                'Vía tópica',
                'Vía sublingual',
                'Vía oftálmica',
                'Vía ótica',
                'Vía inhalatoria',
                'Vía rectal',
                'Vía nasal'
            ],
            'Ej.: Vía oral'
        );
    }
}

function auroPlanInstalarAyudasMedicamentos(){
    auroPlanActualizarOpcionesVia();

    auroPlanInstalarDatalist(
        'hcMedFrecuencia',
        'auroPlanFrecuenciasLista',
        AURO_PLAN_FRECUENCIAS_RAPIDAS,
        'Ej.: Cada 12 horas'
    );

    auroPlanInstalarDatalist(
        'hcMedDuracion',
        'auroPlanDuracionesLista',
        AURO_PLAN_DURACIONES_RAPIDAS,
        'Ej.: 7 días'
    );

    auroPlanInstalarAyudaIndicaciones();
    auroPlanPrepararControlesEdicionMedicamento();
    auroPlanActualizarEncabezadosTablaMedicamentos();
}

function auroPlanBuscarBotonAgregarMedicamento(){
    const botones = Array.from(
        document.querySelectorAll('#hc_plan button, button')
    );

    return botones.find(btn =>
        String(btn.getAttribute('onclick') || '')
            .includes('agregarMedicamentoDesdeFormulario')
    ) || null;
}

function auroPlanPrepararControlesEdicionMedicamento(){
    const boton = auroPlanBuscarBotonAgregarMedicamento();
    if(!boton) return;

    boton.id = boton.id || 'auroPlanBtnAgregarMedicamento';
    boton.classList.add('auro-plan-btn-medicamento-principal');

    let cancelar = document.getElementById('auroPlanBtnCancelarEdicionMedicamento');

    if(!cancelar){
        cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.id = 'auroPlanBtnCancelarEdicionMedicamento';
        cancelar.className = 'btn btn-sm btn-outline-secondary ms-2 d-none';
        cancelar.innerHTML = '<i class="bi bi-x-circle me-1"></i> Cancelar edición';
        cancelar.addEventListener('click', cancelarEdicionMedicamentoPlan);
        boton.insertAdjacentElement('afterend', cancelar);
    }

    let aviso = document.getElementById('auroPlanAvisoEdicionMedicamento');

    if(!aviso){
        aviso = document.createElement('div');
        aviso.id = 'auroPlanAvisoEdicionMedicamento';
        aviso.className = 'auro-plan-aviso-edicion d-none';
        aviso.setAttribute('role', 'status');

        const contenedor = boton.parentElement || boton;
        contenedor.insertAdjacentElement('beforebegin', aviso);
    }

    auroPlanActualizarEstadoEdicionMedicamento();
}

function auroPlanActualizarEstadoEdicionMedicamento(){
    const boton = auroPlanBuscarBotonAgregarMedicamento();
    const cancelar = document.getElementById('auroPlanBtnCancelarEdicionMedicamento');
    const aviso = document.getElementById('auroPlanAvisoEdicionMedicamento');
    const indice = window.auroPlanMedicamentoEditandoIndice;
    const editando = Number.isInteger(indice) &&
        indice >= 0 &&
        indice < (window.medicamentosPlanSeleccionados || []).length;

    if(boton){
        boton.innerHTML = editando
            ? '<i class="bi bi-check-circle me-1"></i> Actualizar medicamento'
            : '<i class="bi bi-plus-circle me-1"></i> Agregar medicamento';
    }

    if(cancelar){
        cancelar.classList.toggle('d-none', !editando);
    }

    if(aviso){
        aviso.classList.toggle('d-none', !editando);
        aviso.innerHTML = editando
            ? '<i class="bi bi-pencil-square me-1"></i> Editando medicamento ' + (indice + 1) + '. Revise los datos y presione “Actualizar medicamento”.'
            : '';
    }
}

function auroPlanActualizarEncabezadosTablaMedicamentos(){
    const tbody = document.getElementById('hcMedicamentosTableBody');
    const tabla = tbody?.closest('table');
    if(!tabla) return;

    tabla.classList.add('auro-plan-tabla-medicamentos');

    const encabezados = tabla.querySelectorAll('thead th');

    if(encabezados[2]) encabezados[2].textContent = 'Vía';
    if(encabezados[7]) encabezados[7].textContent = 'Trat. continuo';
    if(encabezados[8]) encabezados[8].textContent = 'Acciones';
}


/* ============================================================
   UTILIDADES JSON SEGURAS DEL PLAN
   - Mantienen la interfaz actual.
   - Evitan duplicados antes de guardar.
   - Permiten cargar JSON sin afectar Recetas.
============================================================ */

function auroPlanParseJSONSeguro(valor, fallback){
    if(valor === null || valor === undefined || valor === ''){
        return fallback;
    }

    if(typeof valor === 'object'){
        return valor;
    }

    const texto = String(valor || '').trim();

    if(!texto){
        return fallback;
    }

    try{
        return JSON.parse(texto);
    }catch(e){
        return fallback;
    }
}

function auroPlanClaveUnica(partes){
    return (partes || [])
        .map(v => normalizarTextoPlan(v))
        .join('|');
}

function auroPlanOrdenesUnicas(lista){
    const mapa = new Map();

    (Array.isArray(lista) ? lista : []).forEach(item => {
        const orden = String(item?.orden || '').trim();
        if(!orden) return;

        const normalizada = {
            orden: orden,
            cat: String(item?.cat || item?.categoria || 'OTROS').trim() || 'OTROS',
            obs: String(item?.obs || item?.observacion || '').trim()
        };

        const clave = auroPlanClaveUnica([
            normalizada.orden,
            normalizada.cat,
            normalizada.obs
        ]);

        if(!mapa.has(clave)){
            mapa.set(clave, normalizada);
        }
    });

    return Array.from(mapa.values());
}

function auroPlanInterconsultasUnicas(lista){
    const mapa = new Map();

    (Array.isArray(lista) ? lista : []).forEach(item => {
        const normalizada = {
            tipo: String(item?.tipo || '').trim(),
            especialidad: String(item?.especialidad || '').trim(),
            prioridad: String(item?.prioridad || 'Normal').trim() || 'Normal',
            profesional: String(item?.profesional || '').trim(),
            estado: String(item?.estado || 'Pendiente').trim() || 'Pendiente',
            motivo: String(item?.motivo || '').trim(),
            observaciones: String(item?.observaciones || item?.observacion || '').trim()
        };

        const tieneContenido = !!(
            normalizada.tipo ||
            normalizada.especialidad ||
            normalizada.profesional ||
            normalizada.motivo ||
            normalizada.observaciones
        );

        if(!tieneContenido) return;

        const clave = auroPlanClaveUnica([
            normalizada.tipo,
            normalizada.especialidad,
            normalizada.prioridad,
            normalizada.profesional,
            normalizada.estado,
            normalizada.motivo,
            normalizada.observaciones
        ]);

        if(!mapa.has(clave)){
            mapa.set(clave, normalizada);
        }
    });

    return Array.from(mapa.values());
}

function auroPlanEvaluacionesSeleccionadasJSON(){
    return AURO_PLAN_EVALUACIONES
        .filter(item => {
            const el = document.getElementById(item.id);
            return !!(el && el.checked);
        })
        .map(item => ({
            id: item.id,
            texto: item.texto,
            seleccionado: true
        }));
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
    auroPlanInstalarAyudasMedicamentos();
    auroPlanRefrescarVistas();
}


/* ============================================================
   CAMBIO DE CONSULTA / ATENCIÓN
============================================================ */

function cambiarPlanPorAtencion(idAtencion){

    inicializarPlan();
    cancelarEdicionMedicamentoPlan({limpiarFormulario:false});

    idAtencion = String(
        idAtencion ||
        auroPlanObtenerIdAtencionActivaSeguro() ||
        ''
    ).trim();

    if(!idAtencion) return;

    /*
      FUENTE REAL DEL PLAN VISIBLE:
      No se usa planState.atencionActual para decidir si cambió la consulta,
      porque Atenciones puede actualizar ese valor antes de llamar esta función.
      __auroPlanAtencionRenderizada representa la consulta que realmente está
      dibujada actualmente en el módulo Plan.
    */
    const atencionAnteriorRenderizada = String(
        window.__auroPlanAtencionRenderizada || ''
    ).trim();

    /*
      Solo se conserva el Plan temporal cuando realmente existe otra consulta
      dibujada. Se guarda usando su id original, nunca bajo la nueva atención.
    */
    if(
        atencionAnteriorRenderizada &&
        atencionAnteriorRenderizada !== idAtencion
    ){
        const idTemporalActual = String(
            window.planState?.atencionActual || ''
        ).trim();

        window.planState.atencionActual = atencionAnteriorRenderizada;
        guardarPlanTemporal();
        window.planState.atencionActual = idTemporalActual;
    }

    /*
      Si la consulta realmente dibujada ya es la misma, no se limpia.
      Esto protege cambios temporales al navegar entre pestañas de una misma
      atención, pero no confunde una atención nueva con la anterior.
    */
    if(
        atencionAnteriorRenderizada &&
        atencionAnteriorRenderizada === idAtencion
    ){
        window.planState.atencionActual = idAtencion;
        auroPlanRefrescarVistas();
        return;
    }

    window.planState.atencionActual = idAtencion;
    window.__auroPlanAtencionRenderizada = idAtencion;

    /*
      Primero se limpia completamente la pantalla.
      Después se restaura solo el cache propio de la atención solicitada,
      si realmente existe.
    */
    limpiarPlanTemporal();

    if(window.planState.cache[idAtencion]){
        cargarPlanTemporal(idAtencion);
    }else{
        auroPlanRefrescarVistas();
    }

    if(typeof window.cargarPlanClinicoDesdeSheets === 'function'){
        setTimeout(function(){
            if(
                String(window.__auroPlanAtencionRenderizada || '').trim() !== idAtencion ||
                String(window.planState?.atencionActual || '').trim() !== idAtencion
            ){
                return;
            }

            window.cargarPlanClinicoDesdeSheets(idAtencion).catch(function(error){
                console.warn('AUROSANAX PLAN: no se pudo cargar Plan desde Sheets.', error);
            });
        }, 80);
    }
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

    window.auroPlanMedicamentoEditandoIndice = null;
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

    /*
      Campos de Receta alimentados por Plan.
      Deben quedar vacíos al cambiar de atención para evitar arrastre.
    */
    auroPlanSetValue('recMedicamento', '');
    auroPlanSetValue('recIndicaciones', '');
    auroPlanSetValue('recRecomendaciones', '');

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

function limpiarFormularioMedicamento(opciones){

    opciones = opciones || {};

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

    const selectorIndicacion = document.getElementById('auroPlanIndicacionRapida');
    if(selectorIndicacion) selectorIndicacion.value = '';

    const box = document.getElementById('hcMedSugerencias');
    if(box) box.classList.add('d-none');

    if(opciones.conservarEdicion !== true){
        window.auroPlanMedicamentoEditandoIndice = null;
    }

    auroPlanActualizarEstadoEdicionMedicamento();
}

function auroPlanMedicamentoDesdeFormulario(){
    return {
        med: (auroPlanGetValue('hcMedBusqueda') || '').trim(),
        pres: auroPlanGetValue('hcMedPresentacion'),
        via: auroPlanGetValue('hcMedVia'),
        cantidad: auroPlanGetValue('hcMedCantidad'),
        frec: auroPlanGetValue('hcMedFrecuencia'),
        dur: auroPlanGetValue('hcMedDuracion'),
        ind: auroPlanGetValue('hcMedIndicaciones'),
        continuo: auroPlanGetValue('hcMedContinuo') || 'No'
    };
}

function agregarMedicamentoDesdeFormulario(){

    const nuevo = auroPlanMedicamentoDesdeFormulario();

    if(!nuevo.med){
        alert('Ingrese o seleccione un medicamento.');
        return;
    }

    const indice = window.auroPlanMedicamentoEditandoIndice;
    const editando = Number.isInteger(indice) &&
        indice >= 0 &&
        indice < (window.medicamentosPlanSeleccionados || []).length;

    if(editando){
        const anterior = window.medicamentosPlanSeleccionados[indice] || {};

        /*
          Conserva cualquier propiedad adicional proveniente de protocolos
          inteligentes, pero actualiza únicamente los campos visibles del Plan.
        */
        window.medicamentosPlanSeleccionados[indice] = {
            ...anterior,
            ...nuevo
        };
    }else{
        window.medicamentosPlanSeleccionados.push(nuevo);
    }

    limpiarFormularioMedicamento();
    renderMedicamentosPlanTabla();
    sincronizarPlanConReceta();
    guardarPlanTemporal();
}

function editarMedicamentoPlan(i){

    i = Number(i);

    if(
        Number.isNaN(i) ||
        i < 0 ||
        i >= (window.medicamentosPlanSeleccionados || []).length
    ){
        return;
    }

    const m = window.medicamentosPlanSeleccionados[i] || {};

    window.auroPlanMedicamentoEditandoIndice = i;

    auroPlanSetValue('hcMedBusqueda', m.med || '');
    auroPlanSetValue('hcMedPresentacion', m.pres || '');
    auroPlanSetValue('hcMedVia', m.via || '');
    auroPlanSetValue('hcMedCantidad', m.cantidad || '');
    auroPlanSetValue('hcMedFrecuencia', m.frec || '');
    auroPlanSetValue('hcMedDuracion', m.dur || '');
    auroPlanSetValue('hcMedIndicaciones', m.ind || '');
    auroPlanSetValue('hcMedContinuo', m.continuo || 'No');

    auroPlanActualizarEstadoEdicionMedicamento();

    const formulario = document.getElementById('hcMedBusqueda');
    if(formulario){
        formulario.focus();
        formulario.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

function cancelarEdicionMedicamentoPlan(opciones){

    opciones = opciones || {};
    window.auroPlanMedicamentoEditandoIndice = null;

    if(opciones.limpiarFormulario !== false){
        limpiarFormularioMedicamento();
    }else{
        auroPlanActualizarEstadoEdicionMedicamento();
    }
}

function eliminarMedicamentoPlan(i){

    i = Number(i);

    if(Number.isNaN(i)) return;

    const indiceEditando = window.auroPlanMedicamentoEditandoIndice;

    window.medicamentosPlanSeleccionados.splice(i,1);

    if(Number.isInteger(indiceEditando)){
        if(indiceEditando === i){
            cancelarEdicionMedicamentoPlan();
        }else if(indiceEditando > i){
            window.auroPlanMedicamentoEditandoIndice = indiceEditando - 1;
        }
    }

    renderMedicamentosPlanTabla();
    sincronizarPlanConReceta();
    guardarPlanTemporal();
}

function textoRecetaMedicamentosPlan(){

    return (window.medicamentosPlanSeleccionados || []).map((m,i) => {

        const linea = [
            `${i + 1}. ${m.med || ''}`,
            m.pres || '',
            auroPlanNombreViaCompleta(m.via) || '',
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
              <td>${escapeHtmlPlan(auroPlanNombreViaCompleta(m.via))}</td>
              <td>${
                  String(m.cantidad || '').trim()
                      ? escapeHtmlPlan(m.cantidad)
                      : '<span class="auro-plan-pendiente" title="Complete la cantidad antes de emitir la receta">Pendiente</span>'
              }</td>
              <td>${escapeHtmlPlan(m.frec)}</td>
              <td>${escapeHtmlPlan(m.dur)}</td>
              <td>${escapeHtmlPlan(m.ind)}</td>
              <td>${escapeHtmlPlan(m.continuo)}</td>
              <td>
                <div class="auro-plan-acciones-medicamento">
                  <button type="button"
                          class="btn btn-sm btn-outline-primary"
                          title="Editar medicamento"
                          aria-label="Editar medicamento ${i + 1}"
                          onclick="editarMedicamentoPlan(${i})">
                    <i class="bi bi-pencil-square"></i>
                  </button>
                  <button type="button"
                          class="btn btn-sm btn-outline-danger"
                          title="Eliminar medicamento"
                          aria-label="Eliminar medicamento ${i + 1}"
                          onclick="eliminarMedicamentoPlan(${i})">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
        `).join('');
    }

    if(hidden){
        hidden.value = textoRecetaMedicamentosPlan();
    }

    auroPlanActualizarEncabezadosTablaMedicamentos();
    auroPlanActualizarEstadoEdicionMedicamento();

    if(typeof updateClinicalSummary === 'function'){
        updateClinicalSummary();
    }
}

function sincronizarPlanConReceta(){

    const txt = auroPlanGetValue('hcRecetaMedicamentos');

    /*
      Siempre sincronizar, incluso cuando está vacío.
      Así una consulta nueva no conserva medicamentos de la receta anterior.
    */
    auroPlanSetValue('recMedicamento', txt);

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

    window.auroPlanMedicamentoEditandoIndice = null;
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

    window.ordenesMedicasPlanSeleccionadas = auroPlanOrdenesUnicas([
        ...(window.ordenesMedicasPlanSeleccionadas || []),
        {
            orden,
            cat: auroPlanGetValue('hcOrdenTipo') || 'OTROS',
            obs: auroPlanGetValue('hcOrdenObservacion')
        }
    ]);

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

    const formularioTieneContenido = !!(
        tipo ||
        especialidad ||
        profesional ||
        motivo ||
        observaciones
    );

    const textoFormulario = formularioTieneContenido
        ? partes.join('\n')
        : '';

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

    window.interconsultasPlanSeleccionadas = auroPlanInterconsultasUnicas([
        ...(window.interconsultasPlanSeleccionadas || []),
        {
            tipo: auroPlanGetValue('hcInterconsultaTipo'),
            especialidad,
            prioridad: auroPlanGetValue('hcInterconsultaPrioridad') || 'Normal',
            profesional: auroPlanGetValue('hcInterconsultaProfesional'),
            estado: auroPlanGetValue('hcInterconsultaEstado') || 'Pendiente',
            motivo: auroPlanGetValue('hcInterconsultaMotivo'),
            observaciones: auroPlanGetValue('hcInterconsultaObservaciones')
        }
    ]);

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

    window.ordenesMedicasPlanSeleccionadas =
        auroPlanOrdenesUnicas(window.ordenesMedicasPlanSeleccionadas || []);

    const interconsultaFormulario = {
        tipo: auroPlanGetValue('hcInterconsultaTipo'),
        especialidad: auroPlanGetValue('hcInterconsultaEspecialidad'),
        prioridad: auroPlanGetValue('hcInterconsultaPrioridad') || 'Normal',
        profesional: auroPlanGetValue('hcInterconsultaProfesional'),
        estado: auroPlanGetValue('hcInterconsultaEstado') || 'Pendiente',
        motivo: auroPlanGetValue('hcInterconsultaMotivo'),
        observaciones: auroPlanGetValue('hcInterconsultaObservaciones')
    };

    const formularioInterconsultaTieneContenido = !!(
        String(interconsultaFormulario.tipo || '').trim() ||
        String(interconsultaFormulario.especialidad || '').trim() ||
        String(interconsultaFormulario.profesional || '').trim() ||
        String(interconsultaFormulario.motivo || '').trim() ||
        String(interconsultaFormulario.observaciones || '').trim()
    );

    window.interconsultasPlanSeleccionadas =
        auroPlanInterconsultasUnicas([
            ...(window.interconsultasPlanSeleccionadas || []),
            ...(formularioInterconsultaTieneContenido
                ? [interconsultaFormulario]
                : [])
        ]);

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
      #hc_plan .auro-plan-ayuda-select{
        margin-top:7px;
        max-width:420px;
        border-radius:12px;
        color:#475569;
      }

      #hc_plan .auro-plan-aviso-edicion{
        margin:8px 0 10px;
        padding:9px 12px;
        border:1px solid #bfdbfe;
        border-radius:12px;
        background:#eff6ff;
        color:#1e40af;
        font-size:13px;
        font-weight:700;
      }

      #hc_plan .auro-plan-pendiente{
        display:inline-block;
        padding:4px 8px;
        border-radius:999px;
        background:#fef3c7;
        color:#92400e;
        font-size:11px;
        font-weight:800;
        white-space:nowrap;
      }

      #hc_plan .auro-plan-acciones-medicamento{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        white-space:nowrap;
      }

      #hc_plan .auro-plan-tabla-medicamentos th:nth-child(3),
      #hc_plan .auro-plan-tabla-medicamentos td:nth-child(3){
        min-width:135px;
      }

      #hc_plan .auro-plan-tabla-medicamentos th:nth-child(7),
      #hc_plan .auro-plan-tabla-medicamentos td:nth-child(7){
        min-width:190px;
      }

      @media(min-width:981px){
        /*
          AUROSANAX PLAN - ENSANCHAMIENTO PROFESIONAL SOLO ESCRITORIO
          - Extiende únicamente la caja de medicamentos hacia la derecha.
          - Mantiene alineado el borde izquierdo original.
          - No usa transformaciones, centrados forzados ni porcentajes rígidos.
          - La tabla conserva distribución automática y texto ajustable.
          - No afecta otras tablas ni el responsive móvil.
        */
        #hc_plan .receta-medicamentos-box.hc-plan-narrow,
        #hc_plan .receta-medicamentos-box{
          width:min(1180px, calc(100vw - 365px))!important;
          max-width:none!important;
          margin-left:0!important;
          margin-right:0!important;
        }

        #hc_plan .receta-medicamentos-box .table-responsive{
          display:block!important;
          width:100%!important;
          max-width:100%!important;
          overflow-x:hidden!important;
        }

        #hc_plan .auro-plan-tabla-medicamentos{
          width:100%!important;
          min-width:0!important;
          max-width:100%!important;
          table-layout:auto!important;
        }

        #hc_plan .auro-plan-tabla-medicamentos th,
        #hc_plan .auro-plan-tabla-medicamentos td{
          padding:9px 8px!important;
          vertical-align:middle!important;
          white-space:normal!important;
          word-break:normal!important;
          overflow-wrap:anywhere!important;
          line-height:1.35!important;
        }

        #hc_plan .auro-plan-tabla-medicamentos th{
          font-size:12px!important;
          letter-spacing:.01em!important;
        }

        #hc_plan .auro-plan-tabla-medicamentos td{
          font-size:12.5px!important;
        }

        #hc_plan .auro-plan-tabla-medicamentos th:nth-child(4),
        #hc_plan .auro-plan-tabla-medicamentos td:nth-child(4),
        #hc_plan .auro-plan-tabla-medicamentos th:nth-child(8),
        #hc_plan .auro-plan-tabla-medicamentos td:nth-child(8),
        #hc_plan .auro-plan-tabla-medicamentos th:nth-child(9),
        #hc_plan .auro-plan-tabla-medicamentos td:nth-child(9){
          white-space:nowrap!important;
        }

        #hc_plan .auro-plan-acciones-medicamento{
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          gap:6px!important;
        }

        #hc_plan .auro-plan-acciones-medicamento .btn{
          width:34px!important;
          height:34px!important;
          min-height:34px!important;
          padding:5px!important;
          border-radius:9px!important;
        }

        #hc_plan .auro-plan-ayuda-select{
          border:1px solid #d8b4fe!important;
          background:linear-gradient(180deg,#ffffff 0%,#faf5ff 100%)!important;
          box-shadow:0 4px 14px rgba(126,34,206,.08)!important;
          font-weight:600!important;
        }
      }

      @media(max-width:980px){
        #hc_plan .receta-medicamentos-box .table-responsive{
          display:block!important;
          overflow-x:auto!important;
          -webkit-overflow-scrolling:touch!important;
        }
      }

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
          min-width:920px!important;
        }

        #hc_plan button{
          min-height:42px!important;
          white-space:normal!important;
        }

        #hc_plan .auro-plan-acciones-medicamento button{
          min-width:42px!important;
          padding:8px!important;
        }

        #hc_plan .auro-plan-ayuda-select{
          width:100%;
          max-width:none;
          font-size:14px!important;
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

function auroPlanObtenerContextoAtencionSeguro(){
    /*
      AUROSANAX - integración quirúrgica con atenciones.js
      Fuente preferente: obtenerContextoAtencionActual().
      Mantiene compatibilidad total con la lógica anterior.
    */
    try{
        if(typeof window.obtenerContextoAtencionActual === 'function'){
            const contexto = window.obtenerContextoAtencionActual();
            if(contexto && contexto.id_atencion){
                return contexto;
            }
        }
    }catch(error){
        console.warn('AUROSANAX PLAN: no se pudo leer el contexto unificado de la atención.', error);
    }

    try{
        if(typeof window.getContextoAtencionActual === 'function'){
            const contexto = window.getContextoAtencionActual();
            if(contexto && contexto.id_atencion){
                return contexto;
            }
        }
    }catch(error){}

    try{
        if(typeof window.getAtencionActiva === 'function'){
            const atencion = window.getAtencionActiva();
            if(atencion && atencion.id_atencion){
                return {
                    id_atencion: String(atencion.id_atencion || '').trim(),
                    id_paciente: String(atencion.id_paciente || '').trim(),
                    id_historia: String(atencion.id_historia || '').trim(),
                    id_cita: String(atencion.id_cita || '').trim(),
                    id_medico: String(atencion.id_medico || '').trim(),
                    numero_consulta: String(atencion.numero_consulta || '').trim(),
                    origen_atencion: String(atencion.id_cita || '').trim() ? 'agenda' : 'manual'
                };
            }
        }
    }catch(error){}

    return null;
}

function auroPlanObtenerIdAtencionActivaSeguro(){
    let idReal = '';

    const contexto = auroPlanObtenerContextoAtencionSeguro();
    if(contexto && contexto.id_atencion){
        idReal = String(contexto.id_atencion || '').trim();
    }

    try{
        if(typeof window.getAtencionActiva === 'function'){
            const atencion = window.getAtencionActiva();
            idReal = String(atencion?.id_atencion || '').trim();
        }
    }catch(e){}

    if(!idReal){
        try{
            if(typeof getAtencionActiva === 'function'){
                const atencion = getAtencionActiva();
                idReal = String(atencion?.id_atencion || '').trim();
            }
        }catch(e){}
    }

    if(!idReal){
        idReal = String(
            document.getElementById('hcIdAtencion')?.value ||
            document.getElementById('idAtencionActiva')?.value ||
            ''
        ).trim();
    }

    if(!idReal){
        idReal = String(window.planState?.atencionActual || '').trim();
    }

    return idReal;
}

function auroPlanSincronizarAtencionActiva(){
    const idReal = auroPlanObtenerIdAtencionActivaSeguro();

    if(!idReal) return '';

    window.planState = window.planState || {
        atencionActual: '',
        cache: {}
    };

    window.planState.atencionActual = idReal;
    return idReal;
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

    const contexto = auroPlanObtenerContextoAtencionSeguro();
    if(contexto && contexto.id_historia){
        return String(contexto.id_historia || '').trim();
    }

    try{
        if(typeof editingHistoryId !== 'undefined' && editingHistoryId){
            return editingHistoryId;
        }
    }catch(e){}

    const h = document.getElementById('hcIdHistoria')?.value || '';
    return h || '';
}

function auroPlanObtenerMedicoIdSeguro(){

    const contexto = auroPlanObtenerContextoAtencionSeguro();
    if(contexto && contexto.id_medico){
        return String(contexto.id_medico || '').trim();
    }

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

    const idAtencionReal = auroPlanSincronizarAtencionActiva();

    auroSincronizarPlanAntesGuardar();

    const contexto = auroPlanObtenerContextoAtencionSeguro();
    const paciente = auroPlanObtenerPacienteActivoSeguro();

    return {
        id_atencion:
            idAtencionReal,

        id_paciente:
            String(contexto?.id_paciente || '').trim() ||
            paciente?.id_paciente ||
            document.getElementById('hcPacienteSelect')?.value ||
            '',

        id_historia:
            String(contexto?.id_historia || '').trim() ||
            auroPlanObtenerHistoriaIdSeguro(),

        id_medico:
            String(contexto?.id_medico || '').trim() ||
            auroPlanObtenerMedicoIdSeguro(),

        id_cita:
            String(contexto?.id_cita || '').trim(),

        fecha_plan:
            new Date().toISOString(),

        plan_terapeutico:
            auroPlanGetValue('hcPlanTratamiento'),

        medicamentos_plan:
            JSON.stringify(window.medicamentosPlanSeleccionados || []),

        receta_medica:
            auroPlanGetValue('hcRecetaMedicamentos'),

        ordenes_medicas:
            JSON.stringify(
                auroPlanOrdenesUnicas(
                    window.ordenesMedicasPlanSeleccionadas || []
                )
            ),

        interconsulta:
            JSON.stringify(
                auroPlanInterconsultasUnicas(
                    window.interconsultasPlanSeleccionadas || []
                )
            ),

        evaluaciones_plan:
            JSON.stringify(
                auroPlanEvaluacionesSeleccionadasJSON()
            ),

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

    const idAtencionVisible = auroPlanObtenerIdAtencionActivaSeguro();
    const idAtencionInterna = String(window.planState?.atencionActual || '').trim();

    if(
        idAtencionVisible &&
        idAtencionInterna &&
        idAtencionVisible !== idAtencionInterna
    ){
        window.planState.atencionActual = idAtencionVisible;
    }

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

    let resultado;

    if(existente && existente.id_plan){
        data.id_plan = existente.id_plan;
        resultado = await auroPlanApiPost('editarPlanClinico', data);
    }else{
        resultado = await auroPlanApiPost('guardarPlanClinico', data);
    }

    guardarPlanTemporal();

    return resultado;
}


function auroPlanTextoAOrdenes(texto){
    texto = String(texto || '').trim();
    if(!texto) return [];

    return texto.split(/\n+/).map(linea => {
        let limpia = String(linea || '').replace(/^\s*\d+\.\s*/, '').trim();
        const partes = limpia.split(' - ').map(x => x.trim()).filter(Boolean);

        const orden = partes[0] || limpia;
        let cat = '';
        let obs = '';

        partes.slice(1).forEach(p => {
            if(/^Categoría:/i.test(p)) cat = p.replace(/^Categoría:\s*/i, '').trim();
            else if(/^Observación:/i.test(p)) obs = p.replace(/^Observación:\s*/i, '').trim();
        });

        return {
            orden: orden,
            cat: cat || 'OTROS',
            obs: obs
        };
    }).filter(o => o.orden);
}

function auroPlanTextoAInterconsultas(texto){
    texto = String(texto || '').trim();
    if(!texto) return [];

    const bloques = texto
        .split(/\n(?=\s*\d+\.\s*)/)
        .map(x => x.trim())
        .filter(Boolean);

    const origen = bloques.length > 1 ? bloques : [texto];

    return origen.map(bloque => {
        const limpio = bloque.replace(/^\s*\d+\.\s*/, '').trim();
        const partes = limpio
            .split(/\s+-\s+|\n+/)
            .map(x => x.trim())
            .filter(Boolean);

        const item = {
            tipo: '',
            especialidad: '',
            prioridad: 'Normal',
            profesional: '',
            estado: 'Pendiente',
            motivo: '',
            observaciones: ''
        };

        partes.forEach((parte, index) => {
            if(/^Tipo:/i.test(parte)){
                item.tipo = parte.replace(/^Tipo:\s*/i, '').trim();
            }else if(/^Especialidad:/i.test(parte)){
                item.especialidad = parte.replace(/^Especialidad:\s*/i, '').trim();
            }else if(/^Prioridad:/i.test(parte)){
                item.prioridad = parte.replace(/^Prioridad:\s*/i, '').trim() || 'Normal';
            }else if(/^Profesional:/i.test(parte)){
                item.profesional = parte.replace(/^Profesional:\s*/i, '').trim();
            }else if(/^Estado:/i.test(parte)){
                item.estado = parte.replace(/^Estado:\s*/i, '').trim() || 'Pendiente';
            }else if(/^Motivo:/i.test(parte)){
                item.motivo = parte.replace(/^Motivo:\s*/i, '').trim();
            }else if(/^Observaciones:/i.test(parte)){
                item.observaciones = parte.replace(/^Observaciones:\s*/i, '').trim();
            }else if(index === 0 && parte){
                item.especialidad = parte;
            }
        });

        return item;
    }).filter(item =>
        item.tipo ||
        item.especialidad ||
        item.profesional ||
        item.motivo ||
        item.observaciones
    );
}

function auroPlanCargarEvaluacionesDesdeTexto(texto){
    texto = String(texto || '').trim();

    limpiarEvaluacionesCamposPlan();

    if(!texto) return;

    AURO_PLAN_EVALUACIONES.forEach(item => {
        const el = document.getElementById(item.id);
        if(el && texto.includes(item.texto)){
            el.checked = true;
        }
    });

    auroPlanSetValue('hcEvaluacionesResumen', texto);
}

function auroPlanCargarEvaluacionesDesdeValor(valor){
    limpiarEvaluacionesCamposPlan();

    const data = auroPlanParseJSONSeguro(valor, null);

    if(Array.isArray(data)){
        const ids = new Set();
        const textos = new Set();

        data.forEach(item => {
            if(typeof item === 'string'){
                textos.add(item);
                return;
            }

            if(item && item.seleccionado !== false){
                if(item.id) ids.add(String(item.id));
                if(item.texto) textos.add(String(item.texto));
            }
        });

        AURO_PLAN_EVALUACIONES.forEach(item => {
            const el = document.getElementById(item.id);
            if(el){
                el.checked = ids.has(item.id) || textos.has(item.texto);
            }
        });

        recopilarEvaluacionesPlan();
        return;
    }

    if(data && typeof data === 'object'){
        AURO_PLAN_EVALUACIONES.forEach(item => {
            const el = document.getElementById(item.id);
            if(el) el.checked = !!data[item.id];
        });

        recopilarEvaluacionesPlan();
        return;
    }

    auroPlanCargarEvaluacionesDesdeTexto(valor);
}

function auroPlanEstadoSeguro(valor){
    valor = String(valor || '').trim();
    return valor || 'Control';
}

async function cargarPlanClinicoDesdeSheets(idAtencion){

    idAtencion = String(
        idAtencion ||
        auroPlanObtenerIdAtencionActivaSeguro() ||
        window.planState?.atencionActual ||
        ''
    ).trim();

    if(!idAtencion) return null;

    window.__auroPlanCargasActivas = window.__auroPlanCargasActivas || {};

    if(window.__auroPlanCargasActivas[idAtencion]){
        return window.__auroPlanCargasActivas[idAtencion];
    }

    const promesaCarga = (async function(){

    const plan = await buscarPlanClinicoPorAtencionDesdeSheets(idAtencion);

    const idAtencionActual = auroPlanObtenerIdAtencionActivaSeguro();

    if(idAtencionActual && idAtencionActual !== idAtencion){
        console.warn(
            'AUROSANAX PLAN: se descartó una respuesta tardía de otra atención.',
            { solicitada: idAtencion, actual: idAtencionActual }
        );
        return null;
    }

    /*
      AUROSANAX FIX:
      Si la consulta no tiene Plan guardado en planes_clinicos,
      se deja el Plan limpio. No se arrastra información de otra consulta.
    */
    if(!plan || !plan.id_plan){
        limpiarPlanTemporal();
        window.planState.atencionActual = idAtencion;
        window.planState.cache[idAtencion] = {
            medicamentos: [],
            ordenes: [],
            interconsultas: [],
            plan: '',
            indicaciones: '',
            ordenesTexto: '',
            interconsultaTexto: '',
            evaluaciones: '',
            evaluacionesChecks: {},
            receta: ''
        };
        auroPlanRefrescarVistas();
        console.log('AUROSANAX PLAN: atención sin plan guardado, pantalla limpia:', idAtencion);
        return null;
    }

    window.planState = window.planState || {
        atencionActual: idAtencion,
        cache: {}
    };

    window.planState.atencionActual = idAtencion;

    function valorPlan(){
        for(const k of arguments){
            if(plan[k] !== undefined && plan[k] !== null && String(plan[k]).trim() !== ''){
                return plan[k];
            }
        }
        return '';
    }

    try{
        window.medicamentosPlanSeleccionados =
            JSON.parse(valorPlan('medicamentos_plan','medicamentos','medicamentosPlan') || '[]');
    }catch(e){
        window.medicamentosPlanSeleccionados = [];
    }

    const ordenesValor = valorPlan('ordenes_medicas','ordenes','examenes_solicitados');
    const ordenesJSON = auroPlanParseJSONSeguro(ordenesValor, null);

    window.ordenesMedicasPlanSeleccionadas = auroPlanOrdenesUnicas(
        Array.isArray(ordenesJSON)
            ? ordenesJSON
            : auroPlanTextoAOrdenes(ordenesValor)
    );

    const interconsultaValor = valorPlan(
        'interconsulta',
        'interconsultas',
        'interconsulta_plan'
    );

    const interconsultaJSON = auroPlanParseJSONSeguro(
        interconsultaValor,
        null
    );

    window.interconsultasPlanSeleccionadas = auroPlanInterconsultasUnicas(
        Array.isArray(interconsultaJSON)
            ? interconsultaJSON
            : auroPlanTextoAInterconsultas(interconsultaValor)
    );

    auroPlanSetValue('hcPlanTratamiento',
        valorPlan('plan_terapeutico','planTratamiento','plan_tratamiento')
    );

    auroPlanSetValue('hcRecetaMedicamentos',
        valorPlan('receta_medica','receta','recetaMedicamentos')
    );

    auroPlanSetValue('hcExamenesSolicitados', '');

    auroPlanSetValue('hcInterconsultaResumen', '');

    const evaluacionesValor = valorPlan(
        'evaluaciones_plan',
        'evaluaciones',
        'evaluacion_plan'
    );

    auroPlanCargarEvaluacionesDesdeValor(evaluacionesValor);

    auroPlanSetValue('hcIndicacionesPaciente',
        valorPlan('indicaciones_paciente','indicaciones','indicacionesPaciente')
    );

    auroPlanSetValue('hcControl',
        valorPlan('proximo_control','control','proximoControl')
    );

    auroPlanSetValue('hcEstadoHistoria',
        auroPlanEstadoSeguro(valorPlan('estado_plan','estado','estadoHistoria'))
    );

    renderMedicamentosPlanTabla();
    renderOrdenesMedicasTabla();
    renderInterconsultasTabla();

    recopilarOrdenesMedicasPlan();
    recopilarInterconsultaPlan();
    recopilarEvaluacionesPlan();

    sincronizarPlanConReceta();
    guardarPlanTemporal();

    console.log('AUROSANAX PLAN: plan cargado desde Sheets para atención:', idAtencion, plan);

    return plan;

    })();

    window.__auroPlanCargasActivas[idAtencion] = promesaCarga;

    try{
        return await promesaCarga;
    }finally{
        delete window.__auroPlanCargasActivas[idAtencion];
    }
}

window.editarMedicamentoPlan = editarMedicamentoPlan;
window.cancelarEdicionMedicamentoPlan = cancelarEdicionMedicamentoPlan;
window.auroPlanNombreViaCompleta = auroPlanNombreViaCompleta;

window.guardarPlanClinicoDesdeSheets = guardarPlanClinicoDesdeSheets;
window.buscarPlanClinicoPorAtencionDesdeSheets = buscarPlanClinicoPorAtencionDesdeSheets;
window.cargarPlanClinicoDesdeSheets = cargarPlanClinicoDesdeSheets;


/* ============================================================
   INICIO SEGURO
============================================================ */

document.addEventListener('DOMContentLoaded', function(){
    inicializarPlan();
    auroPlanInstalarAyudasMedicamentos();
});

/* ============================================================
   AUTO-CARGA AL CAMBIAR CONSULTA / ATENCIÓN
   AUROSANAX FIX:
   Desactivado aquí porque cambiarPlanPorAtencion ya carga desde Sheets.
   Evita doble carga y evita que se mezclen datos entre consultas.
============================================================ */

/* ============================================================
   ESTADO VISUAL BOTÓN GUARDAR PLAN
   AUROSANAX FIX:
   Esta función queda como dueña del botón Actualizar Plan Clínico.
   Evita doble clic y actualiza el panel premium al finalizar.
============================================================ */
window.auroPlanGuardando = false;

function auroPlanUXFechaHoraAhora(){
    try{
        return new Date().toLocaleString('es-EC', {
            year:'numeric',
            month:'2-digit',
            day:'2-digit',
            hour:'2-digit',
            minute:'2-digit',
            hour12:false
        });
    }catch(e){
        return new Date().toLocaleString('es-EC', {
            hour12:false
        });
    }
}

function auroPlanUXEscape(txt){
    return String(txt || '').replace(/[&<>'"]/g, c => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        "'":'&#39;',
        '"':'&quot;'
    }[c]));
}

function auroPlanUXAtencionResumen(){
    try{
        if(typeof window.getAtencionActiva === 'function'){
            const a = window.getAtencionActiva();
            if(a){
                return {
                    id: String(a.id_atencion || ''),
                    consulta: a.numero_consulta ? ('#' + a.numero_consulta) : 'activa'
                };
            }
        }
    }catch(e){}

    const id = auroPlanObtenerIdAtencionActivaSeguro();
    return {
        id: id,
        consulta: id ? 'activa' : 'sin atención activa'
    };
}

function auroPlanUXGuardarFechaLocal(idAtencion, fechaHora){
    try{
        if(!idAtencion) return;
        const key = 'auro_plan_ultimas_actualizaciones_v1';
        const raw = localStorage.getItem(key);
        const mapa = raw ? JSON.parse(raw) : {};
        mapa[idAtencion] = fechaHora;
        localStorage.setItem(key, JSON.stringify(mapa));
    }catch(e){
        console.warn('AUROSANAX PLAN UX: no se pudo guardar fecha local del Plan.', e);
    }
}

function auroPlanUXRecetaTexto(idAtencion){
    try{
        const raw = localStorage.getItem('aurosanax_recetas_emitidas_v1');
        const arr = raw ? JSON.parse(raw) : [];
        if(!Array.isArray(arr)) return 'Receta pendiente';

        const recetas = arr
            .filter(r => String(r.id_atencion || '').trim() === String(idAtencion || '').trim())
            .sort((a,b) => String(b.actualizado_en || b.creado_en || b.fecha_receta || '').localeCompare(String(a.actualizado_en || a.creado_en || a.fecha_receta || '')));

        const r = recetas[0];
        if(!r) return 'Receta pendiente';

        const f = r.actualizado_en || r.creado_en || r.fecha_receta || '';
        return 'Receta guardada: ' + String(f);
    }catch(e){
        return 'Receta pendiente';
    }
}

function auroPlanUXPintarPanelPlanGuardado(fechaHora){
    const box = document.getElementById('auroPlanMiniStatus');
    if(!box) return;

    const atn = auroPlanUXAtencionResumen();
    const recetaTexto = auroPlanUXRecetaTexto(atn.id);

    box.innerHTML =
        '<span><i class="bi bi-journal-medical"></i> Consulta ' + auroPlanUXEscape(atn.consulta) + '</span>' +
        '<span class="ok"><i class="bi bi-list-check"></i> Plan actualizado: ' + auroPlanUXEscape(fechaHora) + '</span>' +
        '<span class="' + (recetaTexto.includes('guardada') ? 'ok' : 'muted') + '"><i class="bi bi-capsule"></i> ' + auroPlanUXEscape(recetaTexto) + '</span>';
}

async function guardarPlanClinicoConUX(btn){

    if(window.auroPlanGuardando){
        return {success:false,message:'Guardado en progreso'};
    }

    window.auroPlanGuardando = true;

    const textoOriginal = btn ? btn.innerHTML : '';

    try{
        if(btn){
            btn.disabled = true;
            btn.style.opacity = '0.65';
            btn.style.cursor = 'not-allowed';
            btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Guardando plan...';
        }

        const r = await guardarPlanClinicoDesdeSheets();

        if(r && r.success === false){
            throw new Error(r.message || 'No se pudo guardar el Plan clínico.');
        }

        const atn = auroPlanUXAtencionResumen();
        const fechaHora = auroPlanUXFechaHoraAhora();

        auroPlanUXGuardarFechaLocal(atn.id, fechaHora);
        auroPlanUXPintarPanelPlanGuardado(fechaHora);

        if(typeof window.auroPlanActualizarMiniStatus === 'function'){
            setTimeout(function(){
                auroPlanUXPintarPanelPlanGuardado(fechaHora);
            }, 300);
        }

        if(typeof window.auroPlanMostrarEstadoGuardado === 'function'){
            window.auroPlanMostrarEstadoGuardado(
                'Plan clínico guardado correctamente. Última actualización del Plan: ' + fechaHora + '.'
            );
        }

        if(btn){
            btn.innerHTML = '<i class="bi bi-check-circle me-1"></i> Plan actualizado ✓';
            setTimeout(function(){
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.innerHTML = textoOriginal || '<i class="bi bi-list-check me-1"></i> Actualizar Plan Clínico';
            },2500);
        }

        return r || {success:true};

    }catch(e){

        console.error('AUROSANAX PLAN: error guardando plan clínico.', e);
        alert('Error al guardar el Plan clínico.');

        if(btn){
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.innerHTML = textoOriginal || '<i class="bi bi-list-check me-1"></i> Actualizar Plan Clínico';
        }

        return {success:false,message:e.message || String(e)};

    }finally{
        setTimeout(()=>window.auroPlanGuardando=false,500);
    }
}

window.guardarPlanClinicoConUX = guardarPlanClinicoConUX;
window.auroPlanGuardarPlanClinicoConUXPlanJS = guardarPlanClinicoConUX;



/* ============================================================
   AUROSANAX FIX QUIRÚRGICO - HORA TEMPORAL DE RECETA EN PLAN
   Versión: Plan 23
   Alcance exclusivo:
   - Corrige la hora mostrada inmediatamente después de guardar/actualizar
     una receta en la tarjeta pequeña del módulo Plan.
   - Respeta timestamps locales con offset -05:00 sin restar cinco horas.
   - Convierte correctamente timestamps UTC reales terminados en Z.
   - Conserva fechas locales guardadas como texto por Google Sheets.
   - No modifica guardado, recetas, CIE, diagnóstico, Apps Script,
     navegación, botones ni estructura del Plan.
============================================================ */

function auroPlanUXFormatearFechaHoraRecetaSegura(valor){
    const texto = String(valor || '').trim();
    if(!texto) return '';

    let m;

    m = texto.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?-05:00$/i
    );
    if(m){
        return m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5];
    }

    m = texto.match(
        /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/
    );
    if(m){
        return m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5];
    }

    m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m){
        return m[3] + '/' + m[2] + '/' + m[1];
    }

    m = texto.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/
    );
    if(m){
        const fecha =
            String(m[1]).padStart(2,'0') + '/' +
            String(m[2]).padStart(2,'0') + '/' +
            m[3];

        return m[4]
            ? fecha + ' ' + String(m[4]).padStart(2,'0') + ':' + m[5]
            : fecha;
    }

    if(/Z$/i.test(texto) || /[+-]\d{2}:\d{2}$/i.test(texto)){
        try{
            const fecha = new Date(texto);

            if(!isNaN(fecha.getTime())){
                return fecha.toLocaleString('es-EC', {
                    timeZone:'America/Guayaquil',
                    year:'numeric',
                    month:'2-digit',
                    day:'2-digit',
                    hour:'2-digit',
                    minute:'2-digit',
                    hour12:false
                }).replace(',', '');
            }
        }catch(e){}
    }

    return texto;
}

function auroPlanUXRecetaTexto(idAtencion){
    try{
        const raw = localStorage.getItem('aurosanax_recetas_emitidas_v1');
        const arr = raw ? JSON.parse(raw) : [];

        if(!Array.isArray(arr)) return 'Receta pendiente';

        const recetas = arr
            .filter(r =>
                String(r.id_atencion || '').trim() ===
                String(idAtencion || '').trim()
            )
            .sort((a,b) =>
                String(
                    b.actualizado_en ||
                    b.creado_en ||
                    b.fecha_receta ||
                    ''
                ).localeCompare(
                    String(
                        a.actualizado_en ||
                        a.creado_en ||
                        a.fecha_receta ||
                        ''
                    )
                )
            );

        const receta = recetas[0];
        if(!receta) return 'Receta pendiente';

        const fecha =
            receta.actualizado_en ||
            receta.creado_en ||
            receta.fecha_receta ||
            '';

        const visual = auroPlanUXFormatearFechaHoraRecetaSegura(fecha);

        return visual
            ? 'Receta guardada: ' + visual
            : 'Receta pendiente';

    }catch(e){
        return 'Receta pendiente';
    }
}

window.auroPlanActualizarMiniStatus = function(){
    const box = document.getElementById('auroPlanMiniStatus');
    if(!box) return;

    const atn = auroPlanUXAtencionResumen();

    let planFecha = '';

    try{
        const raw = localStorage.getItem(
            'auro_plan_ultimas_actualizaciones_v1'
        );

        const mapa = raw ? JSON.parse(raw) : {};
        planFecha = atn.id && mapa[atn.id]
            ? String(mapa[atn.id])
            : '';
    }catch(e){}

    const recetaTexto = auroPlanUXRecetaTexto(atn.id);

    const planTexto = planFecha
        ? 'Plan actualizado: ' + planFecha
        : 'Plan pendiente de guardar';

    box.innerHTML =
        '<span><i class="bi bi-journal-medical"></i> Consulta ' +
        auroPlanUXEscape(atn.consulta) +
        '</span>' +
        '<span class="' + (planFecha ? 'ok' : 'muted') + '">' +
        '<i class="bi bi-list-check"></i> ' +
        auroPlanUXEscape(planTexto) +
        '</span>' +
        '<span class="' +
        (recetaTexto.includes('guardada') ? 'ok' : 'muted') +
        '">' +
        '<i class="bi bi-capsule"></i> ' +
        auroPlanUXEscape(recetaTexto) +
        '</span>';
};

window.auroPlanUXFormatearFechaHoraRecetaSegura =
    auroPlanUXFormatearFechaHoraRecetaSegura;

/* ========== FIN FIX QUIRÚRGICO HORA TEMPORAL RECETA ========== */

/* ============================================================
   AUROSANAX PLAN - CORRECCIÓN NAVEGACIÓN MISMA ATENCIÓN
   - No limpia el Plan al volver a la misma consulta
   - No recarga Sheets sobre cambios temporales de la misma atención
   - Verifica la atención activa antes de una carga diferida
============================================================ */

/* ============================================================
   AUROSANAX PLAN - FIX SINCRONIZACIÓN ID_ATENCION
   - Fuente oficial: getAtencionActiva()
   - planState se usa como cache, no como autoridad clínica
   - Bloquea mezcla entre consultas
   - Descarta respuestas tardías
   - No modifica JSON, Apps Script ni estructura de datos
============================================================ */

/* ============================================================
   AUROSANAX PLAN - CORRECCIÓN DEFINITIVA CAMBIO DE CONSULTA
   - Diferencia atención interna de atención realmente renderizada
   - Evita guardar datos viejos bajo una atención nueva
   - Limpia medicamentos y campos de receta al cambiar consulta
   - Conserva cache temporal únicamente por id_atencion correcto
============================================================ */
