# Política de seguridad

## Reporte responsable

No publique vulnerabilidades, credenciales, DPI, expedientes ni documentos en
issues, pull requests o discusiones. Comuníquese de forma privada con el
responsable institucional o con el propietario del repositorio.

Incluya únicamente:

- componente y versión afectada;
- pasos mínimos para reproducir sin datos reales;
- impacto estimado;
- mitigación propuesta, si existe.

## Secretos

`.env`, archivos cargados, respaldos y credenciales están excluidos del control
de versiones. Si un secreto aparece en un commit, debe revocarse de inmediato;
eliminar el texto del historial no sustituye la rotación.

## Alcance de soporte

La rama `main` representa la versión mantenida. Las dependencias se revisan con
Dependabot y las auditorías NuGet/npm del pipeline. La publicación en producción
requiere HTTPS, secretos administrados, copias verificadas, logs centralizados y
controles institucionales de acceso y retención.
