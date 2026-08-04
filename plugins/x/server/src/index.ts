import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { XApiError, XClient, resolveBearerToken } from "./client.ts";
import { formatPostList, formatUserList, sortPostsChronologically } from "./format.ts";
import { looksLikeUserId, parsePostId, parsePostIds, parseUsername } from "./parse.ts";

const server = new McpServer({
  name: "x",
  version: "0.1.0",
});

function getClient(): XClient {
  const bearerToken = resolveBearerToken();
  if (!bearerToken) {
    throw new Error(
      "Missing X bearer token. Set X_BEARER_TOKEN in Cursor Settings → Plugins → X → Configure, or export X_BEARER_TOKEN. Create an app-only token at https://developer.x.com/en/portal/dashboard."
    );
  }
  return new XClient({ bearerToken });
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(error: unknown) {
  if (error instanceof XApiError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              error: error.message,
              status: error.status,
              title: error.title,
              detail: error.detail,
              rate_limit: error.rateLimit,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }],
  };
}

async function resolveUserId(client: XClient, usernameOrId: string): Promise<string> {
  if (looksLikeUserId(usernameOrId)) {
    return usernameOrId.trim();
  }
  const username = parseUsername(usernameOrId);
  const response = await client.getUserByUsername(username);
  const user = Array.isArray(response.data) ? response.data[0] : response.data;
  if (!user?.id) {
    throw new Error(`User @${username} was not found.`);
  }
  return user.id;
}

