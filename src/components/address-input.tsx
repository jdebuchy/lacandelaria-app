"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  StructuredAddress,
  addressLine2Label,
  formatStructuredAddressSummary
} from "@/lib/address";

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
};

type AddressInputProps = {
  value: StructuredAddress;
  onChange: (value: StructuredAddress) => void;
  required?: boolean;
  className?: string;
  afterPostalCode?: ReactNode;
};

const ADDRESS_AUTOCOMPLETE = "new-password";

function buildSearchValue(address: StructuredAddress) {
  return address.googlePlaceLabel || formatStructuredAddressSummary(address).replace(/ · /g, ", ").replace(/^-$/, "");
}

export function AddressInput({ value, onChange, required, className, afterPostalCode }: AddressInputProps) {
  const [query, setQuery] = useState(buildSearchValue(value));
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [message, setMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setQuery(buildSearchValue(value));
  }, [value.googlePlaceLabel, value.gatedCommunityName, value.addressLine1, value.locality]);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as { suggestions: Suggestion[] };
        setSuggestions(data.suggestions ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
        }
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  function setField<K extends keyof StructuredAddress>(key: K, nextValue: StructuredAddress[K]) {
    onChange({
      ...value,
      [key]: nextValue
    });
  }

  async function applySuggestion(suggestion: Suggestion) {
    setLoadingDetails(true);
    setMessage("");

    try {
      const response = await fetch(`/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}`);
      const payload = (await response.json()) as {
        success: boolean;
        message?: string;
        place?: {
          suggestedAddressKind: StructuredAddress["addressKind"];
          displayLabel: string;
          gatedCommunityName: string;
          addressLine1: string;
          locality: string;
          administrativeAreaLevel1: string;
          postalCode: string;
          googlePlaceId: string;
        };
      };

      if (!response.ok || !payload.success || !payload.place) {
        setMessage(payload.message ?? "No se pudo completar la dirección sugerida.");
        return;
      }

      onChange({
        ...value,
        addressKind: payload.place.suggestedAddressKind,
        addressLine1: payload.place.addressLine1,
        gatedCommunityName: payload.place.gatedCommunityName,
        locality: payload.place.locality,
        administrativeAreaLevel1: payload.place.administrativeAreaLevel1,
        postalCode: payload.place.postalCode,
        googlePlaceId: payload.place.googlePlaceId,
        googlePlaceLabel: payload.place.displayLabel,
        addressSource: "google_places"
      });
      setQuery(payload.place.displayLabel);
      setSuggestions([]);
      setShowSuggestions(false);
    } catch {
      setMessage("No se pudo completar la dirección sugerida.");
    } finally {
      setLoadingDetails(false);
    }
  }

  const inputClass =
    "h-11 rounded-xl border border-stone-700 bg-stone-950 px-4 text-sm text-stone-100 outline-none focus:border-emerald-400";
  const textareaClass =
    "rounded-xl border border-stone-700 bg-stone-950 px-4 py-3 text-sm text-stone-100 outline-none focus:border-emerald-400";

  return (
    <div className={`grid gap-3 md:grid-cols-6${className ? ` ${className}` : ""}`}>
      <div className="relative grid gap-2 md:col-span-6">
        <label className="text-sm text-stone-300">Buscar dirección</label>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowSuggestions(true);
            setMessage("");
          }}
          onFocus={() => setShowSuggestions(true)}
          autoComplete={ADDRESS_AUTOCOMPLETE}
          data-form-type="other"
          data-lpignore="true"
          spellCheck={false}
          placeholder="Busca una calle, edificio o barrio cerrado"
          className={inputClass}
        />
        <p className="text-xs text-stone-500">
          Puedes elegir una sugerencia de Google o completar la dirección manualmente si no aparece.
        </p>
        {(showSuggestions && (searching || suggestions.length > 0)) ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-stone-800 bg-stone-950/95 p-2 shadow-2xl shadow-black/40">
            {searching ? (
              <p className="px-3 py-2 text-sm text-stone-500">Buscando sugerencias...</p>
            ) : (
              suggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  onClick={() => applySuggestion(suggestion)}
                  className="flex w-full flex-col rounded-xl px-3 py-3 text-left transition hover:bg-stone-900"
                >
                  <span className="text-sm font-medium text-stone-100">{suggestion.mainText}</span>
                  {suggestion.secondaryText ? (
                    <span className="mt-1 text-xs text-stone-400">{suggestion.secondaryText}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        ) : null}
        {message ? <p className="text-xs text-amber-300">{message}</p> : null}
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-stone-800 bg-stone-950/70 px-4 py-3 text-sm text-stone-300 md:col-span-6">
        <input
          type="checkbox"
          checked={value.addressKind === "gated"}
          onChange={(event) => setField("addressKind", event.target.checked ? "gated" : "standard")}
          className="h-4 w-4 rounded border-stone-700 bg-stone-950 text-emerald-500 focus:ring-emerald-400"
        />
        ¿Barrio cerrado / privado?
      </label>

      {value.addressKind === "gated" ? (
        <div className="grid gap-3 md:col-span-6 md:grid-cols-4">
          <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
            Dirección
            <input
              required={required}
              value={value.addressLine1}
              onChange={(event) => setField("addressLine1", event.target.value)}
              autoComplete={ADDRESS_AUTOCOMPLETE}
              data-form-type="other"
              data-lpignore="true"
              spellCheck={false}
              className={inputClass}
              placeholder="Ej: Ruta Nacional 8 Km 41.5"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300 md:col-span-2">
            Nombre del barrio
            <input
              required={required}
              value={value.gatedCommunityName}
              onChange={(event) => setField("gatedCommunityName", event.target.value)}
              autoComplete={ADDRESS_AUTOCOMPLETE}
              data-form-type="other"
              data-lpignore="true"
              spellCheck={false}
              className={inputClass}
              placeholder="Ej: Golf Club Argentino"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            {addressLine2Label(value.addressKind)}
            <input
              value={value.addressLine2}
              onChange={(event) => setField("addressLine2", event.target.value)}
              autoComplete={ADDRESS_AUTOCOMPLETE}
              data-form-type="other"
              data-lpignore="true"
              spellCheck={false}
              className={inputClass}
              placeholder="Ej: Lote 12"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Localidad
            <input
              required={required}
              value={value.locality}
              onChange={(event) => setField("locality", event.target.value)}
              autoComplete={ADDRESS_AUTOCOMPLETE}
              data-form-type="other"
              data-lpignore="true"
              spellCheck={false}
              className={inputClass}
              placeholder="Ej: CABA"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Provincia
            <input
              required={required}
              value={value.administrativeAreaLevel1}
              onChange={(event) => setField("administrativeAreaLevel1", event.target.value)}
              autoComplete={ADDRESS_AUTOCOMPLETE}
              data-form-type="other"
              data-lpignore="true"
              spellCheck={false}
              className={inputClass}
              placeholder="Ej: Cdad. Autónoma de Buenos Aires"
            />
          </label>

          <label className="grid gap-2 text-sm text-stone-300">
            Código postal
            <input
              required={required}
              value={value.postalCode}
              onChange={(event) => setField("postalCode", event.target.value)}
              autoComplete={ADDRESS_AUTOCOMPLETE}
              data-form-type="other"
              data-lpignore="true"
              spellCheck={false}
              className={inputClass}
              placeholder="Ej: C1425"
            />
          </label>

          {afterPostalCode ? <div className="grid gap-2 text-sm text-stone-300">{afterPostalCode}</div> : null}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:col-span-6 md:grid-cols-3">
            <label className="grid gap-2 text-sm text-stone-300">
              Dirección
              <input
                required={required}
                value={value.addressLine1}
                onChange={(event) => setField("addressLine1", event.target.value)}
                autoComplete={ADDRESS_AUTOCOMPLETE}
                data-form-type="other"
                data-lpignore="true"
                spellCheck={false}
                className={inputClass}
                placeholder="Ej: Av. Gral. Las Heras 4025"
              />
            </label>

            <label className="grid gap-2 text-sm text-stone-300">
              {addressLine2Label(value.addressKind)}
              <input
                value={value.addressLine2}
                onChange={(event) => setField("addressLine2", event.target.value)}
                autoComplete={ADDRESS_AUTOCOMPLETE}
                data-form-type="other"
                data-lpignore="true"
                spellCheck={false}
                className={inputClass}
                placeholder="Ej: 4B"
              />
            </label>

            <label className="grid gap-2 text-sm text-stone-300">
              Localidad
              <input
                required={required}
                value={value.locality}
                onChange={(event) => setField("locality", event.target.value)}
                autoComplete={ADDRESS_AUTOCOMPLETE}
                data-form-type="other"
                data-lpignore="true"
                spellCheck={false}
                className={inputClass}
                placeholder="Ej: CABA"
              />
            </label>
          </div>

          <div className={`grid gap-3 md:col-span-6 ${afterPostalCode ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <label className="grid gap-2 text-sm text-stone-300">
              Provincia
              <input
                required={required}
                value={value.administrativeAreaLevel1}
                onChange={(event) => setField("administrativeAreaLevel1", event.target.value)}
                autoComplete={ADDRESS_AUTOCOMPLETE}
                data-form-type="other"
                data-lpignore="true"
                spellCheck={false}
                className={inputClass}
                placeholder="Ej: Cdad. Autónoma de Buenos Aires"
              />
            </label>

            <label className="grid gap-2 text-sm text-stone-300">
              Código postal
              <input
                required={required}
                value={value.postalCode}
                onChange={(event) => setField("postalCode", event.target.value)}
                autoComplete={ADDRESS_AUTOCOMPLETE}
                data-form-type="other"
                data-lpignore="true"
                spellCheck={false}
                className={inputClass}
              placeholder="Ej: C1425"
            />
          </label>

            {afterPostalCode ? <div className="grid gap-2 text-sm text-stone-300">{afterPostalCode}</div> : null}
          </div>
        </>
      )}

      <div className="sr-only" aria-live="polite">
        <span className={textareaClass}>
          {loadingDetails ? "Cargando sugerencia..." : value.addressSource === "google_places" ? "Google Places" : "Carga manual"}
        </span>
      </div>
    </div>
  );
}
