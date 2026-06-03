"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";

type Country = {
  code: string;
  flag: string;
};

const COUNTRIES: Country[] = [
  { code: "54", flag: "🇦🇷" },
  { code: "55", flag: "🇧🇷" },
  { code: "56", flag: "🇨🇱" },
  { code: "595", flag: "🇵🇾" },
  { code: "598", flag: "🇺🇾" },
];

const AR_CODE = "54";
const AR_TOTAL = 10;

function digitsOnly(v: string) {
  return v.replace(/\D/g, "");
}

function parsePhone(stored: string): { country: string; area: string; local: string } {
  const d = digitsOnly(stored);

  if (d.startsWith(AR_CODE)) {
    let rest = d.slice(AR_CODE.length);
    // Strip leading 9 if present (WhatsApp format: 549XXXXXXXXXX = 11 digits after "54")
    if (rest.startsWith("9") && rest.length === 11) rest = rest.slice(1);
    return { country: AR_CODE, area: rest.slice(0, 2), local: rest.slice(2) };
  }

  for (const { code } of COUNTRIES) {
    if (d.startsWith(code)) {
      return { country: code, area: "", local: d.slice(code.length) };
    }
  }

  return { country: AR_CODE, area: d.slice(0, 2), local: d.slice(2) };
}

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
  className?: string;
};

export function PhoneInput({ value, onChange, required, label = "WhatsApp", className }: PhoneInputProps) {
  const { country: c0, area: a0, local: l0 } = parsePhone(value);
  const [country, setCountry] = useState(c0);
  const [area, setArea] = useState(a0);
  const [local, setLocal] = useState(l0);

  const prevValueRef = useRef(value);
  const localRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      const p = parsePhone(value);
      setCountry(p.country);
      setArea(p.area);
      setLocal(p.local);
    }
  }, [value]);

  const isAR = country === AR_CODE;
  const localMax = isAR ? AR_TOTAL - area.length : 15;

  function emit(c: string, a: string, l: string) {
    const v = `${c}${a}${l}`;
    prevValueRef.current = v;
    onChange(v);
  }

  function handleCountryChange(newCode: string) {
    setCountry(newCode);
    setArea("");
    setLocal("");
    emit(newCode, "", "");
  }

  function handleAreaChange(raw: string) {
    const digits = digitsOnly(raw).slice(0, 4);
    const newLocalMax = AR_TOTAL - digits.length;
    const trimmedLocal = local.slice(0, newLocalMax);
    setArea(digits);
    if (trimmedLocal !== local) setLocal(trimmedLocal);
    emit(country, digits, trimmedLocal);
  }

  function handleAreaKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const hasSelection = e.currentTarget.selectionStart !== e.currentTarget.selectionEnd;
    if (!hasSelection && area.length >= 4 && /^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      localRef.current?.focus();
    }
  }

  function handleLocalChange(raw: string) {
    const digits = digitsOnly(raw).slice(0, Math.max(0, localMax));
    setLocal(digits);
    emit(country, area, digits);
  }

  const base =
    "h-11 rounded-xl border border-stone-700 bg-stone-950 px-3 text-stone-100 outline-none focus:border-emerald-400 text-sm";

  const areaPlaceholder = "11";
  const localPlaceholder =
    area.length === 3 ? "000 0000"
    : area.length === 4 ? "00 0000"
    : "0000 0000";

  return (
    <label className={`grid gap-2 text-sm text-stone-300${className ? ` ${className}` : ""}`}>
      {label}
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <select
            value={country}
            onChange={(e) => handleCountryChange(e.target.value)}
            aria-label="Código de país"
            className={`${base} w-24 cursor-pointer appearance-none pl-3 pr-7`}
          >
            {COUNTRIES.map(({ code, flag }) => (
              <option key={code} value={code}>
                {flag} +{code}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">
            ▾
          </span>
        </div>

        {isAR ? (
          <>
            <input
              type="text"
              inputMode="numeric"
              placeholder={areaPlaceholder}
              value={area}
              onChange={(e) => handleAreaChange(e.target.value)}
              onKeyDown={handleAreaKeyDown}
              maxLength={4}
              required={required}
              aria-label="Código de área"
              className={`${base} w-16 text-center`}
            />
            <input
              ref={localRef}
              type="text"
              inputMode="numeric"
              placeholder={localPlaceholder}
              value={local}
              onChange={(e) => handleLocalChange(e.target.value)}
              maxLength={Math.max(0, localMax)}
              required={required}
              aria-label="Número local"
              className={`${base} flex-1`}
            />
          </>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            placeholder="Número"
            value={local}
            onChange={(e) => {
              const digits = digitsOnly(e.target.value).slice(0, 15);
              setLocal(digits);
              emit(country, "", digits);
            }}
            required={required}
            aria-label="Número de teléfono"
            className={`${base} flex-1`}
          />
        )}
      </div>
    </label>
  );
}
