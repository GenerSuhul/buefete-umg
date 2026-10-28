import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
it('crea un requisito con los valores del contrato nativo y conserva los errores específicos', async () => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false'); vi.resetModules();
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: 'One or more validation errors occurred.', errors: { Code: ['The Code field is required.'] } }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  const { dataSource } = await import('./dataSource');
  await expect(dataSource.createRequirement({ scope: 'Process', processTypeId: 'process', code: '', label: 'DPI', kind: 'Document', documentNature: 'Original', isRequired: true, isConditional: false, conditionDescription: null, maximumAgeDays: null, subject: null, instructions: null, sortOrder: 1, isActive: true })).rejects.toThrow('Código: revise el valor ingresado.');
  expect(JSON.parse(fetcher.mock.calls[0][1].body).scope).toBe('Process');
});
