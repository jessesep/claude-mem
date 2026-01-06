# Issues to Create for Plugin Hooks Implementation

## Issue 1: Missing Shebang Banner for Context Generator Build

**Title:** Fix: Missing shebang banner for context-generator in build script

**Labels:** `bug`, `good first issue`

**Body:**
The context-generator build in `scripts/build-hooks.js` is missing a shebang banner, unlike the worker-service and mcp-server builds. This is a consistency issue that could affect direct execution.

**Current Code:**
```javascript
// Build context generator
await build({
  entryPoints: [CONTEXT_GENERATOR.source],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: `${hooksDir}/${CONTEXT_GENERATOR.name}.cjs`,
  minify: true,
  logLevel: 'error',
  external: ['bun:sqlite'],
  define: {
    '__DEFAULT_PACKAGE_VERSION__': `"${version}"`
  }
  // Missing banner!
});
```

**Expected:**
Should include a banner like worker-service and mcp-server:
```javascript
banner: {
  js: '#!/usr/bin/env node'
}
```

**Impact:** Low - context-generator may not be directly executable, but this is a consistency issue with other built artifacts.

**Location:** `scripts/build-hooks.js` lines 144-157

**Related:** Found during plugin hooks implementation review (see `docs/PLUGIN_HOOKS_IMPLEMENTATION_REVIEW.md`)

---

## Issue 2: Add Hook Execution Logging and Monitoring

**Title:** Enhancement: Add comprehensive hook execution logging and monitoring

**Labels:** `enhancement`, `help wanted`

**Body:**
Currently, hook execution is mostly silent. Adding detailed logging would help with debugging, performance monitoring, and understanding hook behavior in production.

**Current State:**
- Hooks use logger but only for errors/debug
- No centralized tracking of hook execution
- No metrics on hook performance
- Difficult to diagnose hook failures

**Proposed Enhancements:**

1. **Hook Execution Logging:**
   - Log when hooks are called (with hook name and event type)
   - Log input received (sanitized for privacy)
   - Log output produced
   - Log execution time
   - Log any errors encountered

2. **Performance Monitoring:**
   - Track hook execution times
   - Identify slow hooks
   - Monitor timeout occurrences
   - Track worker health check durations

3. **Centralized Hook Metrics:**
   - Count of hook executions per type
   - Success/failure rates
   - Average execution times
   - Worker availability during hook execution

**Architecture Consideration:**
Hooks are designed as pure HTTP clients with fire-and-forget semantics. Logging should:
- Not block hook execution
- Be lightweight (async logging)
- Respect privacy (sanitize sensitive data)
- Be configurable (log levels)

**Implementation Approach:**
- Add hook execution wrapper that logs before/after
- Use existing logger infrastructure
- Add optional metrics endpoint in worker
- Consider structured logging for better analysis

**Related Files:**
- `src/hooks/*.ts` - All hook implementations
- `src/utils/logger.ts` - Logger infrastructure
- `src/services/worker-service.ts` - Worker metrics

**Related:** Identified in plugin hooks implementation review as a recommendation for better observability.

---

## Issue 3: Windows Compatibility Verification for Plugin Hooks

**Title:** Enhancement: Verify and improve Windows compatibility for plugin hooks

**Labels:** `enhancement`, `help wanted`

**Body:**
The plugin hooks use `${CLAUDE_PLUGIN_ROOT}` environment variable expansion which uses Unix-style syntax. While Claude Code should handle this, we should verify Windows compatibility and document any limitations.

**Current Implementation:**
- Hooks use `${CLAUDE_PLUGIN_ROOT}` in `plugin/hooks/hooks.json`
- All hook scripts are JavaScript (platform-agnostic)
- Worker service uses Bun (cross-platform)
- No Windows-specific testing documented

**Potential Issues:**
1. Environment variable expansion may differ on Windows
2. Path separators in hook commands
3. Shell execution differences

**Investigation Needed:**
1. Test hook execution on Windows
2. Verify `${CLAUDE_PLUGIN_ROOT}` expansion works correctly
3. Test all hook types on Windows
4. Document any Windows-specific requirements

**Related:**
- Issue #555 documented Windows hooks not executing (but that was about Cursor hooks, not plugin hooks)
- `docs/reports/2026-01-05--issue-555-windows-hooks-ipc-false.md`

**Architecture Note:**
The hooks are JavaScript executables, so they should be platform-agnostic. The main concern is the environment variable expansion in `hooks.json` which is handled by Claude Code, not our code.

**Action Items:**
- [ ] Test plugin hooks on Windows 10/11
- [ ] Verify environment variable expansion
- [ ] Document Windows-specific setup if needed
- [ ] Add Windows to CI/CD if possible

---

## Issue 4: Document Hook Development and Testing Procedures

**Title:** Documentation: Add comprehensive hook development and testing guide

**Labels:** `documentation`, `good first issue`

**Body:**
While the hooks implementation is complete, there's limited documentation on how to develop, test, and debug hooks. This would help contributors and maintainers.

