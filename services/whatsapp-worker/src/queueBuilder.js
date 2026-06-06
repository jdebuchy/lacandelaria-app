import { supabase } from "./supabase.js";
import { normalizeWhatsappPhone } from "./phone.js";

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatTemplate(template, customer) {
  const name = customer?.first_name || customer?.last_name || "!";
  return template.replaceAll("{nombre}", name);
}

export async function buildDailyQueue() {
  const { data: settings, error: settingsError } = await supabase
    .from("whatsapp_automation_settings")
    .select("message_type, active, days_after_delivered, template_body")
    .eq("active", true);

  if (settingsError) {
    throw settingsError;
  }

  const results = [];

  for (const setting of settings ?? []) {
    const threshold = addDays(new Date(), -Number(setting.days_after_delivered)).toISOString();
    const { data: deliveries, error: deliveriesError } = await supabase
      .from("deliveries")
      .select(
        `
          delivered_at,
          orders!inner (
            id,
            status,
            customer_id,
            customers (
              id,
              first_name,
              last_name,
              phone,
              whatsapp_phone,
              whatsapp_opt_in,
              whatsapp_opt_out_at
            )
          )
        `
      )
      .not("delivered_at", "is", null)
      .lte("delivered_at", threshold)
      .eq("orders.status", "delivered")
      .limit(500);

    if (deliveriesError) {
      throw deliveriesError;
    }

    let created = 0;
    let skipped = 0;

    for (const delivery of deliveries ?? []) {
      const order = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders;
      const customer = Array.isArray(order?.customers) ? order.customers[0] : order?.customers;
      const phone = normalizeWhatsappPhone(customer?.whatsapp_phone || customer?.phone);

      if (!order?.id || !customer?.id || !phone || customer.whatsapp_opt_in === false || customer.whatsapp_opt_out_at) {
        skipped += 1;
        continue;
      }

      const scheduledFor = addDays(new Date(delivery.delivered_at), Number(setting.days_after_delivered)).toISOString();
      const { error: insertError } = await supabase.from("whatsapp_message_queue").insert({
        customer_id: customer.id,
        order_id: order.id,
        message_type: setting.message_type,
        status: "pending",
        scheduled_for: scheduledFor,
        phone,
        body: formatTemplate(setting.template_body, customer)
      });

      if (insertError) {
        if (insertError.code === "23505") {
          skipped += 1;
          continue;
        }

        throw insertError;
      }

      created += 1;
    }

    results.push({
      created,
      messageType: setting.message_type,
      skipped
    });
  }

  return {
    success: true,
    results
  };
}
