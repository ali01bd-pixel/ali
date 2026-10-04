# Ali Creative HUB

A single GitHub Pages website that brings three browser-based creative tools into one dashboard:

1. **AI Image Upscaler** — Real-ESRGAN + ONNX Runtime Web, with batch processing and before/after comparison.
2. **Flat-Color Vectorizer** — controlled palette tracing with editable SVG and EPS export.
3. **Stock Metadata Generator** — AI-generated titles, keywords, categories, and Excel export.

## Run on GitHub Pages

Upload the contents of this folder to a GitHub repository and enable **Settings → Pages → Deploy from a branch**. The root `index.html` is the site entry point.

The tool pages remain isolated under `tools/` so their original DOM/CSS/JavaScript logic does not conflict with each other. The hub loads the selected tool into a same-origin iframe and keeps a clean top-level navigation, hash URLs, lazy loading, and automatic iframe sizing.

## Important notes

- The **Upscaler** loads ONNX Runtime Web from jsDelivr and Real-ESRGAN model weights from Hugging Face on first use; the original project caches model weights in browser Cache Storage.
- The **Vectorizer** runs locally in the browser and does not require a server.
- The **Metadata Generator** sends selected images and prompts to the AI provider you configure. API keys are stored in browser localStorage by the original tool; do not use a key in a public/shared browser profile.
- The metadata tool's Gemini REST call uses the current camelCase Gemini request fields (`responseMimeType` / `inlineData`).

## Keyboard shortcuts

- `H` — Home
- `1` — Upscaler
- `2` — Vectorizer
- `3` — Metadata
