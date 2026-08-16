import Link from "next/link";

const links = [
  { href: "/panel/crm/whatsapp", label: "Bandeja" },
  { href: "/panel/crm/whatsapp/queue", label: "Cola de mensajes" },
  { href: "/panel/crm/whatsapp/automations", label: "Automatizaciones" },
  { href: "/panel/crm/whatsapp/settings", label: "Configuración" }
];

export function WhatsappCrmNav({ activeHref }: { activeHref: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`rounded-control border px-4 py-2 text-body transition ${
            activeHref === link.href
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-paper text-ink-soft hover:border-line hover:text-ink"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
