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
