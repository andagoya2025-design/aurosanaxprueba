/****************************************************************
 AUROSANAX ERP DEMO
 Archivo: apoyoIA.js
 Versión inicial: 1.0.0
****************************************************************/
(function(){
'use strict';
const AURO_IA={
version:'1.0.0',
obtenerEspecialidad(){return document.getElementById('hcEspecialidad')?.value||'Ginecología';},
obtenerResumen(){return window.auroDiagnosticosState?.resumenClinico||window.auroDiagnosticosState?.analisisClinico||'';},
construirPrompt(){
return `Eres un especialista en ${this.obtenerEspecialidad()}.
Analiza el caso clínico.
1. Revisa coherencia clínica.
2. Detecta datos faltantes.
3. Sugiere diagnósticos diferenciales.
4. Verifica consistencia CIE-10.
5. Formula preguntas clínicas.
No propongas tratamiento definitivo.

${this.obtenerResumen()}`;},
copiar(){navigator.clipboard.writeText(this.construirPrompt());alert('Prompt copiado');},
abrirChatGPT(){this.copiar();window.open('https://chat.openai.com','_blank');},
abrirGemini(){this.copiar();window.open('https://gemini.google.com','_blank');},
abrirCopilot(){this.copiar();window.open('https://copilot.microsoft.com','_blank');}
};
window.auroApoyoIA=AURO_IA;
})();
