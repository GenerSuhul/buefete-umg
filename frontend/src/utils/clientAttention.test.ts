import { describe, expect, it } from 'vitest';
import { clientAttention } from './clientAttention';

describe('Estado efectivo de atención', () => {
  it('prioriza lista negra aunque la atención guardada siga activa', () => {
    expect(clientAttention({ isActive: true, restriction: { isRestricted: true, reference: 'restriction', hasValidIdentity: false } }))
      .toEqual({ label: 'Lista negra', tone: 'danger' });
  });
  it('prioriza lista negra también en una ficha con atención finalizada', () => {
    expect(clientAttention({ isActive: false }, { isRestricted: true, reference: 'restriction' }).label).toBe('Lista negra');
  });
  it('no presenta una identidad inválida como atención vigente', () => {
    expect(clientAttention({ isActive: true }, { isRestricted: false, reference: null, hasValidIdentity: false }).label).toBe('Identidad pendiente');
  });
  it('mantiene los estados habituales sin restricción', () => {
    expect(clientAttention({ isActive: true }).label).toBe('Atención vigente');
    expect(clientAttention({ isActive: false }).label).toBe('Sin atención vigente');
  });
});
