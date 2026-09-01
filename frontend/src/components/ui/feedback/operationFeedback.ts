import { feedbackBus, humanizeOperationError, type FeedbackMessage } from "./feedbackBus";

export const OPERATION_FEEDBACK_HANDLED: unique symbol = Symbol("operation-feedback-handled");

export function feedbackHandled<T extends object>(input: T): T {
  Object.defineProperty(input, OPERATION_FEEDBACK_HANDLED, { value: true });
  return input;
}

export function isOperationFeedbackHandled(args: unknown[]) {
  return args.some((argument) => Boolean(argument && typeof argument === "object" && (argument as { [OPERATION_FEEDBACK_HANDLED]?: boolean })[OPERATION_FEEDBACK_HANDLED]));
}

type Copy = Omit<FeedbackMessage, "tone" | "id">;
interface OperationCopy {
  loading: Copy;
  success: Copy | ((result: unknown, args: unknown[]) => Copy);
  error: Copy;
}

const value = (source: unknown, key: string) => {
  if (!source || typeof source !== "object") return "";
  const result = (source as Record<string, unknown>)[key];
  return typeof result === "string" ? result : "";
};
const input = (args: unknown[]) => args.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
const named = (result: unknown, args: unknown[], fallback: string) => value(result, "fullName") || value(result, "clientName") || String(input(args)?.fullName ?? fallback);
const documentLabel = (result: unknown, args: unknown[]) => value(result, "label") || String(input(args)?.label ?? "El documento");

