import { ManualOrderForm } from "@/components/manual-order-form";

export default function NewManualOrderPage() {
  return (
    <main>
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-50 sm:text-4xl">
            Nuevo pedido
          </h1>
        </div>

        <ManualOrderForm />
      </section>
    </main>
  );
}
