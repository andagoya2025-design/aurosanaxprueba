/****************************************************************
AUROSANAX ERP
plan.js - FASE 4 INTERCONSULTAS
****************************************************************/

window.interconsultasPlanSeleccionadas =
Array.isArray(window.interconsultasPlanSeleccionadas)
? window.interconsultasPlanSeleccionadas : [];

function agregarInterconsultaPlan(){
 const especialidad=(auroPlanGetValue('hcInterconsultaEspecialidad')||'').trim();
 if(!especialidad){ alert('Seleccione una especialidad.'); return; }

 window.interconsultasPlanSeleccionadas.push({
   especialidad,
   motivo: auroPlanGetValue('hcInterconsultaMotivo'),
   prioridad: auroPlanGetValue('hcInterconsultaPrioridad') || 'Normal'
 });

 limpiarFormularioInterconsulta();
 renderInterconsultasTabla();
 recopilarInterconsultaPlan();
 guardarPlanTemporal();
}

function eliminarInterconsultaPlan(index){
 index=Number(index);
 if(Number.isNaN(index)) return;

 window.interconsultasPlanSeleccionadas.splice(index,1);

 renderInterconsultasTabla();
 recopilarInterconsultaPlan();
 guardarPlanTemporal();
}

function limpiarFormularioInterconsulta(){
 auroPlanSetValue('hcInterconsultaEspecialidad','');
 auroPlanSetValue('hcInterconsultaMotivo','');
 auroPlanSetValue('hcInterconsultaPrioridad','Normal');
}

function renderInterconsultasTabla(){

 const tbody=document.getElementById('hcInterconsultasTableBody');
 if(!tbody) return;

 const lista=window.interconsultasPlanSeleccionadas || [];

 if(!lista.length){
   tbody.innerHTML='<tr><td colspan="4" class="text-center text-muted py-3">Sin interconsultas registradas</td></tr>';
   return;
 }

 tbody.innerHTML=lista.map((it,i)=>`
 <tr>
   <td>${it.especialidad||''}</td>
   <td>${it.motivo||''}</td>
   <td>${it.prioridad||''}</td>
   <td><button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarInterconsultaPlan(${i})">Eliminar</button></td>
 </tr>`).join('');
}

function recopilarInterconsultaPlan(){

 const texto=(window.interconsultasPlanSeleccionadas||[])
 .map((it,i)=>`${i+1}. ${it.especialidad} - ${it.motivo} - Prioridad: ${it.prioridad}`)
 .join('\n');

 auroPlanSetValue('hcInterconsultaResumen',texto);

 return texto;
}

function limpiarInterconsultaPlan(){
 window.interconsultasPlanSeleccionadas=[];
 renderInterconsultasTabla();
 recopilarInterconsultaPlan();
 guardarPlanTemporal();
}

/*
Agregar en guardarPlanTemporal():

interconsultas: JSON.parse(JSON.stringify(
window.interconsultasPlanSeleccionadas || []
)),

Agregar en cargarPlanTemporal():

window.interconsultasPlanSeleccionadas =
JSON.parse(JSON.stringify(data.interconsultas || []));
renderInterconsultasTabla();

Agregar en limpiarPlanTemporal():

window.interconsultasPlanSeleccionadas = [];
*/
