# Guía de contribución

## Flujo de trabajo

1. Actualice `main` y cree una rama con un nombre descriptivo:
   `feature/`, `fix/`, `docs/`, `refactor/` o `chore/`.
2. Confirme el requerimiento en `docs/requerimientos/` antes de modificar un
   flujo funcional.
3. Mantenga los cambios pequeños, coherentes y acompañados de pruebas
   proporcionales al riesgo.
4. Ejecute `./scripts/quality-gate.ps1` antes de publicar.
5. Abra un pull request utilizando la plantilla del repositorio.

## Criterios obligatorios

- Compilación sin errores ni advertencias.
- Pruebas unitarias, integración y frontend aprobadas.
- Sin secretos, documentos reales ni datos personales.
- Migraciones nuevas para cambios de esquema; nunca editar una migración ya
  aplicada en un ambiente compartido.
- API compatible hacia atrás durante despliegues graduales.
- Mensajes de interfaz breves, neutrales y orientados a la tarea.
- Trazabilidad conservada en todas las operaciones de negocio.

## Convención de commits

Use mensajes imperativos y específicos, por ejemplo:

```text
Agregar validación de requisitos del expediente
Corregir visualización multipágina de documentos
Documentar recuperación de PostgreSQL y objetos
```

## Revisión

Todo pull request debe explicar el problema, la solución, el impacto en datos o
seguridad y la evidencia de prueba. Los cambios en permisos, documentos,
retención o migraciones requieren revisión especialmente cuidadosa.
