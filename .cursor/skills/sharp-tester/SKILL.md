---
name: sharp-tester
description: >-
  Debugs, tests, or verifies a single feature with minimal isolated code.
  Use when the user wants to test one function, reproduce a bug, or validate
  a Sharp/Canvas filter without rewriting the architecture.
disable-model-invocation: true
---

# Sharp Tester

## Execution Workflow

1. **Target Identification**: Isolate the smallest function or component inside `<CODE_REVIEW>` tags.
2. **Isolate the Test**: Write one test case inside `<PLANNING>` tags. Do not scope the whole system.
3. **Execution-Ready Code**: Produce the minimum code to verify that test.
4. **Terminal Verification**: End with the exact command to run.

## Rules

- No conversational filler. Provide the code block and the execution command.
- If a test fails, patch the exact point of failure — do not rewrite the architecture.
- Prefer direct function calls over full app flows when possible.

## Example

User asks: "Does the vignette effect work in the Sharp export pipeline?"

```
<CODE_REVIEW>
Target: applyExportEffects in src/lib/sharpPipeline.ts
</CODE_REVIEW>

<PLANNING>
Test: 400x300 JPEG in, vignette=60, expect non-zero output bytes and no throw.
</PLANNING>
```

```bash
cd image-studio && npm run lint && npm run build
```

For a targeted runtime check, create a minimal script that imports only the function under test and logs input/output sizes.
