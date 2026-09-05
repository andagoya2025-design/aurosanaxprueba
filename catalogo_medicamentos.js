/***********************************************************************
 AUROSANAX ERP
 Archivo: catalogo_medicamentos.js
 Módulo: Catálogo Maestro de Medicamentos
 Versión: 1.2.0
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
        },

        /* ============================================================
           INCORPORACIONES VALIDADAS / CONTROLADAS v1.1.0
           Sin pautas universales automáticas.
        ============================================================ */
        {
            cat:'GINECOLOGÍA', med:'Estriol', principio_activo:'Estriol',
            denominaciones_comerciales:[], nombres_alternativos:[],
            forma_farmaceutica:'Crema vaginal', concentracion:'0,1 %',
            pres:'0,1 % crema vaginal', via:'Vaginal', frec:'', dur:'', ind:''
        },
        {
            cat:'GINECOLOGÍA', med:'Dienogest', principio_activo:'Dienogest',
            denominaciones_comerciales:[], nombres_alternativos:[],
            forma_farmaceutica:'Tableta', concentracion:'2 mg',
            pres:'2 mg tableta', via:'VO', frec:'', dur:'', ind:''
        },
        {
            cat:'ENDOCRINOLOGÍA', med:'Calcifediol', principio_activo:'Calcifediol',
            denominaciones_comerciales:[], nombres_alternativos:[],
            forma_farmaceutica:'Cápsula', concentracion:'0,266 mg',
            pres:'0,266 mg cápsula', via:'VO', frec:'', dur:'', ind:''
        },
        {
            cat:'OTROS', med:'Melatonina', principio_activo:'Melatonina',
            denominaciones_comerciales:[], nombres_alternativos:[],
            forma_farmaceutica:'Tableta', concentracion:'5 mg',
            pres:'5 mg tableta', via:'VO', frec:'', dur:'', ind:''
        },
        {
            cat:'OTROS', med:'Ácido ascórbico', principio_activo:'Ácido ascórbico',
            denominaciones_comerciales:[], nombres_alternativos:['Vitamina C'],
            forma_farmaceutica:'', concentracion:'',
            pres:'', via:'', frec:'', dur:'', ind:''
        },
        {
            cat:'OTROS', med:'Omega 3', principio_activo:'Omega 3',
            denominaciones_comerciales:[], nombres_alternativos:['Omega-3'],
            forma_farmaceutica:'Cápsula', concentracion:'1 g',
            pres:'1 g cápsula', via:'VO', frec:'', dur:'', ind:'',
            clasificacion:'suplemento/complementario'
        }
