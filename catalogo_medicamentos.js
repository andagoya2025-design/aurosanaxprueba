/***********************************************************************
 AUROSANAX ERP
 Archivo: catalogo_medicamentos.js
 Módulo: Catálogo Maestro de Medicamentos
 Versión: 1.0.0
 Fecha: 2026-09-04

 REGLA:
 - SOLO catálogo.
 - NO guarda datos.
 - NO modifica id_atencion.
 - NO toca Plan, Recetas, Diagnósticos, Apps Script ni Google Sheets.
 - Mantiene compatibilidad con window.MEDICAMENTOS_AUROSANAX_BASE.
************************************************************************/

(function(){
    'use strict';

    const CATALOGO_AUROSANAX = [

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
            frec:'',
            dur:'',
            ind:''
        },

        {
            cat:'GINECOLOGÍA',
            med:'Secnidazol',
            principio_activo:'Secnidazol',
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
            cat:'GINECOLOGÍA',
            med:'Clotrimazol',
            principio_activo:'Clotrimazol',
            denominaciones_comerciales:[],
            nombres_alternativos:[],
            forma_farmaceutica:'Óvulo vaginal',
            concentracion:'',
            pres:'óvulo vaginal',
            via:'VAGINAL',
            frec:'',
            dur:'',
            ind:''
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
            via:'VAGINAL',
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
            via:'VAGINAL',
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
            via:'VAGINAL',
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

        {
            cat:'ANALGÉSICOS',
            med:'Paracetamol',
            principio_activo:'Paracetamol',
            denominaciones_comerciales:[],
            nombres_alternativos:['Acetaminofén','Acetaminophen'],
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
        },

        {
            cat:'DERMATOLOGÍA',
            med:'Mupirocina',
            principio_activo:'Mupirocina',
            denominaciones_comerciales:[],
            nombres_alternativos:['Mupirocin'],
            forma_farmaceutica:'Ungüento / crema',
            concentracion:'',
            pres:'ungüento / crema',
            via:'TÓPICA',
            frec:'',
            dur:'',
            ind:''
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
            via:'TÓPICA',
            frec:'',
            dur:'',
            ind:''
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
            via:'TÓPICA',
            frec:'',
            dur:'',
            ind:''
        },

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

})();
