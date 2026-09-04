AUROSANAX ERP
ENTREGA QUIRÚRGICA — CATÁLOGO DE MEDICAMENTOS
Fecha: 2026-09-04
Estado: DISEÑO / CÓDIGO COMPLETO PARA IMPLEMENTACIÓN CONTROLADA

======================================================================
REGLA DE TRABAJO A PARTIR DE AHORA
======================================================================

Por instrucción del usuario, toda entrega, análisis, código, auditoría o propuesta
relacionada con AUROSANAX se entregará en archivo TXT descargable y completo,
evitando respuestas largas en formato visual dentro de la conversación.

======================================================================
OBJETIVO
======================================================================

Crear un archivo independiente:

catalogo_medicamentos.js

para ampliar el selector de medicamentos dentro de Plan sin dañar:

- plan.js
- recetas.js
- diagnosticos.js
- protocolos_clinicos
- id_atencion
- guardado de Plan
- persistencia histórica
- interfaz actual

El catálogo nuevo será una FUENTE DE DATOS.
No será un módulo clínico nuevo.
No guardará consultas.
No recetará automáticamente.
No modificará protocolos.
No escribirá en Google Sheets.
No tocará Apps Script.

======================================================================
ARQUITECTURA RESULTANTE
======================================================================

CATÁLOGO MANUAL

catalogo_medicamentos.js
        ↓
window.MEDICAMENTOS_AUROSANAX_BASE
        ↓
plan.js
        ↓
selector de medicamentos
        ↓
Plan clínico
        ↓
Receta

MOTOR CLÍNICO ACTUAL

Diagnóstico CIE-10
        ↓
protocolos_clinicos
        ↓
diagnosticos.js
        ↓
sugerencias clínicas
        ↓
plan.js
        ↓
medicamento seleccionado por la doctora
        ↓
Plan clínico
        ↓
Receta

IMPORTANTE:
El catálogo NO reemplaza el motor diagnóstico/protocolo.
El catálogo ayuda a buscar y completar medicamentos.
Los protocolos siguen siendo los que relacionan diagnóstico con sugerencias clínicas.

======================================================================
BASE DE MEDICAMENTOS — CÓMO SE MANEJARÁ
======================================================================

FASE ACTUAL
-----------

Se utilizará una base inicial construida con:

1. Medicamentos que ya existen actualmente en plan.js.
2. Medicamentos que ya aparecen en protocolos_clinicos.
3. Nombres genéricos / principios activos ya conocidos dentro del ERP.

Esto permite conectar primero el sistema sin tocar todavía una base externa grande.

FASE DE AMPLIACIÓN
------------------

Después de comprobar que la integración funciona correctamente, se ampliará el mismo
catalogo_medicamentos.js con medicamentos validados.

Fuentes recomendadas para esa ampliación:

- ARCSA Ecuador: medicamentos registrados / registros sanitarios.
- OMS / ATC-DDD: denominaciones genéricas y principios activos.
- Protocolos clínicos internos ya existentes en AUROSANAX.

NO se deben descargar ni copiar indiscriminadamente miles de registros con esquemas
terapéuticos automáticos.

El catálogo podrá contener:

- nombre principal
- principio activo
- denominaciones comerciales
- nombres alternativos
- forma farmacéutica
- concentración
- vía
- categoría

Pero dosis, frecuencia, duración e indicaciones NO deben considerarse universales.

Esos campos solo pueden conservarse cuando ya existen como apoyo clínico definido
en AUROSANAX o cuando sean expresamente revisados y aprobados por la doctora.

======================================================================
DECISIÓN SOBRE "BASE DE DATOS"
======================================================================

NO se recomienda crear por ahora una nueva pestaña de Google Sheets ni tocar Apps Script.

La primera versión debe trabajar únicamente con:

catalogo_medicamentos.js

Esto reduce riesgo y complejidad.

Más adelante, si se desea administrar medicamentos sin editar GitHub, se puede crear
una segunda fase con una pestaña:

catalogo_medicamentos

en Google Sheets.

En esa fase futura, Plan seguiría consumiendo el MISMO contrato de datos.
Por eso no habría que reconstruir el selector.

La estrategia es:

FASE 1:
catalogo_medicamentos.js

FASE 2 opcional:
Google Sheets → backend → mismo catálogo lógico → plan.js

No hacer ambas fases al mismo tiempo.

