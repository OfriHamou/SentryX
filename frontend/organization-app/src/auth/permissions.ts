export type AllowedPages = Record<string, string[] | undefined> | null | undefined;

export const hasOrganizationPermission = (
  allowedPages: AllowedPages,
  resource: string,
  action: string
): boolean => {
  if (!allowedPages || !resource || !action) {
    return false;
  }

  const resourceActions = allowedPages[resource];
  const allActions = allowedPages.all;

  return Boolean(
    resourceActions?.includes(action) ||
      resourceActions?.includes('all') ||
      allActions?.includes(action) ||
      allActions?.includes('all')
  );
};
