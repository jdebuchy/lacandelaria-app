import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAddressBook,
  faBoxOpen,
  faChartLine,
  faGaugeHigh,
  faHandHoldingDollar,
  faPalette,
  faReceipt,
  faTruck,
  faTruckFast,
  faUserGear,
  faUsers
} from "@fortawesome/pro-regular-svg-icons";
import type { UserRole } from "@/lib/types";

/**
 * Datos de navegacion del panel.
 *
 * Vivian dentro de panel-nav.tsx, que tenia 882 lineas mezclando el menu, diez
 * iconos SVG dibujados a mano y tres copias del mismo bloque de render. Separar
 * los datos del render deja las dos partes legibles.
 */

export type NavIconKey =
  | "crm"
  | "overview"
  | "orders"
  | "reports"
  | "collections"
  | "logistics"
  | "customers"
  | "users"
  | "products"
  | "driver"
  | "design";

export type NavMatch = {
  exact?: boolean;
  exclude?: string[];
  match: string[];
};

export type NavChildItem = NavMatch & {
  href: string;
  label: string;
};

export type NavItem = {
  children?: NavChildItem[];
  href: string;
  iconKey: NavIconKey;
  label: string;
  match: string[];
  exact?: boolean;
  exclude?: string[];
  section: "main" | "management" | "system";
};

export const linksByRole: Record<UserRole, NavItem[]> = {
  admin: [
    {
      href: "/panel",
      exact: true,
      iconKey: "overview",
      label: "Resumen",
      match: ["/panel"],
      section: "main"
    },
    {
      href: "/panel/customers",
      iconKey: "crm",
      label: "CRM",
      match: ["/panel/customers", "/panel/crm"],
      children: [
        {
          href: "/panel/customers",
          label: "Clientes",
          match: ["/panel/customers"]
        },
        {
          href: "/panel/crm/whatsapp",
          label: "WhatsApp",
          match: ["/panel/crm/whatsapp"]
        },
        {
          href: "/panel/crm/instagram",
          label: "Instagram",
          match: ["/panel/crm/instagram"]
        }
      ],
      section: "management"
    },
    {
      href: "/panel/orders",
      iconKey: "orders",
      label: "Pedidos",
      match: ["/panel/orders"],
      section: "main"
    },
    {
      href: "/panel/logistics",
      iconKey: "logistics",
      label: "Logística",
      match: ["/panel/logistics"],
      children: [
        {
          href: "/panel/logistics",
          label: "Armado de viajes",
          match: ["/panel/logistics"],
          exclude: ["/panel/logistics/delivery", "/panel/logistics/depots"]
        },
        {
          href: "/panel/logistics/delivery",
          label: "Delivery",
          match: ["/panel/logistics/delivery", "/driver"]
        },
        {
          href: "/panel/logistics/depots",
          label: "Depósitos",
          match: ["/panel/logistics/depots"]
        }
      ],
      section: "main"
    },
    {
      href: "/panel/collections",
      iconKey: "collections",
      label: "Cobranza",
      match: ["/panel/collections"],
      section: "main"
    },
    {
      href: "/panel/products",
      iconKey: "products",
      label: "Productos",
      match: ["/panel/products"],
      section: "management"
    },
    {
      href: "/panel/reports",
      iconKey: "reports",
      label: "Reportes",
      match: ["/panel/reports"],
      section: "management"
    },
    {
      href: "/panel/users",
      iconKey: "users",
      label: "Usuarios",
      match: ["/panel/users"],
      section: "system"
    },
    {
      href: "/panel/design",
      iconKey: "design",
      label: "Sistema de diseño",
      match: ["/panel/design"],
      section: "system"
    }
  ],
  seller: [
    {
      href: "/panel",
      exact: true,
      iconKey: "overview",
      label: "Resumen",
      match: ["/panel"],
      section: "main"
    },
    {
      href: "/panel/customers",
      iconKey: "crm",
      label: "CRM",
      match: ["/panel/customers", "/panel/crm"],
      children: [
        {
          href: "/panel/customers",
          label: "Clientes",
          match: ["/panel/customers"]
        },
        {
          href: "/panel/crm/whatsapp",
          label: "WhatsApp",
          match: ["/panel/crm/whatsapp"]
        },
        {
          href: "/panel/crm/instagram",
          label: "Instagram",
          match: ["/panel/crm/instagram"]
        }
      ],
      section: "management"
    },
    {
      href: "/panel/orders",
      iconKey: "orders",
      label: "Pedidos",
      match: ["/panel/orders"],
      section: "main"
    },
    {
      href: "/panel/reports",
      iconKey: "reports",
      label: "Reportes",
      match: ["/panel/reports"],
      section: "management"
    },
    {
      href: "/panel/logistics",
      iconKey: "logistics",
      label: "Logística",
      match: ["/panel/logistics"],
      children: [
        {
          href: "/panel/logistics",
          label: "Armado de viajes",
          match: ["/panel/logistics"]
        }
      ],
      section: "main"
    },
    {
      href: "/panel/collections",
      iconKey: "collections",
      label: "Cobranza",
      match: ["/panel/collections"],
      section: "main"
    }
  ],
  collector: [
    {
      href: "/panel",
      exact: true,
      iconKey: "overview",
      label: "Resumen",
      match: ["/panel"],
      section: "main"
    },
    {
      href: "/panel/customers",
      iconKey: "crm",
      label: "CRM",
      match: ["/panel/customers", "/panel/crm"],
      children: [
        {
          href: "/panel/customers",
          label: "Clientes",
          match: ["/panel/customers"]
        },
        {
          href: "/panel/crm/whatsapp",
          label: "WhatsApp",
          match: ["/panel/crm/whatsapp"]
        },
        {
          href: "/panel/crm/instagram",
          label: "Instagram",
          match: ["/panel/crm/instagram"]
        }
      ],
      section: "management"
    },
    {
      href: "/panel/orders",
      iconKey: "orders",
      label: "Pedidos",
      match: ["/panel/orders"],
      section: "main"
    },
    {
      href: "/panel/reports",
      iconKey: "reports",
      label: "Reportes",
      match: ["/panel/reports"],
      section: "management"
    },
    {
      href: "/panel/logistics",
      iconKey: "logistics",
      label: "Logística",
      match: ["/panel/logistics"],
      children: [
        {
          href: "/panel/logistics",
          label: "Armado de viajes",
          match: ["/panel/logistics"]
        }
      ],
      section: "main"
    }
  ],
  driver: [
    {
      href: "/reparto",
      iconKey: "logistics",
      label: "Mi reparto",
      match: ["/reparto", "/driver"],
      section: "main"
    }
  ]
};


