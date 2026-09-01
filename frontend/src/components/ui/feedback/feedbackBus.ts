export type FeedbackTone = "success" | "error" | "warning" | "info" | "loading";

export interface FeedbackMessage {
  id?: string;
  tone: FeedbackTone;
  title: string;
  message?: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

type FeedbackEvent =
  | { type: "show"; notification: FeedbackMessage & { id: string } }
  | { type: "update"; id: string; notification: Partial<FeedbackMessage> }
  | { type: "dismiss"; id: string };

type Listener = (event: FeedbackEvent) => void;
const listeners = new Set<Listener>();
let sequence = 1;

export function subscribeFeedback(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(event: FeedbackEvent) {
  listeners.forEach((listener) => listener(event));
}

export const feedbackBus = {
  show(notification: FeedbackMessage) {
    const id = notification.id ?? `feedback-${sequence++}`;
    publish({ type: "show", notification: { ...notification, id } });
    return id;
  },
  update(id: string, notification: Partial<FeedbackMessage>) {
    publish({ type: "update", id, notification });
  },
  dismiss(id: string) {
    publish({ type: "dismiss", id });
  },
};

export function humanizeOperationError(error: unknown) {
  const raw = error instanceof Error ? error.message : "No se pudo completar la operación.";
  const message = raw.toLowerCase();
  if (message.includes("fetch") || message.includes("network") || message.includes("conexión"))
    return "No se pudo conectar con el servidor. Verifica la conexión e inténtalo nuevamente.";
  if (message.includes("403") || message.includes("forbidden") || message.includes("permis"))
    return "No tienes permisos para realizar esta acción.";
  if (message.includes("401") || message.includes("credencial") || message.includes("contraseña incorrect"))
    return "Verifica tu correo electrónico y contraseña.";
  if (message.includes("409") || message.includes("ya existe") || message.includes("duplic"))
    return "Ya existe un registro con estos datos. Revisa la información ingresada.";
  if (message.includes("tamaño") || message.includes("too large") || message.includes("25 mb"))
    return "El archivo supera el tamaño permitido.";
  if (message.includes("500") || message.includes("internal server"))
    return "El servidor no pudo completar la operación. Inténtalo nuevamente.";
  return raw;
}
