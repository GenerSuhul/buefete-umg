import { AlertTriangle, CheckCircle2, Info, LoaderCircle, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, Modal } from ".";
import {
  feedbackBus,
  humanizeOperationError,
  subscribeFeedback,
  type FeedbackMessage,
  type FeedbackTone,
} from "./feedback/feedbackBus";
import { motion } from "./motion/motion";

interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
}
type Confirm = (options: ConfirmationOptions) => Promise<boolean>;
type MessageOptions = string | Omit<FeedbackMessage, "tone">;
interface TrackOptions<T> {
  loading: Omit<FeedbackMessage, "tone">;
  success: Omit<FeedbackMessage, "tone"> | ((result: T) => Omit<FeedbackMessage, "tone">);
  error: Omit<FeedbackMessage, "tone" | "message"> & { message?: string | ((error: unknown) => string) };
}
export interface NotifyApi {
  success(options: MessageOptions): string;
  error(options: MessageOptions): string;
  warning(options: MessageOptions): string;
  info(options: MessageOptions): string;
  loading(options: MessageOptions): string;
  update(id: string, options: Partial<FeedbackMessage>): void;
  dismiss(id: string): void;
  track<T>(promise: Promise<T>, options: TrackOptions<T>): Promise<T>;
}
interface FeedbackContextValue { notify: NotifyApi; confirm: Confirm; }
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function normalize(tone: FeedbackTone, options: MessageOptions): FeedbackMessage {
  return typeof options === "string" ? { tone, title: options } : { ...options, tone };
}

function ToastItem({ notification, index, remove }: { notification: FeedbackMessage & { id: string }; index: number; remove: (id: string) => void; }) {
  const ref = useRef<HTMLElement>(null);
  const closing = useRef(false);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const defaultDuration = notification.tone === "error" ? 7000 : notification.tone === "warning" ? 6000 : 4500;
  const remaining = useRef(notification.duration ?? defaultDuration);
  const icons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info, loading: LoaderCircle };
  const Icon = icons[notification.tone];

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    const element = ref.current;
    if (!element) return remove(notification.id);
    void motion.toastExit(element).finished.then(() => remove(notification.id));
  }, [notification.id, remove]);

  const startTimer = useCallback(() => {
    if (notification.tone === "loading" || remaining.current <= 0 || closing.current) return;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(close, remaining.current);
  }, [close, notification.tone]);

  useEffect(() => {
    const entrance = ref.current ? motion.toastEnter(ref.current, index) : null;
    return () => { entrance?.cancel(); if (timer.current) window.clearTimeout(timer.current); };
  }, [index]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    remaining.current = notification.duration ?? defaultDuration;
    startTimer();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [defaultDuration, notification.duration, notification.tone, startTimer]);

  return (
    <article ref={ref} className={`toast toast--${notification.tone}`} role={notification.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => { if (!timer.current) return; window.clearTimeout(timer.current); timer.current = null; remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current)); }}
      onMouseLeave={startTimer}>
      <span className="toast__icon"><Icon className={notification.tone === "loading" ? "spin" : undefined} size={20} /></span>
      <span className="toast__copy">
        <strong>{notification.title}</strong>
        {notification.message ? <small>{notification.message}</small> : null}
        {notification.actionLabel ? <button type="button" className="toast__action" onClick={() => { notification.onAction?.(); close(); }}>{notification.actionLabel}</button> : null}
      </span>
      <button type="button" aria-label="Cerrar notificación" onClick={close}>×</button>
    </article>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Array<FeedbackMessage & { id: string }>>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationOptions | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const remove = useCallback((id: string) => setNotifications((current) => current.filter((item) => item.id !== id)), []);

  useEffect(() => subscribeFeedback((event) => {
    if (event.type === "dismiss") return remove(event.id);
    if (event.type === "update") {
      setNotifications((current) => current.map((item) => item.id === event.id ? { ...item, ...event.notification, id: item.id } : item));
      return;
    }
    setNotifications((current) => [...current.filter((item) => item.id !== event.notification.id).slice(-3), event.notification]);
  }), [remove]);

  const notify = useMemo<NotifyApi>(() => {
    const show = (tone: FeedbackTone, options: MessageOptions) => feedbackBus.show(normalize(tone, options));
    return {
      success: (options) => show("success", options), error: (options) => show("error", options), warning: (options) => show("warning", options), info: (options) => show("info", options), loading: (options) => show("loading", options),
      update: feedbackBus.update, dismiss: feedbackBus.dismiss,
      async track<T>(promise: Promise<T>, options: TrackOptions<T>) {
        const id = feedbackBus.show({ ...options.loading, tone: "loading", duration: 0 });
        try {
          const result = await promise;
          const success = typeof options.success === "function" ? options.success(result) : options.success;
          feedbackBus.update(id, { ...success, tone: "success", duration: success.duration ?? 4500 });
          return result;
        } catch (error) {
          const message = typeof options.error.message === "function" ? options.error.message(error) : options.error.message ?? humanizeOperationError(error);
          feedbackBus.update(id, { ...options.error, tone: "error", message, duration: options.error.duration ?? 7000 });
          throw error;
        }
      },
    };
  }, []);

  const confirm = useCallback<Confirm>((options) => {
    resolver.current?.(false); setConfirmation(options);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);
  const closeConfirmation = useCallback((accepted: boolean) => { resolver.current?.(accepted); resolver.current = null; setConfirmation(null); }, []);

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}
      <aside className="toast-region" aria-label="Notificaciones" aria-live="polite">
        {notifications.map((notification, index) => <ToastItem key={notification.id} notification={notification} index={index} remove={remove} />)}
      </aside>
      <Modal open={confirmation !== null} title={confirmation?.title ?? "Confirmar acción"} description={confirmation?.message} onClose={() => closeConfirmation(false)} footer={<>
        <Button variant="secondary" onClick={() => closeConfirmation(false)} autoFocus>{confirmation?.cancelLabel ?? "Cancelar"}</Button>
        <Button variant={confirmation?.tone === "danger" ? "danger" : "primary"} onClick={() => closeConfirmation(true)}>{confirmation?.confirmLabel ?? "Confirmar"}</Button>
      </>}>
        {confirmation?.tone === "danger" ? <div className="confirmation-warning"><AlertTriangle size={22} /><span>Esta acción afectará la disponibilidad del registro.</span></div> : null}
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useNotify() { const context = useContext(FeedbackContext); if (!context) throw new Error("useNotify debe utilizarse dentro de FeedbackProvider."); return context.notify; }
export function useConfirm() { const context = useContext(FeedbackContext); if (!context) throw new Error("useConfirm debe utilizarse dentro de FeedbackProvider."); return context.confirm; }
