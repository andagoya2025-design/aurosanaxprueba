/*
AUROSANAX ERP - MOTOR DINÁMICO DE ANAMNESIS SINDRÓMICA
Archivo: anamnesis.js
Versión: 3.3.0

Función:
- Consultar las plantillas activas desde plantillas_anamnesis.
- Detectar la plantilla por palabras_clave y especialidad.
- Construir el formulario desde preguntas_json.
- Generar la enfermedad actual desde estructura_narrativa_json.
- No contiene enfermedades ni síndromes programados de forma fija.
- No modifica el guardado general ni otros módulos del ERP.
*/
(function () {
  'use strict';

  const VERSION = '3.3.0';
  const state = {
    inicializado: false,
    cargando: false,
    cargado: false,
    plantillas: [],
    plantillaActiva: null,
    preguntas: [],
    respuestas: {},
    narrativa: ''
  };

  const $ = id => document.getElementById(id);
  const texto = valor => String(valor ?? '').trim();

  function normalizar(valor) {
    return texto(valor)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function humanizarClave(valor) {
    const limpio = texto(valor)
      .replace(/[_-]+/g, ' ')
      .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();

    if (!limpio) return '';
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
  }

  function esCampoMotivoAutomatico(id) {
    const clave = normalizar(id).replace(/\s+/g, '_');
    return [
      'motivo',
      'motivo_consulta',
      'motivo_de_consulta',
      'razon_consulta',
      'razon_de_consulta'
    ].includes(clave);
  }

  function escaparHtml(valor) {
    return texto(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parsearJsonSeguro(valor, defecto) {
    if (valor == null || valor === '') return defecto;
    if (typeof valor === 'object') return valor;
    try {
      return JSON.parse(valor);
    } catch (error) {
      console.warn('AUROSANAX Anamnesis: JSON inválido.', error);
      return defecto;
    }
  }

  function convertirArray(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor == null || valor === '') return [];

    if (typeof valor === 'string') {
      const json = parsearJsonSeguro(valor, null);
      if (Array.isArray(json)) return json;
      return valor.split(/[,;|\n]/).map(texto).filter(Boolean);
    }

    if (typeof valor === 'object') return Object.values(valor);
    return [valor];
  }

  function obtenerApiUrl() {
    if (typeof window.auroApiUrlGlobal === 'function') {
      const url = texto(window.auroApiUrlGlobal());
      if (url) return url;
    }

    return texto(
      window.API_URL ||
      window.APP_SCRIPT_URL ||
      localStorage.getItem('AUROSANAX_API_URL')
    );
  }

  async function consultarAccion(accion, parametros = {}) {
    const api = obtenerApiUrl();
    if (!api) throw new Error('No se encontró la URL pública de Apps Script.');

    const url = new URL(api);
    url.searchParams.set('accion', accion);
    url.searchParams.set('action', accion);

    Object.entries(parametros).forEach(([clave, valor]) => {
      if (valor != null && valor !== '') url.searchParams.set(clave, valor);
    });

    const respuesta = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow'
    });

    if (!respuesta.ok) {
      throw new Error(`Apps Script respondió HTTP ${respuesta.status}.`);
    }

    const contenido = await respuesta.text();
    const json = parsearJsonSeguro(contenido, null);

    if (json == null) {
      throw new Error('Apps Script no devolvió un JSON válido.');
    }

    return json;
  }

  function normalizarRespuesta(respuesta) {
    let valor = respuesta;
    if (typeof valor === 'string') valor = parsearJsonSeguro(valor, []);

    if (Array.isArray(valor)) return valor;
    if (!valor || typeof valor !== 'object') return [];

    const candidatos = [
      valor.data,
      valor.datos,
      valor.resultado,
      valor.result,
      valor.registros,
      valor.plantillas,
      valor.items
    ];

    for (const candidato of candidatos) {
      if (Array.isArray(candidato)) return candidato;
      if (typeof candidato === 'string') {
        const convertido = parsearJsonSeguro(candidato, []);
        if (Array.isArray(convertido)) return convertido;
      }
    }

    return [];
  }

  function idPlantilla(plantilla) {
    return texto(
      plantilla.id_plantilla_anamnesis ||
      plantilla.id_plantilla ||
      plantilla.id ||
      plantilla.codigo
    );
  }

  function nombrePlantilla(plantilla) {
    return texto(
      plantilla.nombre_plantilla ||
      plantilla.nombre ||
      plantilla.titulo ||
      plantilla.categoria_sindromica ||
      'Plantilla de anamnesis'
    );
  }

  function plantillaActiva(plantilla) {
    const estado = normalizar(plantilla.estado ?? plantilla.activo ?? 'activo');
    return !['inactivo', '0', 'false', 'archivado', 'eliminado'].includes(estado);
  }

  function palabrasClave(plantilla) {
    return convertirArray(
      plantilla.palabras_clave ||
      plantilla.keywords ||
      plantilla.sinonimos ||
      ''
    )
      .flatMap(item => typeof item === 'string' ? item.split(/[,;|\n]/) : [item])
      .map(normalizar)
      .filter(Boolean);
  }

  function especialidadActual() {
    const selectores = [...document.querySelectorAll('#hc_anamnesis select')];
    const selector = selectores.find(item => {
      const bloque = item.closest('.col-md-3, .col-md-4, .form-group');
      return normalizar(bloque?.querySelector('label')?.textContent) === 'especialidad';
    });
    return texto(selector?.value);
  }

  function puntuarPlantilla(plantilla, motivo) {
    const consulta = normalizar(motivo);
    if (!consulta) return 0;

    let puntos = 0;
    const nombre = normalizar(nombrePlantilla(plantilla));
    const categoria = normalizar(plantilla.categoria_sindromica || '');
    const especialidad = normalizar(plantilla.especialidad || '');
    const especialidadSeleccionada = normalizar(especialidadActual());

    if (nombre && consulta === nombre) puntos += 1000;
    else if (nombre && consulta.includes(nombre)) puntos += 500 + nombre.length;

    if (categoria && consulta.includes(categoria)) puntos += 350 + categoria.length;

    palabrasClave(plantilla).forEach(clave => {
      if (consulta === clave) puntos += 800 + clave.length;
      else if (consulta.includes(clave)) puntos += 300 + clave.length;
      else {
        const partes = clave.split(' ').filter(p => p.length >= 4);
        const coincidencias = partes.filter(p => consulta.includes(p)).length;
        if (partes.length >= 2 && coincidencias >= 2) {
          puntos += coincidencias * 15;
        }
      }
    });

    if (especialidadSeleccionada && especialidad) {
      if (especialidadSeleccionada === especialidad) puntos += 50;
      else if (
        especialidadSeleccionada.includes(especialidad) ||
        especialidad.includes(especialidadSeleccionada)
      ) puntos += 25;
    }

    return puntos;
  }

  function buscarPlantilla(motivo) {
    let mejor = null;
    let mejorPuntaje = 0;

    state.plantillas.forEach(plantilla => {
      const puntaje = puntuarPlantilla(plantilla, motivo);
      if (puntaje > mejorPuntaje) {
        mejor = plantilla;
        mejorPuntaje = puntaje;
      }
    });

    return mejorPuntaje > 0 ? mejor : null;
  }

  function estado(mensaje, tipo = 'info') {
    const elemento = $('auroAnamnesisEstado');
    if (!elemento) return;
    elemento.className = `auro-anamnesis-estado ${tipo}`;
    elemento.textContent = mensaje;
  }

  function ocultarCamposDuplicados() {
    ['hcRevisionSistemas', 'hcSintomasAlarma'].forEach(id => {
      const campo = $(id);
      if (!campo) return;
      const bloque = campo.closest('.col-md-6, .col-md-12') || campo.parentElement;
      if (bloque) {
        bloque.style.display = 'none';
        bloque.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function instalarEstilos() {
    if ($('auroAnamnesisStylesV3')) return;

    const style = document.createElement('style');
    style.id = 'auroAnamnesisStylesV3';
    style.textContent = `
      .auro-anamnesis-box{border:1px solid #fbcfe8;background:linear-gradient(135deg,#fff,#fff7fb);border-radius:18px;padding:14px;margin-top:10px;box-shadow:0 8px 24px rgba(139,30,90,.06)}
      .auro-anamnesis-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
      .auro-anamnesis-title{font-weight:900;color:#7a174f;display:flex;align-items:center;gap:8px}
      .auro-anamnesis-subtitle{color:#6b7280;font-size:13px;margin-top:3px}
      .auro-anamnesis-btn{border:1px solid #fbcfe8;background:#fdf2f8;color:#8b1e5a;border-radius:12px;padding:8px 11px;font-weight:800;font-size:13px;cursor:pointer}
      .auro-anamnesis-btn.primary{border:0;background:linear-gradient(135deg,#8b1e5a,#c23b83);color:#fff}
      .auro-anamnesis-btn.danger{background:#fff;color:#991b1b;border-color:#fecaca}
      .auro-anamnesis-btn:disabled{opacity:.55;cursor:not-allowed}
      .auro-anamnesis-estado{margin-top:10px;border-radius:12px;padding:8px 10px;font-size:12.5px;font-weight:700}
      .auro-anamnesis-estado.info{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe}
      .auro-anamnesis-estado.ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
      .auro-anamnesis-estado.warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}
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
      .auro-dyn-field input,.auro-dyn-field select,.auro-dyn-field textarea{width:100%;border:1px solid #d1d5db;border-radius:12px;padding:8px 10px;background:#fff;color:#111827;font:inherit;font-size:13px}
      .auro-dyn-field textarea{min-height:74px;resize:vertical}
      .auro-dyn-options{display:flex;flex-wrap:wrap;gap:7px}
      .auro-dyn-option{display:inline-flex;align-items:center;gap:5px;border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:6px 9px;font-size:12px;color:#374151;cursor:pointer}
      .auro-dyn-option input{width:15px;height:15px;accent-color:#8b1e5a}
      .auro-dyn-section{grid-column:1/-1;font-weight:900;color:#7a174f;border-bottom:1px solid #f3d8e7;padding:5px 0 3px;margin-top:4px}
      .auro-dyn-footer{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px}
      .auro-clinical-warning{margin-top:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:9px 10px;font-size:12px}
      @media(max-width:980px){.auro-dyn-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.auro-dyn-toolbar{grid-template-columns:1fr}.auro-dyn-grid{grid-template-columns:1fr}.auro-dyn-field.span-2,.auro-dyn-field.span-4{grid-column:auto}.auro-anamnesis-btn{width:100%}}

      /* Secciones clínicas preexistentes que deben conservarse */
      #hc_anamnesis .gin-panel,
      #hc_anamnesis .obs-panel{
        border:1px solid #e5e7eb;
        border-radius:20px;
        padding:16px;
        background:#fff;
        margin-top:16px;
      }
      #hc_anamnesis .gin-panel-title,
      #hc_anamnesis .obs-panel-title{
        font-weight:900;
        color:#111827;
        margin-bottom:12px;
        display:flex;
        align-items:center;
        gap:8px;
      }
      #hc_anamnesis .gin-panel-title i,
      #hc_anamnesis .obs-panel-title i{color:#8b1e5a}
      #hc_anamnesis .gin-check-grid,
      #hc_anamnesis .obs-check-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }
      #hc_anamnesis .gin-check,
      #hc_anamnesis .obs-check{
        border:1px solid #e5e7eb;
        border-radius:14px;
        padding:9px 10px;
        display:flex;
        align-items:center;
        gap:8px;
        background:#fff;
        cursor:pointer;
        min-width:0;
      }
      #hc_anamnesis .gin-check:hover,
      #hc_anamnesis .obs-check:hover{
        border-color:#f9a8d4;
        background:#fff7fb;
      }
      #hc_anamnesis .gin-check input,
      #hc_anamnesis .obs-check input{
        width:17px;
        height:17px;
        accent-color:#8b1e5a;
        flex:0 0 auto;
      }
      #hc_anamnesis .gin-check span,
      #hc_anamnesis .obs-check span{
        min-width:0;
        line-height:1.25;
      }
      @media(max-width:1100px){
        #hc_anamnesis .gin-check-grid,
        #hc_anamnesis .obs-check-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
      }
      @media(max-width:760px){
        #hc_anamnesis .gin-check-grid,
        #hc_anamnesis .obs-check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
      @media(max-width:460px){
        #hc_anamnesis .gin-check-grid,
        #hc_anamnesis .obs-check-grid{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }


  function checkSintomaActual(id, etiqueta) {
    return `<label class="gin-check"><input id="${id}" type="checkbox"><span>${etiqueta}</span></label>`;
  }

  function crearBloqueSintomasActuales() {
    /*
      Esta sección formaba parte del módulo clínico original.
      Se conserva de manera independiente del motor de plantillas.
    */
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

  function checkSintomaObstetrico(id, etiqueta) {
    return `<label class="obs-check"><input id="${id}" type="checkbox"><span>${etiqueta}</span></label>`;
  }

  function crearBloqueSintomasObstetricos() {
    /*
      Esta sección también se conserva de manera independiente.
      El motor dinámico no debe borrarla ni sustituirla.
    */
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

    if (referencia) {
      referencia.insertAdjacentElement('afterend', bloque);
    } else {
      const contenedor =
        enfermedad.closest('.col-md-12, .col-12, .form-group') ||
        enfermedad.parentElement;
      contenedor?.insertAdjacentElement('afterend', bloque);
    }
  }

  function crearInterfaz() {
    if ($('auroAnamnesisAsistente')) return;

    const motivo = $('hcMotivoConsulta');
    if (!motivo) return;

    const contenedor = motivo.closest('.col-md-12') || motivo.parentElement;
    if (!contenedor) return;

    const caja = document.createElement('div');
    caja.id = 'auroAnamnesisAsistente';
    caja.className = 'auro-anamnesis-box';
    caja.innerHTML = `
      <div class="auro-anamnesis-head">
        <div>
          <div class="auro-anamnesis-title"><i class="bi bi-clipboard2-pulse"></i> Asistente de anamnesis sindrómica</div>
          <div class="auro-anamnesis-subtitle">Selecciona la plantilla según el motivo y genera una redacción clínica editable.</div>
        </div>
        <button type="button" class="auro-anamnesis-btn primary" id="auroAbrirAnamnesis" disabled>
          <i class="bi bi-clipboard2-check"></i> Completar anamnesis
        </button>
      </div>

      <div id="auroAnamnesisEstado" class="auro-anamnesis-estado info">
        Cargando catálogo de plantillas…
      </div>

      <div class="auro-dyn-toolbar">
        <div>
          <label for="auroPlantillaAnamnesisSelect">Plantilla sindrómica</label>
          <select id="auroPlantillaAnamnesisSelect" disabled>
            <option value="">Cargando plantillas…</option>
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

        <div class="auro-clinical-warning">
          La redacción generada debe ser revisada por el profesional antes de guardar.
        </div>

        <div class="auro-dyn-footer">
          <button type="button" class="auro-anamnesis-btn danger" id="auroDynamicLimpiar">Limpiar</button>
          <button type="button" class="auro-anamnesis-btn" id="auroDynamicCerrar">Cerrar</button>
          <button type="button" class="auro-anamnesis-btn primary" id="auroDynamicGenerar">
            <i class="bi bi-magic"></i> Generar enfermedad actual
          </button>
        </div>
      </div>
    `;

    contenedor.appendChild(caja);

    $('auroPlantillaAnamnesisSelect')?.addEventListener('change', evento => {
      seleccionarPlantilla(evento.target.value, true);
    });
    $('auroRecargarPlantillas')?.addEventListener('click', () => cargarPlantillas(true));
    $('auroAbrirAnamnesis')?.addEventListener('click', abrir);
    $('auroDynamicLimpiar')?.addEventListener('click', limpiar);
    $('auroDynamicCerrar')?.addEventListener('click', cerrar);
    $('auroDynamicGenerar')?.addEventListener('click', generar);
    motivo.addEventListener('input', detectar);
  }


  function opcionesRapidasPorCampo(id) {
    const clave = normalizar(id).replace(/\s+/g, '_');

    const catalogo = {
      inicio: ['Súbito', 'Gradual', 'Insidioso'],
      evolucion: ['Estable', 'Progresiva', 'Intermitente', 'Recurrente', 'En mejoría'],
      color: ['Blanco', 'Transparente', 'Amarillo', 'Verdoso', 'Grisáceo', 'Marrón', 'Sanguinolento'],
      olor: ['Sin olor', 'Leve', 'Fétido', 'A pescado', 'Otro'],
      cantidad: ['Escasa', 'Moderada', 'Abundante'],
      consistencia: ['Acuosa', 'Cremosa', 'Espesa', 'Grumosa', 'Mucosa', 'Espumosa'],
      patron: ['Continuo', 'Intermitente', 'Cíclico', 'Irregular'],
      caracter: ['Cólico', 'Punzante', 'Opresivo', 'Urente', 'Sordo', 'Pulsátil'],
      intensidad_0_10: Array.from({ length: 11 }, (_, i) => String(i)),
      prurito: ['No', 'Sí'],
      ardor: ['No', 'Sí'],
      disuria: ['No', 'Sí'],
      fiebre: ['No', 'Sí'],
      dolor_pelvico: ['No', 'Sí'],
      sangrado_vaginal: ['No', 'Sí'],
      sangrado_postcoital: ['No', 'Sí'],
      relaciones_sin_proteccion: ['No', 'Sí'],
      nueva_pareja: ['No', 'Sí'],
      tratamientos_previos: ['No', 'Sí'],
      embarazo_posible: ['No', 'Sí', 'Por confirmar'],
      posibilidad_embarazo: ['No', 'Sí', 'Por confirmar'],
      coágulos: ['No', 'Sí'],
      mareo_o_sincope: ['No', 'Sí'],
      palpitaciones: ['No', 'Sí'],
      anticoncepcion: ['No', 'Sí'],
      medicacion_anticoagulante: ['No', 'Sí'],
      movimientos_fetales: ['Presentes', 'Disminuidos', 'No percibidos', 'No aplica'],
      perdida_liquido: ['No', 'Sí'],
      contracciones: ['No', 'Sí'],
      cefalea: ['No', 'Sí'],
      fosfenos: ['No', 'Sí'],
      epigastralgia: ['No', 'Sí'],
      edema: ['No', 'Sí'],
      adherencia_suplementos: ['Adecuada', 'Parcial', 'No cumple'],
      laxitud_percibida: ['Leve', 'Moderada', 'Severa'],
      sequedad: ['No', 'Sí'],
      dolor_relaciones: ['No', 'Sí'],
      incontinencia: ['No', 'Sí'],
      infecciones_recurrentes: ['No', 'Sí'],
      contraindicaciones: ['No', 'Sí']
    };

    return (catalogo[clave] || []).map(valor => ({ value: valor, label: valor }));
  }

  function tipoRapidoPorCampo(id) {
    const opciones = opcionesRapidasPorCampo(id);
    if (opciones.length) return 'select';

    const clave = normalizar(id).replace(/\s+/g, '_');
    if (clave.includes('fecha') || clave === 'fum' || clave === 'fpp') return 'date';
    if (clave.includes('descripcion') || clave.includes('observacion') || clave.includes('antecedentes')) return 'textarea';
    return 'text';
  }

  function placeholderRapidoPorCampo(id) {
    const clave = normalizar(id).replace(/\s+/g, '_');
    const ayudas = {
      tiempo_evolucion: 'Ej. 3 días',
      duracion: 'Ej. horas o días',
      frecuencia: 'Ej. diaria o intermitente',
      localizacion: 'Especifique localización',
      irradiacion: 'Especifique o indique sin irradiación',
      factores_agravantes: 'Ej. actividad, menstruación, relaciones',
      factores_aliviantes: 'Ej. reposo, analgésicos',
      medicacion_actual: 'Medicamento, dosis y frecuencia',
      tratamientos_previos: 'Especifique tratamiento y respuesta',
      signos_de_alarma: 'Describa signos de alarma presentes',
      sintomas_asociados: 'Describa síntomas asociados'
    };
    return ayudas[clave] || '';
  }

  function aplicarSugerenciasPregunta(pregunta) {
    if (pregunta.options?.length) return pregunta;

    const opciones = opcionesRapidasPorCampo(pregunta.id);
    if (opciones.length) {
      pregunta.type = 'select';
      pregunta.options = opciones;
    } else if (!pregunta.placeholder) {
      pregunta.placeholder = placeholderRapidoPorCampo(pregunta.id);
    }

    return pregunta;
  }

  function normalizarPregunta(valor, indice, seccion = '') {
    if (typeof valor === 'string') {
      const idTexto = normalizar(valor).replace(/\s+/g, '_') || `pregunta_${indice}`;
      return {
        id: idTexto,
        label: humanizarClave(valor),
        type: tipoRapidoPorCampo(idTexto),
        required: false,
        options: opcionesRapidasPorCampo(idTexto),
        placeholder: placeholderRapidoPorCampo(idTexto),
        span: 1,
        section: seccion
      };
    }

    const pregunta = valor && typeof valor === 'object' ? valor : {};
    const idBase = texto(
      pregunta.id ||
      pregunta.campo ||
      pregunta.key ||
      pregunta.codigo ||
      pregunta.nombre ||
      `pregunta_${indice}`
    );

    const tipoBase = normalizar(
      pregunta.tipo ||
      pregunta.type ||
      pregunta.control ||
      pregunta.componente ||
      'text'
    );

    const mapaTipos = {
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

    const opciones = convertirArray(
      pregunta.opciones ||
      pregunta.options ||
      pregunta.valores ||
      pregunta.respuestas ||
      []
    ).map(opcion => {
      if (opcion && typeof opcion === 'object') {
        return {
          value: texto(opcion.value ?? opcion.valor ?? opcion.id ?? opcion.label ?? opcion.etiqueta),
          label: texto(opcion.label ?? opcion.etiqueta ?? opcion.nombre ?? opcion.value ?? opcion.valor)
        };
      }
      return { value: texto(opcion), label: texto(opcion) };
    }).filter(opcion => opcion.value || opcion.label);

    const columnas = Number(pregunta.span || pregunta.columnas || pregunta.cols || 1);
    const span = columnas >= 4 ? 4 : columnas >= 2 ? 2 : 1;

    return aplicarSugerenciasPregunta({
      id: normalizar(idBase).replace(/\s+/g, '_') || `pregunta_${indice}`,
      label: texto(
        pregunta.label ||
        pregunta.etiqueta ||
        pregunta.pregunta ||
        pregunta.titulo ||
        pregunta.nombre ||
        humanizarClave(idBase)
      ),
      type: mapaTipos[tipoBase] || 'text',
      required: Boolean(
        pregunta.required ??
        pregunta.requerido ??
        pregunta.obligatorio ??
        false
      ),
      options: opciones,
      placeholder: texto(pregunta.placeholder || pregunta.ayuda || pregunta.ejemplo || ''),
      span,
      section: texto(pregunta.seccion || pregunta.grupo || seccion),
      min: pregunta.min ?? pregunta.minimo ?? '',
      max: pregunta.max ?? pregunta.maximo ?? '',
      step: pregunta.step ?? pregunta.paso ?? '',
      suffix: texto(pregunta.sufijo || ''),
      narrative: texto(pregunta.narrativa || pregunta.plantilla_narrativa || '')
    });
  }

  function extraerPreguntas(plantilla) {
    const origen = parsearJsonSeguro(
      plantilla.preguntas_json ||
      plantilla.preguntas ||
      plantilla.campos_json ||
      plantilla.campos,
      []
    );

    const preguntas = [];
    let indice = 0;

    function recorrer(valor, seccion = '') {
      if (Array.isArray(valor)) {
        valor.forEach(item => recorrer(item, seccion));
        return;
      }

      if (!valor || typeof valor !== 'object') {
        if (texto(valor)) preguntas.push(normalizarPregunta(valor, ++indice, seccion));
        return;
      }

      const lista = valor.preguntas || valor.campos || valor.items;
      if (Array.isArray(lista)) {
        const titulo = texto(valor.titulo || valor.nombre || valor.seccion || seccion);
        if (titulo) {
          preguntas.push({
            id: `seccion_${++indice}`,
            label: titulo,
            type: 'section',
            options: [],
            span: 4
          });
        }
        recorrer(lista, titulo);
        return;
      }

      const parecePregunta =
        valor.pregunta ||
        valor.label ||
        valor.etiqueta ||
        valor.tipo ||
        valor.type ||
        valor.campo ||
        valor.id;

      if (parecePregunta) {
        preguntas.push(normalizarPregunta(valor, ++indice, seccion));
        return;
      }

      Object.entries(valor).forEach(([clave, item]) => {
        if (Array.isArray(item) || (item && typeof item === 'object')) {
          recorrer(item, clave);
        } else {
          preguntas.push(
            normalizarPregunta(
              { id: clave, label: clave, type: 'text' },
              ++indice,
              seccion
            )
          );
        }
      });
    }

    recorrer(origen);
    return preguntas;
  }

  function renderizarPregunta(pregunta) {
    if (pregunta.type === 'section') {
      return `<div class="auro-dyn-section">${escaparHtml(pregunta.label)}</div>`;
    }

    const id = `auroDyn_${pregunta.id}`;
    const clase = `auro-dyn-field${pregunta.span === 4 ? ' span-4' : pregunta.span === 2 ? ' span-2' : ''}`;
    const requerido = pregunta.required ? ' required' : '';
    const marca = pregunta.required ? ' *' : '';
    const esMotivoAutomatico = esCampoMotivoAutomatico(pregunta.id);
    const valorMotivo = esMotivoAutomatico ? texto($('hcMotivoConsulta')?.value) : '';
    const placeholder = pregunta.placeholder ? ` placeholder="${escaparHtml(pregunta.placeholder)}"` : '';
    const min = pregunta.min !== '' ? ` min="${escaparHtml(pregunta.min)}"` : '';
    const max = pregunta.max !== '' ? ` max="${escaparHtml(pregunta.max)}"` : '';
    const step = pregunta.step !== '' ? ` step="${escaparHtml(pregunta.step)}"` : '';

    let control = '';

    if (esMotivoAutomatico) {
      control = `<input id="${id}" type="hidden" data-auro-question="${escaparHtml(pregunta.id)}" value="${escaparHtml(valorMotivo)}">`;
      return '';
    } else if (pregunta.type === 'textarea') {
      control = `<textarea id="${id}" data-auro-question="${escaparHtml(pregunta.id)}"${placeholder}${requerido}></textarea>`;
    } else if (pregunta.type === 'select') {
      control = `
        <select id="${id}" data-auro-question="${escaparHtml(pregunta.id)}"${requerido}>
          <option value="">Seleccione</option>
          ${pregunta.options.map(opcion =>
            `<option value="${escaparHtml(opcion.value)}">${escaparHtml(opcion.label)}</option>`
          ).join('')}
        </select>`;
    } else if (pregunta.type === 'checkbox' || pregunta.type === 'radio') {
      const tipo = pregunta.type;
      const nombre = `auroDynGroup_${pregunta.id}`;
      control = `
        <div class="auro-dyn-options">
          ${pregunta.options.map(opcion => `
            <label class="auro-dyn-option">
              <input type="${tipo}" name="${escaparHtml(nombre)}"
                data-auro-question="${escaparHtml(pregunta.id)}"
                value="${escaparHtml(opcion.value)}">
              ${escaparHtml(opcion.label)}
            </label>
          `).join('')}
        </div>`;
    } else if (pregunta.type === 'boolean') {
      control = `
        <select id="${id}" data-auro-question="${escaparHtml(pregunta.id)}"${requerido}>
          <option value="">Seleccione</option>
          <option value="Sí">Sí</option>
          <option value="No">No</option>
        </select>`;
    } else if (pregunta.type === 'scale') {
      const inicio = Number(pregunta.min !== '' ? pregunta.min : 0);
      const fin = Number(pregunta.max !== '' ? pregunta.max : 10);
      const opciones = [];
      for (let valor = inicio; valor <= fin && opciones.length < 101; valor++) {
        opciones.push(
          `<option value="${valor}">${valor}${pregunta.suffix ? ' ' + escaparHtml(pregunta.suffix) : ''}</option>`
        );
      }
      control = `
        <select id="${id}" data-auro-question="${escaparHtml(pregunta.id)}"${requerido}>
          <option value="">Seleccione</option>
          ${opciones.join('')}
        </select>`;
    } else {
      const tipo = ['number', 'date', 'time'].includes(pregunta.type)
        ? pregunta.type
        : 'text';
      control = `<input id="${id}" type="${tipo}" data-auro-question="${escaparHtml(pregunta.id)}"${placeholder}${min}${max}${step}${requerido}>`;
    }

    return `
      <div class="${clase}">
        <label for="${id}">${escaparHtml(pregunta.label)}${marca}</label>
        ${control}
      </div>`;
  }

  function llenarSelector() {
    const selector = $('auroPlantillaAnamnesisSelect');
    if (!selector) return;

    selector.disabled = false;
    selector.innerHTML = `
      <option value="">Seleccione una plantilla</option>
      ${state.plantillas.map(plantilla =>
        `<option value="${escaparHtml(idPlantilla(plantilla))}">${escaparHtml(nombrePlantilla(plantilla))}</option>`
      ).join('')}
    `;
  }

  function seleccionarPlantilla(id, abrirPanel = false) {
    const plantilla = state.plantillas.find(item => idPlantilla(item) === texto(id)) || null;
    state.plantillaActiva = plantilla;
    state.respuestas = {};
    state.preguntas = plantilla ? extraerPreguntas(plantilla) : [];

    const panel = $('auroDynamicAnamnesisPanel');
    const titulo = $('auroDynamicAnamnesisTitle');
    const meta = $('auroDynamicAnamnesisMeta');
    const campos = $('auroDynamicAnamnesisFields');
    const boton = $('auroAbrirAnamnesis');

    if (!plantilla) {
      if (titulo) titulo.textContent = '';
      if (meta) meta.textContent = '';
      if (campos) campos.innerHTML = '';
      panel?.classList.remove('show');
      if (boton) boton.disabled = true;
      return;
    }

    if (titulo) titulo.textContent = nombrePlantilla(plantilla);

    if (meta) {
      meta.textContent = [
        plantilla.especialidad,
        plantilla.categoria_sindromica,
        plantilla.version_plantilla ? `Versión ${plantilla.version_plantilla}` : ''
      ].map(texto).filter(Boolean).join(' · ');
    }

    if (campos) {
      campos.innerHTML = state.preguntas.length
        ? state.preguntas.map(renderizarPregunta).join('')
        : '<div class="auro-dyn-field span-4"><div class="auro-anamnesis-estado warn">Esta plantilla no contiene preguntas válidas en preguntas_json.</div></div>';

      state.preguntas
        .filter(pregunta => pregunta.type !== 'section' && esCampoMotivoAutomatico(pregunta.id))
        .forEach(pregunta => {
          const oculto = document.createElement('input');
          oculto.type = 'hidden';
          oculto.dataset.auroQuestion = pregunta.id;
          oculto.value = texto($('hcMotivoConsulta')?.value);
          campos.appendChild(oculto);
        });
    }

    if (boton) boton.disabled = false;
    if (abrirPanel) panel?.classList.add('show');
  }

  function detectar() {
    if (!state.cargado) return;

    const motivo = texto($('hcMotivoConsulta')?.value);

    document.querySelectorAll('[data-auro-question]').forEach(control => {
      if (esCampoMotivoAutomatico(control.dataset.auroQuestion)) {
        control.value = motivo;
      }
    });
    const selector = $('auroPlantillaAnamnesisSelect');

    if (!motivo) {
      estado(`Escriba el motivo de consulta o seleccione una de las ${state.plantillas.length} plantillas disponibles.`, 'info');
      return;
    }

    const coincidencia = buscarPlantilla(motivo);

    if (!coincidencia) {
      if (selector) selector.value = '';
      seleccionarPlantilla('', false);
      estado('No se encontró una plantilla compatible. Seleccione una manualmente.', 'warn');
      return;
    }

    const id = idPlantilla(coincidencia);
    if (selector) selector.value = id;
    seleccionarPlantilla(id, false);
    estado(`Motivo reconocido: ${nombrePlantilla(coincidencia)}.`, 'ok');
  }

  function abrir() {
    if (!state.plantillaActiva) {
      detectar();
    }

    if (!state.plantillaActiva) {
      estado('Seleccione primero una plantilla de anamnesis.', 'warn');
      $('auroPlantillaAnamnesisSelect')?.focus();
      return;
    }

    $('auroDynamicAnamnesisPanel')?.classList.add('show');
    estado(`Complete la plantilla ${nombrePlantilla(state.plantillaActiva)}.`, 'info');
  }

  function cerrar() {
    $('auroDynamicAnamnesisPanel')?.classList.remove('show');
  }

  function leerRespuestas() {
    const respuestas = {};

    state.preguntas.forEach(pregunta => {
      if (pregunta.type === 'section') return;

      const selector = `[data-auro-question="${CSS.escape(pregunta.id)}"]`;
      const controles = [...document.querySelectorAll(selector)];
      if (!controles.length) return;

      if (pregunta.type === 'checkbox') {
        respuestas[pregunta.id] = controles
          .filter(control => control.checked)
          .map(control => texto(control.value))
          .filter(Boolean);
      } else if (pregunta.type === 'radio') {
        respuestas[pregunta.id] = texto(controles.find(control => control.checked)?.value);
      } else {
        respuestas[pregunta.id] = texto(controles[0].value);
      }
    });

    state.respuestas = respuestas;
    return respuestas;
  }

  function validarObligatorios(respuestas) {
    return state.preguntas.filter(pregunta => {
      if (!pregunta.required || pregunta.type === 'section') return false;
      const valor = respuestas[pregunta.id];
      return Array.isArray(valor) ? valor.length === 0 : !texto(valor);
    });
  }

  function unirNatural(lista) {
    const elementos = lista.map(texto).filter(Boolean);
    if (!elementos.length) return '';
    if (elementos.length === 1) return elementos[0];
    if (elementos.length === 2) return `${elementos[0]} y ${elementos[1]}`;
    return `${elementos.slice(0, -1).join(', ')} y ${elementos.at(-1)}`;
  }

  function reemplazarVariables(plantillaTexto, respuestas) {
    let resultado = texto(plantillaTexto);

    Object.entries(respuestas).forEach(([clave, valor]) => {
      const contenido = Array.isArray(valor) ? unirNatural(valor) : texto(valor);
      const expresion = new RegExp(`\\{\\{?\\s*${clave}\\s*\\}?\\}`, 'gi');
      resultado = resultado.replace(expresion, contenido);
    });

    return resultado
      .replace(/\{\{?[^{}]+\}?\}/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .trim();
  }

  function estructuraNarrativa(plantilla) {
    return parsearJsonSeguro(
      plantilla.estructura_narrativa_json ||
      plantilla.estructura_narrativa ||
      plantilla.narrativa_json ||
      '',
      null
    );
  }

  function generarNarrativa(plantilla, respuestas) {
    const estructura = estructuraNarrativa(plantilla);

    if (typeof estructura === 'string' && texto(estructura)) {
      return reemplazarVariables(estructura, respuestas);
    }

    if (Array.isArray(estructura)) {
      return estructura
        .map(item => {
          if (typeof item === 'string') return reemplazarVariables(item, respuestas);
          if (item && typeof item === 'object') {
            return reemplazarVariables(
              item.texto || item.plantilla || item.narrativa || '',
              respuestas
            );
          }
          return '';
        })
        .map(texto)
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (estructura && typeof estructura === 'object') {
      const base = texto(
        estructura.plantilla ||
        estructura.texto ||
        estructura.narrativa ||
        estructura.formato ||
        ''
      );

      if (base) return reemplazarVariables(base, respuestas);

      const fragmentos = Object.values(estructura)
        .filter(valor => typeof valor === 'string')
        .map(valor => reemplazarVariables(valor, respuestas))
        .map(texto)
        .filter(Boolean);

      if (fragmentos.length) return fragmentos.join(' ');
    }

    const motivo = texto($('hcMotivoConsulta')?.value);

    const valores = Object.fromEntries(
      state.preguntas
        .filter(pregunta => pregunta.type !== 'section')
        .map(pregunta => {
          const valor = respuestas[pregunta.id];
          const contenido = Array.isArray(valor) ? unirNatural(valor) : texto(valor);
          return [pregunta.id, contenido];
        })
    );

    const partes = [];
    partes.push(`Paciente consulta por ${motivo || nombrePlantilla(plantilla).toLowerCase()}.`);

    const inicio = valores.inicio || valores.fecha_inicio || '';
    const tiempo = valores.tiempo_evolucion || valores.duracion || '';
    const evolucion = valores.evolucion || '';

    if (inicio || tiempo || evolucion) {
      const cronologia = [
        inicio ? `inicio ${inicio.toLowerCase()}` : '',
        tiempo ? `${tiempo} de evolución` : '',
        evolucion ? `curso ${evolucion.toLowerCase()}` : ''
      ].filter(Boolean);
      partes.push(`Cuadro de ${unirNatural(cronologia)}.`);
    }

    const caracteristicasPreferidas = [
      ['localizacion', 'localización'],
      ['color', 'color'],
      ['olor', 'olor'],
      ['cantidad', 'cantidad'],
      ['consistencia', 'consistencia'],
      ['caracter', 'carácter'],
      ['intensidad_0_10', 'intensidad'],
      ['frecuencia', 'frecuencia'],
      ['irradiacion', 'irradiación'],
      ['patron', 'patrón']
    ];

    const caracteristicas = caracteristicasPreferidas
      .map(([id, etiqueta]) => valores[id] ? `${etiqueta} ${valores[id]}` : '')
      .filter(Boolean);

    if (caracteristicas.length) {
      partes.push(`Se caracteriza por ${unirNatural(caracteristicas)}.`);
    }

    const positivos = [];
    const negativos = [];

    state.preguntas.forEach(pregunta => {
      if (pregunta.type === 'section') return;
      if ([
        'inicio','fecha_inicio','tiempo_evolucion','duracion','evolucion',
        'localizacion','color','olor','cantidad','consistencia','caracter',
        'intensidad_0_10','frecuencia','irradiacion','patron'
      ].includes(pregunta.id)) return;

      const valor = valores[pregunta.id];
      if (!valor) return;

      const normal = normalizar(valor);
      const etiqueta = humanizarClave(pregunta.label).toLowerCase();

      if (['si', 'presente', 'presentes', 'positivo'].includes(normal)) {
        positivos.push(etiqueta);
      } else if (['no', 'ausente', 'ausentes', 'negativo'].includes(normal)) {
        negativos.push(etiqueta);
      } else {
        positivos.push(`${etiqueta}: ${valor}`);
      }
    });

    if (positivos.length) {
      partes.push(`Se asocia con ${unirNatural(positivos)}.`);
    }

    if (negativos.length) {
      partes.push(`Niega ${unirNatural(negativos)}.`);
    }

    return partes
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\.\./g, '.')
      .trim();
  }

  function generar() {
    if (!state.plantillaActiva) {
      estado('Seleccione primero una plantilla.', 'warn');
      return;
    }

    const respuestas = leerRespuestas();
    const faltantes = validarObligatorios(respuestas);

    if (faltantes.length) {
      estado(
        `Complete los campos obligatorios: ${faltantes.map(item => item.label).join(', ')}.`,
        'warn'
      );
      return;
    }

    const narrativa = generarNarrativa(state.plantillaActiva, respuestas);
    const enfermedad = $('hcEnfermedadActual');

    if (!enfermedad) {
      estado('No se encontró el campo Enfermedad actual.', 'warn');
      return;
    }

    if (texto(enfermedad.value) && texto(enfermedad.value) !== narrativa) {
      const reemplazar = confirm('Enfermedad actual ya contiene información. ¿Desea reemplazarla?');
      if (!reemplazar) {
        estado('Se conservó el texto existente.', 'warn');
        return;
      }
    }

    enfermedad.value = narrativa;
    enfermedad.dispatchEvent(new Event('input', { bubbles: true }));
    enfermedad.dispatchEvent(new Event('change', { bubbles: true }));

    state.narrativa = narrativa;

    estado('Enfermedad actual generada. Revise el texto antes de guardar.', 'ok');
    enfermedad.focus();
    enfermedad.scrollIntoView({ behavior: 'smooth', block: 'center' });

    document.dispatchEvent(new CustomEvent('auro:anamnesis-generada', {
      detail: {
        tipo: 'plantilla_dinamica',
        version: VERSION,
        id_plantilla_anamnesis: idPlantilla(state.plantillaActiva),
        nombre_plantilla: nombrePlantilla(state.plantillaActiva),
        respuestas,
        narrativa
      }
    }));
  }

  function limpiar() {
    $('auroDynamicAnamnesisFields')
      ?.querySelectorAll('input, select, textarea')
      .forEach(control => {
        if (control.type === 'checkbox' || control.type === 'radio') {
          control.checked = false;
        } else {
          control.value = '';
        }
      });

    state.respuestas = {};
    estado('Formulario limpio.', 'info');
  }

  async function cargarPlantillas(forzar = false) {
    if (state.cargando) return;
    if (state.cargado && !forzar) return;

    state.cargando = true;
    estado('Cargando catálogo de plantillas…', 'info');

    const selector = $('auroPlantillaAnamnesisSelect');
    if (selector) {
      selector.disabled = true;
      selector.innerHTML = '<option value="">Cargando plantillas…</option>';
    }

    try {
      let respuesta;

      try {
        respuesta = await consultarAccion('listarPlantillasAnamnesisActivas');
      } catch (errorActivas) {
        console.warn('AUROSANAX Anamnesis: listado activo no disponible.', errorActivas);
        respuesta = await consultarAccion('listarPlantillasAnamnesis');
      }

      const plantillas = normalizarRespuesta(respuesta)
        .filter(item => item && typeof item === 'object')
        .filter(plantillaActiva)
        .filter(item => idPlantilla(item));

      if (!plantillas.length) {
        throw new Error('El backend no devolvió plantillas activas.');
      }

      state.plantillas = plantillas;
      state.cargado = true;
      state.plantillaActiva = null;
      state.preguntas = [];

      llenarSelector();
      estado(
        `${plantillas.length} plantillas activas disponibles. Escriba el motivo o seleccione una plantilla.`,
        'ok'
      );

      detectar();
      console.info(`AUROSANAX Anamnesis v${VERSION}: ${plantillas.length} plantillas cargadas.`);
    } catch (error) {
      state.cargado = false;
      state.plantillas = [];
      state.plantillaActiva = null;
      state.preguntas = [];

      if (selector) {
        selector.disabled = true;
        selector.innerHTML = '<option value="">No se pudieron cargar las plantillas</option>';
      }

      $('auroAbrirAnamnesis').disabled = true;
      $('auroDynamicAnamnesisPanel')?.classList.remove('show');

      estado(
        'No se pudo cargar plantillas_anamnesis. Revise la publicación de Apps Script y vuelva a actualizar.',
        'warn'
      );
      console.error('AUROSANAX Anamnesis: error al cargar plantillas.', error);
    } finally {
      state.cargando = false;
    }
  }

  function obtenerDatosAnamnesis() {
    return {
      motivo_consulta: texto($('hcMotivoConsulta')?.value),
      enfermedad_actual: texto($('hcEnfermedadActual')?.value),
      revision_sistemas: '',
      sintomas_alarma: '',
      id_plantilla_anamnesis: state.plantillaActiva
        ? idPlantilla(state.plantillaActiva)
        : '',
      nombre_plantilla: state.plantillaActiva
        ? nombrePlantilla(state.plantillaActiva)
        : '',
      respuestas_json: state.plantillaActiva ? leerRespuestas() : {},
      narrativa_generada: state.narrativa,
      modulo_version: VERSION
    };
  }

  function inicializar() {
    if (state.inicializado) return true;

    if (
      !$('hc_anamnesis') ||
      !$('hcMotivoConsulta') ||
      !$('hcEnfermedadActual')
    ) {
      return false;
    }

    instalarEstilos();
    ocultarCamposDuplicados();
    crearInterfaz();
    crearBloqueSintomasActuales();
    crearBloqueSintomasObstetricos();

    state.inicializado = true;
    cargarPlantillas(false);

    console.info(`AUROSANAX Anamnesis v${VERSION}: inicializado.`);
    return true;
  }

  window.auroAnamnesis = {
    version: VERSION,
    inicializar,
    cargarPlantillas,
    detectar,
    seleccionarPlantilla,
    abrir,
    cerrar,
    generar,
    limpiar,
    crearBloqueSintomasActuales,
    crearBloqueSintomasObstetricos,
    obtenerDatosAnamnesis
  };

  window.inicializarAnamnesis = inicializar;
  window.auroObtenerDatosAnamnesis = obtenerDatosAnamnesis;

  if (!inicializar()) {
    let intentos = 0;
    const temporizador = setInterval(() => {
      intentos += 1;
      if (inicializar() || intentos >= 20) {
        clearInterval(temporizador);
      }
    }, 300);
  }
})();
