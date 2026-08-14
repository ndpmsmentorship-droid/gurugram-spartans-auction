// Owner accounts are admin-created with a username (no public email). A username
// is mapped to an internal, non-routable email so it can live in Supabase auth
// beside the real admin emails. Admins sign in with their full email; owners just
// type their username.
export const OWNER_EMAIL_DOMAIN = "owners.sdll";

export function usernameToEmail(identifier: string): string {
  const id = identifier.trim();
  return id.includes("@") ? id : `${id.toLowerCase()}@${OWNER_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  const suffix = `@${OWNER_EMAIL_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}

// Usernames: lowercase letters, numbers, and _ . - (no spaces / @).
export function isValidUsername(u: string): boolean {
  return /^[a-z0-9_.-]{3,40}$/.test(u);
}
