function valorConfigCentro(clave, valorDefault){
    const v = configuracionCentro && configuracionCentro[clave] !== undefined ? configuracionCentro[clave] : '';
    return v !== '' && v !== null && v !== undefined ? v : (valorDefault || '');
  }

  function normalizarDriveImageUrl(url){
    const raw = String(url || '').trim();
    if(!raw) return '';

    let m = raw.match(/\/file\/d\/([^/]+)/);
    if(m && m[1]) return 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(m[1]);

    m = raw.match(/[?&]id=([^&]+)/);
    if(m && m[1]) return 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(m[1]);

    return raw;
  }

  function actualizarPreviewLogoCentro(){
    const input = document.getElementById('cfgLogoUrl');
    const img = document.getElementById('cfgLogoPreview');
    const fallback = document.getElementById('cfgLogoFallback');
    if(!input || !img || !fallback) return;

    const url = normalizarDriveImageUrl(input.value);
    if(!url){
      img.style.display = 'none';
      fallback.style.display = 'grid';
      img.removeAttribute('src');
      return;
    }

    img.onload = () => { img.style.display = 'block'; fallback.style.display = 'none'; };
    img.onerror = () => { img.style.display = 'none'; fallback.style.display = 'grid'; };
    img.src = url;
  }


  function procesarLogoArchivoCentro(event){
    const archivo = event && event.target && event.target.files ? event.target.files[0] : null;
    const img = document.getElementById('cfgLogoPreview');
    const fallback = document.getElementById('cfgLogoFallback');
    const estado = document.getElementById('cfgLogoArchivoEstado');
    const msg = document.getElementById('centroMsg');

    window.auroLogoArchivoCentroPendiente = null;

    if(!archivo){
      if(estado) estado.innerHTML = 'Sin archivo seleccionado.';
      actualizarPreviewLogoCentro();
      return;
    }

    const tiposPermitidos = ['image/png','image/jpeg','image/webp','image/svg+xml'];
    if(!tiposPermitidos.includes(archivo.type)){
      if(estado) estado.innerHTML = '<span class="text-danger fw-bold">Formato no permitido. Use PNG, JPG, WEBP o SVG.</span>';
      if(event && event.target) event.target.value = '';
      actualizarPreviewLogoCentro();
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if(archivo.size > maxBytes){
      if(estado) estado.innerHTML = '<span class="text-danger fw-bold">Archivo muy pesado. Máximo recomendado: 2 MB.</span>';
      if(event && event.target) event.target.value = '';
      actualizarPreviewLogoCentro();
      return;
    }

    const reader = new FileReader();

    reader.onload = function(e){
      window.auroLogoArchivoCentroPendiente = {
        nombre: archivo.name,
        tipo: archivo.type,
        peso: archivo.size,
        base64: e.target.result
      };

      if(img && fallback){
        img.onload = () => { img.style.display = 'block'; fallback.style.display = 'none'; };
        img.onerror = () => { img.style.display = 'none'; fallback.style.display = 'grid'; };
        img.src = e.target.result;
      }

      const kb = Math.round(archivo.size / 1024);
      if(estado) estado.innerHTML = '<i class="bi bi-image me-1"></i> Archivo listo para vista previa: <b>' + safeText(archivo.name) + '</b> (' + kb + ' KB).';
      if(msg) msg.innerHTML = '<i class="bi bi-info-circle me-1"></i> Logo seleccionado en vista previa. Para guardarlo en Drive falta actualizar Apps Script en el siguiente paso.';
    };

    reader.onerror = function(){
      window.auroLogoArchivoCentroPendiente = null;
      if(estado) estado.innerHTML = '<span class="text-danger fw-bold">No se pudo leer el archivo seleccionado.</span>';
      actualizarPreviewLogoCentro();
    };

    reader.readAsDataURL(archivo);
  }

  async function cargarConfiguracionCentro(){
    const msg = document.getElementById('centroMsg');
    try{
      configuracionCentro = await apiGet('obtenerConfiguracion');
      if(!configuracionCentro || typeof configuracionCentro !== 'object' || Array.isArray(configuracionCentro)) configuracionCentro = {};

      document.getElementById('cfgNombreClinica').value = valorConfigCentro('nombre_clinica', 'AUROSANAX DEMO');
      document.getElementById('cfgWhatsappClinica').value = valorConfigCentro('whatsapp_clinica', '');
      document.getElementById('cfgEmailClinica').value = valorConfigCentro('email_clinica', '');
      document.getElementById('cfgDireccionClinica').value = valorConfigCentro('direccion_clinica', '');
      document.getElementById('cfgLogoUrl').value = valorConfigCentro('logo_url', '');
      document.getElementById('cfgColorPrincipal').value = valorConfigCentro('color_principal', '#8b1e5a');
      document.getElementById('cfgColorSecundario').value = valorConfigCentro('color_secundario', '#c23b83');
      document.getElementById('cfgModoSistema').value = valorConfigCentro('modo_sistema', 'DEMO');
      actualizarPreviewLogoCentro();

      const archivoInput = document.getElementById('cfgLogoArchivo');
      const archivoEstado = document.getElementById('cfgLogoArchivoEstado');
      if(archivoInput) archivoInput.value = '';
      if(archivoEstado) archivoEstado.innerHTML = 'Sin archivo seleccionado.';
      window.auroLogoArchivoCentroPendiente = null;

      if(msg) msg.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Datos institucionales cargados desde la hoja <b>configuracion</b>. Colores y modo sistema están bloqueados por seguridad.';
    }catch(e){
      console.error(e);
      if(msg) msg.innerHTML = '<span class="text-danger fw-bold">Error cargando datos del centro. Revise conexión o Apps Script.</span>';
    }
  }

  async function guardarConfiguracionCentro(){
    const msg = document.getElementById('centroMsg');
    const btn = document.getElementById('btnGuardarCentro');

    const datosSeguros = {
      nombre_clinica: document.getElementById('cfgNombreClinica').value.trim(),
      whatsapp_clinica: document.getElementById('cfgWhatsappClinica').value.trim(),
      email_clinica: document.getElementById('cfgEmailClinica').value.trim(),
      direccion_clinica: document.getElementById('cfgDireccionClinica').value.trim(),
      logo_url: document.getElementById('cfgLogoUrl').value.trim()
    };

    if(window.auroLogoArchivoCentroPendiente && !datosSeguros.logo_url){
      if(msg) msg.innerHTML = '<i class="bi bi-info-circle me-1"></i> El logo desde archivo está en vista previa, pero aún no se puede guardar en Drive hasta actualizar Apps Script. Pegue una Logo URL o continúe guardando los demás datos.';
    }

    if(!datosSeguros.nombre_clinica){
      alert('Ingrese el nombre del centro médico.');
      return;
    }

    const old = btn ? btn.innerHTML : '';
    if(btn){
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Guardando...';
    }
    if(msg) msg.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Guardando datos institucionales...';

    try{
      for(const [clave, valor] of Object.entries(datosSeguros)){
        const r = await apiPost('editarConfiguracion', {clave, valor});
        if(!r.success) throw new Error(r.message || 'No se pudo guardar ' + clave);
      }

      await cargarConfiguracionCentro();
      if(msg) msg.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Configuración institucional guardada correctamente.';
      alert('Datos del centro guardados correctamente.');
    }catch(e){
      console.error(e);
      if(msg) msg.innerHTML = '<span class="text-danger fw-bold">Error: ' + safeText(e.message || e) + '</span>';
      alert('Error al guardar configuración: ' + (e.message || e));
    }finally{
      if(btn){
        btn.disabled = false;
        btn.innerHTML = old;
      }
    }
  }
