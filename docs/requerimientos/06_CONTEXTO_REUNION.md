# Contexto maestro de requerimientos — Bufete Jurídico UMG

> **Documento vigente de referencia.** Este archivo y los documentos dentro de
> `docs/requerimientos/` contienen la interpretación funcional de la reunión con
> el cliente. El ERD elaborado anteriormente queda fuera de alcance y **no debe
> utilizarse como fuente de requerimientos ni como restricción de diseño**.

## Objetivo del proyecto

Construir una aplicación de gestión **exclusivamente interna** para la clínica
jurídica universitaria, orientada a centralizar clientes, papelería, procesos
judiciales, alumnos asignados, seguimiento cronológico, actividad de las
secretarías, reportes y trazabilidad.

## Límites que deben mantenerse claros

- Los clientes atendidos **no tienen acceso** al sistema.
- Los actores internos identificados son administrador general, secretarías y
  alumnos. Los alumnos sí tendrán acceso directo con permisos básicos; los roles
  y permisos podrán ampliarse o retirarse posteriormente.
- El cliente definirá posteriormente logo, colores y diseño visual. aunque ya tenemos una UI que queremos usar en el sistema.
- La definición funcional no prescribe tablas. La arquitectura y tecnología
  vigentes se documentan por separado en `docs/arquitectura/`.
- Hosting, servidor, dominio, costos y renovación están excluidos de esta
  documentación funcional por indicación del equipo.
- Los aproximadamente 25 procesos son **tipos de proceso**, y cada uno tendrá su
  propia lista de requisitos documentales proporcionada por Lic. Estrada.

## Fuentes funcionales revisadas

Además de la transcripción de la reunión, se revisaron cuatro documentos Word y
siete fotografías entregadas por el cliente. Estas fuentes aportan formularios,
campos, modalidades de práctica, requisitos del alumno y un catálogo parcial de
procesos. El inventario y transcripción funcional se encuentra en
[Fuentes revisadas y hallazgos](docs/requerimientos/00_FUENTES_Y_HALLAZGOS.md).

Cuando una minuta o ficha agrega detalle operativo compatible con la reunión,
ese detalle forma parte de los requerimientos. Cuando dos fuentes se contradicen,
la contradicción se registra como decisión pendiente y no se resuelve por
suposición.

## Capacidades medulares confirmadas

1. Gestión de usuarios internos y permisos.
2. Registro de clientes y carga o escaneo de documentos por casillas etiquetadas.
3. Apertura de expedientes digitales por tipo de proceso.
4. Asignación de uno o varios casos a alumnos.
5. Registro cronológico de revisiones, memoriales, presentaciones,
   notificaciones y demás pasos del proceso.
6. Búsqueda por nombre de cliente o alumno.
7. Consulta del estado y del último paso de cada caso.
8. Perfil del alumno con papelería, casos asignados y estado de cada proceso.
9. Registro de actividades de las secretarías.
10. Reportes imprimibles y envío por correo mediante una acción explícita.
11. Trazabilidad completa de toda acción realizada en el sistema.
12. Recepción del cliente mediante ficha y declaración jurada de ingresos.
13. Inscripción del alumno mediante solicitud, expediente, resolución y emisión
    de carné.
14. Registro de modalidad, sede, jornada y horario de la práctica.
15. Depuración controlada de información al finalizar el período de conservación,
    cuyo alcance exacto debe confirmarse.

## Reglas de interpretación para trabajo futuro

- No diseñar ni implementar una función basándose únicamente en el ERD anterior.
- No asumir que “usuario” significa cliente. Usar siempre `cliente` para la
  persona atendida y `usuario interno` para quien inicia sesión.
- Se dispone de un catálogo parcial de siete tipos de proceso y requisitos para
  seis de ellos. No inventar los tipos o requisitos restantes hasta completar
  los aproximadamente 25 mencionados.
- Distinguir el rol de acceso `Secretaría` de la modalidad académica
  `secretaria/o ad honorem`; una persona puede ser alumno y recibir permisos
  operativos de secretaría durante su período.
- No asumir que el envío semanal es totalmente automático: en la reunión se
  describió revisión previa y un **botón para enviar correo**.
- No asumir que depurar significa borrar indiscriminadamente. La reunión pide
  eliminar documentos e historial después de aproximadamente un año, pero falta
  definir desde qué evento se cuenta, qué expediente se elimina, quién autoriza
  y qué rastro mínimo debe conservarse.

## Documentos funcionales vigentes

- [Fuentes revisadas y hallazgos](docs/requerimientos/00_FUENTES_Y_HALLAZGOS.md)
- [Requerimientos del sistema](docs/requerimientos/01_REQUERIMIENTOS_DEL_SISTEMA.md)
- [Flujos end-to-end](docs/requerimientos/02_FLUJOS_END_TO_END.md)
- [Casos de uso](docs/requerimientos/03_CASOS_DE_USO.md)
- [Decisiones pendientes y criterios para el prototipo](docs/requerimientos/04_DECISIONES_PENDIENTES.md)
- [Matriz de trazabilidad de fuentes](docs/requerimientos/05_MATRIZ_DE_TRAZABILIDAD.md)

## Acciones de proyecto registradas en la reunión

| Acción | Estado informado | Observación |
|---|---|---|
| Recibir listado de requisitos documentales por tipo de proceso | Parcialmente evidenciado | Hay siete tipos fotografiados y requisitos para seis; falta completar el catálogo aproximado de 25 |
| Crear grupo de comunicación | Completada según las notas compartidas | El canal específico no afecta los requisitos funcionales |
| Agendar reuniones virtuales periódicas | Pendiente | Usarlas para resolver decisiones abiertas y validar prototipos |
| Desarrollar prototipo antes del desarrollo completo | Pendiente | Debe cubrir los flujos prioritarios descritos en esta documentación |

> La tabla de costos fue marcada como realizada, pero se omite deliberadamente
> porque infraestructura y costos están fuera del alcance solicitado aquí.
