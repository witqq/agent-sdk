import {
  createElement,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import type { ProviderConfig } from "../provider-types.js";
import { useRemoteAuth } from "./useRemoteAuth.js";
import type { RemoteAuthBackend } from "./useRemoteAuth.js";
import { useChatRuntime } from "./ChatProvider.js";
import { CopilotAuthForm } from "./auth/CopilotAuthForm.js";
import { ClaudeAuthForm } from "./auth/ClaudeAuthForm.js";
import { VercelAIAuthForm } from "./auth/VercelAIAuthForm.js";
import type { AuthFormComponent } from "./auth/types.js";

/** Props for the ProviderSettings component. */
export interface ProviderSettingsProps {
  providers: ProviderConfig[];
  onClose?: () => void;
  onProviderCreated?: (p: ProviderConfig) => void;
  onProviderDeleted?: (id: string) => void;
  onProviderUpdated?: (id: string, changes: { model?: string; label?: string }) => void;
  /** Called when authentication succeeds (before configure step). Parent should refresh providers. */
  onAuthCompleted?: (backend: string) => void;
  authBaseUrl?: string;
  className?: string;
}

type SettingsView = "list" | "add" | "edit";
type AddStep = "select-backend" | "auth" | "configure";
const BACKENDS: { id: RemoteAuthBackend; label: string }[] = [
  { id: "copilot", label: "GitHub Copilot" },
  { id: "claude", label: "Claude" },
  { id: "vercel-ai", label: "Vercel AI" },
];

/** Map of backend ID → auth form component. */
const AUTH_FORMS: Record<RemoteAuthBackend, AuthFormComponent> = {
  copilot: CopilotAuthForm,
  claude: ClaudeAuthForm,
  "vercel-ai": VercelAIAuthForm,
};

/**
 * Headless settings panel for managing providers.
 * States: list (all providers), add (new provider flow), edit (existing).
 */
export function ProviderSettings({
  providers,
  onClose,
  onProviderCreated,
  onProviderDeleted,
  onProviderUpdated,
  onAuthCompleted,
  authBaseUrl = "/api/auth",
  className,
}: ProviderSettingsProps): ReactNode {
  const [view, setView] = useState<SettingsView>("list");
  const [addStep, setAddStep] = useState<AddStep>("select-backend");
  const [selectedBackend, setSelectedBackend] = useState<RemoteAuthBackend>("copilot");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<{ id: string; name?: string }[]>([]);

  const modelRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const editModelRef = useRef<HTMLInputElement>(null);
  const editLabelRef = useRef<HTMLInputElement>(null);

  // Access runtime for model listing (ProviderSettings is always inside ChatProvider)
  const runtime = useChatRuntime();

  const auth = useRemoteAuth({
    backend: selectedBackend,
    baseUrl: authBaseUrl,
  });

  const handleBackendSelect = useCallback((backend: RemoteAuthBackend) => {
    setSelectedBackend(backend);
    auth.reset();
    setAddStep("auth");
  }, [auth]);

  const handleAuthComplete = useCallback(() => {
    // Notify parent to refresh providers — server may have auto-created one
    onAuthCompleted?.(selectedBackend);
    setAddStep("configure");
  }, [selectedBackend, onAuthCompleted]);

  // Fetch models when entering configure step or edit view
  useEffect(() => {
    if (addStep !== "configure" && view !== "edit") return;
    const load = async () => {
      try {
        const models = await runtime.listModels();
        setAvailableModels(models);
      } catch { /* models unavailable — user can type manually */ }
    };
    load();
  }, [addStep, view, runtime]);

  const handleCreate = useCallback(() => {
    const modelEl = modelRef.current as HTMLInputElement | HTMLSelectElement | null;
    const model = modelEl?.value?.trim();
    const label = labelRef.current?.value?.trim() || model;
    if (!model) return;
    // If server auto-created a provider for this backend, update it instead of creating duplicate
    const existing = providers.find(p => p.backend === selectedBackend);
    if (existing) {
      onProviderUpdated?.(existing.id, { model, label: label! });
    } else {
      onProviderCreated?.({ backend: selectedBackend, model, label: label! } as ProviderConfig);
    }
    setView("list");
    setAddStep("select-backend");
    setAvailableModels([]);
    auth.reset();
  }, [selectedBackend, providers, onProviderCreated, onProviderUpdated, auth]);

  const handleEdit = useCallback((id: string) => {
    setEditingId(id);
    setView("edit");
  }, []);

  const handleUpdate = useCallback(() => {
    if (!editingId) return;
    const modelEl = editModelRef.current as HTMLInputElement | HTMLSelectElement | null;
    const model = modelEl?.value?.trim();
    const label = editLabelRef.current?.value?.trim();
    if (!model && !label) return;
    const changes: { model?: string; label?: string } = {};
    if (model) changes.model = model;
    if (label) changes.label = label;
    onProviderUpdated?.(editingId, changes);
    setView("list");
    setEditingId(null);
  }, [editingId, onProviderUpdated]);

  const handleDelete = useCallback((id: string) => {
    onProviderDeleted?.(id);
  }, [onProviderDeleted]);

  const handleStartAdd = useCallback(() => {
    setView("add");
    setAddStep("select-backend");
    auth.reset();
  }, [auth]);

  // ─── List view ─────────────────────────────────────────────
  if (view === "list") {
    const items = providers.map((p) =>
      createElement(
        "div",
        { key: p.id, "data-provider-settings-item": "true" },
        createElement("span", { "data-provider-settings-label": "true" }, p.label),
        createElement("span", { "data-provider-settings-model": "true" }, `${p.backend} / ${p.model}`),
        createElement("div", { "data-provider-settings-actions": "true" },
          createElement("button", {
            type: "button",
            "data-action": "edit-provider",
            onClick: () => handleEdit(p.id),
          }, "Edit"),
          createElement("button", {
            type: "button",
            "data-action": "delete-provider",
            onClick: () => handleDelete(p.id),
          }, "Delete"),
        ),
      ),
    );

    return createElement(
      "div",
      { "data-provider-settings": "true", className },
      createElement("div", { "data-provider-settings-header": "true" },
        createElement("span", null, "Providers"),
        onClose
          ? createElement("button", {
              type: "button",
              "data-provider-settings-close": "true",
              onClick: onClose,
            }, "✕")
          : null,
      ),
      createElement("div", { "data-provider-settings-list": "true" },
        ...items,
        items.length === 0
          ? createElement("div", { "data-provider-settings-empty": "true" }, "No providers configured")
          : null,
      ),
      createElement("button", {
        type: "button",
        "data-action": "add-provider",
        onClick: handleStartAdd,
      }, "+ Add Provider"),
    );
  }

  // ─── Add view ──────────────────────────────────────────────
  if (view === "add") {
    const formChildren: ReactNode[] = [];

    formChildren.push(
      createElement("div", { "data-provider-settings-header": "true", key: "header" },
        createElement("span", null, "Add Provider"),
        createElement("button", {
          type: "button",
          "data-provider-settings-close": "true",
          onClick: () => { setView("list"); setAddStep("select-backend"); },
        }, "← Back"),
      ),
    );

    if (addStep === "select-backend") {
      formChildren.push(
        createElement("div", { key: "backends", "data-provider-settings-backends": "true" },
          ...BACKENDS.map((b) =>
            createElement("button", {
              key: b.id,
              type: "button",
              "data-provider-backend-option": b.id,
              onClick: () => handleBackendSelect(b.id),
            }, b.label),
          ),
        ),
      );
    } else if (addStep === "auth") {
      const FormComponent = selectedBackend ? AUTH_FORMS[selectedBackend] : null;
      formChildren.push(
        createElement("div", { key: "auth", "data-provider-settings-auth": "true" },
          FormComponent
            ? createElement(FormComponent, { auth, onAuthComplete: handleAuthComplete })
            : null,
        ),
      );
    } else if (addStep === "configure") {
      // Model selector: dropdown when models available, text input as fallback
      const modelInput = availableModels.length > 0
        ? createElement("select", {
            ref: modelRef as any,
            "data-input": "model",
            defaultValue: "",
          },
            createElement("option", { value: "", disabled: true }, "Select a model…"),
            ...availableModels.map((m) =>
              createElement("option", { key: m.id, value: m.id }, m.name || m.id),
            ),
          )
        : createElement("input", {
            ref: modelRef,
            placeholder: "Model name (e.g. gpt-5-mini)",
            "data-input": "model",
          });

      formChildren.push(
        createElement("div", { key: "config", "data-provider-settings-form": "true" },
          modelInput,
          createElement("input", {
            ref: labelRef,
            placeholder: "Display label (e.g. GPT-5 Mini)",
            "data-input": "label",
          }),
          createElement("button", {
            type: "button",
            "data-action": "save-provider",
            onClick: handleCreate,
          }, "Save Provider"),
        ),
      );
    }

    return createElement(
      "div",
      { "data-provider-settings": "true", className },
      ...formChildren,
    );
  }

  // ─── Edit view ─────────────────────────────────────────────
  const editingProvider = providers.find((p) => p.id === editingId);

  return createElement(
    "div",
    { "data-provider-settings": "true", className },
    createElement("div", { "data-provider-settings-header": "true" },
      createElement("span", null, "Edit Provider"),
      createElement("button", {
        type: "button",
        "data-provider-settings-close": "true",
        onClick: () => { setView("list"); setEditingId(null); },
      }, "← Back"),
    ),
    createElement("div", { "data-provider-settings-form": "true" },
      availableModels.length > 0
        ? createElement("select", {
            ref: editModelRef as any,
            defaultValue: editingProvider?.model ?? "",
            "data-input": "model",
          },
            createElement("option", { value: "", disabled: true }, "Select a model…"),
            ...availableModels.map((m) =>
              createElement("option", { key: m.id, value: m.id }, m.name || m.id),
            ),
          )
        : createElement("input", {
            ref: editModelRef,
            defaultValue: editingProvider?.model ?? "",
            placeholder: "Model name",
            "data-input": "model",
          }),
      createElement("input", {
        ref: editLabelRef,
        defaultValue: editingProvider?.label ?? "",
        placeholder: "Display label",
        "data-input": "label",
      }),
      createElement("button", {
        type: "button",
        "data-action": "update-provider",
        onClick: handleUpdate,
      }, "Update"),
    ),
  );
}
