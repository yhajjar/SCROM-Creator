# n8n build contract

The importable workflow expects one JSON item with:

```json
{
  "coursePath": "C:\\scorm-jobs\\job-123\\course.json",
  "outputPath": "C:\\scorm-jobs\\job-123\\course.zip",
  "generatorPath": "C:\\tools\\scorm-course-generator"
}
```

Operational requirements:

1. The upstream local LLM must return JSON only.
2. Save that JSON and approved images in an isolated job directory.
3. Restrict all three paths to administrator-configured roots before invoking the workflow. The included Code node rejects control characters and shell metacharacters but the n8n host should also enforce filesystem permissions.
4. Install dependencies and run `npm run build` once in `generatorPath`.
5. The Execute Command node invokes the CLI and captures its JSON report.
6. The Parse Report node throws if the CLI output is invalid or reports failure.
7. The Read ZIP node returns the validated archive as binary data.
8. A separate retention workflow may remove only a resolved job directory beneath the configured jobs root.

Never pass raw course text through the command line. Only validated file paths are command arguments.
