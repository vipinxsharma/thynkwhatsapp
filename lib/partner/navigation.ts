/**
 * Navigation entries marked partnerOnly appear only when the workspace's partner access
 * is approved by a platform superadmin.
 */
export function visibleNavigation<T extends { href: string; partnerOnly?: boolean }>(items: T[], partnerApproved: boolean): T[] {
  return items.filter((item) => !item.partnerOnly || partnerApproved);
}
