// TODO: Standardise this shit server-side
export function formatHex(hex: string, poundSign = true): string {
  if (hex.length === 6) {
    return (poundSign ? "#" : "") + hex;
  } else if (hex.length === 3) {
    return (
      (poundSign ? "#" : "") +
      hex
        .split("")
        .map((c) => c + c)
        .join("")
    );
  } else if (hex.length === 7 && hex.startsWith("#")) {
    return poundSign ? hex : hex.substring(1);
  } else if (hex.length === 4 && hex.startsWith("#")) {
    return poundSign
      ? hex
      : hex
          .substring(1)
          .split("")
          .map((c) => c + c)
          .join("");
  } else {
    throw new Error("Invalid hex color format");
  }
}
