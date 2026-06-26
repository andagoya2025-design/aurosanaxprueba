/* =====================================================
   AUROSANAX ERP - MÓDULO DE CONSENTIMIENTOS
   Archivo: consentimientos.js
   Versión: 1.0
===================================================== */

window.auroConsentimientos = {

    plantillas: {

        consultaGinecologica: `
            <div class="consentimiento-documento">

                <h2 style="text-align:center;">
                    CONSENTIMIENTO INFORMADO
                </h2>

                <h3 style="text-align:center;">
                    CONSULTA GINECOLÓGICA
                </h3>

                <hr>

                <p>
                    Yo, <strong>{{PACIENTE}}</strong>,
                    con documento de identidad N.°
                    <strong>{{CEDULA}}</strong>,
                    declaro haber recibido información clara,
                    suficiente y comprensible sobre la consulta
                    ginecológica que se realizará.
                </p>

                <p>Comprendo que durante la atención médica podrán efectuarse procedimientos propios de la especialidad.</p>

                <ul>
                    <li>Anamnesis médica.</li>
                    <li>Examen físico general.</li>
                    <li>Examen ginecológico.</li>
                    <li>Evaluación mamaria.</li>
                    <li>Solicitud de exámenes complementarios.</li>
                    <li>Orientación diagnóstica y terapéutica.</li>
                </ul>

                <p>Otorgo mi consentimiento libre y voluntario para la realización de la presente consulta.</p>

                <br><br><br>

                <table style="width:100%;">
                    <tr>
                        <td style="text-align:center; width:50%;">
                            ___________________________<br>Firma del Paciente
                        </td>

                        <td style="text-align:center; width:50%;">
                            ___________________________<br>Médico Tratante
                        </td>
                    </tr>
                </table>

                <br><br>

                <p>Fecha: <strong>{{FECHA}}</strong></p>

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
