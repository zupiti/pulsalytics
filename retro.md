# Retrospective & Rule-Maintenance Meta-Prompt

> Invoke only after a work session concludes.
> Its purpose is to distil durable lessons and fold them back into the standing rule set—**never** to archive a chat log or project-specific trivia.

---

## 0 · Intent & Boundaries

* Reflect on the entire conversation up to—but **excluding**—this prompt.
* Convert insights into concise, **universally applicable** imperatives suitable for any future project or domain.
* Rule files must remain succinct, generic, and free of session details.

---

## 1 · Self-Reflection   *(⛔ keep in chat only)*

1. Review every turn from the session’s first user message.
2. Produce **≤ 10** bullet points covering:
   • Behaviours that worked well.
   • Behaviours the user corrected or explicitly expected.
   • Actionable, transferable lessons.
3. Do **not** copy these bullets into rule files.

---

## 2 · Abstract & Update Rules   *(✅ write rules only—no commentary)*

1. Open every standing rule file (e.g. `.cursor/rules/*.mdc`, `.cursorrules`, global user rules).
2. For each lesson:
   **a. Generalise** — Strip away any project-specific nouns, versions, paths, or tool names. Formulate the lesson as a domain-agnostic principle.
   **b. Integrate** —
     • If a matching rule exists → refine it.
     • Else → add a new imperative rule.
3. **Rule quality requirements**
   • Imperative voice — “Always …”, “Never …”, “If X then Y”.
   • Generic — applicable across languages, frameworks, and problem spaces.
   • Deduplicated & concise — avoid overlaps and verbosity.
   • Organised — keep alphabetical or logical grouping.
4. **Never create unsolicited new Markdown files.** Add a rule file **only** if the user names it and states its purpose.

---

## 3 · Save & Report   *(chat-only)*

1. Persist edits to the rule files.
2. Reply with:
   • `✅ Rules updated` or `ℹ️ No updates required`.
   • The bullet-point **Self-Reflection** from § 1.

---

## 4 · Additional Guarantees

* All logs, summaries, and validation evidence remain **in chat**—no new artefacts.
* A `TODO.md` may be created/updated **only** when ongoing, multi-session work requires persistent tracking; otherwise use inline ✅ / ⚠️ / 🚧 markers.
* **Do not ask** “Would you like me to make this change for you?”. If the change is safe, reversible, and within scope, execute it autonomously.
* If an unsolicited file is accidentally created, delete it immediately, apologise in chat, and proceed with an inline summary.

---

*Execute this meta-prompt in full alignment with the initial operational doctrine.*
