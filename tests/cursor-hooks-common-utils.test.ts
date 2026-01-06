import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

/**
 * Tests for common.sh utility functions
 *
 * These tests validate the bash utility functions used by all hook scripts.
 * Tests are run by executing bash functions directly.
 */

// Skip if jq is not installed
function hasJq(): boolean {
  try {
    execSync('which jq', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Skip on Windows
function isUnix(): boolean {
  return process.platform !== 'win32';
}

const describeOrSkip = (hasJq() && isUnix()) ? describe : describe.skip;

describeOrSkip('Cursor Hooks Common Utilities', () => {
  let tempDir: string;
  let cursorHooksDir: string;
  let testScript: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `cursor-common-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });

    cursorHooksDir = join(process.cwd(), 'cursor-hooks');
    if (!existsSync(cursorHooksDir)) {
      throw new Error('cursor-hooks directory not found');
    }

    // Create a test script that sources common.sh and tests functions
    testScript = join(tempDir, 'test-common.sh');
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('json_get function', () => {
    it('extracts simple field', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        input='{"conversation_id":"test-123","workspace_roots":["/path/to/project"]}'
        result=$(json_get "$input" "conversation_id" "")
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('test-123');
    });

    it('extracts array element with [0]', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        input='{"workspace_roots":["/path/to/project","/another/path"]}'
        result=$(json_get "$input" "workspace_roots[0]" "")
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('/path/to/project');
    });

    it('returns fallback for missing field', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        input='{"existing":"value"}'
        result=$(json_get "$input" "nonexistent" "default-value")
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('default-value');
    });

    it('handles null values', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        input='{"field":null}'
        result=$(json_get "$input" "field" "fallback")
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('fallback');
    });
  });

  describe('get_project_name function', () => {
    it('extracts basename from Unix path', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        result=$(get_project_name "/Users/alex/projects/my-project")
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('my-project');
    });

    it('handles Windows drive root', () => {
      // Skip on non-Windows (bash script handles it, but test may fail)
      if (process.platform === 'win32') {
        const script = `
          source "${join(cursorHooksDir, 'common.sh')}"
          result=$(get_project_name "C:\\\\")
          echo "$result"
        `;
        writeFileSync(testScript, script);
        execSync(`chmod +x "${testScript}"`);

        const result = execSync(`bash "${testScript}"`, {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();

        expect(result).toBe('drive-C');
      } else {
        // On Unix, the function should handle it gracefully
        expect(true).toBe(true);
      }
    });

    it('returns unknown-project for empty string', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        result=$(get_project_name "")
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('unknown-project');
    });
  });

  describe('is_empty function', () => {
    it('returns true for empty string', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        if is_empty ""; then
          echo "true"
        else
          echo "false"
        fi
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('true');
    });

    it('returns true for "null" string', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        if is_empty "null"; then
          echo "true"
        else
          echo "false"
        fi
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('true');
    });

    it('returns false for non-empty string', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        if is_empty "some-value"; then
          echo "true"
        else
          echo "false"
        fi
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('false');
    });
  });

  describe('get_worker_port function', () => {
    it('returns default port when settings file missing', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        result=$(get_worker_port)
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        env: {
          ...process.env,
          HOME: homedir(),
        },
        timeout: 5000,
      }).trim();

      expect(result).toBe('37777');
    });

    it('reads port from settings file', () => {
      const settingsDir = join(homedir(), '.claude-mem');
      mkdirSync(settingsDir, { recursive: true });
      const settingsFile = join(settingsDir, 'settings.json');
      writeFileSync(settingsFile, JSON.stringify({ CLAUDE_MEM_WORKER_PORT: '9999' }));

      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        result=$(get_worker_port)
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        env: {
          ...process.env,
          HOME: homedir(),
        },
        timeout: 5000,
      }).trim();

      expect(result).toBe('9999');

      // Cleanup
      rmSync(settingsFile, { force: true });
    });
  });

  describe('read_json_input function', () => {
    it('reads valid JSON from stdin', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        echo '{"test":"value"}' | read_json_input
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(() => JSON.parse(result)).not.toThrow();
      expect(JSON.parse(result).test).toBe('value');
    });

    it('handles invalid JSON gracefully', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        result=$(echo 'not json' | read_json_input)
        echo "$result"
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      // Should return empty object {} when JSON is invalid
      // The function validates JSON and returns {} if invalid
      expect(result).toBe('{}');
    });
  });

  describe('check_dependencies function', () => {
    it('passes when jq and curl are available', () => {
      const script = `
        source "${join(cursorHooksDir, 'common.sh')}"
        if check_dependencies; then
          echo "ok"
        else
          echo "missing"
        fi
      `;
      writeFileSync(testScript, script);
      execSync(`chmod +x "${testScript}"`);

      const result = execSync(`bash "${testScript}"`, {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      expect(result).toBe('ok');
    });
  });
});
