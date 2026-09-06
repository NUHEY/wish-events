import type { DirectoryProfileRow } from "@/types/database";

export const DIRECTORY_FIELDS = ["faculty", "grade_level", "languages", "nationalities", "lived_countries"] as const;
export type DirectoryField = (typeof DIRECTORY_FIELDS)[number];
export type DirectoryFilters = Partial<Record<DirectoryField, string>>;

export function directoryFilterHref(field: DirectoryField, value: string) {
  return `/directory?${new URLSearchParams({ [field]: value }).toString()}`;
}

export function matchesDirectoryFilters(profile: DirectoryProfileRow, filters: DirectoryFilters) {
  return DIRECTORY_FIELDS.every((field) => {
    const expected = filters[field];
    if (!expected) return true;
    const value = profile[field];
    return Array.isArray(value) ? value.includes(expected) : value === expected;
  });
}

export function sharesLanguage(profile: DirectoryProfileRow, viewer?: DirectoryProfileRow) {
  return profile.id !== viewer?.id && !!profile.languages?.some((code) => viewer?.languages?.includes(code));
}
