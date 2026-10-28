import { describe, expect, it } from 'vitest';
import { emptyState, normalizeInstitutionalProfile, rootId } from './model';

describe('Perfil institucional persistido', () => {
  it('corrige sólo el nombre predeterminado, conserva datos y registra el cambio una sola vez', () => {
    const state = emptyState('admin@example.test', 'Licenciado Demo');
    state.passwords[rootId] = 'password-hash';
    const userBefore = { ...state.users[0] };
    expect(normalizeInstitutionalProfile(state)).toBe(true);
    expect(state.users[0]).toEqual({ ...userBefore, fullName: 'Administrador de plataforma' });
    expect(state.passwords[rootId]).toBe('password-hash');
    expect(state.audit[0].entityId).toBe(rootId);
    expect(normalizeInstitutionalProfile(state)).toBe(false);
    expect(state.audit).toHaveLength(1);
  });
  it('preserva nombres personalizados y usa el nuevo nombre para futuras sedes', () => {
    const state = emptyState('admin@example.test', 'Gener Suhul');
    expect(normalizeInstitutionalProfile(state)).toBe(false);
    expect(state.users[0].fullName).toBe('Gener Suhul');
    expect(emptyState('admin@example.test').users[0].fullName).toBe('Administrador de plataforma');
  });
});
