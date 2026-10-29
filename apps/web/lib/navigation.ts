// Only application pages can be used as a post-login return URL.
export function safeReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return "/requests";
  try {
    const url = new URL(value, "http://tripflow.local");
    if (
      url.origin !== "http://tripflow.local" ||
      !/^\/(requests(?:\/(?:new|[1-9]\d{0,17}(?:\/edit)?))?|approvals)$/.test(
        url.pathname,
      )
    )
      return "/requests";
    return url.pathname + url.search;
  } catch {
    return "/requests";
  }
}
