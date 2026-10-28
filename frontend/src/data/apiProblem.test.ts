import { expect, it } from 'vitest';
import { apiProblemMessage } from './apiProblem';

it('explica los errores por campo sin mostrar mensajes del serializador', () => {
  const message = apiProblemMessage({ title: 'One or more validation errors occurred.', errors: { '$.maximumAgeDays': ['The JSON value could not be converted to System.Int32. Path: $.maximumAgeDays.'], Code: ['The Code field is required.'] } }, 400);
  expect(message).toContain('Vigencia máxima (días): revise el valor ingresado.');
  expect(message).toContain('Código: revise el valor ingresado.');
  expect(message).not.toMatch(/JSON|System|validation errors|Path:/);
});
it('conserva la explicación de negocio en español', () => {
  expect(apiProblemMessage({ detail: 'Ya existe un requisito con el mismo código en este catálogo.' }, 409)).toContain('mismo código');
});
it('traduce el error genérico sin inventar un campo culpable', () => {
  expect(apiProblemMessage({ title: 'One or more validation errors occurred.' }, 400)).toBe('Revise los datos del formulario y vuelva a guardar.');
});
