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
          className={`rounded-full border px-4 py-2 text-sm transition ${
            activeHref === link.href
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-stone-800 bg-stone-900/70 text-stone-400 hover:border-stone-700 hover:text-stone-100"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
