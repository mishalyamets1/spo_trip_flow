export function workspaceHome(roles: string[]): string {
  if (roles.includes("ADMIN")) return "/admin/employees";
  return !roles.includes("EMPLOYEE") && roles.includes("APPROVER")
    ? "/approvals"
    : "/requests";
}

// Assigned request cards remain accessible to approvers without EMPLOYEE.
export function workspaceDestination(path: string, roles: string[]): string {
  const pathname = path.split("?")[0];
  if (
    !roles.includes("EMPLOYEE") &&
    (roles.includes("APPROVER") || roles.includes("ADMIN")) &&
    (pathname === "/requests" ||
      pathname === "/requests/new" ||
      /^\/requests\/\d+\/edit$/.test(pathname))
  )
    return workspaceHome(roles);
  return path;
}

// Only application pages can be used as a post-login return URL.
export function safeReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return "/requests";
  try {
    const url = new URL(value, "http://tripflow.local");
    if (
      url.origin !== "http://tripflow.local" ||
      !(
        /^\/(requests(?:\/(?:new|[1-9]\d{0,17}(?:\/edit)?))?|approvals)$/.test(
          url.pathname,
        ) ||
        /^\/admin(?:\/(?:employees(?:\/(?:new|[1-9]\d{0,17}))?|requests(?:\/[1-9]\d{0,17})?|routes|audit))?$/.test(
          url.pathname,
        )
      )
    )
      return "/requests";
    return url.pathname + url.search;
  } catch {
    return "/requests";
  }
}
