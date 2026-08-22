# Memoria técnica vigente

## Estado

**Vigente desde:** 14 de agosto de 2026.  
**Alcance:** decisiones de plataforma para iniciar el backend.  
**Regla:** los requerimientos funcionales prevalecen sobre esta memoria. Si una
decisión técnica impide cumplir un flujo confirmado, debe revisarse la decisión
técnica, no deformarse el requerimiento.

## Decisiones adoptadas

### DT-01. Plataforma

- ASP.NET Core 10 Web API con controladores.
- SDK fijado en `10.0.302` mediante `global.json`.
- C# 14, tipos anulables y advertencias tratadas como errores.
- OpenAPI de primera parte mediante `Microsoft.AspNetCore.OpenApi`.
- `Microsoft.OpenApi` fijado explícitamente en 2.11.0 para evitar la versión
  transitiva 2.0.0 afectada por una vulnerabilidad alta.

### DT-02. Persistencia

- PostgreSQL 18.6 para desarrollo local.
- Entity Framework Core 10.0.10.
- Npgsql Entity Framework Core 10.0.3.
- Las migraciones serán la única forma versionada de cambiar el esquema.
- No se crearán tablas de negocio a partir del ERD retirado.

### DT-03. Arquitectura

Se adopta una arquitectura por capas inspirada en el ensayo de Biblioteca, pero
reforzada para producción:

- `Domain`: conceptos, invariantes y eventos del negocio;
- `Application`: casos de uso, autorización requerida y contratos;
- `Infrastructure`: EF Core, PostgreSQL, archivos, correo y servicios externos;
- `Api`: autenticación HTTP, controladores, serialización y middleware;
- pruebas unitarias e integración en proyectos separados.

Los controladores no contendrán reglas de negocio ni consultas EF Core directas.

### DT-04. Base de datos local

PostgreSQL se ejecuta mediante Docker Compose con:

- imagen oficial fijada en `postgres:18.6-alpine3.24`;
- puerto `127.0.0.1:55432`, evitando el puerto predeterminado local;
- volumen `bufete_juridico_postgres_data`;
- red `bufete_juridico_backend`;
- health check con `pg_isready`;
- secreto leído desde `.env`, excluido de Git.

No se incorporará pgAdmin inicialmente; Docker Desktop y herramientas de línea
de comandos son suficientes y reducen superficie operativa.

### DT-05. Configuración y secretos

- `.env` se usa únicamente para el contenedor local y no se versiona.
- ASP.NET Core obtiene la cadena de conexión desde User Secrets en desarrollo o
  variables/secretos del entorno en despliegue.
- La aplicación falla al iniciar si falta una configuración obligatoria.
- Nunca se guardarán claves reales en `appsettings*.json`.

### DT-06. Observabilidad mínima

- respuestas de error con `ProblemDetails`;
- identificador de trazabilidad en errores;
- health check de proceso separado del de PostgreSQL;
- logging estructurado provisto inicialmente por ASP.NET Core;
- OpenAPI disponible únicamente en desarrollo.

### DT-07. Frontend

El frontend será React. Todavía no se seleccionan librerías de componentes,
formularios, estado o validación visual. El backend no dependerá de esas
decisiones y expondrá contratos HTTP explícitos.

### DT-08. Primer módulo funcional

El primer módulo será identidad, roles y permisos dinámicos porque:

- el sistema es exclusivamente interno;
- toda acción debe atribuirse a una persona autenticada;
- administrador, secretarías y alumnos tienen capacidades distintas;
- los permisos básicos deben poder agregarse o retirarse posteriormente;
- una persona puede ser alumno y recibir temporalmente permisos de secretaría
  ad honorem.

### DT-09. Versionado HTTP

- La API usa versionado explícito en URL: `/api/v{version}/...`.
- La versión inicial es `1.0` y se consume como `/api/v1/...`.
- Se usa `Asp.Versioning.Mvc` 10.0.0, compatible con .NET 10.
- Las versiones futuras convivirán durante una ventana de migración; no se
  romperá silenciosamente un contrato publicado.

### DT-10. Archivos

- PostgreSQL conserva metadatos y relaciones, no los binarios.
- Desarrollo utiliza almacenamiento local fuera de `wwwroot`.
- La abstracción de almacenamiento permite sustituirlo por almacenamiento de
  objetos en producción sin cambiar los casos de uso.
- Cada archivo registra SHA-256, tamaño, tipo MIME, origen y versiones.

## Decisiones deliberadamente aplazadas

- entidades de clientes, procesos y documentos;
- proveedor de almacenamiento de archivos;
- estrategia de escáner;
- proveedor de correo;
- librerías del frontend;
- política definitiva de depuración;
- permisos exactos del alumno;
- catálogo completo de tipos de proceso.

Estas decisiones requieren completar la validación funcional; no deben inferirse
del ERD retirado.

## Puertas de calidad

Antes de integrar cada módulo se exigirá:

1. relación explícita con requerimientos y casos de uso;
2. migración revisable cuando cambie persistencia;
3. pruebas unitarias para reglas;
4. pruebas de integración para HTTP y PostgreSQL;
5. ausencia de secretos en el repositorio;
6. compilación sin advertencias;
7. trazabilidad y autorización consideradas desde el diseño.
