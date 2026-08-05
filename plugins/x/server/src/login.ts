import { createInterface } from "node:readline/promises";
import { DEFAULT_SCOPES, defaultTokenFilePath } from "./auth.ts";
import { startLoginFlow } from "./login-flow.ts";

interface CliOptions {
  scopes?: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scopes") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--scopes requires a value, e.g. --scopes "tweet.read users.read bookmark.read offline.access"');
      }
      options.scopes = value.split(/[\s,]+/).filter(Boolean);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run login [-- --scopes \"scope1 scope2 ...\"]");
      console.log(`Default scopes: ${DEFAULT_SCOPES.join(" ")}`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function promptForCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  const envId = process.env.X_OAUTH_CLIENT_ID?.trim();
  const envSecret = process.env.X_OAUTH_CLIENT_SECRET?.trim();
  if (envId && envSecret) {
    console.log("Using client credentials from X_OAUTH_CLIENT_ID / X_OAUTH_CLIENT_SECRET.");
    return { clientId: envId, clientSecret: envSecret };
  }

  console.log("Enter the OAuth 2.0 credentials from your X app (Developer Portal → your app → Keys and tokens).");
  console.log("The app must be a confidential (Web App) client with redirect URI http://127.0.0.1:8917/callback registered.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const clientId = envId || (await rl.question("OAuth 2.0 Client ID: ")).trim();
    const clientSecret = envSecret || (await rl.question("OAuth 2.0 Client Secret: ")).trim();
    if (!clientId || !clientSecret) {
      throw new Error("Both the client ID and client secret are required.");
    }
    return { clientId, clientSecret };
  } finally {
    rl.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { clientId, clientSecret } = await promptForCredentials();

  const flow = await startLoginFlow({ clientId, clientSecret, scopes: options.scopes, openBrowser: true });
  console.log("\nOpening your browser to authorize. If it does not open, visit:");
  console.log(`\n  ${flow.authorizeUrl}\n`);

  const stored = await flow.completion;
  console.log(`Logged in as @${stored.username ?? stored.user_id}.`);
  console.log(`Tokens saved to ${defaultTokenFilePath()} (mode 0600).`);
  console.log("The MCP server refreshes these automatically. get_bookmarks, get_home_timeline, and get_liked_posts are ready.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
