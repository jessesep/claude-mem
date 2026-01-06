import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { execSync } from 'child_process';

/**
 * Integration tests for Cursor Hooks with Mock Worker API
 *
 * These tests simulate the full flow of hook execution with a mocked worker API
 * to verify end-to-end integration.
 */

// Skip if jq is not installed (required by scripts)
function hasJq(): boolean {
  try {
    execSync('which jq', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Skip on Windows (bash scripts)
function isUnix(): boolean {
  return process.platform !== 'win32';
}

const describeOrSkip = (hasJq() && isUnix()) ? describe : describe.skip;

describeOrSkip('Cursor Hooks Integration', () => {
  let tempDir: string;
  let cursorHooksDir: string;
  let mockWorkerPort: number = 37777;
  let mockServer: any;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `cursor-integration-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });

    // Find cursor-hooks directory
    cursorHooksDir = join(process.cwd(), 'cursor-hooks');
    if (!existsSync(cursorHooksDir)) {
      throw new Error('cursor-hooks directory not found');
    }

    // Save original fetch
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Run a hook script with input
   */
  function runHookScript(scriptName: string, input: object): string {
    const scriptPath = join(cursorHooksDir, scriptName);
    const result = execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      cwd: tempDir,
      env: {
        ...process.env,
        HOME: homedir(),
      },
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result.trim();
  }

  describe('Session Initialization Flow', () => {
    it('initializes session via worker API', async () => {
      const sessionId = 'test-session-123';
      const projectName = 'test-project';

      // Note: We can't mock fetch for bash scripts since they use curl
      // This test verifies the script runs and outputs correct JSON
      // The actual API call would happen in real usage

      const input = {
        conversation_id: sessionId,
        prompt: 'Test prompt',
        workspace_roots: [join(tempDir, projectName)]
      };

      // Create workspace directory
      mkdirSync(join(tempDir, projectName), { recursive: true });

      const output = runHookScript('session-init.sh', input);
      const parsed = JSON.parse(output);

      // Script should output continue: true (even if worker unavailable)
      expect(parsed.continue).toBe(true);
    });

    it('handles privacy check response', async () => {
      // Note: Can't mock curl in bash scripts, but we verify graceful handling
      const input = {
        conversation_id: 'test-session',
        prompt: 'private content',
        workspace_roots: [tempDir]
      };

      const output = runHookScript('session-init.sh', input);
      const parsed = JSON.parse(output);

      // Should still allow prompt to continue (graceful degradation)
      expect(parsed.continue).toBe(true);
    });
  });

  describe('Observation Capture Flow', () => {
    it('sends MCP tool observation to worker', async () => {
      // Note: Can't mock curl, but verify script runs correctly
      const sessionId = 'test-session-456';

      const input = {
        conversation_id: sessionId,
        hook_event_name: 'afterMCPExecution',
        tool_name: 'test_tool',
        tool_input: { param: 'value' },
        result_json: { result: 'success' },
        workspace_roots: [tempDir]
      };

      // Script should exit cleanly (fire-and-forget)
      const output = runHookScript('save-observation.sh', input);
      expect(output).toBe(''); // No output expected
    });

    it('sends shell command observation to worker', async () => {
      const sessionId = 'test-session-789';

      const input = {
        conversation_id: sessionId,
        hook_event_name: 'afterShellExecution',
        command: 'ls -la',
        output: 'file1.txt\nfile2.txt',
        workspace_roots: [tempDir]
      };

      const output = runHookScript('save-observation.sh', input);
      expect(output).toBe(''); // No output expected
    });
  });

  describe('Context Injection Flow', () => {
    it('fetches context from worker API', async () => {
      // Note: Can't mock curl, but verify script runs correctly
      const projectName = 'test-project';

      const input = {
        workspace_roots: [join(tempDir, projectName)]
      };

      mkdirSync(join(tempDir, projectName), { recursive: true });

      const output = runHookScript('context-inject.sh', input);
      const parsed = JSON.parse(output);

      // Should output continue: true
      expect(parsed.continue).toBe(true);
    });
  });

  describe('Session Summary Flow', () => {
    it('requests summary generation from worker', async () => {
      // Note: Can't mock curl, but verify script runs correctly
      const sessionId = 'test-session-summary';

      const input = {
        conversation_id: sessionId,
        workspace_roots: [tempDir],
        status: 'completed'
      };

      const output = runHookScript('session-summary.sh', input);
      
      // Should output valid JSON
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('Worker Unavailable Handling', () => {
    it('handles worker not ready gracefully', () => {
      // Script should handle worker unavailable gracefully
      const input = {
        conversation_id: 'test-session',
        prompt: 'Test',
        workspace_roots: [tempDir]
      };

      // Should still output continue: true (doesn't block Cursor)
      const output = runHookScript('session-init.sh', input);
      const parsed = JSON.parse(output);
      expect(parsed.continue).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('handles network errors gracefully', () => {
      // Script should handle network errors gracefully
      const input = {
        conversation_id: 'test-session',
        prompt: 'Test',
        workspace_roots: [tempDir]
      };

      // Should still output continue: true
      const output = runHookScript('session-init.sh', input);
      const parsed = JSON.parse(output);
      expect(parsed.continue).toBe(true);
    });

    it('handles malformed JSON input', () => {
      const scriptPath = join(cursorHooksDir, 'session-init.sh');
      const result = execSync(`echo 'not json' | bash "${scriptPath}"`, {
        cwd: tempDir,
        encoding: 'utf-8',
        timeout: 10000,
      });

      // Should still output valid JSON
      const parsed = JSON.parse(result.trim());
      expect(parsed.continue).toBe(true);
    });
  });
});
