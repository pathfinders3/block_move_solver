(function () {
  function init() {
  const output = document.getElementById('output');
  const status = document.getElementById('status');
  const badgeMethod = document.getElementById('badgeMethod');
  const badgeGroups = document.getElementById('badgeGroups');
  const badgePoints = document.getElementById('badgePoints');
  const btnCopy = document.getElementById('btnCopy');
  const btnReload = document.getElementById('btnReload');
  const baseCanvas = document.getElementById('baseCanvas');
  const zoomCanvas = document.getElementById('zoomCanvas');
  const baseCanvasTitle = document.getElementById('baseCanvasTitle');
  const scaleRange = document.getElementById('scaleRange');
  const scaleDisplay = document.getElementById('scaleDisplay');

  const required = [
    output,
    status,
    badgeMethod,
    badgeGroups,
    badgePoints,
    btnCopy,
    btnReload,
    baseCanvas,
    zoomCanvas,
    baseCanvasTitle,
    scaleRange,
    scaleDisplay
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

  const scaleValues = [2, 4, 8, 16, 32, 64];
  const MIN_CANVAS_SIZE = 64;
  const MAX_CANVAS_SIZE = 1024;

  let currentPayload = null;

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

  function getSegmentColor(groupIndex, segmentIndex) {
    const hue = (groupIndex * 71 + segmentIndex * 37) % 360;
    return `hsl(${hue} 90% 70%)`;
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
      updateMeta(payload, 'transferKey(localStorage)');
      renderPayload(payload);
      setStatus('JSON 수신 완료. 캔버스 렌더링을 완료했습니다.', false);
    } catch (error) {
      updateMeta(null, 'transferKey(localStorage)');
      renderPayload({ version: 1, groups: [] });
      setStatus('JSON 파싱에 실패했습니다.', true);
    }
  }

  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.value || '');
      setStatus('JSON을 클립보드에 복사했습니다.', false);
    } catch (error) {
      setStatus('클립보드 복사에 실패했습니다.', true);
    }
  });

  btnReload.addEventListener('click', receiveFromTransferKey);

  scaleRange.addEventListener('input', () => {
    if (!currentPayload) return;
    drawZoomCanvas();
  });

  receiveFromTransferKey();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
