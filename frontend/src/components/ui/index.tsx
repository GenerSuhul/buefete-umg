import { DayPicker, type DateRange, type DropdownProps } from "@daypicker/react";
import { es } from "@daypicker/react/locale";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Check,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  FileUp,
  LoaderCircle,
  Clock3,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  Children,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { dataSource } from "../../data/dataSource";
import { formatBytes } from "../../utils/format";
import { motion } from "./motion/motion";

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

const pendingDocumentAccessRequests = new Map<
  string,
  ReturnType<typeof dataSource.getDocumentReadAccess>
>();

function getDocumentReadAccessOnce(documentId: string) {
  const existing = pendingDocumentAccessRequests.get(documentId);
  if (existing) return existing;

  const request = dataSource.getDocumentReadAccess(documentId);
  pendingDocumentAccessRequests.set(documentId, request);
  const clear = () => {
    if (pendingDocumentAccessRequests.get(documentId) === request)
      pendingDocumentAccessRequests.delete(documentId);
  };
  request.then(clear, clear);
  return request;
}

function useDocumentUrl(documentId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [access, setAccess] = useState<{ fileName: string; contentType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!documentId) {
      setUrl(null);
      setAccess(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getDocumentReadAccessOnce(documentId)
      .then(async (access) => {
        if (active) setAccess({ fileName: access.fileName, contentType: access.contentType });
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

  return { url, loading, error, access };
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
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const [present, setPresent] = useState(open);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) setPresent(true);
  }, [open]);

  useEffect(() => {
    if (!present || !backdropRef.current || !modalRef.current) return;
    const animation = open
      ? motion.modalEnter(backdropRef.current, modalRef.current)
      : motion.modalExit(backdropRef.current, modalRef.current);
    if (!open) void animation.finished.then(() => setPresent(false));
    return animation.cancel;
  }, [open, present]);

  useEffect(() => {
    if (!present) return;
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
  }, [present]);

  if (!present) return null;
  return (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (open && event.target === event.currentTarget) onClose();
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

export function Select({
  children,
  className = "",
  popoverClassName = "",
  value,
  defaultValue,
  disabled,
  onChange,
  "aria-label": ariaLabel,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { popoverClassName?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const listId = useId();
  const [position, setPosition] = useState({ top: 0, left: 0, width: 240 });
  const options = Children.toArray(children).flatMap((child) => {
    if (!child || typeof child !== "object" || !("props" in child)) return [];
    const option = child as { props: { value?: string | number; children?: ReactNode; disabled?: boolean } };
    const implicitValue =
      typeof option.props.children === "string" ||
      typeof option.props.children === "number"
        ? String(option.props.children)
        : "";
    return [{
      value: option.props.value === undefined
        ? implicitValue
        : String(option.props.value),
      label: option.props.children,
      disabled: option.props.disabled,
    }];
  });
  const currentValue = String(value ?? defaultValue ?? "");
  const selected = options.find((option) => option.value === currentValue) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !(event.target as Element).closest?.(".select-popover")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnLayoutChange = () => setOpen(false);
    window.addEventListener("resize", closeOnLayoutChange);
    return () => {
      window.removeEventListener("resize", closeOnLayoutChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(listId)?.querySelector<HTMLButtonElement>('button[aria-selected="true"]')?.focus();
  }, [listId, open]);

  const toggle = () => {
    if (disabled) return;
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24);
      const height = Math.min(290, Math.max(120, window.innerHeight - 24));
      const preferredTop = rect.bottom + 6 + height <= window.innerHeight - 12
        ? rect.bottom + 6
        : rect.top - height - 6;
      setPosition({
        top: Math.max(12, Math.min(preferredTop, window.innerHeight - height - 12)),
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        width,
      });
    }
    setOpen((current) => !current);
  };
  const choose = (next: string) => {
    const element = selectRef.current;
    if (!element) return;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(element, next);
    const changed = { value: next } as HTMLSelectElement;
    onChange?.({ target: changed, currentTarget: changed } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    buttonRef.current?.focus();
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) toggle();
    }
  };
  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    const items = Array.from(list.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || items.length === 0) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  if (props.multiple) {
    return <select className={`multi-select ${className}`} value={value} defaultValue={defaultValue} disabled={disabled} onChange={onChange} aria-label={ariaLabel} {...props}>{children}</select>;
  }

  return (
    <div className={`custom-select ${className}`} ref={rootRef}>
      <button ref={buttonRef} type="button" className="custom-select__trigger" disabled={disabled} role="combobox" aria-label={ariaLabel} aria-controls={listId} aria-expanded={open} aria-haspopup="listbox" onClick={toggle} onKeyDown={handleKeyDown}>
        <span>{selected?.label ?? "Seleccione"}</span><ChevronDown size={17} />
      </button>
      <select ref={selectRef} className="visually-hidden" value={value} defaultValue={defaultValue} disabled={disabled} onChange={onChange} tabIndex={-1} aria-hidden="true" {...props}>{children}</select>
      {open ? createPortal(
        <div id={listId} className={`select-popover ${popoverClassName}`} role="listbox" style={position} onKeyDown={handleListKeyDown}>
          {options.map((option) => (
            <button key={option.value} type="button" role="option" aria-selected={option.value === currentValue} disabled={option.disabled} onClick={() => choose(option.value)}>
              <span>{option.label}</span>{option.value === currentValue ? <Check size={16} /> : null}
            </button>
          ))}
        </div>, document.body) : null}
    </div>
  );
}

function CalendarDropdown({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
}: DropdownProps) {
  return (
    <Select
      aria-label={ariaLabel}
      className="calendar-caption-select"
      popoverClassName="calendar-caption-popover"
      value={value?.toString() ?? ""}
      onChange={(event) => onChange?.(event)}
    >
      {options?.map((option) => (
        <option
          key={option.value}
          value={option.value.toString()}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </Select>
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
  allowDirectNavigation = false,
}: {
  steps: WizardStepDefinition[];
  currentStep: number;
  onStepChange?: (step: number) => void;
  allowDirectNavigation?: boolean;
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
                disabled={!onStepChange || (!allowDirectNavigation && index > currentStep)}
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || (!file.type.startsWith("image/") && file.type !== "application/pdf")) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
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
      {previewUrl ? <div className="file-picker__preview" aria-label={`Vista previa de ${file?.name ?? label}`}>
        {file?.type.startsWith("image/") ? <img src={previewUrl} alt="" /> : <iframe src={previewUrl} title={`Vista previa de ${file?.name ?? label}`} />}
      </div> : null}
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

export type AppDatePickerPreset =
  | "birthDate"
  | "processDate"
  | "startDate"
  | "endDate"
  | "general";

export function AppDatePicker({
  label,
  value,
  onChange,
  hint,
  required = false,
  withTime = false,
  min,
  max,
  preset = "general",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  withTime?: boolean;
  min?: string;
  max?: string;
  preset?: AppDatePickerPreset;
}) {
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0, width: 330 });
  const rootRef = useRef<HTMLDivElement>(null);
  const datePart = value.slice(0, 10);
  const timePart = withTime ? value.slice(11, 16) || "09:00" : "";
  const today = new Date();
  const todayOnly = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const effectiveMin = min ?? (preset === "birthDate" ? "1900-01-01" : undefined);
  const effectiveMax = max ?? (preset === "birthDate" ? todayOnly : undefined);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? new Date(`${datePart}T12:00:00`)
    : undefined;
  const [visibleMonth, setVisibleMonth] = useState(selected ?? new Date());
  const minDate = effectiveMin && /^\d{4}-\d{2}-\d{2}$/.test(effectiveMin) ? new Date(`${effectiveMin}T12:00:00`) : undefined;
  const maxDate = effectiveMax && /^\d{4}-\d{2}-\d{2}$/.test(effectiveMax) ? new Date(`${effectiveMax}T12:00:00`) : undefined;

  const positionCalendar = () => {
    const field = rootRef.current?.getBoundingClientRect();
    if (!field) return;
    const modalBody = rootRef.current?.closest<HTMLElement>(".modal__body")
      ?.getBoundingClientRect();
    const boundary = modalBody ?? {
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      left: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    setPopoverPosition(calculateDatePopoverPosition(field, boundary));
  };

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!rootRef.current?.contains(target) && !target.closest?.(".date-picker-popover") && !target.closest?.(".select-popover")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const updateOnLayoutChange = () => positionCalendar();
    window.addEventListener("resize", updateOnLayoutChange);
    document.addEventListener("scroll", updateOnLayoutChange, true);
    return () => {
      window.removeEventListener("resize", updateOnLayoutChange);
      document.removeEventListener("scroll", updateOnLayoutChange, true);
    };
  }, [open]);

  const setDate = (date?: Date) => {
    if (!date) return;
    if ((minDate && date < minDate) || (maxDate && date > maxDate)) return;
    const nextDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    onChange(withTime ? `${nextDate}T${timePart}` : nextDate);
    setOpen(false);
  };

  const toggleCalendar = () => {
    if (open) {
      setOpen(false);
      return;
    }
    positionCalendar();
    setVisibleMonth(selected ?? new Date());
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
      {open && createPortal(
        <div className="date-picker-popover date-picker-popover--single" role="dialog" aria-label={`Seleccionar ${label}`} style={popoverPosition} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
          <DayPicker
            mode="single"
            locale={es}
            selected={selected}
            onSelect={setDate}
            month={visibleMonth}
            onMonthChange={setVisibleMonth}
            captionLayout="dropdown"
            components={{ Dropdown: CalendarDropdown }}
            navLayout="after"
            reverseYears
            startMonth={minDate ?? new Date(1900, 0, 1)}
            endMonth={maxDate ?? new Date(today.getFullYear() + 20, 11, 1)}
            showOutsideDays
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
          />
        </div>, document.body)}
    </div>
  );
}

type PositionRect = Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width" | "height">;

export function calculateDatePopoverPosition(
  field: PositionRect,
  boundary: PositionRect,
) {
  const margin = 12;
  const gap = 8;
  const width = Math.max(260, Math.min(330, boundary.width - margin * 2));
  const estimatedHeight = Math.max(290, Math.min(350, boundary.height - margin * 2));
  const minLeft = boundary.left + margin;
  const maxLeft = Math.max(minLeft, boundary.right - width - margin);
  const minTop = boundary.top + margin;
  const maxTop = Math.max(minTop, boundary.bottom - estimatedHeight - margin);
  const clampLeft = (value: number) => Math.max(minLeft, Math.min(value, maxLeft));
  const clampTop = (value: number) => Math.max(minTop, Math.min(value, maxTop));
  const centeredTop = clampTop(field.top + field.height / 2 - estimatedHeight / 2);

  if (field.bottom + gap + estimatedHeight <= boundary.bottom - margin)
    return { top: field.bottom + gap, left: clampLeft(field.left), width };
  if (field.top - gap - estimatedHeight >= boundary.top + margin)
    return { top: field.top - gap - estimatedHeight, left: clampLeft(field.left), width };
  return {
    top: centeredTop,
    left: clampLeft(field.left),
    width,
  };
}

const parseDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? new Date(`${value}T12:00:00`)
  : undefined;

const toDateOnly = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const presentDate = (value: string) => {
  const date = parseDateOnly(value);
  return date ? new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "";
};

export function DateRangePickerField({
  label,
  startValue,
  endValue,
  onChange,
  hint,
  required = false,
}: {
  label: string;
  startValue: string;
  endValue: string;
  onChange: (start: string, end: string) => void;
  hint?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const [position, setPosition] = useState({ top: 0, left: 0, width: 344 });
  const rootRef = useRef<HTMLDivElement>(null);
  const display = startValue && endValue
    ? `${presentDate(startValue)} — ${presentDate(endValue)}`
    : startValue ? `Desde ${presentDate(startValue)}` : "Seleccione un rango";

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!rootRef.current?.contains(target) && !target.closest?.(".date-range-popover")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnLayoutChange = () => setOpen(false);
    window.addEventListener("resize", closeOnLayoutChange);
    document.addEventListener("scroll", closeOnLayoutChange, true);
    return () => {
      window.removeEventListener("resize", closeOnLayoutChange);
      document.removeEventListener("scroll", closeOnLayoutChange, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    setDraft({ from: parseDateOnly(startValue), to: parseDateOnly(endValue) });
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(344, window.innerWidth - 24);
      const height = 455;
      setPosition({
        top: window.innerHeight - rect.bottom >= height ? rect.bottom + 8 : Math.max(12, rect.top - height - 8),
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        width,
      });
    }
    setOpen(true);
  };

  const apply = () => {
    if (!draft?.from || !draft.to) return;
    onChange(toDateOnly(draft.from), toDateOnly(draft.to));
    setOpen(false);
  };

  return (
    <div className="field date-range-field" ref={rootRef}>
      <span>{label}{required ? " *" : ""}</span>
      <button type="button" className="date-range-control" aria-expanded={open} onClick={toggle}>
        <span className={startValue ? "" : "is-placeholder"}>{display}</span>
        <CalendarDays size={18} />
      </button>
      {hint ? <small>{hint}</small> : null}
      {open ? createPortal(
        <div className="date-range-popover" role="dialog" aria-label={`Seleccionar ${label}`} style={position} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
          <div className="date-range-popover__heading">
            <strong>{draft?.from ? presentDate(toDateOnly(draft.from)) : "Fecha inicial"}</strong>
            <span>—</span>
            <strong>{draft?.to ? presentDate(toDateOnly(draft.to)) : "Fecha final"}</strong>
          </div>
          <DayPicker
            mode="range"
            locale={es}
            selected={draft}
            onSelect={setDraft}
            defaultMonth={draft?.from}
            numberOfMonths={1}
            showOutsideDays
          />
          <div className="date-range-popover__actions">
            <Button variant="ghost" size="sm" onClick={() => { setDraft(undefined); onChange("", ""); setOpen(false); }}>Limpiar</Button>
            <Button size="sm" disabled={!draft?.from || !draft.to} onClick={apply}>Aplicar rango</Button>
          </div>
        </div>, document.body) : null}
    </div>
  );
}

export function TimePickerField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 286 });
  const rootRef = useRef<HTMLDivElement>(null);
  const [hour = "", minute = ""] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!rootRef.current?.contains(target) && !target.closest?.(".time-picker-popover")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnLayoutChange = () => setOpen(false);
    window.addEventListener("resize", closeOnLayoutChange);
    document.addEventListener("scroll", closeOnLayoutChange, true);
    return () => {
      window.removeEventListener("resize", closeOnLayoutChange);
      document.removeEventListener("scroll", closeOnLayoutChange, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(286, window.innerWidth - 24);
      const height = 310;
      setPosition({
        top: window.innerHeight - rect.bottom >= height ? rect.bottom + 8 : Math.max(12, rect.top - height - 8),
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        width,
      });
    }
    setOpen(true);
  };
  const chooseHour = (nextHour: string) => onChange(`${nextHour}:${minute || "00"}`);
  const chooseMinute = (nextMinute: string) => {
    onChange(`${hour || "08"}:${nextMinute}`);
    if (hour) setOpen(false);
  };

  return (
    <div className="field time-picker-field" ref={rootRef}>
      <span>{label}</span>
      <div className="time-picker-control">
        <input
          aria-label={label}
          inputMode="numeric"
          placeholder="HH:MM"
          value={value}
          maxLength={5}
          onChange={(event) => {
            const next = event.target.value.replace(/[^0-9:]/g, "").slice(0, 5);
            onChange(next);
          }}
        />
        <IconButton label={`Seleccionar ${label.toLowerCase()}`} aria-expanded={open} onClick={toggle}>
          <Clock3 size={18} />
        </IconButton>
      </div>
      {hint ? <small>{hint}</small> : null}
      {open ? createPortal(
        <div className="time-picker-popover" role="dialog" aria-label={`Seleccionar ${label}`} style={position} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
          <div className="time-picker-popover__header"><strong>{hour || "--"}</strong><span>:</span><strong>{minute || "--"}</strong></div>
          <div className="time-picker-popover__columns">
            <div><span>Hora</span><div className="time-picker-options">{hours.map((item) => <button type="button" className={item === hour ? "is-selected" : ""} key={item} onClick={() => chooseHour(item)}>{item}</button>)}</div></div>
            <div><span>Minutos</span><div className="time-picker-options">{minutes.map((item) => <button type="button" className={item === minute ? "is-selected" : ""} key={item} onClick={() => chooseMinute(item)}>{item}</button>)}</div></div>
          </div>
        </div>, document.body) : null}
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

export function DocumentViewer({
  documentId,
  open,
  onClose,
  label = "Ver documento",
  description = "Vista previa del documento",
  children,
}: {
  documentId: string | null;
  open: boolean;
  onClose: () => void;
  label?: string;
  description?: string;
  children?: ReactNode;
}) {
  const { url, loading, error, access } = useDocumentUrl(open ? documentId : null);
  const isImage = access?.contentType.startsWith("image/");
  const isPdf = access?.contentType === "application/pdf";
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={access?.fileName ?? label}
      description={description}
      footer={<><Button variant="secondary" onClick={onClose}>Cerrar</Button>{url ? <a className="button button--secondary button--md" href={url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir aparte</a> : null}{url ? <a className="button button--primary button--md" href={url} download={access?.fileName}><Download size={16} /> Descargar</a> : null}</>}
    >
      <div className="inline-document-preview">
        {loading ? <LoadingState label="Preparando documento" /> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {url && isImage ? <img src={url} alt={access?.fileName ?? label} /> : null}
        {url && isPdf ? <iframe src={url} title={access?.fileName ?? label} /> : null}
        {url && !isImage && !isPdf ? <div className="empty-state"><FileUp size={30} /><strong>Vista previa no disponible</strong><span>Consulte la metadata y descargue el archivo.</span></div> : null}
      </div>
      {children}
    </Modal>
  );
}

export function DocumentLink({
  documentId,
  label = "Ver documento",
}: {
  documentId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="document-link" onClick={() => setOpen(true)}>
        <Eye size={15} /> {label}
      </button>
      <DocumentViewer documentId={documentId} open={open} onClose={() => setOpen(false)} label={label} />
    </>
  );
}
