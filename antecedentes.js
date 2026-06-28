/*
  AUROSANAX ERP - MODULO ANTECEDENTES
  Archivo modular extraído desde index.html SIN CORREGIR.
  Objetivo: iniciar modularización no destructiva del módulo Antecedentes.
  Mantiene funciones, nombres e IDs existentes.
  No modifica backend, Google Sheets ni Apps Script.
*/


function auroNormalizarClaveClinica(valor){
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function auroBuscarControlPorData(selector, dataKey, valor){
  const normal = auroNormalizarClaveClinica(valor);
  const controles = [...document.querySelectorAll(selector)];

  return controles.find(x => String(x.dataset[dataKey] || '') === String(valor || '')) ||
         controles.find(x => auroNormalizarClaveClinica(x.dataset[dataKey] || '') === normal) ||
         controles.find(x => {
           const item = auroNormalizarClaveClinica(x.dataset[dataKey] || '');
           return normal && item && (item.includes(normal) || normal.includes(item));
         }) ||
         null;
}

function auroHistoriaTieneAntecedentes(h){
  if(!h) return false;
  return [
    h.antecedentes_personales,
    h.antecedentes_quirurgicos,
    h.antecedentes_gineco_obstetricos,
    h.antecedentes_familiares,
    h.medicacion_actual,
    h.alergias
  ].some(v => String(v || '').trim());
}

function auroFechaHistoriaValor(h){
  const raw = h?.fecha_registro || h?.fecha_apertura || h?.creado_en || h?.actualizado_en || '';
  const t = raw ? new Date(raw).getTime() : 0;
  return isNaN(t) ? 0 : t;
}

function auroHistoriasPacienteOrdenadas(idPaciente){
  return (historiasClinicas || [])
    .filter(h => String(h.id_paciente || '') === String(idPaciente || ''))
    .sort((a,b) => auroFechaHistoriaValor(b) - auroFechaHistoriaValor(a));
}

function auroUltimaHistoriaConAntecedentes(idPaciente){
  return auroHistoriasPacienteOrdenadas(idPaciente).find(auroHistoriaTieneAntecedentes) || null;
}

function auroInyectarEstilosAntecedentesPremium(){
  if(document.getElementById('auroAntecedentesPremiumStyle')) return;
  const style = document.createElement('style');
  style.id = 'auroAntecedentesPremiumStyle';
  style.textContent = `
    .auro-previos-box{
      background:linear-gradient(135deg,#ffffff 0%,#fff7fb 100%)!important;
      border:1px solid rgba(139,30,90,.16)!important;
      border-radius:16px!important;
      padding:12px!important;
      margin:8px 0 12px!important;
      box-shadow:0 8px 22px rgba(15,23,42,.06)!important;
    }
    .auro-previos-head{
      display:flex!important;
      justify-content:space-between!important;
      align-items:flex-start!important;
      gap:10px!important;
      padding-bottom:10px!important;
      margin-bottom:10px!important;
      border-bottom:1px solid rgba(139,30,90,.12)!important;
    }
    .auro-previos-head b{
      color:#7a174f!important;
      font-size:15px!important;
      font-weight:900!important;
      letter-spacing:-.01em!important;
    }
    .auro-previos-head small{
      display:block!important;
      color:#64748b!important;
      font-size:12px!important;
      font-weight:600!important;
      margin-top:2px!important;
    }
    .auro-previos-hide{
      padding:6px 10px!important;
      border-radius:10px!important;
      font-size:11px!important;
      white-space:nowrap!important;
    }
    .auro-previos-content{
      display:grid!important;
      gap:8px!important;
    }
    .auro-previos-content.auro-previos-collapsed{
      display:none!important;
    }
    .auro-previos-line{
      background:#ffffff!important;
      border:1px solid rgba(139,30,90,.10)!important;
      border-radius:14px!important;
      padding:10px!important;
      box-shadow:0 4px 12px rgba(15,23,42,.035)!important;
    }
    .auro-previos-line span{
      display:flex!important;
      align-items:center!important;
      gap:6px!important;
      color:#8b1e5a!important;
      font-size:11px!important;
      font-weight:900!important;
      text-transform:uppercase!important;
      letter-spacing:.035em!important;
      margin-bottom:7px!important;
    }
    .auro-previos-mini-table{
      display:grid!important;
      grid-template-columns:repeat(auto-fit,minmax(260px,1fr))!important;
      gap:8px!important;
    }
    .auro-previos-mini-row{
      position:relative!important;
      background:#fff!important;
      border:1px solid rgba(139,30,90,.12)!important;
      border-left:3px solid #c23b83!important;
      border-radius:12px!important;
      padding:10px 12px!important;
      min-height:auto!important;
      box-shadow:0 3px 10px rgba(139,30,90,.04)!important;
      break-inside:avoid!important;
      page-break-inside:avoid!important;
    }
    .auro-previos-mini-row b{
      display:block!important;
      color:#111827!important;
      font-size:13px!important;
      font-weight:800!important;
      margin-bottom:5px!important;
      line-height:1.2!important;
    }
    .auro-previos-mini-row em{
      display:grid!important;
      gap:4px!important;
      color:#475569!important;
      font-size:11.5px!important;
      font-style:normal!important;
      line-height:1.25!important;
    }
    .auro-previos-detail-pill{
      display:flex!important;
      align-items:flex-start!important;
      gap:5px!important;
      background:rgba(255,255,255,.82)!important;
      border:1px solid rgba(226,232,240,.85)!important;
      border-radius:8px!important;
      padding:4px 7px!important;
      color:#334155!important;
      font-size:11px!important;
      font-weight:700!important;
    }
    .auro-previos-detail-pill i{
      color:#8b1e5a!important;
      margin-top:1px!important;
      flex:0 0 auto!important;
    }

    @media print{
      .auro-previos-box{
        background:#fff!important;
        padding:8px!important;
        margin:4px 0!important;
        box-shadow:none!important;
        border-radius:10px!important;
        border:1px solid rgba(139,30,90,.16)!important;
        break-inside:avoid!important;
        page-break-inside:avoid!important;
      }
      .auro-previos-head{
        padding-bottom:6px!important;
        margin-bottom:6px!important;
      }
      .auro-previos-head b{font-size:13px!important;}
      .auro-previos-head small{font-size:10px!important;}
      .auro-previos-hide{display:none!important;}
      .auro-previos-content{gap:5px!important;}
      .auro-previos-line{
        margin-bottom:5px!important;
        padding:7px!important;
        box-shadow:none!important;
        border-radius:8px!important;
        break-inside:avoid!important;
        page-break-inside:avoid!important;
      }
      .auro-previos-line span{
        font-size:9.5px!important;
        margin-bottom:4px!important;
      }
      .auro-previos-mini-table{
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:5px!important;
      }
      .auro-previos-mini-row{
        padding:5px 7px!important;
        border-radius:7px!important;
        min-height:auto!important;
        box-shadow:none!important;
        page-break-inside:avoid!important;
        break-inside:avoid!important;
      }
      .auro-previos-mini-row b{
        font-size:10.5px!important;
        margin-bottom:3px!important;
        line-height:1.15!important;
      }
      .auro-previos-mini-row em{
        gap:2px!important;
        font-size:10px!important;
        line-height:1.15!important;
      }
      .auro-previos-detail-pill{
        padding:2px 5px!important;
        font-size:9.5px!important;
        border-radius:6px!important;
      }
    }
    @media(max-width:760px){
      .auro-previos-head{display:block!important;}
      .auro-previos-hide{margin-top:10px!important;}
      .auro-previos-mini-table{grid-template-columns:1fr!important;}
    }
  `;
  document.head.appendChild(style);
}

function auroToggleAntecedentesPrevios(){
  const box = document.getElementById('auroAntecedentesPreviosBox');
  const content = document.getElementById('auroAntecedentesPreviosContent');

  if(!box || !content) return;

  const btn = box.querySelector('.auro-previos-hide');
  const oculto = content.classList.toggle('auro-previos-collapsed');

  if(btn){
    btn.innerHTML = oculto
      ? '<i class="bi bi-eye me-1"></i> Mostrar'
      : '<i class="bi bi-eye-slash me-1"></i> Ocultar';
  }

  box.dataset.estado = oculto ? 'oculto' : 'visible';
}

function auroAsegurarCajaAntecedentesPrevios(){
  auroInyectarEstilosAntecedentesPremium();
  const panel = document.getElementById('hc_antecedentes');
  if(!panel) return null;

  let box = document.getElementById('auroAntecedentesPreviosBox');
  if(box) return box;

  box = document.createElement('div');
  box.id = 'auroAntecedentesPreviosBox';
  box.className = 'auro-previos-box';
  box.style.display = 'none';
  box.innerHTML = `
    <div class="auro-previos-head">
      <div>
        <b><i class="bi bi-database-check me-1"></i> Antecedentes previos guardados</b>
        <small>Información leída desde Google Sheets. Se conserva para evitar pérdida de datos.</small>
      </div>
      <button type="button" class="btn-soft auro-previos-hide" onclick="auroToggleAntecedentesPrevios()"><i class="bi bi-eye-slash me-1"></i> Ocultar</button>
    </div>
    <div class="auro-previos-content" id="auroAntecedentesPreviosContent"></div>
  `;

  const titulo = panel.querySelector('.clinical-subtitle');
  if(titulo && titulo.nextSibling){
    titulo.parentNode.insertBefore(box, titulo.nextSibling);
  }else{
    panel.insertBefore(box, panel.firstChild);
  }
  return box;
}


function auroPrevioTryParseJsonInterno(valor){
  const raw = String(valor || '').trim();
  if(!raw) return null;

  const ini = raw.indexOf('{');
  const fin = raw.lastIndexOf('}');
  if(ini === -1 || fin === -1 || fin <= ini) return null;

  try{
    return JSON.parse(raw.substring(ini, fin + 1));
  }catch(e){
    return null;
  }
}

function auroPrevioUnicos(lista){
  const vistos = {};
  return (lista || []).map(x => String(x || '').trim()).filter(x => {
    if(!x) return false;
    const k = x.toLowerCase();
    if(vistos[k]) return false;
    vistos[k] = true;
    return true;
  });
}

function auroPrevioHumanizarClave(clave){
  const mapa = {
    key:'', numero:'', no_aplica:'No aplica', aplicado:'Aplicado', aplicada:'Aplicada',
    fecha:'Fecha', tiempo:'Tiempo', detalle:'Detalle', resultado:'Resultado', observacion:'Observación', observaciones:'Observaciones',
    medicamento:'Medicamento', medicacion:'Medicación', tratamiento:'Tratamiento', biologico:'Biológico', vacuna:'Vacuna', nombre_comercial:'Nombre comercial',
    programada:'Fecha programada', administracion:'Fecha administración', dosis:'Dosis',
    presento:'Presentó', clasificacion:'Clasificación', hospitalizacion:'Hospitalización', vacunado:'Vacunado', vacuna_tipo:'Tipo de vacuna',
    anio_referencia:'Año de referencia', tiempo_hospitalizado:'Tiempo hospitalizado', observacion_presento:'Observación', detalle_clasificacion:'Detalle clasificación',
    habito:'Hábito', actual:'Ex consumidor', abstinencia:'Tiempo de abstinencia',
    actividad:'Actividad', distancia_km:'Distancia', frecuencia_dia:'Frecuencia', tiempo_horas:'Tiempo',
    agua_diaria_litros:'Agua diaria', comidas_dia:'Comidas al día', frutas_verduras:'Frutas / verduras', comida_rapida:'Comida rápida', azucar:'Azúcar', sal:'Sal', suplementos:'Suplementos',
    menarquia:'Menarquia', menacme:'Menacme', menopausia:'Menopausia', vida_sexual_activa:'Vida sexual activa', planificacion_familiar:'Planificación familiar', terapia_hormonal:'Terapia hormonal', infecciones_vulvovaginales:'Infecciones vulvovaginales', ets:'ETS', mamografia:'Mamografía', eco_mamario:'Eco mamario', densitometria_osea:'Densitometría ósea', colposcopia:'Colposcopia'
  };
  if(mapa[clave] !== undefined) return mapa[clave];
  return String(clave || '').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

function auroPrevioEsValorUtil(valor){
  if(valor === null || valor === undefined) return false;
  if(typeof valor === 'boolean') return valor === true;
  const t = String(valor).trim();
  if(!t) return false;
  return !/^(no valorado|no aplica|n\/a|na|undefined|null|\[object object\])$/i.test(t);
}

function auroPrevioTextoItemBasico(item){
  if(!auroPrevioEsValorUtil(item)) return '';
  if(typeof item !== 'object') return String(item).trim();

  const titulo = item.descripcion || item.biologico || item.vacuna || item.habito || item.actividad || item.nombre || item.key || '';
  const partes = [];
  if(auroPrevioEsValorUtil(titulo)) partes.push(String(titulo));

  Object.keys(item).forEach(k => {
    if(['key','descripcion','biologico','vacuna','habito','actividad','nombre'].includes(k)) return;
    const v = item[k];
    if(!auroPrevioEsValorUtil(v)) return;

    if(Array.isArray(v)){
      const sub = v.map(auroPrevioTextoItemBasico).filter(Boolean);
      if(sub.length){
        const etiqueta = auroPrevioHumanizarClave(k);
        if(etiqueta) partes.push(etiqueta + ': ' + sub.join('; '));
      }
      return;
    }

    if(typeof v === 'object'){
      const sub = auroPrevioTextoItemBasico(v);
      if(sub){
        const etiqueta = auroPrevioHumanizarClave(k);
        partes.push((etiqueta ? etiqueta + ': ' : '') + sub);
      }
      return;
    }

    const etiqueta = auroPrevioHumanizarClave(k);
    if(etiqueta) partes.push(etiqueta + ': ' + v);
    else if(String(v).trim()) partes.push(String(v).trim());
  });

  return partes.filter(Boolean).join(' | ');
}

function auroPrevioResumenObjetoGenerico(obj, prefijo){
  if(!obj || typeof obj !== 'object') return '';
  const partes = [];
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    if(!auroPrevioEsValorUtil(v)) return;
    const etiqueta = auroPrevioHumanizarClave(k);
    if(Array.isArray(v)){
      const sub = v.map(auroPrevioTextoItemBasico).filter(Boolean);
      if(sub.length) partes.push((etiqueta ? etiqueta + ': ' : '') + sub.join('; '));
    }else if(typeof v === 'object'){
      const sub = auroPrevioTextoItemBasico(v);
      if(sub) partes.push((etiqueta ? etiqueta + ': ' : '') + sub);
    }else{
      partes.push((etiqueta ? etiqueta + ': ' : '') + v);
    }
  });
  return partes.length ? (prefijo ? prefijo + ': ' : '') + partes.join('; ') : '';
}

