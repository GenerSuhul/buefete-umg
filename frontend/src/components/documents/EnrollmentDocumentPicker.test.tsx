import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import * as scanner from '../../data/scannerAgent';
import { EnrollmentDocumentPicker } from './EnrollmentDocumentPicker';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('captura documental previa al alta', () => {
  it('permite recuperarse cuando el agente físico no está disponible', async () => {
    vi.spyOn(scanner, 'getScannerAgentHealth').mockRejectedValue(new Error('offline'));
    const change = vi.fn();
    render(<EnrollmentDocumentPicker label="DPI" file={null} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Escanear DPI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('seleccione un PDF');
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reintentar conexión' })).toBeEnabled();
  });
  it('sólo entrega la captura al aceptar explícitamente la vista previa', async () => {
    vi.spyOn(scanner, 'getScannerAgentHealth').mockResolvedValue({ ready: true, provider: 'NAPS2', version: 'test', license: 'test', drivers: ['WIA'] });
    vi.spyOn(scanner, 'listScannerDevices').mockResolvedValue([{ id: 'test', name: 'Escáner prueba', driver: 'WIA', nativeId: 'test' }]);
    const pdf = new File(['%PDF-1.4'], 'captura.pdf', { type: 'application/pdf' });
    vi.spyOn(scanner, 'acquireFromScanner').mockResolvedValue(pdf);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() });
    const change = vi.fn();
    render(<EnrollmentDocumentPicker label="DPI" file={null} onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'Escanear DPI' }));
    const capture = await screen.findByRole('button', { name: 'Capturar documento' });
    fireEvent.click(capture);
    const accept = await screen.findByRole('button', { name: 'Aceptar documento escaneado' });
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(accept);
    expect(change).toHaveBeenCalledWith(pdf, 'Scanner');
  });
});