server.tool(
  "search_posts",
  "Search recent public posts on X from the last 7 days. Supports X query operators such as from:user, to:user, lang:en, is:reply, is:retweet, has:links, has:media, conversation_id:ID, url:example.com, and quoted phrases. This plugin is read-only.",
  {
    query: z.string().min(1).describe("X recent-search query. Example: from:openai -is:retweet lang:en"),
    max_results: z.number().int().min(10).max(100).optional().describe("Number of posts to return (10-100). Defaults to 10."),
    next_token: z.string().optional().describe("Pagination token from a previous search_posts response."),
    sort_order: z.enum(["recency", "relevancy"]).optional().describe("recency (default) or relevancy"),
    start_time: z.string().optional().describe("ISO 8601 lower bound, e.g. 2026-08-01T00:00:00Z"),
    end_time: z.string().optional().describe("ISO 8601 upper bound"),
    since_id: z.string().optional().describe("Return posts newer than this post ID"),
    until_id: z.string().optional().describe("Return posts older than this post ID"),
  },
  async ({ query, max_results, next_token, sort_order, start_time, end_time, since_id, until_id }) => {
    try {
      const result = await getClient().searchPosts({
        query,
        maxResults: max_results,
        nextToken: next_token,
        sortOrder: sort_order,
        startTime: start_time,
        endTime: end_time,
        sinceId: since_id,
        untilId: until_id,
      });
      return jsonResult(formatPostList(result));
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "get_posts",
  "Look up one or more posts by ID or by x.com / twitter.com status URL.",
  {
    ids: z
      .array(z.string().min(1))
      .min(1)
      .max(100)
      .describe("Post IDs or status URLs, e.g. 1234567890 or https://x.com/user/status/1234567890"),
  },
  async ({ ids }) => {
    try {
      const postIds = parsePostIds(ids);
      const result = await getClient().getPosts(postIds);
      return jsonResult(formatPostList(result));
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "get_user",
  "Look up a single X user by username (with or without @) or numeric user ID.",
  {
    username_or_id: z.string().min(1).describe("Username such as openai or @openai, or a numeric user ID"),
  },
  async ({ username_or_id }) => {
    try {
      const client = getClient();
      const result = looksLikeUserId(username_or_id)
        ? await client.getUsersByIds([username_or_id.trim()])
        : await client.getUserByUsername(parseUsername(username_or_id));
      return jsonResult(formatUserList(result));
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "get_users",
  "Look up multiple X users by username or numeric user ID.",
  {
    usernames: z.array(z.string().min(1)).max(100).optional().describe("Usernames, with or without @"),
    ids: z.array(z.string().min(1)).max(100).optional().describe("Numeric user IDs"),
  },
  async ({ usernames, ids }) => {
    try {
      if ((!usernames || usernames.length === 0) && (!ids || ids.length === 0)) {
        throw new Error("Provide at least one username or user ID.");
      }
      const client = getClient();
      const users = [];
      const errors = [];
      if (usernames?.length) {
        const result = await client.getUsersByUsernames(usernames.map(parseUsername));
        users.push(...formatUserList(result).data);
        if (result.errors) errors.push(...result.errors);
      }
      if (ids?.length) {
        const result = await client.getUsersByIds(ids);
        users.push(...formatUserList(result).data);
        if (result.errors) errors.push(...result.errors);
      }
      return jsonResult({ data: users, errors: errors.length ? errors : undefined });
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "get_user_posts",
  "Get recent posts authored by a user. Accepts a username or numeric user ID. Does not include the authenticated home timeline.",
  {
    username_or_id: z.string().min(1).describe("Username or numeric user ID"),
    max_results: z.number().int().min(5).max(100).optional().describe("Number of posts to return (5-100). Defaults to 10."),
    next_token: z.string().optional().describe("Pagination token from a previous get_user_posts response."),
    exclude_replies: z.boolean().optional().describe("If true, omit replies"),
    exclude_reposts: z.boolean().optional().describe("If true, omit reposts"),
    start_time: z.string().optional().describe("ISO 8601 lower bound"),
    end_time: z.string().optional().describe("ISO 8601 upper bound"),
    since_id: z.string().optional(),
    until_id: z.string().optional(),
  },
  async (args) => {
    try {
      const client = getClient();
      const userId = await resolveUserId(client, args.username_or_id);
      const exclude: Array<"replies" | "retweets"> = [];
      if (args.exclude_replies) exclude.push("replies");
      if (args.exclude_reposts) exclude.push("retweets");
      const result = await client.getUserPosts(userId, {
        maxResults: args.max_results,
        nextToken: args.next_token,
        startTime: args.start_time,
        endTime: args.end_time,
        sinceId: args.since_id,
        untilId: args.until_id,
        exclude: exclude.length ? exclude : undefined,
      });
      return jsonResult(formatPostList(result));
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "get_user_mentions",
  "Get recent posts that mention a user. Accepts a username or numeric user ID.",
  {
    username_or_id: z.string().min(1).describe("Username or numeric user ID"),
    max_results: z.number().int().min(5).max(100).optional(),
    next_token: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    since_id: z.string().optional(),
    until_id: z.string().optional(),
  },
  async (args) => {
    try {
      const client = getClient();
      const userId = await resolveUserId(client, args.username_or_id);
      const result = await client.getUserMentions(userId, {
        maxResults: args.max_results,
        nextToken: args.next_token,
        startTime: args.start_time,
        endTime: args.end_time,
        sinceId: args.since_id,
        untilId: args.until_id,
      });
      return jsonResult(formatPostList(result));
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "get_thread",
  "Fetch a conversation thread for a post ID or status URL. Resolves the conversation_id, then searches recent posts in that thread.",
  {
    id_or_url: z.string().min(1).describe("Post ID or x.com / twitter.com status URL"),
    max_results: z.number().int().min(10).max(100).optional().describe("Max thread posts to return (10-100). Defaults to 50."),
  },
  async ({ id_or_url, max_results }) => {
    try {
      const client = getClient();
      const postId = parsePostId(id_or_url);
      const lookup = await client.getPosts([postId]);
      const root = Array.isArray(lookup.data) ? lookup.data[0] : lookup.data;
      if (!root) {
        throw new Error(`Post ${postId} was not found or is not available on your API plan.`);
      }
      const conversationId = root.conversation_id ?? postId;
      const search = await client.searchPosts({
        query: `conversation_id:${conversationId}`,
        maxResults: max_results ?? 50,
        sortOrder: "recency",
      });
      const formatted = formatPostList(search);
      formatted.data = sortPostsChronologically(formatted.data);
      return jsonResult({
        conversation_id: conversationId,
        root_post_id: postId,
        ...formatted,
      });
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "get_quote_posts",
  "List recent quote posts of a given post.",
  {
    id_or_url: z.string().min(1).describe("Original post ID or status URL"),
    max_results: z.number().int().min(10).max(100).optional(),
    next_token: z.string().optional(),
  },
  async ({ id_or_url, max_results, next_token }) => {
    try {
      const result = await getClient().getQuotePosts(parsePostId(id_or_url), {
        maxResults: max_results,
        nextToken: next_token,
      });
      return jsonResult(formatPostList(result));
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "search_spaces",
  "Search X Spaces by keyword. Availability depends on your X API plan.",
  {
    query: z.string().min(1).describe("Keyword query for Spaces"),
    state: z.enum(["live", "scheduled", "all"]).optional().describe("Filter by Space state. Defaults to all live+scheduled depending on API defaults."),
    max_results: z.number().int().min(1).max(100).optional(),
  },
  async ({ query, state, max_results }) => {
    try {
      const result = await getClient().searchSpaces({ query, state, maxResults: max_results });
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.tool(
  "get_api_usage",
  "Show recent X API project usage for post reads. Useful before running broader searches so you do not burn monthly quota.",
  async () => {
    try {
      return jsonResult(await getClient().getUsage());
    } catch (error) {
      return errorResult(error);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
