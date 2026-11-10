# Fimbria lesson format

A guide for people and AI agents who write lessons for Fimbria, a live teaching app.
A lesson is one JSON file. The teacher uploads it, or imports it from a public
GitHub link, then presents it step by step while students answer on their phones.

- Machine-readable schema (JSON Schema draft-07): [`/lesson.schema.json`](/lesson.schema.json)
- This guide: `/docs/lesson-format.md`
- Index for agents: `/llms.txt`

A file that passes the JSON Schema can still be rejected by the
[extra rules](#rules-the-schema-cannot-express) below, so check both.

## How a lesson is used

1. The teacher uploads the file, or pastes a public GitHub link to it.
2. Fimbria validates it and saves its own copy. Editing the source file later
   does not change saved copies; re-import to use a new version.
3. The teacher starts a session. The class sees one step at a time on the
   projector and on their phones, and the teacher moves forward and back.
4. On a **question**, each student picks one answer. The teacher then reveals
   the results: the vote totals, the correct option and the explanation.

What this means for authors:

- **Each student gets one answer per question**, and it cannot be changed.
- **Leaving a question closes it for good.** Coming back to it shows the
  question again, but students can no longer vote.
- **The explanation is hidden until the teacher reveals results.** Write it
  as the teaching point you want shown after the vote.
- **Text is plain.** Markdown and HTML are not rendered: `**bold**` shows up
  literally. Line breaks (`\n`) in a slide `body` and in an `explanation` are
  kept.

## File structure

```json
{
  "schemaVersion": 1,
  "id": "short-stable-id",
  "title": "Title shown to the class",
  "steps": [ /* 1 to 100 steps: slide, question or video */ ]
}
```

| Field | Type | Rules |
|-------|------|-------|
| `schemaVersion` | number | Must be `1` |
| `id` | string | 1-100 characters. Your own identifier; Fimbria gives each saved copy its own ID |
| `title` | string | 1-200 characters |
| `steps` | array | 1-100 steps, presented in order |

No other top-level fields are allowed. Every object in the format rejects
unknown fields.

## Step types

Every step needs an `id` (1-100 characters, **unique within the lesson**) and a `type`.

### `slide`: information

```json
{
  "id": "intro",
  "type": "slide",
  "title": "Pause. Gather. Reassess.",
  "body": "Use the history and examination to build a working explanation.\nRevisit it as new information arrives.",
  "image": { "src": "/media/diagram.png", "alt": "Flow diagram of the reassessment loop" }
}
```

| Field | Required | Rules |
|-------|----------|-------|
| `title` | yes | 1-200 characters |
| `body` | yes | 0-10,000 characters of plain text; line breaks are kept |
| `image` | no | See [Images](#images) |

### `question`: single-answer multiple choice

```json
{
  "id": "q-working-dx",
  "type": "question",
  "prompt": "What makes a useful working diagnosis?",
  "options": [
    { "id": "a", "text": "It can be revised with new evidence" },
    { "id": "b", "text": "It never changes" }
  ],
  "correctOptionId": "a",
  "explanation": "A working diagnosis is provisional and should change with the evidence.",
  "image": { "src": "https://example.org/cxr.jpg", "alt": "Frontal chest X-ray with a left pleural effusion" }
}
```

| Field | Required | Rules |
|-------|----------|-------|
| `prompt` | yes | 1-2,000 characters |
| `options` | yes | 2-8 items, each `{ "id", "text" }`. `id` is 1-100 characters and unique within the question; `text` is 1-1,000 characters |
| `correctOptionId` | yes | Must equal one option's `id`. Exactly one correct answer |
| `explanation` | yes | 0-10,000 characters, shown only after the reveal |
| `image` | no | See [Images](#images) |

Options are shown in the order given and labelled A, B, C... Do not write
the letters into `text`.

### `video`: MP4 or YouTube

```json
{ "id": "clip", "type": "video", "title": "Watch the examination", "src": "https://youtu.be/M7lc1UVf-VE?t=90" }
```

| Field | Required | Rules |
|-------|----------|-------|
| `title` | yes | 1-200 characters |
| `src` | yes | An MP4 (site path or HTTPS) or a YouTube link to a single video: `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/live/` or `/embed/`. Start times (`t=90`, `t=1m30s`, `start=90`) are kept |
| `captionsSrc` | no | English WebVTT (`.vtt`) captions, **MP4 only**. YouTube videos use YouTube's own captions |

Video steps cannot have an `image`. Each screen plays the video
independently; playback is not synchronised.

## Images

Slides and questions accept one optional image:

```json
"image": {
  "src": "/media/cxr-left-effusion.jpg",
  "alt": "Frontal chest X-ray with blunting of the left costophrenic angle",
  "caption": "CXR, day 2"
}
```

| Field | Required | Rules |
|-------|----------|-------|
| `src` | yes | Site path or HTTPS URL (see [Links](#links)). JPG, PNG, WebP, SVG or GIF |
| `alt` | yes | 1-500 characters. Describes what the image shows. It is read by screen readers and shown in place of the image if it fails to load |
| `caption` | no | 1-300 characters, shown under the image |

Layout is automatic. On the projector and the teacher's screen the image takes
the right third, beside the text. On phones it sits above the title or question,
and tapping it opens it full size. Portrait images (X-rays, scans) use the
space best; wide images such as rhythm strips appear short.

**Write `alt` text that doesn't give away the answer.** For a question, describe
what is visible ("tall, narrow, peaked T waves"), not the diagnosis the question
asks for.

## Links

Every `src` and `captionsSrc` must be one of:

- a **site path** beginning with a single `/`, such as `/media/xray.jpg`. These
  are files the operator adds to Fimbria's `public/media/` folder, so only use
  them when you know the file is there.
- an **`https://` URL** to a publicly reachable file, for example
  `https://raw.githubusercontent.com/owner/repo/main/images/xray.jpg`.

These are rejected: `http://`, protocol-relative `//host/...`, relative paths
like `images/x.png`, `data:` and `javascript:` URLs, URLs with a username or
password, and anything containing spaces or backslashes.

If you're writing a lesson for a GitHub repository, keep its images in the same
repository and link to their `raw.githubusercontent.com` URLs.

## Rules the schema cannot express

Fimbria checks these after the JSON Schema passes:

1. Step `id`s are unique across the lesson.
2. Option `id`s are unique within each question.
3. `correctOptionId` matches one of that question's option `id`s.
4. Every `src` and `captionsSrc` follows [Links](#links).
5. YouTube `src` links point to exactly one video (an 11-character video ID).
   Playlists and channel pages are rejected.
6. `captionsSrc` is not used with YouTube videos.
7. The whole file is under **256 KB**.

## Delivering a lesson

- **Upload:** the teacher chooses the `.json` file under "Upload lesson JSON".
- **GitHub:** push the file to a **public** repository and give the teacher
  either link form:
  - `https://github.com/owner/repo/blob/main/lesson.json`
  - `https://raw.githubusercontent.com/owner/repo/main/lesson.json`

  A link with a commit SHA instead of a branch name fixes the exact version.
  Private repositories are not supported.

## Writing good lessons (guidance for agents)

- **Rhythm.** Give a short slide of context, then a question, then a slide or
  explanation that teaches. Aim for one idea per question. Most class sessions
  use 5-20 steps.
- **Questions.** Make sure only one option is clearly correct, and make the
  distractors plausible: common misconceptions, not jokes. Use 3-5 options,
  keep them similar in length and style, and avoid "all of the above".
- **Explanations.** Say why the correct answer is right and why the
  tempting wrong answer is wrong. This is the teaching moment.
- **Readability.** Slide bodies are read from a projector, so keep them to a
  few short lines rather than paragraphs.
- **Images.** Use one image per step, only when it carries information.
  Write accurate `alt` text, and don't reveal the answer in `alt` or `caption`.
- **Stable IDs.** Use short, meaningful IDs (`q-hyperk-ecg`), not random strings.
- **Clinical content.** Don't include real patient-identifiable information
  in text or images.
- **Validate before handing over.** Check the file against `/lesson.schema.json`,
  then against the extra rules above.

## Complete example

```json
{
  "schemaVersion": 1,
  "id": "rhythm-strip-basics",
  "title": "Reading a rhythm strip",
  "steps": [
    {
      "id": "strip-intro",
      "type": "slide",
      "title": "Look before you label",
      "body": "Describe the rate and rhythm first.\nThen look closely at each wave.",
      "image": {
        "src": "/media/sample-ecg-strip.svg",
        "alt": "Lead II rhythm strip, regular rhythm, with tall, narrow, peaked T waves",
        "caption": "Sample strip (illustrative drawing)"
      }
    },
    {
      "id": "q-t-waves",
      "type": "question",
      "prompt": "Which electrolyte abnormality best explains these T waves?",
      "image": {
        "src": "/media/sample-ecg-strip.svg",
        "alt": "Lead II rhythm strip, regular rhythm, with tall, narrow, peaked T waves"
      },
      "options": [
        { "id": "hyperk", "text": "Hyperkalaemia" },
        { "id": "hypok", "text": "Hypokalaemia" },
        { "id": "hypoca", "text": "Hypocalcaemia" },
        { "id": "hypermg", "text": "Hypermagnesaemia" }
      ],
      "correctOptionId": "hyperk",
      "explanation": "Tall, narrow, peaked T waves are an early ECG sign of hyperkalaemia.\nHypokalaemia gives flattened T waves and U waves instead."
    },
    {
      "id": "clip",
      "type": "video",
      "title": "Recap",
      "src": "https://www.youtube.com/watch?v=M7lc1UVf-VE"
    }
  ]
}
```
