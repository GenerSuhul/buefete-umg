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
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar cliente" }), { target: { value: "Ana" } });
    await waitFor(() => expect(load).toHaveBeenLastCalledWith("Ana"));
    fireEvent.click(screen.getByRole("combobox", { name: "Cliente" }));
    fireEvent.click(await screen.findByRole("option", { name: "Ana López · 2026-002" }));
    expect(onChange).toHaveBeenCalledWith("2");
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
