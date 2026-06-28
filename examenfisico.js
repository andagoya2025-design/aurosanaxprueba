/* ==========================================================
   AUROSANAX - examenfisico.js
   Versión corregida: evita repetición de 'Otros hallazgos' y regiones no valoradas
   Módulo extraído desde index.html para Examen Físico.
   Fase segura: puede conectarse sin borrar todavía el código del index.
   Incluye:
   - Examen físico regional
   - Recopilación por sistemas
   - Carga previa desde historia clínica
   - Visualización premium de examen físico previo
   - Protección de datos en edición
   ========================================================== */

window.auroExamenFisicoRegionalConfig = window.auroExamenFisicoRegionalConfig || {
  piel_faneras: {titulo:'Piel y faneras', grupos:[{titulo:'Hallazgos regionales', items:['Piel gruesa','Piel fría','Palidez cutánea']}]},
  cabeza: {titulo:'Cabeza', grupos:[]},
  ojos: {titulo:'Ojos', grupos:[{titulo:'Hallazgos regionales', items:['Hinchazón periorbitaria']}]},
  oidos: {titulo:'Oídos', grupos:[]},
  nariz: {titulo:'Nariz', grupos:[]},
  boca: {titulo:'Boca', grupos:[]},
  orofaringe: {titulo:'Orofaringe', grupos:[]},
  cuello: {titulo:'Cuello', grupos:[]},
  axilas_mamas: {titulo:'Axilas-mamas', grupos:[{titulo:'Hallazgos regionales', items:['Mamas bilateralmente dolorosas','Nódulo palpable en mama derecha','Nódulo palpable en mama izquierda','Secreción por el pezón','Dolor mamario']}]},
  torax: {titulo:'Tórax', grupos:[{titulo:'Hallazgos regionales', items:['Asimetría de tórax presente','Dolor a la digitopresión intercostal','Roncus presentes','Sibilancias presentes','Tiraje intercostal presente','Ruidos respiratorios presentes','Estertores presentes','No se evidencia soplos cardíacos','Ruidos cardíacos rítmicos regulares']}]},
  abdomen_regional: {titulo:'Abdomen', grupos:[{titulo:'Hallazgos regionales', items:['Distensión abdominal presente','Blumberg positivo','Rovsing positivo','Maniobra de psoas positiva','Puntos ureterales dolorosos medios','Puntos ureterales dolorosos inferiores','Dolor en punto cístico positivo','Signo de Murphy positivo']}]},
  columna_vertebral: {titulo:'Columna vertebral', grupos:[{titulo:'Hallazgos regionales', items:['Lasègue positivo','Bragard positivo','Valleix positivo','Spurling positivo','Descompresión cervical positiva','Contractura muscular paravertebral presente']}]},
  ingle_perine: {titulo:'Ingle-periné', grupos:[]},
  genitales_regional: {titulo:'Genitales', grupos:[]},
  ano_recto: {titulo:'Ano recto', grupos:[]},
  canal_vaginal: {titulo:'Canal vaginal', grupos:[{titulo:'Hallazgos regionales', items:['Cérvix inflamatorio presente','Flujo vaginal abundante','Cambios macroscópicos en cérvix','Irritación vaginal presente','Lesiones blanquecinas en cuello']}]},
  miembros_superiores: {titulo:'Miembros superiores', grupos:[
    {titulo:'Hombro', items:['Jobe positivo','Hawkins positivo','Drop Arm positivo','Neer positivo','Speed positivo']},
    {titulo:'Muñeca', items:['Durkan positivo','Tinel positivo','Finkelstein positivo','Phalen positivo']}
  ]},
  miembros_inferiores: {titulo:'Miembros inferiores', grupos:[
    {titulo:'Rodilla', items:['Test de cepillo positivo','Zohlen positivo','McMurray positivo','Apley positivo','Cajón anterior positivo','Cajón posterior positivo','Bostezo medial positivo','Bostezo lateral positivo']},
    {titulo:'Cadera', items:['Fader positivo','Fadir positivo','Test de Thomas positivo']},
    {titulo:'Tobillo', items:['Cotton positivo','Tobillo inestable positivo','Thompson positivo']}
  ]},
  neurologico_regional: {titulo:'Neurológico', grupos:[{titulo:'Hallazgos regionales', items:['Reflejo de tobillo lento']}]},
  otros_hallazgos: {titulo:'Otros hallazgos', grupos:[{titulo:'Hallazgos regionales', items:['Movimientos lentos']}]}
};

function hcRegionalInputId(region){
  return 'hcRegional_' + region + '_obs';
}

function renderHcRegionalPanels(){
  const cont = document.getElementById('hcRegionalPanels');
  if(!cont || cont.dataset.rendered === '1') return;

  const html = Object.keys(window.auroExamenFisicoRegionalConfig).map((key, index) => {
    const cfg = window.auroExamenFisicoRegionalConfig[key];
    const grupos = (cfg.grupos || []).map(grupo => `
      <div class="sistemas-check-group">
        <div class="sistemas-check-subhead">${grupo.titulo}</div>
        <div class="sistemas-check-grid">
          ${(grupo.items || []).map(item => `
            <label class="sistemas-check-item">
              <input type="checkbox" class="hcRegionalCheck" data-region="${key}" data-grupo="${grupo.titulo}" data-label="${item}"> ${item}
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

    return `
      <div class="sistemas-check-card regional-panel ${index === 0 ? 'active' : ''}" data-region-panel="${key}">
        <div class="sistemas-check-head"><i class="bi bi-person-vcard"></i> ${cfg.titulo}</div>
        <div class="sistemas-check-body">
          ${grupos}
          <div class="sistemas-check-observacion mt-2">
            <textarea id="${hcRegionalInputId(key)}" class="form-control regional-textarea" rows="1" placeholder="Escriba hallazgos solo si fueron valorados"></textarea>
          </div>
        </div>
      </div>
    `;
  }).join('');

  cont.innerHTML = html;
  cont.dataset.rendered = '1';
}

function activarHcRegional(region){
  renderHcRegionalPanels();
  document.querySelectorAll('#hcRegionalTabs .regional-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.region === region);
  });
  document.querySelectorAll('#hcRegionalPanels .regional-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.regionPanel === region);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderHcRegionalPanels();
  document.querySelectorAll('#hcRegionalTabs .regional-tab').forEach(btn => {
    btn.addEventListener('click', () => activarHcRegional(btn.dataset.region));
  });
});

function recopilarRegionalExamenFisico(){
  renderHcRegionalPanels();
  const regiones = [];

  Object.keys(window.auroExamenFisicoRegionalConfig).forEach(region => {
    const cfg = window.auroExamenFisicoRegionalConfig[region];
    const partes = [];
    const grupos = {};

    document.querySelectorAll(`.hcRegionalCheck[data-region="${region}"]`).forEach(chk => {
      if(!chk.checked) return;
      const grupo = chk.dataset.grupo || 'Hallazgos regionales';
      const label = chk.dataset.label || '';
      if(!grupos[grupo]) grupos[grupo] = [];
      if(label) grupos[grupo].push(label);
    });

    Object.keys(grupos).forEach(grupo => {
      if(grupos[grupo] && grupos[grupo].length){
        partes.push(`${grupo}: ${grupos[grupo].join(', ')}`);
      }
    });

    const observacion = getValueIfExists(hcRegionalInputId(region)).trim();

    /*
      CORRECCIÓN AUROSANAX:
      Antes el sistema guardaba "NO VALORADO" por cada región.
      Eso generaba múltiples tarjetas repetidas de "Otros hallazgos" al cargar la historia previa.
      Ahora solo se guarda la región cuando existe un hallazgo real o una observación real.
    */
    if(observacion && !auroEsNoValoradoExamen(observacion)){
      partes.push('Observación: ' + observacion);
    }

    if(partes.length){
      regiones.push(`${cfg.titulo}: ${partes.join(' | ')}`);
    }
  });

  return regiones.join(' || ');
}


