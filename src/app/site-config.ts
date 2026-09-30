// DEMO_MODE = true while the portal is being shown to the league: every major
// page is linked in the header for everyone, and the landing page lists every
// page (with a lock on the ones that need a login).
// Flip to false for launch: signed-out visitors then see only Register (players)
// and Sign in (owners); signed-in users keep their role's own links.
export const DEMO_MODE = true;

export type PortalPage = { href: string; label: string; what: string; access: "Public" | "Owner" | "Admin" | "Signed in" };

// Every page worth showing in a demo, grouped in this order on the landing page.
export const PORTAL_PAGES: PortalPage[] = [
  { href: "/register", label: "Player registration", what: "Find your profile by mobile number, add kit details, or register as new.", access: "Public" },
  { href: "/auction", label: "Live auction board", what: "The player on the block and every team's purse and squad, live.", access: "Public" },
  { href: "/war-room", label: "War Room", what: "Owner's live-auction screen: purse, max safe bid, squad gaps, best fits, who can still bid.", access: "Owner" },
  { href: "/squad", label: "Squads", what: "The Gurugram Spartans squad showcase.", access: "Public" },
  { href: "/schedule", label: "Schedule & points table", what: "34 fixtures by weekend, points tables and an Excel download.", access: "Signed in" },
  { href: "/my-team", label: "My squad", what: "An owner's roster, role mix and marked players.", access: "Owner" },
  { href: "/my-team/targets", label: "Targets", what: "Browse the pool by category and mark players to chase.", access: "Owner" },
  { href: "/scout", label: "Player pool", what: "Every player with rankings, filters and full profiles.", access: "Admin" },
  { href: "/admin/auction", label: "Auction console", what: "Put players up, take bids per team, sell, pass or undo.", access: "Admin" },
  { href: "/admin/registrations", label: "Registrations review", what: "Approve players and tick LinkedIn 500+.", access: "Admin" },
  { href: "/admin/owners", label: "Team owners", what: "Create a login for each franchise owner.", access: "Admin" },
  { href: "/admin/teams", label: "Teams", what: "Names, groups, logos and purses.", access: "Admin" },
  { href: "/admin/schedule", label: "Schedule admin", what: "Generate fixtures and enter results.", access: "Admin" },
];
