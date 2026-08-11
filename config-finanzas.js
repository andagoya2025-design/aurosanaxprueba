/* ==========================================================
   AUROSANAX ERP DEMO - CONFIG FINANZAS JS
   Versión: 2026-08-11 / 02
   Fase 3 - Archivo independiente ampliado

   OBJETIVO:
   - Administrar únicamente configuración financiera.
   - Usar apiGet() / apiPost() existentes en configuracion.html.
   - Usar exclusivamente endpoints financieros del mismo Code.gs.
   - No guardar ni modificar datos clínicos.
   - No tocar config-centro.js ni seguridad.js.
   - No guardar automáticamente al abrir/cambiar pestaña.

   REQUISITOS HTML FUTUROS:
   Parámetros:
   - cfgFinMoneda
   - cfgFinMetaMensual
   - cfgFinHorasFacturables
   - cfgFinMargenMinimo
   - cfgFinPorcentajeReferido
   - cfgFinDiasCartera
   - finanzasConfigMsg
   - btnGuardarConfigFinanzas

   Gastos fijos:
   - finGastoNombre
   - finGastoNombreOtro
   - finGastoCategoria
   - finGastoValor
   - finGastoPeriodicidad
   - finGastoValorMensual
   - finGastoFechaInicio
   - finGastoFechaFin
   - finGastoObservaciones
   - finGastosTbody
   - finanzasGastosMsg
   - btnGuardarGastoFinanzas

   Configuración económica de médicos:
   - finMedicoConfigId
   - finMedicoId
   - finMedicoTipoPago
   - finMedicoPorcentaje
   - finMedicoValorFijo
   - finMedicoValorHora
   - finMedicoVigenciaDesde
   - finMedicoVigenciaHasta
   - finMedicoEstado
   - finMedicoObservaciones
   - finMedicosTbody
   - finanzasMedicosMsg
   - btnGuardarMedicoFinanzas
   - btnLimpiarMedicoFinanzas
   ========================================================== */

