import type { ReactNode } from "react";
import { useEffect, useState } from "react";

interface IconButtonProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  onClick?: () => void;
}

interface TextFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}

interface NumberFieldProps {
  label: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

interface ColorFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  disabled?: boolean;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

interface PanelSectionProps {
  title: string;
  children: ReactNode;
}

export function IconButton({
  label,
  icon,
  active = false,
  disabled = false,
  variant = "default",
  onClick,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      aria-pressed={active}
      data-variant={variant}
      disabled={disabled}
      title={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

export function TextField({ label, value, disabled = false, placeholder, onChange }: TextFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;

  if (min !== undefined) {
    next = Math.max(min, next);
  }

  if (max !== undefined) {
    next = Math.min(max, next);
  }

  return next;
}

function parseNumber(value: string, min?: number, max?: number): number | undefined {
  const next = Number(value);

  if (!Number.isFinite(next)) {
    return undefined;
  }

  return clamp(next, min, max);
}

export function NumberField({
  label,
  value,
  disabled = false,
  min,
  max,
  step = 1,
  onChange,
}: NumberFieldProps) {
  const [textValue, setTextValue] = useState(Number.isFinite(value) ? String(value) : "");

  useEffect(() => {
    setTextValue(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={textValue}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = event.target.value;
          const parsed = parseNumber(nextValue, min, max);

          setTextValue(nextValue);

          if (parsed !== undefined) {
            onChange(parsed);
          }
        }}
      />
    </label>
  );
}

export function normalizeHexColor(value: string): string | undefined {
  const raw = value.trim();
  const shortHex = /^#([0-9a-fA-F]{3})$/;
  const fullHex = /^#([0-9a-fA-F]{6})$/;
  const shortMatch = raw.match(shortHex);
  const fullMatch = raw.match(fullHex);

  if (shortMatch) {
    return `#${shortMatch[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }

  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }

  return undefined;
}

export function ColorField({ label, value, disabled = false, onChange }: ColorFieldProps) {
  const [textValue, setTextValue] = useState(value);

  useEffect(() => {
    setTextValue(value);
  }, [value]);

  return (
    <label className="field color-field">
      <span>{label}</span>
      <span className="color-input">
        <span className="color-swatch" style={{ background: normalizeHexColor(value) ?? value }} aria-hidden="true" />
        <input
          type="text"
          value={textValue}
          disabled={disabled}
          inputMode="text"
          spellCheck={false}
          onChange={(event) => {
            const nextValue = event.target.value;
            const normalized = normalizeHexColor(nextValue);

            setTextValue(nextValue);

            if (normalized) {
              onChange(normalized);
            }
          }}
        />
      </span>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  disabled = false,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({ label, checked, disabled = false, onChange }: CheckboxFieldProps) {
  return (
    <label className="check-field">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function PanelSection({ title, children }: PanelSectionProps) {
  return (
    <section className="panel-section">
      <h3>{title}</h3>
      <div className="field-stack">{children}</div>
    </section>
  );
}
