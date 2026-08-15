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
          className={`rounded-control border px-4 py-2 text-body transition ${
            activeTab === tab.value
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-paper text-ink-soft hover:border-line hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
