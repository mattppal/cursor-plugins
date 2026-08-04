const STATUS_URL =
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x\.com|twitter\.com|vxtwitter\.com|fxtwitter\.com)\/(?:i\/web|[A-Za-z0-9_]+)\/status(?:es)?\/(\d+)/i;

const BARE_ID = /^\d{1,25}$/;
const USERNAME = /^[A-Za-z0-9_]{1,15}$/;

export function parsePostId(value: string): string {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(STATUS_URL);
  if (fromUrl?.[1]) {
    return fromUrl[1];
  }
  if (BARE_ID.test(trimmed)) {
    return trimmed;
  }
  throw new Error(
    `Could not parse a post ID from "${value}". Pass a numeric ID or an x.com / twitter.com status URL.`
  );
}

export function parsePostIds(values: string[]): string[] {
  const ids = values.map((value) => parsePostId(value));
  return [...new Set(ids)];
}

export function parseUsername(value: string): string {
  const trimmed = value.trim().replace(/^@/, "");
  if (!USERNAME.test(trimmed)) {
    throw new Error(
      `Invalid username "${value}". Usernames are 1-15 characters: letters, numbers, or underscores.`
    );
  }
  return trimmed;
}

export function looksLikeUserId(value: string): boolean {
  return BARE_ID.test(value.trim());
}
