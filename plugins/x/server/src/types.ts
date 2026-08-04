export type JsonObject = Record<string, unknown>;

export interface XApiErrorBody {
  title?: string;
  detail?: string;
  type?: string;
  status?: number;
  errors?: Array<{ message?: string; title?: string; detail?: string }>;
}

export interface XRateLimit {
  limit?: string;
  remaining?: string;
  reset?: string;
}

export interface PublicMetrics {
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  listed_count?: number;
}

export interface XUser {
  id: string;
  name?: string;
  username?: string;
  description?: string;
  created_at?: string;
  verified?: boolean;
  verified_type?: string;
  profile_image_url?: string;
  location?: string;
  url?: string;
  protected?: boolean;
  pinned_tweet_id?: string;
  public_metrics?: PublicMetrics;
}

export interface XMedia {
  media_key: string;
  type?: string;
  url?: string;
  preview_image_url?: string;
  alt_text?: string;
  duration_ms?: number;
  height?: number;
  width?: number;
  public_metrics?: PublicMetrics;
}

export interface XReferencedTweet {
  type: string;
  id: string;
}

export interface XPost {
  id: string;
  text?: string;
  created_at?: string;
  author_id?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  lang?: string;
  possibly_sensitive?: boolean;
  reply_settings?: string;
  note_tweet?: { text?: string };
  referenced_tweets?: XReferencedTweet[];
  public_metrics?: PublicMetrics;
  attachments?: { media_keys?: string[] };
  entities?: JsonObject;
  edit_history_tweet_ids?: string[];
}

export interface XMeta {
  result_count?: number;
  newest_id?: string;
  oldest_id?: string;
  next_token?: string;
  previous_token?: string;
}

export interface XIncludes {
  users?: XUser[];
  tweets?: XPost[];
  media?: XMedia[];
}

export interface XListResponse<T> {
  data?: T | T[];
  includes?: XIncludes;
  meta?: XMeta;
  errors?: Array<{ title?: string; detail?: string; resource_id?: string; value?: string }>;
}

export interface SearchPostsParams {
  query: string;
  maxResults?: number;
  nextToken?: string;
  sinceId?: string;
  untilId?: string;
  startTime?: string;
  endTime?: string;
  sortOrder?: "recency" | "relevancy";
}

export interface TimelineParams {
  maxResults?: number;
  nextToken?: string;
  sinceId?: string;
  untilId?: string;
  startTime?: string;
  endTime?: string;
  exclude?: Array<"replies" | "retweets">;
}

export interface FormattedUser {
  id: string;
  name?: string;
  username?: string;
  url?: string;
  description?: string;
  created_at?: string;
  verified?: boolean;
  verified_type?: string;
  location?: string;
  protected?: boolean;
  profile_image_url?: string;
  pinned_tweet_id?: string;
  metrics?: {
    followers?: number;
    following?: number;
    posts?: number;
    listed?: number;
  };
}

export interface FormattedMedia {
  media_key: string;
  type?: string;
  url?: string;
  preview_image_url?: string;
  alt_text?: string;
  duration_ms?: number;
  width?: number;
  height?: number;
}

export interface FormattedPost {
  id: string;
  url?: string;
  text: string;
  created_at?: string;
  lang?: string;
  conversation_id?: string;
  author?: FormattedUser;
  metrics?: {
    likes?: number;
    reposts?: number;
    replies?: number;
    quotes?: number;
    bookmarks?: number;
    impressions?: number;
  };
  reply_to_user_id?: string;
  referenced?: XReferencedTweet[];
  entities?: JsonObject;
  media?: FormattedMedia[];
  possibly_sensitive?: boolean;
}

export interface FormattedListResult<T> {
  data: T[];
  meta?: {
    result_count?: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
    previous_token?: string;
  };
  errors?: Array<{ title?: string; detail?: string; resource_id?: string; value?: string }>;
}
