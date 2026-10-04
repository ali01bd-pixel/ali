const ORT = window.ort;
const ZIP = window.JSZip;

const MODELS = {
  plus: {
    label: 'Real-ESRGAN x4plus',
    url: 'https://huggingface.co/jonathanst29/tinier-upscale-models/resolve/main/realesrgan-x4plus.onnx?download=true',
    size: '~67 MB',
    help: 'Downloads about 67 MB once, then stays cached in this browser.'
  },
  general: {
    label: 'Real-ESRGAN General',
    url: 'https://huggingface.co/jonathanst29/tinier-upscale-models/resolve/main/realesr-general-x4v3.onnx?download=true',
    size: '~5 MB',
    help: 'Downloads about 5 MB once, then stays cached in this browser.'
  }
};

const state = {
  items: [],
  selectedId: null,
  session: null,
  sessionKey: null,
  provider: null,
  modelLoading: false,
  busy: false,
  dark: true
};

const el = {
  dropZone: document.querySelector('#dropZone'),
  fileInput: document.querySelector('#fileInput'),
  chooseBtn: document.querySelector('#chooseBtn'),
  queue: document.querySelector('#queue'),
  queueCount: document.querySelector('#queueCount'),
  clearBtn: document.querySelector('#clearBtn'),
  upscaleAllBtn: document.querySelector('#upscaleAllBtn'),
  downloadAllBtn: document.querySelector('#downloadAllBtn'),
  themeBtn: document.querySelector('#themeBtn'),
  scaleSelect: document.querySelector('#scaleSelect'),
  modelSelect: document.querySelector('#modelSelect'),
  modelHelp: document.querySelector('#modelHelp'),
  tileSelect: document.querySelector('#tileSelect'),
  overlapSelect: document.querySelector('#overlapSelect'),
  formatSelect: document.querySelector('#formatSelect'),
  qualityRange: document.querySelector('#qualityRange'),
  qualityValue: document.querySelector('#qualityValue'),
  strengthRange: document.querySelector('#strengthRange'),
  strengthValue: document.querySelector('#strengthValue'),
  alphaCheck: document.querySelector('#alphaCheck'),
  compareCard: document.querySelector('#compareCard'),
  compareSub: document.querySelector('#compareSub'),
  compareStage: document.querySelector('#compareStage'),
  beforeImg: document.querySelector('#beforeImg'),
  afterLayer: document.querySelector('#afterLayer'),
  afterImg: document.querySelector('#afterImg'),
  compareLine: document.querySelector('#compareLine'),
  compareControl: document.querySelector('#compareControl'),
  compareRange: document.querySelector('#compareRange'),
  openOutputBtn: document.querySelector('#openOutputBtn'),
  downloadCurrentBtn: document.querySelector('#downloadCurrentBtn'),
  toast: document.querySelector('#toast'),
  busyModal: document.querySelector('#busyModal'),
  busyTitle: document.querySelector('#busyTitle'),
  busyText: document.querySelector('#busyText')
};

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.toast.classList.remove('show'), 3400);
}

function setBusy(show, title = '', text = '') {
  state.busy = show;
  el.busyModal.hidden = !show;
  el.busyTitle.textContent = title;
  el.busyText.textContent = text;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatTime(ms) {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function extForMime(mime) {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[mime] || 'png';
}

function sanitizeName(name) {
  return name.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image';
}

function makeStarts(length, tile, overlap) {
  const step = Math.max(1, tile - overlap);
  const starts = [];
  let p = 0;
  while (true) {
    starts.push(p);
    if (p + tile >= length) break;
    p += step;
    if (p + tile > length) p = Math.max(0, length - tile);
    if (starts.at(-1) === p) break;
  }
  return starts;
}

async function fileToBitmap(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = reject;
      node.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function getImageDimensions(file) {
  const bitmap = await fileToBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height, bitmap };
  return result;
}

function imageDataToCanvas(data, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

function rgbTensorFromImageData(imageData, width, height) {
  const src = imageData.data;
  const out = new Float32Array(width * height * 3);
  const plane = width * height;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    out[i] = src[p] / 255;
    out[plane + i] = src[p + 1] / 255;
    out[plane * 2 + i] = src[p + 2] / 255;
  }
  return out;
}

function modelOutputToCanvas(output, shape) {
  const outH = shape[2];
  const outW = shape[3];
  const plane = outH * outW;
  const rgba = new Uint8ClampedArray(outW * outH * 4);
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    rgba[p] = Math.max(0, Math.min(255, Math.round(output[i] * 255)));
    rgba[p + 1] = Math.max(0, Math.min(255, Math.round(output[plane + i] * 255)));
    rgba[p + 2] = Math.max(0, Math.min(255, Math.round(output[plane * 2 + i] * 255)));
    rgba[p + 3] = 255;
  }
  return imageDataToCanvas(rgba, outW, outH);
}

async function getCachedArrayBuffer(url, onProgress) {
  const cache = await caches.open('pixellift-models-v1');
  const hit = await cache.match(url);
  if (hit) return hit.arrayBuffer();

  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error(`Model download failed (${response.status})`);

  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body) {
    const buf = await response.arrayBuffer();
    const stored = new Response(buf, { headers: { 'content-type': 'application/octet-stream' } });
    await cache.put(url, stored);
    return buf;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      if (total) onProgress(received / total);
    }
  }
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  await cache.put(url, new Response(buffer, { headers: { 'content-type': 'application/octet-stream' } }));
  return buffer.buffer;
}

