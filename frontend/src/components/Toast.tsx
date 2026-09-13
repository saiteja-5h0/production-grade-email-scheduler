type Props = {
  message: string;
  tone?: "info" | "success" | "error";
  onDismiss: () => void;
};

const tones = {
  info: "bg-slate-800 text-white",
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white",
};

export function Toast({ message, tone = "info", onDismiss }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className={`flex items-center gap-4 rounded-lg px-5 py-3 text-sm shadow-lg ${tones[tone]}`}>
        <span>{message}</span>
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
