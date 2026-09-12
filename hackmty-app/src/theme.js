import { Platform } from "react-native";

export const colors = {
  red: "#EB0029",
  redDark: "#DB0026",
  charcoal: "#323E48",
  slate: "#5B6670",
  muted: "#8A949C",
  disabled: "#C1C5C8",
  border: "#E1E4E6",
  surface: "#FFFFFF",
  canvas: "#F6F6F6",
  canvasStrong: "#EEF0F1",
  success: "#12805C",
  successSoft: "#E7F6F0",
  warning: "#A66300",
  warningSoft: "#FFF3DF",
  errorSoft: "#FDE8EC",
  infoSoft: "#EAF1F7",
};

export const spacing = {
  xs: 5,
  sm: 10,
  md: 15,
  lg: 20,
  xl: 30,
};

export const radii = {
  input: 6,
  button: 4,
  card: 16,
  pill: 999,
};

export const fontFamily = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif",
  default: "system-ui",
});

export const shadow = Platform.select({
  ios: {
    shadowColor: "#101820",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
  },
  android: { elevation: 3 },
  default: {
    shadowColor: "rgba(16, 24, 32, 0.08)",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
});

export function formatMoney(value, currency = "MXN") {
  const number = Number(value) || 0;
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(number);
  } catch {
    return `$${number.toFixed(2)}`;
  }
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