async function createSession(modelKey) {
  if (!ORT) throw new Error('ONNX Runtime Web failed to load. Check your internet connection and try again.');

  ORT.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
  ORT.env.wasm.numThreads = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2));
  ORT.env.logLevel = 'warning';

  const model = MODELS[modelKey];
  state.modelLoading = true;
  setBusy(true, `Loading ${model.label}`, `${model.size} model · downloaded once and cached locally`);
  try {
    const arrayBuffer = await getCachedArrayBuffer(model.url, p => {
      el.busyTitle.textContent = `Downloading ${model.label}`;
      el.busyText.textContent = `${Math.round(p * 100)}% downloaded · cached in this browser`;
    });

    const providers = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm'];
    let lastError;
    for (const provider of providers) {
      try {
        el.busyTitle.textContent = `Starting ${model.label}`;
        el.busyText.textContent = provider === 'webgpu' ? 'Trying WebGPU acceleration, with WASM fallback.' : 'Starting CPU/WASM inference.';
        const session = await ORT.InferenceSession.create(arrayBuffer, {
          executionProviders: [provider],
          graphOptimizationLevel: 'all'
        });
        state.provider = provider;
        state.session = session;
        state.sessionKey = modelKey;
        return session;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Could not initialize the AI model.');
  } finally {
    state.modelLoading = false;
    setBusy(false);
  }
}

async function ensureSession() {
  const key = el.modelSelect.value;
  if (state.session && state.sessionKey === key) return state.session;
  if (state.session?.release) {
    try { await state.session.release(); } catch {}
  }
  state.session = null;
  return createSession(key);
}

function outputCanvasFromSource(srcCanvas, outputScale) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(srcCanvas.width * outputScale));
  canvas.height = Math.max(1, Math.round(srcCanvas.height * outputScale));
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return canvas;
}

function applyOriginalAlpha(outputCanvas, sourceCanvas) {
  const ctx = outputCanvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, outputCanvas.width, outputCanvas.height);
  ctx.restore();
}

async function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode output image.')), mime, quality);
  });
}

