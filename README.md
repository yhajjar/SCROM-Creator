# Reusable SCORM 1.2 Course Generator

This project builds variable-length, Moodle-ready SCORM 1.2 packages from a documented `content/course.json` file. It does not modify or redistribute the supplied iSpring runtime. The original iSpring package and `.quiz` source remain reference fixtures.

## Requirements

- Node.js 20 or newer
- npm
- A self-hosted n8n instance if the optional workflow is used

## Install and use

```powershell
npm install
npm run build
node dist/src/cli.js analyze ".\ScROM Template" --report ".\output\ispring-analysis.json"
node dist/src/cli.js analyze ".\Digial Skill demo.quiz"
node dist/src/cli.js build --course ".\content\course.json" --out ".\output\digital-skills.zip"
```

The build command always writes `<output>.report.json`. A nonzero exit code or `"ok": false` means the ZIP must not be uploaded.

## Content contract

`content/course.json` is the canonical LLM output. Its schema is included in every generated package at `content/course.schema.json`. Supported interactions are:

- `multipleChoice`
- `multipleResponse`
- `sequence`
- `matching`
- `categorization`
- `wordBank`

Question and nested IDs must be stable, unique identifiers beginning with a letter. Text is rendered as plain UTF-8 text and never injected as HTML. Images may be PNG, JPEG, GIF, or WebP, must be inside the directory containing the course JSON, and are copied under hashed package names.

The generated player reports SCORM 1.2 status, score, session time, interactions, and compressed resume state. Moodle controls attempts after completion.

## Package analysis

The supplied iSpring package is classified as **possible but fragile to automate**:

- `.quiz` is a readable ZIP with `document.json`, `metainfo.json`, media, and theme state.
- The published package stores its transformed content as Base64 JSON inside `res/index.html`.
- `player.js`, `lms.js`, browser support code, fonts, and other vendor runtime files should not be patched.
- Editing the `.quiz` archive does not republish a SCORM course without iSpring.

The `analyze` command performs the same checks for future packages and reports missing manifest files, launch information, editable candidates, protected runtime candidates, and automation signals.

## n8n

See [n8n/README.md](n8n/README.md) and the importable workflow template in `n8n/scorm-build.workflow.json`. The workflow builds a ZIP only; Moodle upload is intentionally a separate stage.
