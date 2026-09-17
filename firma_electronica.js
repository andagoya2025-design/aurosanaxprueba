/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.1';
  const INTERVALO_CONSULTA_MS = 2500;
  const TIEMPO_MAXIMO_MS = 10 * 60 * 1000;

  /* Una sola operación activa por receta+contenido. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    const inicio = Date.now();

    while((Date.now() - inicio) < TIEMPO_MAXIMO_MS){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }

    throw new Error('La firma no se completó dentro del tiempo permitido. Verifique que el motor de firma esté iniciado.');
  }

  async function ejecutarFirma(solicitud, clave){
    const estadoMotor = await post('obtenerEstadoFirmaElectronica', {});
    if(estadoMotor.disponible !== true){
      throw new Error(
        estadoMotor.agente_online === false
          ? 'El motor de firma de Windows no está conectado. Inícielo y vuelva a intentar.'
          : 'La firma electrónica no está disponible en este momento.'
      );
    }

    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    setEstadoBotonesFirma('normal');
    pintarEstadoFirmaInline('Firma completada correctamente.', 'ok');
    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      setEstadoBotonesFirma('preparando');
      pintarEstadoFirmaInline('Preparando firma electrónica…', 'info');
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        setEstadoBotonesFirma('normal');
        pintarEstadoFirmaInline('Esta receta ya está firmada.', 'ok');
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        mensajeProfesional('La receta ya se está firmando. Espere la confirmación.', 'warn');
        return firmasEnCurso.get(clave);
      }

      const operacion = ejecutarFirma(solicitud, clave);
      firmasEnCurso.set(clave, operacion);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      console.error(MODULO, error);
      const amable = mensajeErrorAmigable(error);
      pintarEstadoFirmaInline(amable, 'error');
      mensajeProfesional(amable, 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();

/* ============================================================
   AUROSANAX - OVERRIDE ANTIRREGRESIVO ESTRICTO APPEND-ONLY
   Fecha: 2026-09-14
   - Todo el baseline anterior permanece arriba, byte por byte.
   - El módulo que sigue se carga al final y reemplaza solo la API pública
     window.auroFirmaElectronica para quitar el timeout artificial.
   - No elimina funciones ni líneas del baseline.
============================================================ */

/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.2-sin-tiempo';
  const INTERVALO_CONSULTA_MS = 2500;

  /* Una sola operación activa por receta+contenido. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    /* Sin vencimiento artificial: la espera termina solo por FIRMADO, ERROR
       o por un estado terminal informado explícitamente por el backend. */
    while(true){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }
  }

  async function ejecutarFirma(solicitud, clave){
    const estadoMotor = await post('obtenerEstadoFirmaElectronica', {});
    if(estadoMotor.disponible !== true){
      throw new Error(
        estadoMotor.agente_online === false
          ? 'El motor de firma de Windows no está conectado. Inícielo y vuelva a intentar.'
          : 'La firma electrónica no está disponible en este momento.'
      );
    }

    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        mensajeProfesional('La receta ya se está firmando. Espere la confirmación.', 'warn');
        return firmasEnCurso.get(clave);
      }

      const operacion = ejecutarFirma(solicitud, clave);
      firmasEnCurso.set(clave, operacion);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();

/* AUROSANAX V2.3 - OVERRIDE FINAL REABRIR PDF PENDIENTE */
/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.3-sin-tiempo-reabrir';
  const INTERVALO_CONSULTA_MS = 2500;

  /* Una sola operación activa por receta+contenido.
     V2.3: conserva también id_solicitud para REABRIR sin duplicar. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    /* Sin vencimiento artificial: la espera termina solo por FIRMADO, ERROR
       o por un estado terminal informado explícitamente por el backend. */
    while(true){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }
  }

  async function ejecutarFirma(solicitud, clave){
    const estadoMotor = await post('obtenerEstadoFirmaElectronica', {});
    if(estadoMotor.disponible !== true){
      throw new Error(
        estadoMotor.agente_online === false
          ? 'El motor de firma de Windows no está conectado. Inícielo y vuelva a intentar.'
          : 'La firma electrónica no está disponible en este momento.'
      );
    }

    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      const activa = firmasEnCurso.get(clave);
      if(activa) activa.id_solicitud = texto(creada.id_solicitud);
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        const activa = firmasEnCurso.get(clave);
        setEstadoBotonesFirma(texto(activa && activa.id_solicitud) ? 'proceso' : 'preparando');
        pintarEstadoFirmaInline(
          texto(activa && activa.id_solicitud)
            ? 'La firma ya está en proceso. No necesita volver a presionar.'
            : 'La solicitud se está preparando. Espere un momento.',
          'info'
        );
        return activa && activa.promesa ? activa.promesa : activa;
      }

      const activa = {promesa:null, id_solicitud:''};
      const operacion = ejecutarFirma(solicitud, clave);
      activa.promesa = operacion;
      firmasEnCurso.set(clave, activa);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();

