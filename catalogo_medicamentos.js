AUROSANAX ERP
AUDITORÍA ANTIRREGRESIVA DESPUÉS DE ACTUALIZAR catalogo_medicamentos.js
Fecha: 2026-09-04
Modo: SOLO LECTURA
NO SE MODIFICÓ NINGÚN ARCHIVO

======================================================================
RESULTADO DE LA AUDITORÍA
======================================================================

El archivo catalogo_medicamentos.js YA quedó limpio como JavaScript.

SHA actual:
46f8f37371cf9ea13e26506645a9245d9236ebae

Ya no tiene el problema anterior de texto explicativo mezclado con código.

PERO antes de conectarlo a index.html encontré un riesgo antirregresivo importante.

======================================================================
RIESGO DETECTADO
======================================================================

plan.js actualmente tiene su propia base estable de 15 medicamentos.

La define así:

window.MEDICAMENTOS_AUROSANAX_BASE =
    window.MEDICAMENTOS_AUROSANAX_BASE || [ ...base actual... ];

Esto significa:

Si catalogo_medicamentos.js se carga ANTES de plan.js,
Plan NO cargará su base interna antigua porque la variable ya existiría.

Por lo tanto, el catálogo nuevo pasaría a reemplazar completamente esa base interna.

======================================================================
POR QUÉ NO DEBEMOS CONECTARLO TODAVÍA
======================================================================

El catálogo nuevo tiene varios medicamentos que ya existían en Plan,
pero en algunos casos tiene vacíos los valores que Plan sí tenía definidos.

Ejemplos actuales:

Metronidazol en Plan:
- presentación: 500 mg tableta
- vía: VO
- frecuencia: cada 12 horas
- duración: 7 días
- indicación: Tomar después de alimentos

Metronidazol en catálogo nuevo:
- presentación: 500 mg tableta
- vía: VO
- frecuencia: VACÍA
- duración: VACÍA
- indicación: VACÍA

Ibuprofeno en Plan:
- presentación: 400 mg tableta
- vía: VO
- frecuencia: cada 8 horas
- duración: 3 a 5 días
- indicación: Tomar después de alimentos

Ibuprofeno en catálogo nuevo:
- presentación: tableta
- vía: VO
- frecuencia: VACÍA
- duración: VACÍA
- indicación: VACÍA

Paracetamol en Plan:
- presentación: 500 mg tableta
- frecuencia: cada 8 horas
- duración: 3 a 5 días
- indicación: Si dolor o fiebre

Paracetamol en catálogo nuevo:
- presentación: tableta
- frecuencia: VACÍA
- duración: VACÍA
- indicación: VACÍA

También ocurre con:
- Ketorolaco
- Amoxicilina + ácido clavulánico
- Cefalexina
- Mupirocina
- Ácido fusídico
- Hidrocortisona
- Fenazopiridina
- Probióticos
y otros registros de la base estable.

Si conectáramos ahora el catálogo, perderíamos esos valores prellenados del comportamiento actual.

Eso sería una REGRESIÓN.

======================================================================
DECISIÓN ANTIRREGRESIVA
======================================================================

NO tocar index.html todavía.

NO tocar plan.js todavía.

El siguiente archivo que debemos modificar sigue siendo únicamente:

catalogo_medicamentos.js

======================================================================
SIGUIENTE PASO EXACTO
======================================================================

Crear una VERSIÓN 1.0.1 del catálogo con esta regla:

1. Los 15 medicamentos que ya existen en plan.js deben conservar EXACTAMENTE
   sus datos actuales de:
   - cat
   - med
   - pres
   - via
   - frec
   - dur
   - ind

2. Sobre esos mismos medicamentos podemos añadir SOLO metadatos nuevos:
   - principio_activo
   - denominaciones_comerciales
   - nombres_alternativos
   - forma_farmaceutica
   - concentracion

3. Los medicamentos nuevos que no existían antes sí pueden añadirse,
   pero sin inventar frecuencia, duración ni indicaciones universales.

4. No deben existir variantes ambiguas del mismo genérico que puedan hacer
   que un protocolo genérico seleccione arbitrariamente una presentación.

5. Después de corregir el catálogo:
   - validar sintaxis
   - comparar los 15 medicamentos originales uno por uno
   - confirmar que no se perdió ningún comportamiento previo

6. SOLO entonces auditar y modificar index.html con una única línea de carga.

======================================================================
ARCHIVO QUE NO TOCAMOS
======================================================================

plan.js actual:
SHA 8c7f3c901459dbd3522f7c8e421c4130db881636

Se mantiene intacto.

index.html actual:
SHA auditado previamente:
8fe226fbbfc2e813cf8f2332e875bbf832b7e054

Se mantiene intacto.

======================================================================
CONCLUSIÓN
======================================================================

El catálogo ya está limpio, pero todavía NO está listo para conectarlo.

El siguiente paso correcto es una última corrección antirregresiva de:

catalogo_medicamentos.js

para que conserve exactamente la base estable que hoy usa plan.js y, encima de ella,
agregue los medicamentos nuevos.

Después de eso recién tocamos index.html.

NO debemos modificar plan.js en esta fase.

======================================================================
ESTADO
======================================================================

AUDITORÍA COMPLETADA.
NO SE MODIFICÓ NINGÚN ARCHIVO.
NO SE HIZO NINGÚN COMMIT.
