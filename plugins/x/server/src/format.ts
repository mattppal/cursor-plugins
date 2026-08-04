import type {
  FormattedListResult,
  FormattedMedia,
  FormattedPost,
  FormattedUser,
  XIncludes,
  XListResponse,
  XMedia,
  XMeta,
  XPost,
  XUser,
} from "./types.ts";

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function formatUser(user: XUser): FormattedUser {
  const username = user.username;
  return {
    id: user.id,
    name: user.name,
    username,
    url: username ? `https://x.com/${username}` : undefined,
    description: user.description,
    created_at: user.created_at,
    verified: user.verified,
    verified_type: user.verified_type,
    location: user.location,
    protected: user.protected,
    profile_image_url: user.profile_image_url,
    pinned_tweet_id: user.pinned_tweet_id,
    metrics: user.public_metrics
      ? {
          followers: user.public_metrics.followers_count,
          following: user.public_metrics.following_count,
          posts: user.public_metrics.tweet_count,
          listed: user.public_metrics.listed_count,
        }
      : undefined,
  };
}

function formatMedia(media: XMedia): FormattedMedia {
  return {
    media_key: media.media_key,
    type: media.type,
    url: media.url,
    preview_image_url: media.preview_image_url,
    alt_text: media.alt_text,
    duration_ms: media.duration_ms,
    width: media.width,
    height: media.height,
  };
}

export function formatPost(post: XPost, includes: XIncludes = {}): FormattedPost {
  const usersById = new Map((includes.users ?? []).map((user) => [user.id, user]));
  const mediaByKey = new Map((includes.media ?? []).map((item) => [item.media_key, item]));
  const author = post.author_id ? usersById.get(post.author_id) : undefined;
  const text = post.note_tweet?.text || post.text || "";
  const mediaKeys = post.attachments?.media_keys ?? [];

  return {
    id: post.id,
    url: author?.username ? `https://x.com/${author.username}/status/${post.id}` : `https://x.com/i/web/status/${post.id}`,
    text,
    created_at: post.created_at,
    lang: post.lang,
    conversation_id: post.conversation_id,
    author: author ? formatUser(author) : post.author_id ? { id: post.author_id } : undefined,
    metrics: post.public_metrics
      ? {
          likes: post.public_metrics.like_count,
          reposts: post.public_metrics.retweet_count,
          replies: post.public_metrics.reply_count,
          quotes: post.public_metrics.quote_count,
          bookmarks: post.public_metrics.bookmark_count,
          impressions: post.public_metrics.impression_count,
        }
      : undefined,
    reply_to_user_id: post.in_reply_to_user_id,
    referenced: post.referenced_tweets,
    entities: post.entities,
    media: mediaKeys.map((key) => mediaByKey.get(key)).filter((item): item is XMedia => Boolean(item)).map(formatMedia),
    possibly_sensitive: post.possibly_sensitive,
  };
}

function formatMeta(meta?: XMeta) {
  if (!meta) {
    return undefined;
  }
  return {
    result_count: meta.result_count,
    newest_id: meta.newest_id,
    oldest_id: meta.oldest_id,
    next_token: meta.next_token,
    previous_token: meta.previous_token,
  };
}

export function formatPostList(response: XListResponse<XPost>): FormattedListResult<FormattedPost> {
  return {
    data: asArray(response.data).map((post) => formatPost(post, response.includes)),
    meta: formatMeta(response.meta),
    errors: response.errors,
  };
}

export function formatUserList(response: XListResponse<XUser>): FormattedListResult<FormattedUser> {
  return {
    data: asArray(response.data).map(formatUser),
    meta: formatMeta(response.meta),
    errors: response.errors,
  };
}

export function sortPostsChronologically<T extends { created_at?: string }>(posts: T[]): T[] {
  return [...posts].sort((left, right) => {
    const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
    const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
    return leftTime - rightTime;
  });
}
