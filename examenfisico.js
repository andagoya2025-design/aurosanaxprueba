/* ==========================================================
   AUROSANAX - PARCHE FINAL EXAMEN FÍSICO DETALLE
   PEGAR AL FINAL DE examenfisico.js
   Objetivo:
   - No rompe lo que ya guarda en examenes_fisicos.
   - Agrega guardado separado en:
     examenes_sistemas, examenes_regionales, diagnosticos.
   - Fuerza que las funciones existan en window.
   ========================================================== */

(function(){
  console.log('AUROSANAX PATCH DETALLE EXAMEN FISICO: cargando...');

  function auroEF_getValue(id){
    try{
      if(typeof getValueIfExists === 'function') return getValueIfExists(id);
    }catch(e){}
    const el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }

  function auroEF_api(){
    try{
      if(typeof auroExamenFisicoApiUrl === 'function'){
        const u = auroExamenFisicoApiUrl();
        if(u) return String(u).trim();
      }
    }catch(e){}
    try{
      if(window.API_URL) return String(window.API_URL).trim();
    }catch(e){}
    try{
      if(window.APP_SCRIPT_URL) return String(window.APP_SCRIPT_URL).trim();
    }catch(e){}
    return '';
  }

  function auroEF_atencion(){
    try{
      if(typeof getAtencionActiva === 'function'){
        return getAtencionActiva() || {};
      }
    }catch(e){}
    return {};
  }

  function auroEF_idAtencion(){
    try{
      if(typeof auroExamenFisicoIdAtencionActual === 'function'){
        const id = auroExamenFisicoIdAtencionActual();
        if(id) return String(id).trim();
      }
    }catch(e){}

    try{
      if(typeof getIdAtencionActiva === 'function'){
        const id = getIdAtencionActiva();
        if(id) return String(id).trim();
      }
    }catch(e){}

    try{
      return String(window.examenFisicoState?.atencionActual || '').trim();
    }catch(e){}

    return '';
  }

  function auroBaseDetalleExamenFisico(){
    const atencion = auroEF_atencion();
    return {
      id_atencion: auroEF_idAtencion(),
      id_cita: atencion.id_cita || '',
      id_paciente: atencion.id_paciente || '',
      id_historia: atencion.id_historia || '',
      id_medico: atencion.id_medico || '',
      fecha_atencion: atencion.fecha_atencion || atencion.fecha || new Date().toISOString()
    };
  }

  function auroAgregarSistemaDetalle(lista, base, sistema, grupo, hallazgo, marcado, noValorado, observacion){
    lista.push(Object.assign({}, base, {
      sistema: sistema || '',
      grupo: grupo || '',
      hallazgo: hallazgo || '',
      marcado: marcado ? 'SI' : 'NO',
      no_valorado: noValorado ? 'SI' : 'NO',
      observacion: observacion || '',
      estado: 'Activo'
    }));
  }

  function auroRecolectarCheckboxesSistema(selector, sistema, base, observacionId, noValoradoId){
    const lista = [];
    const obs = auroEF_getValue(observacionId).trim();
    const noValorado = !!(document.getElementById(noValoradoId) && document.getElementById(noValoradoId).checked);

    document.querySelectorAll(selector).forEach(chk => {
      if(!chk.checked) return;
      auroAgregarSistemaDetalle(
        lista,
        base,
        sistema,
        chk.dataset.grupo || 'Hallazgos',
        chk.dataset.label || chk.value || '',
        true,
        false,
        obs
      );
    });

    if(noValorado){
      auroAgregarSistemaDetalle(lista, base, sistema, 'No valorado', '', false, true, obs);
    }else if(obs && !lista.length){
      auroAgregarSistemaDetalle(lista, base, sistema, 'Observación', '', false, false, obs);
    }

    return lista;
  }

  function auroRecopilarSistemasEstructurados(){
    const base = auroBaseDetalleExamenFisico();
    let lista = [];

    lista = lista.concat(auroRecolectarCheckboxesSistema('.hcSentidosCheck', 'Órgano de los sentidos', base, 'hcSentidosObservacion', 'hcSentidosNoValorado'));
    lista = lista.concat(auroRecolectarCheckboxesSistema('.hcRespiratorioCheck', 'Respiratorio', base, 'hcRespiratorioObservacion', 'hcRespiratorioNoValorado'));
    lista = lista.concat(auroRecolectarCheckboxesSistema('.hcCardiovascularCheck', 'Cardiovascular', base, 'hcCardiovascularObservacion', 'hcCardiovascularNoValorado'));
    lista = lista.concat(auroRecolectarCheckboxesSistema('.hcDigestivoCheck', 'Digestivo', base, 'hcDigestivoObservacion', 'hcDigestivoNoValorado'));
    lista = lista.concat(auroRecolectarCheckboxesSistema('.hcUrinarioCheck', 'Urinario', base, 'hcUrinarioObservacion', 'hcUrinarioNoValorado'));
    lista = lista.concat(auroRecolectarCheckboxesSistema('.hcMusculoEsqueleticoCheck', 'Músculo Esquelético', base, 'hcMusculoEsqueleticoObservacion', 'hcMusculoEsqueleticoNoValorado'));

    const endocrinoObs = auroEF_getValue('hcEndocrinoObservacion').trim();
    const endocrinoNoValorado = !!(document.getElementById('hcEndocrinoNoValorado') && document.getElementById('hcEndocrinoNoValorado').checked);
    if(endocrinoNoValorado || endocrinoObs){
      auroAgregarSistemaDetalle(lista, base, 'Endócrino', endocrinoNoValorado ? 'No valorado' : 'Observación', '', false, endocrinoNoValorado, endocrinoObs);
    }

    const hemoObs = auroEF_getValue('hcHemoLinfaticoObservacion').trim();
    const hemoNoValorado = !!(document.getElementById('hcHemoLinfaticoNoValorado') && document.getElementById('hcHemoLinfaticoNoValorado').checked);
    if(hemoNoValorado || hemoObs){
      auroAgregarSistemaDetalle(lista, base, 'Hemo-linfático', hemoNoValorado ? 'No valorado' : 'Observación', '', false, hemoNoValorado, hemoObs);
    }

    return lista;
  }

  function auroRecopilarRegionalesEstructurados(){
    try{
      if(typeof renderHcRegionalPanels === 'function') renderHcRegionalPanels();
    }catch(e){}

    const base = auroBaseDetalleExamenFisico();
    const lista = [];
    const config = window.auroExamenFisicoRegionalConfig || {};

    Object.keys(config).forEach(regionKey => {
      const cfg = config[regionKey] || {};
      const region = cfg.titulo || regionKey;
      const inputId = typeof hcRegionalInputId === 'function'
        ? hcRegionalInputId(regionKey)
        : 'hcRegional_' + regionKey + '_obs';

      const obs = auroEF_getValue(inputId).trim();

      document.querySelectorAll('.hcRegionalCheck[data-region="' + regionKey + '"]').forEach(chk => {
        if(!chk.checked) return;

        lista.push(Object.assign({}, base, {
          region: region,
          grupo: chk.dataset.grupo || 'Hallazgos regionales',
          hallazgo: chk.dataset.label || chk.value || '',
          marcado: 'SI',
          no_valorado: 'NO',
          observacion: obs,
          estado: 'Activo'
        }));
      });

      const esNoValorado = typeof auroEsNoValoradoExamen === 'function'
        ? auroEsNoValoradoExamen(obs)
        : (!obs || ['no valorado','no valorada','sin valorar','n/v'].includes(obs.toLowerCase()));

      if(obs && !esNoValorado){
        const yaTiene = lista.some(r => r.region === region);
        if(!yaTiene){
          lista.push(Object.assign({}, base, {
            region: region,
            grupo: 'Observación',
            hallazgo: '',
            marcado: 'NO',
            no_valorado: 'NO',
            observacion: obs,
            estado: 'Activo'
          }));
        }
      }
    });

    return lista;
  }

  function auroRecopilarDiagnosticosEstructurados(){
    const base = auroBaseDetalleExamenFisico();
    const lista = [];
    const seleccionados = Array.isArray(window.hcDiagnosticosSeleccionados)
      ? window.hcDiagnosticosSeleccionados
      : [];

    seleccionados.forEach((d, index) => {
      lista.push(Object.assign({}, base, {
        tipo_diagnostico: d.tipo || 'Presuntivo',
        cie10: 'CIE-10',
        codigo_cie10: String(d.codigo || '').trim().toUpperCase(),
        descripcion: d.nombre || '',
        principal: (d.principal || index === 0) ? 'SI' : 'NO',
        estado: 'Activo',
        observaciones: ''
      }));
    });

    return lista;
  }

  async function auroGuardarDetalleExamenFisicoSheets(idExamen){
    const API = auroEF_api();
    const base = auroBaseDetalleExamenFisico();

    if(!API || !base.id_atencion || !idExamen){
      console.warn('AUROSANAX PATCH: faltan datos detalle', {API, base, idExamen});
      return { success:false, message:'Faltan datos para guardar detalle del examen físico' };
    }

    const payload = {
      accion: 'guardarDetalleExamenFisico',
      data: {
        id_examen: idExamen,
        id_atencion: base.id_atencion,
        id_cita: base.id_cita,
        sistemas: auroRecopilarSistemasEstructurados(),
        regionales: auroRecopilarRegionalesEstructurados(),
        diagnosticos: auroRecopilarDiagnosticosEstructurados()
      }
    };

    console.log('AUROSANAX PATCH: enviando detalle', payload);

    const res = await fetch(API, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const resultado = await res.json();
    console.log('AUROSANAX PATCH: resultado detalle', resultado);
    return resultado;
  }

  const guardarOriginal = window.auroGuardarExamenFisicoSheets || (typeof auroGuardarExamenFisicoSheets === 'function' ? auroGuardarExamenFisicoSheets : null);

  if(typeof guardarOriginal === 'function'){
    window.auroGuardarExamenFisicoSheets = async function(){
      const resultado = await guardarOriginal.apply(this, arguments);

      try{
        const payloadData = typeof auroExamenFisicoPayload === 'function'
          ? auroExamenFisicoPayload()
          : {};

        const idExamen = String(
          (resultado && resultado.data && resultado.data.id_examen) ||
          (resultado && resultado.id) ||
          (payloadData && payloadData.id_examen) ||
          ''
        ).trim();

        if(idExamen){
          await window.auroGuardarDetalleExamenFisicoSheets(idExamen);
        }else{
          console.warn('AUROSANAX PATCH: no se detectó id_examen para detalle', resultado);
        }
      }catch(error){
        console.error('AUROSANAX PATCH: error guardando detalle', error);
      }

      return resultado;
    };
  }

  window.auroBaseDetalleExamenFisico = auroBaseDetalleExamenFisico;
  window.auroRecopilarSistemasEstructurados = auroRecopilarSistemasEstructurados;
  window.auroRecopilarRegionalesEstructurados = auroRecopilarRegionalesEstructurados;
  window.auroRecopilarDiagnosticosEstructurados = auroRecopilarDiagnosticosEstructurados;
  window.auroGuardarDetalleExamenFisicoSheets = auroGuardarDetalleExamenFisicoSheets;

  console.log('AUROSANAX PATCH DETALLE EXAMEN FISICO: cargado correctamente');
})();
