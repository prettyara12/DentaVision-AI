"use client";

import { useRef, useState } from "react";
import { t, type Locale, type MessageKey } from "@/lib/i18n";
import { ACCEPTED_TYPES } from "./upload";

type Props = {
  lang: Locale;
  problem: MessageKey | null;
  onFile: (file: File) => void;
};

export function Dropzone({ lang, problem, onFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      data-state={dragging ? "dragover" : problem ? "invalid" : "idle"}
      className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-rule bg-surface px-4 py-10 text-center transition-colors duration-[120ms] data-[state=dragover]:border-accent data-[state=dragover]:bg-surface-2 data-[state=invalid]:border-finding-attention"
    >
      {/* No `capture` attribute: phones then offer both camera and gallery. */}
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="min-h-11 rounded-sm bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity duration-[120ms] hover:opacity-90"
      >
        {t(lang, "drop.choose")}
      </button>
      <p className="text-sm text-ink-2">{t(lang, dragging ? "drop.release" : "drop.hint")}</p>
      {problem && (
        <p role="alert" className="max-w-md text-sm text-finding-attention">
          {t(lang, problem)}
        </p>
      )}
    </div>
  );
}