function auroPrevioResumenJsonAntecedentes(obj){
  if(!obj || typeof obj !== 'object') return '';

  const bloques = [];

  const patologicos = Array.isArray(obj.patologicos) ? obj.patologicos.map(auroPrevioTextoItemBasico).filter(Boolean) : [];
  if(patologicos.length) bloques.push('Patológicos: ' + auroPrevioUnicos(patologicos).join('; '));

  const quirurgicos = Array.isArray(obj.quirurgicos) ? obj.quirurgicos.map(auroPrevioTextoItemBasico).filter(Boolean) : [];
  if(quirurgicos.length) bloques.push('Quirúrgicos: ' + auroPrevioUnicos(quirurgicos).join('; '));

  const alergias = Array.isArray(obj.alergias) ? obj.alergias.map(auroPrevioTextoItemBasico).filter(Boolean) : [];
  if(alergias.length) bloques.push('Alergias: ' + auroPrevioUnicos(alergias).join('; '));

  const covid = auroPrevioResumenObjetoGenerico(obj.covid || obj.COVID, 'COVID-19');
  if(covid) bloques.push(covid);

  const vacunas = Array.isArray(obj.vacunas) ? obj.vacunas.map(auroPrevioTextoItemBasico).filter(Boolean) : [];
  if(vacunas.length) bloques.push('Vacunas: ' + auroPrevioUnicos(vacunas).join('; '));

  const habitos = Array.isArray(obj.habitos) ? obj.habitos.map(auroPrevioTextoItemBasico).filter(Boolean) : [];
  if(habitos.length) bloques.push('Hábitos: ' + auroPrevioUnicos(habitos).join('; '));

  const estilo = Array.isArray(obj.estilo_vida || obj.estiloVida) ? (obj.estilo_vida || obj.estiloVida).map(auroPrevioTextoItemBasico).filter(Boolean) : [];
  if(estilo.length) bloques.push('Estilo de vida: ' + auroPrevioUnicos(estilo).join('; '));

  const alimentacion = auroPrevioResumenObjetoGenerico(obj.alimentacion, 'Alimentación');
  if(alimentacion) bloques.push(alimentacion);

  const obstetricos = Array.isArray(obj.obstetricos) ? obj.obstetricos.map(auroPrevioTextoItemBasico).filter(Boolean) : [];
  if(obstetricos.length) bloques.push('Obstétricos: ' + auroPrevioUnicos(obstetricos).join('; '));

  const ginecologicos = auroPrevioResumenObjetoGenerico(obj.ginecologicos, 'Ginecológicos');
  if(ginecologicos) bloques.push(ginecologicos);

  const ginecoDirecto = [];
  ['fum','menarquia','ciclos','gesta','partos','cesareas','abortos','hijos_vivos','pap','ivsa','anticoncepcion','otros'].forEach(k => {
    if(auroPrevioEsValorUtil(obj[k])) ginecoDirecto.push(auroPrevioHumanizarClave(k) + ': ' + obj[k]);
  });
  if(ginecoDirecto.length) bloques.push('Gineco-obstétricos: ' + auroPrevioUnicos(ginecoDirecto).join('; '));

  return bloques.join(' || ');
}

