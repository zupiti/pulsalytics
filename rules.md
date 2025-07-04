# Cursor AI Prompting Framework — Usage Guide

_A disciplined, evidence-first workflow for autonomous code agents_

---

## 1 · Install the Operational Doctrine

The **Cursor Operational Doctrine** (file **`core.md`**) encodes the agent’s always-on principles—reconnaissance before action, empirical validation over conjecture, strict command-execution hygiene, and zero-assumption stewardship.

Choose **one** installation mode:

| Mode                      | Steps                                                                                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project-specific**      | 1. In your repo root, create `.cursorrules`.<br>2. Copy the entire contents of **`core.md`** into that file.<br>3. Commit & push.                                                                                                                                                            |
| **Global (all projects)** | 1. Open Cursor → _Command Palette_ (`Ctrl + Shift + P` / `Cmd + Shift + P`).<br>2. Select **“Cursor Settings → Configure User Rules”**.<br>3. Paste **`core.md`** in its entirety.<br>4. Save. The doctrine now applies across every workspace (unless a local `.cursorrules` overrides it). |

> **Never edit rule files piecemeal.** Replace their full contents to avoid drift.

---

## 2 · Operational Playbooks

Four structured templates drive repeatable, autonomous sessions. Copy the full text of a template, replace its first placeholder line, then paste it into chat.

| Template         | When to Use                                                                 | First Line Placeholder                               |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| **`request.md`** | Build a feature, refactor code, or make a targeted change.                  | `{Your feature / change request here}`               |
| **`refresh.md`** | A bug persists after earlier attempts—launch a root-cause analysis and fix. | `{Concise description of the persistent issue here}` |
| **`retro.md`**   | Conclude a work session; harvest lessons and update rule files.             | _(No placeholder—use as is at session end)_          |

Each template embeds the doctrine’s safeguards:

- **Familiarisation & Mapping** step (non-destructive reconnaissance).
- Command-wrapper mandate (`timeout 30s <command> 2>&1 | cat`).
- Ban on unsolicited Markdown files—transient narratives stay in-chat.

---

## 3 · Flow of a Typical Session

1. **Paste a template** with the placeholder filled.
2. Cursor AI:

   1. Performs reconnaissance and produces a ≤ 200-line digest.
   2. Plans, gathers context, and executes changes incrementally.
   3. Runs tests/linters; auto-rectifies failures.
   4. Reports with ✅ / ⚠️ / 🚧 markers and an inline TODO, no stray files.

3. **Review the summary**; iterate or request a **`retro.md`** to fold lessons back into the doctrine.

---

## 4 · Best-Practice Check-list

- **Be specific** in the placeholder line—state _what_ and _why_.
- **One template per prompt.** Never mix `refresh.md` and `request.md`.
- **Trust autonomy.** The agent self-validates; intervene only when it escalates under the clarification threshold.
- **Inspect reports, not logs.** Rule files remain terse; rich diagnostics appear in-chat.
- **End with a retro.** Use `retro.md` to keep the rule set evergreen.

---

## 5 · Guarantees & Guard-rails

| Guard-rail                  | Enforcement                                                                                                         |        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| **Reconnaissance first**    | The agent may not mutate artefacts before completing the Familiarisation & Mapping phase.                           |        |
| **Exact command wrapper**   | All executed shell commands include \`timeout 30s … 2>&1                                                            | cat\`. |
| **No unsolicited Markdown** | Summaries, scratch notes, and logs remain in-chat unless the user explicitly names the file.                        |        |
| **Safe deletions**          | Obsolete files may be removed autonomously only if reversible via version control and justified in-chat.            |        |
| **Clarification threshold** | The agent asks questions only for epistemic conflict, missing resources, irreversible risk, or research saturation. |        |

---

## 6 · Quick-Start Example

> “Add an endpoint that returns build metadata (commit hash, build time). Use Go, update tests, and document the new route.”

1. Copy **`request.md`**.
2. Replace the first line with the sentence above.
3. Paste into chat.
4. Observe Cursor AI:

   - inventories the repo,
   - designs the endpoint,
   - modifies code & tests,
   - runs `go test`, linters, CI scripts,
   - reports results with ✅ markers—no stray files created.

Once satisfied, paste **`retro.md`** to record lessons and refine the rule set.

---

**By following this framework, you empower Cursor AI to act as a disciplined, autonomous senior engineer—planning deeply, executing safely, self-validating, and continuously improving its own operating manual.**
