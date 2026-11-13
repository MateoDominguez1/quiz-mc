"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl p-0 shadow-2xl backdrop:bg-black/50"
      aria-labelledby="confirm-title"
    >
      <div className="p-6">
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-red-50 text-mc-red">
          <TriangleAlert className="size-6" aria-hidden />
        </div>
        <h2 id="confirm-title" className="text-xl font-black text-ink">
          {title}
        </h2>
        <p className="mt-2 text-[15px] text-ink-soft">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-12 rounded-2xl bg-neutral-100 px-5 font-black text-ink hover:bg-neutral-200"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-mc-red px-5 font-black text-white disabled:opacity-70"
          >
            {loading && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
