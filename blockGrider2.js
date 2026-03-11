(function () {
  const btnLoadJson = document.getElementById('btnLoadJson');
  const jsonOutput = document.getElementById('jsonOutput');
  const status = document.getElementById('status');
  const clickInfo = document.getElementById('clickInfo');
  const baseCanvas = document.getElementById('baseCanvas');
  const baseCanvasTitle = document.getElementById('baseCanvasTitle');
  const zoomCanvas = document.getElementById('zoomCanvas');
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  const zoomCtx = zoomCanvas.getContext('2d', { willReadFrequently: true });
  const scaleRange = document.getElementById('scaleRange');
  const scaleDisplay = document.getElementById('scaleDisplay');
  const scaleValues = [2, 4, 8, 16, 32, 64];
  const MIN_CANVAS_SIZE = 64;
  const MAX_CANVAS_SIZE = 512;

  let currentRectGroups = [];
  let selectedRect = null;

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', !!isError);
  }

  function calculateCanvasSize(rects) {
    if (!rects || rects.length === 0) return MIN_CANVAS_SIZE;

    let maxRight = MIN_CANVAS_SIZE;
    let maxBottom = MIN_CANVAS_SIZE;

    rects.forEach(rect => {
      maxRight = Math.max(maxRight, rect.x + rect.size);
      maxBottom = Math.max(maxBottom, rect.y + rect.size);
    });

    const required = Math.max(MIN_CANVAS_SIZE, maxRight, maxBottom);
    return Math.min(MAX_CANVAS_SIZE, required);
  }

  function getCurrentScale() {
    return scaleValues[parseInt(scaleRange.value, 10) || 0];
  }

  function isPointInRect(x, y, rect) {
    return x >= rect.x && x < rect.x + rect.size && y >= rect.y && y < rect.y + rect.size;
  }

  function findRectAtPoint(x, y) {
    for (let g = currentRectGroups.length - 1; g >= 0; g--) {
      const group = currentRectGroups[g];
      for (let r = group.length - 1; r >= 0; r--) {
        const rect = group[r];
        if (isPointInRect(x, y, rect)) {
          return { groupIndex: g, rectIndex: r, rect };
        }
      }
    }
    return null;
  }

  function updateClickInfo(x, y, hit) {
    if (!clickInfo) return;
    if (!hit) {
      clickInfo.textContent = `클릭 좌표: (${x}, ${y}) | 선택 없음`;
      return;
    }

    const rect = hit.rect;
    clickInfo.textContent =
      `클릭 좌표: (${x}, ${y}) | 그룹 ${hit.groupIndex + 1}, 도형 ${hit.rectIndex + 1}, ` +
      `사각형 (${rect.x}, ${rect.y}, size=${rect.size})`;
  }

  function handleCanvasClick(x, y) {
    const hit = findRectAtPoint(x, y);
    selectedRect = hit ? { groupIndex: hit.groupIndex, rectIndex: hit.rectIndex } : null;
    updateClickInfo(x, y, hit);
    drawBaseCanvas(currentRectGroups);
    drawZoomCanvas();
  }

  function getCanvasCoordsFromEvent(event, canvas, scale) {
    const rect = canvas.getBoundingClientRect();
    const pixelX = Math.floor((event.clientX - rect.left) / scale);
    const pixelY = Math.floor((event.clientY - rect.top) / scale);
    const x = Math.max(0, Math.min(baseCanvas.width - 1, pixelX));
    const y = Math.max(0, Math.min(baseCanvas.height - 1, pixelY));
    return { x, y };
  }

  function getTotalRectCount(rectGroups) {
    return rectGroups.reduce((sum, group) => sum + group.length, 0);
  }

  function drawBaseCanvas(rectGroups) {
    const mergedRects = rectGroups.flat();
    const canvasSize = calculateCanvasSize(mergedRects);
    baseCanvas.width = canvasSize;
    baseCanvas.height = canvasSize;
    if (baseCanvasTitle) {
      baseCanvasTitle.textContent = `원본 ${canvasSize}x${canvasSize}`;
    }

    baseCtx.fillStyle = '#ffffff';
    baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

    rectGroups.forEach((group, groupIndex) => {
      const groupHue = (groupIndex * 67) % 360;
      const fill = `hsla(${groupHue}, 80%, 42%, 0.55)`;
      const stroke = `hsl(${groupHue}, 85%, 62%)`;

      group.forEach(rect => {
        baseCtx.fillStyle = fill;
        baseCtx.fillRect(rect.x, rect.y, rect.size, rect.size);

        baseCtx.strokeStyle = stroke;
        baseCtx.lineWidth = 1;
        baseCtx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.size - 1, rect.size - 1);
      });
    });

    if (selectedRect) {
      const selectedGroup = rectGroups[selectedRect.groupIndex];
      const rect = selectedGroup && selectedGroup[selectedRect.rectIndex];
      if (!rect) {
        selectedRect = null;
        return;
      }

      baseCtx.strokeStyle = '#ff3b30';
      baseCtx.lineWidth = 2;
      baseCtx.strokeRect(rect.x + 1, rect.y + 1, Math.max(1, rect.size - 2), Math.max(1, rect.size - 2));
    }
  }

  function drawZoomCanvas() {
    const scale = getCurrentScale();
    scaleDisplay.textContent = `${scale}x`;

    const baseW = baseCanvas.width;
    const baseH = baseCanvas.height;

    zoomCanvas.width = baseW * scale;
    zoomCanvas.height = baseH * scale;

    const imageData = baseCtx.getImageData(0, 0, baseW, baseH);
    const data = imageData.data;

    for (let y = 0; y < baseH; y++) {
      for (let x = 0; x < baseW; x++) {
        const i = (y * baseW + x) * 4;
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

  function renderGroups(rectGroups) {
    currentRectGroups = rectGroups;
    drawBaseCanvas(currentRectGroups);
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

      const nextGroups = currentRectGroups.concat([rects]);
      renderGroups(nextGroups);
      console.log(`🖼️ 실제 해상도: ${baseCanvas.width}x${baseCanvas.height}`);

      jsonOutput.value = JSON.stringify(parsed, null, 2);
      setStatus(
        `JSON을 불러왔습니다. 그룹 ${currentRectGroups.length}개, 누적 ${getTotalRectCount(currentRectGroups)}개 렌더링 완료.`,
        false
      );
    } catch (error) {
      setStatus('클립보드 접근에 실패했습니다. 브라우저 권한을 확인해주세요.', true);
    }
  }

  scaleRange.addEventListener('input', drawZoomCanvas);

  baseCanvas.addEventListener('click', event => {
    const point = getCanvasCoordsFromEvent(event, baseCanvas, 1);
    handleCanvasClick(point.x, point.y);
  });

  zoomCanvas.addEventListener('click', event => {
    const point = getCanvasCoordsFromEvent(event, zoomCanvas, getCurrentScale());
    handleCanvasClick(point.x, point.y);
  });

  btnLoadJson.addEventListener('click', loadJsonFromClipboard);

  renderGroups([]);
})();
