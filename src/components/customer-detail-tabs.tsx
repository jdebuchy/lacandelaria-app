import Link from "next/link";

type CustomerDetailTab = "profile" | "orders" | "whatsapp";

const tabs: Array<{ label: string; value: CustomerDetailTab }> = [
  { label: "Perfil", value: "profile" },
  { label: "Pedidos", value: "orders" },
  { label: "WhatsApp", value: "whatsapp" }
];

export function normalizeCustomerDetailTab(value?: string): CustomerDetailTab {
  if (value === "orders" || value === "whatsapp") {
    return value;
  }

  return "profile";
}

export function CustomerDetailTabs({
  activeTab,
  customerId
}: {
  activeTab: CustomerDetailTab;
  customerId: string;
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={`/panel/customers/${customerId}?tab=${tab.value}`}
          className={`rounded-full border px-4 py-2 text-sm transition ${
            activeTab === tab.value
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
              : "border-stone-800 bg-stone-900/70 text-stone-400 hover:border-stone-700 hover:text-stone-100"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
