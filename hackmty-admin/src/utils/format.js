export function formatDate(value) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function componentLabel(value) {
  if (!value || value === "unknown") return "Sin componente";
  return value.replaceAll("_", " ");
}

export function ratingLabel(value) {
  return Number.isInteger(value)
    ? `${value}/10 · ${(value / 2).toLocaleString("es-MX")} estrellas`
    : "Sin calificar";
}

export function averageLabel(value) {
  return Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("es-MX", {
        maximumFractionDigits: 2,
      })}/10`
    : "—";
}

export function formatMoney(value, currency = "MXN") {
  const number = Number(value);
  const amount = Number.isFinite(number) ? number : 0;
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function maskClabe(value) {
  const digits = String(value || "").replace(/\s+/g, "");
  if (!digits) return "Sin CLABE";
  return `•••• ${digits.slice(-4)}`;
}
