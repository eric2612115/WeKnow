# Server prompt templates

WeKnow's cloud calls use Firebase AI Logic server prompt templates. The instructions and output schemas live on
Firebase, not in the app: a visitor cannot read or change them at runtime, and they can be updated without a redeploy.
The on-device path keeps its prompts in `web/src/reader.ts`, because it runs on the person's own device.

To reproduce in your own Firebase project: Firebase console → AI Logic → Prompt templates → Create new template →
Blank, paste each file's frontmatter (between the `---` lines) and body, use the file name as the template ID, save,
then lock the template. Templates are a Firebase preview feature; their output schema does not yet support arrays of
objects, so lines and choices come back as `"label || amount"` and `"index || ref"` strings, parsed by
`web/src/core/templateParse.ts`.
