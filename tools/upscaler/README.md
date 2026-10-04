# PixelLift — GitHub Pages AI Image Upscaler

PixelLift is a static, browser-based image upscaler. It uses Real-ESRGAN ONNX models with ONNX Runtime Web, so the actual image processing happens in the visitor's browser.

## Features

- PNG, JPG, JPEG, WebP and other browser-supported image formats
- Drag-and-drop and multi-file upload
- Batch queue (up to 20 images)
- AI 2× and 4× output modes
- Real-ESRGAN x4plus model for higher detail
- Faster Real-ESRGAN General model for smaller downloads
- WebGPU first, WASM fallback
- Tiled inference for large images
- Adjustable tile size and overlap
- AI strength slider for natural blending
- PNG, JPEG and WebP output
- PNG transparency preservation
- Before/after comparison slider
- Download one image or all results as a ZIP
- Model caching in the browser after the first download
- No server, database, login or image upload endpoint required
- Responsive desktop/mobile UI
- Dark/light theme

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js` and `README.md`.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch and `/ (root)` folder.
6. Save. GitHub will publish the site.

No Node.js build step is required.

## Important model/runtime note

The site loads ONNX Runtime Web from jsDelivr and model weights from Hugging Face at runtime. The first visit therefore needs internet access. The model is then stored in the browser Cache Storage for later use.

The model URLs are defined near the top of `app.js` inside `MODELS`. Replace them with your own hosted model files if you want the project to be completely independent of third-party CDNs.

## Recommended use

Use **Real-ESRGAN x4plus** when detail quality is the priority. Use **Real-ESRGAN General** when faster model download and processing matter more.

For very large originals, start with 2× output or reduce the tile size if the browser runs out of memory.

## Attribution

The Real-ESRGAN weights are derived from the Real-ESRGAN project and are distributed by the referenced model repository under the BSD-3-Clause license. See the model repository and its included license for the precise attribution terms.
