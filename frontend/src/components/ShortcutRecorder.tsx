interface ShortcutRecorderProps {
  value: string;
  onChange(value: string): void;
}

export function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const record = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (event.nativeEvent.isComposing || ["Control", "Shift", "Alt", "Meta", "Dead", "Process"].includes(event.key)) return;
    const parts = [
      event.ctrlKey && "Ctrl",
      event.shiftKey && "Shift",
      event.altKey && "Alt",
      event.metaKey && "Win",
      event.key === " " ? "Space" : event.key === "+" ? "Plus" : event.key.length === 1 ? event.key.toUpperCase() : event.key,
    ].filter(Boolean);
    onChange(parts.join("+"));
  };

  return (
    <label className="field-stack">
      <span>快捷键</span>
      <input
        aria-label="自定义快捷键"
        value={value}
        placeholder="点击这里，然后按下组合键"
        readOnly
        onKeyDown={record}
      />
      <small>点击输入框后按下组合键，修改即生效。</small>
    </label>
  );
}
