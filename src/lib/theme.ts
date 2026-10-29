export const THEME_COOKIE = "intromesh-theme";

export type Theme = "light" | "dark";

/** La primera visita, un valor vacío o cualquiera que no sea `dark` abre en claro. No consulta el sistema. */
export function parseTheme(value: string | null | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}
