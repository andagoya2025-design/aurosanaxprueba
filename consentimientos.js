/* =====================================================
   AUROSANAX ERP - MÓDULO DE CONSENTIMIENTOS
   Archivo: consentimientos.js
   Versión: 1.1
   Actualización: Consentimiento ginecológico profesional
===================================================== */

window.auroConsentimientos = {

    plantillas: {

        consultaGinecologica: `
            <div class="consentimiento-documento">

                <h2 style="text-align:center; margin-bottom:4px;">
                    CONSENTIMIENTO INFORMADO
                </h2>

                <h3 style="text-align:center; margin-top:0;">
                    CONSULTA GINECOLÓGICA
                </h3>

                <hr>

                <p>
                    Yo, <strong>{{PACIENTE}}</strong>,
                    con documento de identidad N.°
                    <strong>{{CEDULA}}</strong>,
                    manifiesto que he recibido información clara,
                    suficiente y comprensible sobre la atención médica
                    ginecológica que se realizará en el Centro Médico AUROSANAX.
                </p>

                <p>
                    Comprendo que la consulta podrá incluir, según criterio médico
                    y previa explicación, procedimientos propios de la especialidad,
                    tales como:
                </p>

                <ul>
                    <li>Anamnesis médica y revisión de antecedentes.</li>
                    <li>Examen físico general.</li>
                    <li>Examen ginecológico, cuando esté indicado.</li>
                    <li>Evaluación mamaria, cuando corresponda.</li>
                    <li>Solicitud, revisión e interpretación de exámenes complementarios.</li>
                    <li>Orientación diagnóstica, terapéutica y preventiva.</li>
                </ul>

                <p><strong>Declaro que:</strong></p>

                <ol>
                    <li>
                        He tenido la oportunidad de realizar preguntas, las cuales
                        han sido respondidas de forma satisfactoria.
                    </li>
                    <li>
                        Comprendo los objetivos, beneficios, limitaciones y posibles
                        molestias derivadas de la valoración médica.
                    </li>
                    <li>
                        Entiendo que puedo aceptar o rechazar procedimientos no urgentes
                        y retirar mi consentimiento antes de su realización.
                    </li>
                    <li>
                        Autorizo el registro de mi información clínica en la historia
                        clínica institucional, bajo estricta confidencialidad y conforme
                        a la normativa sanitaria vigente.
                    </li>
                    <li>
                        Reconozco que la práctica médica no garantiza resultados
                        específicos y que las decisiones diagnósticas y terapéuticas
                        se fundamentan en criterios científicos y clínicos.
                    </li>
                </ol>

                <p>
                    En forma libre, voluntaria y consciente, otorgo mi consentimiento
                    para la realización de la presente consulta médica.
                </p>

                <br><br>

                <table style="width:100%; margin-top:40px;">
                    <tr>
                        <td style="text-align:center; width:33%;">
                            ___________________________<br>
                            Firma del Paciente
                        </td>

                        <td style="text-align:center; width:33%;">
                            ___________________________<br>
                            Firma del Representante Legal<br>
                            <span style="font-size:12px;">Si aplica</span>
                        </td>

                        <td style="text-align:center; width:33%;">
                            ___________________________<br>
                            Médico Tratante<br>
                            Dra. Aurora Andagoya Murillo<br>
                            <span style="font-size:12px;">Ginecología y Obstetricia</span>
                        </td>
                    </tr>
                </table>

                <br><br>

                <p>
                    <strong>Fecha:</strong> {{FECHA}}
                </p>

            </div>
        `
    },

    generar(tipo, datos = {}) {

        let plantilla = this.plantillas[tipo];

        if (!plantilla) {
            console.error('Plantilla no encontrada');
            return '';
        }

        Object.keys(datos).forEach(key => {
            plantilla = plantilla.replaceAll(`{{${key}}}`, datos[key] || '');
        });

        return plantilla;
    }
};

/* PRUEBA EN CONSOLA
auroConsentimientos.generar('consultaGinecologica',{PACIENTE:'PACIENTE DEMO',CEDULA:'1234567890',FECHA:'26/06/2026'});
*/
