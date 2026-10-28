export interface ApiProblem {
  detail?: string;
  title?: string;
  errors?: Record<string, string[]>;
}

const fieldLabels: Record<string, string> = {
  code: 'Código', label: 'Etiqueta', name: 'Nombre', description: 'Descripción',
  kind: 'Tipo', documentnature: 'Naturaleza', maximumagedays: 'Vigencia máxima (días)',
  sortorder: 'Orden', conditiondescription: 'Condición', instructions: 'Instrucciones',
  email: 'Correo electrónico', password: 'Contraseña', fullname: 'Nombre completo',
  dpi: 'DPI', receptiondate: 'Fecha de recepción', birthdate: 'Fecha de nacimiento',
};

export function apiProblemMessage(problem: ApiProblem | null, status: number): string {
  if (problem?.errors && Object.keys(problem.errors).length) {
    const messages = Object.entries(problem.errors).flatMap(([key, errors]) => {
      const field = fieldLabels[key.replace(/^\$\./, '').split('.').pop()!.toLowerCase()];
      // Mensajes de negocio redactados en español se conservan; los del serializador no se exponen.
      return errors.map(message => {
        if (/json|could not|cannot|the .*field|is required|validation errors|byteposition|line number|path:|system\./i.test(message))
          return field ? `${field}: revise el valor ingresado.` : 'Revise los datos del formulario y vuelva a guardar.';
        return field ? `${field}: ${message}` : message;
      });
    });
    return [...new Set(messages)].join(' ') || 'Revise los datos del formulario y vuelva a guardar.';
  }
  const message = problem?.detail ?? problem?.title;
  if (message && !/one or more validation errors|bad request|internal server error|json|system\./i.test(message)) return message;
  if (status === 400 || status === 422) return 'Revise los datos del formulario y vuelva a guardar.';
  if (status === 401) return 'Su sesión terminó. Inicie sesión nuevamente.';
  if (status === 403) return 'No tiene permiso para realizar esta acción.';
  if (status >= 500) return 'No se pudo guardar en este momento. Inténtelo nuevamente.';
  return 'No se pudo completar la operación. Inténtelo nuevamente.';
}
