import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Modal } from './index';
vi.mock('./motion/motion', () => ({ motion: { modalEnter: () => ({ finished: Promise.resolve(), cancel: vi.fn() }), modalExit: () => ({ finished: Promise.resolve(), cancel: vi.fn() }) } }));

describe('Enfoque inicial del modal', () => {
  afterEach(() => vi.restoreAllMocks());
  it('no roba el enfoque si el usuario ya entró a un campo', () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
    render(<Modal open title="Prueba" onClose={vi.fn()}><input aria-label="Buscar usuario" /></Modal>);
    const input = screen.getByRole('textbox', { name: 'Buscar usuario' }); input.focus();
    frame?.(0);
    expect(input).toHaveFocus();
  });
  it('sitúa el enfoque dentro del diálogo si aún está fuera', () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1; });
    render(<Modal open title="Prueba" onClose={vi.fn()}><input aria-label="Buscar usuario" /></Modal>);
    frame?.(0);
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });
});
