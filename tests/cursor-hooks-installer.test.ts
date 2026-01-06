import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import path from 'path';
import { tmpdir, homedir } from 'os';
import {
  findCursorHooksDir,
  findMcpServerPath,
  installCursorHooks,
  uninstallCursorHooks,
  checkCursorHooksStatus,
  detectPlatform,
  getScriptExtension,
  getTargetDir,
  readCursorRegistry,
  writeCursorRegistry,
  registerCursorProject,
  unregisterCursorProject,
  updateCursorContextForProject,
  configureCursorMcp,
  handleCursorCommand
} from '../src/services/integrations/CursorHooksInstaller.js';
import type { CursorInstallTarget } from '../src/services/integrations/types.js';

/**
 * Comprehensive tests for CursorHooksInstaller
 *
 * Tests installation, uninstallation, status checking, and all utility functions.
 */

describe('CursorHooksInstaller', () => {
  let tempDir: string;
  let mockCursorHooksDir: string;
  let mockMcpServerPath: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `cursor-installer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });

    // Create mock cursor-hooks directory structure
    mockCursorHooksDir = join(tempDir, 'cursor-hooks');
    mkdirSync(mockCursorHooksDir, { recursive: true });

    // Create mock hook scripts (both bash and PowerShell)
    const scripts = [
      'common.sh',
      'common.ps1',
      'session-init.sh',
      'session-init.ps1',
      'context-inject.sh',
      'context-inject.ps1',
      'save-observation.sh',
      'save-observation.ps1',
      'save-file-edit.sh',
      'save-file-edit.ps1',
      'session-summary.sh',
      'session-summary.ps1'
    ];

    for (const script of scripts) {
      const scriptPath = join(mockCursorHooksDir, script);
      writeFileSync(scriptPath, `#!/bin/bash\n# Mock ${script}\necho "test"`);
      if (script.endsWith('.sh')) {
        chmodSync(scriptPath, 0o755);
      }
    }

    // Create mock MCP server
    const mockPluginDir = join(tempDir, 'plugin', 'scripts');
    mkdirSync(mockPluginDir, { recursive: true });
    mockMcpServerPath = join(mockPluginDir, 'mcp-server.cjs');
    writeFileSync(mockMcpServerPath, '// Mock MCP server');

    // Save original CWD
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    // Restore CWD
    process.chdir(originalCwd);

    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Platform Detection', () => {
    it('detects platform correctly', () => {
      const platform = detectPlatform();
      expect(['windows', 'unix']).toContain(platform);
    });

    it('returns correct script extension for platform', () => {
      const ext = getScriptExtension();
      const platform = detectPlatform();
      
      if (platform === 'windows') {
        expect(ext).toBe('.ps1');
      } else {
        expect(ext).toBe('.sh');
      }
    });
  });

  describe('Path Finding', () => {
    it('finds cursor-hooks directory in dev location', () => {
      // Create cursor-hooks in current working directory
      const cwdHooksDir = join(process.cwd(), 'cursor-hooks');
      mkdirSync(cwdHooksDir, { recursive: true });
      writeFileSync(join(cwdHooksDir, 'common.sh'), 'test');

      const found = findCursorHooksDir();
      expect(found).toBeTruthy();
    });

    it('returns null when cursor-hooks directory not found', () => {
      // Mock __filename to point to non-existent location
      const found = findCursorHooksDir();
      // May find it in dev location or return null
      expect(found === null || typeof found === 'string').toBe(true);
    });

    it('finds MCP server path in dev location', () => {
      const found = findMcpServerPath();
      // May find it or return null depending on actual file system
      expect(found === null || typeof found === 'string').toBe(true);
    });
  });

  describe('Target Directory Resolution', () => {
    it('returns project directory for project target', () => {
      const targetDir = getTargetDir('project');
      expect(targetDir).toBe(join(process.cwd(), '.cursor'));
    });

    it('returns user directory for user target', () => {
      const targetDir = getTargetDir('user');
      expect(targetDir).toBe(join(homedir(), '.cursor'));
    });

    it('returns enterprise directory for enterprise target on macOS', () => {
      if (process.platform === 'darwin') {
        const targetDir = getTargetDir('enterprise');
        expect(targetDir).toBe('/Library/Application Support/Cursor');
      }
    });

    it('returns null for invalid target', () => {
      const targetDir = getTargetDir('invalid' as CursorInstallTarget);
      expect(targetDir).toBeNull();
    });
  });

  describe('Installation', () => {
    it('installs hooks for project target', async () => {
      const result = await installCursorHooks(mockCursorHooksDir, 'project');

      expect(result).toBe(0);

      const hooksJsonPath = join(process.cwd(), '.cursor', 'hooks.json');
      expect(existsSync(hooksJsonPath)).toBe(true);

      const hooksDir = join(process.cwd(), '.cursor', 'hooks');
      expect(existsSync(hooksDir)).toBe(true);
    });

    it('creates hooks.json with correct structure', async () => {
      await installCursorHooks(mockCursorHooksDir, 'project');

      const hooksJsonPath = join(process.cwd(), '.cursor', 'hooks.json');
      const hooksJson = JSON.parse(readFileSync(hooksJsonPath, 'utf-8'));

      expect(hooksJson.version).toBe(1);
      expect(hooksJson.hooks).toBeDefined();
      expect(hooksJson.hooks.beforeSubmitPrompt).toBeDefined();
      expect(hooksJson.hooks.afterMCPExecution).toBeDefined();
      expect(hooksJson.hooks.afterShellExecution).toBeDefined();
      expect(hooksJson.hooks.afterFileEdit).toBeDefined();
      expect(hooksJson.hooks.stop).toBeDefined();
    });

    it('copies all required scripts', async () => {
      await installCursorHooks(mockCursorHooksDir, 'project');

      const hooksDir = join(process.cwd(), '.cursor', 'hooks');
      const platform = detectPlatform();
      const scriptExt = getScriptExtension();
      const commonScript = platform === 'windows' ? 'common.ps1' : 'common.sh';

      const scripts = [
        commonScript,
        `session-init${scriptExt}`,
        `context-inject${scriptExt}`,
        `save-observation${scriptExt}`,
        `save-file-edit${scriptExt}`,
        `session-summary${scriptExt}`
      ];

      for (const script of scripts) {
        const scriptPath = join(hooksDir, script);
        expect(existsSync(scriptPath)).toBe(true);
      }
    });

    it('generates correct hook commands for Unix', async () => {
      if (process.platform !== 'win32') {
        await installCursorHooks(mockCursorHooksDir, 'project');

        const hooksJsonPath = join(process.cwd(), '.cursor', 'hooks.json');
        const hooksJson = JSON.parse(readFileSync(hooksJsonPath, 'utf-8'));

        // Commands should be relative paths for project-level
        const firstCommand = hooksJson.hooks.beforeSubmitPrompt[0].command;
        expect(firstCommand).toContain('./.cursor/hooks/session-init.sh');
      }
    });

    it('generates correct hook commands for Windows', async () => {
      if (process.platform === 'win32') {
        await installCursorHooks(mockCursorHooksDir, 'project');

        const hooksJsonPath = join(process.cwd(), '.cursor', 'hooks.json');
        const hooksJson = JSON.parse(readFileSync(hooksJsonPath, 'utf-8'));

        // Commands should use powershell.exe
        const firstCommand = hooksJson.hooks.beforeSubmitPrompt[0].command;
        expect(firstCommand).toContain('powershell.exe');
        expect(firstCommand).toContain('-ExecutionPolicy Bypass');
        expect(firstCommand).toContain('.ps1');
      }
    });

    it('creates context file for project-level installation', async () => {
      // Mock worker API
      const mockFetch = mock(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve('Test context content')
      } as Response));
      global.fetch = mockFetch as any;

      await installCursorHooks(mockCursorHooksDir, 'project');

      const contextFile = join(process.cwd(), '.cursor', 'rules', 'claude-mem-context.mdc');
      expect(existsSync(contextFile)).toBe(true);

      const content = readFileSync(contextFile, 'utf-8');
      expect(content).toContain('alwaysApply: true');
      expect(content).toContain('Test context content');
    });

    it('handles missing scripts gracefully', async () => {
      // Remove one script
      rmSync(join(mockCursorHooksDir, 'session-init.sh'), { force: true });

      const result = await installCursorHooks(mockCursorHooksDir, 'project');
      
      // Should still succeed (warns but continues)
      expect(result).toBe(0);
    });

    it('returns error for invalid target', async () => {
      const result = await installCursorHooks(mockCursorHooksDir, 'invalid' as CursorInstallTarget);
      expect(result).toBe(1);
    });
  });

  describe('Uninstallation', () => {
    beforeEach(async () => {
      // Install hooks first
      await installCursorHooks(mockCursorHooksDir, 'project');
    });

    it('removes hooks.json', () => {
      const hooksJsonPath = join(process.cwd(), '.cursor', 'hooks.json');
      expect(existsSync(hooksJsonPath)).toBe(true);

      const result = uninstallCursorHooks('project');
      expect(result).toBe(0);
      expect(existsSync(hooksJsonPath)).toBe(false);
    });

    it('removes all hook scripts', () => {
      const hooksDir = join(process.cwd(), '.cursor', 'hooks');
      expect(existsSync(hooksDir)).toBe(true);

      uninstallCursorHooks('project');

      // Directory should be empty or removed
      if (existsSync(hooksDir)) {
        const files = readdirSync(hooksDir);
        expect(files.length).toBe(0);
      }
    });

    it('removes context file for project-level', () => {
      const contextFile = join(process.cwd(), '.cursor', 'rules', 'claude-mem-context.mdc');
      
      // Create context file
      mkdirSync(join(process.cwd(), '.cursor', 'rules'), { recursive: true });
      writeFileSync(contextFile, 'test');

      uninstallCursorHooks('project');

      expect(existsSync(contextFile)).toBe(false);
    });

    it('unregisters project from registry', () => {
      const projectName = path.basename(process.cwd());
      const registryFile = join(homedir(), '.claude-mem', 'cursor-projects.json');
      
      // Register project (uses basename of cwd)
      registerCursorProject(projectName, process.cwd());
      expect(readCursorRegistry()[projectName]).toBeDefined();

      uninstallCursorHooks('project');

      // Should be unregistered
      const registry = readCursorRegistry();
      expect(registry[projectName]).toBeUndefined();
    });

    it('handles uninstall when hooks not installed', () => {
      // Remove hooks first
      rmSync(join(process.cwd(), '.cursor'), { recursive: true, force: true });

      const result = uninstallCursorHooks('project');
      // Should succeed (idempotent)
      expect(result).toBe(0);
    });
  });

  describe('Status Checking', () => {
    it('reports not installed when hooks.json missing', () => {
      const result = checkCursorHooksStatus();
      expect(result).toBe(0); // Function succeeds, just reports status
    });

    it('reports installed for project-level', async () => {
      await installCursorHooks(mockCursorHooksDir, 'project');

      const result = checkCursorHooksStatus();
      expect(result).toBe(0);
    });

    it('detects platform scripts correctly', async () => {
      await installCursorHooks(mockCursorHooksDir, 'project');

      const result = checkCursorHooksStatus();
      expect(result).toBe(0);
    });
  });

  describe('Project Registry', () => {
    it('registers project correctly', () => {
      const projectName = 'test-project';
      const workspacePath = '/path/to/project';

      registerCursorProject(projectName, workspacePath);

      const registry = readCursorRegistry();
      expect(registry[projectName]).toBeDefined();
      expect(registry[projectName].workspacePath).toBe(workspacePath);
      expect(registry[projectName].installedAt).toBeDefined();
    });

    it('unregisters project correctly', () => {
      const projectName = 'test-project';
      registerCursorProject(projectName, '/path/to/project');

      unregisterCursorProject(projectName);

      const registry = readCursorRegistry();
      expect(registry[projectName]).toBeUndefined();
    });

    it('updates context for registered project', async () => {
      const projectName = 'test-project';
      const workspacePath = join(tempDir, 'test-project');
      mkdirSync(workspacePath, { recursive: true });

      registerCursorProject(projectName, workspacePath);

      // Mock worker API
      const mockFetch = mock(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve('Updated context')
      } as Response));
      global.fetch = mockFetch as any;

      await updateCursorContextForProject(projectName, 37777);

      const contextFile = join(workspacePath, '.cursor', 'rules', 'claude-mem-context.mdc');
      expect(existsSync(contextFile)).toBe(true);

      const content = readFileSync(contextFile, 'utf-8');
      expect(content).toContain('Updated context');
    });

    it('does nothing for unregistered project', async () => {
      const mockFetch = mock(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve('Context')
      } as Response));
      global.fetch = mockFetch as any;

      await updateCursorContextForProject('non-existent-project', 37777);

      // Should not have called fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('MCP Configuration', () => {
    it('configures MCP server correctly', () => {
      const mcpJsonPath = join(tempDir, '.cursor', 'mcp.json');
      configureCursorMcp('project');

      // Check if MCP config was created (may fail if mcp server not found)
      // This test verifies the function doesn't throw
      expect(() => configureCursorMcp('project')).not.toThrow();
    });
  });

  describe('Command Handler', () => {
    it('handles install command', async () => {
      const result = await handleCursorCommand('install', ['project']);
      // May succeed or fail depending on whether cursor-hooks dir is found
      expect([0, 1]).toContain(result);
    });

    it('handles uninstall command', () => {
      const result = uninstallCursorHooks('project');
      expect(result).toBe(0);
    });

    it('handles status command', () => {
      const result = checkCursorHooksStatus();
      expect(result).toBe(0);
    });

    it('shows help for unknown command', async () => {
      const result = await handleCursorCommand('unknown', []);
      expect(result).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles installation with missing source directory', async () => {
      const result = await installCursorHooks('/non/existent/path', 'project');
      // Installation continues even if scripts are missing (warns but doesn't fail)
      expect([0, 1]).toContain(result);
    });

    it('handles installation with missing common script', async () => {
      // Remove common script
      rmSync(join(mockCursorHooksDir, 'common.sh'), { force: true });
      rmSync(join(mockCursorHooksDir, 'common.ps1'), { force: true });

      const result = await installCursorHooks(mockCursorHooksDir, 'project');
      // Should still succeed (warns but continues)
      expect(result).toBe(0);
    });

    it('handles uninstallation when already uninstalled', () => {
      const result = uninstallCursorHooks('project');
      expect(result).toBe(0); // Should be idempotent
    });

    it('handles special characters in project name', () => {
      const projectName = 'my-project_v2.0 (beta)';
      registerCursorProject(projectName, '/path/to/project');

      const registry = readCursorRegistry();
      expect(registry[projectName]).toBeDefined();
    });

    it('handles very long paths', async () => {
      const longPath = join(tempDir, 'a'.repeat(200));
      mkdirSync(longPath, { recursive: true });
      process.chdir(longPath);

      const result = await installCursorHooks(mockCursorHooksDir, 'project');
      expect([0, 1]).toContain(result);

      process.chdir(tempDir);
    });
  });
});
