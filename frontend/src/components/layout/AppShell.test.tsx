import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppShell } from './AppShell';
import type { AuthenticatedUser } from '../../types/domain';
const state = vi.hoisted(() => ({ user: null as AuthenticatedUser | null, demo: false, workspaceAdmin: false }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: state.user, logout: vi.fn() }) }));
vi.mock('../../data/dataSource', () => ({ dataSource: { mode: 'api', getPlatformHealth: async () => ({ status: 'Healthy' }) } }));
vi.mock('../../demo/client', () => ({ get demoEnabled() { return state.demo; } }));
vi.mock('../../data/practiceNotices', () => ({ practiceNotices: { list: () => new Promise(() => {}), read: vi.fn(), sounded: vi.fn() } }));
vi.mock('../../demo/WorkspaceContext', async () => {
  const { useEffect } = await import('react');
  return { WorkspaceContext: ({ onPlatformAdmin }: { onPlatformAdmin: (value: boolean) => void }) => {
    useEffect(() => { onPlatformAdmin(state.workspaceAdmin); }, [onPlatformAdmin]);
    return null;
  } };
});
vi.mock('../ui/motion/motion', () => ({ motion: { routeEnter: () => ({ cancel: vi.fn() }) } }));
function open(platform: boolean, roles = ['Administrador'], permissions = ['*'], route = '/sedes') {
  state.user = { id: 'qa', username: 'qa', email: 'qa@example.test', fullName: 'QA', photoDocumentId: null, roles, permissions, tenantCode: 'peten', tenantName: 'Petén', isPlatformAdmin: platform };
  return render(<MemoryRouter initialEntries={[route]}><AppShell><p>Contenido</p></AppShell></MemoryRouter>);
}
describe('Navegación por ámbito y permisos', () => {
  beforeEach(() => { state.demo = false; state.workspaceAdmin = false; });
  it('publica los iconos Fluent, sedes y lista negra global en Vercel', () => {
    state.demo = true;
    state.workspaceAdmin = true;
    const { container } = open(false, ['AdministradorGeneral']);
    expect(container.querySelector('.admin-center')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Bufetes y sedes/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lista negra global/ })).toBeInTheDocument();
    expect(container.querySelector('a[href="/"] svg')?.getAttribute('class')).toContain('fui-Icon');
  });
  it('agrupa sedes y vetos globales, sin duplicarlos en la operación local', () => {
    const { container } = open(true);
    const global = container.querySelector('[data-module="platform"]')!;
    expect(within(global as HTMLElement).getByRole('link', { name: /Bufetes y sedes/ })).toBeInTheDocument();
    expect(within(global as HTMLElement).getByRole('link', { name: /Lista negra global/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Lista negra/ })).toHaveLength(1);
    expect(container.querySelector('[data-module="administration"] a[href="/vetos"]')).toBeNull();
    expect(screen.getByLabelText('Contexto de sede')).toHaveTextContent('Petén');
    expect(screen.getByRole('link', { name: /Bufetes y sedes/ })).toHaveAttribute('aria-current', 'page');
  });
  it('el administrador local ve vetos dentro de administración de sede y no ve sedes', () => {
    const { container } = open(false, ['Administrador'], ['*'], '/vetos');
    expect(container.querySelector('[data-module="platform"]')).toBeNull();
    expect(container.querySelector('[data-module="administration"] a[href="/vetos"]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Bufetes y sedes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Administración de sede' })).toBeInTheDocument();
  });
  it('secretaría no recibe controles globales ni emisión de vetos', () => {
    open(false, ['Secretaria'], ['clients.read', 'cases.read', 'documents.read', 'students.read', 'activities.read']);
    expect(screen.queryByRole('link', { name: /Lista negra|Bufetes y sedes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Usuarios atendidos/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Administración de sede' })).not.toBeInTheDocument();
  });
  it('oculta grupos vacíos para el alumno y permite plegar los grupos', () => {
    open(false, ['Alumno'], ['cases.assigned.read', 'students.self.read'], '/expedientes');
    expect(screen.queryByRole('button', { name: 'Control y trazabilidad' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Usuarios atendidos/ })).not.toBeInTheDocument();
    const group = screen.getByRole('button', { name: 'Práctica académica' }); fireEvent.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
  });
});