/**
 * Icono de cada seccion. Antes era un `switch` de 105 lineas con los paths SVG
 * escritos a mano, que era basicamente un clon manual de una libreria de
 * iconos. Ahora es FontAwesome Pro, estilo Classic Regular.
 */
export const NAV_ICONS: Record<NavIconKey, IconDefinition> = {
  collections: faHandHoldingDollar,
  crm: faAddressBook,
  customers: faUsers,
  design: faPalette,
  driver: faTruckFast,
  logistics: faTruck,
  orders: faReceipt,
  overview: faGaugeHigh,
  products: faBoxOpen,
  reports: faChartLine,
  users: faUserGear
};

export function isMatchActive(pathname: string, item: NavMatch) {
  if (item.exclude?.some((excluded) => pathname === excluded || pathname.startsWith(`${excluded}/`))) {
    return false;
  }

  return item.match.some((match) =>
    item.exact ? pathname === match : pathname === match || pathname.startsWith(`${match}/`)
  );
}

export function isItemActive(pathname: string, item: NavItem) {
  return isMatchActive(pathname, item) || item.children?.some((child) => isMatchActive(pathname, child)) || false;
}

export function getActiveItemLabel(links: NavItem[], pathname: string) {
  for (const item of links) {
    const activeChild = item.children?.find((child) => isMatchActive(pathname, child));

    if (activeChild) {
      return activeChild.label;
    }

    if (isMatchActive(pathname, item)) {
      return item.label;
    }
  }

  return links[0]?.label ?? "Navegación";
}
