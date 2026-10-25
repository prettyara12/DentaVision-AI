"use client";

import { useRef, useState } from "react";
import { t, type Locale, type MessageKey } from "@/lib/i18n";
import { samples, type SampleKey } from "./samples";
import { ACCEPTED_TYPES } from "./upload";

type Props = {
  lang: Locale;
  problem: MessageKey | null;
  onFile: (file: File) => void;
  onSample: (key: SampleKey) => void;
};

export function Dropzone({ lang, problem, onFile, onSample }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col gap-6">
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
      <section aria-labelledby="samples-title" className="flex flex-col gap-3">
        <h2 id="samples-title" className="font-mono text-xs tracking-[0.06em] text-ink-2 uppercase">
          {t(lang, "sample.title")}
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:gap-3">
          {samples.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSample(s.key)}
                className="flex w-full flex-col gap-2 rounded-sm border border-rule bg-surface p-1.5 text-left text-xs transition-colors duration-[120ms] hover:border-accent sm:text-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- small static thumbnail */}
                <img
                  src={`/samples/${s.key}-thumb.jpg`}
                  alt=""
                  width={480}
                  height={237}
                  loading="lazy"
                  className="aspect-[2/1] w-full rounded-[2px] bg-black object-cover"
                />
                <span className="min-h-8 px-1">{s.label[lang]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
