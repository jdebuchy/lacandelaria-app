export function getInstagramStatusLabel(status?: string | null) {
  switch (status) {
    case "new":
      return "Nuevo";
    case "bot_active":
      return "Bot activo";
    case "waiting_customer":
      return "Esperando cliente";
    case "human_needed":
      return "Requiere humano";
    case "qualified":
      return "Calificado";
    case "order_created":
      return "Pedido creado";
    case "lost":
      return "Perdido";
    case "closed":
      return "Cerrado";
    default:
      return status || "-";
  }
}

export function getInstagramMessageTypeLabel(type?: string | null) {
  switch (type) {
    case "text":
      return "Texto";
    case "postback":
      return "Postback";
    case "attachment":
      return "Adjunto";
    default:
      return type || "-";
  }
}
