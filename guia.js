/*
======================================================================
AUROSANAX — guia.js
MOTOR DE GUÍA CONTEXTUAL / ASISTENTE AUROSANAX
Versión 1.1.0 · motor visual + contrato central de eventos
======================================================================

CONTRATO ANTIRREGRESIVO
- Presentación y capacitación únicamente.
- NO guarda datos clínicos.
- NO crea pacientes, historias, citas ni atenciones.
- NO modifica id_paciente, id_historia, id_cita ni id_atencion.
- NO realiza fetch, POST, consultas a Sheets ni llamadas de persistencia.
- NO firma, NO finaliza atenciones, NO dispara botones propietarios.
- NO reemplaza la lógica de Agenda, Pacientes, Historia, Atenciones o módulos clínicos.
- Si este archivo falla o no carga, el ERP debe continuar funcionando.
- Las ayudas ocupan espacio propio: no usan position:fixed ni superposición.
- Diseñado para ser liviano, responsive y utilizable por toque, mouse y teclado.
- Los módulos informan HECHOS ya confirmados; la guía solo los traduce a orientación.
======================================================================
*/
(function auroGuiaBootstrap(window, document){
  'use strict';

  if(!window || !document) return;
  if(window.AurosanaxGuia && window.AurosanaxGuia.__auroGuiaMotor === true) return;

  const VERSION = '1.1.0';
  const ROOT_CLASS = 'auro-guia';
  const STYLE_ID = 'auroGuiaStyles';
  const mounts = new Map();

  function texto(valor, fallback){
    const t = String(valor == null ? '' : valor).trim();
    return t || String(fallback || '').trim();
  }

  function tipo(valor){
    const t = String(valor || 'info').trim().toLowerCase();
    return ['info','ok','warning','neutral'].includes(t) ? t : 'info';
  }

  function normalizar(config){
    const c = config && typeof config === 'object' ? config : {};
    return {
      tipo: tipo(c.tipo),
      titulo: texto(c.titulo, 'Asistente AUROSANAX'),
      resumen: texto(c.resumen, ''),
      detalle: texto(c.detalle, ''),
      siguiente: texto(c.siguiente, ''),
      expandible: c.expandible !== false,
      expandida: c.expandida === true,
      ocultable: c.ocultable !== false,
      etiquetaAbrir: texto(c.etiquetaAbrir, 'Ver guía'),
      etiquetaCerrar: texto(c.etiquetaCerrar, 'Ocultar guía')
    };
  }

  function inyectarEstilos(){
    if(document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${ROOT_CLASS}{
        --auro-guia-bg:#fff;--auro-guia-border:rgba(15,23,42,.12);
        --auro-guia-text:#172033;--auro-guia-muted:#5f6b7a;
        --auro-guia-accent:#a21caf;--auro-guia-accent-soft:rgba(162,28,175,.08);
        --auro-guia-ok:#16794b;--auro-guia-warning:#9a6700;
        box-sizing:border-box;width:100%;min-width:0;margin:.65rem 0;
        padding:.78rem .85rem;border:1px solid var(--auro-guia-border);
        border-radius:14px;background:var(--auro-guia-bg);color:var(--auro-guia-text);
        font:inherit;line-height:1.35;position:relative;overflow-wrap:anywhere;
        word-break:normal;contain:layout style;
      }
      .${ROOT_CLASS},.${ROOT_CLASS} *{box-sizing:border-box}
      .${ROOT_CLASS}[hidden]{display:none!important}
      .${ROOT_CLASS}__head{display:flex;align-items:flex-start;justify-content:space-between;gap:.65rem;min-width:0}
      .${ROOT_CLASS}__copy{min-width:0;flex:1 1 auto}
      .${ROOT_CLASS}__eyebrow{display:flex;align-items:center;gap:.4rem;margin:0 0 .18rem;font-size:.78rem;font-weight:700;color:var(--auro-guia-muted)}
      .${ROOT_CLASS}__dot{width:.5rem;height:.5rem;border-radius:999px;flex:0 0 auto;background:var(--auro-guia-accent)}
      .${ROOT_CLASS}[data-tipo="ok"] .${ROOT_CLASS}__dot{background:var(--auro-guia-ok)}
      .${ROOT_CLASS}[data-tipo="warning"] .${ROOT_CLASS}__dot{background:var(--auro-guia-warning)}
      .${ROOT_CLASS}[data-tipo="neutral"] .${ROOT_CLASS}__dot{background:var(--auro-guia-muted)}
      .${ROOT_CLASS}__title{margin:0;font-size:.96rem;font-weight:750;line-height:1.25}
      .${ROOT_CLASS}__summary{margin:.22rem 0 0;color:var(--auro-guia-muted);font-size:.9rem}
      .${ROOT_CLASS}__next{margin:.55rem 0 0;padding:.5rem .62rem;border-radius:10px;background:var(--auro-guia-accent-soft);font-size:.88rem;font-weight:650}
      .${ROOT_CLASS}__detail{margin:.6rem 0 0;padding-top:.6rem;border-top:1px solid var(--auro-guia-border);color:var(--auro-guia-muted);font-size:.88rem}
      .${ROOT_CLASS}__actions{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;margin-top:.58rem}
      .${ROOT_CLASS}__button{appearance:none;border:1px solid var(--auro-guia-border);background:#fff;color:var(--auro-guia-text);min-height:38px;padding:.42rem .68rem;border-radius:9px;font:inherit;font-size:.84rem;font-weight:650;cursor:pointer;touch-action:manipulation}
      .${ROOT_CLASS}__button:focus-visible{outline:3px solid rgba(162,28,175,.2);outline-offset:2px}
      .${ROOT_CLASS}__button--quiet{color:var(--auro-guia-muted)}
      @media(max-width:480px){
        .${ROOT_CLASS}{margin:.55rem 0;padding:.72rem;border-radius:12px}
        .${ROOT_CLASS}__head{gap:.45rem}
        .${ROOT_CLASS}__title{font-size:.94rem}
        .${ROOT_CLASS}__summary,.${ROOT_CLASS}__detail,.${ROOT_CLASS}__next{font-size:.87rem}
        .${ROOT_CLASS}__actions{display:grid;grid-template-columns:minmax(0,1fr)}
        .${ROOT_CLASS}__button{width:100%;min-height:44px;text-align:center}
      }
      @media(prefers-reduced-motion:reduce){
        .${ROOT_CLASS},.${ROOT_CLASS} *{scroll-behavior:auto!important;transition:none!important;animation:none!important}
      }`;
    document.head.appendChild(style);
  }

  function crearNodo(id){
    const root=document.createElement('section');
    root.className=ROOT_CLASS;
    root.dataset.auroGuiaId=id;
    root.setAttribute('aria-label','Asistente AUROSANAX');

    const head=document.createElement('div'); head.className=`${ROOT_CLASS}__head`;
    const copy=document.createElement('div'); copy.className=`${ROOT_CLASS}__copy`;
    const eyebrow=document.createElement('div'); eyebrow.className=`${ROOT_CLASS}__eyebrow`;
    const dot=document.createElement('span'); dot.className=`${ROOT_CLASS}__dot`; dot.setAttribute('aria-hidden','true');
    const brand=document.createElement('span'); brand.textContent='Asistente AUROSANAX';
    eyebrow.append(dot,brand);

    const title=document.createElement('h3'); title.className=`${ROOT_CLASS}__title`;
    const summary=document.createElement('p'); summary.className=`${ROOT_CLASS}__summary`;
    const next=document.createElement('div'); next.className=`${ROOT_CLASS}__next`;
    const detail=document.createElement('div'); detail.className=`${ROOT_CLASS}__detail`;
    const actions=document.createElement('div'); actions.className=`${ROOT_CLASS}__actions`;
    const toggle=document.createElement('button'); toggle.type='button'; toggle.className=`${ROOT_CLASS}__button`; toggle.setAttribute('aria-expanded','false');
    const hide=document.createElement('button'); hide.type='button'; hide.className=`${ROOT_CLASS}__button ${ROOT_CLASS}__button--quiet`; hide.textContent='Ocultar';

    actions.append(toggle,hide);
    copy.append(eyebrow,title,summary,next,detail,actions);
    head.append(copy); root.append(head);
    return {root,title,summary,next,detail,actions,toggle,hide};
  }

  function resolverContenedor(contenedor){
    if(typeof contenedor==='string'){
      try{return document.querySelector(contenedor);}catch(_e){return null;}
    }
    return contenedor && contenedor.nodeType===1 ? contenedor : null;
  }

  function pintar(r){
    const c=r.config,n=r.nodes;
    n.root.dataset.tipo=c.tipo;
    n.title.textContent=c.titulo;
    n.summary.textContent=c.resumen; n.summary.hidden=!c.resumen;
    n.next.textContent=c.siguiente ? `Siguiente paso: ${c.siguiente}` : ''; n.next.hidden=!c.siguiente;
    n.detail.textContent=c.detalle; n.detail.hidden=!c.detalle || !r.expandida;
    n.toggle.textContent=r.expandida ? c.etiquetaCerrar : c.etiquetaAbrir;
    n.toggle.setAttribute('aria-expanded',r.expandida?'true':'false');
    n.toggle.hidden=!c.expandible || !c.detalle;
    n.hide.hidden=!c.ocultable;
    n.actions.hidden=n.toggle.hidden && n.hide.hidden;
    n.root.hidden=r.oculta===true;
  }

  function montar(id,contenedor,config){
    const clave=texto(id,'');
    const destino=resolverContenedor(contenedor);
    if(!clave || !destino) return null;
    inyectarEstilos();

    let r=mounts.get(clave);
    if(r && r.nodes.root && r.nodes.root.isConnected){
      if(r.nodes.root.parentElement!==destino) destino.appendChild(r.nodes.root);
      r.config=normalizar(config); r.expandida=r.config.expandida; r.oculta=false; pintar(r);
      return r.nodes.root;
    }

    const nodes=crearNodo(clave);
    r={id:clave,nodes,config:normalizar(config),expandida:false,oculta:false};
    r.expandida=r.config.expandida;
    nodes.toggle.addEventListener('click',function(){r.expandida=!r.expandida;pintar(r);});
    nodes.hide.addEventListener('click',function(){r.oculta=true;pintar(r);});
    destino.appendChild(nodes.root); mounts.set(clave,r); pintar(r);
    return nodes.root;
  }

  function actualizar(id,config){
    const r=mounts.get(texto(id,''));
    if(!r) return false;
    r.config=normalizar(Object.assign({},r.config,config||{}));
    r.oculta=false; pintar(r); return true;
  }

  function mostrar(id){const r=mounts.get(texto(id,''));if(!r)return false;r.oculta=false;pintar(r);return true;}
  function ocultar(id){const r=mounts.get(texto(id,''));if(!r)return false;r.oculta=true;pintar(r);return true;}
  function desmontar(id){
    const clave=texto(id,''),r=mounts.get(clave);
    if(!r)return false;
    if(r.nodes.root&&r.nodes.root.parentNode)r.nodes.root.parentNode.removeChild(r.nodes.root);
    mounts.delete(clave);return true;
  }

  /*
   * CONTRATO CENTRAL PARA TODO EL ERP.
   * Cualquier módulo puede informar un hecho ya confirmado mediante
   * aurosanax:guia-contexto. La guía solo pinta; nunca ejecuta la acción.
   */
  function recibirContexto(evento){
    try{
      const d=evento && evento.detail && typeof evento.detail==='object' ? evento.detail : {};
      const id=texto(d.id,'');
      const contenedor=d.contenedor;
      if(!id || !contenedor) return;
      montar(id,contenedor,d.config||{});
    }catch(error){
      console.warn('AUROSANAX GUÍA: contexto ignorado de forma segura.',error);
    }
  }

  /*
   * PRIMER CONECTOR: PACIENTES.
   * Solo responde a la confirmación post-relectura emitida por pacientes.js.
   */
  function recibirPacienteConfirmado(evento){
    try{
      const d=evento && evento.detail && typeof evento.detail==='object' ? evento.detail : {};
      const idPaciente=texto(d.id_paciente,'');
      if(!idPaciente) return;

      const pantalla=document.getElementById('pacientes');
      if(!pantalla) return;

      const esEdicion=String(d.operacion||'')==='edicion';
      const desdeAgenda=String(d.origen||'')==='agenda';

      montar('pacientes',pantalla,{
        tipo:'ok',
        titulo:esEdicion ? 'Paciente actualizado' : 'Paciente registrado',
        resumen:esEdicion
          ? 'Los datos del paciente fueron confirmados en la fuente del ERP.'
          : 'El paciente fue confirmado en la fuente del ERP.',
        siguiente:desdeAgenda
          ? 'Regrese a Agenda y continúe con el flujo de la cita.'
          : 'Abra la historia clínica del paciente para continuar.',
        detalle:'La guía es informativa: no crea Historia Clínica, no inicia Atención y no modifica datos clínicos.',
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
    montar,
    actualizar,
    mostrar,
    ocultar,
    desmontar
  });

})(window,document);