window.hcCie10CatalogoBase = window.hcCie10CatalogoBase || [
  {
    "codigo": "N760",
    "nombre": "Vaginitis aguda"
  },
  {
    "codigo": "N761",
    "nombre": "Vaginitis subaguda y crónica"
  },
  {
    "codigo": "N720",
    "nombre": "Cervicitis"
  },
  {
    "codigo": "N870",
    "nombre": "Displasia cervical leve"
  },
  {
    "codigo": "N871",
    "nombre": "Displasia cervical moderada"
  },
  {
    "codigo": "N872",
    "nombre": "Displasia cervical severa"
  },
  {
    "codigo": "N879",
    "nombre": "Displasia del cuello uterino no especificada"
  },
  {
    "codigo": "B977",
    "nombre": "Papilomavirus como causa de enfermedades clasificadas en otros capítulos"
  },
  {
    "codigo": "A630",
    "nombre": "Verrugas anogenitales"
  },
  {
    "codigo": "B373",
    "nombre": "Candidiasis de vulva y vagina"
  },
  {
    "codigo": "A590",
    "nombre": "Tricomoniasis urogenital"
  },
  {
    "codigo": "A600",
    "nombre": "Herpes genital"
  },
  {
    "codigo": "A560",
    "nombre": "Infección urogenital por clamidia"
  },
  {
    "codigo": "A549",
    "nombre": "Infección gonocócica no especificada"
  },
  {
    "codigo": "A539",
    "nombre": "Sífilis no especificada"
  },
  {
    "codigo": "D250",
    "nombre": "Mioma uterino submucoso"
  },
  {
    "codigo": "D251",
    "nombre": "Mioma uterino intramural"
  },
  {
    "codigo": "D252",
    "nombre": "Mioma uterino subseroso"
  },
  {
    "codigo": "D259",
    "nombre": "Mioma uterino no especificado"
  },
  {
    "codigo": "N800",
    "nombre": "Endometriosis del útero"
  },
  {
    "codigo": "N801",
    "nombre": "Endometriosis del ovario"
  },
  {
    "codigo": "N809",
    "nombre": "Endometriosis no especificada"
  },
  {
    "codigo": "N920",
    "nombre": "Menstruación excesiva y frecuente con ciclo regular"
  },
  {
    "codigo": "N921",
    "nombre": "Menstruación excesiva y frecuente con ciclo irregular"
  },
  {
    "codigo": "N939",
    "nombre": "Hemorragia uterina y vaginal anormal no especificada"
  },
  {
    "codigo": "N944",
    "nombre": "Dismenorrea primaria"
  },
  {
    "codigo": "N945",
    "nombre": "Dismenorrea secundaria"
  },
  {
    "codigo": "N946",
    "nombre": "Dismenorrea no especificada"
  },
  {
    "codigo": "R102",
    "nombre": "Dolor pélvico y perineal"
  },
  {
    "codigo": "N941",
    "nombre": "Dispareunia"
  },
  {
    "codigo": "N952",
    "nombre": "Vaginitis atrófica postmenopáusica"
  },
  {
    "codigo": "N951",
    "nombre": "Estado menopáusico y climatérico femenino"
  },
  {
    "codigo": "N979",
    "nombre": "Infertilidad femenina no especificada"
  },
  {
    "codigo": "Z014",
    "nombre": "Examen ginecológico general"
  },
  {
    "codigo": "Z124",
    "nombre": "Pesquisa especial para tumor del cuello uterino"
  },
  {
    "codigo": "Z300",
    "nombre": "Consejo anticonceptivo"
  },
  {
    "codigo": "Z321",
    "nombre": "Embarazo confirmado"
  },
  {
    "codigo": "Z340",
    "nombre": "Supervisión de primer embarazo normal"
  },
  {
    "codigo": "Z348",
    "nombre": "Supervisión de otros embarazos normales"
  },
  {
    "codigo": "Z349",
    "nombre": "Supervisión de embarazo normal no especificado"
  },
  {
    "codigo": "O099",
    "nombre": "Supervisión de embarazo de alto riesgo no especificado"
  },
  {
    "codigo": "O200",
    "nombre": "Amenaza de aborto"
  },
  {
    "codigo": "O209",
    "nombre": "Hemorragia precoz del embarazo no especificada"
  },
  {
    "codigo": "O210",
    "nombre": "Hiperémesis gravídica leve"
  },
  {
    "codigo": "O230",
    "nombre": "Infección del riñón en el embarazo"
  },
  {
    "codigo": "O231",
    "nombre": "Infección de vejiga en el embarazo"
  },
  {
    "codigo": "O234",
    "nombre": "Infección urinaria en embarazo no especificada"
  },
  {
    "codigo": "O235",
    "nombre": "Infección genital en el embarazo"
  },
  {
    "codigo": "O244",
    "nombre": "Diabetes gestacional"
  },
  {
    "codigo": "O249",
    "nombre": "Diabetes mellitus en embarazo no especificada"
  },
  {
    "codigo": "O13",
    "nombre": "Hipertensión gestacional sin proteinuria significativa"
  },
  {
    "codigo": "O140",
    "nombre": "Preeclampsia moderada"
  },
  {
    "codigo": "O141",
    "nombre": "Preeclampsia severa"
  },
  {
    "codigo": "O149",
    "nombre": "Preeclampsia no especificada"
  },
  {
    "codigo": "O410",
    "nombre": "Oligohidramnios"
  },
  {
    "codigo": "O420",
    "nombre": "Ruptura prematura de membranas"
  },
  {
    "codigo": "O470",
    "nombre": "Falso trabajo de parto antes de las 37 semanas"
  },
  {
    "codigo": "O600",
    "nombre": "Trabajo de parto prematuro sin parto"
  },
  {
    "codigo": "O820",
    "nombre": "Parto por cesárea electiva"
  },
  {
    "codigo": "O821",
    "nombre": "Parto por cesárea de emergencia"
  },
  {
    "codigo": "O809",
    "nombre": "Parto único espontáneo no especificado"
  },
  {
    "codigo": "E039",
    "nombre": "Hipotiroidismo no especificado"
  },
  {
    "codigo": "E050",
    "nombre": "Hipertiroidismo con bocio difuso"
  },
  {
    "codigo": "E059",
    "nombre": "Hipertiroidismo no especificado"
  },
  {
    "codigo": "E069",
    "nombre": "Tiroiditis no especificada"
  },
  {
    "codigo": "E079",
    "nombre": "Trastorno de tiroides no especificado"
  },
  {
    "codigo": "E119",
    "nombre": "Diabetes mellitus tipo 2 sin complicaciones"
  },
  {
    "codigo": "E112",
    "nombre": "Diabetes mellitus tipo 2 con complicaciones renales"
  },
  {
    "codigo": "E113",
    "nombre": "Diabetes mellitus tipo 2 con complicaciones oftálmicas"
  },
  {
    "codigo": "E114",
    "nombre": "Diabetes mellitus tipo 2 con complicaciones neurológicas"
  },
  {
    "codigo": "E115",
    "nombre": "Diabetes mellitus tipo 2 con complicaciones circulatorias periféricas"
  },
  {
    "codigo": "E117",
    "nombre": "Diabetes mellitus tipo 2 con complicaciones múltiples"
  },
  {
    "codigo": "E149",
    "nombre": "Diabetes mellitus no especificada sin complicaciones"
  },
  {
    "codigo": "R730",
    "nombre": "Prueba de tolerancia a la glucosa anormal"
  },
  {
    "codigo": "R739",
    "nombre": "Hiperglucemia no especificada"
  },
  {
    "codigo": "E162",
    "nombre": "Hipoglucemia no especificada"
  },
  {
    "codigo": "E660",
    "nombre": "Obesidad por exceso de calorías"
  },
  {
    "codigo": "E669",
    "nombre": "Obesidad no especificada"
  },
  {
    "codigo": "E780",
    "nombre": "Hipercolesterolemia pura"
  },
  {
    "codigo": "E781",
    "nombre": "Hipergliceridemia pura"
  },
  {
    "codigo": "E782",
    "nombre": "Hiperlipidemia mixta"
  },
  {
    "codigo": "E785",
    "nombre": "Hiperlipidemia no especificada"
  },
  {
    "codigo": "E559",
    "nombre": "Deficiencia de vitamina D no especificada"
  },
  {
    "codigo": "E611",
    "nombre": "Deficiencia de hierro"
  },
  {
    "codigo": "E282",
    "nombre": "Síndrome de ovario poliquístico"
  },
  {
    "codigo": "E281",
    "nombre": "Exceso de andrógenos"
  },
  {
    "codigo": "E221",
    "nombre": "Hiperprolactinemia"
  },
  {
    "codigo": "E349",
    "nombre": "Trastorno endocrino no especificado"
  },
  {
    "codigo": "I10",
    "nombre": "Hipertensión esencial primaria"
  },
  {
    "codigo": "I110",
    "nombre": "Enfermedad cardíaca hipertensiva con insuficiencia cardíaca"
  },
  {
    "codigo": "I119",
    "nombre": "Enfermedad cardíaca hipertensiva sin insuficiencia cardíaca"
  },
  {
    "codigo": "I120",
    "nombre": "Enfermedad renal hipertensiva con insuficiencia renal"
  },
  {
    "codigo": "I129",
    "nombre": "Enfermedad renal hipertensiva sin insuficiencia renal"
  },
  {
    "codigo": "I150",
    "nombre": "Hipertensión renovascular"
  },
  {
    "codigo": "I159",
    "nombre": "Hipertensión secundaria no especificada"
  },
  {
    "codigo": "I200",
    "nombre": "Angina inestable"
  },
  {
    "codigo": "I209",
    "nombre": "Angina de pecho no especificada"
  },
  {
    "codigo": "I219",
    "nombre": "Infarto agudo de miocardio no especificado"
  },
  {
    "codigo": "I250",
    "nombre": "Enfermedad cardiovascular aterosclerótica"
  },
  {
    "codigo": "I251",
    "nombre": "Enfermedad aterosclerótica del corazón"
  },
  {
    "codigo": "I259",
    "nombre": "Enfermedad isquémica crónica del corazón no especificada"
  },
  {
    "codigo": "I269",
    "nombre": "Embolia pulmonar"
  },
  {
    "codigo": "I272",
    "nombre": "Hipertensión pulmonar secundaria"
  },
  {
    "codigo": "I350",
    "nombre": "Estenosis aórtica no reumática"
  },
  {
    "codigo": "I359",
    "nombre": "Trastorno de la válvula aórtica no especificado"
  },
  {
    "codigo": "I420",
    "nombre": "Cardiomiopatía dilatada"
  },
  {
    "codigo": "I429",
    "nombre": "Cardiomiopatía no especificada"
  },
  {
    "codigo": "I471",
    "nombre": "Taquicardia supraventricular"
  },
  {
    "codigo": "I472",
    "nombre": "Taquicardia ventricular"
  },
  {
    "codigo": "I48",
    "nombre": "Fibrilación y aleteo auricular"
  },
  {
    "codigo": "I499",
    "nombre": "Arritmia cardíaca no especificada"
  },
  {
    "codigo": "I500",
    "nombre": "Insuficiencia cardíaca congestiva"
  },
  {
    "codigo": "I501",
    "nombre": "Insuficiencia ventricular izquierda"
  },
  {
    "codigo": "I509",
    "nombre": "Insuficiencia cardíaca no especificada"
  },
  {
    "codigo": "I519",
    "nombre": "Enfermedad cardíaca no especificada"
  },
  {
    "codigo": "I64",
    "nombre": "Accidente vascular encefálico no especificado"
  },
  {
    "codigo": "I679",
    "nombre": "Enfermedad cerebrovascular no especificada"
  },
  {
    "codigo": "I700",
    "nombre": "Aterosclerosis de la aorta"
  },
  {
    "codigo": "I709",
    "nombre": "Aterosclerosis generalizada y no especificada"
  },
  {
    "codigo": "I739",
    "nombre": "Enfermedad vascular periférica no especificada"
  },
  {
    "codigo": "I800",
    "nombre": "Flebitis y tromboflebitis superficial de miembros inferiores"
  },
  {
    "codigo": "I802",
    "nombre": "Flebitis y tromboflebitis profunda de miembros inferiores"
  },
  {
    "codigo": "I803",
    "nombre": "Flebitis y tromboflebitis de miembros inferiores no especificada"
  },
  {
    "codigo": "I830",
    "nombre": "Várices de miembros inferiores con úlcera"
  },
  {
    "codigo": "I831",
    "nombre": "Várices de miembros inferiores con inflamación"
  },
  {
    "codigo": "I832",
    "nombre": "Várices de miembros inferiores con úlcera e inflamación"
  },
  {
    "codigo": "I839",
    "nombre": "Várices de miembros inferiores sin úlcera ni inflamación"
  },
  {
    "codigo": "I872",
    "nombre": "Insuficiencia venosa crónica periférica"
  },
  {
    "codigo": "I879",
    "nombre": "Trastorno venoso no especificado"
  },
  {
    "codigo": "I890",
    "nombre": "Linfedema"
  },
  {
    "codigo": "I959",
    "nombre": "Hipotensión no especificada"
  },
  {
    "codigo": "N300",
    "nombre": "Cistitis aguda"
  },
  {
    "codigo": "N309",
    "nombre": "Cistitis no especificada"
  },
  {
    "codigo": "N390",
    "nombre": "Infección de vías urinarias sitio no especificado"
  },
  {
    "codigo": "J00",
    "nombre": "Rinofaringitis aguda resfriado común"
  },
  {
    "codigo": "J029",
    "nombre": "Faringitis aguda no especificada"
  },
  {
    "codigo": "J039",
    "nombre": "Amigdalitis aguda no especificada"
  },
  {
    "codigo": "J069",
    "nombre": "Infección respiratoria superior no especificada"
  },
  {
    "codigo": "J209",
    "nombre": "Bronquitis aguda no especificada"
  },
  {
    "codigo": "J459",
    "nombre": "Asma no especificada"
  },
  {
    "codigo": "J309",
    "nombre": "Rinitis alérgica no especificada"
  },
  {
    "codigo": "K219",
    "nombre": "Reflujo gastroesofágico sin esofagitis"
  },
  {
    "codigo": "K297",
    "nombre": "Gastritis no especificada"
  },
  {
    "codigo": "K590",
    "nombre": "Constipación"
  },
  {
    "codigo": "K529",
    "nombre": "Gastroenteritis y colitis no infecciosa no especificada"
  },
  {
    "codigo": "D509",
    "nombre": "Anemia por deficiencia de hierro no especificada"
  },
  {
    "codigo": "D649",
    "nombre": "Anemia no especificada"
  },
  {
    "codigo": "R51",
    "nombre": "Cefalea"
  },
  {
    "codigo": "R42",
    "nombre": "Mareo y desvanecimiento"
  },
  {
    "codigo": "R53",
    "nombre": "Malestar y fatiga"
  },
  {
    "codigo": "R104",
    "nombre": "Dolor abdominal no especificado"
  },
  {
    "codigo": "R11",
    "nombre": "Náusea y vómito"
  },
  {
    "codigo": "R50",
    "nombre": "Fiebre de origen desconocido"
  },
  {
    "codigo": "R600",
    "nombre": "Edema localizado"
  },
  {
    "codigo": "R609",
    "nombre": "Edema no especificado"
  },
  {
    "codigo": "R634",
    "nombre": "Pérdida anormal de peso"
  },
  {
    "codigo": "R635",
    "nombre": "Aumento anormal de peso"
  },
  {
    "codigo": "M545",
    "nombre": "Lumbago no especificado"
  },
  {
    "codigo": "M549",
    "nombre": "Dorsalgia no especificada"
  },
  {
    "codigo": "M255",
    "nombre": "Dolor en articulación"
  },
  {
    "codigo": "M796",
    "nombre": "Dolor en miembro"
  },
  {
    "codigo": "M791",
    "nombre": "Mialgia"
  },
  {
    "codigo": "M819",
    "nombre": "Osteoporosis no especificada"
  },
  {
    "codigo": "F419",
    "nombre": "Trastorno de ansiedad no especificado"
  },
  {
    "codigo": "F329",
    "nombre": "Episodio depresivo no especificado"
  },
  {
    "codigo": "G439",
    "nombre": "Migraña no especificada"
  },
  {
    "codigo": "G470",
    "nombre": "Insomnio"
  },
  {
    "codigo": "L700",
    "nombre": "Acné vulgar"
  },
  {
    "codigo": "L709",
    "nombre": "Acné no especificado"
  },
  {
    "codigo": "L650",
    "nombre": "Efluvio telógeno"
  },
  {
    "codigo": "L659",
    "nombre": "Pérdida de cabello no cicatricial no especificada"
  },
  {
    "codigo": "L639",
    "nombre": "Alopecia areata no especificada"
  },
  {
    "codigo": "L680",
    "nombre": "Hirsutismo"
  },
  {
    "codigo": "L681",
    "nombre": "Hirsutismo adquirido"
  },
  {
    "codigo": "L810",
    "nombre": "Hiperpigmentación postinflamatoria"
  },
  {
    "codigo": "L819",
    "nombre": "Trastorno de pigmentación no especificado"
  },
  {
    "codigo": "L905",
    "nombre": "Cicatrices y fibrosis de la piel"
  },
  {
    "codigo": "L989",
    "nombre": "Trastorno de piel y tejido subcutáneo no especificado"
  }
];
/* AUROSANAX FIX SEGURO 2026-06-28
   Evita error de consola: Identifier 'hcDxResultadosActuales' has already been declared.
   No cambia la lógica del módulo: si el index ya creó estas variables, se reutilizan;
   si no existen, se crean como variables globales seguras en window.
*/
if (typeof hcDxResultadosActuales === 'undefined') {
  window.hcDxResultadosActuales = [];
}
if (typeof hcDiagnosticosSeleccionados === 'undefined') {
  window.hcDiagnosticosSeleccionados = [];
}

