"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

export type DeleteAccountModalProps = {
  open: boolean;
  lang: Locale;
  onClose: () => void;
  onDeleted?: () => void;
};

export async function executeDeleteAccount({
  lang,
  confirmationInput,
  fetchFn = fetch,
  router,
  onDeleted,
}: {
  lang: Locale;
  confirmationInput: string;
  fetchFn?: typeof fetch;
  router: { push: (url: string) => void; refresh: () => void };
  onDeleted?: () => void;
}): Promise<{ ok: boolean; error?: string }> {
  const confirmWord = t(lang, "settings.confirm_word");
  if (confirmationInput.trim() !== confirmWord) {
    return { ok: false, error: "word_mismatch" };
  }

  try {
    const res = await fetchFn("/api/account", { method: "DELETE" });
    if (res.status === 204 || res.ok) {
      onDeleted?.();
      router.push(`/${lang}`);
      router.refresh();
      return { ok: true };
    }
    return { ok: false, error: t(lang, "settings.delete_failed") };
  } catch {
    return { ok: false, error: t(lang, "settings.delete_failed") };
  }
}

export function DeleteAccountModal({ open, lang, onClose, onDeleted }: DeleteAccountModalProps) {
  const router = useRouter();
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  const confirmWord = t(lang, "settings.confirm_word");
  const isWordMatched = confirmationInput.trim() === confirmWord;

  const handleClose = useCallback(() => {
    if (isDeleting) return;
    setConfirmationInput("");
    setErrorMessage(null);
    onClose();
  }, [isDeleting, onClose]);

  useEffect(() => {
    if (!open) return;

    if (typeof document !== "undefined") {
      lastActiveElementRef.current = document.activeElement as HTMLElement | null;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const timer = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });

      return () => {
        cancelAnimationFrame(timer);
        document.body.style.overflow = prevOverflow;
        lastActiveElementRef.current?.focus();
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!isDeleting) {
          event.preventDefault();
          handleClose();
        }
        return;
      }

      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isDeleting, handleClose]);

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isWordMatched || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);

    const result = await executeDeleteAccount({
      lang,
      confirmationInput,
      fetchFn: fetch,
      router,
      onDeleted,
    });

    if (!result.ok && result.error && result.error !== "word_mismatch") {
      setErrorMessage(result.error);
      setIsDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-dialog-title"
        aria-describedby="delete-account-dialog-description"
        className="w-full max-w-md rounded-md border border-rule bg-bg p-6 text-ink shadow-lg"
      >
        <h2 id="delete-account-dialog-title" className="text-lg font-semibold text-ink">
          {t(lang, "settings.delete_modal_title")}
        </h2>
        <p
          id="delete-account-dialog-description"
          className="mt-2 text-sm text-ink-2 leading-relaxed"
        >
          {t(lang, "settings.danger_desc")}
        </p>

        <form onSubmit={handleDelete} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-delete-input" className="text-sm font-medium text-ink">
              {t(lang, "settings.type_confirm").replace("{word}", confirmWord)}
            </label>
            <input
              ref={inputRef}
              id="confirm-delete-input"
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              disabled={isDeleting}
              autoComplete="off"
              spellCheck={false}
              placeholder={confirmWord}
              className="min-h-11 w-full rounded-sm border border-rule bg-surface px-3 py-2 font-mono text-sm uppercase text-ink placeholder:text-ink-2/50 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
            />
          </div>

          {errorMessage && (
            <p role="alert" className="text-sm text-finding-attention">
              {errorMessage}
            </p>
          )}

          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={handleClose}
              disabled={isDeleting}
              className="inline-flex min-h-11 items-center justify-center rounded-sm border border-rule bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
            >
              {t(lang, "common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!isWordMatched || isDeleting}
              className="inline-flex min-h-11 items-center justify-center rounded-sm bg-finding-attention px-4 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-finding-attention disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? t(lang, "settings.deleting") : t(lang, "settings.delete_account")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
