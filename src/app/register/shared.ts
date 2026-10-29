// Shared by the /register form, its server actions and the admin queue.
export const SEASON = "SDLL-S2";
export const BUCKET = "registrations";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MIN_AGE = 30;

// Whole years between a yyyy-mm-dd birth date and today (null if unparseable).
export function ageOn(dob: string, today = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--;
  return age;
}

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

export const MEALS = ["Veg", "Non-veg"];
