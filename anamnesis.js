/*
AUROSANAX ERP - MÓDULO ANAMNESIS INTELIGENTE
Archivo: anamnesis.js
Versión: 1.3.0

Función:
- Detectar "dolor pélvico" en #hcMotivoConsulta.
- Mostrar formulario semiológico.
- Generar texto editable en #hcEnfermedadActual.
- Ocultar en Anamnesis los campos #hcRevisionSistemas y #hcSintomasAlarma para evitar duplicidad.
- No escribir información en esos campos.
- Integra en Anamnesis los síntomas ginecológicos y obstétricos usando los IDs originales.
- No modifica el guardado ni la base de datos existente.
*/

(function () {
  'use strict';

  const VERSION = '1.3.0';
  let inicializado = false;

  const $ = id => document.getElementById(id);
  const txt = v => String(v ?? '').trim();

  function normalizar(v) {
    return txt(v).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function esDolorPelvico(v) {
    const t = normalizar(v);
    return [
      'dolor pelvico',
      'dolor en pelvis',
      'dolor bajo vientre',
      'dolor en bajo vientre',
      'dolor abdominal bajo',
      'dolor hipogastrico',
      'dolor en hipogastrio'
    ].some(x => t.includes(x));
  }

  function unir(lista) {
    const a = lista.map(txt).filter(Boolean);
    if (!a.length) return '';
    if (a.length === 1) return a[0];
    if (a.length === 2) return a[0] + ' y ' + a[1];
    return a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
  }

  function seleccionados(clase) {
    return [...document.querySelectorAll('.' + clase + ':checked')]
      .map(x => txt(x.value))
      .filter(Boolean);
  }

  function estado(mensaje, tipo = 'info') {
    const el = $('auroAnamnesisEstado');
    if (!el) return;
    el.className = 'auro-anamnesis-estado ' + tipo;
    el.textContent = mensaje;
  }


  function ocultarCamposDuplicadosAnamnesis() {
    const campos = [
      document.getElementById('hcRevisionSistemas'),
      document.getElementById('hcSintomasAlarma')
    ];

    campos.forEach(campo => {
      if (!campo) return;

      const bloque = campo.closest('.col-md-6, .col-md-12') || campo.parentElement;
      if (bloque) {
        bloque.style.display = 'none';
        bloque.setAttribute('aria-hidden', 'true');
        bloque.dataset.auroOcultoAnamnesis = '1';
      }

      /*
        Se conserva el elemento en el DOM para no romper:
        - lectura de historias antiguas,
        - compatibilidad con funciones existentes,
        - estructura de Google Sheets.
        El módulo Anamnesis ya no escribe datos en estos campos.
      */
    });
  }

  function instalarEstilos() {
    if ($('auroAnamnesisStyles')) return;

    const style = document.createElement('style');
    style.id = 'auroAnamnesisStyles';
    style.textContent = `
      .auro-anamnesis-box{border:1px solid #fbcfe8;background:linear-gradient(135deg,#fff,#fff7fb);border-radius:18px;padding:14px;margin-top:10px;box-shadow:0 8px 24px rgba(139,30,90,.06)}
      .auro-anamnesis-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
      .auro-anamnesis-title{font-weight:900;color:#7a174f;display:flex;align-items:center;gap:8px}
      .auro-anamnesis-subtitle{color:#6b7280;font-size:13px;margin-top:3px}
      .auro-anamnesis-btn{border:1px solid #fbcfe8;background:#fdf2f8;color:#8b1e5a;border-radius:12px;padding:8px 11px;font-weight:800;font-size:13px;cursor:pointer}
      .auro-anamnesis-btn.primary{border:0;background:linear-gradient(135deg,#8b1e5a,#c23b83);color:#fff}
      .auro-anamnesis-btn.danger{background:#fff;color:#991b1b;border-color:#fecaca}
      .auro-anamnesis-estado{margin-top:10px;border-radius:12px;padding:8px 10px;font-size:12.5px;font-weight:700}
      .auro-anamnesis-estado.info{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}
      .auro-anamnesis-estado.ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
      .auro-anamnesis-estado.warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
      .auro-semiologia-panel{display:none;margin-top:14px;border-top:1px solid #f1d5e6;padding-top:14px}
      .auro-semiologia-panel.show{display:block}
      .auro-semiologia-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .auro-semiologia-field.span-2{grid-column:span 2}
      .auro-semiologia-field.span-4{grid-column:1/-1}
      .auro-semiologia-field label{display:block;font-size:12px;font-weight:850;color:#374151;margin-bottom:5px}
      .auro-semiologia-field input,.auro-semiologia-field select,.auro-semiologia-field textarea{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:8px 10px;background:#fff;color:#111827;font:inherit;font-size:13px}
      .auro-semiologia-field textarea{min-height:70px;resize:vertical}
      .auro-check-group{display:flex;flex-wrap:wrap;gap:7px}
      .auro-check-item{display:inline-flex;align-items:center;gap:5px;border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 9px;font-size:12px;color:#374151;cursor:pointer}
      .auro-check-item input{width:15px;height:15px;accent-color:#8b1e5a}
      .auro-semiologia-footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px}
      .auro-clinical-warning{margin-top:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:9px 10px;font-size:12px}
      @media(max-width:980px){.auro-semiologia-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.auro-semiologia-grid{grid-template-columns:1fr}.auro-semiologia-field.span-2,.auro-semiologia-field.span-4{grid-column:auto}.auro-anamnesis-btn{width:100%}}

      #hc_anamnesis .gin-panel{border:1px solid #e5e7eb;border-radius:20px;padding:16px;background:#fff;margin-top:16px}
      #hc_anamnesis .gin-panel-title{font-weight:900;color:#111827;margin-bottom:12px;display:flex;align-items:center;gap:8px}
      #hc_anamnesis .gin-panel-title i{color:#8b1e5a}
      #hc_anamnesis .gin-check-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      #hc_anamnesis .gin-check{border:1px solid #e5e7eb;border-radius:14px;padding:9px 10px;display:flex;align-items:center;gap:8px;background:#fff;cursor:pointer;min-width:0}
      #hc_anamnesis .gin-check:hover{border-color:#f9a8d4;background:#fff7fb}
      #hc_anamnesis .gin-check input{width:17px;height:17px;accent-color:#8b1e5a;flex:0 0 auto}
      #hc_anamnesis .gin-check span{min-width:0;line-height:1.25}
      @media(max-width:1100px){#hc_anamnesis .gin-check-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:760px){#hc_anamnesis .gin-check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:460px){#hc_anamnesis .gin-check-grid{grid-template-columns:1fr}}


      #hc_anamnesis .obs-panel{border:1px solid #e5e7eb;border-radius:20px;padding:16px;background:#fff;margin-top:16px}
      #hc_anamnesis .obs-panel-title{font-weight:900;color:#111827;margin-bottom:12px;display:flex;align-items:center;gap:8px}
      #hc_anamnesis .obs-panel-title i{color:#8b1e5a}
      #hc_anamnesis .obs-check-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      #hc_anamnesis .obs-check{border:1px solid #e5e7eb;border-radius:14px;padding:9px 10px;display:flex;align-items:center;gap:8px;background:#fff;cursor:pointer;min-width:0}
      #hc_anamnesis .obs-check:hover{border-color:#f9a8d4;background:#fff7fb}
      #hc_anamnesis .obs-check input{width:17px;height:17px;accent-color:#8b1e5a;flex:0 0 auto}
      #hc_anamnesis .obs-check span{min-width:0;line-height:1.25}
      @media(max-width:1100px){#hc_anamnesis .obs-check-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:760px){#hc_anamnesis .obs-check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:460px){#hc_anamnesis .obs-check-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function checks(clase, items) {
    return items.map(v =>
      '<label class="auro-check-item"><input type="checkbox" class="' +
      clase + '" value="' + v + '"> ' + v + '</label>'
    ).join('');
  }


  function checkSintomaActual(id, label) {
    return `<label class="gin-check"><input id="${id}" type="checkbox"><span>${label}</span></label>`;
  }

  function crearBloqueSintomasGinecologicos() {
    if ($('auroAnamnesisSintomasActuales')) return;

    const enfermedad = $('hcEnfermedadActual');
    if (!enfermedad) return;

    const bloqueEnfermedad =
      enfermedad.closest('.col-md-12, .col-12, .form-group') ||
      enfermedad.parentElement;

    if (!bloqueEnfermedad) return;

    const bloque = document.createElement('div');
    bloque.id = 'auroAnamnesisSintomasActuales';
    bloque.className = 'gin-panel';

    bloque.innerHTML = `
      <div class="gin-panel-title">
        <i class="bi bi-activity"></i>
        Síntomas actuales
      </div>

      <div class="gin-check-grid mb-3">
        ${checkSintomaActual('ginSintDolorPelvico','Dolor pélvico')}
        ${checkSintomaActual('ginSintSangrado','Sangrado anormal')}
        ${checkSintomaActual('ginSintLeucorrea','Leucorrea')}
        ${checkSintomaActual('ginSintPrurito','Prurito')}
        ${checkSintomaActual('ginSintDisuria','Disuria')}
        ${checkSintomaActual('ginSintDispareunia','Dispareunia')}
        ${checkSintomaActual('ginSintAmenorrea','Amenorrea')}
        ${checkSintomaActual('ginSintDismenorrea','Dismenorrea')}
        ${checkSintomaActual('ginSintMasa','Sensación de masa')}
        ${checkSintomaActual('ginSintSequedad','Sequedad vaginal')}
        ${checkSintomaActual('ginSintIncontinencia','Incontinencia')}
        ${checkSintomaActual('ginSintMenopausia','Síntomas menopáusicos')}
      </div>

      <label class="form-label fw-bold" for="ginSintDescripcion">
        Descripción, evolución y características
      </label>
      <textarea id="ginSintDescripcion" class="form-control" rows="3"></textarea>
    `;

    bloqueEnfermedad.insertAdjacentElement('afterend', bloque);
  }


  function checkSintomaObstetrico(id, label) {
    return `<label class="obs-check"><input id="${id}" type="checkbox"><span>${label}</span></label>`;
  }

  function crearBloqueSintomasObstetricos() {
    if ($('auroAnamnesisSintomasObstetricos')) return;

    const referencia = $('auroAnamnesisSintomasActuales');
    const enfermedad = $('hcEnfermedadActual');
    if (!referencia && !enfermedad) return;

    const bloque = document.createElement('div');
    bloque.id = 'auroAnamnesisSintomasObstetricos';
    bloque.className = 'obs-panel';

    bloque.innerHTML = `
      <div class="obs-panel-title">
        <i class="bi bi-activity"></i>
        Síntomas obstétricos
      </div>

      <div class="obs-check-grid mb-3">
        ${checkSintomaObstetrico('obsSintSangrado','Sangrado vaginal')}
        ${checkSintomaObstetrico('obsSintPerdidaLiquido','Pérdida de líquido')}
        ${checkSintomaObstetrico('obsSintDolorPelvico','Dolor pélvico')}
        ${checkSintomaObstetrico('obsSintContracciones','Contracciones')}
        ${checkSintomaObstetrico('obsSintCefalea','Cefalea')}
        ${checkSintomaObstetrico('obsSintFosfenos','Fosfenos')}
        ${checkSintomaObstetrico('obsSintTinnitus','Tinnitus')}
        ${checkSintomaObstetrico('obsSintEpigastralgia','Epigastralgia')}
        ${checkSintomaObstetrico('obsSintDisuria','Disuria')}
      </div>

      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label fw-bold" for="obsSintOtros">Otros síntomas</label>
          <input id="obsSintOtros" class="form-control">
        </div>
        <div class="col-md-6">
          <label class="form-label fw-bold" for="obsSintDescripcion">Descripción y evolución</label>
          <textarea id="obsSintDescripcion" rows="2" class="form-control"></textarea>
        </div>
      </div>
    `;

    if (referencia) referencia.insertAdjacentElement('afterend', bloque);
    else {
      const contenedor = enfermedad.closest('.col-md-12, .col-12, .form-group') || enfermedad.parentElement;
      contenedor?.insertAdjacentElement('afterend', bloque);
    }
  }

  function retirarBloqueSintomasObstetricosOriginal() {
    const original = document.querySelector('#obstetricia .obs-panel #obsSintSangrado')?.closest('.obs-panel');
    if (original) original.remove();
  }

  function vigilarRenderObstetricia() {
    if (window.__auroAnamnesisObsObserver) return;

    const observer = new MutationObserver(() => retirarBloqueSintomasObstetricosOriginal());
    observer.observe(document.body, { childList: true, subtree: true });
    window.__auroAnamnesisObsObserver = observer;
    retirarBloqueSintomasObstetricosOriginal();
  }

  function crearInterfaz() {
    const motivo = $('hcMotivoConsulta');
    if (!motivo || $('auroAnamnesisAsistente')) return;

    const contenedor = motivo.closest('.col-md-12') || motivo.parentElement;
    if (!contenedor) return;

    const box = document.createElement('div');
    box.id = 'auroAnamnesisAsistente';
    box.className = 'auro-anamnesis-box';

    box.innerHTML = `
      <div class="auro-anamnesis-head">
        <div>
          <div class="auro-anamnesis-title"><i class="bi bi-magic"></i> Asistente inteligente de semiología</div>
          <div class="auro-anamnesis-subtitle">Reconoce el motivo y ayuda a redactar la enfermedad actual.</div>
        </div>
        <button type="button" class="auro-anamnesis-btn primary" id="auroAbrirSemiologia">
          <i class="bi bi-clipboard2-pulse"></i> Completar semiología
        </button>
      </div>

      <div id="auroAnamnesisEstado" class="auro-anamnesis-estado info">
        Escriba el motivo de consulta. La primera plantilla disponible es dolor pélvico.
      </div>

      <div id="auroSemiologiaDolorPelvico" class="auro-semiologia-panel">
        <div class="auro-semiologia-grid">
          <div class="auro-semiologia-field">
            <label>Inicio</label>
            <select id="auroDpInicio">
              <option value="">Seleccione</option>
              <option>de inicio súbito</option>
              <option>de inicio gradual</option>
              <option>de inicio insidioso</option>
            </select>
          </div>

          <div class="auro-semiologia-field">
            <label>Tiempo de evolución</label>
            <input id="auroDpTiempo" placeholder="Ej. 3 días">
          </div>

          <div class="auro-semiologia-field">
            <label>Localización</label>
            <select id="auroDpLocalizacion">
              <option value="">Seleccione</option>
              <option>hipogastrio</option>
              <option>fosa ilíaca derecha</option>
              <option>fosa ilíaca izquierda</option>
              <option>pelvis de localización difusa</option>
              <option>región suprapúbica</option>
            </select>
          </div>

          <div class="auro-semiologia-field">
            <label>Intensidad EVA</label>
            <select id="auroDpEva">
              <option value="">Seleccione</option>
              ${Array.from({length:11},(_,i)=>`<option value="${i}">${i}/10</option>`).join('')}
            </select>
          </div>

          <div class="auro-semiologia-field">
            <label>Carácter</label>
            <select id="auroDpCaracter">
              <option value="">Seleccione</option>
              <option>tipo cólico</option>
              <option>punzante</option>
              <option>opresivo</option>
              <option>urente</option>
              <option>continuo</option>
              <option>intermitente</option>
              <option>sordo</option>
            </select>
          </div>

          <div class="auro-semiologia-field">
            <label>Irradiación</label>
            <input id="auroDpIrradiacion" placeholder="Ej. región lumbar o sin irradiación">
          </div>

          <div class="auro-semiologia-field">
            <label>Curso / evolución</label>
            <select id="auroDpEvolucion">
              <option value="">Seleccione</option>
              <option>estable</option>
              <option>progresivo</option>
              <option>intermitente</option>
              <option>recurrente</option>
              <option>en mejoría</option>
            </select>
          </div>

          <div class="auro-semiologia-field">
            <label>Duración de episodios</label>
            <input id="auroDpDuracion" placeholder="Ej. minutos, horas">
          </div>

          <div class="auro-semiologia-field span-2">
            <label>Factores agravantes</label>
            <input id="auroDpAgravantes" placeholder="Movimiento, relaciones sexuales, menstruación">
          </div>

          <div class="auro-semiologia-field span-2">
            <label>Factores atenuantes</label>
            <input id="auroDpAtenuantes" placeholder="Reposo, analgésicos, calor local">
          </div>

          <div class="auro-semiologia-field">
            <label>Relación menstrual</label>
            <select id="auroDpMenstrual">
              <option value="">No especificado</option>
              <option>sin relación aparente con el ciclo menstrual</option>
              <option>predomina durante la menstruación</option>
              <option>inicia antes de la menstruación</option>
              <option>se presenta a mitad del ciclo</option>
              <option>se presenta fuera de la menstruación</option>
            </select>
          </div>

          <div class="auro-semiologia-field">
            <label>Relación sexual</label>
            <select id="auroDpSexual">
              <option value="">No especificado</option>
              <option>sin relación con la actividad sexual</option>
              <option>asociado a relaciones sexuales</option>
              <option>acompañado de dispareunia superficial</option>
              <option>acompañado de dispareunia profunda</option>
            </select>
          </div>

          <div class="auro-semiologia-field">
            <label>Posibilidad de embarazo</label>
            <select id="auroDpEmbarazo">
              <option value="">No especificado</option>
              <option>niega posibilidad de embarazo</option>
              <option>refiere posibilidad de embarazo</option>
              <option>embarazo confirmado</option>
              <option>estado gestacional por confirmar</option>
            </select>
          </div>

          <div class="auro-semiologia-field">
            <label>FUM</label>
            <input id="auroDpFum" type="date">
          </div>

          <div class="auro-semiologia-field span-4">
            <label>Síntomas ginecológicos asociados</label>
            <div class="auro-check-group">
              ${checks('auroDpGin',['sangrado vaginal anormal','flujo vaginal','mal olor vaginal','prurito vulvovaginal','dispareunia','dismenorrea','amenorrea'])}
            </div>
          </div>

          <div class="auro-semiologia-field span-4">
            <label>Síntomas urinarios asociados</label>
            <div class="auro-check-group">
              ${checks('auroDpUri',['disuria','polaquiuria','urgencia urinaria','nicturia','hematuria','dolor lumbar'])}
            </div>
          </div>

          <div class="auro-semiologia-field span-4">
            <label>Síntomas digestivos asociados</label>
            <div class="auro-check-group">
              ${checks('auroDpDig',['náuseas','vómitos','distensión abdominal','diarrea','estreñimiento','dolor con la evacuación'])}
            </div>
          </div>

          <div class="auro-semiologia-field span-4">
            <label>Síntomas generales asociados</label>
            <div class="auro-check-group">
              ${checks('auroDpGen',['fiebre','escalofríos','astenia','mareo','pérdida de peso','malestar general'])}
            </div>
          </div>

          <div class="auro-semiologia-field span-4">
            <label>Otros datos clínicos relevantes</label>
            <textarea id="auroDpOtros" placeholder="Antecedentes relacionados, tratamientos previos u otros datos."></textarea>
          </div>
        </div>

        <div class="auro-clinical-warning">
          La redacción generada es un apoyo documental y debe ser revisada por el profesional antes de guardar.
        </div>

        <div class="auro-semiologia-footer">
          <button type="button" class="auro-anamnesis-btn danger" id="auroLimpiarSemiologia">Limpiar</button>
          <button type="button" class="auro-anamnesis-btn" id="auroCerrarSemiologia">Cerrar</button>
          <button type="button" class="auro-anamnesis-btn primary" id="auroGenerarEnfermedad">
            <i class="bi bi-magic"></i> Generar enfermedad actual
          </button>
        </div>
      </div>
    `;

    contenedor.appendChild(box);

    $('auroAbrirSemiologia').addEventListener('click', abrir);
    $('auroCerrarSemiologia').addEventListener('click', cerrar);
    $('auroLimpiarSemiologia').addEventListener('click', limpiar);
    $('auroGenerarEnfermedad').addEventListener('click', generar);
    motivo.addEventListener('input', detectar);

    detectar();
  }

  function detectar() {
    const motivo = txt($('hcMotivoConsulta')?.value);

    if (!motivo) {
      estado('Escriba el motivo de consulta. La primera plantilla disponible es dolor pélvico.', 'info');
    } else if (esDolorPelvico(motivo)) {
      estado('Motivo reconocido: dolor pélvico. Puede completar la semiología.', 'ok');
    } else {
      estado('El motivo escrito todavía no tiene plantilla activa. Disponible: dolor pélvico.', 'warn');
    }
  }

  function abrir() {
    const motivo = txt($('hcMotivoConsulta')?.value);

    if (!motivo) {
      estado('Primero escriba el motivo de consulta.', 'warn');
      $('hcMotivoConsulta')?.focus();
      return;
    }

    if (!esDolorPelvico(motivo)) {
      if (!confirm('La plantilla disponible corresponde a dolor pélvico. ¿Desea abrirla de todas formas?')) return;
    }

    $('auroSemiologiaDolorPelvico')?.classList.add('show');
    estado('Complete los datos y genere la enfermedad actual.', 'info');
  }

  function cerrar() {
    $('auroSemiologiaDolorPelvico')?.classList.remove('show');
  }

  function datos() {
    const val = id => txt($(id)?.value);

    return {
      motivo: val('hcMotivoConsulta'),
      inicio: val('auroDpInicio'),
      tiempo: val('auroDpTiempo'),
      localizacion: val('auroDpLocalizacion'),
      eva: val('auroDpEva'),
      caracter: val('auroDpCaracter'),
      irradiacion: val('auroDpIrradiacion'),
      evolucion: val('auroDpEvolucion'),
      duracion: val('auroDpDuracion'),
      agravantes: val('auroDpAgravantes'),
      atenuantes: val('auroDpAtenuantes'),
      menstrual: val('auroDpMenstrual'),
      sexual: val('auroDpSexual'),
      embarazo: val('auroDpEmbarazo'),
      fum: val('auroDpFum'),
      ginecologicos: seleccionados('auroDpGin'),
      urinarios: seleccionados('auroDpUri'),
      digestivos: seleccionados('auroDpDig'),
      generales: seleccionados('auroDpGen'),
      otros: val('auroDpOtros')
    };
  }

  function narrativa(d) {
    const partes = [];
    let inicio = 'Paciente consulta por dolor pélvico';

    if (d.tiempo) inicio += ' de ' + d.tiempo + ' de evolución';
    if (d.inicio) inicio += ', ' + d.inicio;
    partes.push(inicio + '.');

    const caracteristicas = [];
    if (d.localizacion) caracteristicas.push('localizado en ' + d.localizacion);
    if (d.caracter) caracteristicas.push('de carácter ' + d.caracter);
    if (d.eva !== '') caracteristicas.push('con intensidad ' + d.eva + '/10 según escala visual análoga');

    if (d.irradiacion) {
      caracteristicas.push(
        normalizar(d.irradiacion).includes('sin irradi')
          ? 'sin irradiación'
          : 'con irradiación hacia ' + d.irradiacion
      );
    }

    if (caracteristicas.length) partes.push(unir(caracteristicas) + '.');

    const curso = [];
    if (d.evolucion) curso.push('presenta curso ' + d.evolucion);
    if (d.duracion) curso.push('con episodios de duración aproximada de ' + d.duracion);
    if (curso.length) partes.push(unir(curso) + '.');

    const factores = [];
    if (d.agravantes) factores.push('se exacerba con ' + d.agravantes);
    if (d.atenuantes) factores.push('mejora con ' + d.atenuantes);
    if (factores.length) partes.push(unir(factores) + '.');

    const relaciones = [d.menstrual, d.sexual, d.embarazo].filter(Boolean);
    if (d.fum) relaciones.push('FUM: ' + d.fum);
    if (relaciones.length) partes.push(unir(relaciones) + '.');

    const sintomas = [
      ...d.ginecologicos,
      ...d.urinarios,
      ...d.digestivos,
      ...d.generales
    ];

    partes.push(
      sintomas.length
        ? 'Se acompaña de ' + unir(sintomas) + '.'
        : 'No se registran síntomas asociados en el formulario semiológico.'
    );

    if (d.otros) partes.push('Otros datos relevantes: ' + d.otros + '.');

    return partes.join(' ').replace(/\s+/g, ' ').replace(/\.\./g, '.').trim();
  }

  function generar() {
    const enfermedad = $('hcEnfermedadActual');
    if (!enfermedad) {
      estado('No se encontró el campo Enfermedad actual.', 'warn');
      return;
    }

    const d = datos();
    const texto = narrativa(d);

    if (txt(enfermedad.value) && txt(enfermedad.value) !== texto) {
      if (!confirm('Enfermedad actual ya contiene información. ¿Desea reemplazarla?')) {
        estado('Se conservó el texto existente.', 'warn');
        return;
      }
    }

    enfermedad.value = texto;
    enfermedad.dispatchEvent(new Event('input', { bubbles: true }));
    enfermedad.dispatchEvent(new Event('change', { bubbles: true }));
    estado('Enfermedad actual generada. Revise y corrija antes de guardar.', 'ok');
    enfermedad.focus();
    enfermedad.scrollIntoView({ behavior: 'smooth', block: 'center' });

    document.dispatchEvent(new CustomEvent('auro:anamnesis-generada', {
      detail: { tipo: 'dolor_pelvico', version: VERSION, datos: d, narrativa: texto }
    }));
  }

  function limpiar() {
    const panel = $('auroSemiologiaDolorPelvico');
    if (!panel) return;

    panel.querySelectorAll('input,select,textarea').forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });

    estado('Formulario semiológico limpio.', 'info');
  }

  function obtenerDatosAnamnesis() {
    return {
      motivo_consulta: txt($('hcMotivoConsulta')?.value),
      enfermedad_actual: txt($('hcEnfermedadActual')?.value),
      revision_sistemas: '',
      sintomas_alarma: '',
      semiologia_dolor_pelvico: datos(),
      modulo_version: VERSION
    };
  }

  function inicializar() {
    if (inicializado) return;

    if (!$('hc_anamnesis') || !$('hcMotivoConsulta') || !$('hcEnfermedadActual')) {
      console.warn('AUROSANAX Anamnesis: campos no disponibles todavía.');
      return;
    }

    instalarEstilos();
    ocultarCamposDuplicadosAnamnesis();
    crearInterfaz();
    crearBloqueSintomasActuales();
    crearBloqueSintomasObstetricos();
    vigilarRenderObstetricia();
    inicializado = true;

    console.info('AUROSANAX Anamnesis v' + VERSION + ': inicializado.');
  }

  window.auroAnamnesis = {
    version: VERSION,
    inicializar,
    detectar,
    abrir,
    cerrar,
    generar,
    limpiar,
    obtenerDatosAnamnesis
  };

  window.inicializarAnamnesis = inicializar;
  window.auroObtenerDatosAnamnesis = obtenerDatosAnamnesis;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar, { once: true });
  } else {
    inicializar();
  }

  setTimeout(inicializar, 500);
  setTimeout(inicializar, 1500);
})();
/*
AUROSANAX ERP - MOTOR DINÁMICO DE PLANTILLAS DE ANAMNESIS
Extensión compatible con anamnesis.js v1.3.0
Versión del motor: 2.0.0

Principios de seguridad:
- No elimina ni reemplaza el funcionamiento anterior.
- Solo se activa si Apps Script devuelve plantillas activas válidas.
- Si la consulta falla, conserva íntegramente la plantilla local de dolor pélvico.
- No modifica el guardado general ni otros módulos del ERP.
*/
(function () {
  'use strict';

  const ENGINE_VERSION = '2.0.0';
  const state = {
    loaded: false,
    loading: false,
    templates: [],
    active: null,
    answers: {},
    lastNarrative: ''
  };

  const $ = id => document.getElementById(id);
  const text = value => String(value ?? '').trim();

  function normalize(value) {
    return text(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safeJson(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('AUROSANAX Anamnesis: JSON no válido.', error, value);
      return fallback;
    }
  }

  function arrayFrom(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    if (typeof value === 'string') {
      const parsed = safeJson(value, null);
      if (Array.isArray(parsed)) return parsed;
      return value.split(/[,;|\n]/).map(text).filter(Boolean);
    }
    if (typeof value === 'object') return Object.values(value);
    return [value];
  }

  function templateId(template) {
    return text(
      template.id_plantilla_anamnesis ||
      template.id_plantilla ||
      template.id ||
      template.codigo ||
      template.nombre_plantilla
    );
  }

  function templateName(template) {
    return text(
      template.nombre_plantilla ||
      template.nombre ||
      template.titulo ||
      template.categoria_sindromica ||
      'Plantilla de anamnesis'
    );
  }

  function templateKeywords(template) {
    const raw = template.palabras_clave || template.keywords || template.sinonimos || '';
    return arrayFrom(raw)
      .flatMap(item => typeof item === 'string' ? item.split(/[,;|\n]/) : [item])
      .map(normalize)
      .filter(Boolean);
  }

  function isActive(template) {
    const value = normalize(template.estado ?? template.activo ?? 'activo');
    return !['inactivo', '0', 'false', 'eliminado', 'archivado'].includes(value);
  }

  function normalizeResponse(response) {
    let value = response;
    if (typeof value === 'string') value = safeJson(value, []);

    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];

    const possible = [
      value.data,
      value.datos,
      value.resultado,
      value.result,
      value.registros,
      value.plantillas,
      value.items
    ];

    for (const item of possible) {
      if (Array.isArray(item)) return item;
      if (typeof item === 'string') {
        const parsed = safeJson(item, []);
        if (Array.isArray(parsed)) return parsed;
      }
    }

    return [];
  }

  function getRunner() {
    if (!window.google?.script?.run) return null;
    return window.google.script.run;
  }

  function callAppsScript(functionName, ...args) {
    return new Promise((resolve, reject) => {
      const runner = getRunner();
      if (!runner) {
        reject(new Error('google.script.run no está disponible'));
        return;
      }

      try {
        runner
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)[functionName](...args);
      } catch (error) {
        reject(error);
      }
    });
  }

  function installStyles() {
    if ($('auroDynamicAnamnesisStyles')) return;

    const style = document.createElement('style');
    style.id = 'auroDynamicAnamnesisStyles';
    style.textContent = `
      .auro-dyn-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:10px;align-items:end;margin-top:12px}
      .auro-dyn-toolbar label{display:block;font-size:12px;font-weight:850;color:#374151;margin-bottom:5px}
      .auro-dyn-toolbar select{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:9px 10px;background:#fff;color:#111827;font:inherit;font-size:13px}
      .auro-dyn-panel{display:none;margin-top:14px;border-top:1px solid #f1d5e6;padding-top:14px}
      .auro-dyn-panel.show{display:block}
      .auro-dyn-title{font-weight:900;color:#7a174f;margin-bottom:4px}
      .auro-dyn-meta{font-size:12px;color:#6b7280;margin-bottom:12px}
      .auro-dyn-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .auro-dyn-field{min-width:0}
      .auro-dyn-field.span-2{grid-column:span 2}
      .auro-dyn-field.span-4{grid-column:1/-1}
      .auro-dyn-field>label{display:block;font-size:12px;font-weight:850;color:#374151;margin-bottom:5px}
      .auro-dyn-field input[type=text],.auro-dyn-field input[type=number],.auro-dyn-field input[type=date],.auro-dyn-field input[type=time],.auro-dyn-field select,.auro-dyn-field textarea{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:8px 10px;background:#fff;color:#111827;font:inherit;font-size:13px}
      .auro-dyn-field textarea{min-height:74px;resize:vertical}
      .auro-dyn-options{display:flex;flex-wrap:wrap;gap:7px}
      .auro-dyn-option{display:inline-flex;align-items:center;gap:5px;border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 9px;font-size:12px;color:#374151;cursor:pointer}
      .auro-dyn-option input{width:15px;height:15px;accent-color:#8b1e5a}
      .auro-dyn-section{grid-column:1/-1;font-weight:900;color:#7a174f;border-bottom:1px solid #f3d8e7;padding:5px 0 3px;margin-top:4px}
      .auro-dyn-footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px}
      @media(max-width:980px){.auro-dyn-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.auro-dyn-toolbar{grid-template-columns:1fr}.auro-dyn-grid{grid-template-columns:1fr}.auro-dyn-field.span-2,.auro-dyn-field.span-4{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function buildContainer() {
    const assistant = $('auroAnamnesisAsistente');
    if (!assistant || $('auroDynamicAnamnesisRoot')) return;

    const localPanel = $('auroSemiologiaDolorPelvico');
    if (localPanel) localPanel.dataset.auroFallbackPanel = '1';

    const root = document.createElement('div');
    root.id = 'auroDynamicAnamnesisRoot';
    root.innerHTML = `
      <div class="auro-dyn-toolbar">
        <div>
          <label for="auroPlantillaAnamnesisSelect">Plantilla sindrómica</label>
          <select id="auroPlantillaAnamnesisSelect">
            <option value="">Seleccione una plantilla</option>
          </select>
        </div>
        <button type="button" class="auro-anamnesis-btn" id="auroRecargarPlantillas">
          <i class="bi bi-arrow-clockwise"></i> Actualizar
        </button>
      </div>
      <div id="auroDynamicAnamnesisPanel" class="auro-dyn-panel">
        <div id="auroDynamicAnamnesisTitle" class="auro-dyn-title"></div>
        <div id="auroDynamicAnamnesisMeta" class="auro-dyn-meta"></div>
        <div id="auroDynamicAnamnesisFields" class="auro-dyn-grid"></div>
        <div class="auro-clinical-warning">La redacción generada debe ser revisada por el profesional antes de guardar.</div>
        <div class="auro-dyn-footer">
          <button type="button" class="auro-anamnesis-btn danger" id="auroDynamicLimpiar">Limpiar</button>
          <button type="button" class="auro-anamnesis-btn" id="auroDynamicCerrar">Cerrar</button>
          <button type="button" class="auro-anamnesis-btn primary" id="auroDynamicGenerar"><i class="bi bi-magic"></i> Generar enfermedad actual</button>
        </div>
      </div>
    `;

    const status = $('auroAnamnesisEstado');
    if (status) status.insertAdjacentElement('afterend', root);
    else assistant.appendChild(root);

    $('auroPlantillaAnamnesisSelect')?.addEventListener('change', event => {
      selectTemplate(event.target.value, true);
    });
    $('auroRecargarPlantillas')?.addEventListener('click', () => loadTemplates(true));
    $('auroDynamicLimpiar')?.addEventListener('click', clearDynamic);
    $('auroDynamicCerrar')?.addEventListener('click', closeDynamic);
    $('auroDynamicGenerar')?.addEventListener('click', generateDynamic);

    const openButton = $('auroAbrirSemiologia');
    openButton?.addEventListener('click', event => {
      if (!state.loaded || !state.templates.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openDynamic();
    }, true);

    $('hcMotivoConsulta')?.addEventListener('input', detectDynamic);
  }

  function setStatus(message, type = 'info') {
    const element = $('auroAnamnesisEstado');
    if (!element) return;
    element.className = 'auro-anamnesis-estado ' + type;
    element.textContent = message;
  }

  function normalizeQuestion(raw, index, sectionName = '') {
    if (typeof raw === 'string') {
      return {
        id: 'pregunta_' + index,
        label: raw,
        type: 'text',
        required: false,
        options: [],
        placeholder: '',
        span: 1,
        section: sectionName
      };
    }

    const question = raw && typeof raw === 'object' ? raw : {};
    const id = text(question.id || question.campo || question.key || question.nombre || question.codigo || ('pregunta_' + index));
    const typeRaw = normalize(question.tipo || question.type || question.control || question.componente || 'text');
    const typeMap = {
      texto: 'text',
      text: 'text',
      numero: 'number',
      number: 'number',
      fecha: 'date',
      date: 'date',
      hora: 'time',
      time: 'time',
      textarea: 'textarea',
      parrafo: 'textarea',
      select: 'select',
      lista: 'select',
      dropdown: 'select',
      checkbox: 'checkbox',
      multiple: 'checkbox',
      multiseleccion: 'checkbox',
      radio: 'radio',
      boolean: 'boolean',
      si_no: 'boolean',
      escala: 'scale',
      eva: 'scale',
      titulo: 'section',
      seccion: 'section'
    };

    let options = question.opciones || question.options || question.valores || question.respuestas || [];
    options = arrayFrom(options).map(option => {
      if (option && typeof option === 'object') {
        return {
          value: text(option.value ?? option.valor ?? option.id ?? option.label ?? option.etiqueta),
          label: text(option.label ?? option.etiqueta ?? option.nombre ?? option.value ?? option.valor)
        };
      }
      return { value: text(option), label: text(option) };
    }).filter(option => option.value || option.label);

    const spanValue = Number(question.span || question.columnas || question.cols || 1);
    const span = spanValue >= 4 ? 4 : spanValue >= 2 ? 2 : 1;

    return {
      id: normalize(id).replace(/\s+/g, '_') || ('pregunta_' + index),
      label: text(question.label || question.etiqueta || question.pregunta || question.titulo || question.nombre || id),
      type: typeMap[typeRaw] || 'text',
      required: Boolean(question.required ?? question.requerido ?? question.obligatorio ?? false),
      options,
      placeholder: text(question.placeholder || question.ayuda || question.ejemplo || ''),
      span,
      section: text(question.seccion || question.grupo || sectionName),
      min: question.min ?? question.minimo ?? '',
      max: question.max ?? question.maximo ?? '',
      step: question.step ?? question.paso ?? '',
      prefix: text(question.prefijo || ''),
      suffix: text(question.sufijo || ''),
      narrative: text(question.narrativa || question.plantilla_narrativa || '')
    };
  }

  function extractQuestions(template) {
    const raw = safeJson(template.preguntas_json || template.preguntas || template.campos_json || template.campos, []);
    const questions = [];
    let index = 0;

    function walk(value, sectionName = '') {
      if (Array.isArray(value)) {
        value.forEach(item => walk(item, sectionName));
        return;
      }

      if (!value || typeof value !== 'object') {
        if (text(value)) questions.push(normalizeQuestion(value, ++index, sectionName));
        return;
      }

      if (Array.isArray(value.preguntas) || Array.isArray(value.campos) || Array.isArray(value.items)) {
        const title = text(value.titulo || value.nombre || value.seccion || sectionName);
        if (title) questions.push({ id: 'section_' + (++index), label: title, type: 'section', section: title, options: [], span: 4 });
        walk(value.preguntas || value.campos || value.items, title);
        return;
      }

      const looksLikeQuestion = value.pregunta || value.label || value.etiqueta || value.tipo || value.type || value.campo || value.id;
      if (looksLikeQuestion) {
        questions.push(normalizeQuestion(value, ++index, sectionName));
        return;
      }

      Object.entries(value).forEach(([key, item]) => {
        if (Array.isArray(item) || (item && typeof item === 'object')) walk(item, key);
        else questions.push(normalizeQuestion({ id: key, label: key, type: 'text', value: item }, ++index, sectionName));
      });
    }

    walk(raw);
    return questions;
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderQuestion(question) {
    if (question.type === 'section') {
      return `<div class="auro-dyn-section">${escapeHtml(question.label)}</div>`;
    }

    const id = 'auroDyn_' + question.id;
    const fieldClass = 'auro-dyn-field' + (question.span === 4 ? ' span-4' : question.span === 2 ? ' span-2' : '');
    const required = question.required ? ' required' : '';
    const requiredMark = question.required ? ' *' : '';
    const placeholder = question.placeholder ? ` placeholder="${escapeHtml(question.placeholder)}"` : '';
    const min = question.min !== '' ? ` min="${escapeHtml(question.min)}"` : '';
    const max = question.max !== '' ? ` max="${escapeHtml(question.max)}"` : '';
    const step = question.step !== '' ? ` step="${escapeHtml(question.step)}"` : '';

    let control = '';
    if (question.type === 'textarea') {
      control = `<textarea id="${id}" data-auro-question="${escapeHtml(question.id)}"${placeholder}${required}></textarea>`;
    } else if (question.type === 'select') {
      control = `<select id="${id}" data-auro-question="${escapeHtml(question.id)}"${required}><option value="">Seleccione</option>${question.options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}</select>`;
    } else if (question.type === 'checkbox' || question.type === 'radio') {
      const inputType = question.type;
      const name = 'auroDynGroup_' + question.id;
      control = `<div class="auro-dyn-options">${question.options.map(option => `<label class="auro-dyn-option"><input type="${inputType}" name="${escapeHtml(name)}" data-auro-question="${escapeHtml(question.id)}" value="${escapeHtml(option.value)}"> ${escapeHtml(option.label)}</label>`).join('')}</div>`;
    } else if (question.type === 'boolean') {
      control = `<select id="${id}" data-auro-question="${escapeHtml(question.id)}"${required}><option value="">Seleccione</option><option value="Sí">Sí</option><option value="No">No</option></select>`;
    } else if (question.type === 'scale') {
      const from = Number(question.min !== '' ? question.min : 0);
      const to = Number(question.max !== '' ? question.max : 10);
      const options = [];
      for (let value = from; value <= to && options.length < 101; value++) options.push(`<option value="${value}">${value}${question.suffix ? ' ' + escapeHtml(question.suffix) : ''}</option>`);
      control = `<select id="${id}" data-auro-question="${escapeHtml(question.id)}"${required}><option value="">Seleccione</option>${options.join('')}</select>`;
    } else {
      const type = ['number', 'date', 'time'].includes(question.type) ? question.type : 'text';
      control = `<input id="${id}" type="${type}" data-auro-question="${escapeHtml(question.id)}"${placeholder}${min}${max}${step}${required}>`;
    }

    return `<div class="${fieldClass}"><label for="${id}">${escapeHtml(question.label)}${requiredMark}</label>${control}</div>`;
  }

  function populateSelector() {
    const select = $('auroPlantillaAnamnesisSelect');
    if (!select) return;

    const previous = select.value;
    select.innerHTML = '<option value="">Seleccione una plantilla</option>' + state.templates
      .map(template => `<option value="${escapeHtml(templateId(template))}">${escapeHtml(templateName(template))}</option>`)
      .join('');

    if (previous && state.templates.some(template => templateId(template) === previous)) select.value = previous;
  }

  function matchTemplate(reason) {
    const normalizedReason = normalize(reason);
    if (!normalizedReason) return null;

    let best = null;
    let bestScore = 0;

    state.templates.forEach(template => {
      const name = normalize(templateName(template));
      const category = normalize(template.categoria_sindromica || template.categoria || '');
      const keywords = templateKeywords(template);
      let score = 0;

      if (name && normalizedReason.includes(name)) score += 100 + name.length;
      if (category && normalizedReason.includes(category)) score += 80 + category.length;

      keywords.forEach(keyword => {
        if (!keyword) return;
        if (normalizedReason.includes(keyword)) score += 40 + keyword.length;
        else {
          const words = keyword.split(' ').filter(word => word.length > 3);
          score += words.filter(word => normalizedReason.includes(word)).length * 5;
        }
      });

      if (score > bestScore) {
        best = template;
        bestScore = score;
      }
    });

    return bestScore > 0 ? best : null;
  }

  function detectDynamic() {
    if (!state.loaded || !state.templates.length) return;

    const reason = text($('hcMotivoConsulta')?.value);
    if (!reason) {
      setStatus(`Escriba el motivo de consulta o seleccione una de las ${state.templates.length} plantillas disponibles.`, 'info');
      return;
    }

    const match = matchTemplate(reason);
    if (match) {
      const id = templateId(match);
      const select = $('auroPlantillaAnamnesisSelect');
      if (select && select.value !== id) select.value = id;
      selectTemplate(id, false);
      setStatus(`Motivo reconocido: ${templateName(match)}. Puede completar la semiología.`, 'ok');
    } else {
      setStatus('No se reconoció automáticamente el síndrome. Seleccione una plantilla de la lista.', 'warn');
    }
  }

  function selectTemplate(id, openPanel) {
    const template = state.templates.find(item => templateId(item) === text(id));
    state.active = template || null;
    state.answers = {};

    const fields = $('auroDynamicAnamnesisFields');
    const title = $('auroDynamicAnamnesisTitle');
    const meta = $('auroDynamicAnamnesisMeta');
    const panel = $('auroDynamicAnamnesisPanel');

    if (!template) {
      if (fields) fields.innerHTML = '';
      if (title) title.textContent = '';
      if (meta) meta.textContent = '';
      panel?.classList.remove('show');
      return;
    }

    const questions = extractQuestions(template);
    template.__auroQuestions = questions;

    if (title) title.textContent = templateName(template);
    if (meta) {
      const parts = [template.especialidad, template.categoria_sindromica, template.version_plantilla ? 'Versión ' + template.version_plantilla : ''].map(text).filter(Boolean);
      meta.textContent = parts.join(' · ');
    }
    if (fields) {
      fields.innerHTML = questions.length
        ? questions.map(renderQuestion).join('')
        : '<div class="auro-dyn-field span-4"><div class="auro-anamnesis-estado warn">La plantilla no contiene preguntas válidas en preguntas_json.</div></div>';
    }

    if (openPanel) panel?.classList.add('show');
  }

  function openDynamic() {
    if (!state.active) {
      const match = matchTemplate($('hcMotivoConsulta')?.value);
      if (match) {
        const id = templateId(match);
        const select = $('auroPlantillaAnamnesisSelect');
        if (select) select.value = id;
        selectTemplate(id, true);
      } else {
        setStatus('Seleccione primero una plantilla de anamnesis.', 'warn');
        $('auroPlantillaAnamnesisSelect')?.focus();
        return;
      }
    }

    $('auroSemiologiaDolorPelvico')?.classList.remove('show');
    $('auroDynamicAnamnesisPanel')?.classList.add('show');
    setStatus(`Complete la plantilla ${templateName(state.active)} y genere la enfermedad actual.`, 'info');
  }

  function closeDynamic() {
    $('auroDynamicAnamnesisPanel')?.classList.remove('show');
  }

  function readAnswers() {
    if (!state.active) return {};

    const answers = {};
    const questions = state.active.__auroQuestions || extractQuestions(state.active);

    questions.forEach(question => {
      if (question.type === 'section') return;
      const selector = `[data-auro-question="${CSS.escape(question.id)}"]`;
      const controls = [...document.querySelectorAll(selector)];
      if (!controls.length) return;

      if (question.type === 'checkbox') {
        answers[question.id] = controls.filter(control => control.checked).map(control => text(control.value)).filter(Boolean);
      } else if (question.type === 'radio') {
        answers[question.id] = text(controls.find(control => control.checked)?.value);
      } else {
        answers[question.id] = text(controls[0].value);
      }
    });

    state.answers = answers;
    return answers;
  }

  function validateRequired(answers) {
    if (!state.active) return [];
    const questions = state.active.__auroQuestions || [];
    return questions.filter(question => {
      if (!question.required || question.type === 'section') return false;
      const value = answers[question.id];
      return Array.isArray(value) ? value.length === 0 : !text(value);
    });
  }

  function sentence(value) {
    const cleaned = text(value).replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1');
    if (!cleaned) return '';
    return /[.!?]$/.test(cleaned) ? cleaned : cleaned + '.';
  }

  function joinNatural(values) {
    const list = values.map(text).filter(Boolean);
    if (!list.length) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return list[0] + ' y ' + list[1];
    return list.slice(0, -1).join(', ') + ' y ' + list[list.length - 1];
  }

  function replaceTokens(templateText, answers, questions) {
    let output = text(templateText);
    const labels = Object.fromEntries(questions.map(question => [question.id, question.label]));

    Object.entries(answers).forEach(([key, value]) => {
      const replacement = Array.isArray(value) ? joinNatural(value) : text(value);
      const patterns = [
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'),
        new RegExp(`\\{\\s*${key}\\s*\\}`, 'gi'),
        new RegExp(`\\[\\s*${key}\\s*\\]`, 'gi')
      ];
      patterns.forEach(pattern => { output = output.replace(pattern, replacement); });

      const label = labels[key];
      if (label) {
        const normalizedLabel = normalize(label).replace(/\s+/g, '_');
        output = output.replace(new RegExp(`\\{\\{\\s*${normalizedLabel}\\s*\\}\\}`, 'gi'), replacement);
      }
    });

    return output
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/\{[^}]+\}/g, '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .trim();
  }

  function buildNarrative() {
    if (!state.active) return '';

    const answers = readAnswers();
    const questions = state.active.__auroQuestions || [];
    const narrativeConfig = safeJson(state.active.estructura_narrativa_json || state.active.estructura_narrativa || state.active.narrativa_json, null);

    if (typeof narrativeConfig === 'string' && narrativeConfig.trim()) {
      const resolved = replaceTokens(narrativeConfig, answers, questions);
      if (resolved) return sentence(resolved);
    }

    if (narrativeConfig && typeof narrativeConfig === 'object') {
      const rawParts = Array.isArray(narrativeConfig)
        ? narrativeConfig
        : narrativeConfig.secciones || narrativeConfig.partes || narrativeConfig.parrafos || narrativeConfig.plantilla || narrativeConfig.texto;

      if (typeof rawParts === 'string') {
        const resolved = replaceTokens(rawParts, answers, questions);
        if (resolved) return sentence(resolved);
      }

      if (Array.isArray(rawParts)) {
        const parts = rawParts.map(part => {
          if (typeof part === 'string') return replaceTokens(part, answers, questions);
          if (part && typeof part === 'object') return replaceTokens(part.texto || part.plantilla || part.narrativa || '', answers, questions);
          return '';
        }).map(sentence).filter(Boolean);
        if (parts.length) return parts.join(' ');
      }
    }

    const filled = questions
      .filter(question => question.type !== 'section')
      .map(question => {
        const value = answers[question.id];
        const formatted = Array.isArray(value) ? joinNatural(value) : text(value);
        if (!formatted) return '';
        if (question.narrative) return replaceTokens(question.narrative, { ...answers, valor: formatted }, questions);
        return `${question.label}: ${formatted}`;
      })
      .filter(Boolean);

    const reason = text($('hcMotivoConsulta')?.value) || templateName(state.active);
    const introduction = `Paciente consulta por ${reason}`;
    return sentence(introduction) + (filled.length ? ' ' + sentence('Durante la anamnesis dirigida refiere ' + filled.join('; ')) : '');
  }

  function generateDynamic() {
    const disease = $('hcEnfermedadActual');
    if (!disease || !state.active) {
      setStatus('Seleccione una plantilla válida antes de generar la enfermedad actual.', 'warn');
      return;
    }

    const answers = readAnswers();
    const missing = validateRequired(answers);
    if (missing.length) {
      setStatus('Complete los campos obligatorios: ' + missing.map(item => item.label).join(', ') + '.', 'warn');
      const first = document.querySelector(`[data-auro-question="${CSS.escape(missing[0].id)}"]`);
      first?.focus();
      return;
    }

    const narrative = buildNarrative();
    if (!narrative) {
      setStatus('La plantilla no produjo una narrativa válida.', 'warn');
      return;
    }

    if (text(disease.value) && text(disease.value) !== narrative) {
      if (!confirm('Enfermedad actual ya contiene información. ¿Desea reemplazarla?')) {
        setStatus('Se conservó el texto existente.', 'warn');
        return;
      }
    }

    disease.value = narrative;
    disease.dispatchEvent(new Event('input', { bubbles: true }));
    disease.dispatchEvent(new Event('change', { bubbles: true }));
    state.lastNarrative = narrative;

    setStatus('Enfermedad actual generada desde la plantilla dinámica. Revise antes de guardar.', 'ok');
    disease.focus();
    disease.scrollIntoView({ behavior: 'smooth', block: 'center' });

    document.dispatchEvent(new CustomEvent('auro:anamnesis-generada', {
      detail: {
        tipo: 'plantilla_dinamica',
        motor_version: ENGINE_VERSION,
        id_plantilla_anamnesis: templateId(state.active),
        plantilla: templateName(state.active),
        respuestas: answers,
        narrativa: narrative
      }
    }));
  }

  function clearDynamic() {
    $('auroDynamicAnamnesisFields')?.querySelectorAll('input,select,textarea').forEach(control => {
      if (control.type === 'checkbox' || control.type === 'radio') control.checked = false;
      else control.value = '';
    });
    state.answers = {};
    setStatus('Formulario dinámico limpio.', 'info');
  }

  async function loadTemplates(force = false) {
    if (state.loading) return;
    if (state.loaded && !force) return;

    state.loading = true;
    setStatus('Cargando plantillas de anamnesis…', 'info');

    try {
      let response;
      try {
        response = await callAppsScript('listarPlantillasAnamnesisActivas');
      } catch (firstError) {
        console.warn('AUROSANAX Anamnesis: listarPlantillasAnamnesisActivas falló; se intentará listado general.', firstError);
        response = await callAppsScript('listarPlantillasAnamnesis');
      }

      const templates = normalizeResponse(response)
        .filter(item => item && typeof item === 'object')
        .filter(isActive)
        .filter(item => templateId(item));

      if (!templates.length) throw new Error('No se encontraron plantillas activas');

      state.templates = templates;
      state.loaded = true;
      populateSelector();

      const openButton = $('auroAbrirSemiologia');
      if (openButton) openButton.innerHTML = '<i class="bi bi-clipboard2-pulse"></i> Completar anamnesis';

      setStatus(`${templates.length} plantillas activas disponibles. Escriba el motivo o seleccione una plantilla.`, 'ok');
      detectDynamic();

      console.info(`AUROSANAX Anamnesis: motor dinámico ${ENGINE_VERSION} activo con ${templates.length} plantillas.`);
    } catch (error) {
      state.loaded = false;
      state.templates = [];
      state.active = null;
      console.warn('AUROSANAX Anamnesis: se mantiene el modo compatible de dolor pélvico.', error);
      setStatus('No fue posible cargar el catálogo dinámico. Se mantiene disponible la plantilla local de dolor pélvico.', 'warn');
    } finally {
      state.loading = false;
    }
  }

  function getDynamicData() {
    return {
      motor_version: ENGINE_VERSION,
      catalogo_cargado: state.loaded,
      id_plantilla_anamnesis: state.active ? templateId(state.active) : '',
      nombre_plantilla: state.active ? templateName(state.active) : '',
      respuestas: state.active ? readAnswers() : {},
      narrativa_generada: state.lastNarrative
    };
  }

  function extendPublicApi() {
    window.auroAnamnesisDinamica = {
      version: ENGINE_VERSION,
      cargarPlantillas: loadTemplates,
      detectar: detectDynamic,
      abrir: openDynamic,
      cerrar: closeDynamic,
      limpiar: clearDynamic,
      generar: generateDynamic,
      obtenerDatos: getDynamicData,
      seleccionarPlantilla: selectTemplate
    };

    const originalGetter = window.auroObtenerDatosAnamnesis;
    window.auroObtenerDatosAnamnesis = function () {
      const base = typeof originalGetter === 'function' ? originalGetter() : {};
      return { ...base, plantilla_dinamica: getDynamicData() };
    };

    if (window.auroAnamnesis && typeof window.auroAnamnesis === 'object') {
      window.auroAnamnesis.obtenerDatosAnamnesis = window.auroObtenerDatosAnamnesis;
      window.auroAnamnesis.motorDinamico = window.auroAnamnesisDinamica;
    }
  }

  function init() {
    if (!$('hc_anamnesis') || !$('hcMotivoConsulta') || !$('hcEnfermedadActual') || !$('auroAnamnesisAsistente')) return false;
    installStyles();
    buildContainer();
    extendPublicApi();
    loadTemplates(false);
    return true;
  }

  if (!init()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (init() || attempts >= 20) clearInterval(timer);
    }, 300);
  }
})();
