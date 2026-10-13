import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ClientRestrictionDialog } from './ClientRestrictionDialog';
import { clientRestrictions } from '../../data/clientRestrictions';
vi.mock('../../data/clientRestrictions', () => ({ clientRestrictions: { create: vi.fn() } }));

describe('Confirmación de veto permanente', () => {
  beforeEach(() => vi.clearAllMocks());
  function complete() {
    fireEvent.change(screen.getByLabelText('Repita el DPI para confirmar'), { target: { value: '1234567890123' } });
    fireEvent.change(screen.getByLabelText('Motivo institucional'), { target: { value: 'Motivo institucional documentado' } });
    fireEvent.click(screen.getByRole('checkbox'));
  }
  it('exige DPI repetido, motivo y aceptación explícita', async () => {
    vi.mocked(clientRestrictions.create).mockResolvedValue({ id: 'qa' } as never);
    const saved = vi.fn();
    render(<ClientRestrictionDialog dpi="1234 56789 0123" onClose={vi.fn()} onSaved={saved} />);
    const button = screen.getByRole('button', { name: 'Confirmar veto permanente' }); expect(button).toBeDisabled();
    complete(); expect(button).toBeEnabled(); fireEvent.click(button);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(clientRestrictions.create).toHaveBeenCalledWith('1234 56789 0123', '1234 56789 0123', 'Motivo institucional documentado');
  });
  it('conserva datos y permite reintentar un error del servidor', async () => {
    vi.mocked(clientRestrictions.create).mockRejectedValue(new Error('Registro central no disponible'));
    const saved = vi.fn();
    render(<ClientRestrictionDialog dpi="1234 56789 0123" onClose={vi.fn()} onSaved={saved} />);
    complete(); fireEvent.click(screen.getByRole('button', { name: 'Confirmar veto permanente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Registro central no disponible');
    expect(saved).not.toHaveBeenCalled(); expect(screen.getByLabelText('Motivo institucional')).toHaveValue('Motivo institucional documentado');
    expect(screen.getByRole('button', { name: 'Confirmar veto permanente' })).toBeEnabled();
  });
  it('un DPI diferente no habilita la confirmación', () => {
    render(<ClientRestrictionDialog dpi="1234 56789 0123" onClose={vi.fn()} onSaved={vi.fn()} />);
    complete(); fireEvent.change(screen.getByLabelText('Repita el DPI para confirmar'), { target: { value: '1234567890124' } });
    expect(screen.getByRole('button', { name: 'Confirmar veto permanente' })).toBeDisabled();
  });
});
