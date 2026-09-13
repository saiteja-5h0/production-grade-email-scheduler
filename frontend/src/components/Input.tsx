import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldWrapperProps = { label: string; children: React.ReactNode };

function FieldWrapper({ label, children }: FieldWrapperProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <FieldWrapper label={label}>
      <input
        className={`w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 ${className}`}
        {...props}
      />
    </FieldWrapper>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label}>
      <textarea
        className={`w-full resize-none rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 ${className}`}
        {...props}
      />
    </FieldWrapper>
  );
}
