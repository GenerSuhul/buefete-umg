import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, vi } from 'vitest';
import { dataSource } from '../../data/dataSource';
import { AppDatePicker, Avatar, calculateDatePopoverPosition, DateRangePickerField, DocumentLink, Select, TimePickerField } from './index';

function ControlledTime() {
  const [value, setValue] = useState('');
  return <TimePickerField label="Hora de inicio" value={value} onChange={setValue} />;
}

function ControlledSelect() {
  const [value, setValue] = useState('pending');
  return <Select aria-label="Estado" value={value} onChange={(event) => setValue(event.target.value)}><option value="pending">Pendiente</option><option value="approved">Aprobado</option></Select>;
}

function ControlledImplicitSelect() {
  const [value, setValue] = useState('');
  return (
    <Select aria-label="Sexo" value={value} onChange={(event) => setValue(event.target.value)}>
      <option value="">Seleccionar</option>
      <option>Femenino</option>
      <option>Masculino</option>
      <option>Otro</option>
    </Select>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('controles de formulario', () => {
  it('actualiza el valor del selector visual', () => {
    render(<ControlledSelect />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    fireEvent.click(screen.getByRole('option', { name: 'Aprobado' }));
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveTextContent('Aprobado');
  });

  it('respeta el valor implícito de cada opción y marca solamente una', () => {
    render(<ControlledImplicitSelect />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Sexo' }));
    const options = screen.getAllByRole('option');
    expect(options.filter((option) => option.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    fireEvent.click(screen.getByRole('option', { name: 'Femenino' }));
    expect(screen.getByRole('combobox', { name: 'Sexo' })).toHaveTextContent('Femenino');
  });
  it('selecciona una hora sin usar el control nativo del navegador', () => {
    render(<ControlledTime />);
    const input = screen.getByRole('textbox', { name: 'Hora de inicio' });
    expect(input).not.toHaveAttribute('type', 'time');

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar hora de inicio' }));
    const dialog = screen.getByRole('dialog', { name: 'Seleccionar Hora de inicio' });
    fireEvent.click(within(dialog).getByRole('button', { name: '08' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '30' }));

    expect(input).toHaveValue('08:30');
    expect(screen.queryByRole('dialog', { name: 'Seleccionar Hora de inicio' })).not.toBeInTheDocument();
  });

  it('presenta el período en un solo selector de rango', () => {
    render(
      <DateRangePickerField
        label="Período de práctica"
        startValue="2026-08-01"
        endValue="2026-08-15"
        onChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /01 ago 2026.*15 ago 2026/i }));
    const dialog = screen.getByRole('dialog', { name: 'Seleccionar Período de práctica' });
    expect(dialog.querySelectorAll('.rdp-month')).toHaveLength(1);
  });

  it('mantiene el calendario alineado verticalmente y no invade la columna contigua', () => {
    const position = calculateDatePopoverPosition(
      { top: 460, right: 760, bottom: 520, left: 260, width: 500, height: 60 },
      { top: 100, right: 1300, bottom: 760, left: 240, width: 1060, height: 660 },
    );

    expect(position.left).toBe(260);
    expect(position.top).toBeGreaterThanOrEqual(112);
    expect(position.top).toBeLessThanOrEqual(358);
  });

  it.each([
    ['1945-01-15', '1945', '0', /15 de enero de 1945/],
    ['1968-08-21', '1968', '7', /21 de agosto de 1968/],
  ])('permite seleccionar la fecha histórica %s sin una lista anual desbordada', (expected, year, month, dayName) => {
    const onChange = vi.fn();
    render(<AppDatePicker label="Fecha de nacimiento" value="" preset="birthDate" max="2026-08-29" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendario de Fecha de nacimiento' }));
    const dialog = screen.getByRole('dialog', { name: 'Seleccionar Fecha de nacimiento' });
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Elegir el año' }));
    const yearOption = Array.from(screen.getByRole('listbox').querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.trim() === year);
    expect(yearOption).toBeDefined();
    fireEvent.click(yearOption!);
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Elegir el mes' }));
    const monthName = new Intl.DateTimeFormat('es-GT', { month: 'long' }).format(new Date(2026, Number(month), 1));
    const monthOption = Array.from(screen.getByRole('listbox').querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.trim().toLocaleLowerCase('es-GT') === monthName.toLocaleLowerCase('es-GT'));
    expect(monthOption).toBeDefined();
    fireEvent.click(monthOption!);
    fireEvent.click(within(dialog).getByRole('button', { name: dayName }));

    expect(onChange).toHaveBeenCalledWith(expected);
    expect(screen.queryByRole('dialog', { name: 'Seleccionar Fecha de nacimiento' })).not.toBeInTheDocument();
  });

  it('abre documentos PDF dentro del sistema y conserva la descarga', async () => {
    vi.spyOn(dataSource, 'getDocumentReadAccess').mockResolvedValue({
      fileName: 'requisito.pdf',
      contentType: 'application/pdf',
      url: 'https://objects.example.test/requisito.pdf',
      expiresAtUtc: '2026-08-29T12:00:00Z',
    });
    render(<DocumentLink documentId="document-1" label="Ver requisito" />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver requisito' }));
    expect(await screen.findByTitle('requisito.pdf')).toHaveAttribute('src', 'https://objects.example.test/requisito.pdf');
    expect(screen.getByRole('link', { name: /Descargar/i })).toHaveAttribute('href', 'https://objects.example.test/requisito.pdf');
  });

  it('deduplica solicitudes simultáneas de la misma fotografía', async () => {
    let complete!: (value: Awaited<ReturnType<typeof dataSource.getDocumentReadAccess>>) => void;
    const request = new Promise<Awaited<ReturnType<typeof dataSource.getDocumentReadAccess>>>((resolve) => {
      complete = resolve;
    });
    const access = vi.spyOn(dataSource, 'getDocumentReadAccess').mockReturnValue(request);

    const { container } = render(
      <>
        <Avatar name="Ana López" documentId="photo-1" />
        <Avatar name="Ana López" documentId="photo-1" />
      </>,
    );

    expect(access).toHaveBeenCalledTimes(1);
    complete({
      fileName: 'ana.webp',
      contentType: 'image/webp',
      url: 'https://objects.example.test/ana.webp',
      expiresAtUtc: '2026-08-29T12:00:00Z',
    });
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2));
  });
});
