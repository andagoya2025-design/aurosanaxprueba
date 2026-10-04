/*
======================================================================
AUROSANAX — guia.js
ASISTENTE CONTEXTUAL PREMIUM DEL ERP
Versión 1.3.1 · ajuste visual antirregresivo
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

  const VERSION='1.3.1';
  const STYLE_ID='auroGuiaStyles';
  const HOST_ID='auroGuiaFloatingHost';
  const mounts=new Map();
  let activo='';
  let posicionUsuario=null;

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

  function esMovil(){
    return window.matchMedia('(max-width:700px)').matches;
  }

  function inyectarEstilos(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      #${HOST_ID}{
        position:fixed;
        top:150px;
        right:18px;
        z-index:2147482000;
        width:min(340px,calc(100vw - 36px));
        pointer-events:none;
        font:inherit;
        max-height:calc(100vh - 168px);
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
        display:flex;align-items:flex-start;gap:9px;
        cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;
        padding:12px 12px 10px;
        background:linear-gradient(120deg,rgba(192,38,211,.13),rgba(236,72,153,.08));
      }
      .auro-guia-icon{
        width:32px;height:32px;flex:0 0 32px;border-radius:10px;
        display:grid;place-items:center;
        background:linear-gradient(135deg,#c026d3,#ec4899);
        color:#fff;font-weight:900;box-shadow:0 7px 18px rgba(192,38,211,.28);
      }
      .auro-guia-card[data-tipo="ok"] .auro-guia-icon{background:linear-gradient(135deg,#059669,#10b981)}
      .auro-guia-copy{min-width:0;flex:1}
      .auro-guia-brand{font-size:10.5px;font-weight:900;letter-spacing:.055em;text-transform:uppercase;color:#9d174d}
      .auro-guia-title{margin:2px 0 0;font-size:15px;font-weight:850;line-height:1.2;color:#3b174f}
      .auro-guia-close{
        pointer-events:auto;appearance:none;border:0;background:rgba(255,255,255,.82);
        color:#6b7280;width:30px;height:30px;border-radius:9px;cursor:pointer;
        font-size:19px;line-height:1;display:grid;place-items:center;
      }
      .auro-guia-close:hover{background:#fff;color:#831843}
      .auro-guia-top:active{cursor:grabbing}
      .auro-guia-body{padding:11px 12px 12px}
      .auro-guia-summary{margin:0;color:#4b5563;font-size:13px;line-height:1.42}
      .auro-guia-next{
        margin:9px 0 0;padding:9px 10px;border-radius:11px;
        background:linear-gradient(135deg,rgba(217,70,239,.12),rgba(236,72,153,.09));
        color:#701a75;font-size:13px;font-weight:800;line-height:1.34
      }
      .auro-guia-detail{
        margin:9px 0 0;padding-top:9px;border-top:1px solid rgba(148,163,184,.22);
        color:#64748b;font-size:12.25px;line-height:1.42
      }
      .auro-guia-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}
      .auro-guia-btn{
        appearance:none;border:1px solid rgba(192,38,211,.24);background:#fff;color:#86198f;
        min-height:34px;padding:6px 10px;border-radius:10px;font:inherit;font-size:12px;
        font-weight:800;cursor:pointer
      }
      .auro-guia-btn:hover{background:#fdf4ff}
      .auro-guia-launcher{
        pointer-events:auto;margin-left:auto;display:none;align-items:center;gap:6px;
        border:1px solid rgba(217,70,239,.38);background:linear-gradient(135deg,#c026d3,#ec4899);
        color:#fff;border-radius:999px;padding:7px 10px;box-shadow:0 10px 26px rgba(162,28,175,.22);
        font-weight:850;font-size:11.5px;cursor:pointer;white-space:nowrap
      }
      .auro-guia-launcher.is-visible{display:flex}
      .auro-guia-dot{width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.18)}
      @keyframes auroGuiaEntrada{from{opacity:0;transform:translateY(-7px) scale(.985)}to{opacity:1;transform:none}}
      @media(max-width:700px){
        #${HOST_ID}{
          top:calc(env(safe-area-inset-top,0px) + 74px);
          right:10px;
          bottom:auto;
          width:min(360px,calc(100vw - 20px));
          max-height:calc(100vh - 96px)
        }
        .auro-guia-card{border-radius:16px}
        .auro-guia-top{padding:12px}
        .auro-guia-body{padding:11px 12px 12px}
        .auro-guia-launcher{padding:8px 11px;font-size:12px}
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

  function posicionPredeterminada(h){
    h.style.left='auto';
    h.style.bottom='auto';
    h.style.right=esMovil()?'10px':'18px';
    h.style.top=esMovil()
      ?'calc(env(safe-area-inset-top,0px) + 74px)'
      :'150px';
    posicionUsuario=null;
  }

  function limitarPosicion(h,left,top){
    const margen=8;
    const r=h.getBoundingClientRect();
    const ancho=r.width||Math.min(esMovil()?360:340,window.innerWidth-20);
    const alto=Math.min(r.height||80,window.innerHeight-(margen*2));
    return {
      left:Math.max(margen,Math.min(left,window.innerWidth-ancho-margen)),
      top:Math.max(margen,Math.min(top,window.innerHeight-alto-margen))
    };
  }

  function aplicarPosicionUsuario(){
    const h=document.getElementById(HOST_ID);
    if(!h || !posicionUsuario)return;
    const p=limitarPosicion(h,posicionUsuario.left,posicionUsuario.top);
    h.style.right='auto';h.style.bottom='auto';
    h.style.left=p.left+'px';h.style.top=p.top+'px';
    posicionUsuario=p;
  }

  function activarArrastre(r){
    const asa=r.nodes.card.querySelector('.auro-guia-top');
    if(!asa || asa.dataset.auroDrag==='1')return;
    asa.dataset.auroDrag='1';
    let drag=null;

    asa.addEventListener('pointerdown',function(e){
      if(e.button!=null && e.button!==0)return;
      if(e.target && e.target.closest && e.target.closest('button'))return;
      const h=host(), rect=h.getBoundingClientRect();
      drag={id:e.pointerId,dx:e.clientX-rect.left,dy:e.clientY-rect.top};
      try{asa.setPointerCapture(e.pointerId);}catch(_e){}
      e.preventDefault();
    });
    asa.addEventListener('pointermove',function(e){
      if(!drag || drag.id!==e.pointerId)return;
      const h=host();
      const p=limitarPosicion(h,e.clientX-drag.dx,e.clientY-drag.dy);
      h.style.right='auto';h.style.bottom='auto';
      h.style.left=p.left+'px';h.style.top=p.top+'px';
      posicionUsuario=p;
      e.preventDefault();
    });
    function terminar(e){
      if(!drag || (e.pointerId!=null && drag.id!==e.pointerId))return;
      drag=null;
    }
    asa.addEventListener('pointerup',terminar);
    asa.addEventListener('pointercancel',terminar);
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
      activarArrastre(r);
      nodes.toggle.addEventListener('click',function(){r.expandida=!r.expandida;pintar(r);});
      nodes.close.addEventListener('click',function(){r.oculta=true;posicionPredeterminada(h);pintar(r);});
      nodes.launcher.addEventListener('click',function(){ocultarOtros(clave);activo=clave;r.oculta=false;posicionPredeterminada(h);pintar(r);});
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
    r.oculta=true;posicionPredeterminada(host());pintar(r);return true;
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
        expandida:false,
        ocultable:true
      });
    }catch(error){
      console.warn('AUROSANAX GUÍA: no se pudo mostrar la orientación de Pacientes.',error);
    }
  }

  window.addEventListener('resize',function(){
    if(posicionUsuario) aplicarPosicionUsuario();
  });

  window.addEventListener('aurosanax:guia-contexto',recibirContexto);
  window.addEventListener('aurosanax:paciente-confirmado',recibirPacienteConfirmado);

  function asegurarAsistenteDisponible(){
    if(mounts.size)return;
    montar('inicio',null,{
      tipo:'neutral',
      titulo:'Asistente AUROSANAX',
      resumen:'El asistente está disponible para orientarle durante el uso del ERP.',
      siguiente:'Seleccione el módulo en el que desea trabajar.',
      detalle:'La guía es únicamente visual y de orientación. No guarda, crea, firma, finaliza ni modifica información clínica.',
      expandible:true,
      expandida:false,
      ocultable:true
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',asegurarAsistenteDisponible,{once:true});
  }else{
    setTimeout(asegurarAsistenteDisponible,0);
  }

  window.AurosanaxGuia=Object.freeze({
    __auroGuiaMotor:true,
    version:VERSION,
    montar,actualizar,mostrar,ocultar,desmontar
  });

})(window,document);