async function upscaleFile(item) {
  item.status = 'loading';
  item.error = '';
  renderQueue();
  const started = performance.now();
  const bitmap = await fileToBitmap(item.file);
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = bitmap.width;
  sourceCanvas.height = bitmap.height;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true, alpha: true });
  sourceCtx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const scale = Number(el.scaleSelect.value);
  const tile = Number(el.tileSelect.value);
  const overlap = Math.min(Number(el.overlapSelect.value), tile - 8);
  if (tile <= overlap) throw new Error('Tile size must be larger than overlap.');

  const outputCanvas = outputCanvasFromSource(sourceCanvas, scale);
  const outCtx = outputCanvas.getContext('2d', { alpha: true });
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  const session = await ensureSession();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];

  const xs = makeStarts(sourceCanvas.width, tile, overlap);
  const ys = makeStarts(sourceCanvas.height, tile, overlap);
  const total = xs.length * ys.length;
  let done = 0;
  item.status = 'processing';
  item.progress = 0;
  item.provider = state.provider;
  renderQueue();

  for (const y of ys) {
    for (const x of xs) {
      const w = Math.min(tile, sourceCanvas.width - x);
      const h = Math.min(tile, sourceCanvas.height - y);
      const tileData = sourceCtx.getImageData(x, y, w, h);
      const tensorData = rgbTensorFromImageData(tileData, w, h);
      const tensor = new ORT.Tensor('float32', tensorData, [1, 3, h, w]);
      const result = await session.run({ [inputName]: tensor });
      const output = result[outputName] ?? result[session.outputNames[0]];
      if (!output?.data || !output?.dims || output.dims.length !== 4) throw new Error('Unexpected model output shape.');

      const tileCanvas = modelOutputToCanvas(output.data, output.dims);
      const modelScale = 4;
      const cropLeft = x === 0 ? 0 : Math.floor(overlap / 2);
      const cropTop = y === 0 ? 0 : Math.floor(overlap / 2);
      const cropRight = x + w >= sourceCanvas.width ? 0 : Math.floor(overlap / 2);
      const cropBottom = y + h >= sourceCanvas.height ? 0 : Math.floor(overlap / 2);
      const cropW = tileCanvas.width - (cropLeft + cropRight) * modelScale;
      const cropH = tileCanvas.height - (cropTop + cropBottom) * modelScale;
      const destX = Math.round((x + cropLeft) * scale);
      const destY = Math.round((y + cropTop) * scale);
      const destW = Math.round((cropW / modelScale) * scale);
      const destH = Math.round((cropH / modelScale) * scale);

      outCtx.drawImage(tileCanvas,
        cropLeft * modelScale, cropTop * modelScale, cropW, cropH,
        destX, destY, destW, destH);

      done += 1;
      item.progress = Math.round(done / total * 100);
      renderQueue();
      await new Promise(requestAnimationFrame);
    }
  }

  const strength = Number(el.strengthRange.value) / 100;
  if (strength < 0.999) {
    const baseline = outputCanvasFromSource(sourceCanvas, scale);
    const baselineCtx = baseline.getContext('2d');
    baselineCtx.imageSmoothingEnabled = true;
    baselineCtx.imageSmoothingQuality = 'high';
    baselineCtx.drawImage(sourceCanvas, 0, 0, baseline.width, baseline.height);
    outCtx.save();
    outCtx.globalAlpha = 1 - strength;
    outCtx.drawImage(baseline, 0, 0);
    outCtx.restore();
  }

  const format = el.formatSelect.value;
  const preserveAlpha = el.alphaCheck.checked && format === 'image/png';
  if (preserveAlpha) applyOriginalAlpha(outputCanvas, sourceCanvas);

  const quality = Number(el.qualityRange.value) / 100;
  const blob = await canvasToBlob(outputCanvas, format, quality);
  const ext = extForMime(format);
  const filename = `${sanitizeName(item.file.name)}_upscaled_${scale}x.${ext}`;
  item.outputBlob = blob;
  item.outputUrl && URL.revokeObjectURL(item.outputUrl);
  item.outputUrl = URL.createObjectURL(blob);
  item.outputName = filename;
  item.outputWidth = outputCanvas.width;
  item.outputHeight = outputCanvas.height;
  item.elapsed = performance.now() - started;
  item.progress = 100;
  item.status = 'done';
  item.mime = format;
  item.selected = true;
  state.selectedId = item.id;
  renderQueue();
  renderComparison();
}

function statusLabel(item) {
  if (item.status === 'queued') return ['Queued', ''];
  if (item.status === 'loading') return ['Preparing', 'warning'];
  if (item.status === 'processing') return [`${item.progress}%`, 'warning'];
  if (item.status === 'done') return ['Ready', 'success'];
  if (item.status === 'error') return ['Error', 'danger'];
  return ['—', ''];
}

