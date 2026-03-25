(function () {
  function init() {
  const output = document.getElementById('output');
  const status = document.getElementById('status');
  const badgeMethod = document.getElementById('badgeMethod');
  const badgeGroups = document.getElementById('badgeGroups');
  const badgePoints = document.getElementById('badgePoints');
  const btnCopy = document.getElementById('btnCopy');
  const btnCopyBitmap = document.getElementById('btnCopyBitmap');
  const btnRestoreOriginal = document.getElementById('btnRestoreOriginal');
  const btnReload = document.getElementById('btnReload');
  const btnSimplifyDp = document.getElementById('btnSimplifyDp');
  const btnTogglePathLines = document.getElementById('btnTogglePathLines');
  const baseCanvas = document.getElementById('baseCanvas');
  const zoomCanvas = document.getElementById('zoomCanvas');
  const baseCanvasTitle = document.getElementById('baseCanvasTitle');
  const scaleRange = document.getElementById('scaleRange');
  const scaleDisplay = document.getElementById('scaleDisplay');
  const dpToleranceRange = document.getElementById('dpToleranceRange');
  const dpToleranceDisplay = document.getElementById('dpToleranceDisplay');
  const lineThicknessRange = document.getElementById('lineThicknessRange');
  const lineThicknessDisplay = document.getElementById('lineThicknessDisplay');

  const required = [
    output,
    status,
    badgeMethod,
    badgeGroups,
    badgePoints,
    btnCopy,
    btnCopyBitmap,
    btnRestoreOriginal,
    btnReload,
    btnSimplifyDp,
    btnTogglePathLines,
    baseCanvas,
    zoomCanvas,
    baseCanvasTitle,
    scaleRange,
    scaleDisplay,
    dpToleranceRange,
    dpToleranceDisplay,
    lineThicknessRange,
    lineThicknessDisplay
  ];
  if (required.some(el => !el)) {
    console.error('blockGrider3 init 실패: 필수 DOM 요소를 찾지 못했습니다. blockGrider3.html에서만 실행해주세요.');
    return;
  }

  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  const zoomCtx = zoomCanvas.getContext('2d', { willReadFrequently: true });
  if (!baseCtx || !zoomCtx) {
    console.error('blockGrider3 init 실패: Canvas 2D context를 만들 수 없습니다.');
    return;
  }
  baseCtx.imageSmoothingEnabled = false;
  zoomCtx.imageSmoothingEnabled = false;

  const scaleValues = [2, 4, 8, 16, 32, 64];
  const MIN_CANVAS_SIZE = 64;
  const MAX_CANVAS_SIZE = 1024;
  const DEFAULT_DP_EPSILON = 1.5;
  const DP_AUTO_APPLY_DEBOUNCE_MS = 80;
  const DEFAULT_LINE_THICKNESS = 1;
  const LINE_THICKNESS_STORAGE_KEY = 'blockGrider3.lineThickness';

  let currentPayload = null;
  let originalPayload = null;
  let dpSourcePayload = null;
  let dpAutoApplyTimer = null;
  let showPathLines = false;

  function setStatus(message, warn) {
    status.textContent = message;
    status.classList.toggle('warn', !!warn);
  }

  function countPoints(groups) {
    return (groups || []).reduce((sum, group) => {
      return sum + (group.segments || []).reduce((segmentSum, segment) => {
        return segmentSum + (segment.points || []).length;
      }, 0);
    }, 0);
  }

  function clonePoint(point) {
    return {
      x: Number(point.x),
      y: Number(point.y),
      size: Number(point.size),
      canConnect: !!point.canConnect
    };
  }

  function perpendicularDistance(point, start, end) {
    const px = Number(point.x);
    const py = Number(point.y);
    const x1 = Number(start.x);
    const y1 = Number(start.y);
    const x2 = Number(end.x);
    const y2 = Number(end.y);

    if (![px, py, x1, y1, x2, y2].every(Number.isFinite)) return 0;

    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      return Math.hypot(px - x1, py - y1);
    }

    return Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
  }

  function simplifySegmentDp(points, epsilon) {
    const len = points.length;
    if (len <= 2) return points.map(clonePoint);

    const keep = new Array(len).fill(false);
    keep[0] = true;
    keep[len - 1] = true;

    function mark(startIdx, endIdx) {
      if (endIdx - startIdx <= 1) return;

      let maxDist = -1;
      let farthestIdx = -1;
      for (let i = startIdx + 1; i < endIdx; i++) {
        const dist = perpendicularDistance(points[i], points[startIdx], points[endIdx]);
        if (dist > maxDist) {
          maxDist = dist;
          farthestIdx = i;
        }
      }

      if (farthestIdx >= 0 && maxDist > epsilon) {
        keep[farthestIdx] = true;
        mark(startIdx, farthestIdx);
        mark(farthestIdx, endIdx);
      }
    }

    mark(0, len - 1);

    const simplified = [];
    for (let i = 0; i < len; i++) {
      if (keep[i]) simplified.push(clonePoint(points[i]));
    }
    return simplified;
  }

  function simplifyByConnectNodes(points, epsilon) {
    if (!Array.isArray(points) || points.length <= 2) {
      return (points || []).map(clonePoint);
    }

    const boundaries = [0];
    for (let i = 1; i < points.length - 1; i++) {
      if (points[i] && points[i].canConnect === true) {
        boundaries.push(i);
      }
    }
    boundaries.push(points.length - 1);

    const simplified = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      const chunk = points.slice(start, end + 1);
      const chunkSimplified = simplifySegmentDp(chunk, epsilon);

      if (i === 0) {
        simplified.push(...chunkSimplified);
      } else {
        simplified.push(...chunkSimplified.slice(1));
      }
    }

    return simplified;
  }

  function simplifyPayloadByDp(payload, epsilon) {
    const next = {
      ...payload,
      groups: Array.isArray(payload.groups)
        ? payload.groups.map(group => ({
            ...group,
            segments: Array.isArray(group.segments)
              ? group.segments.map(segment => ({
                  ...segment,
                  points: simplifyByConnectNodes(Array.isArray(segment.points) ? segment.points : [], epsilon)
                }))
              : []
          }))
        : []
    };

    return next;
  }

  function deepCloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function updateMeta(payload, methodText) {
    const groups = payload && Array.isArray(payload.groups) ? payload.groups : [];
    badgeMethod.textContent = `전달 방식: ${methodText}`;
    badgeGroups.textContent = `그룹: ${groups.length}`;
    badgePoints.textContent = `점: ${countPoints(groups)}`;
  }

  function getCurrentScale() {
    const idx = parseInt(scaleRange.value, 10) || 0;
    return scaleValues[idx];
  }

  function getCurrentDpTolerance() {
    const epsilon = Number(dpToleranceRange.value);
    if (!Number.isFinite(epsilon)) return DEFAULT_DP_EPSILON;
    return Math.max(0, epsilon);
  }

  function updateDpToleranceDisplay() {
    dpToleranceDisplay.textContent = getCurrentDpTolerance().toFixed(1);
  }

  function sanitizeLineThickness(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_LINE_THICKNESS;
    return Math.max(1, Math.min(5, Math.round(num)));
  }

  function getCurrentLineThickness() {
    return sanitizeLineThickness(lineThicknessRange.value);
  }

  function updateLineThicknessDisplay() {
    lineThicknessDisplay.textContent = String(getCurrentLineThickness());
  }

  function loadLineThicknessFromStorage() {
    try {
      const raw = localStorage.getItem(LINE_THICKNESS_STORAGE_KEY);
      if (raw == null) return DEFAULT_LINE_THICKNESS;
      return sanitizeLineThickness(raw);
    } catch (error) {
      return DEFAULT_LINE_THICKNESS;
    }
  }

  function saveLineThicknessToStorage(value) {
    try {
      localStorage.setItem(LINE_THICKNESS_STORAGE_KEY, String(sanitizeLineThickness(value)));
    } catch (error) {
      // 저장 불가 환경(private mode 등)에서는 무시
    }
  }

  function calculateCanvasSize(payload) {
    const groups = payload && Array.isArray(payload.groups) ? payload.groups : [];
    let maxRight = MIN_CANVAS_SIZE;
    let maxBottom = MIN_CANVAS_SIZE;

    groups.forEach(group => {
      (group.segments || []).forEach(segment => {
        (segment.points || []).forEach(point => {
          const x = Number(point.x);
          const y = Number(point.y);
          const size = Number(point.size);
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) return;
          maxRight = Math.max(maxRight, Math.round(x + size));
          maxBottom = Math.max(maxBottom, Math.round(y + size));
        });
      });
    });

    const required = Math.max(MIN_CANVAS_SIZE, maxRight, maxBottom);
    return Math.min(MAX_CANVAS_SIZE, required);
  }

  /**
   * groupIndex와 segmentIndex 조합으로 고유한 색상을 반환합니다.
   * hue(97, 53 계수), lightness(3단계), saturation(2단계)를 함께 변화시켜
   * 육안으로 구분 가능한 색상을 최대 ~30가지 확보합니다.
   */
  function getSegmentColor(groupIndex, segmentIndex) {
    const hue = (groupIndex * 97 + segmentIndex * 53) % 360;
    const lightness = 55 + (groupIndex % 3) * 10;   // 55 / 65 / 75
    const saturation = 85 + (segmentIndex % 2) * 10; // 85 / 95
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }


  function drawPixelLineNoAA(ctx, x0, y0, x1, y1, color, thickness) {
    let sx0 = Math.round(Number(x0));
    let sy0 = Math.round(Number(y0));
    const sx1 = Math.round(Number(x1));
    const sy1 = Math.round(Number(y1));

    if (![sx0, sy0, sx1, sy1].every(Number.isFinite)) return;

    const brushSize = Math.max(1, Math.round(Number(thickness) || 1));
    const offset = -Math.floor(brushSize / 2);

    function plot(px, py) {
      ctx.fillRect(px + offset, py + offset, brushSize, brushSize);
    }

    let dx = Math.abs(sx1 - sx0);
    const stepX = sx0 < sx1 ? 1 : -1;
    let dy = -Math.abs(sy1 - sy0);
    const stepY = sy0 < sy1 ? 1 : -1;
    let err = dx + dy;

    ctx.fillStyle = color;
    while (true) {
      plot(sx0, sy0);
      if (sx0 === sx1 && sy0 === sy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        sx0 += stepX;
      }
      if (e2 <= dx) {
        err += dx;
        sy0 += stepY;
      }
    }
  }

  function drawSegmentPathLines(groups) {
    baseCtx.save();
    baseCtx.imageSmoothingEnabled = false;
    const thickness = getCurrentLineThickness();

    groups.forEach((group, groupIndex) => {
      (group.segments || []).forEach((segment, segmentIndex) => {
        const points = Array.isArray(segment.points) ? segment.points : [];
        if (points.length < 2) return;

        const coords = points
          .map(point => {
            const x = Number(point.x);
            const y = Number(point.y);
            const size = Number(point.size);
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size)) return null;
            const centerX = x + size / 2;
            const centerY = y + size / 2;
            return { x: centerX, y: centerY };
          })
          .filter(Boolean);

        if (coords.length < 2) return;

        for (let i = 1; i < coords.length; i++) {
          const prev = coords[i - 1];
          const curr = coords[i];
          drawPixelLineNoAA(baseCtx, prev.x, prev.y, curr.x, curr.y, getSegmentColor(groupIndex, segmentIndex), thickness);
        }
      });
    });

    baseCtx.restore();
  }

  function normalizePoint(point) {
    const x = Number(point && point.x);
    const y = Number(point && point.y);
    const size = Math.max(1, Math.round(Number(point && point.size)));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size)) return null;
    const px = Math.round(x);
    const py = Math.round(y);
    return {
      x: px,
      y: py,
      size,
      centerX: px + size / 2,
      centerY: py + size / 2
    };
  }

  function renderBitmapForClipboard(payload, lineThickness) {
    const size = calculateCanvasSize(payload);
    const bitmapCanvas = document.createElement('canvas');
    bitmapCanvas.width = size;
    bitmapCanvas.height = size;

    const ctx = bitmapCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, size, size);

    const groups = payload && Array.isArray(payload.groups) ? payload.groups : [];
    const thickness = Math.max(1, Math.min(5, Math.round(Number(lineThickness) || DEFAULT_LINE_THICKNESS)));

    groups.forEach((group, groupIndex) => {
      (group.segments || []).forEach((segment, segmentIndex) => {
        const points = Array.isArray(segment.points) ? segment.points : [];
        const normalized = points.map(normalizePoint);
        const connectedIndices = new Set();
        const fillStyle = getSegmentColor(groupIndex, segmentIndex);

        // 인덱스 순서(0-1, 1-2...)로 선을 연결한다.
        for (let i = 0; i < normalized.length - 1; i++) {
          const a = normalized[i];
          const b = normalized[i + 1];
          if (!a || !b) continue;

          drawPixelLineNoAA(ctx, a.centerX, a.centerY, b.centerX, b.centerY, fillStyle, thickness);

          connectedIndices.add(i);
          connectedIndices.add(i + 1);
        }

        // 선 연결에 참여하지 않은(고립된) 점만 사각형 점을 유지한다.
        for (let i = 0; i < normalized.length; i++) {
          const p = normalized[i];
          if (!p || connectedIndices.has(i)) continue;

          ctx.fillStyle = fillStyle;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          ctx.strokeStyle = '#dbeafe';
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x + 0.5, p.y + 0.5, Math.max(1, p.size - 1), Math.max(1, p.size - 1));
        }
      });
    });

    return bitmapCanvas;
  }

  function canvasToBlob(canvas, type) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('toBlob failed'));
          return;
        }
        resolve(blob);
      }, type || 'image/png');
    });
  }

  function tryLegacyImageCopy(canvas) {
    // ClipboardItem 미지원 브라우저를 위한 레거시 복사 시도
    const host = document.createElement('div');
    host.contentEditable = 'true';
    host.style.position = 'fixed';
    host.style.left = '-99999px';
    host.style.top = '0';
    host.style.opacity = '0';

    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.width = canvas.width;
    img.height = canvas.height;
    host.appendChild(img);
    document.body.appendChild(host);

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNode(img);
    selection.removeAllRanges();
    selection.addRange(range);

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }

    selection.removeAllRanges();
    document.body.removeChild(host);
    return copied;
  }

  function updatePathLineButtonLabel() {
    btnTogglePathLines.textContent = `경로 선 보기: ${showPathLines ? 'ON' : 'OFF'}`;
  }

  function drawBaseCanvas(payload) {
    const size = calculateCanvasSize(payload);
    baseCanvas.width = size;
    baseCanvas.height = size;

    if (baseCanvasTitle) {
      baseCanvasTitle.textContent = `원본 ${size}x${size}`;
    }

    baseCtx.fillStyle = '#030712';
    baseCtx.fillRect(0, 0, size, size);

    const groups = payload && Array.isArray(payload.groups) ? payload.groups : [];

    groups.forEach((group, groupIndex) => {
      (group.segments || []).forEach((segment, segmentIndex) => {
        const fillStyle = getSegmentColor(groupIndex, segmentIndex);

        (segment.points || []).forEach(point => {
          const x = Math.round(Number(point.x));
          const y = Math.round(Number(point.y));
          const rectSize = Math.max(1, Math.round(Number(point.size)));

          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rectSize)) return;

          baseCtx.fillStyle = fillStyle;
          baseCtx.fillRect(x, y, rectSize, rectSize);

          baseCtx.strokeStyle = '#dbeafe';
          baseCtx.lineWidth = 1;
          baseCtx.strokeRect(x + 0.5, y + 0.5, Math.max(1, rectSize - 1), Math.max(1, rectSize - 1));
        });
      });
    });

    if (showPathLines) {
      drawSegmentPathLines(groups);
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

  function renderPayload(payload) {
    currentPayload = payload;
    drawBaseCanvas(payload);
    drawZoomCanvas();
  }

  function parseOutputPayload() {
    const text = (output.value || '').trim();
    if (!text) return null;
    return JSON.parse(text);
  }

  function applyDpSimplification(options) {
    const opts = options || {};
    const refreshSourceFromTextarea = !!opts.refreshSourceFromTextarea;
    const isAuto = !!opts.isAuto;

    if (refreshSourceFromTextarea) {
      try {
        const parsed = parseOutputPayload();
        if (!parsed || !Array.isArray(parsed.groups)) {
          setStatus('적용할 groups 데이터가 없습니다.', true);
          return false;
        }
        dpSourcePayload = parsed;
      } catch (error) {
        setStatus('현재 textarea JSON 파싱에 실패해 DP 단순화를 적용할 수 없습니다.', true);
        return false;
      }
    }

    if (!dpSourcePayload || !Array.isArray(dpSourcePayload.groups)) {
      if (!isAuto) {
        setStatus('DP 단순화 기준 데이터가 없습니다. 먼저 JSON을 수신하거나 입력해주세요.', true);
      }
      return false;
    }

    const epsilon = getCurrentDpTolerance();
    const beforePoints = countPoints(dpSourcePayload.groups);
    const simplified = simplifyPayloadByDp(dpSourcePayload, epsilon);
    const afterPoints = countPoints(simplified.groups || []);

    output.value = JSON.stringify(simplified, null, 2);
    updateMeta(simplified, 'transferKey(localStorage)');
    renderPayload(simplified);
    setStatus(`DP 단순화 적용 완료 (epsilon=${epsilon.toFixed(1)}): ${beforePoints} -> ${afterPoints} 점`, false);
    return true;
  }

  function scheduleAutoDpApply() {
    if (dpAutoApplyTimer) {
      clearTimeout(dpAutoApplyTimer);
    }
    dpAutoApplyTimer = setTimeout(() => {
      dpAutoApplyTimer = null;
      applyDpSimplification({ isAuto: true });
    }, DP_AUTO_APPLY_DEBOUNCE_MS);
  }

  function receiveFromTransferKey() {
    const params = new URLSearchParams(window.location.search);
    const transferKey = params.get('transferKey');

    if (!transferKey) {
      setStatus('transferKey가 없어 데이터 수신에 실패했습니다.', true);
      badgeMethod.textContent = '전달 방식: 없음';
      renderPayload({ version: 1, groups: [] });
      return;
    }

    const text = localStorage.getItem(transferKey);
    if (!text) {
      setStatus('localStorage에서 데이터를 찾지 못했습니다. 새 탭이 너무 늦게 열렸거나 전달 데이터가 이미 정리되었을 수 있습니다.', true);
      badgeMethod.textContent = '전달 방식: transferKey(localStorage)';
      renderPayload({ version: 1, groups: [] });
      return;
    }

    localStorage.removeItem(transferKey);
    output.value = text;

    try {
      const payload = JSON.parse(text);
      originalPayload = deepCloneJson(payload);
      dpSourcePayload = deepCloneJson(payload);
      updateMeta(payload, 'transferKey(localStorage)');
      renderPayload(payload);
      setStatus('JSON 수신 완료. 캔버스 렌더링을 완료했습니다.', false);
    } catch (error) {
      updateMeta(null, 'transferKey(localStorage)');
      renderPayload({ version: 1, groups: [] });
      setStatus('JSON 파싱에 실패했습니다.', true);
    }
  }

  function restoreOriginalData() {
    if (!originalPayload || !Array.isArray(originalPayload.groups)) {
      setStatus('복원할 원본 데이터가 없습니다. 먼저 데이터를 수신해주세요.', true);
      return;
    }

    const restored = deepCloneJson(originalPayload);
    dpSourcePayload = deepCloneJson(originalPayload);
    output.value = JSON.stringify(restored, null, 2);
    updateMeta(restored, 'transferKey(localStorage)');
    renderPayload(restored);
    setStatus('원본 데이터로 복원했습니다.', false);
  }

  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.value || '');
      setStatus('JSON을 클립보드에 복사했습니다.', false);
    } catch (error) {
      setStatus('클립보드 복사에 실패했습니다.', true);
    }
  });

  btnCopyBitmap.addEventListener('click', async () => {
    setStatus('비트맵 클립보드 복사를 시도 중입니다...', false);

    if (!currentPayload) {
      setStatus('복사할 데이터가 없습니다. 먼저 데이터를 수신해주세요.', true);
      return;
    }

    try {
      const lineThickness = getCurrentLineThickness();
      const bitmapCanvas = renderBitmapForClipboard(currentPayload, lineThickness);
      if (!bitmapCanvas) {
        setStatus('비트맵 캔버스 생성에 실패했습니다.', true);
        return;
      }

      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
        const blob = await canvasToBlob(bitmapCanvas, 'image/png');
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);

        setStatus(`비트맵(PNG)을 원본 크기 ${bitmapCanvas.width}x${bitmapCanvas.height}로 클립보드에 복사했습니다. (선 두께=${lineThickness})`, false);
        return;
      }

      const copiedByLegacy = tryLegacyImageCopy(bitmapCanvas);
      if (copiedByLegacy) {
        setStatus(`비트맵(PNG)을 원본 크기 ${bitmapCanvas.width}x${bitmapCanvas.height}로 클립보드에 복사했습니다. (레거시 모드, 선 두께=${lineThickness})`, false);
      } else {
        setStatus('현재 브라우저는 이미지 클립보드 쓰기를 지원하지 않습니다. 크롬 최신 버전(HTTPS/localhost)에서 다시 시도해주세요.', true);
      }
    } catch (error) {
      const reason = error && error.message ? error.message : String(error || 'unknown');
      setStatus(`비트맵 클립보드 복사에 실패했습니다. (${reason})`, true);
      console.error('bitmap copy failed:', error);
    }
  });

  btnReload.addEventListener('click', receiveFromTransferKey);

  btnRestoreOriginal.addEventListener('click', () => {
    restoreOriginalData();
  });

  btnSimplifyDp.addEventListener('click', () => {
    applyDpSimplification({ refreshSourceFromTextarea: true, isAuto: false });
  });

  btnTogglePathLines.addEventListener('click', () => {
    showPathLines = !showPathLines;
    updatePathLineButtonLabel();
    if (!currentPayload) return;
    drawBaseCanvas(currentPayload);
    drawZoomCanvas();
  });

  scaleRange.addEventListener('input', () => {
    if (!currentPayload) return;
    drawZoomCanvas();
  });

  dpToleranceRange.addEventListener('input', () => {
    updateDpToleranceDisplay();
    scheduleAutoDpApply();
  });

  lineThicknessRange.addEventListener('input', () => {
    saveLineThicknessToStorage(lineThicknessRange.value);
    updateLineThicknessDisplay();
    if (!currentPayload || !showPathLines) return;
    drawBaseCanvas(currentPayload);
    drawZoomCanvas();
  });

  output.addEventListener('input', () => {
    try {
      const parsed = parseOutputPayload();
      if (parsed && Array.isArray(parsed.groups)) {
        dpSourcePayload = parsed;
      }
    } catch (error) {
      // 사용자가 타이핑 중인 순간의 불완전 JSON은 무시
    }
  });

  lineThicknessRange.value = String(loadLineThicknessFromStorage());

  updateDpToleranceDisplay();
  updateLineThicknessDisplay();
  updatePathLineButtonLabel();

  receiveFromTransferKey();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
