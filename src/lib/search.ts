export function normalizeSearchValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function includesNormalizedSearchValue(value: string | null | undefined, query: string) {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return true;
  }

  return normalizeSearchValue(value).includes(normalizedQuery);
}

export function matchesNormalizedSearchValues(
  values: Array<string | null | undefined>,
  query: string
) {
  return values.some((value) => includesNormalizedSearchValue(value, query));
}
