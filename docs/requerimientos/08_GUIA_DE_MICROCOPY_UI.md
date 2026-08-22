# Guía de microcopy para la interfaz

## Objetivo

La interfaz debe ayudar a completar tareas administrativas sin exponer detalles
de implementación ni adoptar un tono conversacional. Esta guía aplica a todo
texto visible: títulos, descripciones, ayudas, estados vacíos, errores,
confirmaciones, botones y notificaciones.

## Principios obligatorios

1. Indicar la acción o el estado principal primero.
2. Usar palabras conocidas por el personal del bufete.
3. Omitir explicaciones evidentes, redundantes o que no cambien una decisión.
4. Usar verbos específicos en botones: `Guardar`, `Crear`, `Enviar`, `Cerrar`.
5. Mantener una sola idea por mensaje.
6. Explicar cómo continuar cuando una acción falla.
7. Evitar culpar a la persona usuaria.
8. Usar mayúscula inicial de oración, salvo siglas y nombres propios.

## Contenido que no debe aparecer

- Infraestructura: backend, frontend, API, PostgreSQL, MinIO o nombres de SDK.
- Implementación: persistencia, endpoints, auditoría automática, versionado
  interno o identificadores técnicos, salvo en la pantalla administrativa de
  auditoría donde sean el contenido consultado.
- Frases defensivas: “el sistema no inventará”, “permisos controlados por el
  backend” o explicaciones de cómo fue programada la función.
- Conversación innecesaria: “podrá”, “queremos”, “recuerde”, “nosotros” o
  párrafos que hablen como un asistente.

## Patrones aprobados

| Contexto | Patrón |
| --- | --- |
| Formulario | `Complete los datos requeridos.` |
| Ayuda de campo | `También se utilizará para iniciar sesión.` |
| Estado vacío | `No hay documentos registrados.` |
| Éxito | `Documento guardado.` |
| Error recuperable | `No se pudo guardar. Inténtelo nuevamente.` |
| Restricción | `Disponible para reportes revisados.` |
| Confirmación | `Revise la información antes de crear el expediente.` |

## Control de regresiones

La prueba `frontend/src/uxCopy.test.ts` bloquea frases técnicas o narrativas ya
identificadas. Toda nueva pantalla debe revisarse con esta guía antes de darse
por terminada.

## Referencias

- Microsoft Writing Style para aplicaciones: texto claro, breve, familiar y
  centrado en la acción.
- Apple Human Interface Guidelines, Writing: claridad, consistencia, lenguaje
  sencillo y pronombres posesivos solo cuando aporten contexto.
