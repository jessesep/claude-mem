/**
 * User Message Hook - SessionStart
 * Displays context information to the user via stderr
 *
 * This hook runs in parallel with context-hook to show users what context
 * has been loaded into their session. Uses stderr as the communication channel
 * since it's currently the only way to display messages in Claude Code UI.
 */
import { basename } from "path";
import { ensureWorkerRunning, getWorkerPort } from "../shared/worker-utils.js";
import { HOOK_EXIT_CODES } from "../shared/hook-constants.js";
import { logger } from "../utils/logger.js";

// Ensure worker is running
await ensureWorkerRunning();

const port = getWorkerPort();
const project = basename(process.cwd());

// Fetch formatted context directly from worker API
// Note: Removed AbortSignal.timeout to avoid Windows Bun cleanup issue (libuv assertion)
const response = await fetch(
  `http://127.0.0.1:${port}/api/context/inject?project=${encodeURIComponent(project)}&colors=true`,
  { method: 'GET' }
);

if (!response.ok) {
  const errorText = await response.text().catch(() => 'Unknown error');
  // Don't throw - this is informational only, allow session to continue
  logger.warn('HOOK', `Failed to fetch context for display (${response.status}): ${errorText}`);
  process.exit(HOOK_EXIT_CODES.USER_MESSAGE_ONLY);
}

const output = await response.text();

console.error(
  "\n\n📝 Claude-Mem Context Loaded\n" +
  "   ℹ️  Note: This appears as stderr but is informational only\n\n" +
  output +
  "\n\n💡 New! Wrap all or part of any message with <private> ... </private> to prevent storing sensitive information in your observation history.\n" +
  "\n💬 Community https://discord.gg/J4wttp9vDu" +
  `\n📺 Watch live in browser http://localhost:${port}/\n`
);

process.exit(HOOK_EXIT_CODES.USER_MESSAGE_ONLY);