function normalizarDxTexto(valor){
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}
function buscarDiagnosticoCie10(){
  const codigo = normalizarDxTexto(getValueIfExists('hcDxCodigoBuscar'));
  const nombre = normalizarDxTexto(getValueIfExists('hcDxNombreBuscar'));
  const body = document.getElementById('hcDxResultadosBody');
  if(!body) return;
  if(!codigo && !nombre){hcDxResultadosActuales=[];body.innerHTML='<tr><td colspan="3" class="diagnostico-empty">Sin Registros</td></tr>';return;}
  hcDxResultadosActuales = window.hcCie10CatalogoBase.filter(d => (!codigo || normalizarDxTexto(d.codigo).includes(codigo)) && (!nombre || normalizarDxTexto(d.nombre).includes(nombre))).slice(0,12);
  body.innerHTML = hcDxResultadosActuales.map((d,i)=>`<tr><td class="diagnostico-cie-code">${d.codigo}</td><td>${String(d.nombre||'').toUpperCase()}</td><td><button type="button" class="diagnostico-add" onclick="agregarDiagnosticoCie10DesdeResultado(${i})">Agregar</button></td></tr>`).join('') || '<tr><td colspan="3" class="diagnostico-empty">Sin Registros</td></tr>';
}
function agregarDiagnosticoCie10DesdeResultado(index){const d=hcDxResultadosActuales[index];if(d)agregarDiagnosticoCie10(d.codigo,d.nombre);}
function agregarDiagnosticoCie10Manual(){const codigo=getValueIfExists('hcDxCodigoBuscar').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');const nombre=getValueIfExists('hcDxNombreBuscar').trim();if(!codigo||!nombre){alert('Ingrese código CIE-10 y nombre de diagnóstico, o seleccione un resultado de la búsqueda.');return;}agregarDiagnosticoCie10(codigo,nombre);}
function agregarDiagnosticoCie10(codigo,nombre){codigo=String(codigo||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');nombre=String(nombre||'').trim();if(!codigo||!nombre)return;if(hcDiagnosticosSeleccionados.some(d=>d.codigo===codigo)){alert('Este diagnóstico ya fue agregado.');return;}hcDiagnosticosSeleccionados.push({codigo,nombre,principal:hcDiagnosticosSeleccionados.length===0,tipo:'Presuntivo'});renderDiagnosticosSeleccionados();sincronizarDiagnosticosConCamposHistoria();}
function eliminarDiagnosticoCie10(index){hcDiagnosticosSeleccionados.splice(index,1);if(hcDiagnosticosSeleccionados.length&&!hcDiagnosticosSeleccionados.some(d=>d.principal))hcDiagnosticosSeleccionados[0].principal=true;renderDiagnosticosSeleccionados();sincronizarDiagnosticosConCamposHistoria();}
function marcarDiagnosticoPrincipal(index){hcDiagnosticosSeleccionados.forEach((d,i)=>d.principal=i===index);renderDiagnosticosSeleccionados();sincronizarDiagnosticosConCamposHistoria();}
function cambiarTipoDiagnostico(index,valor){if(hcDiagnosticosSeleccionados[index])hcDiagnosticosSeleccionados[index].tipo=valor;sincronizarDiagnosticosConCamposHistoria();}
function renderDiagnosticosSeleccionados(){const body=document.getElementById('hcDxSeleccionadosBody');if(!body)return;if(!hcDiagnosticosSeleccionados.length){body.innerHTML='<tr><td colspan="4" class="diagnostico-empty">Sin diagnósticos agregados</td></tr>';return;}body.innerHTML=hcDiagnosticosSeleccionados.map((d,i)=>`<tr><td><span class="diagnostico-cie-code">${d.codigo}</span> &nbsp; ${String(d.nombre||'').toUpperCase()}</td><td class="text-center"><input class="diagnostico-radio" type="radio" name="hcDxPrincipal" ${d.principal?'checked':''} onchange="marcarDiagnosticoPrincipal(${i})"></td><td><select class="form-select diagnostico-tipo-select" onchange="cambiarTipoDiagnostico(${i}, this.value)"><option ${d.tipo==='Presuntivo'?'selected':''}>Presuntivo</option><option ${d.tipo==='Definitivo'?'selected':''}>Definitivo</option></select></td><td class="text-center"><button type="button" class="diagnostico-delete" onclick="eliminarDiagnosticoCie10(${i})"><i class="bi bi-trash"></i></button></td></tr>`).join('');}
function sincronizarDiagnosticosConCamposHistoria(){const principal=hcDiagnosticosSeleccionados.find(d=>d.principal)||hcDiagnosticosSeleccionados[0];const secundarios=hcDiagnosticosSeleccionados.filter(d=>!principal||d.codigo!==principal.codigo);if(principal){setValueIfExists('hcCie10Principal',principal.codigo);setValueIfExists('hcDiagnosticoPrincipal',principal.nombre);}else{setValueIfExists('hcCie10Principal','');setValueIfExists('hcDiagnosticoPrincipal','');}setValueIfExists('hcCie10Secundario',secundarios.map(d=>d.codigo).join('; '));setValueIfExists('hcDiagnosticoSecundario',secundarios.map(d=>`${d.codigo} ${d.nombre} (${d.tipo})`).join('; '));}
function recopilarDiagnosticosCie10(){sincronizarDiagnosticosConCamposHistoria();return hcDiagnosticosSeleccionados.map(d=>`${d.principal?'Principal':'Secundario'}: ${d.codigo} ${d.nombre} (${d.tipo})`).join(' || ');}

function recopilarInterconsultaPlan(){
  const partes = [];
  const tipo = getValueIfExists('hcInterconsultaTipo');
  const especialidad = getValueIfExists('hcInterconsultaEspecialidad');
  const prioridad = getValueIfExists('hcInterconsultaPrioridad');
  const profesional = getValueIfExists('hcInterconsultaProfesional');
  const estado = getValueIfExists('hcInterconsultaEstado');
  const motivo = getValueIfExists('hcInterconsultaMotivo');
  const observaciones = getValueIfExists('hcInterconsultaObservaciones');
  if(tipo) partes.push('Tipo: ' + tipo);
  if(especialidad) partes.push('Especialidad: ' + especialidad);
  if(prioridad) partes.push('Prioridad: ' + prioridad);
  if(profesional) partes.push('Profesional: ' + profesional);
  if(estado) partes.push('Estado: ' + estado);
  if(motivo) partes.push('Motivo: ' + motivo);
  if(observaciones) partes.push('Observaciones: ' + observaciones);
  const texto = partes.join(' | ');
  setValueIfExists('hcInterconsultaResumen', texto);
  return texto;
}

function recopilarEvaluacionesPlan(){
  const items = [];
  const opciones = [
    ['hcEvalMalaActitud', 'Denota mala actitud ante el examinador'],
    ['hcEvalAnimo', 'Alteraciones del estado de ánimo'],
    ['hcEvalAbusoNegligencia', 'Sospecha psicológica: paciente víctima de abuso o negligencia'],
    ['hcEvalAnomaliasMotoras', 'Evidencia actividades y anomalías motoras'],
    ['hcEvalOdontologica', 'Requiere evaluación odontológica']
  ];
  opciones.forEach(([id, texto]) => {
    const el = document.getElementById(id);
    if(el && el.checked) items.push(texto);
  });
  const resumen = items.join(' | ');
  setValueIfExists('hcEvaluacionesResumen', resumen);
  return resumen;
}



/* ==========================================================
   AUROSANAX - Examen físico v3.2
   Conexión completa, ayudas clínicas y compatibilidad con datos previos.
   No modifica base de datos ni Code.gs.
   ========================================================== */

function auroNormalizarExamenTexto(valor){
  return String(valor || '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function auroEscapeHtml(valor){
  return String(valor || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function auroHistoriaTieneExamenFisico(h){
  if(!h) return false;
  return [
    h.peso_kg,
    h.talla_cm,
    h.imc,
    h.presion_arterial,
    h.frecuencia_cardiaca,
    h.temperatura,
    h.saturacion,
    h.examen_fisico
  ].some(v => String(v || '').trim());
}

function auroHistoriaTieneDiagnosticos(h){
  if(!h) return false;
  return [
    h.diagnostico_cie10,
    h.diagnostico_principal,
    h.diagnostico_secundario,
    h.cie10_secundario,
    h.diagnosticos_cie10
  ].some(v => String(v || '').trim());
}

function auroAsegurarCajaExamenFisicoPrevio(){
  const panel = document.getElementById('hc_examen');
  if(!panel) return null;

  let box = document.getElementById('auroExamenFisicoPrevioBox');
  if(box) return box;

  box = document.createElement('div');
  box.id = 'auroExamenFisicoPrevioBox';
  box.className = 'auro-previos-box';
  box.style.display = 'none';
  box.innerHTML = `
    <div class="auro-previos-head">
      <div>
        <b><i class="bi bi-database-check me-1"></i> Examen físico previo guardado</b>
        <small>Información leída desde Google Sheets. Se conserva para evitar pérdida de datos.</small>
      </div>
      <button type="button" class="btn-soft auro-previos-hide" onclick="document.getElementById('auroExamenFisicoPrevioBox').style.display='none'">Ocultar</button>
    </div>
    <div class="auro-previos-content" id="auroExamenFisicoPrevioContent"></div>
  `;

  const titulo = panel.querySelector('.clinical-subtitle');
  if(titulo && titulo.nextSibling){
    titulo.parentNode.insertBefore(box, titulo.nextSibling);
  }else{
    panel.insertBefore(box, panel.firstChild);
  }
  return box;
}


function auroNormalizarTextoExamenPrevio(valor){
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\|\|\s*/g, ' || ')
    .trim();
}

function auroEsNoValoradoExamen(valor){
  const t = String(valor || '').trim().toLowerCase();
  return !t || t === 'no valorado' || t === 'no valorada' || t === 'sin valorar' || t === 'n/v';
}

function auroPartirExamenFisicoPrevio(texto){
  let raw = auroNormalizarTextoExamenPrevio(texto);
  if(!raw) return [];

  const etiquetasConocidas = [
    'Piel y faneras','Cabeza','Ojos','Oídos','Nariz','Boca','Orofaringe','Cuello',
    'Tórax','Axilas-mamas','Abdomen','Columna vertebral','Ingle-periné',
    'Genitales','Ano recto','Canal vaginal','Miembros superiores','Miembros inferiores',
    'Neurológico','Otros hallazgos',
    'Órgano de los sentidos','Organo de los sentidos','Respiratorio','Cardiovascular',
    'Digestivo','Urinario','Músculo Esquelético','Musculo Esqueletico','Endócrino',
    'Endocrino','Hemo-linfático','Hemo-linfatico',
    'Frecuencia respiratoria','Perímetro de cadera','Porcentaje de grasa','Masa muscular',
    'Perímetro cefálico','Perímetro torácico','Perímetro abdominal',
    'Estado general','Cabeza y cuello','Tórax/Respiratorio','Cardiovascular clínico',
    'Extremidades','Ginecológico'
  ];

  const escapeRegex = txt => String(txt).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patronEtiquetas = etiquetasConocidas.map(escapeRegex).join('|');

  /*
    CORRECCIÓN AUROSANAX:
    Algunas historias antiguas quedaron guardadas así:
    "Otros hallazgos: No valorado | Abdomen: No valorado".
    Eso hacía que el visor interpretara todo como "Otros hallazgos" repetido.
    Esta normalización separa correctamente las etiquetas internas antes de renderizar.
  */
  raw = raw
    .replace(/^Examen físico regional\s*:\s*/i, '')
    .replace(/^Examen fisico regional\s*:\s*/i, '')
    .replace(/^Examen físico por sistemas\s*:\s*/i, '')
    .replace(/^Examen fisico por sistemas\s*:\s*/i, '')
    .replace(new RegExp('\\s+\\|\\s+(' + patronEtiquetas + ')\\s*:', 'gi'), ' || $1:');

  return raw.split(/\s*\|\|\s*/).map(item => {
    let t = String(item || '').trim();
    if(!t) return null;

    t = t
      .replace(/^Examen físico regional\s*:\s*/i, '')
      .replace(/^Examen fisico regional\s*:\s*/i, '')
      .replace(/^Examen físico por sistemas\s*:\s*/i, '')
      .replace(/^Examen fisico por sistemas\s*:\s*/i, '');

    const idx = t.indexOf(':');
    if(idx === -1){
      return { etiqueta: 'Detalle', valor: t };
    }

    return {
      etiqueta: t.substring(0, idx).trim(),
      valor: t.substring(idx + 1).trim()
    };
  }).filter(Boolean);
}

function auroEsValorPrevioSoloNoValorado(valor){
  const normalizar = v => String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const partes = String(valor || '')
    .split(/\s*\|\s*/)
    .map(x => x.trim())
    .filter(Boolean);

  if(!partes.length) return true;

  return partes.every(parte => {
    let v = parte;
    const idx = v.indexOf(':');
    if(idx !== -1) v = v.substring(idx + 1).trim();

    const n = normalizar(v);
    return !n || n === 'no valorado' || n === 'no valorada' || n === 'sin valorar' || n === 'n/v';
  });
}

function auroTokensUnicosConHallazgoReal(tokens){
  const vistos = new Set();
  return (tokens || []).filter(t => {
    const etiqueta = String(t.etiqueta || '').trim();
    const valor = String(t.valor || '').trim();
    if(!etiqueta || auroEsValorPrevioSoloNoValorado(valor)) return false;

    const clave = (etiqueta + '|' + valor).toLowerCase();
    if(vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

function auroTokensUnicosNoValorados(tokens){
  const vistos = new Set();
  return (tokens || []).filter(t => {
    const etiqueta = String(t.etiqueta || '').trim();
    const valor = String(t.valor || '').trim();
    if(!etiqueta || !auroEsValorPrevioSoloNoValorado(valor)) return false;

    const clave = etiqueta.toLowerCase();
    if(vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

function auroRenderPrevioLinea(label, value){
  if(!String(value || '').trim()) return '';
  return `
    <div class="auro-previos-line">
      <span>${auroEscapeHtml(label)}</span>
      <p>${auroEscapeHtml(value)}</p>
    </div>
  `;
}

function auroRenderPrevioChips(titulo, items){
  const lista = (items || []).filter(Boolean);
  if(!lista.length) return '';
  return `
    <div class="auro-previos-line auro-previos-compact">
      <span>${auroEscapeHtml(titulo)}</span>
      <div class="auro-previos-chip-grid">
        ${lista.map(item => `<div class="auro-previos-chip">${auroEscapeHtml(item)}</div>`).join('')}
      </div>
    </div>
  `;
}

function auroRenderPrevioTabla(titulo, pares){
  const lista = (pares || []).filter(p => p && String(p.etiqueta || '').trim() && String(p.valor || '').trim());
  if(!lista.length) return '';
  return `
    <div class="auro-previos-line auro-previos-compact">
      <span>${auroEscapeHtml(titulo)}</span>
      <div class="auro-previos-mini-table">
        ${lista.map(p => `
          <div class="auro-previos-mini-row">
            <b>${auroEscapeHtml(p.etiqueta)}</b>
            <em>${auroEscapeHtml(p.valor)}</em>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function auroMostrarExamenFisicoPrevio(h){
  const box = auroAsegurarCajaExamenFisicoPrevio();
  const content = document.getElementById('auroExamenFisicoPrevioContent');
  if(!box || !content) return;

  if(!auroHistoriaTieneExamenFisico(h)){
    box.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const signos = [
    h.peso_kg ? 'Peso: ' + h.peso_kg + ' kg' : '',
    h.talla_cm ? 'Talla: ' + h.talla_cm + ' cm' : '',
    h.imc ? 'IMC: ' + h.imc : '',
    h.presion_arterial ? 'PA: ' + h.presion_arterial : '',
    h.frecuencia_cardiaca ? 'FC: ' + h.frecuencia_cardiaca : '',
    h.temperatura ? 'Temperatura: ' + h.temperatura + ' °C' : '',
    h.saturacion ? 'SatO₂: ' + h.saturacion + ' %' : ''
  ].filter(Boolean);

  const tokens = auroPartirExamenFisicoPrevio(h.examen_fisico || '');
  const regionales = [
    'Piel y faneras','Cabeza','Ojos','Oídos','Nariz','Boca','Orofaringe','Cuello',
    'Tórax','Axilas-mamas','Abdomen','Columna vertebral','Ingle-periné',
    'Genitales','Ano recto','Canal vaginal','Miembros superiores','Miembros inferiores',
    'Neurológico','Otros hallazgos'
  ];

  const tokensRegional = [];
  const tokensSistemas = [];
  const tokensGenerales = [];

  tokens.forEach(t => {
    const etiqueta = String(t.etiqueta || '').trim();
    if(regionales.some(r => r.toLowerCase() === etiqueta.toLowerCase())){
      tokensRegional.push(t);
    }else if(/sentidos|ocular|respiratorio|cardiovascular|digestivo|urinario|músculo|musculo|endocrino|hemo|linfático|linfatico/i.test(etiqueta)){
      tokensSistemas.push(t);
    }else{
      tokensGenerales.push(t);
    }
  });

  const regionalHallazgos = auroTokensUnicosConHallazgoReal(tokensRegional);
  const sistemasHallazgos = auroTokensUnicosConHallazgoReal(tokensSistemas);
  const generalesLimpios = auroTokensUnicosConHallazgoReal(tokensGenerales);

  const diagnosticos = [
    h.diagnostico_cie10 ? 'Principal CIE-10: ' + h.diagnostico_cie10 : '',
    h.diagnostico_principal ? 'Dx principal: ' + h.diagnostico_principal : '',
    h.cie10_secundario ? 'Secundario CIE-10: ' + h.cie10_secundario : '',
    h.diagnostico_secundario ? 'Dx secundario: ' + h.diagnostico_secundario : ''
  ].filter(Boolean);

  /*
    AUROSANAX v3.2.2
    Corrección visual:
    Si la historia anterior solo contiene textos repetidos de "No valorado",
    se oculta la caja previa para no mostrar un bloque largo y confuso.
    No toca CIE-10, Pacientes, guardado ni lectura de Google Sheets.
  */
  const tieneContenidoClinicoReal =
    signos.length ||
    generalesLimpios.length ||
    sistemasHallazgos.length ||
    regionalHallazgos.length ||
    diagnosticos.length;

  if(!tieneContenidoClinicoReal){
    box.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  let html = '';

  html += auroRenderPrevioChips('Signos vitales registrados', signos);

  if(generalesLimpios.length){
    html += auroRenderPrevioTabla('Examen general / medidas complementarias', generalesLimpios);
  }

  if(sistemasHallazgos.length){
    html += auroRenderPrevioTabla('Examen físico por sistemas', sistemasHallazgos);
  }

  if(regionalHallazgos.length){
    html += auroRenderPrevioTabla('Examen físico regional', regionalHallazgos);
  }

  html += auroRenderPrevioChips('Diagnóstico CIE-10 guardado', diagnosticos);

  content.innerHTML = html;
  box.style.display = 'block';
}

function auroAsegurarCajaDiagnosticosPrevios(){
  const grupo = document.getElementById('hcDiagnosticoCieGrupo') || document.getElementById('hc_examen');
  if(!grupo) return null;

  let box = document.getElementById('auroDiagnosticosPreviosBox');
  if(box) return box;

  box = document.createElement('div');
  box.id = 'auroDiagnosticosPreviosBox';
  box.className = 'auro-previos-box';
  box.style.display = 'none';
  box.innerHTML = `
    <div class="auro-previos-head">
      <div>
        <b><i class="bi bi-clipboard2-pulse me-1"></i> Diagnósticos CIE-10 previos guardados</b>
        <small>Información leída desde Google Sheets. El bloque CIE-10 se conserva intacto.</small>
      </div>
      <button type="button" class="btn-soft auro-previos-hide" onclick="document.getElementById('auroDiagnosticosPreviosBox').style.display='none'">Ocultar</button>
    </div>
    <div class="auro-previos-content" id="auroDiagnosticosPreviosContent"></div>
  `;

  grupo.parentNode.insertBefore(box, grupo);
  return box;
}

function auroMostrarDiagnosticosPrevios(h){
  const box = auroAsegurarCajaDiagnosticosPrevios();
  const content = document.getElementById('auroDiagnosticosPreviosContent');
  if(!box || !content) return;

  if(!auroHistoriaTieneDiagnosticos(h)){
    box.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const lineas = [
    ['Diagnóstico principal', [h.diagnostico_cie10, h.diagnostico_principal].filter(Boolean).join(' - ')],
    ['Diagnósticos secundarios', [h.cie10_secundario, h.diagnostico_secundario].filter(Boolean).join(' - ')],
    ['Listado CIE-10 estructurado', h.diagnosticos_cie10]
  ].filter(x => String(x[1] || '').trim());

  content.innerHTML = lineas.map(([label, value]) => `
    <div class="auro-previos-line">
      <span>${auroEscapeHtml(label)}</span>
      <p>${auroEscapeHtml(value)}</p>
    </div>
  `).join('');

  box.style.display = 'block';
}

function auroCargarExamenFisicoPrevioPaciente(idPaciente){
  const h = auroHistoriasPacienteOrdenadas(idPaciente).find(auroHistoriaTieneExamenFisico) || null;
  auroMostrarExamenFisicoPrevio(h);
  const dx = auroHistoriasPacienteOrdenadas(idPaciente).find(auroHistoriaTieneDiagnosticos) || null;
  auroMostrarDiagnosticosPrevios(dx);
}

function auroExtraerSeccionExamen(texto, etiqueta){
  texto = auroNormalizarExamenTexto(texto);
  if(!texto || !etiqueta) return '';
  const etiquetas = [
    'Frecuencia respiratoria','Perímetro de cadera','Porcentaje de grasa','Masa muscular',
    'Perímetro cefálico','Perímetro torácico','Perímetro abdominal',
    'Órgano de los sentidos','Respiratorio','Cardiovascular','Digestivo','Urinario',
    'Músculo Esquelético','Endócrino','Hemo-linfático','Examen físico regional',
    'Estado general','Cabeza y cuello','Tórax/Respiratorio','Abdomen','Extremidades','Ginecológico'
  ];
  const inicio = texto.indexOf(etiqueta + ':');
  if(inicio === -1) return '';
  let desde = inicio + etiqueta.length + 1;
  let fin = texto.length;
  etiquetas.forEach(et => {
    if(et === etiqueta) return;
    const idx = texto.indexOf(' | ' + et + ':', desde);
    if(idx !== -1 && idx < fin) fin = idx;
  });
  return texto.substring(desde, fin).replace(/^\s*\|\s*/, '').trim();
}

function auroSetCheckboxesPorTexto(selector, texto){
  const base = auroNormalizarExamenTexto(texto).toLowerCase();
  if(!base) return;
  document.querySelectorAll(selector).forEach(chk => {
    const label = String(chk.dataset.label || '').trim();
    if(label && base.includes(label.toLowerCase())){
      chk.checked = true;
    }
  });
}

function auroCargarExamenFisicoDesdeHistoria(h, modo){
  if(!h) return;
  auroMostrarExamenFisicoPrevio(h);

  setValueIfExists('hcPeso', h.peso_kg || '');
  setValueIfExists('hcTalla', h.talla_cm || '');
  setValueIfExists('hcIMC', h.imc || '');
  setValueIfExists('hcPA', h.presion_arterial || '');
  setValueIfExists('hcFC', h.frecuencia_cardiaca || '');
  setValueIfExists('hcTemperatura', h.temperatura || '');
  setValueIfExists('hcSaturacion', h.saturacion || '');

  const ex = h.examen_fisico || '';
  setValueIfExists('hcFR', auroExtraerSeccionExamen(ex, 'Frecuencia respiratoria'));
  setValueIfExists('hcCadera', auroExtraerSeccionExamen(ex, 'Perímetro de cadera'));
  setValueIfExists('hcPorcentajeGrasa', auroExtraerSeccionExamen(ex, 'Porcentaje de grasa'));
  setValueIfExists('hcMasaMuscular', auroExtraerSeccionExamen(ex, 'Masa muscular'));
  setValueIfExists('hcPerimetroCefalico', auroExtraerSeccionExamen(ex, 'Perímetro cefálico'));
  setValueIfExists('hcPerimetroToracico', auroExtraerSeccionExamen(ex, 'Perímetro torácico'));
  setValueIfExists('hcPerimetroAbdominal', auroExtraerSeccionExamen(ex, 'Perímetro abdominal'));

  const sentidos = auroExtraerSeccionExamen(ex, 'Órgano de los sentidos');
  const respiratorio = auroExtraerSeccionExamen(ex, 'Respiratorio');
  const cardiovascular = auroExtraerSeccionExamen(ex, 'Cardiovascular');
  const digestivo = auroExtraerSeccionExamen(ex, 'Digestivo');
  const urinario = auroExtraerSeccionExamen(ex, 'Urinario');
  const musculo = auroExtraerSeccionExamen(ex, 'Músculo Esquelético');
  const endocrino = auroExtraerSeccionExamen(ex, 'Endócrino');
  const hemo = auroExtraerSeccionExamen(ex, 'Hemo-linfático');
  const regional = auroExtraerSeccionExamen(ex, 'Examen físico regional');

  auroSetCheckboxesPorTexto('.hcSentidosCheck', sentidos);
  auroSetCheckboxesPorTexto('.hcRespiratorioCheck', respiratorio);
  auroSetCheckboxesPorTexto('.hcCardiovascularCheck', cardiovascular);
  auroSetCheckboxesPorTexto('.hcDigestivoCheck', digestivo);
  auroSetCheckboxesPorTexto('.hcUrinarioCheck', urinario);
  auroSetCheckboxesPorTexto('.hcMusculoEsqueleticoCheck', musculo);
  auroSetCheckboxesPorTexto('.hcRegionalCheck', regional);

  if(sentidos.includes('No valorado')) document.getElementById('hcSentidosNoValorado') && (document.getElementById('hcSentidosNoValorado').checked = true);
  if(respiratorio.includes('No valorado')) document.getElementById('hcRespiratorioNoValorado') && (document.getElementById('hcRespiratorioNoValorado').checked = true);
  if(cardiovascular.includes('No valorado')) document.getElementById('hcCardiovascularNoValorado') && (document.getElementById('hcCardiovascularNoValorado').checked = true);
  if(digestivo.includes('No valorado')) document.getElementById('hcDigestivoNoValorado') && (document.getElementById('hcDigestivoNoValorado').checked = true);
  if(urinario.includes('No valorado')) document.getElementById('hcUrinarioNoValorado') && (document.getElementById('hcUrinarioNoValorado').checked = true);
  if(musculo.includes('No valorado')) document.getElementById('hcMusculoEsqueleticoNoValorado') && (document.getElementById('hcMusculoEsqueleticoNoValorado').checked = true);
  if(endocrino.includes('No valorado')) document.getElementById('hcEndocrinoNoValorado') && (document.getElementById('hcEndocrinoNoValorado').checked = true);
  if(hemo.includes('No valorado')) document.getElementById('hcHemoLinfaticoNoValorado') && (document.getElementById('hcHemoLinfaticoNoValorado').checked = true);

  setValueIfExists('hcSentidosObservacion', auroExtraerObservacionSistema(sentidos));
  setValueIfExists('hcRespiratorioObservacion', auroExtraerObservacionSistema(respiratorio));
  setValueIfExists('hcCardiovascularObservacion', auroExtraerObservacionSistema(cardiovascular));
  setValueIfExists('hcDigestivoObservacion', auroExtraerObservacionSistema(digestivo));
  setValueIfExists('hcUrinarioObservacion', auroExtraerObservacionSistema(urinario));
  setValueIfExists('hcMusculoEsqueleticoObservacion', auroExtraerObservacionSistema(musculo));
  setValueIfExists('hcEndocrinoObservacion', auroExtraerObservacionSistema(endocrino));
  setValueIfExists('hcHemoLinfaticoObservacion', auroExtraerObservacionSistema(hemo));

  setValueIfExists('hcExamenGeneral', auroExtraerSeccionExamen(ex, 'Estado general'));
  setValueIfExists('hcCabezaCuello', auroExtraerSeccionExamen(ex, 'Cabeza y cuello'));
  setValueIfExists('hcToraxRespiratorio', auroExtraerSeccionExamen(ex, 'Tórax/Respiratorio'));
  setValueIfExists('hcCardiovascular', auroExtraerSeccionExamen(ex, 'Cardiovascular') || getValueIfExists('hcCardiovascular'));
  setValueIfExists('hcAbdomen', auroExtraerSeccionExamen(ex, 'Abdomen'));
  setValueIfExists('hcExtremidades', auroExtraerSeccionExamen(ex, 'Extremidades'));
  setValueIfExists('hcExamenGinecologico', auroExtraerSeccionExamen(ex, 'Ginecológico'));

  auroActualizarAyudaIMC();
}

function auroExtraerObservacionSistema(texto){
  const m = String(texto || '').match(/Observación(?:es)?:\s*(.+)$/i);
  return m ? m[1].trim() : '';
}

function auroConstruirExamenFisicoCompleto(){
  const unirLinea = arr => arr.filter(Boolean).join(' | ');

  const sentidos = recopilarOrganosSentidosExamenFisico();
  const respiratorio = recopilarRespiratorioExamenFisico();
  const cardiovascularSistemas = recopilarCardiovascularExamenFisico();
  const digestivo = recopilarDigestivoExamenFisico();
  const urinario = recopilarUrinarioExamenFisico();
  const musculo = recopilarMusculoEsqueleticoExamenFisico();
  const endocrino = recopilarEndocrinoExamenFisico();
  const hemo = recopilarHemoLinfaticoExamenFisico();
  const regional = recopilarRegionalExamenFisico();

  return unirLinea([
    getValueIfExists('hcFR') ? 'Frecuencia respiratoria: ' + getValueIfExists('hcFR') : '',
    getValueIfExists('hcCadera') ? 'Perímetro de cadera: ' + getValueIfExists('hcCadera') : '',
    getValueIfExists('hcPorcentajeGrasa') ? 'Porcentaje de grasa: ' + getValueIfExists('hcPorcentajeGrasa') : '',
    getValueIfExists('hcMasaMuscular') ? 'Masa muscular: ' + getValueIfExists('hcMasaMuscular') : '',
    getValueIfExists('hcPerimetroCefalico') ? 'Perímetro cefálico: ' + getValueIfExists('hcPerimetroCefalico') : '',
    getValueIfExists('hcPerimetroToracico') ? 'Perímetro torácico: ' + getValueIfExists('hcPerimetroToracico') : '',
    getValueIfExists('hcPerimetroAbdominal') ? 'Perímetro abdominal: ' + getValueIfExists('hcPerimetroAbdominal') : '',
    sentidos ? 'Órgano de los sentidos: ' + sentidos : '',
    respiratorio ? 'Respiratorio: ' + respiratorio : '',
    cardiovascularSistemas ? 'Cardiovascular: ' + cardiovascularSistemas : '',
    digestivo ? 'Digestivo: ' + digestivo : '',
    urinario ? 'Urinario: ' + urinario : '',
    musculo ? 'Músculo Esquelético: ' + musculo : '',
    endocrino ? 'Endócrino: ' + endocrino : '',
    hemo ? 'Hemo-linfático: ' + hemo : '',
    regional ? 'Examen físico regional: ' + regional : '',
    getValueIfExists('hcExamenGeneral') ? 'Estado general: ' + getValueIfExists('hcExamenGeneral') : '',
    getValueIfExists('hcCabezaCuello') ? 'Cabeza y cuello: ' + getValueIfExists('hcCabezaCuello') : '',
    getValueIfExists('hcToraxRespiratorio') ? 'Tórax/Respiratorio: ' + getValueIfExists('hcToraxRespiratorio') : '',
    getValueIfExists('hcCardiovascular') ? 'Cardiovascular clínico: ' + getValueIfExists('hcCardiovascular') : '',
    getValueIfExists('hcAbdomen') ? 'Abdomen: ' + getValueIfExists('hcAbdomen') : '',
    getValueIfExists('hcExtremidades') ? 'Extremidades: ' + getValueIfExists('hcExtremidades') : '',
    getValueIfExists('hcExamenGinecologico') ? 'Ginecológico: ' + getValueIfExists('hcExamenGinecologico') : ''
  ]);
}

function auroAplicarProteccionExamenFisicoEdicion(data){
  const h = auroHistoriaActualEdicion();
  if(!h) return data;

  [
    'peso_kg',
    'talla_cm',
    'imc',
    'presion_arterial',
    'frecuencia_cardiaca',
    'temperatura',
    'saturacion',
    'examen_fisico'
  ].forEach(campo => {
    if(!String(data[campo] || '').trim() && String(h[campo] || '').trim()){
      data[campo] = h[campo];
    }
  });

  return data;
}

function auroAplicarProteccionDiagnosticosEdicion(data){
  const h = auroHistoriaActualEdicion();
  if(!h) return data;

  [
    'diagnostico_cie10',
    'diagnostico_principal',
    'diagnostico_secundario',
    'cie10_secundario',
    'diagnosticos_cie10'
  ].forEach(campo => {
    if(!String(data[campo] || '').trim() && String(h[campo] || '').trim()){
      data[campo] = h[campo];
    }
  });

  return data;
}

function auroCargarDiagnosticosDesdeHistoria(h){
  if(!h) return;
  auroMostrarDiagnosticosPrevios(h);

  const lista = [];
  const texto = String(h.diagnosticos_cie10 || '').trim();
  if(texto){
    texto.split(/\s*\|\|\s*/).forEach(item => {
      const m = item.match(/^(Principal|Secundario):\s*([A-Z0-9\.]+)\s+(.+?)(?:\s*\((Presuntivo|Definitivo)\))?$/i);
      if(m){
        lista.push({
          codigo: String(m[2] || '').replace(/\./g,'').toUpperCase(),
          nombre: String(m[3] || '').trim(),
          principal: String(m[1] || '').toLowerCase() === 'principal',
          tipo: m[4] || 'Presuntivo'
        });
      }
    });
  }

  if(!lista.length && (h.diagnostico_cie10 || h.diagnostico_principal)){
    lista.push({
      codigo: String(h.diagnostico_cie10 || '').replace(/\./g,'').toUpperCase(),
      nombre: String(h.diagnostico_principal || '').trim() || 'Diagnóstico principal',
      principal: true,
      tipo: 'Presuntivo'
    });
  }

  if(h.cie10_secundario || h.diagnostico_secundario){
    const codigos = String(h.cie10_secundario || '').split(/[;,]/).map(x => x.trim()).filter(Boolean);
    const nombres = String(h.diagnostico_secundario || '').split(/[;,]/).map(x => x.trim()).filter(Boolean);
    codigos.forEach((codigo, i) => {
      const c = codigo.replace(/\./g,'').toUpperCase();
      if(c && !lista.some(d => d.codigo === c)){
        lista.push({
          codigo: c,
          nombre: nombres[i] || 'Diagnóstico secundario',
          principal: false,
          tipo: 'Presuntivo'
        });
      }
    });
  }

  if(lista.length){
    hcDiagnosticosSeleccionados = lista.map((d, i) => ({
      codigo: d.codigo,
      nombre: d.nombre,
      principal: d.principal || (i === 0 && !lista.some(x => x.principal)),
      tipo: d.tipo === 'Definitivo' ? 'Definitivo' : 'Presuntivo'
    }));
    renderDiagnosticosSeleccionados();
    sincronizarDiagnosticosConCamposHistoria();
  }else{
    setValueIfExists('hcCie10Principal', h.diagnostico_cie10 || '');
    setValueIfExists('hcDiagnosticoPrincipal', h.diagnostico_principal || '');
    setValueIfExists('hcCie10Secundario', h.cie10_secundario || '');
    setValueIfExists('hcDiagnosticoSecundario', h.diagnostico_secundario || '');
  }
}

function auroInterpretarIMC(valor){
  const imc = parseFloat(String(valor || '').replace(',','.'));
  if(!imc) return '';
  if(imc < 18.5) return 'Bajo peso';
  if(imc < 25) return 'Normopeso';
  if(imc < 30) return 'Sobrepeso';
  if(imc < 35) return 'Obesidad grado I';
  if(imc < 40) return 'Obesidad grado II';
  return 'Obesidad grado III';
}

function auroActualizarAyudaIMC(){
  const imc = getValueIfExists('hcIMC');
  const box = document.getElementById('auroImcAyuda');
  if(box) box.textContent = imc ? ('Interpretación IMC: ' + auroInterpretarIMC(imc)) : 'Interpretación IMC pendiente';
}

function auroNormalizarVitalesExamen(){
  const pa = getValueIfExists('hcPA').trim();
  if(pa && /^\d{2,3}\s*[-]\s*\d{2,3}$/.test(pa)){
    setValueIfExists('hcPA', pa.replace(/\s*-\s*/, '/'));
  }

  [
    ['hcFC','lpm'],
    ['hcFR','rpm'],
    ['hcTemperatura','°C'],
    ['hcSaturacion','%'],
    ['hcCadera','cm'],
    ['hcPorcentajeGrasa','%'],
    ['hcMasaMuscular','kg'],
    ['hcPerimetroCefalico','cm'],
    ['hcPerimetroToracico','cm'],
    ['hcPerimetroAbdominal','cm']
  ].forEach(([id, unidad]) => {
    const el = document.getElementById(id);
    if(!el) return;
    const v = String(el.value || '').trim();
    if(/^\d+([.,]\d+)?$/.test(v)){
      el.value = v + ' ' + unidad;
    }
  });
}

function auroAplicarExamenFisicoSinHallazgos(){
  setValueIfExists('hcExamenGeneral', 'Paciente en buen estado general aparente, consciente, orientada, hidratada, afebril, sin signos de dificultad respiratoria al momento de la valoración.');
  setValueIfExists('hcCabezaCuello', 'Normocéfala. Cuello móvil, sin adenopatías aparentes, sin ingurgitación yugular.');
  setValueIfExists('hcToraxRespiratorio', 'Tórax simétrico. Murmullo vesicular conservado, sin ruidos agregados evidentes.');
  setValueIfExists('hcCardiovascular', 'Ruidos cardíacos rítmicos, sin soplos evidentes al examen clínico.');
  setValueIfExists('hcAbdomen', 'Abdomen blando, depresible, no doloroso a la palpación superficial, sin signos de irritación peritoneal.');
  setValueIfExists('hcExtremidades', 'Extremidades sin edema aparente, pulsos periféricos conservados, movilidad conservada.');
}

function auroMarcarSistemasNoValorados(){
  [
    'hcSentidosNoValorado',
    'hcRespiratorioNoValorado',
    'hcCardiovascularNoValorado',
    'hcDigestivoNoValorado',
    'hcUrinarioNoValorado',
    'hcMusculoEsqueleticoNoValorado',
    'hcEndocrinoNoValorado',
    'hcHemoLinfaticoNoValorado'
  ].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.checked = true;
  });
}

function auroInicializarAyudasExamenFisicoV32(){
  /*
    AUROSANAX v3.2.1
    Corrección visual solicitada:
    - No inserta barra superior de ayudas clínicas.
    - No agrega botones "Examen general sin hallazgos aparentes", "Sistemas no valorados" ni "Normalizar unidades".
    - No agrega textos guía debajo de los signos vitales.
    - Conserva la estructura original del bloque Signos vitales.
    - Mantiene solo lógica invisible necesaria: cálculo/actualización de IMC y normalización técnica al perder foco.
  */

  const panel = document.getElementById('hc_examen');
  if(!panel) return;

  const ayudaAnterior = document.getElementById('auroExamenHelpBox');
  if(ayudaAnterior) ayudaAnterior.remove();

  const imcAyudaAnterior = document.getElementById('auroImcAyuda');
  if(imcAyudaAnterior) imcAyudaAnterior.remove();

  ['hcPA','hcFC','hcFR','hcTemperatura','hcSaturacion'].forEach(id => {
    const hint = document.getElementById(id + 'Hint');
    if(hint) hint.remove();
  });

  ['hcPeso','hcTalla'].forEach(id => {
    const el = document.getElementById(id);
    if(el && !el.dataset.auroImcListenerV321){
      el.addEventListener('input', () => setTimeout(calcIMC, 0));
      el.addEventListener('blur', () => setTimeout(calcIMC, 0));
      el.dataset.auroImcListenerV321 = '1';
    }
  });
}


/* ==========================================================
   AUROSANAX - Plan v3.3.1
   Conexión completa del Plan sin tocar otros módulos.
   - Carga previa limpia
   - Plan terapéutico / evaluaciones / indicaciones / control
   - Protección anti-sobrescritura en edición
   ========================================================== */

/* AUROSANAX - Confirmación de carga del módulo */
window.auroExamenFisicoModuloCargado = true;
console.log('AUROSANAX examenfisico.js cargado correctamente');
