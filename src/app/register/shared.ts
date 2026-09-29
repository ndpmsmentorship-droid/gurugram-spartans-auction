// Shared by the /register form, its server actions and the admin queue.
export const SEASON = "SDLL-S2";
export const BUCKET = "registrations";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Indian mobiles arrive as "+91 98xxx", "098xxx", "98xxx-xxxxx"… Keep the last
// 10 digits and require it to look like a mobile (starts 6–9).
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  return /^[6-9]\d{9}$/.test(last10) ? last10 : null;
}

export const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
export const BATTING = ["Left Hand Batsman", "Right Hand Batsman"];
export const BOWLING = ["Left Arm Pacer", "Left Arm Spinner", "Right Arm Pacer", "Right Arm Spin"];
export const ALLROUNDER = ["Batting All Rounder", "Bowling All Rounder"];
