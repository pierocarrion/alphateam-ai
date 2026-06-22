export const HASHTAG_PATTERN = /^#[a-z0-9][a-z0-9-]{1,30}$/;

export function normalizeHashtag(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value.startsWith("#")) value = "#" + value;
  value = value.replace(/\s+/g, "-");
  value = value.replace(/[^#a-z0-9-]/g, "");
  value = value.replace(/-{2,}/g, "-");
  value = value.replace(/-+$/g, "");
  return value;
}

export function isValidHashtag(input: string): boolean {
  return HASHTAG_PATTERN.test(input.trim());
}

export function hashtagToSlug(hashtag: string): string {
  return hashtag.replace(/^#/, "").trim().toLowerCase();
}
