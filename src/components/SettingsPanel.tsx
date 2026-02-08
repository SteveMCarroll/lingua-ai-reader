interface Props {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  isDark: boolean;
  onToggleDark: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ fontSize, onFontSizeChange, isDark, onToggleDark, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed right-4 top-14 z-40 w-64 rounded-xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900">
        <h3 className="mb-3 text-sm font-semibold text-stone-500 uppercase tracking-wider">Settings</h3>

        {/* Font size */}
        <div className="mb-4">
          <label className="mb-1.5 flex items-center justify-between text-sm text-stone-700 dark:text-stone-300">
            Font Size
            <span className="font-mono text-xs text-stone-500">{fontSize}px</span>
          </label>
          <input
            type="range"
            min={14}
            max={28}
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Dark mode */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-700 dark:text-stone-300">Dark Mode</span>
          <button
            onClick={onToggleDark}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isDark ? "bg-blue-500" : "bg-stone-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                isDark ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </>
  );
}
