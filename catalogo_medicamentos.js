/***********************************************************************
 AUROSANAX ERP
 Archivo: catalogo_medicamentos.js
 Módulo: Catálogo Maestro de Medicamentos
 Versión: 1.0.1
 Fecha: 2026-09-04

 OBJETIVO ANTIRREGRESIVO
 - Conservar EXACTAMENTE los 15 medicamentos base actuales de plan.js.
 - Agregar nuevos medicamentos sin alterar el comportamiento previo.
 - Mantener compatibilidad con window.MEDICAMENTOS_AUROSANAX_BASE.
 - NO guardar datos.
 - NO modificar id_atencion.
 - NO tocar Plan, Recetas, Diagnósticos, Apps Script ni Google Sheets.
************************************************************************/

(function(){
    'use strict';

    const CATALOGO_AUROSANAX = [

        /* ============================================================
           BASE ESTABLE HEREDADA DE plan.js
           Estos 15 registros conservan EXACTAMENTE su comportamiento.
        ============================================================ */

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
            cat:'DOLOR / INFLAMACIÓN',
            med:'Ibuprofeno',
            principio_activo:'Ibuprofeno',
            denominaciones_comerciales:[],
            nombres_alternativos:['Ibuprofen'],
            forma_farmaceutica:'Tableta',
            concentracion:'400 mg',
            pres:'400 mg tableta',
            via:'VO',
            frec:'cada 8 horas',
            dur:'3 a 5 días',
            ind:'Tomar después de alimentos'
        },

        {
            cat:'DOLOR / INFLAMACIÓN',
            med:'Paracetamol',
            principio_activo:'Paracetamol',
            denominaciones_comerciales:[],
            nombres_alternativos:['Acetaminofén','Acetaminophen'],
            forma_farmaceutica:'Tableta',
            concentracion:'500 mg',
            pres:'500 mg tableta',
            via:'VO',
            frec:'cada 8 horas',
            dur:'3 a 5 días',
            ind:'Si dolor o fiebre'
        },

        {
            cat:'DOLOR / INFLAMACIÓN',
            med:'Ketorolaco',
            principio_activo:'Ketorolaco',
            denominaciones_comerciales:[],
            nombres_alternativos:['Ketorolac'],
            forma_farmaceutica:'Tableta',
            concentracion:'10 mg',
            pres:'10 mg tableta',
            via:'VO',
            frec:'cada 8 horas',
            dur:'máximo 3 días',
            ind:'Tomar después de alimentos'
        },

        {
            cat:'MEDICINA GENERAL',
            med:'Amoxicilina + ácido clavulánico',
            principio_activo:'Amoxicilina + ácido clavulánico',
            denominaciones_comerciales:[],
            nombres_alternativos:[
                'Amoxicilina ácido clavulánico',
                'Amoxicillin clavulanate'
            ],
            forma_farmaceutica:'Tableta',
            concentracion:'875/125 mg',
            pres:'875/125 mg tableta',
            via:'VO',
            frec:'cada 12 horas',
            dur:'7 días',
            ind:'Tomar con alimentos'
        },

        {
            cat:'MEDICINA GENERAL',
            med:'Cefalexina',
            principio_activo:'Cefalexina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Cephalexin'],
            forma_farmaceutica:'Cápsula',
            concentracion:'500 mg',
            pres:'500 mg cápsula',
            via:'VO',
            frec:'cada 6 horas',
            dur:'7 días',
            ind:''
        },

        {
            cat:'DERMATOLOGÍA / ESTÉTICA',
            med:'Mupirocina',
            principio_activo:'Mupirocina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Mupirocin'],
            forma_farmaceutica:'Ungüento',
            concentracion:'',
            pres:'ungüento',
            via:'Tópica',
            frec:'cada 8 horas',
            dur:'5 a 7 días',
            ind:'Aplicar capa fina'
        },

        {
            cat:'DERMATOLOGÍA / ESTÉTICA',
            med:'Ácido fusídico',
            principio_activo:'Ácido fusídico',
            denominaciones_comerciales:[],
            nombres_alternativos:['Fusidic acid'],
            forma_farmaceutica:'Crema',
            concentracion:'',
            pres:'crema',
            via:'Tópica',
            frec:'cada 8 horas',
            dur:'7 días',
            ind:'Aplicar capa fina'
        },

        {
            cat:'DERMATOLOGÍA / ESTÉTICA',
            med:'Hidrocortisona',
            principio_activo:'Hidrocortisona',
            denominaciones_comerciales:[],
            nombres_alternativos:['Hydrocortisone'],
            forma_farmaceutica:'Crema',
            concentracion:'1%',
            pres:'1% crema',
            via:'Tópica',
            frec:'cada 12 horas',
            dur:'3 a 5 días',
            ind:'Aplicar capa fina'
        },

        {
            cat:'UROLOGÍA',
            med:'Fenazopiridina',
            principio_activo:'Fenazopiridina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Phenazopyridine'],
            forma_farmaceutica:'Tableta',
            concentracion:'100 mg',
            pres:'100 mg tableta',
            via:'VO',
            frec:'cada 8 horas',
            dur:'2 días',
            ind:'Uso sintomático según indicación'
        },

        {
            cat:'OTROS',
            med:'Probióticos',
            principio_activo:'Probióticos',
            denominaciones_comerciales:[],
            nombres_alternativos:['Probiotics'],
            forma_farmaceutica:'Cápsula / sobre',
            concentracion:'',
            pres:'cápsula/sobre',
            via:'VO',
            frec:'cada día',
            dur:'10 a 30 días',
            ind:''
        },

        /* ============================================================
           NUEVOS MEDICAMENTOS
           Sin esquemas universales automáticos.
        ============================================================ */

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
            forma_farmaceutica:'Inyectable',
            concentracion:'',
            pres:'inyectable',
            via:'',
            frec:'',
            dur:'',
            ind:''
        },

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
            nombres_alternativos:['Fosfomicina','Fosfomycin trometamol'],
            forma_farmaceutica:'Sobre granulado',
            concentracion:'3 g',
            pres:'3 g sobre granulado',
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
            cat:'ANTIESPASMÓDICOS',
            med:'Butilbromuro de hioscina',
            principio_activo:'Butilbromuro de hioscina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Hioscina butilbromuro','Hyoscine butylbromide'],
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
            med:'Sulfato ferroso',
            principio_activo:'Hierro',
            denominaciones_comerciales:[],
            nombres_alternativos:['Hierro','Ferrous sulfate'],
            forma_farmaceutica:'Tableta',
            concentracion:'',
            pres:'tableta',
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
            nombres_alternativos:['Acetato de medroxiprogesterona'],
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
        }

    ];

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
            denominaciones_comerciales: arrayTexto(m.denominaciones_comerciales),
            nombres_alternativos: arrayTexto(m.nombres_alternativos),
            forma_farmaceutica: texto(m.forma_farmaceutica),
            concentracion: texto(m.concentracion),
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

    const existentes =
        Array.isArray(window.MEDICAMENTOS_AUROSANAX_BASE)
            ? window.MEDICAMENTOS_AUROSANAX_BASE
            : [];

    window.MEDICAMENTOS_AUROSANAX_BASE =
        fusionarSinDuplicados([
            ...CATALOGO_AUROSANAX,
            ...existentes
        ]);

    window.AUROSANAX_CATALOGO_MEDICAMENTOS = {

        version:'1.0.1',

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

})();
