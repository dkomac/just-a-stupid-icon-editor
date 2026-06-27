import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

interface IconButtonProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  onClick?: () => void;
}

type CommitMode = "blur" | "change";

interface TextFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  commitOn?: CommitMode;
  onChange: (value: string) => void;
}

interface NumberFieldProps {
  label: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  commitOn?: CommitMode;
  onChange: (value: number) => void;
}

interface SliderFieldProps {
  label: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

interface ColorFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  commitOn?: CommitMode;
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
  active,
  pressed,
  disabled = false,
  variant = "default",
  onClick,
}: IconButtonProps) {
  const isActive = active ?? pressed ?? false;
  const pressedProps = pressed === undefined ? {} : { "aria-pressed": pressed };

  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      {...pressedProps}
      data-variant={variant}
      data-active={isActive}
      disabled={disabled}
      title={label}
      onClick={onClick}
    >
      <span className="icon-button-icon" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

export function TextField({
  label,
  value,
  disabled = false,
  placeholder,
  commitOn = "blur",
  onChange,
}: TextFieldProps) {
  const [textValue, setTextValue] = useState(value);
  const skipNextBlurCommit = useRef(false);

  useEffect(() => {
    setTextValue(value);
  }, [value]);

  function commit(nextValue = textValue) {
    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        value={textValue}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          const nextValue = event.target.value;
          setTextValue(nextValue);

          if (commitOn === "change") {
            onChange(nextValue);
          }
        }}
        onBlur={() => {
          if (skipNextBlurCommit.current) {
            skipNextBlurCommit.current = false;
            return;
          }

          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            skipNextBlurCommit.current = true;
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          }
        }}
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
  if (value.trim() === "") {
    return undefined;
  }

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
  commitOn = "blur",
  onChange,
}: NumberFieldProps) {
  const [textValue, setTextValue] = useState(Number.isFinite(value) ? String(value) : "");
  const skipNextBlurCommit = useRef(false);

  useEffect(() => {
    setTextValue(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  function commit(rawValue = textValue) {
    const parsed = parseNumber(rawValue, min, max);

    if (parsed === undefined) {
      setTextValue(Number.isFinite(value) ? String(value) : "");
      return;
    }

    setTextValue(String(parsed));

    if (parsed !== value) {
      onChange(parsed);
    }
  }

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        value={textValue}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = event.target.value;

          setTextValue(nextValue);

          if (commitOn === "change") {
            const parsed = parseNumber(nextValue, min, max);
            if (parsed === undefined) {
              return;
            }
            onChange(parsed);
          }
        }}
        onBlur={() => {
          if (skipNextBlurCommit.current) {
            skipNextBlurCommit.current = false;
            return;
          }

          commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            skipNextBlurCommit.current = true;
            commit(event.currentTarget.value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function SliderField({
  label,
  value,
  disabled = false,
  min = 0,
  max = 40,
  step = 1,
  suffix = "",
  onChange,
}: SliderFieldProps) {
  const safeValue = Number.isFinite(value) ? clamp(value, min, max) : min;

  return (
    <label className="field slider-field">
      <span className="field-label">{label}</span>
      <span className="slider-input">
        <input
          type="range"
          value={safeValue}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
        />
        <span className="slider-value" aria-hidden="true">
          {safeValue}
          {suffix}
        </span>
      </span>
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

export function ColorField({ label, value, disabled = false, commitOn = "blur", onChange }: ColorFieldProps) {
  const inputId = useId();
  const [textValue, setTextValue] = useState(value);
  const skipNextBlurCommit = useRef(false);
  const pickerValue = normalizeHexColor(value) ?? "#000000";

  useEffect(() => {
    setTextValue(value);
  }, [value]);

  function commit(rawValue = textValue) {
    const normalized = normalizeHexColor(rawValue);

    if (!normalized) {
      setTextValue(value);
      return;
    }

    setTextValue(normalized);

    if (normalized !== value) {
      onChange(normalized);
    }
  }

  return (
    <div className="field color-field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <span className="color-input">
        <input
          className="color-picker"
          type="color"
          value={pickerValue}
          disabled={disabled}
          aria-label={`${label} picker`}
          title={`${label} picker`}
          onChange={(event) => {
            const nextValue = event.target.value.toLowerCase();

            setTextValue(nextValue);
            onChange(nextValue);
          }}
        />
        <input
          id={inputId}
          className="color-text-input"
          type="text"
          value={textValue}
          disabled={disabled}
          inputMode="text"
          spellCheck={false}
          onChange={(event) => {
            const nextValue = event.target.value;

            setTextValue(nextValue);

            if (commitOn === "change") {
              const normalized = normalizeHexColor(nextValue);
              if (!normalized) {
                return;
              }
              onChange(normalized);
            }
          }}
          onBlur={() => {
            if (skipNextBlurCommit.current) {
              skipNextBlurCommit.current = false;
              return;
            }

            commit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              skipNextBlurCommit.current = true;
              commit(event.currentTarget.value);
              event.currentTarget.blur();
            }
          }}
        />
      </span>
    </div>
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
      <span className="field-label">{label}</span>
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
