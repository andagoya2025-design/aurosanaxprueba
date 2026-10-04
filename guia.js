/*
======================================================================
AUROSANAX — guia.js
ASISTENTE CONTEXTUAL PREMIUM DEL ERP
Versión 1.2.0 · flotante, ocultable, no clínico, no persistente
======================================================================

CONTRATO ANTIRREGRESIVO
- Presentación y capacitación únicamente.
- NO guarda datos clínicos.
- NO crea pacientes, historias, citas ni atenciones.
- NO modifica IDs clínicos.
- NO realiza fetch, POST, consultas ni persistencia.
- NO firma, NO finaliza atenciones y NO dispara botones propietarios.
- Los módulos informan hechos ya confirmados; la guía solo orienta.
- Si este archivo falla o no carga, el ERP conserva su flujo propietario.
- Todo el CSS está encapsulado en auro-guia-*.
======================================================================
*/
(function auroGuiaBootstrap(window, document){
  'use strict';

  if(!window || !document) return;
  if(window.AurosanaxGuia && window.AurosanaxGuia.__auroGuiaMotor === true) return;

  const VERSION='1.2.0';
  const STYLE_ID='auroGuiaStyles';
  const HOST_ID='auroGuiaFloatingHost';
  const mounts=new Map();
  let activo='';

  function texto(v,f){
    const t=String(v==null?'':v).trim();
    return t || String(f||'').trim();
  }

  function tipo(v){
    const t=String(v||'info').trim().toLowerCase();
    return ['info','ok','warning','neutral'].includes(t)?t:'info';
  }

  function normalizar(c){
    c=c&&typeof c==='object'?c:{};
    return {
      tipo:tipo(c.tipo),
      titulo:texto(c.titulo,'Asistente AUROSANAX'),
      resumen:texto(c.resumen,''),
      detalle:texto(c.detalle,''),
      siguiente:texto(c.siguiente,''),
      expandible:c.expandible!==false,
      expandida:c.expandida===true,
      ocultable:c.ocultable!==false,
      etiquetaAbrir:texto(c.etiquetaAbrir,'Más información'),
      etiquetaCerrar:texto(c.etiquetaCerrar,'Ver menos')
    };
  }

  function inyectarEstilos(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      #${HOST_ID}{
        position:fixed;
        top:88px;
        right:18px;
        z-index:2147482000;
        width:min(380px,calc(100vw - 36px));
        pointer-events:none;
        font:inherit;
      }
      .auro-guia-card,.auro-guia-launcher{box-sizing:border-box;font:inherit}
      .auro-guia-card{
        pointer-events:auto;
        width:100%;
        color:#172033;
        background:linear-gradient(145deg,#ffffff 0%,#fff7fd 100%);
        border:1px solid rgba(217,70,239,.34);
        border-radius:18px;
        box-shadow:0 18px 55px rgba(76,29,149,.20),0 5px 18px rgba(162,28,175,.13);
        overflow:hidden;
        animation:auroGuiaEntrada .22s ease-out;
      }
      .auro-guia-card[data-tipo="ok"]{border-color:rgba(16,185,129,.48)}
      .auro-guia-card[data-tipo="warning"]{border-color:rgba(245,158,11,.55)}
      .auro-guia-top{
        display:flex;align-items:flex-start;gap:10px;
        padding:14px 14px 11px;
        background:linear-gradient(120deg,rgba(192,38,211,.13),rgba(236,72,153,.08));
      }
      .auro-guia-icon{
        width:34px;height:34px;flex:0 0 34px;border-radius:11px;
        display:grid;place-items:center;
        background:linear-gradient(135deg,#c026d3,#ec4899);
        color:#fff;font-weight:900;box-shadow:0 7px 18px rgba(192,38,211,.28);
      }
      .auro-guia-card[data-tipo="ok"] .auro-guia-icon{background:linear-gradient(135deg,#059669,#10b981)}
      .auro-guia-copy{min-width:0;flex:1}
      .auro-guia-brand{font-size:11px;font-weight:900;letter-spacing:.055em;text-transform:uppercase;color:#9d174d}
      .auro-guia-title{margin:2px 0 0;font-size:16px;font-weight:850;line-height:1.2;color:#3b174f}
      .auro-guia-close{
        pointer-events:auto;appearance:none;border:0;background:rgba(255,255,255,.82);
        color:#6b7280;width:32px;height:32px;border-radius:10px;cursor:pointer;
        font-size:20px;line-height:1;display:grid;place-items:center;
      }
      .auro-guia-close:hover{background:#fff;color:#831843}
      .auro-guia-body{padding:12px 14px 14px}
      .auro-guia-summary{margin:0;color:#4b5563;font-size:13.5px;line-height:1.45}
      .auro-guia-next{
        margin:10px 0 0;padding:10px 11px;border-radius:12px;
        background:linear-gradient(135deg,rgba(217,70,239,.12),rgba(236,72,153,.09));
        color:#701a75;font-size:13.5px;font-weight:800;line-height:1.35
      }
      .auro-guia-detail{
        margin:10px 0 0;padding-top:10px;border-top:1px solid rgba(148,163,184,.22);
        color:#64748b;font-size:12.5px;line-height:1.45
      }
      .auro-guia-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
      .auro-guia-btn{
        appearance:none;border:1px solid rgba(192,38,211,.24);background:#fff;color:#86198f;
        min-height:36px;padding:7px 11px;border-radius:10px;font:inherit;font-size:12.5px;
        font-weight:800;cursor:pointer
      }
      .auro-guia-btn:hover{background:#fdf4ff}
      .auro-guia-launcher{
        pointer-events:auto;margin-left:auto;display:none;align-items:center;gap:7px;
        border:1px solid rgba(217,70,239,.38);background:linear-gradient(135deg,#c026d3,#ec4899);
        color:#fff;border-radius:999px;padding:9px 13px;box-shadow:0 12px 32px rgba(162,28,175,.24);
        font-weight:850;font-size:12.5px;cursor:pointer
      }
      .auro-guia-launcher.is-visible{display:flex}
      .auro-guia-dot{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.18)}
      @keyframes auroGuiaEntrada{from{opacity:0;transform:translateY(-7px) scale(.985)}to{opacity:1;transform:none}}
      @media(max-width:700px){
        #${HOST_ID}{top:auto;right:10px;bottom:12px;width:min(360px,calc(100vw - 20px))}
        .auro-guia-card{border-radius:16px}
        .auro-guia-top{padding:12px}
        .auro-guia-body{padding:11px 12px 12px}
      }
      @media(prefers-reduced-motion:reduce){.auro-guia-card{animation:none}}
    `;
    document.head.appendChild(s);
  }

  function host(){
    inyectarEstilos();
    let h=document.getElementById(HOST_ID);
    if(!h){
      h=document.createElement('div');
      h.id=HOST_ID;
      h.setAttribute('aria-live','polite');
      document.body.appendChild(h);
    }
    return h;
  }

  function crearNodo(id){
    const card=document.createElement('section');
    card.className='auro-guia-card';
    card.dataset.auroGuiaId=id;
    card.setAttribute('aria-label','Asistente AUROSANAX');

    const top=document.createElement('div'); top.className='auro-guia-top';
    const icon=document.createElement('div'); icon.className='auro-guia-icon'; icon.textContent='A';
    const copy=document.createElement('div'); copy.className='auro-guia-copy';
    const brand=document.createElement('div'); brand.className='auro-guia-brand'; brand.textContent='Asistente AUROSANAX';
    const title=document.createElement('h3'); title.className='auro-guia-title';
    const close=document.createElement('button'); close.type='button'; close.className='auro-guia-close'; close.setAttribute('aria-label','Ocultar asistente'); close.textContent='×';
    copy.append(brand,title); top.append(icon,copy,close);

    const body=document.createElement('div'); body.className='auro-guia-body';
    const summary=document.createElement('p'); summary.className='auro-guia-summary';
    const next=document.createElement('div'); next.className='auro-guia-next';
    const detail=document.createElement('div'); detail.className='auro-guia-detail';
    const actions=document.createElement('div'); actions.className='auro-guia-actions';
    const toggle=document.createElement('button'); toggle.type='button'; toggle.className='auro-guia-btn'; toggle.setAttribute('aria-expanded','false');
    actions.append(toggle); body.append(summary,next,detail,actions);
    card.append(top,body);

    const launcher=document.createElement('button');
    launcher.type='button';
    launcher.className='auro-guia-launcher';
    launcher.innerHTML='<span class="auro-guia-dot" aria-hidden="true"></span><span>Asistente AUROSANAX</span>';
    launcher.setAttribute('aria-label','Mostrar Asistente AUROSANAX');

    return {card,title,summary,next,detail,actions,toggle,close,launcher};
  }

  function ocultarOtros(id){
    mounts.forEach(function(r,k){
      if(k!==id){
        r.nodes.card.style.display='none';
        r.nodes.launcher.classList.remove('is-visible');
      }
    });
  }

  function pintar(r){
    const c=r.config,n=r.nodes;
    n.card.dataset.tipo=c.tipo;
    n.title.textContent=c.titulo;
    n.summary.textContent=c.resumen; n.summary.hidden=!c.resumen;
    n.next.textContent=c.siguiente?'Siguiente paso: '+c.siguiente:''; n.next.hidden=!c.siguiente;
    n.detail.textContent=c.detalle; n.detail.hidden=!c.detalle || !r.expandida;
    n.toggle.textContent=r.expandida?c.etiquetaCerrar:c.etiquetaAbrir;
    n.toggle.setAttribute('aria-expanded',r.expandida?'true':'false');
    n.toggle.hidden=!c.expandible || !c.detalle;
    n.actions.hidden=n.toggle.hidden;

    if(r.oculta){
      n.card.style.display='none';
      n.launcher.classList.add('is-visible');
    }else{
      n.card.style.display='';
      n.launcher.classList.remove('is-visible');
    }
  }

  function montar(id,_contenedor,config){
    const clave=texto(id,'');
    if(!clave) return null;
    const h=host();
    ocultarOtros(clave);
    activo=clave;

    let r=mounts.get(clave);
    if(!r){
      const nodes=crearNodo(clave);
      r={id:clave,nodes,config:normalizar(config),expandida:false,oculta:false};
      nodes.toggle.addEventListener('click',function(){r.expandida=!r.expandida;pintar(r);});
      nodes.close.addEventListener('click',function(){r.oculta=true;pintar(r);});
      nodes.launcher.addEventListener('click',function(){ocultarOtros(clave);activo=clave;r.oculta=false;pintar(r);});
      h.append(nodes.card,nodes.launcher);
      mounts.set(clave,r);
    }else{
      r.config=normalizar(config);
      r.expandida=r.config.expandida;
      r.oculta=false;
    }
    pintar(r);
    return r.nodes.card;
  }

  function actualizar(id,config){
    const r=mounts.get(texto(id,''));
    if(!r) return false;
    ocultarOtros(r.id); activo=r.id;
    r.config=normalizar(Object.assign({},r.config,config||{}));
    r.oculta=false;pintar(r);return true;
  }

  function mostrar(id){
    const r=mounts.get(texto(id,''));
    if(!r)return false;
    ocultarOtros(r.id);activo=r.id;r.oculta=false;pintar(r);return true;
  }

  function ocultar(id){
    const r=mounts.get(texto(id,''));
    if(!r)return false;
    r.oculta=true;pintar(r);return true;
  }

  function desmontar(id){
    const clave=texto(id,''),r=mounts.get(clave);
    if(!r)return false;
    r.nodes.card.remove();r.nodes.launcher.remove();mounts.delete(clave);
    if(activo===clave) activo='';
    return true;
  }

  function recibirContexto(evento){
    try{
      const d=evento&&evento.detail&&typeof evento.detail==='object'?evento.detail:{};
      const id=texto(d.id,'');
      if(!id)return;
      montar(id,null,d.config||{});
    }catch(error){
      console.warn('AUROSANAX GUÍA: contexto ignorado de forma segura.',error);
    }
  }

  function recibirPacienteConfirmado(evento){
    try{
      const d=evento&&evento.detail&&typeof evento.detail==='object'?evento.detail:{};
      if(!texto(d.id_paciente,''))return;

      const esEdicion=String(d.operacion||'')==='edicion';
      const desdeAgenda=String(d.origen||'')==='agenda';

      montar('pacientes',null,{
        tipo:'ok',
        titulo:esEdicion?'Paciente actualizado':'Paciente registrado',
        resumen:esEdicion
          ?'Los cambios fueron confirmados en la base de datos clínica AUROSANAX.'
          :'El nuevo paciente fue confirmado correctamente en la base de datos clínica AUROSANAX.',
        siguiente:desdeAgenda
          ?'Continúe el flujo de la cita desde Agenda.'
          :'Abra la historia clínica del paciente para continuar.',
        detalle:'Este asistente orienta el flujo de trabajo. No crea historias clínicas, no inicia atenciones y no modifica información médica.',
        expandible:true,
        ocultable:true
      });
    }catch(error){
      console.warn('AUROSANAX GUÍA: no se pudo mostrar la orientación de Pacientes.',error);
    }
  }

  window.addEventListener('aurosanax:guia-contexto',recibirContexto);
  window.addEventListener('aurosanax:paciente-confirmado',recibirPacienteConfirmado);

  window.AurosanaxGuia=Object.freeze({
    __auroGuiaMotor:true,
    version:VERSION,
    montar,actualizar,mostrar,ocultar,desmontar
  });

})(window,document);