function renderQueue() {
  const total = state.items.length;
  const ready = state.items.filter(x => x.status === 'done').length;
  el.queueCount.textContent = `${total} image${total === 1 ? '' : 's'}${ready ? ` · ${ready} ready` : ''}`;
  el.clearBtn.disabled = total === 0 || state.busy;
  el.upscaleAllBtn.disabled = total === 0 || state.busy;
  el.downloadAllBtn.disabled = ready === 0 || state.busy;
  el.queue.innerHTML = '';

  for (const item of state.items) {
    const card = document.createElement('article');
    card.className = 'queue-card';
    const [status, badgeClass] = statusLabel(item);
    const outputInfo = item.outputWidth ? `${item.outputWidth.toLocaleString()} × ${item.outputHeight.toLocaleString()} · ${formatBytes(item.outputBlob.size)}` : `${item.width?.toLocaleString() || '—'} × ${item.height?.toLocaleString() || '—'} · ${formatBytes(item.file.size)}`;
    card.innerHTML = `
      <div class="thumb"><img src="${item.previewUrl}" alt="" /></div>
      <div class="file-meta">
        <div class="file-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</div>
        <div class="file-sub">${outputInfo}${item.elapsed ? ` · ${formatTime(item.elapsed)}` : ''}</div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${item.progress || 0}%"></div></div>
        <div class="status-line">${item.error ? escapeHtml(item.error) : item.status === 'processing' ? `Using ${item.provider === 'webgpu' ? 'WebGPU' : 'WASM'} · tiled AI inference` : item.status === 'done' ? 'Click this card to open the before / after viewer.' : 'Ready to upscale'}</div>
      </div>
      <div class="card-actions">
        <span class="badge ${badgeClass}">${status}</span>
        <button class="icon-btn small remove-btn" type="button" data-remove="${item.id}" title="Remove">×</button>
        <button class="icon-btn small" type="button" data-select="${item.id}" title="Compare" ${item.status === 'done' ? '' : 'disabled'}>↗</button>
        <button class="icon-btn small" type="button" data-download="${item.id}" title="Download" ${item.status === 'done' ? '' : 'disabled'}>↓</button>
      </div>`;
    el.queue.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function renderComparison() {
  const item = state.items.find(x => x.id === state.selectedId && x.status === 'done');
  if (!item) {
    el.compareCard.classList.add('empty');
    el.compareSub.textContent = 'Select a completed image to compare.';
    el.openOutputBtn.disabled = true;
    el.downloadCurrentBtn.disabled = true;
    el.compareControl.hidden = true;
    el.beforeImg.removeAttribute('src');
    el.afterImg.removeAttribute('src');
    return;
  }
  el.compareCard.classList.remove('empty');
  el.compareSub.textContent = `${item.outputWidth.toLocaleString()} × ${item.outputHeight.toLocaleString()} · ${formatBytes(item.outputBlob.size)} · ${formatTime(item.elapsed)} · ${item.provider === 'webgpu' ? 'WebGPU' : 'WASM'}`;
  el.beforeImg.src = item.previewUrl;
  el.afterImg.src = item.outputUrl;
  el.openOutputBtn.disabled = false;
  el.downloadCurrentBtn.disabled = false;
  el.compareControl.hidden = false;
  updateCompare(Number(el.compareRange.value));
}

function updateCompare(value) {
  const p = `${value}%`;
  el.afterLayer.style.width = p;
  el.compareLine.style.left = p;
}

function selectItem(id) {
  state.selectedId = id;
  renderQueue();
  renderComparison();
}

function downloadItem(item) {
  if (!item?.outputBlob) return;
  const a = document.createElement('a');
  a.href = item.outputUrl;
  a.download = item.outputName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadAll() {
  const ready = state.items.filter(x => x.outputBlob);
  if (!ready.length) return;
  if (!ZIP) {
    toast('ZIP library failed to load; download files individually.');
    return;
  }
  setBusy(true, 'Building download package', `Adding ${ready.length} processed image${ready.length === 1 ? '' : 's'}…`);
  try {
    const zip = new ZIP();
    for (const item of ready) zip.file(item.outputName, item.outputBlob);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pixellift-upscaled-${Date.now()}.zip`; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } finally {
    setBusy(false);
  }
}

async function addFiles(files) {
  const images = Array.from(files).filter(file => file.type.startsWith('image/'));
  if (!images.length) { toast('Please choose image files.'); return; }
  const room = Math.max(0, 20 - state.items.length);
  const chosen = images.slice(0, room);
  if (images.length > room) toast('Maximum 20 images per batch.');
  for (const file of chosen) {
    try {
      const info = await getImageDimensions(file);
      const previewUrl = URL.createObjectURL(file);
      state.items.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl,
        width: info.width,
        height: info.height,
        progress: 0,
        status: 'queued',
        outputBlob: null,
        outputUrl: null,
        error: ''
      });
    } catch (error) {
      console.error(error);
      toast(`Could not read ${file.name}.`);
    }
  }
  renderQueue();
}

function removeItem(id) {
  const index = state.items.findIndex(x => x.id === id);
  if (index < 0) return;
  const item = state.items[index];
  URL.revokeObjectURL(item.previewUrl);
  item.outputUrl && URL.revokeObjectURL(item.outputUrl);
  state.items.splice(index, 1);
  if (state.selectedId === id) state.selectedId = state.items.find(x => x.status === 'done')?.id || null;
  renderQueue(); renderComparison();
}

async function upscaleOneSafe(item) {
  try {
    await upscaleFile(item);
  } catch (error) {
    console.error(error);
    item.status = 'error';
    item.error = error?.message || 'Upscaling failed.';
    renderQueue();
  }
}

async function upscaleAll() {
  if (!state.items.length) return;
  setBusy(true, 'Preparing AI upscaling', 'The first image may take longer while the model starts.');
  try {
    await ensureSession();
  } catch (error) {
    setBusy(false);
    toast(error?.message || 'Could not start the AI model.');
    return;
  }
  setBusy(false);
  state.busy = true;
  renderQueue();
  try {
    for (const item of state.items) {
      if (item.status === 'done') continue;
      await upscaleOneSafe(item);
    }
  } finally {
    state.busy = false;
    renderQueue();
  }
  const finished = state.items.filter(x => x.status === 'done').length;
  if (finished) toast(`${finished} image${finished === 1 ? '' : 's'} ready.`);
}

function setTheme(dark) {
  state.dark = dark;
  document.body.classList.toggle('light', !dark);
  localStorage.setItem('pixellift-theme', dark ? 'dark' : 'light');
}

el.chooseBtn.addEventListener('click', () => el.fileInput.click());
el.dropZone.addEventListener('click', event => { if (event.target === el.dropZone) el.fileInput.click(); });
el.fileInput.addEventListener('change', event => { addFiles(event.target.files); event.target.value = ''; });
el.dropZone.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target === el.dropZone) { event.preventDefault(); el.fileInput.click(); }
});
['dragenter','dragover'].forEach(type => el.dropZone.addEventListener(type, event => { event.preventDefault(); el.dropZone.classList.add('dragging'); }));
['dragleave','drop'].forEach(type => el.dropZone.addEventListener(type, event => { event.preventDefault(); el.dropZone.classList.remove('dragging'); }));
el.dropZone.addEventListener('drop', event => addFiles(event.dataTransfer.files));

el.clearBtn.addEventListener('click', () => {
  if (state.busy) return;
  for (const item of state.items) { URL.revokeObjectURL(item.previewUrl); item.outputUrl && URL.revokeObjectURL(item.outputUrl); }
  state.items = []; state.selectedId = null;
  renderQueue(); renderComparison();
});
el.upscaleAllBtn.addEventListener('click', upscaleAll);
el.downloadAllBtn.addEventListener('click', downloadAll);

el.queue.addEventListener('click', event => {
  const removeId = event.target.closest('[data-remove]')?.dataset.remove;
  const selectId = event.target.closest('[data-select]')?.dataset.select;
  const downloadId = event.target.closest('[data-download]')?.dataset.download;
  if (removeId) return removeItem(removeId);
  if (selectId) return selectItem(selectId);
  if (downloadId) return downloadItem(state.items.find(x => x.id === downloadId));
});
el.queue.addEventListener('dblclick', event => {
  const card = event.target.closest('.queue-card');
  const selectId = card?.querySelector('[data-select]')?.dataset.select;
  if (selectId) selectItem(selectId);
});

el.compareRange.addEventListener('input', event => updateCompare(Number(event.target.value)));
el.openOutputBtn.addEventListener('click', () => {
  const item = state.items.find(x => x.id === state.selectedId);
  if (item?.outputUrl) window.open(item.outputUrl, '_blank', 'noopener');
});
el.downloadCurrentBtn.addEventListener('click', () => downloadItem(state.items.find(x => x.id === state.selectedId)));

el.modelSelect.addEventListener('change', () => {
  const model = MODELS[el.modelSelect.value];
  el.modelHelp.textContent = model.help;
  if (state.sessionKey !== el.modelSelect.value) toast(`Next run will load ${model.label}.`);
});
el.qualityRange.addEventListener('input', e => el.qualityValue.textContent = `${e.target.value}%`);
el.strengthRange.addEventListener('input', e => el.strengthValue.textContent = `${e.target.value}%`);

el.themeBtn.addEventListener('click', () => setTheme(!state.dark));

window.addEventListener('beforeunload', () => {
  for (const item of state.items) { URL.revokeObjectURL(item.previewUrl); item.outputUrl && URL.revokeObjectURL(item.outputUrl); }
});

const savedTheme = localStorage.getItem('pixellift-theme');
setTheme(savedTheme !== 'light');
renderQueue();
renderComparison();

if (!window.isSecureContext) toast('GitHub Pages serves over HTTPS. Local testing should use localhost for best WebGPU support.');