function auroLimpiarTextoPrevioClinico(valor){
  return String(valor || '')
    .replace(/AUROSANAX_[^\n|;]*/gi, ' ')
    .replace(/\[object Object\]/gi, ' ')
    .replace(/[{}\[\]"]/g, ' ')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\s*\|\|\s*/g, '\n')
    .replace(/\s*\|\s*/g, '\n')
    .replace(/\s*;\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function auroTokenizarPrevioClinico(valor){
  let raw = auroLimpiarTextoPrevioClinico(valor);
  if(!raw) return [];
  raw = raw
    .replace(/\b(patologicos?|patológicos?|patologico|patológico|biologico|biológico|vacunas?|covid|habitos?|hábitos?|habito|hábito|actividad(?:[_\s-]*fisica)?|actividad(?:[_\s-]*física)?|estilo[_\s-]*vida|alergias?|alergia|quirurgicos?|quirúrgicos?|cirugia|cirugía|gineco[_\s-]*obstetricos?|gineco[_\s-]*obstétricos?|fum|fur|fup|pap|gestas?|partos?|cesareas?|cesáreas?|abortos?|hijos vivos|hijos muertos|lactancia|ectopicos|ectópicos|otros|tiempo|medicamento|medicación|medicacion|tratamiento|reaccion|reacción|dosis|fecha|marca|frecuencia|cantidad|numero|número|key)\s*:/gi, '\n$1:')
    .replace(/,(?=\s*(?:patolog|biolog|vacuna|covid|habito|hábito|actividad|estilo|alerg|quir|cirug|gineco|fum|fur|fup|pap|gesta|parto|ces|aborto|hijos|lactancia|ectop|otros|tiempo|medic|tratamiento|reacci|dosis|fecha|marca|frecuencia|cantidad|numero|número|key)\s*:)/gi, '\n');
  return raw
    .split(/\n+/)
    .map(x => String(x || '').trim())
    .map(x => x.replace(/^[-•✓⚠\s]+/, '').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

function auroEsValorPrevioUtil(valor){
  const t = String(valor || '').trim();
  if(!t) return false;
  if(/^[-–—\s.,:]*$/.test(t)) return false;
  if(/^(no|n\/a|na|ninguno|ninguna|sin datos|sin dato|no valorado|no aplica|negado|niega|false|null|undefined)$/i.test(t)) return false;
  if(/^\d+$/.test(t)) return false;
  if(/^(años?|meses?|d[ií]as?|dosis|n[uú]mero|numero|key)$/i.test(t)) return false;
  if(/^(key|numero|número|dosis)\s*:/i.test(t)) return false;
  return true;
}

function auroCapitalizarClinico(txt){
  txt = String(txt || '').trim();
  if(!txt) return '';
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function auroNombreVacunaClinica(txt){
  return String(txt || '')
    .replace(/\bCovid\b/gi, 'COVID-19')
    .replace(/\bHpv\b/gi, 'VPH')
    .replace(/\bVirus Papiloma Humano\b/gi, 'VPH')
    .replace(/\bHepB\b/gi, 'Hepatitis B')
    .replace(/\bTdap\b|\bTd\/?Tdap\b/gi, 'Td/Tdap')
    .replace(/\bSrp\b/gi, 'SRP')
    .replace(/\bFiebreAmarilla\b/gi, 'Fiebre amarilla')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function auroEsCatalogoNoClinico(txt){
  const n = auroNormalizarClaveClinica(txt);
  if(!n) return true;
  const catalogo = [
    'covid','covid 19','virus papiloma humano','vph','hpv','hepb','hepatitis b','influenza','td','tdap','td tdap','neumococo','srp','varicela','fiebre amarilla',
    'tabaco','alcohol','drogas','cafe','café','cafeina','cafeína','biomasa',
    'correr','caminar','nadar','ciclismo','bicicleta','ejercicio','actividad fisica','actividad física','otros',
    'desayuno','almuerzo','cena','colacion','colación','agua','proteinas','proteínas','carbohidratos','grasas','verduras','frutas'
  ];
  return catalogo.includes(n);
}

function auroEsTokenTecnicoAntecedente(txt){
  const t = String(txt || '').trim();
  if(!t) return true;
  if(/^(key|numero|número|dosis)\s*:/i.test(t)) return true;
  if(/\b(key|numero|número)\s*:/i.test(t)) return true;
  if(/^(vacunas?|biologico|biológico|covid|habitos?|hábitos?|habito|hábito|actividad(?:[_\s-]*fisica)?|actividad(?:[_\s-]*física)?|estilo[_\s-]*vida)\s*:/i.test(t)) return true;
  return false;
}

function auroEsPatologiaConocida(txt){
  const n = auroNormalizarClaveClinica(txt);
  if(!n) return false;
  const patologias = [
    'hipertension arterial','hta','infarto agudo de miocardio','iam','diabetes mellitus','dm','asma bronquial','gastritis','hipotiroidismo','obesidad','osteoporosis',
    'dislipidemia','anemia','migraña','migrana','epilepsia','cancer','cáncer','depresion','depresión','ansiedad','sop','sindrome ovario poliquistico',
    'endometriosis','mioma','miomas','covid persistente','enfermedad renal','enfermedad hepatica','enfermedad hepática','artritis','lupus'
  ];
  if(patologias.includes(n)) return true;
  return patologias.some(p => n.includes(p) || p.includes(n));
}

function auroLimpiarTituloClinico(txt){
  return String(txt || '')
    .replace(/^(patologicos?|patológicos?|patologico|patológico|alergias?|alergia|quirurgicos?|quirúrgicos?|cirugia|cirugía|medicamento|medicación|medicacion|tratamiento|tiempo|reaccion|reacción)\s*:\s*/i, '')
    .replace(/^(key|numero|número|dosis)\s*:\s*[^,;|]*/gi, '')
    .replace(/\b(key|numero|número|dosis)\s*:\s*[^,;|]*/gi, '')
    .replace(/,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[:\s,.-]+|[:\s,.-]+$/g, '')
    .trim();
}



/* AUROSANAX FIX HTA - extrae patológicos desde texto compacto o JSON modular */
function auroExtraerFuentePatologicosPersonales(valor){
  const texto = String(valor || '').trim();
  if(!texto) return '';

  try{
    if(typeof AURO_ANT_PERSONALES_MARKER !== 'undefined' && texto.startsWith(AURO_ANT_PERSONALES_MARKER)){
      const data = JSON.parse(texto.substring(AURO_ANT_PERSONALES_MARKER.length));
      if(typeof data?.patologicos === 'string') return data.patologicos;
      if(Array.isArray(data?.patologicos)) return data.patologicos.map(auroPrevioTextoItemBasico).filter(Boolean).join('; ');
    }
  }catch(e){
    console.warn('AUROSANAX: no se pudo leer patológicos personales desde JSON.', e);
  }

  return texto;
}

function auroExtraerPatologiasPipePremium(valor){
  const fuente = auroExtraerFuentePatologicosPersonales(valor);
  const items = [];
  const seen = new Set();

  let texto = String(fuente || '')
    .replace(/^patologicos?\s*:\s*/i, '')
    .replace(/^patológicos?\s*:\s*/i, '')
    .trim();

  if(!texto) return items;

  // Soporta formato compacto:
  // Hipertensión arterial (HTA) | 5 años | Losartán; Diabetes mellitus (DM) | 3 años
  // y también casos donde Google Sheets / el navegador elimina o rompe los separadores.
  texto = texto
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n+/g, '; ')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const patologiasBase = [
    'Hipertensión arterial (HTA)',
    'Infarto agudo de miocardio (IAM)',
    'Diabetes mellitus (DM)',
    'Asma bronquial',
    'Gastritis',
    'Hipotiroidismo',
    'Obesidad',
    'Osteoporosis',
    'Otros'
  ];

  // Si falta punto y coma antes de una patología conocida, lo inserta para poder separar filas.
  patologiasBase.forEach(nombre => {
    const esc = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('([^;])\\s+(' + esc + '\\s*\\|)', 'gi');
    texto = texto.replace(re, '$1; $2');
  });

  texto
    .split(';')
    .map(x => String(x || '').trim())
    .filter(Boolean)
    .forEach(row => {
      const partes = row.split('|').map(x => String(x || '').trim()).filter(Boolean);
      const titulo = auroLimpiarTituloClinico(partes[0] || '');

      if(!titulo) return;
      if(auroEsTokenTecnicoAntecedente(titulo)) return;
      if(auroEsCatalogoNoClinico(titulo)) return;

      const detallePartes = [];
      if(partes[1]){
        const tiempo = partes[1].replace(/^Tiempo:\s*/i, '').trim();
        if(tiempo) detallePartes.push('Tiempo: ' + tiempo);
      }

      const tratamiento = partes.slice(2).join(' | ').replace(/^(Medicación|Medicamento|Tratamiento):\s*/i, '').trim();
      if(tratamiento) detallePartes.push('Tratamiento: ' + tratamiento);

      const detalle = detallePartes.join(' · ');
      const key = auroNormalizarClaveClinica(titulo + ' ' + detalle);
      if(!key || seen.has(key)) return;
      seen.add(key);

      items.push({
        titulo: auroCapitalizarClinico(titulo),
        detalle
      });
    });

  return items;
}

function auroExtraerItemsAntecedentePremium(valor, tipo){
  if(tipo === 'patologia'){
    const directas = auroExtraerPatologiasPipePremium(valor);
    if(directas.length) return directas;
  }
  const tokens = auroTokenizarPrevioClinico(valor);
  const items = [];
  const seen = new Set();
  let last = -1;

  function add(titulo, detalle){
    titulo = auroLimpiarTituloClinico(titulo);
    detalle = auroLimpiarTituloClinico(detalle);
    if(!auroEsValorPrevioUtil(titulo)) return;
    if(auroEsTokenTecnicoAntecedente(titulo)) return;
    if(['patologicos','patológicos','patologico','patológico','vacunas','vacuna','habitos','hábitos','habito','hábito','actividad','actividad fisica','actividad física','estilo vida','estilo_vida'].includes(auroNormalizarClaveClinica(titulo))) return;
    if(tipo === 'patologia' && auroEsCatalogoNoClinico(titulo)) return;
    const key = auroNormalizarClaveClinica(titulo + ' ' + detalle);
    if(!key || seen.has(key)) return;
    seen.add(key);
    items.push({titulo: auroCapitalizarClinico(titulo), detalle});
    last = items.length - 1;
  }

  function append(detalle){
    detalle = auroLimpiarTituloClinico(detalle);
    if(!auroEsValorPrevioUtil(detalle) || last < 0 || !items[last]) return false;
    if(auroEsTokenTecnicoAntecedente(detalle)) return false;
    if(items[last].detalle && items[last].detalle.toLowerCase().includes(detalle.toLowerCase())) return true;
    items[last].detalle = items[last].detalle ? items[last].detalle + ' · ' + detalle : detalle;
    return true;
  }

  tokens.forEach(tok0 => {
    let tok = String(tok0 || '').trim();
    if(!tok) return;
    let m;

    if((m = tok.match(/^(patologicos?|patológicos?|patologico|patológico)\s*:\s*(.+)$/i))){
      if(tipo === 'patologia') add(m[2]);
      return;
    }
    if((m = tok.match(/^(tiempo)\s*:\s*(.+)$/i))){
      if(tipo === 'patologia') append('Tiempo: ' + m[2]);
      return;
    }
    if((m = tok.match(/^(medicamento|medicación|medicacion|tratamiento)\s*:\s*(.+)$/i))){
      if(['patologia','alergia','medicacion'].includes(tipo)) append('Tratamiento: ' + m[2]);
      return;
    }
    if((m = tok.match(/^(reaccion|reacción)\s*:\s*(.+)$/i))){
      if(tipo === 'alergia') append('Reacción: ' + m[2]);
      return;
    }

    if(auroEsTokenTecnicoAntecedente(tok)) return;

    if(tipo === 'patologia'){
      if(/^\d+\s*(años?|meses?|d[ií]as?)\b/i.test(tok)){ append('Tiempo: ' + tok); return; }
      if(auroEsPatologiaConocida(tok)){ add(tok); return; }
      if(last >= 0 && !auroEsCatalogoNoClinico(tok) && !auroEsPatologiaConocida(tok)){ append('Tratamiento: ' + tok); return; }
      return;
    }

    if(tipo === 'alergia'){
      if((m = tok.match(/^alergias?\s*:\s*(.+)$/i))){ add(m[1]); return; }
      if(!/^patolog|^vacuna|^habito|^actividad/i.test(tok)) add(tok);
      return;
    }

    if(tipo === 'quirurgico'){
      if((m = tok.match(/^(quirurgicos?|quirúrgicos?|cirugia|cirugía)\s*:\s*(.+)$/i))){ add(m[2]); return; }
      if(!/^patolog|^vacuna|^habito|^actividad/i.test(tok)) add(tok);
      return;
    }

    if(tipo === 'gineco'){
      if((m = tok.match(/^(fum|fur|fup|pap|gestas?|partos?|cesareas?|cesáreas?|abortos?|hijos vivos|hijos muertos|lactancia|ectopicos|ectópicos|otros)\s*:\s*(.+)$/i))){
        const label = auroCapitalizarClinico(m[1].replace(/_/g, ' '));
        add(label, m[2]);
      }
      return;
    }

    if(tipo === 'medicacion' || tipo === 'familiares' || tipo === 'general'){
      if(!/^patolog|^vacuna|^habito|^actividad/i.test(tok)) add(tok);
    }
  });

  return items.filter(x => auroEsValorPrevioUtil(x.titulo));
}

function auroExtraerVacunasRegistradas(valor){
  const tokens = auroTokenizarPrevioClinico(valor);
  const items = [];
  const seen = new Set();

  tokens.forEach(tok => {
    let m;
    let nombre = '';
    let detalle = '';
    const t = String(tok || '').trim();

    if(/^(key|numero|número|dosis)\s*:/i.test(t)) return;
    if(/^covid\s*:\s*dosis\s*:/i.test(t)) return;

    if((m = t.match(/^(biologico|biológico|vacunas?)\s*:\s*(.+)$/i))){
      const val = m[2].trim();
      const tieneEvidencia = /(aplicad[ao]|sí|si|fecha\s*:|marca\s*:|lote\s*:|refuerzo|completa|completo)/i.test(val);
      if(!tieneEvidencia) return;
      nombre = val
        .replace(/\b(aplicad[ao]|si|sí|positivo|completa|completo|refuerzo)\b/gi,'')
        .replace(/\b(fecha|marca|lote)\s*:\s*[^,;|]+/gi,'')
        .trim();
      detalle = (val.match(/(fecha\s*:\s*[^,;|]+|marca\s*:\s*[^,;|]+|lote\s*:\s*[^,;|]+)/i) || [''])[0];
    }

    if(!nombre) return;
    nombre = auroNombreVacunaClinica(nombre).replace(/^[:\s-]+|[:\s-]+$/g,'');
    if(!auroEsValorPrevioUtil(nombre) || auroEsTokenTecnicoAntecedente(nombre)) return;
    const key = auroNormalizarClaveClinica(nombre + detalle);
    if(seen.has(key)) return;
    seen.add(key);
    items.push({titulo:nombre, detalle});
  });

  return items;
}

function auroExtraerHabitosRegistrados(valor){
  const tokens = auroTokenizarPrevioClinico(valor);
  const items = [];
  const seen = new Set();

  tokens.forEach(t => {
    const m = String(t || '').trim().match(/^(habitos?|hábitos?|habito|hábito)\s*:\s*(.+)$/i);
    if(!m) return;
    const v = m[2].trim();
    const tieneRespuesta = /(sí|si|ocasional|frecuente|diario|semanal|mensual|actual|ex\s|exfumador|cantidad|tiempo|frecuencia|consumo|cigarr|copa|social|biomasa)/i.test(v);
    if(!tieneRespuesta) return;
    const limpio = auroLimpiarTituloClinico(v.replace(/^(key|numero|número|dosis)\s*:.*/i,''));
    if(!auroEsValorPrevioUtil(limpio) || auroEsTokenTecnicoAntecedente(limpio)) return;
    const key = auroNormalizarClaveClinica(limpio);
    if(seen.has(key)) return;
    seen.add(key);
    items.push({titulo: auroCapitalizarClinico(limpio), detalle:''});
  });

  return items;
}

function auroExtraerActividadRegistrada(valor){
  const tokens = auroTokenizarPrevioClinico(valor);
  const items = [];
  const seen = new Set();

  tokens.forEach(t => {
    const m = String(t || '').trim().match(/^(actividad(?:[_\s-]*fisica)?|actividad(?:[_\s-]*física)?|estilo[_\s-]*vida)\s*:\s*(.+)$/i);
    if(!m) return;
    const v = m[2].trim();
    const tieneRespuesta = /(sí|si|veces|semana|diario|min|hora|frecuencia|tiempo|realiza|habitual|ocasional)/i.test(v);
    if(!tieneRespuesta) return;
    const limpio = auroLimpiarTituloClinico(v.replace(/^(key|numero|número|dosis)\s*:.*/i,''));
    if(!auroEsValorPrevioUtil(limpio) || auroEsTokenTecnicoAntecedente(limpio)) return;
    const key = auroNormalizarClaveClinica(limpio);
    if(seen.has(key)) return;
    seen.add(key);
    items.push({titulo: auroCapitalizarClinico(limpio), detalle:''});
  });

  return items;
}

function auroIconoSeccionAntecedente(label){
  const n = auroNormalizarClaveClinica(label);
  if(n.includes('patolog')) return 'bi-heart-pulse';
  if(n.includes('quir')) return 'bi-scissors';
  if(n.includes('alerg')) return 'bi-exclamation-triangle';
  if(n.includes('vacuna')) return 'bi-shield-check';
  if(n.includes('habito')) return 'bi-person-lines-fill';
  if(n.includes('actividad')) return 'bi-activity';
  if(n.includes('gineco')) return 'bi-gender-female';
  if(n.includes('medicacion')) return 'bi-capsule-pill';
  if(n.includes('familia')) return 'bi-people';
  return 'bi-journal-medical';
}

function auroRenderDetallePremium(detalle){
  const raw = String(detalle || '').trim();
  if(!raw) return '';

  const partes = raw
    .split(/\s*·\s*/)
    .map(x => x.trim())
    .filter(Boolean);

  return partes.map(p => {
    let icon = 'bi-dot';
    let texto = p;

    if(/^Tiempo:/i.test(p)){
      icon = 'bi-hourglass-split';
      texto = p.replace(/^Tiempo:\s*/i, 'Evolución: ');
    }else if(/^(Tratamiento|Medicamento|Medicación):/i.test(p)){
      icon = 'bi-capsule-pill';
      texto = p.replace(/^(Tratamiento|Medicamento|Medicación):\s*/i, 'Tratamiento: ');
    }else if(/^(Fecha|Año):/i.test(p)){
      icon = 'bi-calendar-check';
    }else if(/^(Reacción|Reaccion):/i.test(p)){
      icon = 'bi-exclamation-circle';
    }

    return `<span class="auro-previos-detail-pill"><i class="bi ${icon}"></i>${auroEscapeHtml(texto)}</span>`;
  }).join('');
}

function auroRenderPrevioItemsPremium(label, items){
  items = (items || []).filter(x => x && auroEsValorPrevioUtil(x.titulo) && !auroEsTokenTecnicoAntecedente(x.titulo));
  if(!items.length) return '';

  const icono = auroIconoSeccionAntecedente(label);

  return `
    <div class="auro-previos-line auro-previos-compact">
      <span><i class="bi ${icono}"></i>${auroEscapeHtml(label)}</span>
      <div class="auro-previos-mini-table">
        ${items.map(it => `
          <div class="auro-previos-mini-row">
            <b>${auroEscapeHtml(it.titulo)}</b>
            ${it.detalle ? `<em>${auroRenderDetallePremium(it.detalle)}</em>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function auroRenderPrevioLineaLimpia(label, value){
  const items = auroExtraerItemsAntecedentePremium(value, 'general');
  return auroRenderPrevioItemsPremium(label, items);
}



function auroMostrarAntecedentesPrevios(h, modo){
  const box = auroAsegurarCajaAntecedentesPrevios();
  const content = document.getElementById('auroAntecedentesPreviosContent');
  if(!box || !content) return;

  if(!auroHistoriaTieneAntecedentes(h)){
    box.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const fuentePersonales = h.antecedentes_personales || '';
  const fuentePatologicos = auroExtraerFuentePatologicosPersonales(fuentePersonales);
  let html = '';

  html += auroRenderPrevioItemsPremium('Patológicos personales', auroExtraerItemsAntecedentePremium(fuentePatologicos, 'patologia'));
  html += auroRenderPrevioItemsPremium('Quirúrgicos', auroExtraerItemsAntecedentePremium(h.antecedentes_quirurgicos || '', 'quirurgico'));
  html += auroRenderPrevioItemsPremium('Alergias', auroExtraerItemsAntecedentePremium(h.alergias || '', 'alergia'));
  html += auroRenderPrevioItemsPremium('Vacunas registradas', auroExtraerVacunasRegistradas(fuentePersonales));
  html += auroRenderPrevioItemsPremium('Hábitos registrados', auroExtraerHabitosRegistrados(fuentePersonales));
  html += auroRenderPrevioItemsPremium('Actividad física registrada', auroExtraerActividadRegistrada(fuentePersonales));
  html += auroRenderPrevioItemsPremium('Gineco-obstétricos', auroExtraerItemsAntecedentePremium(h.antecedentes_gineco_obstetricos || '', 'gineco'));
  html += auroRenderPrevioItemsPremium('Medicación actual', auroExtraerItemsAntecedentePremium(h.medicacion_actual || '', 'medicacion'));
  html += auroRenderPrevioItemsPremium('Familiares', auroExtraerItemsAntecedentePremium(h.antecedentes_familiares || '', 'familiares'));

  content.innerHTML = html;

  const estadoPrevio = box.dataset.estado || 'visible';

  if(estadoPrevio === 'oculto'){
    content.classList.add('auro-previos-collapsed');
  }else{
    content.classList.remove('auro-previos-collapsed');
  }

  const btn = box.querySelector('.auro-previos-hide');
  if(btn){
    btn.innerHTML = estadoPrevio === 'oculto'
      ? '<i class="bi bi-eye me-1"></i> Mostrar'
      : '<i class="bi bi-eye-slash me-1"></i> Ocultar';
  }

  box.dataset.idHistoriaOrigen = h.id_historia || '';
  box.dataset.modo = modo || '';
  box.style.display = content.innerHTML.trim() ? 'block' : 'none';
}


function auroCargarAntecedentesDesdeHistoria(h, modo){
  if(!h) return;

  setValueIfExists('hcAntecedentesPersonales', h.antecedentes_personales || '');
  cargarAntecedentesPersonalesCompletos(h.antecedentes_personales || '');

  setValueIfExists('hcAntecedentesQuirurgicos', h.antecedentes_quirurgicos || '');
  cargarAntecedentesQuirurgicosEstructurados(h.antecedentes_quirurgicos || '');

  cargarAntecedentesGinecoObstetricosCompletos(h.antecedentes_gineco_obstetricos || '');

  setValueIfExists('hcAntecedentesFamiliares', h.antecedentes_familiares || '');
  setValueIfExists('hcMedicacionActual', h.medicacion_actual || '');
  cargarAlergiasEstructuradas(h.alergias || '');

  auroMostrarAntecedentesPrevios(h, modo || 'lectura');
  updateClinicalSummary();
}

function auroCargarAntecedentesPreviosPaciente(idPaciente){
  if(editingHistoryId) return;
  const h = auroUltimaHistoriaConAntecedentes(idPaciente);
  if(!h){
    auroMostrarAntecedentesPrevios(null);
    return;
  }

  auroCargarAntecedentesDesdeHistoria(h, 'lectura-paciente');

  const box = document.getElementById('auroAntecedentesPreviosBox');
  if(box){
    const nota = box.querySelector('.auro-previos-head small');
    if(nota){
      nota.textContent = 'Leído desde la última historia del paciente. Para modificarlo, use Buscar / editar historias.';
    }
  }
}

function auroValorAntecedenteVacio(valor){
  return !String(valor || '').trim();
}

function auroPreservarAntecedenteSiVacio(data, campo, historiaPrevia){
  if(!data || !campo || !historiaPrevia) return;
  const nuevo = data[campo];
  const previo = historiaPrevia[campo];

  if(auroValorAntecedenteVacio(nuevo) && !auroValorAntecedenteVacio(previo)){
    data[campo] = previo;
  }
}

function auroHistoriaActualEdicion(){
  if(!editingHistoryId) return null;
  return (historiasClinicas || []).find((h, idx) =>
    String(h.id_historia || h.id || idx) === String(editingHistoryId)
  ) || null;
}

function auroAplicarProteccionAntecedentesEdicion(data){
  const h = auroHistoriaActualEdicion();
  if(!h) return data;

  [
    'antecedentes_personales',
    'antecedentes_quirurgicos',
    'antecedentes_gineco_obstetricos',
    'antecedentes_familiares',
    'medicacion_actual',
    'alergias'
  ].forEach(campo => auroPreservarAntecedenteSiVacio(data, campo, h));

  return data;
}


function seleccionarPacienteHistoria(){
  const select = document.getElementById('hcPacienteSelect');
  const paciente = patients.find(p => p.id_paciente === select.value);
  activePatientId = select.value || activePatientId;

  if(!paciente){
    ['hcCedula','hcNacimiento','hcEdad','hcSexo','hcEstadoCivil','hcOcupacion','hcTelefono','hcCorreo','hcDireccion','hcSeguro','hcContactoEmergencia'].forEach(id => setValueIfExists(id,''));
    auroMostrarAntecedentesPrevios(null);
    auroMostrarExamenFisicoPrevio(null);
    auroMostrarDiagnosticosPrevios(null);
    updateClinicalSummary();
    renderModulePatientCards();
    return;
  }

  const fechaNacimiento = normalizarFechaInput(paciente.fecha_nacimiento);
  setValueIfExists('hcCedula', paciente.cedula);
  setValueIfExists('hcNacimiento', fechaNacimiento);
  setValueIfExists('hcEdad', paciente.edad || calcularEdadDesdeFecha(fechaNacimiento));
  setValueIfExists('hcSexo', paciente.sexo);
  setValueIfExists('hcEstadoCivil', paciente.estado_civil);
  setValueIfExists('hcOcupacion', paciente.ocupacion);
  setValueIfExists('hcTelefono', paciente.telefono);
  setValueIfExists('hcCorreo', paciente.email);
  setValueIfExists('hcDireccion', paciente.direccion);
  setValueIfExists('hcSeguro', paciente.aseguradora);
  setValueIfExists('hcContactoEmergencia', [paciente.contacto_emergencia || '', paciente.telefono_emergencia || ''].filter(Boolean).join(' - '));

  if(paciente.alergias && document.getElementById('hcAlergias') && !document.getElementById('hcAlergias').value){
    cargarAlergiasEstructuradas(paciente.alergias);
  }

  // v2.2: al seleccionar paciente, leer antecedentes ya guardados en historias_clinicas.
  // No entra en modo edición automáticamente; solo muestra la información previa para referencia segura.
  auroCargarAntecedentesPreviosPaciente(paciente.id_paciente);
  auroCargarExamenFisicoPrevioPaciente(paciente.id_paciente);

  updateClinicalSummary();
  renderModulePatientCards();
}


function recopilarAntecedentesPersonalesEstructurados(){
  const filas = [];
  document.querySelectorAll('.hcPatologicoCheck').forEach(chk => {
    const patologia = chk.dataset.patologia || '';
    const tiempo = document.querySelector(`.hcPatologicoTiempo[data-patologia="${CSS.escape(patologia)}"]`)?.value?.trim() || '';
    const medicamento = document.querySelector(`.hcPatologicoMedicamento[data-patologia="${CSS.escape(patologia)}"]`)?.value?.trim() || '';

    if(chk.checked || tiempo || medicamento){
      filas.push([patologia, tiempo, medicamento].filter(Boolean).join(' | '));
    }
  });

  const valor = filas.join('; ');
  const hidden = document.getElementById('hcAntecedentesPersonales');
  if(hidden) hidden.value = valor;
  return valor;
}

function limpiarAntecedentesPersonalesEstructurados(){
  document.querySelectorAll('.hcPatologicoCheck').forEach(chk => chk.checked = false);
  document.querySelectorAll('.hcPatologicoTiempo,.hcPatologicoMedicamento').forEach(input => input.value = '');
  setValueIfExists('hcAntecedentesPersonales','');
}

function cargarAntecedentesPersonalesEstructurados(valor){
  limpiarAntecedentesPersonalesEstructurados();
  const texto = String(valor || '').trim();
  if(!texto){
    return;
  }

  setValueIfExists('hcAntecedentesPersonales', texto);

  texto.split(';').map(x => x.trim()).filter(Boolean).forEach(item => {
    const partes = item.split('|').map(x => x.trim());
    const patologia = partes[0] || '';
    const tiempo = (partes[1] || '').replace(/^Tiempo:\s*/i,'').trim();
    const medicamento = partes.slice(2).join(' | ').replace(/^Medicación:\s*/i,'').trim() || '';

    const chk = auroBuscarControlPorData('.hcPatologicoCheck', 'patologia', patologia);
    if(!chk) return;

    const patologiaReal = chk.dataset.patologia || patologia;
    chk.checked = true;
    const tiempoInput = document.querySelector(`.hcPatologicoTiempo[data-patologia="${CSS.escape(patologiaReal)}"]`);
    const medicamentoInput = document.querySelector(`.hcPatologicoMedicamento[data-patologia="${CSS.escape(patologiaReal)}"]`);

    if(tiempoInput) tiempoInput.value = tiempo;
    if(medicamentoInput) medicamentoInput.value = medicamento;
  });
}

function recopilarAntecedentesQuirurgicosEstructurados(){
  const filas = [];
  document.querySelectorAll('.hcQuirurgicoCheck').forEach(chk => {
    const cirugiaBase = chk.dataset.cirugia || '';
    const fecha = document.querySelector(`.hcQuirurgicoFecha[data-cirugia="${CSS.escape(cirugiaBase)}"]`)?.value?.trim() || '';
    let cirugia = cirugiaBase;

    if(cirugiaBase === 'Otros'){
      const otroNombre = document.querySelector('.hcQuirurgicoOtroNombre')?.value?.trim() || '';
      if(otroNombre) cirugia = 'Otros: ' + otroNombre;
    }

    if(chk.checked || fecha || (cirugiaBase === 'Otros' && cirugia !== 'Otros')){
      filas.push([cirugia, fecha].filter(Boolean).join(' | '));
    }
  });

  const valor = filas.join('; ');
  const hidden = document.getElementById('hcAntecedentesQuirurgicos');
  if(hidden) hidden.value = valor;
  return valor;
}

function limpiarAntecedentesQuirurgicosEstructurados(){
  document.querySelectorAll('.hcQuirurgicoCheck').forEach(chk => chk.checked = false);
  document.querySelectorAll('.hcQuirurgicoFecha').forEach(input => input.value = '');
  const otro = document.querySelector('.hcQuirurgicoOtroNombre');
  if(otro) otro.value = '';
  setValueIfExists('hcAntecedentesQuirurgicos','');
}

function cargarAntecedentesQuirurgicosEstructurados(valor){
  limpiarAntecedentesQuirurgicosEstructurados();
  const texto = String(valor || '').trim();
  if(!texto){
    return;
  }

  setValueIfExists('hcAntecedentesQuirurgicos', texto);

  texto.split(';').map(x => x.trim()).filter(Boolean).forEach(item => {
    const partes = item.split('|').map(x => x.trim());
    const cirugiaTexto = partes[0] || '';
    const fecha = (partes[1] || '').replace(/^Fecha:\s*/i,'').replace(/^Año:\s*/i,'').trim();
    let cirugiaBase = cirugiaTexto;

    if(cirugiaTexto.startsWith('Otros:')){
      cirugiaBase = 'Otros';
      const otro = document.querySelector('.hcQuirurgicoOtroNombre');
      if(otro) otro.value = cirugiaTexto.replace(/^Otros:\s*/,'').trim();
    }

    const chk = auroBuscarControlPorData('.hcQuirurgicoCheck', 'cirugia', cirugiaBase);
    if(!chk) return;

    const cirugiaReal = chk.dataset.cirugia || cirugiaBase;
    chk.checked = true;
    const fechaInput = document.querySelector(`.hcQuirurgicoFecha[data-cirugia="${CSS.escape(cirugiaReal)}"]`);
    if(fechaInput) fechaInput.value = fecha;
  });
}


function recopilarAlergiasEstructuradas(){
  const filas = [];
  document.querySelectorAll('.hcAlergiaCheck').forEach(chk => {
    const alergia = chk.dataset.alergia || '';
    const detalle = document.querySelector(`.hcAlergiaDetalle[data-alergia="${CSS.escape(alergia)}"]`)?.value?.trim() || '';

    if(chk.checked || detalle){
      filas.push([alergia, detalle].filter(Boolean).join(' | '));
    }
  });

  const valor = filas.join('; ');
  const hidden = document.getElementById('hcAlergias');
  if(hidden) hidden.value = valor;
  return valor;
}

function actualizarAlergiasEstructuradas(){
  recopilarAlergiasEstructuradas();
  updateClinicalSummary();
}

function limpiarAlergiasEstructuradas(){
  document.querySelectorAll('.hcAlergiaCheck').forEach(chk => chk.checked = false);
  document.querySelectorAll('.hcAlergiaDetalle').forEach(input => input.value = '');
  setValueIfExists('hcAlergias','');
  updateClinicalSummary();
}

function cargarAlergiasEstructuradas(valor){
  limpiarAlergiasEstructuradas();
  const texto = String(valor || '').trim();
  if(!texto){
    return;
  }

  setValueIfExists('hcAlergias', texto);

  texto.split(';').map(x => x.trim()).filter(Boolean).forEach(item => {
    const partes = item.split('|').map(x => x.trim());
    const alergia = partes[0] || '';
    const detalle = partes.slice(1).join(' | ').replace(/^Reacción:\s*/i,'').trim() || '';

    const chk = auroBuscarControlPorData('.hcAlergiaCheck', 'alergia', alergia);
    if(!chk) return;

    const alergiaReal = chk.dataset.alergia || alergia;
    chk.checked = true;
    const detalleInput = document.querySelector(`.hcAlergiaDetalle[data-alergia="${CSS.escape(alergiaReal)}"]`);
    if(detalleInput) detalleInput.value = detalle;
  });

  updateClinicalSummary();
}


/* ==========================================================
   AUROSANAX - CONEXIÓN COMPLETA MÓDULO ANTECEDENTES
   No destructivo: usa columnas existentes de historias_clinicas.
   ========================================================== */

const AURO_ANT_PERSONALES_MARKER = 'AUROSANAX_ANT_PERSONALES_V1::';
const AURO_ANT_GINECO_OBS_MARKER = 'AUROSANAX_ANT_GINECO_OBS_V1::';

function auroGet(id){
  return document.getElementById(id)?.value?.trim() || '';
}

function auroSet(id, value){
  setValueIfExists(id, value || '');
}

function auroGetCheck(id){
  return !!document.getElementById(id)?.checked;
}

function auroSetCheck(id, value){
  const el = document.getElementById(id);
  if(el) el.checked = !!value;
}

function auroGetRadio(name){
  return document.querySelector(`input[name="${CSS.escape(name)}"]:checked`)?.value || '';
}

function auroSetRadio(name, value){
  document.querySelectorAll(`input[name="${CSS.escape(name)}"]`).forEach(r => {
    r.checked = String(r.value || '') === String(value || '');
  });
}

function auroTieneValor(valor){
  if(valor === null || valor === undefined) return false;
  if(typeof valor === 'boolean') return valor;
  if(typeof valor === 'number') return true;
  if(typeof valor === 'string') return valor.trim() !== '';
  if(Array.isArray(valor)) return valor.some(auroTieneValor);
  if(typeof valor === 'object') return Object.values(valor).some(auroTieneValor);
  return false;
}

function auroCompactarObjeto(obj){
  if(Array.isArray(obj)){
    return obj.map(auroCompactarObjeto).filter(auroTieneValor);
  }
  if(obj && typeof obj === 'object'){
    const limpio = {};
    Object.keys(obj).forEach(k => {
      const v = auroCompactarObjeto(obj[k]);
      if(auroTieneValor(v)) limpio[k] = v;
    });
    return limpio;
  }
  return obj;
}

function auroSerializar(marker, obj){
  const limpio = auroCompactarObjeto(obj || {});
  if(!auroTieneValor(limpio)) return '';
  return marker + JSON.stringify(limpio);
}

function auroParsear(marker, valor){
  const texto = String(valor || '').trim();
  if(!texto.startsWith(marker)) return null;
  try{
    return JSON.parse(texto.substring(marker.length));
  }catch(error){
    console.warn('No se pudo parsear antecedente AUROSANAX:', error);
    return null;
  }
}

function recopilarAntecedenteCovidEstructurado(){
  return auroCompactarObjeto({
    presento: auroGet('hcCovidPresento'),
    observacion_presento: auroGet('hcCovidObservacionPresento'),
    fecha: auroGet('hcCovidFecha'),
    anio_referencia: auroGet('hcCovidAnioReferencia'),
    clasificacion: auroGet('hcCovidClasificacion'),
    detalle_clasificacion: auroGet('hcCovidDetalleClasificacion'),
    hospitalizacion: auroGet('hcCovidHospitalizacion'),
    tiempo_hospitalizado: auroGet('hcCovidTiempoHospitalizado'),
    vacunado: auroGet('hcCovidVacunado'),
    vacuna_tipo: auroGet('hcCovidVacunaTipo'),
    dosis: [
      { numero: '1', fecha: auroGet('hcCovidDosis1'), detalle: auroGet('hcCovidDosis1Detalle') },
      { numero: '2', fecha: auroGet('hcCovidDosis2'), detalle: auroGet('hcCovidDosis2Detalle') },
      { numero: '3', fecha: auroGet('hcCovidDosis3'), detalle: auroGet('hcCovidDosis3Detalle') },
      { numero: '4', fecha: auroGet('hcCovidDosis4'), detalle: auroGet('hcCovidDosis4Detalle') }
    ],
    observaciones: auroGet('hcCovidObservaciones')
  });
}

function cargarAntecedenteCovidEstructurado(data){
  const d = data || {};
  auroSet('hcCovidPresento', d.presento);
  auroSet('hcCovidObservacionPresento', d.observacion_presento);
  auroSet('hcCovidFecha', d.fecha);
  auroSet('hcCovidAnioReferencia', d.anio_referencia);
  auroSet('hcCovidClasificacion', d.clasificacion);
  auroSet('hcCovidDetalleClasificacion', d.detalle_clasificacion);
  auroSet('hcCovidHospitalizacion', d.hospitalizacion);
  auroSet('hcCovidTiempoHospitalizado', d.tiempo_hospitalizado);
  auroSet('hcCovidVacunado', d.vacunado);
  auroSet('hcCovidVacunaTipo', d.vacuna_tipo);
  (d.dosis || []).forEach(item => {
    const n = item.numero || '';
    auroSet('hcCovidDosis' + n, item.fecha);
    auroSet('hcCovidDosis' + n + 'Detalle', item.detalle);
  });
  auroSet('hcCovidObservaciones', d.observaciones);
}

function recopilarVacunasEstructuradas(){
  const vacunas = [
    { key:'Covid', biologico:'COVID-19', dosis:4 },
    { key:'Hpv', biologico:'Virus Papiloma Humano (HPV)', dosis:3 },
    { key:'HepB', biologico:'Hepatitis B', dosis:3 },
    { key:'Influenza', biologico:'Influenza', dosis:2 },
    { key:'Tdpa', biologico:'Td/Tdap', dosis:2 },
    { key:'Neumococo', biologico:'Neumococo', dosis:2 },
    { key:'Srp', biologico:'SRP', dosis:2 },
    { key:'Varicela', biologico:'Varicela', dosis:2 },
    { key:'FiebreAmarilla', biologico:'Fiebre amarilla', dosis:1 }
  ];

  return vacunas.map(v => {
    const dosis = [];
    for(let i = 1; i <= v.dosis; i++){
      dosis.push({
        numero: String(i),
        programada: auroGet('hcVac' + v.key + 'Prog' + i),
        administracion: auroGet('hcVac' + v.key + 'Adm' + i),
        aplicada: auroGetCheck('hcVac' + v.key + 'Apl' + i),
        observacion: auroGet('hcVac' + v.key + 'Obs' + i)
      });
    }
    return auroCompactarObjeto({
      key: v.key,
      biologico: v.biologico,
      nombre_comercial: auroGet('hcVac' + v.key + 'Nombre'),
      dosis: dosis
    });
  }).filter(auroTieneValor);
}

function cargarVacunasEstructuradas(lista){
  (lista || []).forEach(v => {
    const key = v.key || '';
    if(!key) return;
    auroSet('hcVac' + key + 'Nombre', v.nombre_comercial);
    (v.dosis || []).forEach(d => {
      const n = d.numero || '';
      auroSet('hcVac' + key + 'Prog' + n, d.programada);
      auroSet('hcVac' + key + 'Adm' + n, d.administracion);
      auroSetCheck('hcVac' + key + 'Apl' + n, d.aplicada);
      auroSet('hcVac' + key + 'Obs' + n, d.observacion);
    });
  });
}

function recopilarHabitosEstructurados(){
  const habitos = [
    { key:'Tabaco', nombre:'Tabaco' },
    { key:'Alcohol', nombre:'Alcohol' },
    { key:'Drogas', nombre:'Drogas' },
    { key:'Cafe', nombre:'Café' },
    { key:'Biomasa', nombre:'Biomasa' }
  ];

  return habitos.map(h => auroCompactarObjeto({
    habito: h.nombre,
    actual: auroGetRadio('hcHabito' + h.key + 'Ex'),
    tiempo: auroGet('hcHabito' + h.key + 'Tiempo'),
    abstinencia: auroGet('hcHabito' + h.key + 'Abstinencia')
  })).filter(auroTieneValor);
}

function cargarHabitosEstructurados(lista){
  (lista || []).forEach(h => {
    const mapa = { 'Tabaco':'Tabaco', 'Alcohol':'Alcohol', 'Drogas':'Drogas', 'Café':'Cafe', 'Cafe':'Cafe', 'Biomasa':'Biomasa' };
    const key = mapa[h.habito] || h.key || '';
    if(!key) return;
    auroSetRadio('hcHabito' + key + 'Ex', h.actual);
    auroSet('hcHabito' + key + 'Tiempo', h.tiempo);
    auroSet('hcHabito' + key + 'Abstinencia', h.abstinencia);
  });
}

function recopilarEstiloVidaEstructurado(){
  const actividades = [
    { key:'Correr', actividad:'Correr' },
    { key:'Caminar', actividad:'Caminar' },
    { key:'Nadar', actividad:'Nadar' },
    { key:'Ciclismo', actividad:'Ciclismo' },
    { key:'Otro', actividad: auroGet('hcEstiloOtroDescripcion') || 'Otros' }
  ];

  return actividades.map(a => auroCompactarObjeto({
    key: a.key,
    actividad: a.actividad,
    distancia_km: auroGet('hcEstilo' + a.key + 'Distancia'),
    frecuencia_dia: auroGet('hcEstilo' + a.key + 'Frecuencia'),
    tiempo_horas: auroGet('hcEstilo' + a.key + 'Tiempo')
  })).filter(auroTieneValor);
}

function cargarEstiloVidaEstructurado(lista){
  (lista || []).forEach(a => {
    const key = a.key || '';
    if(!key) return;
    if(key === 'Otro') auroSet('hcEstiloOtroDescripcion', a.actividad && a.actividad !== 'Otros' ? a.actividad : '');
    auroSet('hcEstilo' + key + 'Distancia', a.distancia_km);
    auroSet('hcEstilo' + key + 'Frecuencia', a.frecuencia_dia);
    auroSet('hcEstilo' + key + 'Tiempo', a.tiempo_horas);
  });
}

function recopilarAlimentacionEstructurada(){
  return auroCompactarObjeto({
    agua_diaria_litros: auroGet('hcAlimentacionAguaDiaria'),
    comidas_dia: auroGet('hcAlimentacionComidasDia'),
    frutas_verduras: auroGet('hcAlimentacionFrutasVerduras'),
    comida_rapida: auroGet('hcAlimentacionComidaRapida'),
    azucar: auroGet('hcAlimentacionAzucar'),
    sal: auroGet('hcAlimentacionSal'),
    suplementos: auroGet('hcAlimentacionSuplementos'),
    detalle: auroGet('hcAlimentacion')
  });
}

function cargarAlimentacionEstructurada(data){
  const d = data || {};
  auroSet('hcAlimentacionAguaDiaria', d.agua_diaria_litros);
  auroSet('hcAlimentacionComidasDia', d.comidas_dia);
  auroSet('hcAlimentacionFrutasVerduras', d.frutas_verduras);
  auroSet('hcAlimentacionComidaRapida', d.comida_rapida);
  auroSet('hcAlimentacionAzucar', d.azucar);
  auroSet('hcAlimentacionSal', d.sal);
  auroSet('hcAlimentacionSuplementos', d.suplementos);
  auroSet('hcAlimentacion', d.detalle);
}

function recopilarAntecedentesObstetricosEstructurados(){
  const campos = [
    { key:'Pap', descripcion:'Fecha del último Papanicolaou (PAP)', detalle:'Fecha' },
    { key:'Fum', descripcion:'Fecha de la última menstruación (FUM)', detalle:'Fecha' },
    { key:'Fup', descripcion:'Fecha del último parto (FUP)', detalle:'Fecha' },
    { key:'Gesta', descripcion:'Gesta #', detalle:'Detalle' },
    { key:'Partos', descripcion:'Partos #', detalle:'Detalle' },
    { key:'Cesareas', descripcion:'Cesáreas #', detalle:'Detalle' },
    { key:'Abortos', descripcion:'Abortos #', detalle:'Detalle' },
    { key:'HijosVivos', descripcion:'Hijos vivos #', detalle:'Detalle' },
    { key:'HijosMuertos', descripcion:'Hijos muertos #', detalle:'Detalle' },
    { key:'Lactancia', descripcion:'Lactancia', detalle:'Detalle' },
    { key:'Ectopicos', descripcion:'Ectópicos #', detalle:'Detalle' },
    { key:'Otros', descripcion:'Otros', detalle:'Detalle' }
  ];

  return campos.map(c => {
    const detalleId = c.key === 'Pap' || c.key === 'Fum' || c.key === 'Fup'
      ? 'hcObs' + c.key + 'Fecha'
      : 'hcObs' + c.key + 'Detalle';
    return auroCompactarObjeto({
      key: c.key,
      descripcion: c.descripcion,
      detalle: auroGet(detalleId),
      no_aplica: auroGetCheck('hcObs' + c.key + 'NoAplica'),
      resultado: auroGet('hcObs' + c.key + 'Resultado')
    });
  }).filter(auroTieneValor);
}

function cargarAntecedentesObstetricosEstructurados(lista){
  (lista || []).forEach(c => {
    const key = c.key || '';
    if(!key) return;
    const detalleId = key === 'Pap' || key === 'Fum' || key === 'Fup'
      ? 'hcObs' + key + 'Fecha'
      : 'hcObs' + key + 'Detalle';
    auroSet(detalleId, c.detalle);
    auroSetCheck('hcObs' + key + 'NoAplica', c.no_aplica);
    auroSet('hcObs' + key + 'Resultado', c.resultado);
  });
}

function recopilarAntecedentesGinecologicosEstructurados(){
  return auroCompactarObjeto({
    menarquia: { detalle: auroGet('hcGinMenarquia'), resultado: auroGet('hcGinMenarquiaResultado') },
    menacme: { detalle: auroGet('hcGinMenacme'), resultado: auroGet('hcGinMenacmeResultado') },
    menopausia: { detalle: auroGet('hcGinMenopausia'), resultado: auroGet('hcGinMenopausiaResultado') },
    vida_sexual_activa: { detalle: auroGetRadio('hcGinVidaSexualActiva'), resultado: auroGet('hcGinVidaSexualResultado') },
    planificacion_familiar: { detalle: auroGet('hcGinPlanificacionFamiliar'), resultado: auroGet('hcGinPlanificacionResultado') },
    terapia_hormonal: { detalle: auroGet('hcGinTerapiaHormonal'), resultado: auroGet('hcGinTerapiaResultado') },
    infecciones_vulvovaginales: { detalle: auroGet('hcGinInfeccionesVulvovaginales'), resultado: auroGet('hcGinInfeccionesResultado') },
    ets: { detalle: auroGet('hcGinETS'), resultado: auroGet('hcGinETSResultado') },
    mamografia: { fecha: auroGet('hcGinMamografiaFecha'), resultado: auroGet('hcGinMamografiaResultado') },
    eco_mamario: { fecha: auroGet('hcGinEcoMamarioFecha'), resultado: auroGet('hcGinEcoMamarioResultado') },
    densitometria_osea: { fecha: auroGet('hcGinDensitometriaFecha'), resultado: auroGet('hcGinDensitometriaResultado') },
    colposcopia: { fecha: auroGet('hcGinColposcopiaFecha'), resultado: auroGet('hcGinColposcopiaResultado') }
  });
}

function cargarAntecedentesGinecologicosEstructurados(data){
  const d = data || {};
  auroSet('hcGinMenarquia', d.menarquia?.detalle);
  auroSet('hcGinMenarquiaResultado', d.menarquia?.resultado);
  auroSet('hcGinMenacme', d.menacme?.detalle);
  auroSet('hcGinMenacmeResultado', d.menacme?.resultado);
  auroSet('hcGinMenopausia', d.menopausia?.detalle);
  auroSet('hcGinMenopausiaResultado', d.menopausia?.resultado);
  auroSetRadio('hcGinVidaSexualActiva', d.vida_sexual_activa?.detalle);
  auroSet('hcGinVidaSexualResultado', d.vida_sexual_activa?.resultado);
  auroSet('hcGinPlanificacionFamiliar', d.planificacion_familiar?.detalle);
  auroSet('hcGinPlanificacionResultado', d.planificacion_familiar?.resultado);
  auroSet('hcGinTerapiaHormonal', d.terapia_hormonal?.detalle);
  auroSet('hcGinTerapiaResultado', d.terapia_hormonal?.resultado);
  auroSet('hcGinInfeccionesVulvovaginales', d.infecciones_vulvovaginales?.detalle);
  auroSet('hcGinInfeccionesResultado', d.infecciones_vulvovaginales?.resultado);
  auroSet('hcGinETS', d.ets?.detalle);
  auroSet('hcGinETSResultado', d.ets?.resultado);
  auroSet('hcGinMamografiaFecha', d.mamografia?.fecha);
  auroSet('hcGinMamografiaResultado', d.mamografia?.resultado);
  auroSet('hcGinEcoMamarioFecha', d.eco_mamario?.fecha);
  auroSet('hcGinEcoMamarioResultado', d.eco_mamario?.resultado);
  auroSet('hcGinDensitometriaFecha', d.densitometria_osea?.fecha);
  auroSet('hcGinDensitometriaResultado', d.densitometria_osea?.resultado);
  auroSet('hcGinColposcopiaFecha', d.colposcopia?.fecha);
  auroSet('hcGinColposcopiaResultado', d.colposcopia?.resultado);
}

function recopilarAntecedentesPersonalesCompletos(){
  const patologicos = recopilarAntecedentesPersonalesEstructurados();

  const data = {
    patologicos: patologicos,
    covid: recopilarAntecedenteCovidEstructurado(),
    vacunas: recopilarVacunasEstructuradas(),
    habitos: recopilarHabitosEstructurados(),
    estilo_vida: recopilarEstiloVidaEstructurado(),
    alimentacion: recopilarAlimentacionEstructurada()
  };

  return auroSerializar(AURO_ANT_PERSONALES_MARKER, data) || patologicos;
}

function cargarAntecedentesPersonalesCompletos(valor){
  const data = auroParsear(AURO_ANT_PERSONALES_MARKER, valor);

  if(!data){
    cargarAntecedentesPersonalesEstructurados(valor || '');
    return;
  }

  cargarAntecedentesPersonalesEstructurados(data.patologicos || '');
  cargarAntecedenteCovidEstructurado(data.covid || {});
  cargarVacunasEstructuradas(data.vacunas || []);
  cargarHabitosEstructurados(data.habitos || []);
  cargarEstiloVidaEstructurado(data.estilo_vida || []);
  cargarAlimentacionEstructurada(data.alimentacion || {});
}

function recopilarAntecedentesGinecoObstetricosCompletos(){
  const data = {
    obstetricos: recopilarAntecedentesObstetricosEstructurados(),
    ginecologicos: recopilarAntecedentesGinecologicosEstructurados()
  };

  return auroSerializar(AURO_ANT_GINECO_OBS_MARKER, data) || getValueIfExists('hcRevisionSistemas');
}

function cargarAntecedentesGinecoObstetricosCompletos(valor){
  const data = auroParsear(AURO_ANT_GINECO_OBS_MARKER, valor);

  if(!data){
    // Compatibilidad v2.2: si viene texto antiguo desde Google Sheets,
    // se conserva visible sin intentar convertirlo a campos nuevos.
    setValueIfExists('hcRevisionSistemas', valor || '');
    return;
  }

  cargarAntecedentesObstetricosEstructurados(data.obstetricos || []);
  cargarAntecedentesGinecologicosEstructurados(data.ginecologicos || {});
}

function actualizarResumenAntecedentesCompletos(){
  const alergias = recopilarAlergiasEstructuradas();
  if(document.getElementById('hcAlergiasResumen')){
    document.getElementById('hcAlergiasResumen').textContent = alergias ? (alergias.length > 18 ? alergias.slice(0,18) + '...' : alergias) : 'No registradas';
  }
  updateClinicalSummary();
}



/* ==========================================================
   AUROSANAX - ANTECEDENTES v2.1
   Ayudas clínicas de llenado rápido sin cambiar estructura.
   No modifica Code.gs ni columnas. Todo sigue guardando en
   las columnas existentes de historias_clinicas.
   ========================================================== */

const AURO_ANT_V21 = {
  patologiasMedicamentos: {
    'Hipertensión arterial (HTA)': ['Losartán 50 mg', 'Enalapril 10 mg', 'Amlodipino 5 mg', 'Hidroclorotiazida 25 mg', 'Valsartán', 'Candesartán'],
    'Infarto agudo de miocardio (IAM)': ['Ácido acetilsalicílico', 'Atorvastatina', 'Clopidogrel', 'Bisoprolol', 'Enalapril', 'Losartán'],
    'Diabetes mellitus (DM)': ['Metformina 850 mg', 'Insulina', 'Glibenclamida', 'Empagliflozina', 'Dapagliflozina', 'Sitagliptina'],
    'Asma bronquial': ['Salbutamol inhalador', 'Budesonida inhalada', 'Fluticasona inhalada', 'Montelukast', 'Formoterol/budesonida'],
    'Gastritis': ['Omeprazol', 'Esomeprazol', 'Pantoprazol', 'Sucralfato', 'Antiácido según necesidad'],
    'Hipotiroidismo': ['Levotiroxina 25 mcg', 'Levotiroxina 50 mcg', 'Levotiroxina 75 mcg', 'Levotiroxina 100 mcg'],
    'Obesidad': ['Manejo nutricional', 'Actividad física', 'Control metabólico', 'Tratamiento médico según valoración'],
    'Osteoporosis': ['Calcio + vitamina D', 'Alendronato', 'Ibandronato', 'Denosumab', 'Vitamina D']
  },
  medicamentosGenerales: [
    'Losartán 50 mg','Enalapril 10 mg','Amlodipino 5 mg','Hidroclorotiazida 25 mg','Metformina 850 mg','Insulina',
    'Levotiroxina 50 mcg','Omeprazol 20 mg','Pantoprazol 40 mg','Salbutamol inhalador','Budesonida inhalada',
    'Atorvastatina 20 mg','Ácido acetilsalicílico 100 mg','Calcio + vitamina D','Ácido fólico','Hierro','Vitamina D',
    'Anticonceptivo oral combinado','Progesterona','Manejo nutricional','No usa medicación actual','No recuerda nombre'
  ],
  reaccionesAlergia: [
    'Urticaria','Rash cutáneo','Prurito','Edema','Angioedema','Dificultad respiratoria','Anafilaxia referida',
    'Náusea / vómito','Mareo','Intolerancia gastrointestinal','Reacción no especificada','No recuerda reacción'
  ],
  alergiasRapidas: [
    'Penicilina','Amoxicilina','Cefalosporinas','AINES','Ibuprofeno','Diclofenaco','Aspirina','Sulfas',
    'Yodo / contraste','Látex','Anestésicos','Lácteos','Mariscos','Cítricos','Polen','Ácaros'
  ],
  cirugiasRapidas: [
    'Cesárea','Legrado uterino','Histerectomía','Miomectomía','Ooforectomía','Salpingectomía','Laparoscopía',
    'Apendicectomía','Colecistectomía','Hernioplastia','Cirugía estética','Biopsia mamaria','Conización cervical'
  ],
  vacunasNombres: {
    Covid: ['Pfizer / Comirnaty','Moderna / Spikevax','AstraZeneca','Sinovac','CanSino','No recuerda marca'],
    Hpv: ['Gardasil','Gardasil 9','Cervarix','No recuerda marca'],
    HepB: ['Engerix-B','Euvax-B','No recuerda marca'],
    Influenza: ['Influenza estacional','Influenza tetravalente','No recuerda marca'],
    Tdpa: ['Td','Tdap','dTpa','No recuerda marca'],
    Neumococo: ['Neumococo 13-valente','Neumococo 23-valente','No recuerda marca'],
    Srp: ['SRP / triple viral','No recuerda marca'],
    Varicela: ['Varicela','No recuerda marca'],
    FiebreAmarilla: ['Fiebre amarilla','No recuerda marca']
  }
};

function auroV21CrearDatalist(id, opciones){
  if(document.getElementById(id)) return;
  const dl = document.createElement('datalist');
  dl.id = id;
  (opciones || []).forEach(op => {
    const option = document.createElement('option');
    option.value = op;
    dl.appendChild(option);
  });
  document.body.appendChild(dl);
}

function auroV21NormalizarCantidadUnidad(valor, unidadDefault){
  const raw = String(valor || '').trim();
  const unidad = String(unidadDefault || '').trim();

  if(!raw && ['desde infancia','desde nacimiento','no recuerda','no aplica'].includes(unidad.toLowerCase())){
    return unidad;
  }

  if(!raw) return '';

  const lower = raw.toLowerCase();
  if(/(día|dias|días|semana|mes|meses|año|años|infancia|nacimiento|recuerda|aplica|desde|hace)/i.test(raw)){
    return raw;
  }

  if(/^\d+([.,]\d+)?$/.test(raw) && unidad && !['seleccione',''].includes(unidad.toLowerCase())){
    return raw.replace(',', '.') + ' ' + unidad;
  }

  return raw;
}

function auroV21NormalizarFechaQuirurgica(valor){
  const raw = String(valor || '').trim();
  if(!raw) return '';
  if(/^\d{4}$/.test(raw)) return 'Año: ' + raw;
  if(/^\d{1,2}$/.test(raw)) return 'Hace ' + raw + ' años';
  return raw;
}

function auroV21NormalizarUnidadSimple(valor, unidad){
  const raw = String(valor || '').trim();
  if(!raw) return '';
  if(/[a-záéíóúñ/]/i.test(raw)) return raw;
  return raw + ' ' + unidad;
}

function auroV21SetDatalist(input, datalistId){
  if(!input) return;
  input.setAttribute('list', datalistId);
  input.setAttribute('autocomplete', 'off');
}

function auroV21WrapTiempoInput(input, unidades, unidadInicial){
  if(!input || input.dataset.auroV21UnitReady === '1') return;
  input.dataset.auroV21UnitReady = '1';

  const wrap = document.createElement('div');
  wrap.className = 'auro-v21-unit-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const select = document.createElement('select');
  select.className = 'form-select auro-v21-unit-select';
  select.setAttribute('aria-label', 'Unidad de tiempo');
  (unidades || ['días','semanas','meses','años','desde infancia','desde nacimiento','no recuerda','no aplica']).forEach(u => {
    const op = document.createElement('option');
    op.value = u;
    op.textContent = u;
    if(u === unidadInicial) op.selected = true;
    select.appendChild(op);
  });
  wrap.appendChild(select);

  input.addEventListener('blur', () => {
    const normalizado = auroV21NormalizarCantidadUnidad(input.value, select.value);
    if(normalizado) input.value = normalizado;
  });
}

function auroV21GetUnidadDeInput(input){
  const wrap = input?.closest('.auro-v21-unit-wrap');
  return wrap?.querySelector('.auro-v21-unit-select')?.value || '';
}

function auroV21AutoCheckPorInput(input, checkSelector, dataName){
  if(!input) return;
  input.addEventListener('input', () => {
    const key = input.dataset[dataName] || '';
    if(!key) return;
    const chk = document.querySelector(`${checkSelector}[data-${dataName.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${CSS.escape(key)}"]`);
    if(chk && input.value.trim()) chk.checked = true;
  });
}

function auroV21AplicarMedicamentosPorPatologia(chk){
  const patologia = chk?.dataset?.patologia || '';
  const medInput = document.querySelector(`.hcPatologicoMedicamento[data-patologia="${CSS.escape(patologia)}"]`);
  const opciones = AURO_ANT_V21.patologiasMedicamentos[patologia] || AURO_ANT_V21.medicamentosGenerales;
  const id = 'auroV21Med_' + btoa(unescape(encodeURIComponent(patologia))).replace(/=/g,'');
  auroV21CrearDatalist(id, opciones);
  auroV21SetDatalist(medInput, id);
  if(chk.checked && medInput && !medInput.value && opciones.length){
    medInput.placeholder = 'Sugerencias: ' + opciones.slice(0, 3).join(', ');
  }
}

function auroV21AgregarBoton(texto, icono, onClick){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-soft auro-v21-helper-btn';
  btn.innerHTML = `<i class="bi ${icono} me-1"></i>${texto}`;
  btn.addEventListener('click', onClick);
  return btn;
}

function auroV21InsertarPanelAyudas(){
  const panel = document.getElementById('hc_antecedentes');
  if(!panel || document.getElementById('auroV21AntecedentesHelp')) return;

  const box = document.createElement('div');
  box.id = 'auroV21AntecedentesHelp';
  box.className = 'auro-v21-help-box';
  box.innerHTML = `
    <div>
      <b><i class="bi bi-magic me-1"></i>Ayudas clínicas de llenado rápido</b>
      <small>Opciones editables. No reemplazan el criterio médico.</small>
    </div>
    <div class="auro-v21-help-actions"></div>
  `;

  const actions = box.querySelector('.auro-v21-help-actions');

  actions.appendChild(auroV21AgregarBoton('Niega patológicos', 'bi-check2-circle', () => {
    panel.dataset.auroNiegaPatologicos = '1';
    document.querySelectorAll('.hcPatologicoCheck').forEach(chk => chk.checked = false);
    document.querySelectorAll('.hcPatologicoTiempo,.hcPatologicoMedicamento').forEach(i => i.value = '');
    alert('Se registrará: Niega antecedentes patológicos personales relevantes.');
  }));

  actions.appendChild(auroV21AgregarBoton('Niega quirúrgicos', 'bi-check2-circle', () => {
    panel.dataset.auroNiegaQuirurgicos = '1';
    document.querySelectorAll('.hcQuirurgicoCheck').forEach(chk => chk.checked = false);
    document.querySelectorAll('.hcQuirurgicoFecha,.hcQuirurgicoOtroNombre').forEach(i => i.value = '');
    alert('Se registrará: Niega antecedentes quirúrgicos.');
  }));

  actions.appendChild(auroV21AgregarBoton('Niega alergias', 'bi-shield-check', () => {
    panel.dataset.auroNiegaAlergias = '1';
    document.querySelectorAll('.hcAlergiaCheck').forEach(chk => chk.checked = false);
    document.querySelectorAll('.hcAlergiaDetalle').forEach(i => i.value = '');
    if(document.getElementById('hcAlergiasResumen')) document.getElementById('hcAlergiasResumen').textContent = 'Niega alergias';
    alert('Se registrará: Niega alergias conocidas.');
  }));

  actions.appendChild(auroV21AgregarBoton('Sin medicación actual', 'bi-capsule', () => {
    const el = document.getElementById('hcMedicacionActual');
    if(el) el.value = 'No usa medicación actual según refiere.';
  }));

  actions.appendChild(auroV21AgregarBoton('Vacunas al día según refiere', 'bi-shield-plus', () => {
    ['Covid','Hpv','HepB','Influenza','Tdpa'].forEach(key => {
      const nombre = document.getElementById('hcVac' + key + 'Nombre');
      if(nombre && !nombre.value) nombre.value = key === 'Hpv' ? 'HPV / no recuerda marca' : 'No recuerda marca';
      for(let i=1;i<=4;i++){
        const apl = document.getElementById('hcVac' + key + 'Apl' + i);
        const obs = document.getElementById('hcVac' + key + 'Obs' + i);
        if(apl) apl.checked = true;
        if(obs && !obs.value) obs.value = 'Al día según refiere';
      }
    });
  }));

  actions.appendChild(auroV21AgregarBoton('Hábitos sin consumo nocivo', 'bi-heart', () => {
    ['Tabaco','Alcohol','Drogas','Cafe','Biomasa'].forEach(key => {
      const no = document.querySelector(`input[name="hcHabito${key}Ex"][value="No"]`);
      if(no) no.checked = true;
      const tiempo = document.getElementById('hcHabito' + key + 'Tiempo');
      const abst = document.getElementById('hcHabito' + key + 'Abstinencia');
      if(tiempo) tiempo.value = 'No aplica';
      if(abst) abst.value = 'No aplica';
    });
  }));

  const firstSubtitle = panel.querySelector('.clinical-subtitle');
  if(firstSubtitle) firstSubtitle.insertAdjacentElement('afterend', box);
}

function auroV21InicializarAyudasAntecedentes(){
  auroV21CrearDatalist('auroV21MedicamentosGenerales', AURO_ANT_V21.medicamentosGenerales);
  auroV21CrearDatalist('auroV21ReaccionesAlergia', AURO_ANT_V21.reaccionesAlergia);
  auroV21CrearDatalist('auroV21AlergiasRapidas', AURO_ANT_V21.alergiasRapidas);
  auroV21CrearDatalist('auroV21CirugiasRapidas', AURO_ANT_V21.cirugiasRapidas);

  auroV21InsertarPanelAyudas();

  document.querySelectorAll('.hcPatologicoTiempo').forEach(input => {
    auroV21WrapTiempoInput(input, ['días','semanas','meses','años','desde infancia','desde nacimiento','no recuerda','no aplica'], 'años');
  });

  document.querySelectorAll('.hcPatologicoMedicamento').forEach(input => {
    const patologia = input.dataset.patologia || '';
    const opciones = AURO_ANT_V21.patologiasMedicamentos[patologia] || AURO_ANT_V21.medicamentosGenerales;
    const id = 'auroV21Med_' + btoa(unescape(encodeURIComponent(patologia))).replace(/=/g,'');
    auroV21CrearDatalist(id, opciones);
    auroV21SetDatalist(input, id);
    input.addEventListener('input', () => {
      const chk = document.querySelector(`.hcPatologicoCheck[data-patologia="${CSS.escape(patologia)}"]`);
      if(chk && input.value.trim()) chk.checked = true;
      const panel = document.getElementById('hc_antecedentes');
      if(panel) delete panel.dataset.auroNiegaPatologicos;
    });
  });

  document.querySelectorAll('.hcPatologicoCheck').forEach(chk => {
    chk.addEventListener('change', () => {
      auroV21AplicarMedicamentosPorPatologia(chk);
      const panel = document.getElementById('hc_antecedentes');
      if(panel && chk.checked) delete panel.dataset.auroNiegaPatologicos;
    });
    auroV21AplicarMedicamentosPorPatologia(chk);
  });

  document.querySelectorAll('.hcQuirurgicoFecha').forEach(input => {
    input.addEventListener('blur', () => {
      input.value = auroV21NormalizarFechaQuirurgica(input.value);
    });
    input.addEventListener('input', () => {
      const cirugia = input.dataset.cirugia || '';
      const chk = document.querySelector(`.hcQuirurgicoCheck[data-cirugia="${CSS.escape(cirugia)}"]`);
      if(chk && input.value.trim()) chk.checked = true;
      const panel = document.getElementById('hc_antecedentes');
      if(panel) delete panel.dataset.auroNiegaQuirurgicos;
    });
  });

  const otroCirugia = document.querySelector('.hcQuirurgicoOtroNombre');
  auroV21SetDatalist(otroCirugia, 'auroV21CirugiasRapidas');
  if(otroCirugia){
    otroCirugia.addEventListener('input', () => {
      const chk = document.querySelector('.hcQuirurgicoCheck[data-cirugia="Otros"]');
      if(chk && otroCirugia.value.trim()) chk.checked = true;
      const panel = document.getElementById('hc_antecedentes');
      if(panel) delete panel.dataset.auroNiegaQuirurgicos;
    });
  }

  document.querySelectorAll('.hcAlergiaDetalle').forEach(input => {
    auroV21SetDatalist(input, 'auroV21ReaccionesAlergia');
    input.addEventListener('input', () => {
      const alergia = input.dataset.alergia || '';
      const chk = document.querySelector(`.hcAlergiaCheck[data-alergia="${CSS.escape(alergia)}"]`);
      if(chk && input.value.trim()) chk.checked = true;
      const panel = document.getElementById('hc_antecedentes');
      if(panel) delete panel.dataset.auroNiegaAlergias;
    });
  });

  document.querySelectorAll('.hcAlergiaCheck').forEach(chk => {
    chk.addEventListener('change', () => {
      const panel = document.getElementById('hc_antecedentes');
      if(panel && chk.checked) delete panel.dataset.auroNiegaAlergias;
    });
  });

  document.querySelectorAll('[id^="hcVac"][id$="Nombre"]').forEach(input => {
    const key = input.id.replace(/^hcVac/, '').replace(/Nombre$/, '');
    const opciones = AURO_ANT_V21.vacunasNombres[key] || ['No recuerda marca'];
    const id = 'auroV21Vacuna' + key;
    auroV21CrearDatalist(id, opciones);
    auroV21SetDatalist(input, id);
  });

  const covidTipo = document.getElementById('hcCovidVacunaTipo');
  auroV21CrearDatalist('auroV21CovidVacunas', AURO_ANT_V21.vacunasNombres.Covid);
  auroV21SetDatalist(covidTipo, 'auroV21CovidVacunas');

  ['hcCovidTiempoHospitalizado'].forEach(id => {
    const input = document.getElementById(id);
    if(input) auroV21WrapTiempoInput(input, ['días','semanas','meses','no recuerda','no aplica'], 'días');
  });

  const agua = document.getElementById('hcAlimentacionAguaDiaria');
  if(agua){
    agua.addEventListener('blur', () => { agua.value = auroV21NormalizarUnidadSimple(agua.value, 'litros/día'); });
  }
  const comidas = document.getElementById('hcAlimentacionComidasDia');
  if(comidas){
    comidas.addEventListener('blur', () => { comidas.value = auroV21NormalizarUnidadSimple(comidas.value, 'comidas/día'); });
  }

  document.querySelectorAll('[id^="hcEstilo"][id$="Distancia"]').forEach(input => {
    input.addEventListener('blur', () => { input.value = auroV21NormalizarUnidadSimple(input.value, 'km'); });
  });
  document.querySelectorAll('[id^="hcEstilo"][id$="Frecuencia"]').forEach(input => {
    input.addEventListener('blur', () => { input.value = auroV21NormalizarUnidadSimple(input.value, 'veces/semana'); });
  });
  document.querySelectorAll('[id^="hcEstilo"][id$="Tiempo"]').forEach(input => {
    input.addEventListener('blur', () => { input.value = auroV21NormalizarUnidadSimple(input.value, 'horas'); });
  });

  document.querySelectorAll('.clinical-note').forEach(note => {
    if(/Sección visual|no modifica Google Sheets|fase no modifica/i.test(note.textContent || '')){
      note.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Sección conectada a Historia Clínica. Se guarda en Google Sheets dentro de antecedentes estructurados.';
    }
  });
}

/* Redefinición no destructiva: conserva el formato anterior, pero añade unidades flexibles y botones rápidos. */
function recopilarAntecedentesPersonalesEstructurados(){
  const filas = [];
  const panel = document.getElementById('hc_antecedentes');

  document.querySelectorAll('.hcPatologicoCheck').forEach(chk => {
    const patologia = chk.dataset.patologia || '';
    const tiempoInput = document.querySelector(`.hcPatologicoTiempo[data-patologia="${CSS.escape(patologia)}"]`);
    let tiempo = tiempoInput?.value?.trim() || '';
    tiempo = auroV21NormalizarCantidadUnidad(tiempo, auroV21GetUnidadDeInput(tiempoInput));
    if(tiempoInput && tiempo) tiempoInput.value = tiempo;

    const medicamento = document.querySelector(`.hcPatologicoMedicamento[data-patologia="${CSS.escape(patologia)}"]`)?.value?.trim() || '';

    if(chk.checked || tiempo || medicamento){
      filas.push([patologia, tiempo, medicamento].filter(Boolean).join(' | '));
    }
  });

  if(!filas.length && panel?.dataset?.auroNiegaPatologicos === '1'){
    filas.push('Niega antecedentes patológicos personales relevantes');
  }

  const valor = filas.join('; ');
  const hidden = document.getElementById('hcAntecedentesPersonales');
  if(hidden) hidden.value = valor;
  return valor;
}

function recopilarAntecedentesQuirurgicosEstructurados(){
  const filas = [];
  const panel = document.getElementById('hc_antecedentes');

  document.querySelectorAll('.hcQuirurgicoCheck').forEach(chk => {
    const cirugiaBase = chk.dataset.cirugia || '';
    const fechaInput = document.querySelector(`.hcQuirurgicoFecha[data-cirugia="${CSS.escape(cirugiaBase)}"]`);
    let fecha = auroV21NormalizarFechaQuirurgica(fechaInput?.value?.trim() || '');
    if(fechaInput && fecha) fechaInput.value = fecha;

    let cirugia = cirugiaBase;
    if(cirugiaBase === 'Otros'){
      const otroNombre = document.querySelector('.hcQuirurgicoOtroNombre')?.value?.trim() || '';
      if(otroNombre) cirugia = 'Otros: ' + otroNombre;
    }

    if(chk.checked || fecha || (cirugiaBase === 'Otros' && cirugia !== 'Otros')){
      filas.push([cirugia, fecha].filter(Boolean).join(' | '));
    }
  });

  if(!filas.length && panel?.dataset?.auroNiegaQuirurgicos === '1'){
    filas.push('Niega antecedentes quirúrgicos');
  }

  const valor = filas.join('; ');
  const hidden = document.getElementById('hcAntecedentesQuirurgicos');
  if(hidden) hidden.value = valor;
  return valor;
}

function recopilarAlergiasEstructuradas(){
  const filas = [];
  const panel = document.getElementById('hc_antecedentes');

  document.querySelectorAll('.hcAlergiaCheck').forEach(chk => {
    const alergia = chk.dataset.alergia || '';
    const detalle = document.querySelector(`.hcAlergiaDetalle[data-alergia="${CSS.escape(alergia)}"]`)?.value?.trim() || '';

    if(chk.checked || detalle){
      filas.push([alergia, detalle].filter(Boolean).join(' | '));
    }
  });

  if(!filas.length && panel?.dataset?.auroNiegaAlergias === '1'){
    filas.push('Niega alergias conocidas');
  }

  const valor = filas.join('; ');
  const hidden = document.getElementById('hcAlergias');
  if(hidden) hidden.value = valor;
  return valor;
}

/* Mejora de serialización: normaliza unidades antes de guardar. */
function recopilarHabitosEstructurados(){
  const habitos = [
    { key:'Tabaco', nombre:'Tabaco' },
    { key:'Alcohol', nombre:'Alcohol' },
    { key:'Drogas', nombre:'Drogas' },
    { key:'Cafe', nombre:'Café' },
    { key:'Biomasa', nombre:'Biomasa' }
  ];

  return habitos.map(h => {
    const tiempoEl = document.getElementById('hcHabito' + h.key + 'Tiempo');
    const abstEl = document.getElementById('hcHabito' + h.key + 'Abstinencia');
    let tiempo = tiempoEl?.value?.trim() || '';
    let abstinencia = abstEl?.value?.trim() || '';
    if(/^\d+$/.test(tiempo)) tiempo = tiempo + ' años';
    if(/^\d+$/.test(abstinencia)) abstinencia = abstinencia + ' meses';
    if(tiempoEl && tiempo) tiempoEl.value = tiempo;
    if(abstEl && abstinencia) abstEl.value = abstinencia;

    return auroCompactarObjeto({
      habito: h.nombre,
      actual: auroGetRadio('hcHabito' + h.key + 'Ex'),
      tiempo: tiempo,
      abstinencia: abstinencia
    });
  }).filter(auroTieneValor);
}

function recopilarAlimentacionEstructurada(){
  const agua = document.getElementById('hcAlimentacionAguaDiaria');
  const comidas = document.getElementById('hcAlimentacionComidasDia');
  if(agua) agua.value = auroV21NormalizarUnidadSimple(agua.value, 'litros/día');
  if(comidas) comidas.value = auroV21NormalizarUnidadSimple(comidas.value, 'comidas/día');

  return auroCompactarObjeto({
    agua_diaria_litros: auroGet('hcAlimentacionAguaDiaria'),
    comidas_dia: auroGet('hcAlimentacionComidasDia'),
    frutas_verduras: auroGet('hcAlimentacionFrutasVerduras'),
    comida_rapida: auroGet('hcAlimentacionComidaRapida'),
    azucar: auroGet('hcAlimentacionAzucar'),
    sal: auroGet('hcAlimentacionSal'),
    suplementos: auroGet('hcAlimentacionSuplementos'),
    detalle: auroGet('hcAlimentacion')
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(auroV21InicializarAyudasAntecedentes, 250);
});

/* ==========================================================
   AUROSANAX FIX DEFINITIVO - COVID Y VACUNAS EN CAJA RESUMEN
   Corrección no destructiva: reemplaza solo funciones de resumen
   y recopila vacunas solo si tienen datos reales.
   ========================================================== */

function auroVacunaDosisTieneDatoReal(d){
  if(!d) return false;
  return !!(
    String(d.programada || '').trim() ||
    String(d.administracion || '').trim() ||
    d.aplicada === true ||
    String(d.observacion || '').trim()
  );
}

function auroVacunaTieneDatoReal(v){
  if(!v) return false;
  if(String(v.nombre_comercial || '').trim()) return true;
  return Array.isArray(v.dosis) && v.dosis.some(auroVacunaDosisTieneDatoReal);
}

function recopilarVacunasEstructuradas(){
  const vacunas = [
    { key:'Covid', biologico:'COVID-19', dosis:4 },
    { key:'Hpv', biologico:'Virus Papiloma Humano (HPV)', dosis:3 },
    { key:'HepB', biologico:'Hepatitis B', dosis:3 },
    { key:'Influenza', biologico:'Influenza', dosis:2 },
    { key:'Tdpa', biologico:'Td/Tdap', dosis:2 },
    { key:'Neumococo', biologico:'Neumococo', dosis:2 },
    { key:'Srp', biologico:'SRP', dosis:2 },
    { key:'Varicela', biologico:'Varicela', dosis:2 },
    { key:'FiebreAmarilla', biologico:'Fiebre amarilla', dosis:1 }
  ];

  return vacunas.map(v => {
    const dosis = [];
    for(let i = 1; i <= v.dosis; i++){
      const item = {
        numero: String(i),
        programada: auroGet('hcVac' + v.key + 'Prog' + i),
        administracion: auroGet('hcVac' + v.key + 'Adm' + i),
        aplicada: auroGetCheck('hcVac' + v.key + 'Apl' + i),
        observacion: auroGet('hcVac' + v.key + 'Obs' + i)
      };
      if(auroVacunaDosisTieneDatoReal(item)) dosis.push(item);
    }

    const itemVacuna = {
      key: v.key,
      biologico: v.biologico,
      nombre_comercial: auroGet('hcVac' + v.key + 'Nombre'),
      dosis: dosis
    };

    return itemVacuna;
  }).filter(auroVacunaTieneDatoReal);
}

function auroResumenCovidItemsDesdeJson(data){
  const c = data?.covid || data?.COVID || null;
  if(!c || typeof c !== 'object') return [];

  const detalle = [];
  if(auroPrevioEsValorUtil(c.presento)) detalle.push('Presentó: ' + c.presento);
  if(auroPrevioEsValorUtil(c.fecha)) detalle.push('Fecha: ' + c.fecha);
  if(auroPrevioEsValorUtil(c.anio_referencia)) detalle.push('Referencia: ' + c.anio_referencia);
  if(auroPrevioEsValorUtil(c.clasificacion)) detalle.push('Clasificación: ' + c.clasificacion);
  if(auroPrevioEsValorUtil(c.hospitalizacion)) detalle.push('Hospitalización: ' + c.hospitalizacion);
  if(auroPrevioEsValorUtil(c.tiempo_hospitalizado)) detalle.push('Hospitalización tiempo: ' + c.tiempo_hospitalizado);
  if(auroPrevioEsValorUtil(c.vacunado)) detalle.push('Vacunado: ' + c.vacunado);
  if(auroPrevioEsValorUtil(c.vacuna_tipo)) detalle.push('Vacuna: ' + c.vacuna_tipo);

  const dosis = (c.dosis || [])
    .filter(d => auroPrevioEsValorUtil(d.fecha) || auroPrevioEsValorUtil(d.detalle))
    .map(d => 'Dosis ' + (d.numero || '') + ': ' + [d.fecha, d.detalle].filter(auroPrevioEsValorUtil).join(' / '));

  if(dosis.length) detalle.push(dosis.join(' · '));
  if(auroPrevioEsValorUtil(c.observaciones)) detalle.push('Obs.: ' + c.observaciones);

  return detalle.length ? [{ titulo:'COVID-19', detalle: detalle.join(' · ') }] : [];
}

function auroResumenVacunasItemsDesdeJson(data){
  const lista = Array.isArray(data?.vacunas) ? data.vacunas : [];
  return lista.filter(auroVacunaTieneDatoReal).map(v => {
    const dosisTexto = (v.dosis || [])
      .filter(auroVacunaDosisTieneDatoReal)
      .map(d => {
        const partes = [];
        if(d.aplicada === true) partes.push('Aplicada');
        if(auroPrevioEsValorUtil(d.programada)) partes.push('Programada: ' + d.programada);
        if(auroPrevioEsValorUtil(d.administracion)) partes.push('Administrada: ' + d.administracion);
        if(auroPrevioEsValorUtil(d.observacion)) partes.push('Obs.: ' + d.observacion);
        return 'Dosis ' + (d.numero || '') + ': ' + partes.join(' / ');
      });

    const detalle = [];
    if(auroPrevioEsValorUtil(v.nombre_comercial)) detalle.push('Marca: ' + v.nombre_comercial);
    if(dosisTexto.length) detalle.push(dosisTexto.join(' · '));

    return {
      titulo: v.biologico || v.key || 'Vacuna',
      detalle: detalle.join(' · ')
    };
  });
}

function auroResumenHabitosItemsDesdeJson(data){
  const lista = Array.isArray(data?.habitos) ? data.habitos : [];
  return lista.filter(x => auroTieneValor(x)).map(h => {
    const detalle = [];
    if(auroPrevioEsValorUtil(h.actual)) detalle.push('Ex consumidor: ' + h.actual);
    if(auroPrevioEsValorUtil(h.tiempo)) detalle.push('Tiempo: ' + h.tiempo);
    if(auroPrevioEsValorUtil(h.abstinencia)) detalle.push('Abstinencia: ' + h.abstinencia);
    return { titulo:h.habito || h.key || 'Hábito', detalle: detalle.join(' · ') };
  });
}

function auroResumenEstiloVidaItemsDesdeJson(data){
  const lista = Array.isArray(data?.estilo_vida || data?.estiloVida) ? (data.estilo_vida || data.estiloVida) : [];
  return lista.filter(x => auroTieneValor(x)).map(a => {
    const detalle = [];
    if(auroPrevioEsValorUtil(a.distancia_km)) detalle.push('Distancia: ' + a.distancia_km);
    if(auroPrevioEsValorUtil(a.frecuencia_dia)) detalle.push('Frecuencia: ' + a.frecuencia_dia);
    if(auroPrevioEsValorUtil(a.tiempo_horas)) detalle.push('Tiempo: ' + a.tiempo_horas);
    return { titulo:a.actividad || a.key || 'Actividad', detalle: detalle.join(' · ') };
  });
}

function auroResumenAlimentacionItemsDesdeJson(data){
  const a = data?.alimentacion || null;
  if(!a || typeof a !== 'object') return [];
  const detalle = [];
  if(auroPrevioEsValorUtil(a.agua_diaria_litros)) detalle.push('Agua: ' + a.agua_diaria_litros);
  if(auroPrevioEsValorUtil(a.comidas_dia)) detalle.push('Comidas: ' + a.comidas_dia);
  if(auroPrevioEsValorUtil(a.frutas_verduras)) detalle.push('Frutas/verduras: ' + a.frutas_verduras);
  if(auroPrevioEsValorUtil(a.comida_rapida)) detalle.push('Comida rápida: ' + a.comida_rapida);
  if(auroPrevioEsValorUtil(a.azucar)) detalle.push('Azúcar: ' + a.azucar);
  if(auroPrevioEsValorUtil(a.sal)) detalle.push('Sal: ' + a.sal);
  if(auroPrevioEsValorUtil(a.suplementos)) detalle.push('Suplementos: ' + a.suplementos);
  if(auroPrevioEsValorUtil(a.detalle)) detalle.push('Detalle: ' + a.detalle);
  return detalle.length ? [{ titulo:'Evaluación alimentaria', detalle: detalle.join(' · ') }] : [];
}

function auroMostrarAntecedentesPrevios(h, modo){
  const box = auroAsegurarCajaAntecedentesPrevios();
  const content = document.getElementById('auroAntecedentesPreviosContent');
  if(!box || !content) return;

  if(!auroHistoriaTieneAntecedentes(h)){
    box.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const fuentePersonales = h.antecedentes_personales || '';
  const jsonPersonales = auroParsear(AURO_ANT_PERSONALES_MARKER, fuentePersonales);
  const fuentePatologicos = jsonPersonales ? (jsonPersonales.patologicos || '') : auroExtraerFuentePatologicosPersonales(fuentePersonales);

  let html = '';
  html += auroRenderPrevioItemsPremium('Patológicos personales', auroExtraerItemsAntecedentePremium(fuentePatologicos, 'patologia'));
  html += auroRenderPrevioItemsPremium('Quirúrgicos', auroExtraerItemsAntecedentePremium(h.antecedentes_quirurgicos || '', 'quirurgico'));
  html += auroRenderPrevioItemsPremium('Alergias', auroExtraerItemsAntecedentePremium(h.alergias || '', 'alergia'));

  if(jsonPersonales){
    html += auroRenderPrevioItemsPremium('COVID-19', auroResumenCovidItemsDesdeJson(jsonPersonales));
    html += auroRenderPrevioItemsPremium('Vacunas registradas', auroResumenVacunasItemsDesdeJson(jsonPersonales));
    html += auroRenderPrevioItemsPremium('Hábitos registrados', auroResumenHabitosItemsDesdeJson(jsonPersonales));
    html += auroRenderPrevioItemsPremium('Actividad física registrada', auroResumenEstiloVidaItemsDesdeJson(jsonPersonales));
    html += auroRenderPrevioItemsPremium('Alimentación', auroResumenAlimentacionItemsDesdeJson(jsonPersonales));
  }else{
    html += auroRenderPrevioItemsPremium('Vacunas registradas', auroExtraerVacunasRegistradas(fuentePersonales));
    html += auroRenderPrevioItemsPremium('Hábitos registrados', auroExtraerHabitosRegistrados(fuentePersonales));
    html += auroRenderPrevioItemsPremium('Actividad física registrada', auroExtraerActividadRegistrada(fuentePersonales));
  }

  html += auroRenderPrevioItemsPremium('Gineco-obstétricos', auroExtraerItemsAntecedentePremium(h.antecedentes_gineco_obstetricos || '', 'gineco'));
  html += auroRenderPrevioItemsPremium('Medicación actual', auroExtraerItemsAntecedentePremium(h.medicacion_actual || '', 'medicacion'));
  html += auroRenderPrevioItemsPremium('Familiares', auroExtraerItemsAntecedentePremium(h.antecedentes_familiares || '', 'familiares'));

  content.innerHTML = html;

  const estadoPrevio = box.dataset.estado || 'visible';
  if(estadoPrevio === 'oculto') content.classList.add('auro-previos-collapsed');
  else content.classList.remove('auro-previos-collapsed');

  const btn = box.querySelector('.auro-previos-hide');
  if(btn){
    btn.innerHTML = estadoPrevio === 'oculto'
      ? '<i class="bi bi-eye me-1"></i> Mostrar'
      : '<i class="bi bi-eye-slash me-1"></i> Ocultar';
  }

  box.dataset.idHistoriaOrigen = h.id_historia || '';
  box.dataset.modo = modo || '';
  box.style.display = content.innerHTML.trim() ? 'block' : 'none';
}

console.log('AUROSANAX antecedentes.js: FIX COVID/VACUNAS resumen cargado');
