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

function splitArgentinaPhone(rest: string) {
  const national = rest.startsWith("9") && rest.length === 11 ? rest.slice(1) : rest;

  if (national.startsWith("11")) {
    return { area: national.slice(0, 2), local: national.slice(2) };
  }

  if (national.length === 10) {
    return { area: national.slice(0, 4), local: national.slice(4) };
  }

  if (national.length === 9) {
    return { area: national.slice(0, 3), local: national.slice(3) };
  }

  return { area: national.slice(0, 2), local: national.slice(2) };
}

function parsePhone(stored: string): { country: string; area: string; local: string } {
  const d = digitsOnly(stored);

  if (d.startsWith(AR_CODE)) {
    const rest = d.slice(AR_CODE.length);
    const parsed = splitArgentinaPhone(rest);
    return { country: AR_CODE, area: parsed.area, local: parsed.local };
  }

  for (const { code } of COUNTRIES) {
    if (d.startsWith(code)) {
      return { country: code, area: "", local: d.slice(code.length) };
    }
  }

  const parsed = splitArgentinaPhone(d);
  return { country: AR_CODE, area: parsed.area, local: parsed.local };
}

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
  className?: string;
  name?: string;
};

function formatLocalDisplay(area: string, local: string) {
  if (!local) return "";

  if (area.length <= 2) {
    return local.length <= 4 ? local : `${local.slice(0, 4)} ${local.slice(4, 8)}`;
  }

  if (area.length === 3) {
    return local.length <= 3 ? local : `${local.slice(0, 3)} ${local.slice(3, 7)}`;
  }

  return local.length <= 2 ? local : `${local.slice(0, 2)} ${local.slice(2, 6)}`;
}

export function PhoneInput({ value, onChange, required, label = "WhatsApp", className, name }: PhoneInputProps) {
  const { country: c0, area: a0, local: l0 } = parsePhone(value);
  const [country, setCountry] = useState(c0);
  const [area, setArea] = useState(a0);
  const [local, setLocal] = useState(l0);
  const [triedLeadingNine, setTriedLeadingNine] = useState(false);

  const prevValueRef = useRef(value);
  const localRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      const p = parsePhone(value);
      setCountry(p.country);
      setArea(p.area);
      setLocal(p.local);
      setTriedLeadingNine(false);
    }
  }, [value]);

  const isAR = country === AR_CODE;
  const localMax = isAR ? AR_TOTAL - area.length : 15;

  function emit(c: string, a: string, l: string) {
    const v = c === AR_CODE ? `549${a}${l}` : `${c}${a}${l}`;
    prevValueRef.current = v;
    onChange(v);
  }

  function handleCountryChange(newCode: string) {
    setTriedLeadingNine(false);
    setCountry(newCode);
    setArea("");
    setLocal("");
    emit(newCode, "", "");
  }

  function handleAreaChange(raw: string) {
    const digits = digitsOnly(raw).slice(0, 4);
    const sanitizedArea = digits.startsWith("9") ? digits.slice(1) : digits;
    setTriedLeadingNine(digits.startsWith("9"));
    const newLocalMax = AR_TOTAL - sanitizedArea.length;
    const trimmedLocal = local.slice(0, newLocalMax);
    setArea(sanitizedArea);
    if (trimmedLocal !== local) setLocal(trimmedLocal);
    emit(country, sanitizedArea, trimmedLocal);
  }

  function handleAreaKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const hasSelection = e.currentTarget.selectionStart !== e.currentTarget.selectionEnd;
    if (!hasSelection && area.length >= 4 && /^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      localRef.current?.focus();
    }
  }

  function handleLocalChange(raw: string) {
    setTriedLeadingNine(false);
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
      {name ? <input type="hidden" name={name} value={value} /> : null}
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
              className={`${base} w-16 text-center${triedLeadingNine ? " border-rose-500 focus:border-rose-400" : ""}`}
            />
            <input
              ref={localRef}
              type="text"
              inputMode="numeric"
              placeholder={localPlaceholder}
              value={formatLocalDisplay(area, local)}
              onChange={(e) => handleLocalChange(e.target.value)}
              maxLength={Math.max(0, localMax) + 1}
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
      {isAR ? (
        <p className={`text-xs ${triedLeadingNine ? "text-rose-300" : "text-stone-500"}`}>
          {triedLeadingNine
            ? "El código de área no puede empezar con 9. No lo escribas: lo agregamos automáticamente al guardar."
            : "No escribas el 9. Lo agregamos automáticamente al guardar en WhatsApp."}
        </p>
      ) : null}
    </label>
  );
}
