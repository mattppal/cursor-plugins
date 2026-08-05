import type {
  SearchPostsParams,
  TimelineParams,
  XApiErrorBody,
  XListResponse,
  XPost,
  XRateLimit,
  XUser,
} from "./types.ts";
import { VERSION } from "./version.ts";

const API_BASE = "https://api.x.com/2";

const TWEET_FIELDS = [
  "id",
  "text",
  "created_at",
  "author_id",
  "conversation_id",
  "in_reply_to_user_id",
  "referenced_tweets",
  "public_metrics",
  "lang",
  "entities",
  "attachments",
  "possibly_sensitive",
  "note_tweet",
  "edit_history_tweet_ids",
  "reply_settings",
].join(",");

const USER_FIELDS = [
  "id",
  "name",
  "username",
  "description",
  "created_at",
  "public_metrics",
  "verified",
  "verified_type",
  "profile_image_url",
  "location",
  "url",
  "protected",
  "pinned_tweet_id",
].join(",");

const MEDIA_FIELDS = [
  "media_key",
  "type",
  "url",
  "preview_image_url",
  "alt_text",
  "duration_ms",
  "height",
  "width",
  "public_metrics",
].join(",");

const POST_EXPANSIONS = [
  "author_id",
  "attachments.media_keys",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id",
  "in_reply_to_user_id",
  "entities.mentions.username",
].join(",");

export class XApiError extends Error {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
  readonly rateLimit?: XRateLimit;
  readonly body?: unknown;

  constructor(message: string, options: { status: number; title?: string; detail?: string; rateLimit?: XRateLimit; body?: unknown }) {
    super(message);
    this.name = "XApiError";
    this.status = options.status;
    this.title = options.title;
    this.detail = options.detail;
    this.rateLimit = options.rateLimit;
    this.body = options.body;
  }
}

export interface XClientOptions {
  bearerToken: string;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

export class XClient {
  private readonly bearerToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(options: XClientOptions) {
    this.bearerToken = options.bearerToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent ?? `matt-cursor-plugins-x/${VERSION}`;
  }

  searchPosts(params: SearchPostsParams): Promise<XListResponse<XPost>> {
    const query = new URLSearchParams({
      query: params.query,
      "tweet.fields": TWEET_FIELDS,
      "user.fields": USER_FIELDS,
      "media.fields": MEDIA_FIELDS,
      expansions: POST_EXPANSIONS,
      max_results: String(clampMaxResults(params.maxResults, 10, 100, 10)),
    });
    if (params.nextToken) query.set("next_token", params.nextToken);
    if (params.sinceId) query.set("since_id", params.sinceId);
    if (params.untilId) query.set("until_id", params.untilId);
    if (params.startTime) query.set("start_time", params.startTime);
    if (params.endTime) query.set("end_time", params.endTime);
    if (params.sortOrder) query.set("sort_order", params.sortOrder);
    return this.get(`/tweets/search/recent?${query}`);
  }

  getPosts(ids: string[]): Promise<XListResponse<XPost>> {
    if (ids.length === 0) {
      throw new Error("At least one post ID is required.");
    }
    if (ids.length > 100) {
      throw new Error("Lookup is limited to 100 post IDs per request.");
    }
    const query = new URLSearchParams({
      ids: ids.join(","),
      "tweet.fields": TWEET_FIELDS,
      "user.fields": USER_FIELDS,
      "media.fields": MEDIA_FIELDS,
      expansions: POST_EXPANSIONS,
    });
    return this.get(`/tweets?${query}`);
  }

  getUserByUsername(username: string): Promise<XListResponse<XUser>> {
    const query = new URLSearchParams({ "user.fields": USER_FIELDS });
    return this.get(`/users/by/username/${encodeURIComponent(username)}?${query}`);
  }

  getUsersByUsernames(usernames: string[]): Promise<XListResponse<XUser>> {
    if (usernames.length === 0) {
      throw new Error("At least one username is required.");
    }
    if (usernames.length > 100) {
      throw new Error("Lookup is limited to 100 usernames per request.");
    }
    const query = new URLSearchParams({
      usernames: usernames.join(","),
      "user.fields": USER_FIELDS,
    });
    return this.get(`/users/by?${query}`);
  }

  getUsersByIds(ids: string[]): Promise<XListResponse<XUser>> {
    if (ids.length === 0) {
      throw new Error("At least one user ID is required.");
    }
    if (ids.length > 100) {
      throw new Error("Lookup is limited to 100 user IDs per request.");
    }
    const query = new URLSearchParams({
      ids: ids.join(","),
      "user.fields": USER_FIELDS,
    });
    return this.get(`/users?${query}`);
  }