const operations: Record<string, OperationCopy> = {
  deactivateUser: { loading: { title: "Desactivando usuario…" }, success: { title: "Usuario desactivado", message: "El usuario ya no podrá iniciar sesión; su historial permanece disponible." }, error: { title: "No se pudo desactivar el usuario" } },
  resetUserPassword: { loading: { title: "Actualizando contraseña…" }, success: { title: "Contraseña restablecida", message: "Las sesiones anteriores fueron revocadas." }, error: { title: "No se pudo restablecer la contraseña" } },
  createClient: { loading: { title: "Registrando cliente…" }, success: (result, args) => ({ title: "Cliente registrado", message: `${named(result, args, "El cliente")} fue agregado correctamente.` }), error: { title: "No se pudo registrar el cliente" } },
  updateClient: { loading: { title: "Guardando cliente…" }, success: (result, args) => ({ title: "Cliente actualizado", message: `Los datos de ${named(result, args, "este cliente")} fueron guardados.` }), error: { title: "No se pudo actualizar el cliente" } },
  deleteClient: { loading: { title: "Enviando cliente a Eliminados…" }, success: { title: "Cliente enviado a Eliminados", message: "Ya no aparecerá en las vistas operativas y podrá restaurarse." }, error: { title: "No se pudo retirar el cliente" } },
  createIncomeDeclaration: { loading: { title: "Registrando declaración…" }, success: { title: "Declaración registrada", message: "La información económica quedó vinculada al cliente." }, error: { title: "No se pudo registrar la declaración" } },
  registerStudent: { loading: { title: "Inscribiendo alumno…" }, success: (result) => ({ title: "Alumno inscrito", message: `${value(result, "fullName") || "El alumno"} fue registrado con su acceso académico.` }), error: { title: "No se pudo inscribir al alumno" } },
  updateStudent: { loading: { title: "Guardando alumno…" }, success: (result) => ({ title: "Alumno actualizado", message: `Los datos de ${value(result, "fullName") || "este alumno"} fueron actualizados.` }), error: { title: "No se pudo actualizar el alumno" } },
  setStudentActive: { loading: { title: "Actualizando estado académico…" }, success: { title: "Estado académico actualizado", message: "La disponibilidad del alumno fue actualizada." }, error: { title: "No se pudo actualizar el estado académico" } },
  deleteStudent: { loading: { title: "Enviando alumno a Eliminados…" }, success: { title: "Alumno enviado a Eliminados", message: "Su acceso fue retirado y el historial quedó preservado." }, error: { title: "No se pudo retirar al alumno" } },
  provisionStudentAccess: { loading: { title: "Configurando acceso…" }, success: { title: "Acceso del alumno habilitado", message: "Ya puede iniciar sesión con su correo institucional." }, error: { title: "No se pudo habilitar el acceso" } },
  changeEnrollmentStatus: { loading: { title: "Actualizando inscripción…" }, success: { title: "Estado académico actualizado", message: "La inscripción quedó en el nuevo estado." }, error: { title: "No se pudo actualizar la inscripción" } },
  updateStudentRequirement: { loading: { title: "Guardando papelería…" }, success: { title: "Papelería actualizada", message: "El requisito documental fue actualizado." }, error: { title: "No se pudo actualizar la papelería" } },
  issueClinicCard: { loading: { title: "Registrando carné…" }, success: { title: "Carné de práctica registrado", message: "La entrega quedó incorporada al expediente académico." }, error: { title: "No se pudo registrar el carné" } },
  openCase: { loading: { title: "Creando expediente…" }, success: (result) => ({ title: "Expediente creado", message: `${value(result, "caseNumber") || "El expediente"} quedó listo para su seguimiento.` }), error: { title: "No se pudo crear el expediente" } },
  updateCase: { loading: { title: "Actualizando etapa procesal…" }, success: { title: "Etapa procesal actualizada", message: "El estado y la etapa del expediente fueron guardados." }, error: { title: "No se pudo actualizar el expediente" } },
  assignStudent: { loading: { title: "Asignando alumno…" }, success: { title: "Alumno asignado", message: "El alumno quedó vinculado al expediente." }, error: { title: "No se pudo asignar al alumno" } },
  endAssignment: { loading: { title: "Finalizando asignación…" }, success: { title: "Alumno desasignado", message: "La responsabilidad terminó y quedó registrada en el historial." }, error: { title: "No se pudo desasignar al alumno" } },
  addTimelineEntry: { loading: { title: "Registrando actuación…" }, success: { title: "Actuación registrada", message: "El nuevo movimiento aparece en la línea de tiempo." }, error: { title: "No se pudo registrar la actuación" } },
  updateCaseRequirement: { loading: { title: "Actualizando requisito…" }, success: { title: "Requisito documental actualizado", message: "El estado del requisito quedó guardado." }, error: { title: "No se pudo actualizar el requisito" } },
  closeCase: { loading: { title: "Cerrando expediente…" }, success: { title: "Expediente cerrado", message: "El cierre quedó registrado en la cronología." }, error: { title: "No se pudo cerrar el expediente" } },
  reopenCase: { loading: { title: "Reabriendo expediente…" }, success: { title: "Expediente reabierto", message: "El expediente vuelve a estar disponible para seguimiento." }, error: { title: "No se pudo reabrir el expediente" } },
  deleteCase: { loading: { title: "Enviando expediente a Eliminados…" }, success: { title: "Expediente enviado a Eliminados", message: "Los documentos y el historial se conservaron." }, error: { title: "No se pudo retirar el expediente" } },
  restoreDeletedRecord: { loading: { title: "Restaurando registro…" }, success: { title: "Registro restaurado", message: "El registro vuelve a estar disponible en las vistas operativas." }, error: { title: "No se pudo restaurar el registro" } },
  uploadDocument: { loading: { title: "Subiendo documento…", message: "El archivo se está almacenando de forma segura." }, success: (result, args) => ({ title: "Documento cargado", message: `${documentLabel(result, args)} fue incorporado correctamente.` }), error: { title: "No se pudo cargar el documento" } },
  completeScanSession: { loading: { title: "Procesando escaneo…", message: "Se está generando y almacenando el documento." }, success: (result, args) => ({ title: "Documento escaneado", message: `${documentLabel(result, args)} quedó asociado al registro.` }), error: { title: "No se pudo completar el escaneo" } },
  createActivity: { loading: { title: "Registrando actividad…" }, success: { title: "Actividad registrada", message: "La actividad quedó incorporada a la bitácora." }, error: { title: "No se pudo registrar la actividad" } },
  generateReport: { loading: { title: "Generando reporte…" }, success: { title: "Reporte generado", message: "El reporte está listo para revisión." }, error: { title: "No se pudo generar el reporte" } },
  reviewReport: { loading: { title: "Marcando reporte…" }, success: { title: "Reporte revisado", message: "La revisión quedó registrada." }, error: { title: "No se pudo revisar el reporte" } },
  sendReport: { loading: { title: "Enviando reporte…" }, success: { title: "Reporte enviado", message: "El envío fue registrado correctamente." }, error: { title: "No se pudo enviar el reporte" } },
  changeOwnPassword: { loading: { title: "Actualizando contraseña…" }, success: { title: "Contraseña actualizada", message: "Inicia sesión nuevamente con tu nueva contraseña." }, error: { title: "No se pudo actualizar la contraseña" } },
  createProcessType: { loading: { title: "Creando proceso…" }, success: { title: "Proceso creado", message: "El catálogo fue actualizado." }, error: { title: "No se pudo crear el proceso" } },
  updateProcessType: { loading: { title: "Guardando proceso…" }, success: { title: "Proceso actualizado", message: "Los cambios del catálogo fueron guardados." }, error: { title: "No se pudo actualizar el proceso" } },
  createRequirement: { loading: { title: "Creando requisito…" }, success: { title: "Requisito creado", message: "El requisito fue agregado al catálogo." }, error: { title: "No se pudo crear el requisito" } },
  updateRequirement: { loading: { title: "Guardando requisito…" }, success: { title: "Requisito actualizado", message: "Los cambios del requisito fueron guardados." }, error: { title: "No se pudo actualizar el requisito" } },
};

export function withOperationFeedback<T>(method: string, args: unknown[], operation: () => Promise<T>): Promise<T> {
  const copy = operations[method];
  if (!copy) return operation();
  const id = feedbackBus.show({ ...copy.loading, tone: "loading", duration: 0 });
  return operation().then((result) => {
    const success = typeof copy.success === "function" ? copy.success(result, args) : copy.success;
    feedbackBus.update(id, { ...success, tone: "success", duration: 4500 });
    return result;
  }).catch((error) => {
    feedbackBus.update(id, { ...copy.error, tone: "error", message: humanizeOperationError(error), duration: 7000 });
    throw error;
  });
}

export function hasOperationFeedback(method: string) { return Boolean(operations[method]); }
