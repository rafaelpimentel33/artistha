import type { StoreConfig } from "./store-model";

export const productColorFields = [
  { key: "background", label: "Fundo da página" },
  { key: "text", label: "Textos e títulos" },
  { key: "buttons", label: "Fundo dos botões" },
  { key: "buttonText", label: "Texto dos botões" },
  { key: "headerBackground", label: "Fundo do cabeçalho" },
  { key: "logo", label: "Cor do logo" },
  { key: "announcementBackground", label: "Fundo da faixa de avisos" },
  { key: "announcementText", label: "Texto da faixa de avisos" },
  { key: "footerBackground", label: "Fundo do rodapé" },
  { key: "footerText", label: "Texto e marcas do rodapé" },
] as const;

export type ProductColor = typeof productColorFields[number]["key"];
export type ProductTheme = Partial<Record<ProductColor, string>>;
export type StoreColors = Pick<StoreConfig, "background" | "accent">;

export const productBackgroundPatterns = [
  { value: "floral", label: "Floral" },
  { value: "losangos", label: "Losangos" },
  { value: "pontilhado", label: "Pontilhado" },
  { value: "nenhum", label: "Sem padrão" },
] as const;
export type ProductBackgroundPattern = typeof productBackgroundPatterns[number]["value"];
export const defaultProductBackgroundPattern: ProductBackgroundPattern = "floral";

function luminance(hex: string) {
  const [red, green, blue] = (hex.match(/[\da-f]{2}/gi) ?? []).map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

export const buttonForeground = (background: string) => luminance(background) > 0.2 ? "#22150e" : "#ffffff";
export const pageForeground = (background: string) => luminance(background) > 0.27 ? "#39261b" : "#f7e9dc";

export function productPageColors(config: StoreColors, theme: ProductTheme = {}): Record<ProductColor, string> {
  const background = theme.background ?? config.background;
  const buttons = theme.buttons ?? config.accent;
  const headerBackground = theme.headerBackground ?? background;
  const announcementBackground = theme.announcementBackground ?? config.accent;
  return {
    background,
    text: theme.text ?? pageForeground(background),
    buttons,
    buttonText: theme.buttonText ?? buttonForeground(buttons),
    headerBackground,
    logo: theme.logo ?? (luminance(headerBackground) > 0.27 ? config.accent : "#f7e9dc"),
    announcementBackground,
    announcementText: theme.announcementText ?? buttonForeground(announcementBackground),
    footerBackground: theme.footerBackground ?? "#7e1316",
    footerText: theme.footerText ?? (theme.footerBackground ? buttonForeground(theme.footerBackground) : "#ded7cf"),
  };
}
