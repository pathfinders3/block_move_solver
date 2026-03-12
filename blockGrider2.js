(function () {
  const btnLoadJson = document.getElementById('btnLoadJson');
  const btnMerge = document.getElementById('btnMerge');
  const btnToggleConnect = document.getElementById('btnToggleConnect');
  const jsonOutput = document.getElementById('jsonOutput');
  const status = document.getElementById('status');
  const clickInfo = document.getElementById('clickInfo');
  const selectionInfo = document.getElementById('selectionInfo');
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
  const MOVE_STEP = 5;
  const MERGE_DISTANCE_THRESHOLD = 80;
  const MAX_UNDO_STACK = 30;

  let currentRectGroups = [];
  let selectedRect = null;
  let selectedSelections = [];
  let mergeUndoStack = [];

  function getSelectedGroupIndices() {
    return selectedSelections.map(item => item.groupIndex);
  }

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

  function updateMergeButtonState() {
    if (!btnMerge) return;
    btnMerge.disabled = selectedSelections.length !== 2;
  }

  function updateConnectButtonState() {
    if (!btnToggleConnect) return;

    if (!selectedRect) {
      btnToggleConnect.disabled = true;
      btnToggleConnect.textContent = '선택 점 연결: OFF';
      return;
    }

    const group = currentRectGroups[selectedRect.groupIndex];
    const rect = group && group[selectedRect.rectIndex];
    const canConnect = !!(rect && rect.canConnect);
    btnToggleConnect.disabled = !rect;
    btnToggleConnect.textContent = `선택 점 연결: ${canConnect ? 'ON' : 'OFF'}`;
  }

  function updateSelectionInfo() {
    if (!selectionInfo) return;

    if (selectedSelections.length === 0) {
      selectionInfo.textContent = '선택된 그룹: 0개';
      return;
    }

    const labels = selectedSelections
      .map(item => `G${item.groupIndex + 1}:P${item.rectIndex + 1}`)
      .join(', ');

    selectionInfo.textContent = `선택된 그룹: ${selectedSelections.length}개 (${labels})`;
  }

  function getPrimarySelectedGroupIndex() {
    if (selectedSelections.length > 0) return selectedSelections[0].groupIndex;
    if (selectedRect) return selectedRect.groupIndex;
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
      `사각형 (${rect.x}, ${rect.y}, size=${rect.size}, canConnect=${!!rect.canConnect})`;
  }

  function handleCanvasClick(x, y, options) {
    const toggleSelection = !!(options && options.toggleSelection);
    const hit = findRectAtPoint(x, y);
    selectedRect = hit ? { groupIndex: hit.groupIndex, rectIndex: hit.rectIndex } : null;

    if (!hit) {
      if (!toggleSelection) {
        selectedSelections = [];
      }
      updateMergeButtonState();
      updateSelectionInfo();
      updateConnectButtonState();
      updateClickInfo(x, y, hit);
      drawBaseCanvas(currentRectGroups);
      drawZoomCanvas();
      return;
    }

    const groupIndex = hit.groupIndex;
    const rectIndex = hit.rectIndex;
    if (toggleSelection) {
      const existingIndex = selectedSelections.findIndex(item => item.groupIndex === groupIndex);
      if (existingIndex >= 0) {
        selectedSelections.splice(existingIndex, 1);
      } else {
        selectedSelections.push({ groupIndex, rectIndex });
        if (selectedSelections.length > 2) {
          selectedSelections.shift();
        }
      }
    } else {
      selectedSelections = [{ groupIndex, rectIndex }];
    }

    updateMergeButtonState();
    updateSelectionInfo();
    updateConnectButtonState();
    updateClickInfo(x, y, hit);
    drawBaseCanvas(currentRectGroups);
    drawZoomCanvas();
  }

  function getGroupBounds(group) {
    if (!group || group.length === 0) {
      return { minX: 0, minY: 0, maxRight: 0, maxBottom: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    group.forEach(rect => {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxRight = Math.max(maxRight, rect.x + rect.size);
      maxBottom = Math.max(maxBottom, rect.y + rect.size);
    });

    return { minX, minY, maxRight, maxBottom };
  }

  function moveSelectedGroupBy(dx, dy) {
    const activeGroupIndex = getPrimarySelectedGroupIndex();
    if (activeGroupIndex === null) {
      setStatus('먼저 이동할 그룹의 도형을 클릭해 선택해주세요.', true);
      return;
    }

    const group = currentRectGroups[activeGroupIndex];
    if (!group || group.length === 0) {
      setStatus('선택된 그룹을 찾을 수 없습니다.', true);
      return;
    }

    const bounds = getGroupBounds(group);
    const clampedDx = Math.max(-bounds.minX, Math.min(dx, MAX_CANVAS_SIZE - bounds.maxRight));
    const clampedDy = Math.max(-bounds.minY, Math.min(dy, MAX_CANVAS_SIZE - bounds.maxBottom));

    group.forEach(rect => {
      rect.x += clampedDx;
      rect.y += clampedDy;
    });

    const selectedMovedRect =
      selectedRect && selectedRect.groupIndex === activeGroupIndex
        ? group[selectedRect.rectIndex]
        : null;
    if (selectedRect && selectedMovedRect) {
      updateClickInfo(selectedMovedRect.x, selectedMovedRect.y, {
        groupIndex: activeGroupIndex,
        rectIndex: selectedRect.rectIndex,
        rect: selectedMovedRect
      });
    }

    renderGroups(currentRectGroups);
    setStatus(
      `그룹 ${activeGroupIndex + 1} 이동: Δx=${clampedDx}, Δy=${clampedDy} (요청 5px 단위).`,
      false
    );
  }

  function cloneRect(rect) {
    return { x: rect.x, y: rect.y, size: rect.size, canConnect: !!rect.canConnect };
  }

  function cloneGroup(group) {
    return group.map(cloneRect);
  }

  function cloneGroups(groups) {
    return groups.map(cloneGroup);
  }

  function pushMergeUndoSnapshot() {
    mergeUndoStack.push({
      groups: cloneGroups(currentRectGroups),
      selectedRect: selectedRect ? { ...selectedRect } : null,
      selectedSelections: selectedSelections.map(item => ({ ...item }))
    });

    if (mergeUndoStack.length > MAX_UNDO_STACK) {
      mergeUndoStack.shift();
    }
  }

  function undoLastMerge() {
    if (mergeUndoStack.length === 0) {
      setStatus('되돌릴 Merge 기록이 없습니다.', true);
      return;
    }

    const snapshot = mergeUndoStack.pop();
    currentRectGroups = cloneGroups(snapshot.groups);
    selectedRect = snapshot.selectedRect ? { ...snapshot.selectedRect } : null;
    selectedSelections = (snapshot.selectedSelections || []).map(item => ({ ...item }));

    renderGroups(currentRectGroups);
    setStatus('마지막 Merge를 Ctrl+Z로 되돌렸습니다.', false);
  }

  function pointDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function shiftGroup(group, dx, dy) {
    group.forEach(rect => {
      rect.x += dx;
      rect.y += dy;
    });
  }

  function mergeSelectedGroups() {
    if (selectedSelections.length !== 2) {
      setStatus('Merge는 Ctrl+클릭으로 그룹 2개를 선택해야 실행됩니다.', true);
      return;
    }

    const selA = selectedSelections[0];
    const selB = selectedSelections[1];
    const idxA = selA.groupIndex;
    const idxB = selB.groupIndex;

    if (idxA === idxB) {
      setStatus('병합 실패: 서로 다른 2개 그룹에서 점을 선택해주세요.', true);
      return;
    }

    const groupA = currentRectGroups[idxA];
    const groupB = currentRectGroups[idxB];

    if (!groupA || !groupB || groupA.length === 0 || groupB.length === 0) {
      setStatus('병합할 그룹을 찾지 못했습니다.', true);
      return;
    }

    const pointA = groupA[selA.rectIndex];
    const pointB = groupB[selB.rectIndex];
    if (!pointA || !pointB) {
      setStatus('병합 실패: 선택된 점 인덱스를 찾지 못했습니다.', true);
      return;
    }

    if (!pointA.canConnect || !pointB.canConnect) {
      setStatus('병합 실패: 선택한 두 점 모두 canConnect=true 여야 합니다.', true);
      return;
    }

    const selectedDistance = pointDistance(pointA, pointB);
    if (selectedDistance > MERGE_DISTANCE_THRESHOLD) {
      setStatus(
        `병합 실패: 선택한 두 점이 충분히 가깝지 않습니다. (거리 ${selectedDistance.toFixed(2)}, 임계 ${MERGE_DISTANCE_THRESHOLD})`,
        true
      );
      return;
    }

    pushMergeUndoSnapshot();

    const shiftedB = cloneGroup(groupB);
    const dx = pointA.x - pointB.x;
    const dy = pointA.y - pointB.y;
    shiftGroup(shiftedB, dx, dy);

    const merged = cloneGroup(groupA);
    shiftedB.forEach((rect, index) => {
      if (index === selB.rectIndex) {
        const a = merged[selA.rectIndex];
        const isSamePoint = a && a.x === rect.x && a.y === rect.y && a.size === rect.size;
        if (isSamePoint) return;
      }
      merged.push(cloneRect(rect));
    });

    const keepIndex = Math.min(idxA, idxB);
    const removeIndex = Math.max(idxA, idxB);

    currentRectGroups[keepIndex] = merged;
    currentRectGroups.splice(removeIndex, 1);

    selectedSelections = [{ groupIndex: keepIndex, rectIndex: Math.max(0, merged.length - 1) }];
    selectedRect = { groupIndex: keepIndex, rectIndex: Math.max(0, merged.length - 1) };
    updateMergeButtonState();
    updateSelectionInfo();
    updateConnectButtonState();

    renderGroups(currentRectGroups);
    updateClickInfo(merged[merged.length - 1].x, merged[merged.length - 1].y, {
      groupIndex: keepIndex,
      rectIndex: Math.max(0, merged.length - 1),
      rect: merged[Math.max(0, merged.length - 1)]
    });
    setStatus(
      `그룹 병합 완료: ${idxA + 1} + ${idxB + 1} -> ${keepIndex + 1} (선택 점 거리 ${selectedDistance.toFixed(2)}).`,
      false
    );
  }

  function toggleSelectedPointConnect() {
    if (!selectedRect) {
      setStatus('먼저 점을 클릭해 선택해주세요.', true);
      return;
    }

    const group = currentRectGroups[selectedRect.groupIndex];
    const rect = group && group[selectedRect.rectIndex];
    if (!rect) {
      setStatus('선택 점을 찾을 수 없습니다.', true);
      updateConnectButtonState();
      return;
    }

    rect.canConnect = !rect.canConnect;
    updateConnectButtonState();
    renderGroups(currentRectGroups);
    updateClickInfo(rect.x, rect.y, {
      groupIndex: selectedRect.groupIndex,
      rectIndex: selectedRect.rectIndex,
      rect
    });
    setStatus(
      `그룹 ${selectedRect.groupIndex + 1} / 점 ${selectedRect.rectIndex + 1} canConnect=${rect.canConnect}`,
      false
    );
  }

  function handleMoveKey(event) {
    const target = event.target;
    const isTypingTarget =
      target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
    if (isTypingTarget) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undoLastMerge();
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'i') {
      event.preventDefault();
      moveSelectedGroupBy(0, -MOVE_STEP);
    } else if (key === 'k') {
      event.preventDefault();
      moveSelectedGroupBy(0, MOVE_STEP);
    } else if (key === 'j') {
      event.preventDefault();
      moveSelectedGroupBy(-MOVE_STEP, 0);
    } else if (key === 'l') {
      event.preventDefault();
      moveSelectedGroupBy(MOVE_STEP, 0);
    }
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
        baseCtx.fillStyle = rect.canConnect ? 'rgba(34, 197, 94, 0.75)' : fill;
        baseCtx.fillRect(rect.x, rect.y, rect.size, rect.size);

        baseCtx.strokeStyle = rect.canConnect ? '#d4af37' : '#6b7280';
        baseCtx.lineWidth = 1;
        baseCtx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.size - 1, rect.size - 1);
      });

      if (getSelectedGroupIndices().includes(groupIndex)) {
        const bounds = getGroupBounds(group);
        const width = Math.max(1, bounds.maxRight - bounds.minX);
        const height = Math.max(1, bounds.maxBottom - bounds.minY);

        baseCtx.strokeStyle = '#ffd60a';
        baseCtx.lineWidth = 2;
        baseCtx.setLineDash([4, 3]);
        baseCtx.strokeRect(bounds.minX - 1.5, bounds.minY - 1.5, width + 3, height + 3);
        baseCtx.setLineDash([]);
      }
    });

    if (selectedRect) {
      const selectedGroup = rectGroups[selectedRect.groupIndex];
      const rect = selectedGroup && selectedGroup[selectedRect.rectIndex];
      if (!rect) {
        selectedRect = null;
        return;
      }

      baseCtx.strokeStyle = '#ff3b30';
      baseCtx.lineWidth = 1;
      baseCtx.setLineDash([]);
      baseCtx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.size - 1, rect.size - 1);
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
        size: Math.round(size),
        canConnect: typeof item.canConnect === 'boolean'
          ? item.canConnect
          : false
      });
    }

    if (normalized.length > 0 && !source.some(item => Object.prototype.hasOwnProperty.call(item, 'canConnect'))) {
      normalized[0].canConnect = true;
      normalized[normalized.length - 1].canConnect = true;
    }

    return normalized;
  }

  function renderGroups(rectGroups) {
    currentRectGroups = rectGroups;

    selectedSelections = selectedSelections
      .map(item => {
        if (item.groupIndex < 0 || item.groupIndex >= currentRectGroups.length) return null;
        const group = currentRectGroups[item.groupIndex];
        if (!group || group.length === 0) return null;
        const safeRectIndex = Math.max(0, Math.min(item.rectIndex, group.length - 1));
        return { groupIndex: item.groupIndex, rectIndex: safeRectIndex };
      })
      .filter(Boolean);

    if (selectedRect) {
      const group = currentRectGroups[selectedRect.groupIndex];
      if (!group || !group[selectedRect.rectIndex]) {
        selectedRect = null;
      }
    }

    updateMergeButtonState();
    updateSelectionInfo();
    updateConnectButtonState();
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
    handleCanvasClick(point.x, point.y, { toggleSelection: event.ctrlKey || event.metaKey });
  });

  zoomCanvas.addEventListener('click', event => {
    const point = getCanvasCoordsFromEvent(event, zoomCanvas, getCurrentScale());
    handleCanvasClick(point.x, point.y, { toggleSelection: event.ctrlKey || event.metaKey });
  });

  if (btnMerge) {
    btnMerge.addEventListener('click', mergeSelectedGroups);
  }

  if (btnToggleConnect) {
    btnToggleConnect.addEventListener('click', toggleSelectedPointConnect);
  }

  document.addEventListener('keydown', handleMoveKey);

  btnLoadJson.addEventListener('click', loadJsonFromClipboard);

  renderGroups([]);
})();
