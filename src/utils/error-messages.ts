/**
 * Platform-aware error message generator for worker connection failures
 */

export interface WorkerErrorMessageOptions {
  port?: number;
  includeSkillFallback?: boolean;
  customPrefix?: string;
  actualError?: string;
  platform?: 'windows' | 'macos' | 'linux';
}

/**
 * Generate platform-specific worker restart instructions
 * @param options Configuration for error message generation
 * @returns Formatted error message with platform-specific paths and commands
 */
export function getWorkerRestartInstructions(
  options: WorkerErrorMessageOptions = {}
): string {
  const {
    port,
    includeSkillFallback = false,
    customPrefix,
    actualError,
    platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'
  } = options;

  // Build error message
  const prefix = customPrefix || 'Worker service connection failed.';
  const portInfo = port ? ` (port ${port})` : '';

  let message = `${prefix}${portInfo}\n\n`;
  message += `🔧 Quick Fix:\n`;
  message += `1. Exit Claude Code completely\n`;
  
  if (platform === 'windows') {
    message += `2. Open PowerShell and run:\n`;
    message += `   cd ~/.claude/plugins/marketplaces/thedotmack\n`;
    message += `   npm run worker:restart\n`;
  } else {
    message += `2. Run: npm run worker:restart\n`;
  }
  
  message += `3. Restart Claude Code\n\n`;
  
  message += `💡 If the problem persists:\n`;
  message += `   • Check worker logs: npm run worker:logs\n`;
  message += `   • Verify worker status: npm run worker:status\n`;
  message += `   • See troubleshooting guide: https://docs.claude-mem.ai/troubleshooting`;

  if (includeSkillFallback) {
    message += `\n\n💬 Or ask Claude: "troubleshoot claude-mem"`;
  }

  // Prepend actual error if provided
  if (actualError) {
    message = `❌ Error: ${actualError}\n\n${message}`;
  }

  return message;
}

/**
 * Generate user-friendly error message for common issues
 */
export function getUserFriendlyError(error: unknown, context?: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Common error patterns with helpful solutions
  const errorPatterns: Array<{ pattern: RegExp; solution: string }> = [
    {
      pattern: /ECONNREFUSED|connection refused/i,
      solution: 'The worker service is not running. Try: npm run worker:start'
    },
    {
      pattern: /port.*in use|EADDRINUSE/i,
      solution: 'Port is already in use. Try: npm run worker:stop, then npm run worker:start'
    },
    {
      pattern: /ENOENT|no such file|not found/i,
      solution: 'A required file is missing. Try: npm run build to rebuild the plugin'
    },
    {
      pattern: /permission denied|EACCES/i,
      solution: 'Permission denied. Check file permissions or run with appropriate privileges'
    },
    {
      pattern: /timeout|ETIMEDOUT/i,
      solution: 'Operation timed out. The worker may be overloaded. Try restarting: npm run worker:restart'
    },
    {
      pattern: /database.*locked|SQLITE_BUSY/i,
      solution: 'Database is locked. Another process may be using it. Try: npm run worker:restart'
    }
  ];

  // Find matching pattern
  for (const { pattern, solution } of errorPatterns) {
    if (pattern.test(errorMessage)) {
      return `${errorMessage}\n\n💡 Solution: ${solution}`;
    }
  }

  // Default error message
  let message = errorMessage;
  if (context) {
    message = `${context}: ${message}`;
  }
  
  return message;
}