**Current Documentation:**
- `docs/PLUGIN_HOOKS_IMPLEMENTATION_REVIEW.md` - Architecture review
- `cursor-hooks/README.md` - Cursor hooks usage
- `docs/public/architecture/hooks.mdx` - General hooks architecture

**Missing Documentation:**
1. **Hook Development Guide:**
   - How to add a new hook
   - Hook input/output formats
   - Hook response formats
   - Error handling patterns
   - Worker API integration

2. **Testing Guide:**
   - Manual testing procedures
   - Integration testing setup
   - Mock worker for testing
   - Test data examples

3. **Debugging Guide:**
   - How to debug hook execution
   - Common issues and solutions
   - Log analysis
   - Worker interaction debugging

**Proposed Structure:**
```
docs/development/
  hooks-development.md      # How to develop hooks
  hooks-testing.md          # Testing procedures
  hooks-debugging.md         # Debugging guide
  hooks-api-reference.md    # Hook API reference
```

**Content Should Include:**
- Hook lifecycle and execution flow
- Input/output JSON schemas
- Worker API endpoints used by hooks
- Build process explanation
- Common patterns and best practices
- Troubleshooting checklist

**Related:** Identified as a recommendation in plugin hooks implementation review.

---

## Issue 5: Add Hook Timeout Monitoring and Optimization

**Title:** Enhancement: Monitor and optimize hook timeout configurations

**Labels:** `enhancement`

**Body:**
Hook timeouts are currently set to fixed values (60-120s) without data-driven optimization. We should monitor actual hook execution times and adjust timeouts based on real-world usage.

**Current Timeouts:**
- SessionStart hooks: 60s
- UserPromptSubmit hooks: 60s
- PostToolUse hooks: 120s
- Stop hooks: 120s

**Concerns:**
- Timeouts may be too high (blocking Claude Code unnecessarily)
- Timeouts may be too low (causing premature failures)
- No data on actual execution times
- No monitoring of timeout occurrences

**Proposed Solution:**

1. **Add Execution Time Tracking:**
   - Log hook execution times
   - Track p50, p95, p99 execution times
   - Identify outliers

2. **Timeout Monitoring:**
   - Track when timeouts occur
   - Log timeout reasons
   - Identify patterns

3. **Dynamic Timeout Configuration:**
   - Consider per-hook timeout configuration
   - Allow timeout adjustment via settings
   - Document timeout rationale

**Architecture Consideration:**
Hooks use fire-and-forget semantics where possible, but some hooks (like context-hook) must complete before Claude Code continues. Timeouts should balance:
- Not blocking Claude Code unnecessarily
- Allowing sufficient time for worker operations
- Handling slow systems gracefully

**Implementation:**
- Add timing logs to hook execution
- Create timeout metrics endpoint
- Document timeout configuration
- Consider timeout adjustment mechanism

**Related:** Identified in plugin hooks implementation review as a monitoring recommendation.

---

## Issue 6: Enhance Cursor Hooks Testing and Verification

**Title:** Enhancement: Add comprehensive testing for Cursor hooks implementation

**Labels:** `enhancement`, `help wanted`

**Body:**
The Cursor hooks implementation has feature parity with plugin hooks, but lacks comprehensive testing. We should add tests to verify hook behavior, especially edge cases and error scenarios.

**Current State:**
- Cursor hooks are shell scripts (bash/PowerShell)
- Manual testing procedures exist
- No automated tests
- Edge cases documented but not verified

**Testing Gaps:**

1. **Unit Tests:**
   - `common.sh` utility functions
   - JSON parsing and validation
   - URL encoding
   - Project name extraction
   - Worker port/host resolution

2. **Integration Tests:**
   - End-to-end hook execution
   - Worker interaction
   - Error handling
   - Timeout scenarios

3. **Edge Case Tests:**
   - Empty/malformed JSON input
   - Missing required fields
   - Worker unavailable scenarios
   - Network failures
   - Special characters in paths/inputs

**Proposed Testing Approach:**

1. **Shell Script Testing:**
   - Use `bats` (Bash Automated Testing System) for bash scripts
   - Use Pester for PowerShell scripts
   - Test utility functions in isolation

2. **Integration Testing:**
   - Mock worker service
   - Test hook execution with various inputs
   - Verify output formats
   - Test error scenarios

3. **CI/CD Integration:**
   - Run tests on multiple platforms
   - Test both bash and PowerShell versions
   - Verify hook compatibility

**Architecture Note:**
Cursor hooks use a different approach (shell scripts vs JavaScript) but maintain the same architectural principles:
- Pure HTTP clients
- Fire-and-forget semantics
- Graceful error handling
- Worker health checks

**Related Files:**
- `cursor-hooks/*.sh` - Bash hook scripts
- `cursor-hooks/*.ps1` - PowerShell hook scripts
- `cursor-hooks/common.sh` - Shared utilities
- `cursor-hooks/REVIEW.md` - Review document with testing recommendations

**Related:** Testing recommendations in `cursor-hooks/REVIEW.md` and `cursor-hooks/PARITY.md`.
