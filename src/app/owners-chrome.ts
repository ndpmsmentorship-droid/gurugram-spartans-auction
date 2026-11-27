// The owners' portal pages show no site menu, auction badge or breadcrumbs — for anyone, admins
// included (Nikhil, 27 Nov 2026: "I don't want owners to see this"). Paths without the basePath.
export const isOwnersPage = (pathname: string | null) => !!pathname && /^\/(owners|war-room)(\/|$)/.test(pathname);
