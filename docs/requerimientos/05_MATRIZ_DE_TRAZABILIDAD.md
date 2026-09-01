# Matriz de trazabilidad de fuentes a requerimientos

## Propósito

Esta matriz permite comprobar qué elementos funcionales se sustentan en cada
fuente. Los identificadores de fuente se definen en
[`00_FUENTES_Y_HALLAZGOS.md`](00_FUENTES_Y_HALLAZGOS.md).

## Matriz principal

| Fuente | Evidencia funcional | Requerimientos relacionados | Flujos E2E | Casos de uso |
|---|---|---|---|---|
| SRC-CAP-01 | Inventario visual y ubicación de la carpeta de fuentes | Ninguno adicional | Ninguno | Ninguno |
| SRC-REU-01 | Uso interno, roles, clientes, papelería, procesos, alumnos, búsqueda, seguimiento, reportes, trazabilidad y depuración | RF-AUT, RF-USR, RF-CLI-01 a 05, RF-TIP, RF-PRO, RF-ALU-01 a 07, RF-BUS, RF-ACT, RF-REP, RF-AUD, RF-DEP, RF-ARC | E2E-01 a E2E-16 | CU-01 a CU-30 |
| SRC-DOC-01 | Ficha del alumno, requisitos, datos académicos/laborales y asignación de práctica | RF-ALU-01 a 03, RF-ALU-08 a 11 | E2E-04, E2E-14 | CU-10, CU-27 a CU-29 |
| SRC-DOC-02 | Ficha de recepción del cliente y declaración jurada de ingresos | RF-CLI-01, RF-CLI-06, RF-CLI-07 | E2E-02 | CU-04, CU-26 |
| SRC-DOC-03 | Solicitud de secretaría ad honorem, expediente, resolución, carné, jornada y período | RF-USR-02, RF-ALU-08 a 11 | E2E-04, E2E-14 | CU-27 a CU-29 |
| SRC-DOC-04 | Solicitud de práctica civil, formación de expediente, supervisión hasta sentencia firme y carné | RF-ALU-08 a 11, RF-PRO-10 | E2E-04, E2E-05 | CU-24, CU-27, CU-28 |
| SRC-IMG-01 | Fijación de pensión; guarda y custodia; documentos recientes y datos de contraparte | RF-TIP-01 a 04, RF-PRO-02 | E2E-03, E2E-15 | CU-07, CU-08 |
| SRC-IMG-02 | Aumento/disminución de pensión; paternidad/filiación; sentencia previa y capacidad para ADN | RF-TIP-01 a 04, RF-PRO-02 | E2E-03, E2E-15 | CU-07, CU-08 |
| SRC-IMG-03 | Confirmación adicional de requisitos de aumento/disminución de pensión | RF-TIP-02, RF-TIP-04 | E2E-03, E2E-15 | CU-07, CU-08 |
| SRC-IMG-04 | Cobro de pensiones atrasadas y estado de cuenta por período | RF-TIP-01 a 04, RF-PRO-02 | E2E-03, E2E-15 | CU-07, CU-08 |
| SRC-IMG-05 | Catálogo parcial de siete procesos | RF-TIP-01 | E2E-03 | CU-07, CU-08 |
| SRC-IMG-06 | Divorcio por causal; documentos de cónyuges, hijos, bienes, ingresos y separación | RF-TIP-01 a 04, RF-PRO-02 | E2E-03, E2E-15 | CU-07, CU-08 |
| SRC-IMG-07 | Requisitos de inscripción del alumno | RF-ALU-02, RF-ALU-08, RF-ALU-09 | E2E-04, E2E-14 | CU-10, CU-27 |

## Trazabilidad de hallazgos críticos

| Hallazgo | Fuente | Tratamiento en requerimientos |
|---|---|---|
| El cliente no es un usuario con acceso | SRC-REU-01 | RF-AUT-01, RF-CLI-01 y RN-01 |
| “Usuario” en las fichas significa persona atendida | SRC-DOC-02 | Se normaliza a `cliente`; se conserva como nota terminológica |
| Secretaría ad honorem puede ser un estudiante | SRC-DOC-03 | RN-13, E2E-14 y CU-29 separan modalidad académica de rol de acceso |
| El alta del cliente incluye evaluación/declaración de ingresos | SRC-DOC-02 | RF-CLI-06, RF-CLI-07, E2E-02 y CU-26 |
| La inscripción del alumno requiere trámite y resolución | SRC-DOC-03, SRC-DOC-04 | RF-ALU-08 a 11, E2E-04, CU-27 y CU-28 |
| Las certificaciones pueden vencer a los seis meses | SRC-IMG-01, 02, 03, 04 y 06 | RF-TIP-04, RN-15 y E2E-15 |
| Existen requisitos que son datos o condiciones, no archivos | SRC-IMG-02, 04 y 06 | RF-TIP-04 y E2E-03 |
| Se necesita registrar datos de la contraparte | SRC-DOC-02 y fotografías de procesos | RF-CLI-06 y E2E-02/E2E-03 |
| Recibo de agua aparece tachado | SRC-IMG-01, 02 y 04 | No se configura como obligatorio; se mantiene DP-21 |
| Solo hay siete tipos identificados de aproximadamente 25 | SRC-REU-01 y SRC-IMG-05 | El catálogo se declara parcial; no se inventan los restantes |

## Reglas de mantenimiento

Cuando se reciba una fuente nueva:

1. asignarle un identificador estable;
2. registrar archivo, fecha y procedencia;
3. transcribir campos, reglas y correcciones visibles;
4. comparar con fuentes anteriores;
5. actualizar requerimientos, flujos y casos de uso afectados;
6. registrar contradicciones como decisión pendiente;
7. agregar la relación a esta matriz.
