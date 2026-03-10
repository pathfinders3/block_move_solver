(function () {
  const btnLoadJson = document.getElementById('btnLoadJson');
  const jsonOutput = document.getElementById('jsonOutput');
  const status = document.getElementById('status');
  const baseCanvas = document.getElementById('baseCanvas');
  const zoomCanvas = document.getElementById('zoomCanvas');
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  const zoomCtx = zoomCanvas.getContext('2d', { willReadFrequently: true });
  const scaleRange = document.getElementById('scaleRange');
  const scaleDisplay = document.getElementById('scaleDisplay');
  const scaleValues = [2, 4, 8, 16, 32, 64];

  let currentRects = [];

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', !!isError);
  }

  function drawBaseCanvas(rects) {
    baseCtx.fillStyle = '#ffffff';
    baseCtx.fillRect(0, 0, 64, 64);

    rects.forEach((rect, idx) => {
      const hue = (idx * 47) % 360;
      const fill = `hsla(${hue}, 80%, 42%, 0.75)`;
      const stroke = `hsl(${hue}, 85%, 62%)`;

      baseCtx.fillStyle = fill;
      baseCtx.fillRect(rect.x, rect.y, rect.size, rect.size);

      baseCtx.strokeStyle = stroke;
      baseCtx.lineWidth = 1;
      baseCtx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.size - 1, rect.size - 1);
    });
  }

  function drawZoomCanvas() {
    const scale = scaleValues[parseInt(scaleRange.value, 10) || 0];
    scaleDisplay.textContent = `${scale}x`;

    zoomCanvas.width = 64 * scale;
    zoomCanvas.height = 64 * scale;

    const imageData = baseCtx.getImageData(0, 0, 64, 64);
    const data = imageData.data;

    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3] / 255;
        zoomCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        zoomCtx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  function normalizeRects(parsed) {
    const source = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.rects) ? parsed.rects : null);

    if (!source) return null;

    const normalized = [];
    for (const item of source) {
      if (!item || typeof item !== 'object') continue;

      const x = Number(item.x);
      const y = Number(item.y);
      const size = Number(item.size);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size)) continue;
      if (size <= 0) continue;

      normalized.push({
        x: Math.round(x),
        y: Math.round(y),
        size: Math.round(size)
      });
    }

    return normalized;
  }

  function renderRects(rects) {
    currentRects = rects;
    drawBaseCanvas(currentRects);
    drawZoomCanvas();
  }

  async function loadJsonFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setStatus('클립보드에 텍스트가 없습니다.', true);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        setStatus('클립보드 텍스트가 JSON 형식이 아닙니다.', true);
        jsonOutput.value = text;
        return;
      }

      const rects = normalizeRects(parsed);
      if (!rects) {
        setStatus('JSON 배열 형식이 아닙니다. [{x,y,size,...}] 형태가 필요합니다.', true);
        jsonOutput.value = JSON.stringify(parsed, null, 2);
        return;
      }

      renderRects(rects);

      jsonOutput.value = JSON.stringify(parsed, null, 2);
      setStatus(`JSON을 불러왔습니다. 사각형 ${rects.length}개 렌더링 완료.`, false);
    } catch (error) {
      setStatus('클립보드 접근에 실패했습니다. 브라우저 권한을 확인해주세요.', true);
    }
  }

  scaleRange.addEventListener('input', drawZoomCanvas);
  btnLoadJson.addEventListener('click', loadJsonFromClipboard);

  renderRects([]);
})();
