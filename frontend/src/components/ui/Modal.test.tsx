import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { Modal } from './index';

function ControlledModal() {
  const [value, setValue] = useState('');
  return <Modal open title="Formulario" onClose={() => undefined}>
    <input aria-label="Nombre" value={value} onChange={(event) => setValue(event.target.value)} />
  </Modal>;
}

describe('Modal', () => {
  it('conserva el foco mientras el formulario controlado se vuelve a renderizar', async () => {
    render(<ControlledModal />);
    const input = screen.getByRole('textbox', { name: 'Nombre' });
    input.focus();
    fireEvent.change(input, { target: { value: 'Ana' } });

    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('Ana');
  });
});
