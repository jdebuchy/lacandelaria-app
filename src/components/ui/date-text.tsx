import { formatDate, formatDateFriendly, formatDateTime, formatDateTimeFriendly } from "@/lib/format";

type DateTextProps = {
  /** Que mostrar cuando no hay fecha. Ej: "Sin fecha", "Sin registrar". */
  empty?: string;
  /** Suma la hora al texto visible. Para timelines y bandejas de mensajes. */
  withTime?: boolean;
  className?: string;
  value: Date | string | null | undefined;
};

/**
 * Una fecha en lenguaje natural, con la fecha exacta a un hover de distancia.
 *
 * La contra de mostrar "Hace 3 dias" es que la fecha real se pierde y no hay
 * forma de recuperarla desde la pantalla. El title la devuelve, y el <time>
 * deja el valor legible por maquina. Por eso esto es un componente y no una
 * funcion mas: son tres cosas que tienen que viajar juntas.
 *
 * Para fechas que van dentro de una frase, seguir usando formatDateFriendly
 * directamente: un componente no se puede interpolar en un string.
 */
export function DateText({ className, empty = "-", value, withTime = false }: DateTextProps) {
  const friendly = withTime ? formatDateTimeFriendly(value) : formatDateFriendly(value);

  // formatDateFriendly ya devuelve "-" ante un valor invalido o vacio, que es
  // justo el caso en el que no hay ninguna fecha exacta que revelar.
  if (friendly === "-") {
    return <span className={className}>{empty}</span>;
  }

  const exact = withTime ? formatDateTime(value) : formatDate(value);

  return (
    <time className={className} dateTime={toMachineValue(value)} title={exact}>
      {friendly}
    </time>
  );
}

/** El atributo dateTime pide ISO; las fechas sin hora ya vienen en ese formato. */
function toMachineValue(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? undefined;
}
