import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import App from './test/RouterHarness';
import { FeedbackProvider } from './components/ui/Feedback';
import { AuthProvider } from './context/AuthContext';

const Providers = ({ children }: { children: ReactNode }) => <FeedbackProvider><AuthProvider>{children}</AuthProvider></FeedbackProvider>;

describe('Bufete Jurídico UMG', () => {
  it('muestra el resumen institucional usando el origen mock', async () => {
    render(<MemoryRouter><Providers><App /></Providers></MemoryRouter>);
    expect(await screen.findByText(/Hola/i)).toBeInTheDocument();
    expect(await screen.findByText('Expedientes activos')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Universidad Mariano Gálvez' })).toHaveAttribute('src', '/umg.png');
    expect(screen.getAllByRole('link', { name: 'Expedientes: Procesos y seguimiento' })).toHaveLength(1);
  });

  it('permite desplegar módulos desde una única navegación lateral', async () => {
    render(<MemoryRouter><Providers><App /></Providers></MemoryRouter>);
    const legalGroup = await screen.findByRole('button', { name: /Gestión jurídica/i });
    expect(legalGroup).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(legalGroup);
    expect(legalGroup).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir navegación' }));
    expect(document.querySelector('.app-sidebar')).toHaveClass('app-sidebar--open');
  });

  it('abre un expediente y muestra su último paso trazable', async () => {
    render(<MemoryRouter initialEntries={['/expedientes/30000000-0000-0000-0000-000000000001']}><Providers><App /></Providers></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Ana Lucía Morales Pérez' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preparación del expediente' })).toBeInTheDocument();
    expect(await screen.findByText('Memorial devuelto con observaciones')).toBeInTheDocument();
  });

  it('expone el flujo de digitalización en documentos', async () => {
    render(<MemoryRouter initialEntries={['/documentos']}><Providers><App /></Providers></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Adjuntar documento' }));
    fireEvent.click(await screen.findByRole('button', { name: /Escanear documento/i }));
    expect(await screen.findByRole('dialog', { name: 'Digitalizar documento' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Documento y destino/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Escáner y calidad/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar PDF o imágenes/i })).toBeInTheDocument();
  });
});
