import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { InfoItem, Pagination, RelationLookup } from './Shared';

describe("controles de directorio", () => {
  it("navega entre páginas mediante acciones reales", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={4} totalCount={73} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it("busca relaciones en el servidor y conserva la selección", async () => {
    const load = vi.fn(async (search: string) => search
      ? [{ value: "2", label: "Ana López · 2026-002" }]
      : [{ value: "1", label: "Mario Pérez · 2026-001" }]);
    const onChange = vi.fn();
    render(<RelationLookup label="Cliente" value="" onChange={onChange} load={load} />);
    fireEvent.focus(screen.getByRole("combobox", { name: "Cliente" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Cliente" }), { target: { value: "Ana" } });
    await waitFor(() => expect(load).toHaveBeenLastCalledWith("Ana"));
    fireEvent.click(await screen.findByRole("option", { name: "Ana López · 2026-002" }));
    expect(onChange).toHaveBeenCalledWith("2");
  });
});

describe('Búsqueda accesible de relaciones', () => {
  it('selecciona mediante teclado y Escape cierra sólo los resultados', async () => {
    const onChange = vi.fn();
    render(<RelationLookup label="Usuario" value="" onChange={onChange} load={async () => [{ value: 'a', label: 'Ana · DPI 1234 56789 0123' }]} />);
    const input = screen.getByRole('combobox', { name: 'Usuario' });
    fireEvent.focus(input);
    await screen.findByRole('option', { name: /Ana/ });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('a');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(input); fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
  it('permite reintentar una consulta fallida', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{ value: 'b', label: 'Beatriz' }]);
    render(<RelationLookup label="Usuario" value="" onChange={vi.fn()} load={load} />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Usuario' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('option', { name: 'Beatriz' })).toBeInTheDocument();
  });
});

describe('Información de la ficha', () => {
  it('conserva cero como dato registrado', () => {
    render(<InfoItem label="Cantidad de hijos" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('No registrado')).not.toBeInTheDocument();
  });
  it('identifica un dato ausente', () => {
    render(<InfoItem label="Escolaridad" value={null} />);
    expect(screen.getByText('No registrado')).toBeInTheDocument();
  });
});