/* ============================================================
   AUROSANAX V2.4 - OVERRIDE FINAL: REABRIR + CANCELAR
   Adhesión append-only. Baseline anterior intacto arriba.
============================================================ */
/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.4-sin-tiempo-reabrir-cancelar';
  const INTERVALO_CONSULTA_MS = 2500;

  /* Una sola operación activa por receta+contenido.
     V2.3: conserva también id_solicitud para REABRIR sin duplicar. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;
  let claveActivaVisible = '';
  let solicitudActivaVisible = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }


  function pintarEstadoFirmaInline(mensaje, tipo){
    const txt = texto(mensaje);
    botonesFirmaVisibles().forEach(function(firmar){
      if(!firmar || !firmar.parentNode) return;
      const contexto = contextoBotonFirma(firmar);
      let box = firmar.parentNode.querySelector('.auro-firma-estado-inline[data-auro-contexto="' + contexto + '"]');
      if(!box){
        box = document.createElement('span');
        box.className = 'auro-firma-estado-inline';
        box.setAttribute('data-auro-contexto', contexto);
        box.setAttribute('role','status');
        box.setAttribute('aria-live','polite');
        box.style.display = 'inline-block';
        box.style.marginLeft = '10px';
        box.style.padding = '6px 10px';
        box.style.borderRadius = '999px';
        box.style.fontSize = '12px';
        box.style.fontWeight = '700';
        box.style.verticalAlign = 'middle';
        const cancelar = asegurarBotonCancelarJuntoA(firmar);
        (cancelar || firmar).insertAdjacentElement('afterend', box);
      }
      if(!txt){
        box.style.display = 'none';
        box.textContent = '';
        return;
      }
      box.style.display = 'inline-block';
      box.textContent = txt;
      if(tipo === 'ok'){
        box.style.background = '#dcfce7'; box.style.color = '#166534'; box.style.border = '1px solid #bbf7d0';
      }else if(tipo === 'warn'){
        box.style.background = '#fef3c7'; box.style.color = '#92400e'; box.style.border = '1px solid #fde68a';
      }else if(tipo === 'error'){
        box.style.background = '#fee2e2'; box.style.color = '#991b1b'; box.style.border = '1px solid #fecaca';
      }else{
        box.style.background = '#dbeafe'; box.style.color = '#1e40af'; box.style.border = '1px solid #bfdbfe';
      }
    });
  }

  function setEstadoBotonesFirma(modo){
    botonesFirmaVisibles().forEach(function(btn){
      if(!btn) return;
      if(!btn.dataset.auroFirmaHtmlOriginal){
        btn.dataset.auroFirmaHtmlOriginal = btn.innerHTML || '';
        btn.dataset.auroFirmaTitleOriginal = btn.getAttribute('title') || '';
      }
      if(modo === 'preparando'){
        btn.disabled = true;
        btn.setAttribute('aria-busy','true');
        btn.style.cursor = 'wait';
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Preparando firma…';
        btn.title = 'Preparando la solicitud de firma. Espere un momento.';
      }else if(modo === 'proceso'){
        btn.disabled = true;
        btn.setAttribute('aria-busy','true');
        btn.style.cursor = 'wait';
        btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Firma en proceso…';
        btn.title = 'La solicitud ya fue enviada. Adobe se abrirá cuando el motor la tome.';
      }else{
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.style.cursor = 'pointer';
        if(btn.dataset.auroFirmaHtmlOriginal) btn.innerHTML = btn.dataset.auroFirmaHtmlOriginal;
        if(btn.dataset.auroFirmaTitleOriginal) btn.title = btn.dataset.auroFirmaTitleOriginal;
      }
    });
  }

  function mensajeErrorAmigable(error){
    const raw = texto(error && error.message ? error.message : error);
    const n = normalizarTextoUI(raw);
    if(n.includes('tiempo de espera') && n.includes('bloqueo')){
      return 'La firma está atendiendo otra operación. Espere unos segundos y vuelva a intentarlo.';
    }
    return raw || 'No fue posible completar la operación de firma electrónica.';
  }

  function ocultarBotonCancelar(){
    const btn = document.getElementById('btnCancelarFirmaElectronicaReceta');
    if(btn) btn.style.display = 'none';
    claveActivaVisible = '';
    solicitudActivaVisible = null;
  }

  function mostrarBotonCancelar(solicitud, clave){
    claveActivaVisible = clave || '';
    solicitudActivaVisible = solicitud || null;

    const firmar = document.getElementById('btnFirmaElectronicaReceta');
    if(!firmar) return;

    let btn = document.getElementById('btnCancelarFirmaElectronicaReceta');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'btnCancelarFirmaElectronicaReceta';
      btn.type = 'button';
      btn.textContent = 'Cancelar firma';
      btn.title = 'Cancelar la solicitud de firma pendiente sin borrar la receta';
      btn.style.marginLeft = '8px';
      btn.style.cursor = 'pointer';
      firmar.insertAdjacentElement('afterend', btn);
    }

    btn.onclick = async function(){
      try{
        if(!solicitudActivaVisible) return;
        const confirmar = window.confirm(
          '¿Cancelar esta solicitud de firma?\n\nLa receta NO se elimina. Solo se cancela la firma pendiente.'
        );
        if(!confirmar) return;
        await cancelarFirmaDocumento(solicitudActivaVisible);
      }catch(_e){}
    };
    btn.style.display = '';
  }

  async function cancelarFirmaDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);
      const activa = firmasEnCurso.get(clave);

      if(!activa || !texto(activa.id_solicitud)){
        mensajeProfesional('No existe una solicitud de firma pendiente para cancelar.', 'warn');
        return {success:true, estado_firma:'SIN_PENDIENTE'};
      }

      const respuesta = await post('firmarDocumento', {
        operacion_frontend:'CANCELAR',
        id_solicitud:texto(activa.id_solicitud),
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const estado = texto(respuesta.estado_firma).toUpperCase();
      if(estado !== 'CANCELADA'){
        throw new Error('El servidor no confirmó la cancelación de la firma.');
      }

      activa.cancelada = true;
      firmasEnCurso.delete(clave);
      ocultarBotonCancelar();

      window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-cancelada', {
        detail:{
          tipo_documento:solicitud.tipo_documento,
          id_atencion:solicitud.id_atencion,
          id_receta:solicitud.id_receta,
          id_solicitud:texto(respuesta.id_solicitud),
          estado_firma:'CANCELADA'
        }
      }));

      pintarEstadoFirmaInline('Firma cancelada. Puede iniciar una nueva firma.', 'ok');
      setEstadoBotonesFirma('normal');
      mensajeProfesional('Firma cancelada. La receta se conserva sin cambios. Puede iniciar una nueva firma.', 'ok');
      return respuesta;
    }catch(error){
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    /* Sin vencimiento artificial: la espera termina solo por FIRMADO, ERROR
       o por un estado terminal informado explícitamente por el backend. */
    while(true){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor === 'CANCELADA') return estado;
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }
  }

  async function ejecutarFirma(solicitud, clave){
    const estadoMotor = await post('obtenerEstadoFirmaElectronica', {});
    if(estadoMotor.disponible !== true){
      throw new Error(
        estadoMotor.agente_online === false
          ? 'El motor de firma de Windows no está conectado. Inícielo y vuelva a intentar.'
          : 'La firma electrónica no está disponible en este momento.'
      );
    }

    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      const activa = firmasEnCurso.get(clave);
      if(activa){
        activa.id_solicitud = texto(creada.id_solicitud);
        activa.solicitud = solicitud;
      }
      mostrarBotonCancelar(solicitud, clave);
      setEstadoBotonesFirma('proceso');
      pintarEstadoFirmaInline('Solicitud enviada. Abriendo Adobe…', 'info');
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() === 'CANCELADA'){
      ocultarBotonCancelar();
      return resultado;
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);
    ocultarBotonCancelar();

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        const activa = firmasEnCurso.get(clave);
        if(activa && texto(activa.id_solicitud)){
          await post('firmarDocumento', {
            operacion_frontend:'REABRIR',
            id_solicitud:texto(activa.id_solicitud),
            id_atencion:solicitud.id_atencion,
            id_receta:solicitud.id_receta
          });
          mensajeProfesional('Se solicitó reabrir el mismo PDF pendiente en Acrobat.', 'warn');
        }else{
          mensajeProfesional('La solicitud todavía se está creando. Intente nuevamente en unos segundos.', 'warn');
        }
        return activa && activa.promesa ? activa.promesa : activa;
      }

      const activa = {promesa:null, id_solicitud:'', solicitud:solicitud, cancelada:false};
      const operacion = ejecutarFirma(solicitud, clave);
      activa.promesa = operacion;
      firmasEnCurso.set(clave, activa);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      ocultarBotonCancelar();
      setEstadoBotonesFirma('normal');
      console.error(MODULO, error);
      const amable = mensajeErrorAmigable(error);
      pintarEstadoFirmaInline(amable, 'error');
      mensajeProfesional(amable, 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    cancelarFirmaDocumento:cancelarFirmaDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();


/* ============================================================
   AUROSANAX V2.5 - OVERRIDE FINAL ANTIRREGRESIVO
   PLAN + RECETAS / CANCELAR + POLLING 1s
   ------------------------------------------------------------
   - Baseline V2.4 completo permanece intacto arriba.
   - NO modifica Plan, Recetas, Index ni backend.
   - Refleja el mismo botón Cancelar firma junto al botón de firma
     ya existente en Recetas y Plan.
   - CANCELAR activo solo con solicitud pendiente.
   - Tras CANCELADA o FIRMADO queda visible pero INACTIVO.
   - Polling frontend: 2500 ms -> 1000 ms.
   - No elimina preflight, no duplica POST, no cambia contratos.
============================================================ */
/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.7-ux-inmediata-lock-friendly';
  const INTERVALO_CONSULTA_MS = 1000;

  /* Una sola operación activa por receta+contenido.
     V2.3: conserva también id_solicitud para REABRIR sin duplicar. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;
  let claveActivaVisible = '';
  let solicitudActivaVisible = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }


  function normalizarTextoUI(valor){
    return String(valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function botonesFirmaVisibles(){
    const encontrados = [];
    const agregar = function(el){
      if(!el || encontrados.includes(el)) return;
      encontrados.push(el);
    };

    agregar(document.getElementById('btnFirmaElectronicaReceta'));

    document.querySelectorAll(
      '[data-auro-receta-action="firma-electronica"]'
    ).forEach(agregar);

    /*
      PLAN:
      No depende de un ID nuevo ni modifica plan.js/index.
      Solo reconoce el botón de firma que YA exista dentro del módulo Plan.
      Se filtra por texto/title para no tocar otros botones.
    */
    document.querySelectorAll(
      '#hc_plan button, #plan button, [data-auro-modulo="plan"] button'
    ).forEach(function(btn){
      const etiqueta = normalizarTextoUI(
        (btn.textContent || '') + ' ' +
        (btn.getAttribute('title') || '') + ' ' +
        (btn.getAttribute('aria-label') || '')
      );

      if(
        etiqueta.includes('firmar') &&
        (
          etiqueta.includes('receta') ||
          etiqueta.includes('electron')
        )
      ){
        agregar(btn);
      }
    });

    return encontrados;
  }

  function contextoBotonFirma(btn){
    if(!btn) return 'general';
    if(
      btn.closest &&
      btn.closest('#hc_plan, #plan, [data-auro-modulo="plan"]')
    ){
      return 'plan';
    }
    if(
      btn.id === 'btnFirmaElectronicaReceta' ||
      btn.closest?.('#recetas')
    ){
      return 'receta';
    }
    return 'general';
  }

  function asegurarBotonCancelarJuntoA(firmar){
    if(!firmar || !firmar.parentNode) return null;

    const contexto = contextoBotonFirma(firmar);
    const selector = '.auro-cancelar-firma-electronica[data-auro-contexto="' + contexto + '"]';
    let btn = firmar.parentNode.querySelector(selector);

    if(!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'auro-cancelar-firma-electronica';
      btn.setAttribute('data-auro-contexto', contexto);
      btn.textContent = 'Cancelar firma';
      btn.title = 'Cancelar la solicitud de firma pendiente sin borrar la receta';
      btn.style.marginLeft = '8px';
      btn.style.cursor = 'pointer';

      if(contexto === 'receta' && !document.getElementById('btnCancelarFirmaElectronicaReceta')){
        btn.id = 'btnCancelarFirmaElectronicaReceta';
      }else if(contexto === 'plan' && !document.getElementById('btnCancelarFirmaElectronicaPlan')){
        btn.id = 'btnCancelarFirmaElectronicaPlan';
      }

      firmar.insertAdjacentElement('afterend', btn);
    }

    btn.onclick = async function(){
      if(btn.disabled) return;

      try{
        if(!solicitudActivaVisible) return;

        const confirmar = window.confirm(
          '¿Cancelar esta solicitud de firma?\n\nLa receta NO se elimina. Solo se cancela la firma pendiente.'
        );
        if(!confirmar) return;

        setEstadoBotonesCancelar(false, true);
        await cancelarFirmaDocumento(solicitudActivaVisible);
      }catch(_e){
        if(solicitudActivaVisible){
          setEstadoBotonesCancelar(true, false);
        }
      }
    };

    return btn;
  }

  function setEstadoBotonesCancelar(activos, procesando){
    botonesFirmaVisibles().forEach(function(firmar){
      const btn = asegurarBotonCancelarJuntoA(firmar);
      if(!btn) return;

      btn.style.display = '';
      btn.disabled = !activos;
      btn.setAttribute(
        'aria-disabled',
        activos ? 'false' : 'true'
      );

      if(procesando){
        btn.setAttribute('aria-busy','true');
        btn.textContent = 'Cancelando…';
        btn.title = 'Cancelando la solicitud de firma pendiente';
        btn.style.cursor = 'wait';
      }else{
        btn.removeAttribute('aria-busy');
        btn.textContent = 'Cancelar firma';
        btn.title = activos
          ? 'Cancelar la solicitud de firma pendiente sin borrar la receta'
          : 'No existe una solicitud de firma pendiente';
        btn.style.cursor = activos ? 'pointer' : 'not-allowed';
      }
    });
  }

  function ocultarBotonCancelar(){
    /*
      V2.5:
      No se elimina ni se oculta después de cancelar/firmar.
      Queda INACTIVO, que es el comportamiento solicitado.
    */
    setEstadoBotonesCancelar(false, false);
    claveActivaVisible = '';
    solicitudActivaVisible = null;
  }

  function mostrarBotonCancelar(solicitud, clave){
    claveActivaVisible = clave || '';
    solicitudActivaVisible = solicitud || null;

    /*
      El mismo estado se refleja donde exista el botón de firma:
      Recetas y/o Plan. No crea una segunda solicitud.
    */
    setEstadoBotonesCancelar(true, false);
  }

  async function cancelarFirmaDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);
      const activa = firmasEnCurso.get(clave);

      if(!activa || !texto(activa.id_solicitud)){
        ocultarBotonCancelar();
        mensajeProfesional('No existe una solicitud de firma pendiente para cancelar.', 'warn');
        return {success:true, estado_firma:'SIN_PENDIENTE'};
      }

      const respuesta = await post('firmarDocumento', {
        operacion_frontend:'CANCELAR',
        id_solicitud:texto(activa.id_solicitud),
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const estado = texto(respuesta.estado_firma).toUpperCase();
      if(estado !== 'CANCELADA'){
        throw new Error('El servidor no confirmó la cancelación de la firma.');
      }

      activa.cancelada = true;
      firmasEnCurso.delete(clave);
      ocultarBotonCancelar();

      window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-cancelada', {
        detail:{
          tipo_documento:solicitud.tipo_documento,
          id_atencion:solicitud.id_atencion,
          id_receta:solicitud.id_receta,
          id_solicitud:texto(respuesta.id_solicitud),
          estado_firma:'CANCELADA'
        }
      }));

      mensajeProfesional('Solicitud de firma cancelada. La receta se conserva sin cambios.', 'warn');
      return respuesta;
    }catch(error){
      if(solicitudActivaVisible){
        setEstadoBotonesCancelar(true, false);
      }
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    /* Sin vencimiento artificial: la espera termina solo por FIRMADO, ERROR
       o por un estado terminal informado explícitamente por el backend. */
    while(true){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor === 'CANCELADA') return estado;
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }
  }

  async function ejecutarFirma(solicitud, clave){
    // V2.6: se elimina el preflight redundante.
    // El backend valida disponibilidad/heartbeat del motor al crear la solicitud.
    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      const activa = firmasEnCurso.get(clave);
      if(activa){
        activa.id_solicitud = texto(creada.id_solicitud);
        activa.solicitud = solicitud;
      }
      mostrarBotonCancelar(solicitud, clave);
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() === 'CANCELADA'){
      ocultarBotonCancelar();
      return resultado;
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);
    ocultarBotonCancelar();

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }


  function prepararControlesCancelar(){
    try{
      setEstadoBotonesCancelar(false, false);
    }catch(_e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', prepararControlesCancelar, {once:true});
  }else{
    prepararControlesCancelar();
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        const activa = firmasEnCurso.get(clave);
        if(activa && texto(activa.id_solicitud)){
          await post('firmarDocumento', {
            operacion_frontend:'REABRIR',
            id_solicitud:texto(activa.id_solicitud),
            id_atencion:solicitud.id_atencion,
            id_receta:solicitud.id_receta
          });
          mensajeProfesional('Se solicitó reabrir el mismo PDF pendiente en Acrobat.', 'warn');
        }else{
          mensajeProfesional('La solicitud todavía se está creando. Intente nuevamente en unos segundos.', 'warn');
        }
        return activa && activa.promesa ? activa.promesa : activa;
      }

      const activa = {promesa:null, id_solicitud:'', solicitud:solicitud, cancelada:false};
      const operacion = ejecutarFirma(solicitud, clave);
      activa.promesa = operacion;
      firmasEnCurso.set(clave, activa);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      ocultarBotonCancelar();
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    cancelarFirmaDocumento:cancelarFirmaDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();

/* ============================================================
   AUROSANAX V2.8 - PUENTE PERSISTENTE DE DOCUMENTOS FIRMADOS
   Adhesión append-only / antirregresiva.
   ------------------------------------------------------------
   - Conserva íntegra la API efectiva V2.7 anterior.
   - NO modifica el flujo Firmar / Reabrir / Cancelar.
   - documentos_firmados pasa a ser la fuente persistente para
     consultar firmas históricas entre sesiones y dispositivos.
   - Consulta por IDs clínicos; no usa localStorage como verdad.
   - Apertura persistente compatible con bloqueo de popups móvil:
     abre la pestaña en el gesto del usuario antes de esperar red.
============================================================ */
(function(){
  'use strict';

  const anterior = window.auroFirmaElectronica;
  if(!anterior || typeof anterior.firmarDocumento !== 'function'){
    console.error('AUROSANAX FIRMA ELECTRÓNICA V2.8: no se encontró la API V2.7 previa.');
    return;
  }

  const VERSION = '2.8-persistente-multidispositivo';

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(_e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(_e){
      return '';
    }
  }

  async function postPersistente(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token:tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok){
      throw new Error('El servidor respondió HTTP ' + res.status + '.');
    }

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(
        texto(json && json.message) ||
        'No fue posible consultar el documento firmado.'
      );
    }
    return json;
  }

  function normalizarFiltro(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento || 'RECETA').toUpperCase();
    d.id_firma_documento = texto(d.id_firma_documento);
    d.id_paciente = texto(d.id_paciente);
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);

    if(
      !d.id_firma_documento &&
      !d.id_paciente &&
      !d.id_atencion &&
      !d.id_receta
    ){
      throw new Error('La consulta de firma requiere un identificador clínico.');
    }
    return d;
  }

  async function consultarDocumentosFirmados(data){
    const d = normalizarFiltro(data);
    const r = await postPersistente('consultarDocumentosFirmados', d);
    const documentos = Array.isArray(r.documentos) ? r.documentos : [];
    return Object.assign({}, r, {
      documentos:documentos,
      total:Number(r.total || documentos.length || 0),
      documento:r.documento || (documentos.length ? documentos[0] : null)
    });
  }

  async function obtenerDocumentoFirmado(data){
    const r = await consultarDocumentosFirmados(data);
    return r.documento || null;
  }

  async function obtenerDocumentoFirmadoPorReceta(idAtencion, idReceta){
    const atencion = texto(idAtencion);
    const receta = texto(idReceta);
    if(!atencion || !receta){
      throw new Error('Se requiere id_atencion + id_receta para consultar la receta firmada.');
    }
    return obtenerDocumentoFirmado({
      tipo_documento:'RECETA',
      id_atencion:atencion,
      id_receta:receta
    });
  }

  async function obtenerPdfFirmadoPersistente(data){
    const d = normalizarFiltro(data);
    if(!d.id_firma_documento && (!d.id_atencion || !d.id_receta)){
      throw new Error(
        'Para obtener el PDF firmado se requiere id_firma_documento o id_atencion + id_receta.'
      );
    }
    return postPersistente('obtenerPdfFirmadoPersistente', d);
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function base64Pdf(resultado){
    return texto(resultado && (
      resultado.pdf_firmado_base64 ||
      resultado.archivo_base64
    ));
  }

  async function abrirPdfFirmadoPersistente(data){
    /*
      La ventana se crea ANTES del await. Esto conserva el gesto directo
      del usuario y reduce bloqueos en Safari/iPhone y navegadores móviles.
    */
    const ventana = window.open('', '_blank');
    if(!ventana){
      throw new Error(
        'El navegador bloqueó la nueva pestaña. Habilite ventanas emergentes para ver el PDF firmado.'
      );
    }

    try{
      ventana.document.title = 'Cargando receta firmada…';
      ventana.document.body.innerHTML =
        '<p style="font-family:Arial,sans-serif;padding:20px">Cargando PDF firmado…</p>';

      const r = await obtenerPdfFirmadoPersistente(data);
      const b64 = base64Pdf(r);
      if(!b64) throw new Error('El servidor no devolvió el PDF firmado.');

      const blob = base64ABlob(b64, 'application/pdf');
      const url = URL.createObjectURL(blob);
      ventana.location.replace(url);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
      return r;
    }catch(error){
      try{ ventana.close(); }catch(_e){}
      throw error;
    }
  }

  async function descargarPdfFirmadoPersistente(data, nombrePreferido){
    const r = await obtenerPdfFirmadoPersistente(data);
    const b64 = base64Pdf(r);
    if(!b64) throw new Error('El servidor no devolvió el PDF firmado.');

    const blob = base64ABlob(b64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto(
      r.nombre_archivo || nombrePreferido || 'documento_firmado.pdf'
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return r;
  }

  const api = Object.assign({}, anterior, {
    version:VERSION,
    consultarDocumentosFirmados:consultarDocumentosFirmados,
    obtenerDocumentoFirmado:obtenerDocumentoFirmado,
    obtenerDocumentoFirmadoPorReceta:obtenerDocumentoFirmadoPorReceta,
    obtenerPdfFirmadoPersistente:obtenerPdfFirmadoPersistente,
    abrirPdfFirmadoPersistente:abrirPdfFirmadoPersistente,
    descargarPdfFirmadoPersistente:descargarPdfFirmadoPersistente
  });

  window.auroFirmaElectronica = Object.freeze(api);

  window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-persistente-lista', {
    detail:{version:VERSION}
  }));
})();

