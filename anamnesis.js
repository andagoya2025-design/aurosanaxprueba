/*
AUROSANAX ERP - MÓDULO ANAMNESIS INTELIGENTE
Archivo: anamnesis.js
Versión: 1.2.0

Función:
- Detectar "dolor pélvico" en #hcMotivoConsulta.
- Mostrar formulario semiológico.
- Generar texto editable en #hcEnfermedadActual.
- Ocultar en Anamnesis los campos #hcRevisionSistemas y #hcSintomasAlarma para evitar duplicidad.
- No escribir información en esos campos.
- No modifica el guardado ni la base de datos existente.
*/

(function () {
  'use strict';

  const VERSION = '1.2.0';
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

  function crearBloqueSintomasActuales() {
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
