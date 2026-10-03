import { FileUp, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { dataSource } from "../../data/dataSource";
import type { DocumentRecord } from "../../types/domain";
import { RelationLookup, type LookupOption } from "../domain/Shared";
import { Button, Field, FilePicker, Modal, ReadOnlyValue, Select } from "../ui";
import { useConfirm } from "../ui/Feedback";
import { ScanWorkspace } from "./ScanWorkspace";

type DocumentContext = DocumentRecord["contextType"];
type ContextOption = { id: string; label: string };
type ContextMap = Partial<Record<DocumentContext, ContextOption[]>>;

export interface DocumentAcquisitionForm {
  contextType: DocumentContext;
  contextId: string;
  label: string;
  replaceDocumentId: string;
}

export function DocumentAcquisition({
  open,
  onClose,
  initialForm,
  contexts,
  loadContexts,
  contextLocked = false,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  initialForm: DocumentAcquisitionForm;
  contexts?: ContextMap;
  loadContexts?: (contextType: "Client" | "Student" | "LegalCase", search: string, selectedId?: string) => Promise<LookupOption[]>;
  contextLocked?: boolean;
  onCompleted: (document: DocumentRecord) => Promise<void> | void;
}) {
  const confirm = useConfirm();
  const [mode, setMode] = useState<"choose" | "upload" | "scan">("choose");
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("choose");
    setForm(initialForm);
    setFile(null);
    setError(null);
  }, [
    open,
    initialForm.contextType,
    initialForm.contextId,
    initialForm.label,
    initialForm.replaceDocumentId,
  ]);

  const close = () => {
    if (!busy) onClose();
  };

  const selectMode = async (nextMode: "upload" | "scan") => {
    if (form.replaceDocumentId) {
      const accepted = await confirm({
        title: "Reemplazar documento",
        message: "Se creará una nueva versión y la anterior permanecerá disponible en el historial.",
        confirmLabel: "Continuar",
      });
      if (!accepted) return;
    }
    setMode(nextMode);
  };

  const upload = async () => {
    if (!file || !form.contextId || !form.label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const document = await dataSource.uploadDocument({
        file,
        contextType: form.contextType,
        contextId: form.contextId,
        label: form.label.trim(),
        replaceDocumentId: form.replaceDocumentId || null,
      });
      await onCompleted(document);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el documento.");
    } finally {
      setBusy(false);
    }
  };

  const contextLabel = contexts?.[form.contextType]?.find((item) => item.id === form.contextId)?.label;
  const contextFields = contextLocked ? (
    <ReadOnlyValue label="Registro relacionado" value={contextLabel ?? "Registro seleccionado"} />
  ) : (
    <div className="form-grid">
      <Field label="Tipo de registro">
        <Select value={form.contextType} onChange={(event) => setForm({ ...form, contextType: event.target.value as DocumentContext, contextId: "", replaceDocumentId: "" })}>
          <option value="Client">Usuario</option>
          <option value="Student">Alumno</option>
          <option value="LegalCase">Expediente</option>
        </Select>
      </Field>
      {loadContexts ? <RelationLookup label="Registro relacionado" required value={form.contextId} onChange={(contextId) => setForm({ ...form, contextId, replaceDocumentId: "" })} load={(term) => loadContexts(form.contextType as "Client" | "Student" | "LegalCase", term, form.contextId)} /> : null}
    </div>
  );

  return (
    <>
      <Modal open={open && mode === "choose"} onClose={close} title="Adjuntar documento" description="Seleccione cómo desea incorporar el archivo.">
        <div className="document-acquisition-options">
          <button type="button" onClick={() => void selectMode("upload")}><FileUp size={25} /><strong>Subir archivo</strong><span>PDF, JPG, PNG o WEBP</span></button>
          <button type="button" onClick={() => void selectMode("scan")}><ScanLine size={25} /><strong>Escanear documento</strong><span>Escáner WIA o importación para captura</span></button>
        </div>
      </Modal>

      <Modal
        size="lg"
        open={open && mode === "upload"}
        onClose={close}
        title="Subir documento"
        description="Revise el archivo y su asociación antes de guardarlo."
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setMode("choose")}>Atrás</Button><Button disabled={busy || !file || !form.contextId || !form.label.trim()} onClick={upload}>{busy ? "Guardando…" : "Guardar documento"}</Button></>}
      >
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <FilePicker label="Documento" hint="PDF, JPG, PNG o WEBP · máximo 25 MB" file={file} onChange={setFile} required />
        <Field label="Nombre del documento"><input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></Field>
        {contextFields}
      </Modal>

      <ScanWorkspace
        open={open && mode === "scan"}
        onClose={() => setMode("choose")}
        contexts={contexts}
        loadContexts={loadContexts}
        initialForm={form}
        contextLocked={contextLocked}
        onCompleted={async (document) => {
          await onCompleted(document);
          onClose();
        }}
      />
    </>
  );
}
