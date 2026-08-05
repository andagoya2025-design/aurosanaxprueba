/* =========================================================
   AUROSANAX ERP - MODULO COMPARTIR
   Archivo: compartir.js
   Fase 2: módulo genérico para compartir documentos
   Importante:
   - No genera el PDF.
   - Recibe un Blob/File ya generado por otro módulo.
   - No conoce recetas, certificados, consentimientos ni historias clínicas.
   - Puede ser reutilizado por cualquier módulo del ERP.
   - No modifica impresión, PDF, Google Sheets ni Apps Script.
========================================================= */

(function(){
  'use strict';

  const VERSION = '1.0.0';

  function textoSeguro(valor){
    return String(valor == null ? '' : valor).trim();
  }

  function normalizarNombreArchivo(nombre, extension){
    let limpio = textoSeguro(nombre)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    if(!limpio) limpio = 'documento-aurosanax';

    const ext = textoSeguro(extension).replace(/^\./, '');
    if(ext && !limpio.toLowerCase().endsWith('.' + ext.toLowerCase())){
      limpio += '.' + ext;
    }

    return limpio;
  }

  function normalizarTelefonoWhatsApp(numero, codigoPais){
    let limpio = textoSeguro(numero).replace(/[^\d+]/g, '');
    if(!limpio) return '';

    if(limpio.startsWith('+')){
      return limpio.substring(1).replace(/\D/g, '');
    }

    limpio = limpio.replace(/\D/g, '');
    const pais = textoSeguro(codigoPais || '593').replace(/\D/g, '');

    if(pais === '593' && /^09\d{8}$/.test(limpio)){
      return '593' + limpio.substring(1);
    }

    if(pais && !limpio.startsWith(pais)){
      return pais + limpio.replace(/^0+/, '');
    }

    return limpio;
  }

  function crearFileDesdeBlob(blob, nombreArchivo, tipoMime){
    if(blob instanceof File) return blob;
    if(!(blob instanceof Blob)) throw new TypeError('Se esperaba un Blob o File válido.');

    return new File([blob], normalizarNombreArchivo(nombreArchivo, 'pdf'), {
      type: textoSeguro(tipoMime) || blob.type || 'application/pdf',
      lastModified: Date.now()
    });
  }

  function puedeCompartirArchivos(){
    return !!(navigator.share && navigator.canShare && typeof File !== 'undefined');
  }

  function puedeCompartirTexto(){
    return typeof navigator.share === 'function';
  }

  function descargarArchivo(blob, nombreArchivo){
    if(!(blob instanceof Blob)) throw new TypeError('No existe un archivo válido para descargar.');

    const nombre = normalizarNombreArchivo(nombreArchivo, 'pdf');
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);

    return { ok:true, accion:'descarga', nombreArchivo:nombre };
  }

  async function compartirArchivo(opciones){
    const cfg = opciones || {};
    const blob = cfg.file || cfg.blob || null;
    const titulo = textoSeguro(cfg.title || cfg.titulo || 'Documento AUROSANAX');
    const texto = textoSeguro(cfg.text || cfg.texto || '');
    const nombreArchivo = normalizarNombreArchivo(
      cfg.fileName || cfg.nombreArchivo || 'documento-aurosanax.pdf',
      'pdf'
    );

    if(!(blob instanceof Blob)) throw new Error('No se recibió un PDF válido para compartir.');

    const archivo = crearFileDesdeBlob(blob, nombreArchivo, blob.type || 'application/pdf');

    if(puedeCompartirArchivos() && navigator.canShare({ files:[archivo] })){
      await navigator.share({ title:titulo, text:texto, files:[archivo] });
      return { ok:true, accion:'compartido-archivo', nombreArchivo:archivo.name };
    }

    return descargarArchivo(archivo, archivo.name);
  }

  async function compartirTexto(opciones){
    const cfg = opciones || {};
    const titulo = textoSeguro(cfg.title || cfg.titulo || 'AUROSANAX');
    const texto = textoSeguro(cfg.text || cfg.texto || '');
    const url = textoSeguro(cfg.url || '');

    if(puedeCompartirTexto()){
      await navigator.share({ title:titulo, text:texto, url:url || undefined });
      return { ok:true, accion:'compartido-texto' };
    }

    if(navigator.clipboard && texto){
      await navigator.clipboard.writeText([texto, url].filter(Boolean).join('\n'));
      return { ok:true, accion:'copiado-portapapeles' };
    }

    throw new Error('Este navegador no admite compartir ni copiar automáticamente.');
  }

  function abrirWhatsApp(opciones){
    const cfg = opciones || {};
    const numero = normalizarTelefonoWhatsApp(
      cfg.phone || cfg.telefono || cfg.whatsapp || '',
      cfg.countryCode || cfg.codigoPais || '593'
    );

    if(!numero) throw new Error('El paciente no tiene un número de WhatsApp válido.');

    const mensaje = textoSeguro(
      cfg.message || cfg.mensaje || 'Hola, le compartimos su documento emitido por AUROSANAX.'
    );

    const url = 'https://wa.me/' + encodeURIComponent(numero) + '?text=' + encodeURIComponent(mensaje);
    const ventana = window.open(url, '_blank', 'noopener,noreferrer');
    if(!ventana) window.location.href = url;

    return { ok:true, accion:'whatsapp', telefono:numero };
  }

  function abrirCorreo(opciones){
    const cfg = opciones || {};
    const correo = textoSeguro(cfg.email || cfg.correo || '');
    if(!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){
      throw new Error('El paciente no tiene un correo válido.');
    }

    const asunto = textoSeguro(cfg.subject || cfg.asunto || 'Documento médico AUROSANAX');
    const cuerpo = textoSeguro(cfg.body || cfg.cuerpo || 'Hola, le compartimos su documento emitido por AUROSANAX.');
    window.location.href = 'mailto:' + encodeURIComponent(correo) +
      '?subject=' + encodeURIComponent(asunto) +
      '&body=' + encodeURIComponent(cuerpo);

    return { ok:true, accion:'correo', correo:correo };
  }

  window.AuroCompartir = Object.freeze({
    version: VERSION,
    puedeCompartirArchivos: puedeCompartirArchivos,
    puedeCompartirTexto: puedeCompartirTexto,
    compartirArchivo: compartirArchivo,
    compartirTexto: compartirTexto,
    abrirWhatsApp: abrirWhatsApp,
    abrirCorreo: abrirCorreo,
    descargarArchivo: descargarArchivo,
    normalizarTelefonoWhatsApp: normalizarTelefonoWhatsApp
  });

  console.info('AUROSANAX compartir.js genérico cargado · versión ' + VERSION);
})();
