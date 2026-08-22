import { DayPicker } from "@daypicker/react";
import { es } from "@daypicker/react/locale";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  FileUp,
  LoaderCircle,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { dataSource } from "../../data/dataSource";
import { formatBytes } from "../../utils/format";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
}) {
  return (
    <button
      className={`button button--${variant} button--${size} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section className={`card ${className}`} {...props}>
      {children}
    </section>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "blue";
  children: ReactNode;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      <span className="badge__dot" />
      {children}
    </span>
  );
}

function useDocumentUrl(documentId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!documentId) {
      setUrl(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    dataSource
      .getDocumentReadAccess(documentId)
      .then(async (access) => {
        if (access.url) return access.url;
        const blob = await dataSource.downloadDocument(documentId);
        objectUrl = URL.createObjectURL(blob);
        return objectUrl;
      })
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo abrir el archivo.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  return { url, loading, error };
}

export function Avatar({
  name,
  documentId,
  size = "md",
  className = "",
}: {
  name: string;
  documentId?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const { url } = useDocumentUrl(documentId);
  return (
    <span className={`avatar avatar--${size} ${className}`} aria-label={name}>
      {url ? <img src={url} alt="" /> : initials}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && (
          <p className="page-header__description">{description}</p>
        )}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function OpenAction({ label = "Abrir" }: { label?: string }) {
  return (
    <span className="open-action" aria-label={label}>
      <ArrowUpRight size={18} strokeWidth={1.8} />
    </span>
  );
}

export function LoadingState({
  label = "Cargando información",
}: {
  label?: string;
}) {
  return (
    <div className="state-panel">
      <LoaderCircle className="spin" size={28} />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="state-panel state-panel--error">
      <AlertCircle size={28} />
      <div>
        <strong>No fue posible cargar la información</strong>
        <p>{error.message}</p>
      </div>
      {retry && (
        <Button variant="secondary" size="sm" onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() =>
      modalRef.current
        ?.querySelector<HTMLElement>("button, input, select, textarea, [href]")
        ?.focus(),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = [
        ...modalRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]",
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </section>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  wide = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field--wide" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export interface WizardStepDefinition {
  id: string;
  label: string;
  description?: string;
}

export function WizardProgress({
  steps,
  currentStep,
  onStepChange,
}: {
  steps: WizardStepDefinition[];
  currentStep: number;
  onStepChange?: (step: number) => void;
}) {
  return (
    <nav className="wizard-progress" aria-label="Progreso del formulario">
      <ol>
        {steps.map((step, index) => {
          const complete = index < currentStep;
          const active = index === currentStep;
          return (
            <li
              key={step.id}
              className={active ? "is-active" : complete ? "is-complete" : ""}
              aria-current={active ? "step" : undefined}
            >
              <button
                type="button"
                disabled={!onStepChange || index > currentStep}
                onClick={() => onStepChange?.(index)}
              >
                <span className="wizard-progress__index">
                  {complete ? <Check size={15} /> : index + 1}
                </span>
                <span className="wizard-progress__copy">
                  <strong>{step.label}</strong>
                  {step.description && <small>{step.description}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function WizardStep({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="wizard-step">
      <header>
        <span>
          <CheckCircle2 size={19} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      <div className="form-grid">{children}</div>
    </section>
  );
}

export function ReadOnlyValue({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="readonly-value">
      <span>{label}</span>
      <strong>{value || "No registrado"}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function FilePicker({
  label,
  hint,
  file,
  onChange,
  accept = "application/pdf,image/png,image/jpeg,image/webp",
  capture,
  required = false,
}: {
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  capture?: "user" | "environment";
  required?: boolean;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`file-picker ${file ? "file-picker--selected" : ""} ${dragging ? "file-picker--dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onChange(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <label htmlFor={id} className="file-picker__target">
        <span className="file-picker__icon">
          {file ? <Check size={22} /> : <UploadCloud size={24} />}
        </span>
        <span className="file-picker__copy">
          <strong>
            {file ? file.name : label}
            {required && !file ? " *" : ""}
          </strong>
          <small>
            {file
              ? `${formatBytes(file.size)} · listo para cargar`
              : (hint ?? "Arrastre el archivo o selecciónelo desde su equipo")}
          </small>
        </span>
        <span className="file-picker__action">
          {file ? "Cambiar" : "Seleccionar"}
        </span>
      </label>
      <input
        id={id}
        className="visually-hidden"
        type="file"
        accept={accept}
        capture={capture}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {file && (
        <IconButton
          className="file-picker__remove"
          label="Quitar archivo"
          onClick={() => onChange(null)}
        >
          <Trash2 size={16} />
        </IconButton>
      )}
    </div>
  );
}

export function DatePickerField({
  label,
  value,
  onChange,
  hint,
  required = false,
  withTime = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  withTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [popoverAlignment, setPopoverAlignment] = useState<"left" | "right">(
    "left",
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const datePart = value.slice(0, 10);
  const timePart = withTime ? value.slice(11, 16) || "09:00" : "";
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? new Date(`${datePart}T12:00:00`)
    : undefined;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const setDate = (date?: Date) => {
    if (!date) return;
    const nextDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    onChange(withTime ? `${nextDate}T${timePart}` : nextDate);
    setOpen(false);
  };

  const toggleCalendar = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const field = rootRef.current?.getBoundingClientRect();
    const boundary = rootRef.current
      ?.closest(".modal__body")
      ?.getBoundingClientRect();
    const rightEdge = boundary?.right ?? window.innerWidth - 12;
    setPopoverAlignment(
      field && field.left + 330 > rightEdge ? "right" : "left",
    );
    setOpen(true);
  };

  return (
    <div className="field date-picker-field" ref={rootRef}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <div className="date-picker-control">
        <input
          aria-label={label}
          inputMode="numeric"
          placeholder="AAAA-MM-DD"
          value={datePart}
          onChange={(event) => {
            const next = event.target.value;
            onChange(withTime ? `${next}T${timePart}` : next);
          }}
        />
        <IconButton
          label={`Abrir calendario de ${label}`}
          aria-expanded={open}
          onClick={toggleCalendar}
        >
          <CalendarDays size={18} />
        </IconButton>
      </div>
      {withTime && (
        <div className="time-control">
          <span>Hora</span>
          <input
            aria-label={`Hora de ${label}`}
            inputMode="numeric"
            placeholder="HH:MM"
            value={timePart}
            onChange={(event) => onChange(`${datePart}T${event.target.value}`)}
          />
        </div>
      )}
      {hint && <small>{hint}</small>}
      {open && (
        <div
          className={`date-picker-popover date-picker-popover--${popoverAlignment}`}
        >
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            onSelect={setDate}
            captionLayout="dropdown"
            startMonth={new Date(2000, 0)}
            endMonth={new Date(2040, 11)}
          />
        </div>
      )}
    </div>
  );
}

export function FileThumbnail({
  documentId,
  alt,
}: {
  documentId: string;
  alt: string;
}) {
  const { url, loading } = useDocumentUrl(documentId);
  if (loading) return <LoaderCircle className="spin" size={22} />;
  return url ? (
    <img className="file-thumbnail" src={url} alt={alt} />
  ) : (
    <FileUp size={28} />
  );
}