======================================================================
ARCHIVO COMPLETO: catalogo_medicamentos.js
======================================================================

/***********************************************************************
 AUROSANAX ERP
 Archivo: catalogo_medicamentos.js
 Módulo: Catálogo Maestro de Medicamentos
 Versión: 1.0.0
 Fecha: 2026-09-04

 OBJETIVO
 - Proveer un catálogo maestro de medicamentos para el selector de Plan.
 - Permitir búsqueda futura por principio activo, denominación comercial,
   presentación, concentración y nombres alternativos.
 - Mantener compatibilidad total con plan.js, protocolos y recetas.js.
 - NO guardar información clínica.
 - NO modificar id_atencion.
 - NO modificar Plan, Recetas, Diagnósticos ni protocolos.
 - NO definir esquemas terapéuticos automáticos.
************************************************************************/

(function(){
    'use strict';

    /*
      CONTRATO DE COMPATIBILIDAD
      --------------------------
      Los campos históricos que consume plan.js se conservan:

      med  = nombre principal mostrado en Plan
      pres = presentación compatible con Plan/Recetas
      via  = vía compatible
      frec = frecuencia sugerida existente, cuando corresponda
      dur  = duración sugerida existente, cuando corresponda
      ind  = indicación existente, cuando corresponda
      cat  = categoría

      Los campos nuevos son únicamente informativos/de búsqueda:
      principio_activo
      denominaciones_comerciales
      nombres_alternativos
      forma_farmaceutica
      concentracion
    */

    const CATALOGO_AUROSANAX = [

        /* ============================================================
           GINECOLOGÍA / INFECCIONES VAGINALES
        ============================================================ */

        {
            cat:'GINECOLOGÍA',
            med:'Metronidazol',
            principio_activo:'Metronidazol',
            denominaciones_comerciales:[],
            nombres_alternativos:['Metronidazole'],
            forma_farmaceutica:'Tableta',
            concentracion:'500 mg',
            pres:'500 mg tableta',
            via:'VO',
            frec:'cada 12 horas',
            dur:'7 días',
            ind:'Tomar después de alimentos'
        },

        {
            cat:'GINECOLOGÍA',
            med:'Metronidazol',
            principio_activo:'Metronidazol',
            denominaciones_comerciales:[],
            nombres_alternativos:['Metronidazole vaginal'],
            forma_farmaceutica:'Óvulo vaginal',
            concentracion:'',
            pres:'óvulo vaginal',
            via:'Vaginal',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'GINECOLOGÍA',
            med:'Tinidazol',
            principio_activo:'Tinidazol',
            denominaciones_comerciales:[],
            nombres_alternativos:[],
            forma_farmaceutica:'Tableta',
            concentracion:'500 mg',
            pres:'500 mg tableta',
            via:'VO',
            frec:'según esquema médico',
            dur:'según indicación',
            ind:'Tomar después de alimentos'
        },

        {
            cat:'GINECOLOGÍA',
            med:'Secnidazol',
            principio_activo:'Secnidazol',
            denominaciones_comerciales:[],
            nombres_alternativos:[],
            forma_farmaceutica:'Tableta',
            concentracion:'1 g',
            pres:'1 g tableta',
            via:'VO',
            frec:'dosis única',
            dur:'1 día',
            ind:'Tomar después de alimentos'
        },

        {
            cat:'GINECOLOGÍA',
            med:'Clotrimazol',
            principio_activo:'Clotrimazol',
            denominaciones_comerciales:[],
            nombres_alternativos:[],
            forma_farmaceutica:'Óvulo vaginal',
            concentracion:'',
            pres:'óvulo vaginal',
            via:'Vaginal',
            frec:'cada noche',
            dur:'7 noches',
            ind:'Aplicar antes de dormir'
        },

        {
            cat:'GINECOLOGÍA',
            med:'Miconazol',
            principio_activo:'Miconazol',
            denominaciones_comerciales:[],
            nombres_alternativos:['Miconazole'],
            forma_farmaceutica:'Óvulo vaginal',
            concentracion:'',
            pres:'óvulo vaginal',
            via:'Vaginal',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'GINECOLOGÍA',
            med:'Fluconazol',
            principio_activo:'Fluconazol',
            denominaciones_comerciales:[],
            nombres_alternativos:[],
            forma_farmaceutica:'Cápsula',
            concentracion:'150 mg',
            pres:'150 mg cápsula',
            via:'VO',
            frec:'dosis única',
            dur:'1 día',
            ind:'Según indicación médica'
        },

        {
            cat:'GINECOLOGÍA',
            med:'Nistatina',
            principio_activo:'Nistatina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Nystatin'],
            forma_farmaceutica:'Óvulo vaginal',
            concentracion:'',
            pres:'óvulo vaginal',
            via:'Vaginal',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'GINECOLOGÍA',
            med:'Clindamicina',
            principio_activo:'Clindamicina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Clindamicina vaginal'],
            forma_farmaceutica:'Crema vaginal',
            concentracion:'',
            pres:'crema vaginal',
            via:'Vaginal',
            frec:'',
            dur:'',
            ind:''
        },

        /* ============================================================
           INFECCIONES / CERVICITIS
        ============================================================ */

        {
            cat:'ANTIINFECCIOSOS',
            med:'Azitromicina',
            principio_activo:'Azitromicina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Azithromycin'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'ANTIINFECCIOSOS',
            med:'Doxiciclina',
            principio_activo:'Doxiciclina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Doxycycline'],
            forma_farmaceutica:'Tableta / cápsula',
            concentracion:'',
            pres:'tableta / cápsula',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'ANTIINFECCIOSOS',
            med:'Ceftriaxona',
            principio_activo:'Ceftriaxona',
            denominaciones_comerciales:[],
            nombres_alternativos:['Ceftriaxone'],
            forma_farmaceutica:'Polvo para inyección',
            concentracion:'',
            pres:'inyectable',
            via:'IM',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'ANTIINFECCIOSOS',
            med:'Amoxicilina + ácido clavulánico',
            principio_activo:'Amoxicilina + ácido clavulánico',
            denominaciones_comerciales:[],
            nombres_alternativos:[
                'Amoxicilina ácido clavulánico',
                'Amoxicillin clavulanate'
            ],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'ANTIINFECCIOSOS',
            med:'Cefalexina',
            principio_activo:'Cefalexina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Cephalexin'],
            forma_farmaceutica:'Cápsula / tableta',
            concentracion:'',
            pres:'cápsula / tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        /* ============================================================
           UROLOGÍA / VÍAS URINARIAS
        ============================================================ */

        {
            cat:'UROLOGÍA',
            med:'Nitrofurantoína',
            principio_activo:'Nitrofurantoína',
            denominaciones_comerciales:[],
            nombres_alternativos:['Nitrofurantoin'],
            forma_farmaceutica:'Cápsula',
            concentracion:'100 mg',
            pres:'100 mg cápsula',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'UROLOGÍA',
            med:'Fosfomicina trometamol',
            principio_activo:'Fosfomicina trometamol',
            denominaciones_comerciales:[],
            nombres_alternativos:[
                'Fosfomicina',
                'Fosfomycin trometamol'
            ],
            forma_farmaceutica:'Sobre granulado',
            concentracion:'3 g',
            pres:'3 g sobre granulado',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'UROLOGÍA',
            med:'Fenazopiridina',
            principio_activo:'Fenazopiridina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Phenazopyridine'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        /* ============================================================
           ANALGESIA / ANTIINFLAMATORIOS
        ============================================================ */

        {
            cat:'ANALGÉSICOS',
            med:'Paracetamol',
            principio_activo:'Paracetamol',
            denominaciones_comerciales:[],
            nombres_alternativos:[
                'Acetaminofén',
                'Acetaminophen'
            ],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'ANALGÉSICOS',
            med:'Ibuprofeno',
            principio_activo:'Ibuprofeno',
            denominaciones_comerciales:[],
            nombres_alternativos:['Ibuprofen'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'ANALGÉSICOS',
            med:'Naproxeno',
            principio_activo:'Naproxeno',
            denominaciones_comerciales:[],
            nombres_alternativos:['Naproxen'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'ANALGÉSICOS',
            med:'Ketorolaco',
            principio_activo:'Ketorolaco',
            denominaciones_comerciales:[],
            nombres_alternativos:['Ketorolac'],
            forma_farmaceutica:'Tableta / inyectable',
            concentracion:'',
            pres:'tableta / inyectable',
            via:'',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'ANTIESPASMÓDICOS',
            med:'Butilbromuro de hioscina',
            principio_activo:'Butilbromuro de hioscina',
            denominaciones_comerciales:[],
            nombres_alternativos:[
                'Hioscina butilbromuro',
                'Hyoscine butylbromide'
            ],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        /* ============================================================
           GINECOLOGÍA / SANGRADO
        ============================================================ */

        {
            cat:'GINECOLOGÍA',
            med:'Ácido tranexámico',
            principio_activo:'Ácido tranexámico',
            denominaciones_comerciales:[],
            nombres_alternativos:['Tranexamic acid'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'HEMATOLOGÍA',
            med:'Hierro oral',
            principio_activo:'Hierro',
            denominaciones_comerciales:[],
            nombres_alternativos:[
                'Hierro polimaltosado',
                'Sulfato ferroso',
                'Hierro'
            ],
            forma_farmaceutica:'Tableta / solución oral',
            concentracion:'',
            pres:'tableta / solución oral',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'OBSTETRICIA',
            med:'Ácido fólico',
            principio_activo:'Ácido fólico',
            denominaciones_comerciales:[],
            nombres_alternativos:['Folic acid'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        /* ============================================================
           ENDOCRINOLOGÍA / SOP
        ============================================================ */

        {
            cat:'ENDOCRINOLOGÍA',
            med:'Metformina',
            principio_activo:'Metformina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Metformin'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'GINECOLOGÍA',
            med:'Espironolactona',
            principio_activo:'Espironolactona',
            denominaciones_comerciales:[],
            nombres_alternativos:['Spironolactone'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'GINECOLOGÍA',
            med:'Medroxiprogesterona',
            principio_activo:'Medroxiprogesterona',
            denominaciones_comerciales:[],
            nombres_alternativos:[
                'Acetato de medroxiprogesterona'
            ],
            forma_farmaceutica:'Tableta / inyectable',
            concentracion:'',
            pres:'tableta / inyectable',
            via:'',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'GINECOLOGÍA',
            med:'Letrozol',
            principio_activo:'Letrozol',
            denominaciones_comerciales:[],
            nombres_alternativos:['Letrozole'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        /* ============================================================
           CARDIOVASCULAR
        ============================================================ */

        {
            cat:'CARDIOVASCULAR',
            med:'Losartán',
            principio_activo:'Losartán',
            denominaciones_comerciales:[],
            nombres_alternativos:['Losartan'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'CARDIOVASCULAR',
            med:'Enalapril',
            principio_activo:'Enalapril',
            denominaciones_comerciales:[],
            nombres_alternativos:[],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'CARDIOVASCULAR',
            med:'Amlodipino',
            principio_activo:'Amlodipino',
            denominaciones_comerciales:[],
            nombres_alternativos:['Amlodipine'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'CARDIOVASCULAR',
            med:'Hidroclorotiazida',
            principio_activo:'Hidroclorotiazida',
            denominaciones_comerciales:[],
            nombres_alternativos:['Hydrochlorothiazide'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'CARDIOVASCULAR',
            med:'Clortalidona',
            principio_activo:'Clortalidona',
            denominaciones_comerciales:[],
            nombres_alternativos:['Chlorthalidone'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'CARDIOVASCULAR',
            med:'Valsartán',
            principio_activo:'Valsartán',
            denominaciones_comerciales:[],
            nombres_alternativos:['Valsartan'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        },

        /* ============================================================
           DERMATOLOGÍA / TÓPICOS
        ============================================================ */

        {
            cat:'DERMATOLOGÍA',
            med:'Mupirocina',
            principio_activo:'Mupirocina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Mupirocin'],
            forma_farmaceutica:'Ungüento / crema',
            concentracion:'',
            pres:'ungüento / crema',
            via:'Tópica',
            frec:'',
            dur:'',
            ind:'Uso externo'
        },

        {
            cat:'DERMATOLOGÍA',
            med:'Ácido fusídico',
            principio_activo:'Ácido fusídico',
            denominaciones_comerciales:[],
            nombres_alternativos:['Fusidic acid'],
            forma_farmaceutica:'Crema',
            concentracion:'',
            pres:'crema',
            via:'Tópica',
            frec:'',
            dur:'',
            ind:'Uso externo'
        },

        {
            cat:'DERMATOLOGÍA',
            med:'Hidrocortisona',
            principio_activo:'Hidrocortisona',
            denominaciones_comerciales:[],
            nombres_alternativos:['Hydrocortisone'],
            forma_farmaceutica:'Crema',
            concentracion:'',
            pres:'crema',
            via:'Tópica',
            frec:'',
            dur:'',
            ind:'Uso externo'
        },

        /* ============================================================
           OTROS
        ============================================================ */

        {
            cat:'GASTROINTESTINAL',
            med:'Probióticos',
            principio_activo:'Probióticos',
            denominaciones_comerciales:[],
            nombres_alternativos:['Probiotics'],
            forma_farmaceutica:'Cápsula / sobre',
            concentracion:'',
            pres:'cápsula / sobre',
            via:'VO',
            frec:'',
            dur:'',
            ind:''
        }

    ];

    /* ============================================================
       NORMALIZACIÓN INTERNA
       No modifica datos clínicos ni registros persistentes.
    ============================================================ */

    function texto(valor){
        return String(valor === null || valor === undefined ? '' : valor).trim();
    }

    function normalizar(valor){
        return texto(valor)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g,'')
            .toLowerCase()
            .replace(/\s+/g,' ')
            .trim();
    }

    function arrayTexto(valor){
        if(Array.isArray(valor)){
            return valor.map(texto).filter(Boolean);
        }

        if(!texto(valor)) return [];

        return [texto(valor)];
    }

    function normalizarRegistro(m){
        m = m || {};

        return {
            cat: texto(m.cat),
            med: texto(m.med),
            principio_activo: texto(m.principio_activo || m.med),

            denominaciones_comerciales:
                arrayTexto(m.denominaciones_comerciales),

            nombres_alternativos:
                arrayTexto(m.nombres_alternativos),

            forma_farmaceutica:
                texto(m.forma_farmaceutica),

            concentracion:
                texto(m.concentracion),

            /*
              CONTRATO HISTÓRICO DE PLAN
            */
            pres: texto(m.pres),
            via: texto(m.via),
            frec: texto(m.frec),
            dur: texto(m.dur),
            ind: texto(m.ind)
        };
    }

    function firmaMedicamento(m){
        return [
            normalizar(m.med),
            normalizar(m.pres),
            normalizar(m.via)
        ].join('|');
    }

    function fusionarSinDuplicados(lista){
        const mapa = new Map();

        (lista || []).forEach(function(item){
            const m = normalizarRegistro(item);

            if(!m.med) return;

            const firma = firmaMedicamento(m);

            if(!mapa.has(firma)){
                mapa.set(firma, m);
                return;
            }

            /*
              Si dos fuentes contienen el mismo medicamento,
              se conserva el primer registro y solo se amplían
              datos informativos de búsqueda.
            */
            const actual = mapa.get(firma);

            actual.denominaciones_comerciales =
                Array.from(new Set([
                    ...actual.denominaciones_comerciales,
                    ...m.denominaciones_comerciales
                ]));

            actual.nombres_alternativos =
                Array.from(new Set([
                    ...actual.nombres_alternativos,
                    ...m.nombres_alternativos
                ]));
        });

        return Array.from(mapa.values());
    }

    /*
      Compatibilidad defensiva:
      si otra fuente ya definió medicamentos antes de este archivo,
      se fusionan en lugar de destruirlos.
    */
    const existentes =
        Array.isArray(window.MEDICAMENTOS_AUROSANAX_BASE)
            ? window.MEDICAMENTOS_AUROSANAX_BASE
            : [];

    window.MEDICAMENTOS_AUROSANAX_BASE =
        fusionarSinDuplicados([
            ...CATALOGO_AUROSANAX,
            ...existentes
        ]);

    /*
      API DE SOLO LECTURA
      Útil para futuras ampliaciones sin tocar Plan.
    */
    window.AUROSANAX_CATALOGO_MEDICAMENTOS = {

        version:'1.0.0',

        obtenerTodos:function(){
            return window.MEDICAMENTOS_AUROSANAX_BASE.slice();
        },

        cantidad:function(){
            return window.MEDICAMENTOS_AUROSANAX_BASE.length;
        },

        buscar:function(consulta){

            const q = normalizar(consulta);

            if(!q){
                return window.MEDICAMENTOS_AUROSANAX_BASE.slice();
            }

            return window.MEDICAMENTOS_AUROSANAX_BASE.filter(function(m){

                const textoBusqueda = [
                    m.med,
                    m.principio_activo,
                    m.pres,
                    m.forma_farmaceutica,
                    m.concentracion,
                    m.cat,
                    ...(m.denominaciones_comerciales || []),
                    ...(m.nombres_alternativos || [])
                ].join(' ');

                return normalizar(textoBusqueda).includes(q);
            });
        }
    };

    console.info(
        'AUROSANAX: Catálogo de medicamentos cargado:',
        window.MEDICAMENTOS_AUROSANAX_BASE.length,
        'registros.'
    );

})();

======================================================================
CAMBIO MÍNIMO EN index.html
======================================================================

El archivo nuevo debe cargarse INMEDIATAMENTE ANTES de plan.js:

<!-- AUROSANAX - Catálogo maestro de medicamentos -->
<script src="catalogo_medicamentos.js?v=20260904_1"></script>

<!-- AUROSANAX - Módulo Plan clínico -->
<script src="plan.js?v=20260824_1"></script>

IMPORTANTE:
No cambiar el orden posterior de Atenciones, Obstetricia, Ginecología,
Diagnósticos ni Recetas.

======================================================================
CAMBIO QUIRÚRGICO ÚNICO EN plan.js
======================================================================

BUSCAR dentro de renderMedicamentoSugerencias() el bloque actual:

const res = base
    .filter(m => !q || normalizarMedTexto(
        (m.med || '') + ' ' + (m.pres || '') + ' ' + (m.cat || '')
    ).includes(q))
    .slice(0,40);

REEMPLAZAR SOLO ESE BLOQUE POR:

const res = base
    .filter(m => {

        const comerciales = Array.isArray(m.denominaciones_comerciales)
            ? m.denominaciones_comerciales.join(' ')
            : String(m.denominaciones_comerciales || '');

        const alternativos = Array.isArray(m.nombres_alternativos)
            ? m.nombres_alternativos.join(' ')
            : String(m.nombres_alternativos || '');

        const textoBusqueda = [
            m.med || '',
            m.principio_activo || '',
            m.pres || '',
            m.forma_farmaceutica || '',
            m.concentracion || '',
            m.cat || '',
            comerciales,
            alternativos
        ].join(' ');

        return !q || normalizarMedTexto(textoBusqueda).includes(q);
    })
    .slice(0,40);

NO cambiar ninguna otra función de plan.js en esta fase.

======================================================================
QUÉ SE CONSERVA EXACTAMENTE
======================================================================

Plan seguirá guardando exactamente:

{
    med,
    pres,
    via,
    cantidad,
    frec,
    dur,
    ind,
    continuo
}

No se modifica ese contrato.

Los campos nuevos del catálogo:

- principio_activo
- denominaciones_comerciales
- nombres_alternativos
- forma_farmaceutica
- concentracion

sirven solamente para búsqueda y enriquecimiento del catálogo.

No se persisten todavía dentro de planes_clinicos.

======================================================================
PRUEBA DE VALIDACIÓN DESPUÉS DE INTEGRAR
======================================================================

1. Abrir paciente DEMO.
2. Crear/abrir atención válida.
3. Entrar a Plan.
4. Buscar:
   - Nitrofurantoína
   - Fosfomicina
   - Metronidazol
   - Acetaminofén
   - Paracetamol
5. Confirmar que aparecen sugerencias.
6. Seleccionar medicamento.
7. Verificar que se llenan presentación y vía.
8. Agregar medicamento al Plan.
9. Guardar Plan.
10. Abrir Receta y comprobar Plan → Receta.
11. Cambiar de atención.
12. Confirmar que no se arrastra medicación de otra id_atencion.
13. Probar un diagnóstico con protocolo.
14. Aplicar una sugerencia del protocolo al Plan.
15. Confirmar que el protocolo sigue funcionando igual.

======================================================================
CONCLUSIÓN
======================================================================

La forma más segura y menos compleja es:

AHORA:
- catalogo_medicamentos.js
- una línea de carga en index.html
- una ampliación mínima del filtro de búsqueda en plan.js

DESPUÉS:
- ampliar la lista del mismo catálogo con medicamentos verificados
- agregar denominaciones comerciales revisadas
- no tocar nuevamente la arquitectura del Plan

NO se recomienda todavía:
- crear una pestaña nueva en Sheets
- tocar Apps Script
- mover el catálogo al backend
- modificar Recetas
- modificar Diagnósticos
- modificar protocolos_clinicos
- cambiar la interfaz
- cambiar el formato histórico del Plan

======================================================================
FIN DEL DOCUMENTO
======================================================================