  getUserPosts(userId: string, params: TimelineParams = {}): Promise<XListResponse<XPost>> {
    return this.getTimeline(`/users/${encodeURIComponent(userId)}/tweets`, params);
  }

  getUserMentions(userId: string, params: TimelineParams = {}): Promise<XListResponse<XPost>> {
    return this.getTimeline(`/users/${encodeURIComponent(userId)}/mentions`, params);
  }

  getQuotePosts(postId: string, params: { maxResults?: number; nextToken?: string } = {}): Promise<XListResponse<XPost>> {
    const query = new URLSearchParams({
      "tweet.fields": TWEET_FIELDS,
      "user.fields": USER_FIELDS,
      "media.fields": MEDIA_FIELDS,
      expansions: POST_EXPANSIONS,
      max_results: String(clampMaxResults(params.maxResults, 10, 100, 10)),
    });
    if (params.nextToken) query.set("pagination_token", params.nextToken);
    return this.get(`/tweets/${encodeURIComponent(postId)}/quote_tweets?${query}`);
  }

  searchSpaces(params: { query: string; maxResults?: number; state?: "live" | "scheduled" | "all" }): Promise<unknown> {
    const query = new URLSearchParams({
      query: params.query,
      "space.fields": [
        "id",
        "title",
        "state",
        "created_at",
        "started_at",
        "scheduled_start",
        "ended_at",
        "lang",
        "is_ticketed",
        "host_ids",
        "speaker_ids",
        "participant_count",
        "subscriber_count",
        "topic_ids",
      ].join(","),
      "user.fields": USER_FIELDS,
      expansions: ["host_ids", "speaker_ids", "creator_id", "invited_user_ids", "topic_ids"].join(","),
    });
    if (params.state) query.set("state", params.state);
    if (params.maxResults) query.set("max_results", String(clampMaxResults(params.maxResults, 1, 100, 10)));
    return this.get(`/spaces/search?${query}`);
  }

  getUsage(): Promise<unknown> {
    return this.get("/usage/tweets");
  }

  private getTimeline(path: string, params: TimelineParams): Promise<XListResponse<XPost>> {
    const query = new URLSearchParams({
      "tweet.fields": TWEET_FIELDS,
      "user.fields": USER_FIELDS,
      "media.fields": MEDIA_FIELDS,
      expansions: POST_EXPANSIONS,
      max_results: String(clampMaxResults(params.maxResults, 5, 100, 10)),
    });
    if (params.nextToken) query.set("pagination_token", params.nextToken);
    if (params.sinceId) query.set("since_id", params.sinceId);
    if (params.untilId) query.set("until_id", params.untilId);
    if (params.startTime) query.set("start_time", params.startTime);
    if (params.endTime) query.set("end_time", params.endTime);
    if (params.exclude?.length) query.set("exclude", params.exclude.join(","));
    return this.get(`${path}?${query}`);
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "User-Agent": this.userAgent,
      },
    });

    const rateLimit: XRateLimit = {
      limit: response.headers.get("x-rate-limit-limit") ?? undefined,
      remaining: response.headers.get("x-rate-limit-remaining") ?? undefined,
      reset: response.headers.get("x-rate-limit-reset") ?? undefined,
    };

    let body: unknown = undefined;
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      const errorBody = (typeof body === "object" && body ? body : {}) as XApiErrorBody;
      const nested = errorBody.errors?.[0];
      const title = errorBody.title ?? nested?.title;
      const detail = errorBody.detail ?? nested?.detail ?? nested?.message;
      throw new XApiError(formatApiError(response.status, title, detail, rateLimit), {
        status: response.status,
        title,
        detail,
        rateLimit,
        body,
      });
    }

    return body as T;
  }
}

export function resolveBearerToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const token =
    firstNonEmpty(env.X_BEARER_TOKEN, env.BEARER_TOKEN, env.TWITTER_BEARER_TOKEN, env.X_API_BEARER_TOKEN);
  return token;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function clampMaxResults(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function formatApiError(status: number, title?: string, detail?: string, rateLimit?: XRateLimit): string {
  const parts = [`X API request failed (${status})`];
  if (title) parts.push(title);
  if (detail) parts.push(detail);
  if (status === 401 || status === 403) {
    parts.push("Check that X_BEARER_TOKEN is valid and that this endpoint is included in your API plan.");
  }
  if (status === 429) {
    const reset = rateLimit?.reset ? ` Rate limit resets at unix ${rateLimit.reset}.` : "";
    parts.push(`Rate limited.${reset} Wait and retry, or reduce search/timeline volume.`);
  }
  return parts.join(" — ");
}
