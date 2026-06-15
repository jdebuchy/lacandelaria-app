import { Suspense } from "react";
import Link from "next/link";
import { CustomerSearch } from "@/components/customer-search";
import { CustomerRecords } from "@/components/customer-records";
import type { CustomerRecord } from "@/components/customer-records";
import { CsvImportButton } from "@/components/csv-import-button";
import { AddCustomerButton } from "@/components/add-customer-button";
import { requirePageRole } from "@/lib/auth";
import { PANEL_ALLOWED_ROLES } from "@/lib/auth-shared";
import { matchesNormalizedSearchValues } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

type CustomerAreaFilter = "all" | "gated" | "capital" | "province" | "pending_review";
type CustomerSortKey = "updated_at" | "last_name" | "created_at";
type CustomerSortDirection = "asc" | "desc";
type CustomerPageSize = 50 | 100 | 200;

type SearchParams = Promise<{ q?: string; area?: string; sort?: string; dir?: string; limit?: string; page?: string }>;

const AREA_LABELS: Record<CustomerAreaFilter, string> = {
  all: "Todos",
  gated: "Barrios Privados",
  capital: "Capital",
  province: "Provincia",
  pending_review: "Pending review"
};

const CUSTOMER_SELECT_BASE = "id, first_name, last_name, phone, instagram, address_kind, address_line_1, address_line_2, gated_community_name, locality, administrative_area_level_1, postal_code, google_place_id, google_place_label, address_source, delivery_area, delivery_notes, source, created_at";
const CUSTOMER_SELECT_WITH_UPDATED_AT = `${CUSTOMER_SELECT_BASE}, updated_at`;

function isMissingUpdatedAtError(error?: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  return error.code === "42703" || error.code === "PGRST204";
}

function normalizeSearchTerm(value?: string) {
  return value?.trim() ?? "";
}

function normalizeAreaFilter(value?: string): CustomerAreaFilter {
  if (value === "gated" || value === "capital" || value === "province" || value === "pending_review") {
    return value;
  }

  return "all";
}

function normalizeSortKey(value?: string): CustomerSortKey {
  if (value === "last_name" || value === "created_at") {
    return value;
  }

  return "updated_at";
}

function normalizeSortDirection(value?: string): CustomerSortDirection {
  return value === "asc" ? "asc" : "desc";
}

function normalizePageSize(value?: string): CustomerPageSize {
  if (value === "50") {
    return 50;
  }

  if (value === "200") {
    return 200;
  }

  return 100;
}

function normalizePage(value?: string) {
  const page = Number(value);

  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
}

function buildHref({
  q,
  area,
  limit,
  sort,
  dir,
  page
}: {
  q: string;
  area: CustomerAreaFilter;
  limit: CustomerPageSize;
  sort?: CustomerSortKey;
  dir?: CustomerSortDirection;
  page?: number;
}) {
  const params = new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (area !== "all") {
    params.set("area", area);
  }

  if (limit !== 100) {
    params.set("limit", String(limit));
  }

  if (sort && sort !== "updated_at") {
    params.set("sort", sort);
  }

  if (dir && dir !== "desc") {
    params.set("dir", dir);
  }

  if (page && page > 1) {
    params.set("page", String(page));
  }

  return `/panel/customers?${params.toString()}`;
}

function buildSortHref({
  q,
  area,
  limit,
  currentSort,
  currentDirection,
  nextSort
}: {
  q: string;
  area: CustomerAreaFilter;
  limit: CustomerPageSize;
  currentSort: CustomerSortKey;
  currentDirection: CustomerSortDirection;
  nextSort: Exclude<CustomerSortKey, "updated_at">;
}) {
  const nextDirection = currentSort === nextSort && currentDirection === "asc" ? "desc" : "asc";

  return buildHref({
    q,
    area,
    limit,
    sort: nextSort,
    dir: nextDirection
  });
}