(function(){
  'use strict';

  const AURO_FIN_CONFIG_KEYS = Object.freeze({
    moneda: 'moneda',
    meta_mensual: 'meta_mensual',
    horas_facturables_mes: 'horas_facturables_mes',
    margen_minimo: 'margen_minimo',
    porcentaje_referido_predeterminado: 'porcentaje_referido_predeterminado',
    dias_vencimiento_cartera: 'dias_vencimiento_cartera'
  });

  let auroFinanzasConfigCargada = false;
  let auroFinanzasGastosCargados = false;
  let auroFinanzasGastos = [];

  /* Estado aislado: configuración económica de médicos.
     No modifica el catálogo clínico de médicos. */
  let auroFinanzasMedicosCargados = false;
  let auroFinanzasCatalogoMedicos = [];
  let auroFinanzasConfigMedicos = [];

  function finEl(id){
    return document.getElementById(id);
  }

  function finTexto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function finEscape(valor){
    return finTexto(valor).replace(/[&<>"']/g, function(c){
      return ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'
      })[c];
    });
  }

  function finNumero(valor){
    const txt = finTexto(valor).replace(',', '.');
    if(!txt) return 0;
    const n = Number(txt);
    return Number.isFinite(n) ? n : 0;
  }

  function finNumeroOpcional(valor){
    const txt = finTexto(valor);
    if(!txt) return '';
    const n = Number(txt.replace(',', '.'));
    return Number.isFinite(n) ? n : '';
  }

  function finSetMsg(id, mensaje, tipo){
    const el = finEl(id);
    if(!el) return;

    const clases = {
      ok: 'text-success',
      error: 'text-danger',
      info: 'text-muted'
    };

    el.className = clases[tipo] || clases.info;
    el.textContent = mensaje || '';
  }

  function finSetBoton(id, bloqueado, texto){
    const btn = finEl(id);
    if(!btn) return;

    if(!btn.dataset.auroTextoOriginal){
      btn.dataset.auroTextoOriginal = btn.innerHTML;
    }

    btn.disabled = !!bloqueado;
    btn.innerHTML = bloqueado
      ? '<i class="bi bi-arrow-clockwise me-1"></i>' + finEscape(texto || 'Procesando...')
      : btn.dataset.auroTextoOriginal;
  }

  function finValorConfig(config, clave, respaldo){
    if(config && Object.prototype.hasOwnProperty.call(config, clave)){
      const valor = config[clave];
      if(valor !== null && valor !== undefined && valor !== '') return valor;
    }
    return respaldo;
  }

  function finAsignarValor(id, valor){
    const el = finEl(id);
    if(el) el.value = valor === null || valor === undefined ? '' : valor;
  }

  function finValidarApi(){
    if(typeof window.apiGet !== 'function' || typeof window.apiPost !== 'function'){
      throw new Error('Configuración no tiene disponibles apiGet/apiPost.');
    }
  }

  async function cargarConfiguracionFinanzas(forzar){
    if(auroFinanzasConfigCargada && !forzar) return;

    finValidarApi();
    finSetMsg('finanzasConfigMsg', 'Cargando configuración financiera...', 'info');

    try{
      const config = await window.apiGet('obtenerConfiguracionFinanciera');
      const datos = config && typeof config === 'object' && !Array.isArray(config) ? config : {};

      finAsignarValor('cfgFinMoneda',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.moneda, 'USD'));

      finAsignarValor('cfgFinMetaMensual',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.meta_mensual, ''));

      finAsignarValor('cfgFinHorasFacturables',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.horas_facturables_mes, ''));

      finAsignarValor('cfgFinMargenMinimo',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.margen_minimo, ''));

      finAsignarValor('cfgFinPorcentajeReferido',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.porcentaje_referido_predeterminado, ''));

      finAsignarValor('cfgFinDiasCartera',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.dias_vencimiento_cartera, ''));

      auroFinanzasConfigCargada = true;
      finSetMsg('finanzasConfigMsg', 'Configuración financiera cargada.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - cargar configuración:', e);
      finSetMsg('finanzasConfigMsg',
        'No se pudo cargar la configuración financiera: ' + finTexto(e.message || e),
        'error');
    }
  }

  async function guardarClaveFinanciera(clave, valor, descripcion, tipoDato){
    const respuesta = await window.apiPost('guardarConfiguracionFinanciera', {
      clave: clave,
      valor: valor,
      descripcion: descripcion || '',
      tipo_dato: tipoDato || 'texto',
      estado: 'Activo'
    });

    if(!respuesta || respuesta.success !== true){
      throw new Error((respuesta && respuesta.message) || ('No se pudo guardar ' + clave));
    }

    return respuesta;
  }

  async function guardarConfiguracionFinanzas(){
    finValidarApi();

    const moneda = finTexto(finEl('cfgFinMoneda')?.value || 'USD').toUpperCase();
    const meta = finNumeroOpcional(finEl('cfgFinMetaMensual')?.value);
    const horas = finNumeroOpcional(finEl('cfgFinHorasFacturables')?.value);
    const margen = finNumeroOpcional(finEl('cfgFinMargenMinimo')?.value);
    const referido = finNumeroOpcional(finEl('cfgFinPorcentajeReferido')?.value);
    const diasCartera = finNumeroOpcional(finEl('cfgFinDiasCartera')?.value);

    if(!moneda){
      alert('Seleccione o ingrese la moneda.');
      return;
    }
    if(meta !== '' && meta < 0){
      alert('La meta mensual no puede ser negativa.');
      return;
    }
    if(horas !== '' && horas < 0){
      alert('Las horas facturables no pueden ser negativas.');
      return;
    }
    if(margen !== '' && (margen < 0 || margen > 100)){
      alert('El margen mínimo debe estar entre 0 y 100.');
      return;
    }
    if(referido !== '' && (referido < 0 || referido > 100)){
      alert('El porcentaje de referido debe estar entre 0 y 100.');
      return;
    }
    if(diasCartera !== '' && diasCartera < 0){
      alert('Los días de vencimiento de cartera no pueden ser negativos.');
      return;
    }

    finSetBoton('btnGuardarConfigFinanzas', true, 'Guardando...');
    finSetMsg('finanzasConfigMsg', 'Guardando parámetros financieros...', 'info');

    try{
      /* Guardados independientes por clave.
         No se llama ningún guardador clínico ni institucional. */
      await guardarClaveFinanciera(
        AURO_FIN_CONFIG_KEYS.moneda,
        moneda,
        'Moneda principal del módulo financiero',
        'texto'
      );

      await guardarClaveFinanciera(
        AURO_FIN_CONFIG_KEYS.meta_mensual,
        meta,
        'Meta mensual de ingresos',
        'numero'
      );

      await guardarClaveFinanciera(
        AURO_FIN_CONFIG_KEYS.horas_facturables_mes,
        horas,
        'Horas facturables estimadas por mes',
        'numero'
      );

      await guardarClaveFinanciera(
        AURO_FIN_CONFIG_KEYS.margen_minimo,
        margen,
        'Margen mínimo objetivo en porcentaje',
        'numero'
      );

      if(finEl('cfgFinPorcentajeReferido')){
        await guardarClaveFinanciera(
          AURO_FIN_CONFIG_KEYS.porcentaje_referido_predeterminado,
          referido,
          'Porcentaje de referido predeterminado',
          'numero'
        );
      }

      if(finEl('cfgFinDiasCartera')){
        await guardarClaveFinanciera(
          AURO_FIN_CONFIG_KEYS.dias_vencimiento_cartera,
          diasCartera,
          'Días predeterminados para vencimiento de cartera',
          'numero'
        );
      }

      auroFinanzasConfigCargada = false;
      await cargarConfiguracionFinanzas(true);

      finSetMsg('finanzasConfigMsg', 'Configuración financiera guardada correctamente.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - guardar configuración:', e);
      finSetMsg('finanzasConfigMsg',
        'Error guardando configuración financiera: ' + finTexto(e.message || e),
        'error');
      alert('Error al guardar Finanzas: ' + finTexto(e.message || e));
    }finally{
      finSetBoton('btnGuardarConfigFinanzas', false);
    }
  }

  function actualizarNombreOtroGastoFinanzas(){
    const selector = finEl('finGastoNombre');
    const otro = finEl('finGastoNombreOtro');
    if(!selector || !otro) return;

    const esOtro = finTexto(selector.value) === '__OTRO__';
    otro.classList.toggle('d-none', !esOtro);

    if(!esOtro){
      otro.value = '';
    }
  }

  function obtenerNombreGastoFinanzas(){
    const selector = finEl('finGastoNombre');
    if(!selector) return '';

    const valor = finTexto(selector.value);
    if(valor === '__OTRO__'){
      return finTexto(finEl('finGastoNombreOtro')?.value);
    }

    return valor;
  }

  function asignarNombreGastoFinanzas(nombre){
    const selector = finEl('finGastoNombre');
    const otro = finEl('finGastoNombreOtro');
    if(!selector) return;

    const valor = finTexto(nombre);
    const existe = Array.from(selector.options || []).some(function(op){
      return finTexto(op.value) === valor;
    });

    if(!valor){
      selector.value = '';
      if(otro) otro.value = '';
    }else if(existe){
      selector.value = valor;
      if(otro) otro.value = '';
    }else{
      selector.value = '__OTRO__';
      if(otro) otro.value = valor;
    }

    actualizarNombreOtroGastoFinanzas();
  }

  function finPeriodicidadMensual(valor, periodicidad){
    const v = finNumero(valor);
    const p = finTexto(periodicidad).toLowerCase();

    if(!v) return 0;
    if(p === 'mensual') return v;
    if(p === 'semanal') return Math.round((v * 52 / 12) * 100) / 100;
    if(p === 'quincenal') return Math.round((v * 24 / 12) * 100) / 100;
    if(p === 'trimestral') return Math.round((v / 3) * 100) / 100;
    if(p === 'semestral') return Math.round((v / 6) * 100) / 100;
    if(p === 'anual') return Math.round((v / 12) * 100) / 100;

    return v;
  }

  function actualizarProrrateoGastoFinanzas(){
    const valor = finNumero(finEl('finGastoValor')?.value);
    const periodicidad = finTexto(finEl('finGastoPeriodicidad')?.value);
    const mensual = finPeriodicidadMensual(valor, periodicidad);

    const input = finEl('finGastoValorMensual');
    if(input) input.value = mensual ? mensual.toFixed(2) : '';
  }

  async function cargarGastosFijosFinanzas(forzar){
    if(auroFinanzasGastosCargados && !forzar){
      renderGastosFijosFinanzas();
      return;
    }

    finValidarApi();
    finSetMsg('finanzasGastosMsg', 'Cargando gastos fijos...', 'info');

    try{
      const datos = await window.apiGet('listarGastosFijosFinancieros');
      auroFinanzasGastos = Array.isArray(datos) ? datos : [];
      auroFinanzasGastosCargados = true;
      renderGastosFijosFinanzas();
      finSetMsg('finanzasGastosMsg', 'Gastos fijos cargados.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - cargar gastos:', e);
      auroFinanzasGastos = [];
      renderGastosFijosFinanzas();
      finSetMsg('finanzasGastosMsg',
        'No se pudieron cargar los gastos fijos: ' + finTexto(e.message || e),
        'error');
    }
  }

  function renderGastosFijosFinanzas(){
    const tbody = finEl('finGastosTbody');
    if(!tbody) return;

    if(!auroFinanzasGastos.length){
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Sin gastos fijos registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = auroFinanzasGastos.map(function(g){
      return '<tr>' +
        '<td>' + finEscape(g.nombre_gasto) + '</td>' +
        '<td>' + finEscape(g.categoria) + '</td>' +
        '<td>' + finEscape(g.valor) + '</td>' +
        '<td>' + finEscape(g.periodicidad) + '</td>' +
        '<td>' + finEscape(g.valor_mensual_prorrateado) + '</td>' +
        '<td>' + finEscape(g.estado) + '</td>' +
        '<td class="text-end">' +
          '<button type="button" class="btn btn-sm btn-outline-primary" ' +
          'data-fin-editar-gasto="' + finEscape(g.id_gasto) + '">' +
          '<i class="bi bi-pencil"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function limpiarFormularioGastoFinanzas(){
    [
      'finGastoNombre',
      'finGastoCategoria',
      'finGastoValor',
      'finGastoValorMensual',
      'finGastoFechaInicio',
      'finGastoFechaFin',
      'finGastoObservaciones'
    ].forEach(function(id){
      const el = finEl(id);
      if(el) el.value = '';
    });

    const otroNombre = finEl('finGastoNombreOtro');
    if(otroNombre) otroNombre.value = '';
    actualizarNombreOtroGastoFinanzas();

    const periodicidad = finEl('finGastoPeriodicidad');
    if(periodicidad) periodicidad.value = 'Mensual';

    const id = finEl('finGastoId');
    if(id) id.value = '';
  }

  function cargarGastoEnFormularioFinanzas(idGasto){
    const id = finTexto(idGasto);
    const gasto = auroFinanzasGastos.find(function(g){
      return finTexto(g.id_gasto) === id;
    });

    if(!gasto) return;

    finAsignarValor('finGastoId', gasto.id_gasto);
    asignarNombreGastoFinanzas(gasto.nombre_gasto);
    finAsignarValor('finGastoCategoria', gasto.categoria);
    finAsignarValor('finGastoValor', gasto.valor);
    finAsignarValor('finGastoPeriodicidad', gasto.periodicidad || 'Mensual');
    finAsignarValor('finGastoValorMensual', gasto.valor_mensual_prorrateado);
    finAsignarValor('finGastoFechaInicio', gasto.fecha_inicio);
    finAsignarValor('finGastoFechaFin', gasto.fecha_fin);
    finAsignarValor('finGastoObservaciones', gasto.observaciones);
  }

  async function guardarGastoFijoFinanzas(){
    finValidarApi();

    const idGasto = finTexto(finEl('finGastoId')?.value);
    const nombre = obtenerNombreGastoFinanzas();
    const categoria = finTexto(finEl('finGastoCategoria')?.value);
    const valor = finNumero(finEl('finGastoValor')?.value);
    const periodicidad = finTexto(finEl('finGastoPeriodicidad')?.value || 'Mensual');
    const mensual = finPeriodicidadMensual(valor, periodicidad);

    if(!nombre){
      alert('Seleccione o escriba el nombre del gasto.');
      return;
    }
    if(!(valor > 0)){
      alert('El valor del gasto debe ser mayor que cero.');
      return;
    }

    const data = {
      nombre_gasto: nombre,
      categoria: categoria,
      valor: valor,
      periodicidad: periodicidad,
      valor_mensual_prorrateado: mensual,
      fecha_inicio: finTexto(finEl('finGastoFechaInicio')?.value),
      fecha_fin: finTexto(finEl('finGastoFechaFin')?.value),
      estado: 'Activo',
      observaciones: finTexto(finEl('finGastoObservaciones')?.value)
    };

    finSetBoton('btnGuardarGastoFinanzas', true, 'Guardando...');
    finSetMsg('finanzasGastosMsg', 'Guardando gasto fijo...', 'info');

    try{
      let respuesta;

      if(idGasto){
        respuesta = await window.apiPost('editarGastoFijoFinanciero', {
          id_gasto: idGasto,
          data: data
        });
      }else{
        respuesta = await window.apiPost('guardarGastoFijoFinanciero', data);
      }

      if(!respuesta || respuesta.success !== true){
        throw new Error((respuesta && respuesta.message) || 'No se pudo guardar el gasto fijo.');
      }

      limpiarFormularioGastoFinanzas();
      auroFinanzasGastosCargados = false;
      await cargarGastosFijosFinanzas(true);
      finSetMsg('finanzasGastosMsg', 'Gasto fijo guardado correctamente.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - guardar gasto:', e);
      finSetMsg('finanzasGastosMsg',
        'Error guardando gasto fijo: ' + finTexto(e.message || e),
        'error');
      alert('Error al guardar gasto fijo: ' + finTexto(e.message || e));
    }finally{
      finSetBoton('btnGuardarGastoFinanzas', false);
    }
  }


  /* ---------------- CONFIGURACIÓN ECONÓMICA DE MÉDICOS ----------------
     Usa únicamente:
     - listarMedicos() para lectura del catálogo existente.
     - configuracion_medicos_financiera para condiciones económicas.
     Nunca modifica la hoja medicos.
     ------------------------------------------------------------------- */

  function finNombreMedico(m){
    const nombre = finTexto(m?.nombre_completo || m?.nombre || m?.nombres);
    const apellido = finTexto(m?.apellido || m?.apellidos);
    return finTexto((nombre + ' ' + apellido).trim()) || finTexto(m?.id_medico);
  }

  async function cargarMedicosFinanzas(forzar){
    if(auroFinanzasMedicosCargados && !forzar){
      renderConfiguracionMedicosFinanzas();
      return;
    }

    finValidarApi();
    finSetMsg('finanzasMedicosMsg', 'Cargando configuración económica de médicos...', 'info');

    try{
      const resultados = await Promise.all([
        window.apiGet('listarMedicos'),
        window.apiGet('listarConfiguracionMedicosFinanciera')
      ]);

      auroFinanzasCatalogoMedicos = Array.isArray(resultados[0]) ? resultados[0] : [];
      auroFinanzasConfigMedicos = Array.isArray(resultados[1]) ? resultados[1] : [];
      auroFinanzasMedicosCargados = true;

      renderSelectMedicosFinanzas();
      renderConfiguracionMedicosFinanzas();
      finSetMsg('finanzasMedicosMsg', 'Configuración económica de médicos cargada.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - cargar médicos:', e);
      auroFinanzasCatalogoMedicos = [];
      auroFinanzasConfigMedicos = [];
      renderSelectMedicosFinanzas();
      renderConfiguracionMedicosFinanzas();
      finSetMsg(
        'finanzasMedicosMsg',
        'No se pudo cargar la configuración económica de médicos: ' + finTexto(e.message || e),
        'error'
      );
    }
  }

  function renderSelectMedicosFinanzas(){
    const select = finEl('finMedicoId');
    if(!select) return;

    const actual = finTexto(select.value);
    select.innerHTML = '<option value="">Seleccione médico...</option>' +
      auroFinanzasCatalogoMedicos.map(function(m){
        const id = finTexto(m.id_medico);
        return '<option value="' + finEscape(id) + '">' +
          finEscape(finNombreMedico(m)) +
        '</option>';
      }).join('');

    if(actual) select.value = actual;
  }

  function finBuscarNombreMedico(idMedico){
    const id = finTexto(idMedico);
    const medico = auroFinanzasCatalogoMedicos.find(function(m){
      return finTexto(m.id_medico) === id;
    });
    return medico ? finNombreMedico(medico) : id;
  }

  function renderConfiguracionMedicosFinanzas(){
    const tbody = finEl('finMedicosTbody');
    if(!tbody) return;

    if(!auroFinanzasConfigMedicos.length){
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center text-muted py-3">' +
        'Sin configuraciones económicas de médicos registradas.</td></tr>';
      return;
    }

    tbody.innerHTML = auroFinanzasConfigMedicos.map(function(c){
      return '<tr>' +
        '<td>' + finEscape(finBuscarNombreMedico(c.id_medico)) + '</td>' +
        '<td>' + finEscape(c.tipo_pago) + '</td>' +
        '<td>' + finEscape(c.porcentaje) + '</td>' +
        '<td>' + finEscape(c.valor_fijo) + '</td>' +
        '<td>' + finEscape(c.valor_hora) + '</td>' +
        '<td>' + finEscape(c.vigencia_desde) + '</td>' +
        '<td>' + finEscape(c.estado) + '</td>' +
        '<td class="text-end">' +
          '<button type="button" class="btn btn-sm btn-outline-primary" ' +
          'data-fin-editar-medico="' + finEscape(c.id_config_medico) + '">' +
          '<i class="bi bi-pencil"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function actualizarCamposTipoPagoMedicoFinanzas(){
    const tipo = finTexto(finEl('finMedicoTipoPago')?.value).toLowerCase();

    const porcentaje = finEl('finMedicoPorcentaje');
    const fijo = finEl('finMedicoValorFijo');
    const hora = finEl('finMedicoValorHora');

    if(porcentaje) porcentaje.disabled = tipo !== 'porcentaje';
    if(fijo) fijo.disabled = tipo !== 'fijo';
    if(hora) hora.disabled = tipo !== 'hora' && tipo !== 'por hora' && tipo !== 'por_hora';
  }

  function limpiarFormularioMedicoFinanzas(){
    [
      'finMedicoConfigId',
      'finMedicoId',
      'finMedicoPorcentaje',
      'finMedicoValorFijo',
      'finMedicoValorHora',
      'finMedicoVigenciaDesde',
      'finMedicoVigenciaHasta',
      'finMedicoObservaciones'
    ].forEach(function(id){
      const el = finEl(id);
      if(el) el.value = '';
    });

    const tipo = finEl('finMedicoTipoPago');
    if(tipo) tipo.value = 'Porcentaje';

    const estado = finEl('finMedicoEstado');
    if(estado) estado.value = 'Activo';

    actualizarCamposTipoPagoMedicoFinanzas();
  }

  function cargarMedicoEnFormularioFinanzas(idConfig){
    const id = finTexto(idConfig);
    const config = auroFinanzasConfigMedicos.find(function(c){
      return finTexto(c.id_config_medico) === id;
    });
    if(!config) return;

    finAsignarValor('finMedicoConfigId', config.id_config_medico);
    finAsignarValor('finMedicoId', config.id_medico);
    finAsignarValor('finMedicoTipoPago', config.tipo_pago || 'Porcentaje');
    finAsignarValor('finMedicoPorcentaje', config.porcentaje);
    finAsignarValor('finMedicoValorFijo', config.valor_fijo);
    finAsignarValor('finMedicoValorHora', config.valor_hora);
    finAsignarValor('finMedicoVigenciaDesde', config.vigencia_desde);
    finAsignarValor('finMedicoVigenciaHasta', config.vigencia_hasta);
    finAsignarValor('finMedicoEstado', config.estado || 'Activo');
    finAsignarValor('finMedicoObservaciones', config.observaciones);

    actualizarCamposTipoPagoMedicoFinanzas();
  }

  async function guardarConfiguracionMedicoFinanzas(){
    finValidarApi();

    const idConfig = finTexto(finEl('finMedicoConfigId')?.value);
    const idMedico = finTexto(finEl('finMedicoId')?.value);
    const tipoPago = finTexto(finEl('finMedicoTipoPago')?.value);
    const porcentaje = finNumeroOpcional(finEl('finMedicoPorcentaje')?.value);
    const valorFijo = finNumeroOpcional(finEl('finMedicoValorFijo')?.value);
    const valorHora = finNumeroOpcional(finEl('finMedicoValorHora')?.value);

    if(!idMedico){
      alert('Seleccione un médico.');
      return;
    }
    if(!tipoPago){
      alert('Seleccione el tipo de pago.');
      return;
    }
    if(porcentaje !== '' && (porcentaje < 0 || porcentaje > 100)){
      alert('El porcentaje del médico debe estar entre 0 y 100.');
      return;
    }
    if(valorFijo !== '' && valorFijo < 0){
      alert('El valor fijo no puede ser negativo.');
      return;
    }
    if(valorHora !== '' && valorHora < 0){
      alert('El valor por hora no puede ser negativo.');
      return;
    }

    const data = {
      id_medico: idMedico,
      tipo_pago: tipoPago,
      porcentaje: porcentaje,
      valor_fijo: valorFijo,
      valor_hora: valorHora,
      vigencia_desde: finTexto(finEl('finMedicoVigenciaDesde')?.value),
      vigencia_hasta: finTexto(finEl('finMedicoVigenciaHasta')?.value),
      estado: finTexto(finEl('finMedicoEstado')?.value || 'Activo'),
      observaciones: finTexto(finEl('finMedicoObservaciones')?.value)
    };

    finSetBoton('btnGuardarMedicoFinanzas', true, 'Guardando...');
    finSetMsg('finanzasMedicosMsg', 'Guardando configuración económica del médico...', 'info');

    try{
      let respuesta;

      if(idConfig){
        respuesta = await window.apiPost('editarConfiguracionMedicoFinanciera', {
          id_config_medico: idConfig,
          data: data
        });
      }else{
        respuesta = await window.apiPost('guardarConfiguracionMedicoFinanciera', data);
      }

      if(!respuesta || respuesta.success !== true){
        throw new Error(
          (respuesta && respuesta.message) ||
          'No se pudo guardar la configuración económica del médico.'
        );
      }

      limpiarFormularioMedicoFinanzas();
      auroFinanzasMedicosCargados = false;
      await cargarMedicosFinanzas(true);
      finSetMsg('finanzasMedicosMsg', 'Configuración económica del médico guardada correctamente.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - guardar médico:', e);
      finSetMsg(
        'finanzasMedicosMsg',
        'Error guardando configuración económica del médico: ' + finTexto(e.message || e),
        'error'
      );
      alert('Error al guardar configuración del médico: ' + finTexto(e.message || e));
    }finally{
      finSetBoton('btnGuardarMedicoFinanzas', false);
    }
  }

  async function inicializarConfiguracionFinanzas(){
    /* Solo lectura. Nunca guarda por inicialización o navegación. */
    await Promise.allSettled([
      cargarConfiguracionFinanzas(false),
      cargarGastosFijosFinanzas(false),
      cargarMedicosFinanzas(false)
    ]);
  }

  function enlazarEventosConfigFinanzas(){
    const btnConfig = finEl('btnGuardarConfigFinanzas');
    if(btnConfig && btnConfig.dataset.auroFinInit !== '1'){
      btnConfig.dataset.auroFinInit = '1';
      btnConfig.addEventListener('click', guardarConfiguracionFinanzas);
    }

    const selectorNombreGasto = finEl('finGastoNombre');
    if(selectorNombreGasto && selectorNombreGasto.dataset.auroFinNombreInit !== '1'){
      selectorNombreGasto.dataset.auroFinNombreInit = '1';
      selectorNombreGasto.addEventListener('change', actualizarNombreOtroGastoFinanzas);
      actualizarNombreOtroGastoFinanzas();
    }

    const btnGasto = finEl('btnGuardarGastoFinanzas');
    if(btnGasto && btnGasto.dataset.auroFinInit !== '1'){
      btnGasto.dataset.auroFinInit = '1';
      btnGasto.addEventListener('click', guardarGastoFijoFinanzas);
    }

    const btnLimpiar = finEl('btnLimpiarGastoFinanzas');
    if(btnLimpiar && btnLimpiar.dataset.auroFinInit !== '1'){
      btnLimpiar.dataset.auroFinInit = '1';
      btnLimpiar.addEventListener('click', limpiarFormularioGastoFinanzas);
    }

    ['finGastoValor', 'finGastoPeriodicidad'].forEach(function(id){
      const el = finEl(id);
      if(el && el.dataset.auroFinInit !== '1'){
        el.dataset.auroFinInit = '1';
        el.addEventListener('input', actualizarProrrateoGastoFinanzas);
        el.addEventListener('change', actualizarProrrateoGastoFinanzas);
      }
    });

    const tbody = finEl('finGastosTbody');
    if(tbody && tbody.dataset.auroFinInit !== '1'){
      tbody.dataset.auroFinInit = '1';
      tbody.addEventListener('click', function(ev){
        const btn = ev.target.closest('[data-fin-editar-gasto]');
        if(!btn) return;
        cargarGastoEnFormularioFinanzas(btn.getAttribute('data-fin-editar-gasto'));
      });
    }

    const btnMedico = finEl('btnGuardarMedicoFinanzas');
    if(btnMedico && btnMedico.dataset.auroFinInit !== '1'){
      btnMedico.dataset.auroFinInit = '1';
      btnMedico.addEventListener('click', guardarConfiguracionMedicoFinanzas);
    }

    const btnLimpiarMedico = finEl('btnLimpiarMedicoFinanzas');
    if(btnLimpiarMedico && btnLimpiarMedico.dataset.auroFinInit !== '1'){
      btnLimpiarMedico.dataset.auroFinInit = '1';
      btnLimpiarMedico.addEventListener('click', limpiarFormularioMedicoFinanzas);
    }

    const tipoPagoMedico = finEl('finMedicoTipoPago');
    if(tipoPagoMedico && tipoPagoMedico.dataset.auroFinInit !== '1'){
      tipoPagoMedico.dataset.auroFinInit = '1';
      tipoPagoMedico.addEventListener('change', actualizarCamposTipoPagoMedicoFinanzas);
      actualizarCamposTipoPagoMedicoFinanzas();
    }

    const tbodyMedicos = finEl('finMedicosTbody');
    if(tbodyMedicos && tbodyMedicos.dataset.auroFinInit !== '1'){
      tbodyMedicos.dataset.auroFinInit = '1';
      tbodyMedicos.addEventListener('click', function(ev){
        const btn = ev.target.closest('[data-fin-editar-medico]');
        if(!btn) return;
        cargarMedicoEnFormularioFinanzas(btn.getAttribute('data-fin-editar-medico'));
      });
    }
  }

  function prepararConfigFinanzas(){
    enlazarEventosConfigFinanzas();
  }

  /* API pública mínima para configuracion.html.
     No redefine funciones globales existentes. */
  window.auroConfigFinanzas = Object.freeze({
    inicializar: inicializarConfiguracionFinanzas,
    cargarConfiguracion: function(){ return cargarConfiguracionFinanzas(true); },
    cargarGastos: function(){ return cargarGastosFijosFinanzas(true); },
    cargarMedicos: function(){ return cargarMedicosFinanzas(true); },
    guardarConfiguracion: guardarConfiguracionFinanzas,
    guardarGasto: guardarGastoFijoFinanzas,
    limpiarGasto: limpiarFormularioGastoFinanzas,
    guardarMedico: guardarConfiguracionMedicoFinanzas,
    limpiarMedico: limpiarFormularioMedicoFinanzas,
    preparar: prepararConfigFinanzas
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', prepararConfigFinanzas, {once:true});
  }else{
    prepararConfigFinanzas();
  }

})();
