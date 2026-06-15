"use client";

import {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  useEffect,
  useRef,
  useState
} from "react";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

function formatIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return "";
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatTypedDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDisplayDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function DateInput({
  className = "",
  disabled,
  onChange,
  placeholder = "dd/mm/aaaa",
  required,
  style,
  value,
  ...props
}: DateInputProps) {
  const [displayValue, setDisplayValue] = useState(formatIsoDate(value));
  const [isFocused, setIsFocused] = useState(false);
  const calendarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatIsoDate(value));
    }
  }, [isFocused, value]);

  function setValidity(input: HTMLInputElement, nextValue: string) {
    const isEmpty = nextValue.length === 0;
    const isComplete = nextValue.length === 10;
    const isValid = isComplete && parseDisplayDate(nextValue);

    input.setCustomValidity(isEmpty || isValid ? "" : "Usá el formato dd/mm/aaaa.");
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDisplayValue = formatTypedDate(event.target.value);
    setDisplayValue(nextDisplayValue);
    setValidity(event.target, nextDisplayValue);

    if (!nextDisplayValue) {
      onChange("");
      return;
    }

    const nextIsoValue = parseDisplayDate(nextDisplayValue);

    if (nextIsoValue) {
      onChange(nextIsoValue);
      return;
    }

    onChange("");
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setIsFocused(false);
    setValidity(event.target, displayValue);
  }

  function handleCalendarChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
    setDisplayValue(formatIsoDate(event.target.value));
  }

  function openCalendar() {
    if (disabled) {
      return;
    }

    calendarInputRef.current?.showPicker?.();
    calendarInputRef.current?.focus();
  }

  return (
    <div className="relative w-full">
      <input
        {...props}
        className={`w-full ${className}`}
        disabled={disabled}
        inputMode="numeric"
        onBlur={handleBlur}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        pattern="\d{2}/\d{2}/\d{4}"
        placeholder={placeholder}
        required={required}
        style={{ ...style, paddingRight: "2.75rem" }}
        type="text"
        value={displayValue}
      />
      <button
        aria-label="Abrir calendario"
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-800 hover:text-stone-100 disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        onClick={openCalendar}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <path d="M3 10h18" />
          <rect height="18" rx="2" width="18" x="3" y="4" />
        </svg>
      </button>
      <input
        aria-hidden="true"
        className="sr-only"
        disabled={disabled}
        onChange={handleCalendarChange}
        ref={calendarInputRef}
        tabIndex={-1}
        type="date"
        value={value}
      />
    </div>
  );
}