function matchesAreaFilter(
  customer: {
    address_kind: string | null;
    delivery_area: string | null;
  },
  area: CustomerAreaFilter
) {
  if (area === "all") {
    return true;
  }

  if (area === "gated") {
    return customer.address_kind === "gated";
  }

  if (area === "capital") {
    return customer.delivery_area === "capital_federal";
  }

  if (area === "pending_review") {
    return customer.delivery_area === "pending_review";
  }

  return (
    customer.address_kind !== "gated" &&
    customer.delivery_area !== "capital_federal" &&
    customer.delivery_area !== "pending_review"
  );
}

function applyAreaFilter<T extends {
  eq: (column: string, value: string) => T;
  neq: (column: string, value: string) => T;
}>(query: T, area: CustomerAreaFilter) {
  if (area === "gated") {
    return query.eq("address_kind", "gated");
  }

  if (area === "capital") {
    return query.eq("delivery_area", "capital_federal");
  }

  if (area === "pending_review") {
    return query.eq("delivery_area", "pending_review");
  }

  if (area === "province") {
    return query
      .neq("address_kind", "gated")
      .neq("delivery_area", "capital_federal")
      .neq("delivery_area", "pending_review");
  }

  return query;
}

function applySorting<T extends {
  order: (column: string, options?: { ascending?: boolean }) => T;
}>(query: T, sort: CustomerSortKey, dir: CustomerSortDirection, hasUpdatedAt: boolean) {
  const ascending = dir === "asc";

  if (sort === "last_name") {
    return query
      .order("last_name", { ascending })
      .order("first_name", { ascending })
      .order("created_at", { ascending: false });
  }

  if (sort === "created_at") {
    return query.order("created_at", { ascending });
  }

  return query.order(hasUpdatedAt ? "updated_at" : "created_at", { ascending });
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  hrefForPage
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: CustomerPageSize;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div className="flex items-center justify-between border-t border-stone-800 bg-stone-900/70 px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <Link
          href={hrefForPage(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage === 1}
          className={`relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium ${
            currentPage === 1
              ? "pointer-events-none border-stone-800 bg-stone-950 text-stone-600"
              : "border-stone-700 bg-stone-950 text-stone-200 hover:bg-stone-800"
          }`}
        >
          Previous
        </Link>
        <Link
          href={hrefForPage(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage === totalPages}
          className={`relative ml-3 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium ${
            currentPage === totalPages
              ? "pointer-events-none border-stone-800 bg-stone-950 text-stone-600"
              : "border-stone-700 bg-stone-950 text-stone-200 hover:bg-stone-800"
          }`}
        >
          Next
        </Link>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-stone-400">
            Mostrando <span className="font-medium text-stone-200">{start}</span> a{" "}
            <span className="font-medium text-stone-200">{end}</span> de{" "}
            <span className="font-medium text-stone-200">{totalCount}</span> clientes
          </p>
        </div>
        <div>
          <nav aria-label="Paginación" className="isolate inline-flex -space-x-px rounded-md shadow-none">
            <Link
              href={hrefForPage(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage === 1}
              className={`relative inline-flex items-center rounded-l-md px-3 py-2 inset-ring ${
                currentPage === 1
                  ? "pointer-events-none text-stone-700 inset-ring-stone-800"
                  : "text-stone-400 inset-ring-stone-700 hover:bg-stone-800"
              }`}
            >
              <span className="sr-only">Previous</span>
              <span aria-hidden="true">‹</span>
            </Link>
            {pages.map((page, index) => {
              const previous = pages[index - 1];
              const needsGap = previous && page - previous > 1;

              return (
                <div key={page} className="inline-flex">
                  {needsGap ? (
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-stone-500 inset-ring inset-ring-stone-700">
                      ...
                    </span>
                  ) : null}
                  <Link
                    href={hrefForPage(page)}
                    aria-current={page === currentPage ? "page" : undefined}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold inset-ring inset-ring-stone-700 ${
                      page === currentPage
                        ? "z-10 bg-emerald-500 text-stone-950"
                        : "text-stone-200 hover:bg-stone-800"
                    }`}
                  >
                    {page}
                  </Link>
                </div>
              );
            })}
            <Link
              href={hrefForPage(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage === totalPages}
              className={`relative inline-flex items-center rounded-r-md px-3 py-2 inset-ring ${
                currentPage === totalPages
                  ? "pointer-events-none text-stone-700 inset-ring-stone-800"
                  : "text-stone-400 inset-ring-stone-700 hover:bg-stone-800"
              }`}
            >
              <span className="sr-only">Next</span>
              <span aria-hidden="true">›</span>
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePageRole(PANEL_ALLOWED_ROLES, "/panel/customers");
  const { q, area, sort, dir, limit, page } = await searchParams;
  const normalizedQuery = normalizeSearchTerm(q);
  const areaFilter = normalizeAreaFilter(area);
  const sortKey = normalizeSortKey(sort);
  const sortDirection = normalizeSortDirection(dir);
  const pageSize = normalizePageSize(limit);
  const currentPage = normalizePage(page);
  const supabase = createAdminClient();

  const safeQ = normalizedQuery ? normalizedQuery.replace(/[,()]/g, "") : "";
  const rangeFrom = (currentPage - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  function buildCustomersQuery(selectClause: string, hasUpdatedAt: boolean) {
    let query = supabase
      .from("customers")
      .select(selectClause, { count: "exact" });

    query = applyAreaFilter(query, areaFilter);

    query = applySorting(query, sortKey, sortDirection, hasUpdatedAt);

    if (!safeQ) {
      query = query.range(rangeFrom, rangeTo);
    }

    return query;
  }

  let { data: customers, error, count } = await buildCustomersQuery(CUSTOMER_SELECT_WITH_UPDATED_AT, true);

  if (isMissingUpdatedAtError(error)) {
    const fallbackResult = await buildCustomersQuery(CUSTOMER_SELECT_BASE, false);
    customers = fallbackResult.data;
    error = fallbackResult.error;
    count = fallbackResult.count;
  }

  if (error) throw error;
  const allRows = (customers ?? []) as unknown as CustomerRecord[];
  const filteredRows = safeQ
    ? allRows.filter((customer) =>
        matchesNormalizedSearchValues(
          [
            customer.first_name,
            customer.last_name,
            `${customer.first_name ?? ""} ${customer.last_name ?? ""}`,
            customer.phone,
            customer.instagram
          ],
          safeQ
        )
      )
    : allRows;
  const totalCount = safeQ ? filteredRows.length : count ?? filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const rows = safeQ
    ? filteredRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize)
    : filteredRows;
  const showingFrom = totalCount === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const showingTo = Math.min(clampedPage * pageSize, totalCount);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-16">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
                Listado de clientes
              </h1>
              <p className="mt-2 text-stone-400">
                {totalCount} {normalizedQuery ? "resultado(s) para la búsqueda" : "clientes registrados"}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Orden actual: {sortKey === "updated_at" ? "última actualización" : sortKey === "last_name" ? "apellido" : "alta"} ({sortDirection === "asc" ? "ascendente" : "descendente"}). Filtro actual: {AREA_LABELS[areaFilter]}.
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Mostrando {showingFrom} a {showingTo} de {totalCount}. Límite por página: {pageSize}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AddCustomerButton />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CsvImportButton />
            <Suspense>
              <CustomerSearch
                defaultValue={normalizedQuery}
                defaultArea={areaFilter}
                defaultLimit={String(pageSize)}
              />
            </Suspense>
          </div>
        </div>

        <CustomerRecords
          rows={rows}
          query={normalizedQuery}
          sort={sortKey}
          direction={sortDirection}
          sortLinks={{
            lastName: buildSortHref({
              q: normalizedQuery,
              area: areaFilter,
              limit: pageSize,
              currentSort: sortKey,
              currentDirection: sortDirection,
              nextSort: "last_name"
            }),
            createdAt: buildSortHref({
              q: normalizedQuery,
              area: areaFilter,
              limit: pageSize,
              currentSort: sortKey,
              currentDirection: sortDirection,
              nextSort: "created_at"
            })
          }}
        />

        <Pagination
          currentPage={clampedPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          hrefForPage={(nextPage) => buildHref({
            q: normalizedQuery,
            area: areaFilter,
            limit: pageSize,
            sort: sortKey,
            dir: sortDirection,
            page: nextPage
          })}
        />
      </section>
    </main>
  );
}
