import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { execSync, spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

/**
 * Tests for PowerShell Cursor Hook Scripts
 *
 * These tests validate PowerShell (.ps1) hook scripts on Windows.
 * On non-Windows platforms, these tests are skipped.
 */

// Skip these tests on non-Windows platforms
const describeOrSkip = process.platform === 'win32' ? describe : describe.skip;

describeOrSkip('Cursor Hooks PowerShell Scripts', () => {
  let tempDir: string;
  let cursorHooksDir: string;
  let mockWorkerPort: number = 37777;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `cursor-ps-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });

    // Find cursor-hooks directory
    cursorHooksDir = join(process.cwd(), 'cursor-hooks');
    if (!existsSync(cursorHooksDir)) {
      throw new Error('cursor-hooks directory not found');
    }
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Run a PowerShell hook script with input and return the output
   */
  function runPowerShellHook(scriptName: string, input: object): string {
    const scriptPath = join(cursorHooksDir, scriptName);

    if (!existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`);
    }

    const inputJson = JSON.stringify(input);
    const result = execSync(
      `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
      {
        input: inputJson,
        cwd: tempDir,
        env: {
          ...process.env,
          HOME: homedir(),
        },
        encoding: 'utf-8',
        timeout: 10000,
      }
    );

    return result.trim();
  }

  describe('session-init.ps1 (beforeSubmitPrompt)', () => {
    it('outputs {"continue": true} for valid input', () => {
      const input = {
        conversation_id: 'test-conv-123',
        prompt: 'Hello world',
        workspace_roots: [tempDir]
      };

      const output = runPowerShellHook('session-init.ps1', input);
      const parsed = JSON.parse(output);

      expect(parsed.continue).toBe(true);
    });

    it('outputs {"continue": true} even with empty input', () => {
      const output = runPowerShellHook('session-init.ps1', {});
      const parsed = JSON.parse(output);

      expect(parsed.continue).toBe(true);
    });

    it('output is valid JSON', () => {
      const input = {
        conversation_id: 'test-123',
        prompt: 'Test prompt'
      };

      const output = runPowerShellHook('session-init.ps1', input);
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('handles missing conversation_id gracefully', () => {
      const input = {
        generation_id: 'gen-456',
        prompt: 'Test'
      };

      const output = runPowerShellHook('session-init.ps1', input);
      const parsed = JSON.parse(output);
      expect(parsed.continue).toBe(true);
    });
  });

  describe('context-inject.ps1 (beforeSubmitPrompt)', () => {
    it('outputs {"continue": true} for valid input', () => {
      const input = {
        workspace_roots: [tempDir]
      };

      const output = runPowerShellHook('context-inject.ps1', input);
      const parsed = JSON.parse(output);

      expect(parsed.continue).toBe(true);
    });

    it('outputs {"continue": true} even with empty input', () => {
      const output = runPowerShellHook('context-inject.ps1', {});
      const parsed = JSON.parse(output);

      expect(parsed.continue).toBe(true);
    });
  });

  describe('save-observation.ps1 (afterMCPExecution)', () => {
    it('exits cleanly with no output for valid MCP input', () => {
      const input = {
        conversation_id: 'test-conv-789',
        hook_event_name: 'afterMCPExecution',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
        result_json: { output: 'file1.txt' },
        workspace_roots: [tempDir]
      };

      const scriptPath = join(cursorHooksDir, 'save-observation.ps1');
      const result = execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
        {
          input: JSON.stringify(input),
          cwd: tempDir,
          encoding: 'utf-8',
          timeout: 10000,
        }
      );

      // Should be empty or just whitespace
      expect(result.trim()).toBe('');
    });

    it('exits cleanly for shell execution input', () => {
      const input = {
        conversation_id: 'test-conv-101',
        hook_event_name: 'afterShellExecution',
        command: 'ls -la',
        output: 'file1.txt\nfile2.txt',
        workspace_roots: [tempDir]
      };

      const scriptPath = join(cursorHooksDir, 'save-observation.ps1');
      const result = execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
        {
          input: JSON.stringify(input),
          cwd: tempDir,
          encoding: 'utf-8',
          timeout: 10000,
        }
      );

      expect(result.trim()).toBe('');
    });
  });

  describe('save-file-edit.ps1 (afterFileEdit)', () => {
    it('exits cleanly with valid file edit input', () => {
      const input = {
        conversation_id: 'test-conv-edit',
        file_path: 'C:\\path\\to\\file.ts',
        edits: [
          { old_string: 'old code', new_string: 'new code' }
        ],
        workspace_roots: [tempDir]
      };

      const scriptPath = join(cursorHooksDir, 'save-file-edit.ps1');
      const result = execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
        {
          input: JSON.stringify(input),
          cwd: tempDir,
          encoding: 'utf-8',
          timeout: 10000,
        }
      );

      expect(result.trim()).toBe('');
    });
  });

  describe('session-summary.ps1 (stop)', () => {
    it('outputs valid JSON for typical input', () => {
      const input = {
        conversation_id: 'test-conv-456',
        workspace_roots: [tempDir],
        status: 'completed'
      };

      const scriptPath = join(cursorHooksDir, 'session-summary.ps1');
      const result = execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
        {
          input: JSON.stringify(input),
          cwd: tempDir,
          encoding: 'utf-8',
          timeout: 10000,
        }
      );

      expect(() => JSON.parse(result.trim())).not.toThrow();
    });

    it('outputs empty object {} when nothing to report', () => {
      const input = {};

      const scriptPath = join(cursorHooksDir, 'session-summary.ps1');
      const result = execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
        {
          input: JSON.stringify(input),
          cwd: tempDir,
          encoding: 'utf-8',
          timeout: 10000,
        }
      );

      const parsed = JSON.parse(result.trim());
      expect(parsed).toEqual({});
    });
  });

  describe('common.ps1 utilities', () => {
    it('handles Windows paths correctly', () => {
      const input = {
        conversation_id: 'test',
        workspace_roots: ['C:\\Users\\test\\project']
      };

      const output = runPowerShellHook('session-init.ps1', input);
      const parsed = JSON.parse(output);
      expect(parsed.continue).toBe(true);
    });

    it('handles paths with spaces', () => {
      const pathWithSpaces = join(tempDir, 'my project name');
      mkdirSync(pathWithSpaces, { recursive: true });

      const input = {
        conversation_id: 'test',
        workspace_roots: [pathWithSpaces]
      };

      const output = runPowerShellHook('session-init.ps1', input);
      const parsed = JSON.parse(output);
      expect(parsed.continue).toBe(true);
    });
  });

  describe('error handling', () => {
    it('never outputs error to stdout', () => {
      const scriptPath = join(cursorHooksDir, 'session-init.ps1');

      // Pass invalid input
      const result = execSync(
        `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
        {
          input: 'not valid json',
          cwd: tempDir,
          encoding: 'utf-8',
          timeout: 10000,
        }
      );

      // Output should still be valid JSON
      const parsed = JSON.parse(result.trim());
      expect(parsed.continue).toBe(true);
    });
  });
});