,

        /* ============================================================
           AMPLIACIÓN OFICIAL-REFERENCIADA ECUADOR v1.2.0 — 50 ENTIDADES
           - Selección orientada a práctica clínica AUROSANAX.
           - Referencias nacionales: ARCSA + CNMB/CONASA.
           - Frecuencia, duración e indicaciones quedan VACÍAS.
           - Presentación/concentración/vía quedan VACÍAS cuando no se
             ha fijado una variante específica en el catálogo.
           - NO altera los 44 registros previos ni sus variantes.
        ============================================================ */

        {
    cat:'GINECOLOGÍA / OBSTETRICIA',
    med:'Progesterona',
    principio_activo:'Progesterona',
    denominaciones_comerciales:[],
    nombres_alternativos:['Progesterone'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / OBSTETRICIA',
    med:'Estradiol',
    principio_activo:'Estradiol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Estradiol'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / ANTICONCEPCIÓN',
    med:'Levonorgestrel',
    principio_activo:'Levonorgestrel',
    denominaciones_comerciales:[],
    nombres_alternativos:['Levonorgestrel'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / ANTICONCEPCIÓN',
    med:'Etinilestradiol + levonorgestrel',
    principio_activo:'Etinilestradiol + levonorgestrel',
    denominaciones_comerciales:[],
    nombres_alternativos:['Ethinylestradiol + levonorgestrel'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / ANTICONCEPCIÓN',
    med:'Desogestrel',
    principio_activo:'Desogestrel',
    denominaciones_comerciales:[],
    nombres_alternativos:['Desogestrel'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / ANTICONCEPCIÓN',
    med:'Drospirenona + etinilestradiol',
    principio_activo:'Drospirenona + etinilestradiol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Drospirenone + ethinylestradiol'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / ANTICONCEPCIÓN',
    med:'Noretisterona',
    principio_activo:'Noretisterona',
    denominaciones_comerciales:[],
    nombres_alternativos:['Norethisterone', 'Noretindrona'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / ENDOCRINOLOGÍA',
    med:'Cabergolina',
    principio_activo:'Cabergolina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Cabergoline'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / ENDOCRINOLOGÍA',
    med:'Bromocriptina',
    principio_activo:'Bromocriptina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Bromocriptine'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'OBSTETRICIA',
    med:'Oxitocina',
    principio_activo:'Oxitocina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Oxytocin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / OBSTETRICIA',
    med:'Misoprostol',
    principio_activo:'Misoprostol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Misoprostol'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'OBSTETRICIA',
    med:'Dinoprostona',
    principio_activo:'Dinoprostona',
    denominaciones_comerciales:[],
    nombres_alternativos:['Dinoprostone'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / FERTILIDAD',
    med:'Clomifeno',
    principio_activo:'Clomifeno',
    denominaciones_comerciales:[],
    nombres_alternativos:['Clomiphene', 'Citrato de clomifeno'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GINECOLOGÍA / ONCOLOGÍA',
    med:'Tamoxifeno',
    principio_activo:'Tamoxifeno',
    denominaciones_comerciales:[],
    nombres_alternativos:['Tamoxifen'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Amoxicilina',
    principio_activo:'Amoxicilina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Amoxicillin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Ampicilina',
    principio_activo:'Ampicilina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Ampicillin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Bencilpenicilina benzatínica',
    principio_activo:'Bencilpenicilina benzatínica',
    denominaciones_comerciales:[],
    nombres_alternativos:['Penicilina G benzatínica', 'Benzathine benzylpenicillin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Ciprofloxacino',
    principio_activo:'Ciprofloxacino',
    denominaciones_comerciales:[],
    nombres_alternativos:['Ciprofloxacin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Levofloxacino',
    principio_activo:'Levofloxacino',
    denominaciones_comerciales:[],
    nombres_alternativos:['Levofloxacin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Cefuroxima',
    principio_activo:'Cefuroxima',
    denominaciones_comerciales:[],
    nombres_alternativos:['Cefuroxime'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Cefazolina',
    principio_activo:'Cefazolina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Cefazolin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Cefixima',
    principio_activo:'Cefixima',
    denominaciones_comerciales:[],
    nombres_alternativos:['Cefixime'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Gentamicina',
    principio_activo:'Gentamicina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Gentamicin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Amikacina',
    principio_activo:'Amikacina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Amikacin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Trimetoprim + sulfametoxazol',
    principio_activo:'Trimetoprim + sulfametoxazol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Cotrimoxazol', 'Trimethoprim + sulfamethoxazole'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIVIRALES',
    med:'Aciclovir',
    principio_activo:'Aciclovir',
    denominaciones_comerciales:[],
    nombres_alternativos:['Acyclovir'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIVIRALES',
    med:'Valaciclovir',
    principio_activo:'Valaciclovir',
    denominaciones_comerciales:[],
    nombres_alternativos:['Valacyclovir'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Claritromicina',
    principio_activo:'Claritromicina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Clarithromycin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIINFECCIOSOS',
    med:'Eritromicina',
    principio_activo:'Eritromicina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Erythromycin'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'DOLOR / INFLAMACIÓN',
    med:'Diclofenaco',
    principio_activo:'Diclofenaco',
    denominaciones_comerciales:[],
    nombres_alternativos:['Diclofenac'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'DOLOR / INFLAMACIÓN',
    med:'Meloxicam',
    principio_activo:'Meloxicam',
    denominaciones_comerciales:[],
    nombres_alternativos:['Meloxicam'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'DOLOR / INFLAMACIÓN',
    med:'Celecoxib',
    principio_activo:'Celecoxib',
    denominaciones_comerciales:[],
    nombres_alternativos:['Celecoxib'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANALGÉSICOS',
    med:'Tramadol',
    principio_activo:'Tramadol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Tramadol'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANALGÉSICOS',
    med:'Metamizol',
    principio_activo:'Metamizol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Dipirona', 'Metamizole'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANESTÉSICOS LOCALES',
    med:'Lidocaína',
    principio_activo:'Lidocaína',
    denominaciones_comerciales:[],
    nombres_alternativos:['Lignocaína', 'Lidocaine'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GASTROENTEROLOGÍA',
    med:'Omeprazol',
    principio_activo:'Omeprazol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Omeprazole'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GASTROENTEROLOGÍA',
    med:'Pantoprazol',
    principio_activo:'Pantoprazol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Pantoprazole'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'GASTROENTEROLOGÍA',
    med:'Famotidina',
    principio_activo:'Famotidina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Famotidine'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIEMÉTICOS',
    med:'Ondansetrón',
    principio_activo:'Ondansetrón',
    denominaciones_comerciales:[],
    nombres_alternativos:['Ondansetron'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ANTIEMÉTICOS',
    med:'Metoclopramida',
    principio_activo:'Metoclopramida',
    denominaciones_comerciales:[],
    nombres_alternativos:['Metoclopramide'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ALERGIA / INMUNOLOGÍA',
    med:'Loratadina',
    principio_activo:'Loratadina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Loratadine'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ALERGIA / INMUNOLOGÍA',
    med:'Cetirizina',
    principio_activo:'Cetirizina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Cetirizine'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'CORTICOIDES',
    med:'Prednisona',
    principio_activo:'Prednisona',
    denominaciones_comerciales:[],
    nombres_alternativos:['Prednisone'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'CORTICOIDES',
    med:'Dexametasona',
    principio_activo:'Dexametasona',
    denominaciones_comerciales:[],
    nombres_alternativos:['Dexamethasone'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'CORTICOIDES',
    med:'Betametasona',
    principio_activo:'Betametasona',
    denominaciones_comerciales:[],
    nombres_alternativos:['Betamethasone'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'CARDIOVASCULAR',
    med:'Furosemida',
    principio_activo:'Furosemida',
    denominaciones_comerciales:[],
    nombres_alternativos:['Furosemide'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'CARDIOVASCULAR',
    med:'Propranolol',
    principio_activo:'Propranolol',
    denominaciones_comerciales:[],
    nombres_alternativos:['Propranolol'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'CARDIOVASCULAR / OBSTETRICIA',
    med:'Nifedipino',
    principio_activo:'Nifedipino',
    denominaciones_comerciales:[],
    nombres_alternativos:['Nifedipine'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'CARDIOVASCULAR / OBSTETRICIA',
    med:'Metildopa',
    principio_activo:'Metildopa',
    denominaciones_comerciales:[],
    nombres_alternativos:['Methyldopa'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
    frec:'',
    dur:'',
    ind:''
},

        {
    cat:'ENDOCRINOLOGÍA',
    med:'Levotiroxina',
    principio_activo:'Levotiroxina',
    denominaciones_comerciales:[],
    nombres_alternativos:['Levothyroxine'],
    forma_farmaceutica:'',
    concentracion:'',
    pres:'',
    via:'',
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

    /* ============================================================
       CAPA MULTIVARIANTE v1.1.0
       - ADITIVA: no cambia los campos históricos med/pres/via.
       - vias_compatibles son sugerencias clínicas, no bloqueos.
       - Plan podrá ofrecer "Otra vía" usando su lista general.
    ============================================================ */

    const VARIANTES_AUROSANAX = {
        'clotrimazol': [
            { forma_farmaceutica:'Óvulo vaginal', concentracion:'', pres:'óvulo vaginal', vias_compatibles:['Vaginal'] },
            { forma_farmaceutica:'Óvulo vaginal', concentracion:'500 mg', pres:'500 mg óvulo vaginal', vias_compatibles:['Vaginal'] }
        ],
        'clindamicina': [
            { forma_farmaceutica:'Crema vaginal', concentracion:'', pres:'crema vaginal', vias_compatibles:['Vaginal'] },
            { forma_farmaceutica:'Tableta / cápsula', concentracion:'300 mg', pres:'300 mg tableta / cápsula', vias_compatibles:['VO'] }
        ],
        'acido folico': [
            { forma_farmaceutica:'Tableta', concentracion:'', pres:'tableta', vias_compatibles:['VO'] },
            { forma_farmaceutica:'Tableta', concentracion:'5 mg', pres:'5 mg tableta', vias_compatibles:['VO'] }
        ],
        'medroxiprogesterona': [
            { forma_farmaceutica:'Tableta / inyectable', concentracion:'', pres:'tableta / inyectable', vias_compatibles:[] },
            { forma_farmaceutica:'Inyectable', concentracion:'150 mg/1 mL', pres:'150 mg/1 mL inyectable', vias_compatibles:['IM'] }
        ],
        'estriol': [
            { forma_farmaceutica:'Crema vaginal', concentracion:'0,1 %', pres:'0,1 % crema vaginal', vias_compatibles:['Vaginal'] }
        ],
        'dienogest': [
            { forma_farmaceutica:'Tableta', concentracion:'2 mg', pres:'2 mg tableta', vias_compatibles:['VO'] }
        ],
        'calcifediol': [
            { forma_farmaceutica:'Cápsula', concentracion:'0,266 mg', pres:'0,266 mg cápsula', vias_compatibles:['VO'] }
        ],
        'melatonina': [
            { forma_farmaceutica:'Tableta', concentracion:'5 mg', pres:'5 mg tableta', vias_compatibles:['VO'] }
        ],
        'acido ascorbico': [],
        'omega 3': [
            { forma_farmaceutica:'Cápsula', concentracion:'1 g', pres:'1 g cápsula', vias_compatibles:['VO'], estado:'uso_habitual_aurosanax' }
        ]
    };

    const METADATOS_NUEVOS_AUROSANAX = {
        'estriol': {cat:'GINECOLOGÍA', principio_activo:'Estriol', nombres_alternativos:[]},
        'dienogest': {cat:'GINECOLOGÍA', principio_activo:'Dienogest', nombres_alternativos:[]},
        'calcifediol': {cat:'ENDOCRINOLOGÍA', principio_activo:'Calcifediol', nombres_alternativos:[]},
        'melatonina': {cat:'OTROS', principio_activo:'Melatonina', nombres_alternativos:[]},
        'acido ascorbico': {cat:'OTROS', principio_activo:'Ácido ascórbico', nombres_alternativos:['Vitamina C']},
        'omega 3': {cat:'OTROS', principio_activo:'Omega 3', nombres_alternativos:['Omega-3'], clasificacion:'suplemento/complementario'}
    };

    function clonarVariantes(lista){
        return (Array.isArray(lista) ? lista : []).map(function(v){
            return {
                forma_farmaceutica:texto(v.forma_farmaceutica),
                concentracion:texto(v.concentracion),
                pres:texto(v.pres),
                vias_compatibles:arrayTexto(v.vias_compatibles),
                estado:texto(v.estado)
            };
        });
    }

    function normalizarRegistro(m){
        m = m || {};
        const clave = normalizar(m.principio_activo || m.med);
        const variantesPropias = Array.isArray(m.variantes) ? m.variantes : VARIANTES_AUROSANAX[clave];

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
            ind: texto(m.ind),
            variantes: clonarVariantes(variantesPropias),
            clasificacion: texto(m.clasificacion)
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

        version:'1.2.0',

        obtenerTodos:function(){
            return window.MEDICAMENTOS_AUROSANAX_BASE.slice();
        },

        cantidad:function(){
            return window.MEDICAMENTOS_AUROSANAX_BASE.length;
        },

        obtenerVariantes:function(medicamento){
            const q = normalizar(medicamento);
            const item = window.MEDICAMENTOS_AUROSANAX_BASE.find(function(m){
                return normalizar(m.med) === q || normalizar(m.principio_activo) === q;
            });
            return item ? clonarVariantes(item.variantes) : [];
        },

        obtenerViasCompatibles:function(medicamento, presentacion){
            const variantes = this.obtenerVariantes(medicamento);
            const p = normalizar(presentacion);
            const variante = variantes.find(function(v){
                return normalizar(v.pres) === p;
            });
            return variante ? arrayTexto(variante.vias_compatibles) : [];
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
                    ...(m.nombres_alternativos || []),
                    ...((m.variantes || []).flatMap(function(v){
                        return [
                            v.pres,
                            v.forma_farmaceutica,
                            v.concentracion,
                            ...(v.vias_compatibles || [])
                        ];
                    }))
                ].join(' ');

                return normalizar(textoBusqueda).includes(q);
            });
        }
    };

})();