/* ============================================================
   AUROSANAX FIRMA ELECTRÓNICA 3.0
   ESTADOS VISUALES + IDENTIDAD EXACTA DE VERSIÓN FIRMADA
   ------------------------------------------------------------
   CORRECCIÓN ANTIRREGRESIVA SOBRE V2.8:
   - Conserva íntegro todo el baseline V2.1 -> V2.8 anterior.
   - Sustituye únicamente la adhesión V2.9 final.
   - Mantiene Firmar / Reabrir / Cancelar / PDF persistente.
   - Mantiene polling efectivo existente de 1000 ms.
   - NO añade polling, esperas ni consultas periódicas nuevas.
   - Corrige la huella documental usando EXACTAMENTE la misma
     normalización de entrada que usa el motor frontend efectivo:
     String(...).trim() antes de SHA-256.
   - Confirma en memoria la versión que acaba de devolver FIRMADO,
     evitando que una consulta inmediata la reclasifique como nueva.
   - En recarga/otro dispositivo, documentos_firmados sigue siendo
     la fuente persistente de verdad.
============================================================ */
(function auroFirmaEstadosUniversalesV30(){
  'use strict';

  const anterior = window.auroFirmaElectronica;
  if(!anterior || typeof anterior.firmarDocumento !== 'function') return;

  const VERSION = '3.0-estado-version-firmada';
  const versionesFirmadasSesion = new Map();

  function texto(v){
    return String(v === null || v === undefined ? '' : v).trim();
  }

  function emitir(estado, detalle){
    try{
      window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-estado', {
        detail:Object.assign({estado:estado}, detalle || {})
      }));
    }catch(_e){}
  }

  function botonesFirma(){
    const arr = [];
    const add = function(el){
      if(el && !arr.includes(el)) arr.push(el);
    };
    add(document.getElementById('btnFirmaElectronicaReceta'));
    add(document.getElementById('btnFirmaElectronicaPlanReceta'));
    document.querySelectorAll('[data-auro-receta-action="firma-electronica"]').forEach(add);
    return arr;
  }

  function pintar(modo){
    botonesFirma().forEach(function(btn){
      if(!btn) return;

      if(!btn.dataset.auroV30HtmlReposo){
        btn.dataset.auroV30HtmlReposo = btn.innerHTML || '';
        btn.dataset.auroV30TitleReposo = btn.getAttribute('title') || '';
      }

      if(modo === 'PREPARANDO'){
        btn.disabled = true;
        btn.setAttribute('aria-busy','true');
        btn.setAttribute('data-auro-firma-operativa','PREPARANDO');
        btn.style.cursor = 'wait';
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Preparando firma…';
        btn.title = 'Preparando la solicitud de firma. Espere un momento.';
      }else if(modo === 'PROCESO'){
        btn.disabled = true;
        btn.setAttribute('aria-busy','true');
        btn.setAttribute('data-auro-firma-operativa','PROCESO');
        btn.style.cursor = 'wait';
        btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Firma en proceso…';
        btn.title = 'La solicitud de firma está en proceso.';
      }else{
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.removeAttribute('data-auro-firma-operativa');
        btn.style.cursor = 'pointer';
        /*
          Recetas/Plan siguen siendo propietarios del estado documental
          de reposo. Este módulo solo publica el estado operativo/documental.
        */
      }
    });
  }

  async function sha256TextoNormalizado(valor){
    /*
      IMPORTANTE:
      validarSolicitud() del flujo efectivo V2.7 normaliza html_documento
      mediante texto(), es decir String(...).trim(), ANTES del POST.
      La identidad documental debe calcularse sobre esa misma cadena.
    */
    const normalizado = texto(valor);
    const datos = new TextEncoder().encode(normalizado);
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function identidadVersion(data){
    const d = Object.assign({}, data || {});
    const idAtencion = texto(d.id_atencion);
    const idReceta = texto(d.id_receta || d.id_documento_clinico);
    const html = texto(d.html_documento);

    if(!idAtencion || !idReceta || !html) return null;

    const huella = await sha256TextoNormalizado(html);
    return {
      id_atencion:idAtencion,
      id_receta:idReceta,
      huella:huella,
      clave:idAtencion + '|' + idReceta + '|' + huella
    };
  }

  async function obtenerEstadoVersionDocumento(data){
    const identidad = await identidadVersion(data);

    if(!identidad){
      return {success:false, estado:'NO_DISPONIBLE', total_firmas:0};
    }

    /*
      Confirmación inmediata:
      si ESTA MISMA versión acaba de obtener FIRMADO en esta sesión,
      no se contradice con una consulta persistente que todavía esté
      propagándose. No genera red, espera ni polling adicional.
    */
    if(versionesFirmadasSesion.has(identidad.clave)){
      const confirmado = versionesFirmadasSesion.get(identidad.clave);
      return {
        success:true,
        estado:'FIRMADA',
        total_firmas:Number(confirmado.total_firmas || 1),
        documento:confirmado.documento || null,
        confirmacion:'SESION'
      };
    }

    if(typeof anterior.consultarDocumentosFirmados !== 'function'){
      return {success:false, estado:'NO_DISPONIBLE', total_firmas:0};
    }

    const r = await anterior.consultarDocumentosFirmados({
      tipo_documento:'RECETA',
      id_atencion:identidad.id_atencion,
      id_receta:identidad.id_receta
    });

    const docs = Array.isArray(r && r.documentos) ? r.documentos : [];
    const firmada = docs.find(function(doc){
      return texto(doc && doc.sha256_origen).toLowerCase() === identidad.huella;
    }) || null;

    if(firmada){
      versionesFirmadasSesion.set(identidad.clave, {
        documento:firmada,
        total_firmas:docs.length
      });
    }

    return {
      success:true,
      estado:firmada ? 'FIRMADA' : (docs.length ? 'NUEVA_VERSION' : 'SIN_FIRMA'),
      total_firmas:docs.length,
      documento:firmada,
      confirmacion:firmada ? 'PERSISTENTE' : ''
    };
  }

  async function firmarDocumento(data){
    const detalle = {
      tipo_documento:texto(data && data.tipo_documento).toUpperCase(),
      id_atencion:texto(data && data.id_atencion),
      id_receta:texto(data && (data.id_receta || data.id_documento_clinico))
    };

    pintar('PREPARANDO');
    emitir('PREPARANDO', detalle);

    requestAnimationFrame(function(){
      pintar('PROCESO');
      emitir('PROCESO', detalle);
    });

    try{
      const resultado = await anterior.firmarDocumento(data);
      const estado = texto(resultado && resultado.estado_firma).toUpperCase();

      if(estado === 'FIRMADO'){
        /*
          Registrar primero la identidad EXACTA de los datos que entraron al
          flujo de firma. Esto es O(1), local y no añade latencia de red.
        */
        const identidad = await identidadVersion(data);
        if(identidad){
          versionesFirmadasSesion.set(identidad.clave, {
            documento:null,
            total_firmas:1
          });
        }

        emitir('FIRMADO', Object.assign({}, detalle, {
          id_solicitud:texto(resultado && resultado.id_solicitud),
          sha256_origen:identidad ? identidad.huella : ''
        }));
      }else if(estado === 'CANCELADA'){
        emitir('CANCELADA', detalle);
      }else{
        emitir('NORMAL', detalle);
      }

      return resultado;
    }catch(error){
      emitir('ERROR', Object.assign({}, detalle, {
        message:texto(error && error.message)
      }));
      throw error;
    }finally{
      pintar('NORMAL');
      emitir('NORMAL', detalle);
    }
  }

  window.auroFirmaElectronica = Object.freeze(Object.assign({}, anterior, {
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEstadoVersionDocumento:obtenerEstadoVersionDocumento
  }));
})();
/* ============================================================
   AUROSANAX FIRMA ELECTRÓNICA V3.1.1
   ENRUTAMIENTO POR EQUIPO — PUENTE LOCAL ROBUSTO
   ------------------------------------------------------------
   Adhesión append-only sobre el archivo completo recibido.
   - Conserva íntegro V2.1 -> V3.0.
   - Identifica el PC mediante el /health del motor local.
   - Solicita acceso de red local desde el gesto directo "Firmar"
     cuando el navegador expone la API de permisos correspondiente.
   - Usa 127.0.0.1 y localhost como rutas compatibles.
   - Falla cerrado: jamás crea una solicitud sin equipo destino.
   - No modifica Adobe, doble firma, polling, cancelar, reabrir,
     persistencia, SHA ni contratos clínicos.
============================================================ */
(function auroFirmaEnrutamientoEquipoV311(){
  'use strict';

  const anterior = window.auroFirmaElectronica;
  if(!anterior || typeof anterior.firmarDocumento !== 'function'){
    console.error('AUROSANAX FIRMA V3.1.1: API previa no disponible.');
    return;
  }

  const VERSION = '3.1.1-enrutamiento-equipo-local';
  const HEALTH_URLS = [
    'http://127.0.0.1:8080/health',
    'http://localhost:8080/health'
  ];
  const TIMEOUT_MS = 3500;

  function texto(v){
    return String(v === null || v === undefined ? '' : v).trim();
  }

  async function habilitarRedLocal_(){
    /*
      Chrome/Edge modernos pueden exigir permiso explícito para que una
      página pública consulte un servicio HTTP en loopback/red local.
      La consulta se ejecuta dentro del clic original de Firmar.
      Navegadores sin esta API continúan por el flujo CORS/PNA normal.
    */
    try{
      if(navigator.permissions && typeof navigator.permissions.query === 'function'){
        try{
          const p = await navigator.permissions.query({name:'local-network-access'});
          if(p && p.state === 'denied'){
            throw new Error('El navegador tiene bloqueado el acceso al motor local de firma.');
          }
        }catch(e){
          if(texto(e && e.message).includes('bloqueado el acceso')) throw e;
          /* API/descriptor no soportado: continuar con fetch normal. */
        }
      }
    }catch(e){
      throw e;
    }
  }

  async function health_(url){
    const ctl = new AbortController();
    const timer = setTimeout(function(){
      try{ ctl.abort(); }catch(_e){}
    }, TIMEOUT_MS);

    try{
      const r = await fetch(url, {
        method:'GET',
        mode:'cors',
        credentials:'omit',
        cache:'no-store',
        signal:ctl.signal
      });
      if(!r.ok) return null;
      const j = await r.json();
      const id = texto(j && j.id_equipo);
      if(!j || j.success !== true || !id) return null;
      return {
        id_equipo:id,
        version:texto(j.version),
        servicio:texto(j.servicio),
        url:url
      };
    }catch(_e){
      return null;
    }finally{
      clearTimeout(timer);
    }
  }

  async function obtenerEquipoLocal_(){
    await habilitarRedLocal_();
    for(const url of HEALTH_URLS){
      const h = await health_(url);
      if(h) return h;
    }
    return null;
  }

  async function firmarDocumento(data){
    const h = await obtenerEquipoLocal_();

    if(!h || !texto(h.id_equipo)){
      throw new Error(
        'No se pudo conectar con el motor de firma de este computador. ' +
        'Verifique que el motor esté iniciado y que el navegador permita acceso a la red local.'
      );
    }

    const dirigido = Object.assign({}, data || {}, {
      id_equipo_destino:h.id_equipo,
      id_equipo:h.id_equipo
    });

    return anterior.firmarDocumento(dirigido);
  }

  window.auroFirmaElectronica = Object.freeze(Object.assign({}, anterior, {
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEquipoLocal:obtenerEquipoLocal_
  }));
})();
