# AI Study API

An AI-powered REST API that transforms learning materials into study resources.

AI Study API accepts documents or website URLs, extracts their text, and uses Google Gemini to generate educational content such as summaries, flashcards, quizzes, notes, and concept explanations.

## Features

- 📄 PDF support
- 🌐 Website URL support
- 📝 AI-generated summaries
- 🧠 Flashcard generation
- ❓ Quiz generation
- 📚 Study notes generation
- 💡 Concept explanations
- 🤖 AI chat endpoint
- 🚀 REST API

## Tech Stack

- Node.js
- Express.js
- Google Gemini API
- Multer
- pdf-parse

## Base URL

### Local

```
http://localhost:3000/api/v1
```

### Production

```
https://your-domain.onrender.com/api/v1
```

---

# Endpoints

## AI Chat

### POST `/ask`

Ask the AI any question.

**Body**

```json
{
  "prompt": "Explain recursion in simple terms."
}
```

---

## Generate Summary

### POST `/summarize`

Generate a concise summary from a supported document or website.

Accepts:

- PDF file
- Website URL

---

## Generate Flashcards

### POST `/flashcard`

Creates study flashcards from the provided content.

Accepts:

- PDF file
- Website URL

---

## Generate Quiz

### POST `/quiz`

Creates multiple quiz questions from the provided content.

Accepts:

- PDF file
- Website URL

---

## Explain Concept

### POST `/concept`

Explains important concepts found in the uploaded material.

Accepts:

- PDF file
- Website URL

---

## Generate Notes

### POST `/notes`

Creates organized study notes from the provided material.

Accepts:

- PDF file
- Website URL

---

# Upload Format

For file uploads use:

```
multipart/form-data
```

Field name:

```
pdf
```

For websites:

```
url
```

Example:

```
url=https://example.com/article
```

---

# Example Response

```json
{
    "summary": "..."
}
```

or

```json
{
    "flashcards": [...]
}
```

or

```json
{
    "quiz": [...]
}
```

---

# Supported Inputs

- PDF
- Website URL

More input formats are planned for future releases.

---

# Error Responses

```json
{
    "error": "No file uploaded and no URL provided"
}
```

```json
{
    "error": "Something went wrong processing your request."
}
```

---

# Version

Current API Version

```
v1
```

---

# Roadmap

- DOCX support
- PPTX support
- YouTube transcript support
- Markdown support
- Text file support
- Authentication
- API Keys
- Rate limiting
- Usage analytics

---

# License

MIT License