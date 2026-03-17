(function () {
  const btnLoadJson = document.getElementById('btnLoadJson');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnMerge = document.getElementById('btnMerge');
  const btnDisconnect = document.getElementById('btnDisconnect');
  const btnToggleConnect = document.getElementById('btnToggleConnect');
  const btnPrevPoint = document.getElementById('btnPrevPoint');
  const btnNextPoint = document.getElementById('btnNextPoint');
  const jsonOutput = document.getElementById('jsonOutput');
  const status = document.getElementById('status');
  const clickInfo = document.getElementById('clickInfo');
  const selectionInfo = document.getElementById('selectionInfo');
  const segmentList = document.getElementById('segmentList');
  const btnSegmentsShowAll = document.getElementById('btnSegmentsShowAll');
  const btnSegmentsHideAll = document.getElementById('btnSegmentsHideAll');
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

  let groupSeq = 1;
  let segmentSeq = 1;
  let connectionSeq = 1;

  let currentGroups = [];
  let selectedRect = null;
  let selectedSelections = [];
  let mergeUndoStack = [];
  let visibleSegmentIds = new Set();
  let knownSegmentIds = new Set();
  let lastCycleKey = '';
  let lastCycleIndex = 0;

  function createGroupId() {
    return `group-${groupSeq++}`;
  }

  function createSegmentId() {
    return `seg-${segmentSeq++}`;
  }

  function createConnectionId() {
    return `conn-${connectionSeq++}`;
  }

  function escHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', !!isError);
  }

  function clonePoint(point) {
    return {
      x: point.x,
      y: point.y,
      size: point.size,
      canConnect: !!point.canConnect
    };
  }

  function cloneSegment(segment) {
    return {
      id: segment.id,
      points: (segment.points || []).map(clonePoint)
    };
  }

  function cloneConnection(connection) {
    return {
      id: connection.id,
      from: { ...connection.from },
      to: { ...connection.to },
      distance: connection.distance
    };
  }

  function cloneGroup(group) {
    return {
      id: group.id,
      segments: (group.segments || []).map(cloneSegment),
      connections: (group.connections || []).map(cloneConnection)
    };
  }

  function cloneGroups(groups) {
    return groups.map(cloneGroup);
  }

  function createGroupFromPoints(points) {
    return {
      id: createGroupId(),
      segments: [
        {
          id: createSegmentId(),
          points: points.map(clonePoint)
        }
      ],
      connections: []
    };
  }

  function getAllPoints(groups) {
    const points = [];
    groups.forEach(group => {
      (group.segments || []).forEach(segment => {
        (segment.points || []).forEach(point => points.push(point));
      });
    });
    return points;
  }

  function getTotalRectCount(groups) {
    return getAllPoints(groups).length;
  }

  function getSegmentHue(groupIndex, segmentIndex) {
    return (groupIndex * 67 + segmentIndex * 17) % 360;
  }

  function getSegmentFillColor(groupIndex, segmentIndex) {
    const hue = getSegmentHue(groupIndex, segmentIndex);
    return `hsla(${hue}, 80%, 42%, 0.55)`;
  }

  function collectSegmentsWithMeta(groups) {
    const rows = [];
    groups.forEach((group, groupIndex) => {
      group.segments.forEach((segment, segmentIndex) => {
        rows.push({ groupIndex, segmentIndex, segment });
      });
    });
    return rows;
  }

  function syncVisibleSegmentIds(groups) {
    const currentIds = new Set();
    collectSegmentsWithMeta(groups).forEach(row => {
      currentIds.add(row.segment.id);
    });

    [...visibleSegmentIds].forEach(id => {
      if (!currentIds.has(id)) visibleSegmentIds.delete(id);
    });
    [...knownSegmentIds].forEach(id => {
      if (!currentIds.has(id)) knownSegmentIds.delete(id);
    });

    currentIds.forEach(id => {
      if (!knownSegmentIds.has(id)) {
        knownSegmentIds.add(id);
        visibleSegmentIds.add(id);
      }
    });
  }

  function renderSegmentVisibilityPanel() {
    if (!segmentList) return;

    segmentList.innerHTML = '';
    const rows = collectSegmentsWithMeta(currentGroups);
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'segment-item';
      empty.textContent = '세그먼트가 없습니다.';
      segmentList.appendChild(empty);
      return;
    }

    rows.forEach(row => {
      const item = document.createElement('label');
      item.className = 'segment-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = visibleSegmentIds.has(row.segment.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          visibleSegmentIds.add(row.segment.id);
        } else {
          visibleSegmentIds.delete(row.segment.id);
        }
        renderGroups(currentGroups);
      });

      const chip = document.createElement('span');
      chip.className = 'segment-color-chip';
      chip.style.backgroundColor = `hsl(${getSegmentHue(row.groupIndex, row.segmentIndex)} 85% 55%)`;

      const text = document.createElement('span');
      text.textContent = `G${row.groupIndex + 1} / S${row.segmentIndex + 1} (${row.segment.points.length}점)`;

      item.appendChild(checkbox);
      item.appendChild(chip);
      item.appendChild(text);
      segmentList.appendChild(item);
    });
  }

  function getSelectedGroupIndices() {
    const unique = [];
    selectedSelections.forEach(sel => {
      if (!unique.includes(sel.groupIndex)) unique.push(sel.groupIndex);
    });
    return unique;
  }

  function calculateCanvasSize(points) {
    if (!points || points.length === 0) return MIN_CANVAS_SIZE;

    let maxRight = MIN_CANVAS_SIZE;
    let maxBottom = MIN_CANVAS_SIZE;

    points.forEach(point => {
      maxRight = Math.max(maxRight, point.x + point.size);
      maxBottom = Math.max(maxBottom, point.y + point.size);
    });

    const required = Math.max(MIN_CANVAS_SIZE, maxRight, maxBottom);
    return Math.min(MAX_CANVAS_SIZE, required);
  }

  function getCurrentScale() {
    return scaleValues[parseInt(scaleRange.value, 10) || 0];
  }

  function isPointInRect(x, y, point) {
    return x >= point.x && x < point.x + point.size && y >= point.y && y < point.y + point.size;
  }

  function findRectsAtPoint(x, y) {
    const hits = [];
    for (let g = currentGroups.length - 1; g >= 0; g--) {
      const group = currentGroups[g];
      for (let s = group.segments.length - 1; s >= 0; s--) {
        const segment = group.segments[s];
        if (!visibleSegmentIds.has(segment.id)) continue;
        for (let p = segment.points.length - 1; p >= 0; p--) {
          const point = segment.points[p];
          if (isPointInRect(x, y, point)) {
            hits.push({
              groupIndex: g,
              segmentIndex: s,
              pointIndex: p,
              point,
              rect: point
            });
          }
        }
      }
    }
    return hits;
  }

  function updateMergeButtonState() {
    if (!btnMerge) return;
    btnMerge.disabled = selectedSelections.length !== 2;
  }

  function getPointAndSegmentFromSelection(selection) {
    if (!selection) return null;
    const group = currentGroups[selection.groupIndex];
    const segment = group && group.segments[selection.segmentIndex];
    const point = segment && segment.points[selection.pointIndex];
    if (!group || !segment || !point) return null;
    return { group, segment, point };
  }

  function isSelectionMergeConnected(selection) {
    const info = getPointAndSegmentFromSelection(selection);
    if (!info) return false;
    return info.group.connections.some(conn =>
      (conn.from.segmentId === info.segment.id && conn.from.pointIndex === selection.pointIndex) ||
      (conn.to.segmentId === info.segment.id && conn.to.pointIndex === selection.pointIndex)
    );
  }

  function isPointMergeConnected(group, segmentId, pointIndex) {
    if (!group || !group.connections) return false;
    return group.connections.some(conn =>
      (conn.from.segmentId === segmentId && conn.from.pointIndex === pointIndex) ||
      (conn.to.segmentId === segmentId && conn.to.pointIndex === pointIndex)
    );
  }

  function updateDisconnectButtonState() {
    if (!btnDisconnect) return;
    btnDisconnect.disabled = !isSelectionMergeConnected(selectedRect);
  }

  function findConnectionIndexForSelection(selection) {
    const info = getPointAndSegmentFromSelection(selection);
    if (!info) return -1;

    return info.group.connections.findIndex(conn =>
      (conn.from.segmentId === info.segment.id && conn.from.pointIndex === selection.pointIndex) ||
      (conn.to.segmentId === info.segment.id && conn.to.pointIndex === selection.pointIndex)
    );
  }

  function updatePointNavButtonState() {
    if (!btnPrevPoint || !btnNextPoint) return;

    const info = getPointAndSegmentFromSelection(selectedRect);
    if (!info) {
      btnPrevPoint.disabled = true;
      btnNextPoint.disabled = true;
      return;
    }

    const pointIndex = selectedRect.pointIndex;
    const maxIndex = info.segment.points.length - 1;
    btnPrevPoint.disabled = pointIndex <= 0;
    btnNextPoint.disabled = pointIndex >= maxIndex;
  }

  function updateConnectButtonState() {
    if (!btnToggleConnect) return;

    if (!selectedRect) {
      btnToggleConnect.disabled = true;
      btnToggleConnect.textContent = '선택 점 연결: OFF';
      return;
    }

    const group = currentGroups[selectedRect.groupIndex];
    const segment = group && group.segments[selectedRect.segmentIndex];
    const point = segment && segment.points[selectedRect.pointIndex];
    const canConnect = !!(point && point.canConnect);

    btnToggleConnect.disabled = !point;
    btnToggleConnect.textContent = `선택 점 연결: ${canConnect ? 'ON' : 'OFF'}`;
  }

  function updateSelectionInfo() {
    if (!selectionInfo) return;

    if (selectedSelections.length === 0) {
      selectionInfo.textContent = '선택된 그룹: 0개';
      return;
    }

    const labels = selectedSelections
      .map((item, index) => {
        const group = currentGroups[item.groupIndex];
        const segment = group && group.segments[item.segmentIndex];
        const totalPoints = segment ? segment.points.length : 0;
        const roleTag = index === 0
          ? '<span class="role-tag role-main">MAIN(빨강)</span>'
          : '<span class="role-tag role-sub">SUB(파랑)</span>';
        const hue = getSegmentHue(item.groupIndex, item.segmentIndex);
        const segmentTag = `<span class="segment-tag" style="background:hsl(${hue} 70% 36%);">S${item.segmentIndex + 1}</span>`;
        return `${roleTag} G${item.groupIndex + 1}:${segmentTag}:P ${item.pointIndex}/${totalPoints}`;
      })
      .join(', ');

    selectionInfo.innerHTML = `선택된 그룹: <span class="info-badge">${selectedSelections.length}개</span> ${labels}`;
  }

  function getPrimarySelectedGroupIndex() {
    if (selectedSelections.length > 0) return selectedSelections[0].groupIndex;
    if (selectedRect) return selectedRect.groupIndex;
    return null;
  }

  function updateClickInfo(x, y, hit, cycleMeta) {
    if (!clickInfo) return;
    if (!hit) {
      clickInfo.textContent = `클릭 좌표: (${x}, ${y}) | 선택 없음`;
      return;
    }

    const point = hit.point;
    const group = currentGroups[hit.groupIndex];
    const segmentId =
      group &&
      group.segments[hit.segmentIndex]
        ? group.segments[hit.segmentIndex].id
        : '-';
    const segment =
      group &&
      group.segments[hit.segmentIndex]
        ? group.segments[hit.segmentIndex]
        : null;
    const totalPoints = segment ? segment.points.length : 0;
    const isMergeConnectedPoint = isPointMergeConnected(group, segmentId, hit.pointIndex);

    const candidateIndex = cycleMeta && Number.isInteger(cycleMeta.index) ? cycleMeta.index + 1 : null;
    const candidateTotal = cycleMeta && Number.isInteger(cycleMeta.total) ? cycleMeta.total : null;
    const candidateBadge =
      candidateTotal && candidateTotal > 1
        ? `<span class="info-badge badge-sub">후보 ${candidateIndex}/${candidateTotal}</span>`
        : '';
    const mergeBadge = isMergeConnectedPoint
      ? '<span class="info-badge badge-main">MERGE 연결점</span>'
      : '<span class="info-badge">일반 점</span>';

    clickInfo.innerHTML =
      `${candidateBadge}${mergeBadge}` +
      `클릭 좌표: (${x}, ${y}) | 그룹 ${hit.groupIndex + 1}, 선 ${hit.segmentIndex + 1} (id=${escHtml(segmentId)}), ` +
      `점 P ${hit.pointIndex}/${totalPoints}, 사각형 (${point.x}, ${point.y}, size=${point.size}, canConnect=${!!point.canConnect})`;
  }

  function handleCanvasClick(x, y, options) {
    const toggleSelection = !!(options && options.toggleSelection);
    const cycleSelection = !!(options && options.cycleSelection);
    const hits = findRectsAtPoint(x, y);

    let hit = null;
    if (hits.length > 0) {
      const cycleKey = `${x},${y}|${hits.map(h => `${h.groupIndex}-${h.segmentIndex}-${h.pointIndex}`).join('|')}`;
      if (cycleSelection && hits.length > 1) {
        if (lastCycleKey === cycleKey) {
          lastCycleIndex = (lastCycleIndex + 1) % hits.length;
        } else {
          lastCycleKey = cycleKey;
          lastCycleIndex = 0;
        }
        hit = hits[lastCycleIndex];
      } else {
        lastCycleKey = cycleKey;
        lastCycleIndex = 0;
        hit = hits[0];
      }
    }

    selectedRect = hit
      ? {
          groupIndex: hit.groupIndex,
          segmentIndex: hit.segmentIndex,
          pointIndex: hit.pointIndex
        }
      : null;

    if (!hit) {
      lastCycleKey = '';
      lastCycleIndex = 0;
      if (!toggleSelection) {
        selectedSelections = [];
      }
      updateMergeButtonState();
      updateSelectionInfo();
      updateConnectButtonState();
      updateDisconnectButtonState();
      updateClickInfo(x, y, hit);
      drawBaseCanvas(currentGroups);
      drawZoomCanvas();
      return;
    }

    const selection = {
      groupIndex: hit.groupIndex,
      segmentIndex: hit.segmentIndex,
      pointIndex: hit.pointIndex
    };

    if (toggleSelection) {
      const existingIndex = selectedSelections.findIndex(item => item.groupIndex === selection.groupIndex);
      if (existingIndex >= 0) {
        const existing = selectedSelections[existingIndex];
        const samePoint =
          existing.segmentIndex === selection.segmentIndex &&
          existing.pointIndex === selection.pointIndex;
        if (samePoint) {
          selectedSelections.splice(existingIndex, 1);
        } else {
          selectedSelections[existingIndex] = selection;
        }
      } else {
        selectedSelections.push(selection);
        if (selectedSelections.length > 2) {
          selectedSelections.shift();
        }
      }
    } else {
      selectedSelections = [selection];
    }

    updateMergeButtonState();
    updateSelectionInfo();
    updateConnectButtonState();
    updateDisconnectButtonState();
    updateClickInfo(x, y, hit, { index: lastCycleIndex, total: Math.max(1, hits.length) });
    drawBaseCanvas(currentGroups);
    drawZoomCanvas();
  }

  function navigateSelectedPoint(step) {
    if (!selectedRect) {
      setStatus('먼저 점을 클릭해 선택해주세요.', true);
      return;
    }

    const info = getPointAndSegmentFromSelection(selectedRect);
    if (!info) {
      setStatus('선택 점 정보를 찾을 수 없습니다.', true);
      return;
    }

    const maxIndex = info.segment.points.length - 1;
    const nextPointIndex = Math.max(0, Math.min(maxIndex, selectedRect.pointIndex + step));
    if (nextPointIndex === selectedRect.pointIndex) {
      updatePointNavButtonState();
      return;
    }

    selectedRect = {
      groupIndex: selectedRect.groupIndex,
      segmentIndex: selectedRect.segmentIndex,
      pointIndex: nextPointIndex
    };

    const selectionIdx = selectedSelections.findIndex(
      item => item.groupIndex === selectedRect.groupIndex
    );
    if (selectionIdx >= 0) {
      selectedSelections[selectionIdx] = {
        groupIndex: selectedRect.groupIndex,
        segmentIndex: selectedRect.segmentIndex,
        pointIndex: nextPointIndex
      };
    }

    const point = info.segment.points[nextPointIndex];
    updateClickInfo(point.x, point.y, {
      groupIndex: selectedRect.groupIndex,
      segmentIndex: selectedRect.segmentIndex,
      pointIndex: nextPointIndex,
      point,
      rect: point
    });

    renderGroups(currentGroups);
  }

  function getGroupBounds(group, includeHidden) {
    const points = [];
    group.segments.forEach(segment => {
      if (!includeHidden && !visibleSegmentIds.has(segment.id)) return;
      segment.points.forEach(point => points.push(point));
    });

    if (points.length === 0) {
      return { minX: 0, minY: 0, maxRight: 0, maxBottom: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxRight = Math.max(maxRight, point.x + point.size);
      maxBottom = Math.max(maxBottom, point.y + point.size);
    });

    return { minX, minY, maxRight, maxBottom };
  }

  function shiftGroup(group, dx, dy) {
    group.segments.forEach(segment => {
      segment.points.forEach(point => {
        point.x += dx;
        point.y += dy;
      });
    });
  }

  function moveSelectedGroupBy(dx, dy) {
    const activeGroupIndex = getPrimarySelectedGroupIndex();
    if (activeGroupIndex === null) {
      setStatus('먼저 이동할 그룹의 도형을 클릭해 선택해주세요.', true);
      return;
    }

    const group = currentGroups[activeGroupIndex];
    if (!group || group.segments.length === 0) {
      setStatus('선택된 그룹을 찾을 수 없습니다.', true);
      return;
    }

    const bounds = getGroupBounds(group, true);
    const clampedDx = Math.max(-bounds.minX, Math.min(dx, MAX_CANVAS_SIZE - bounds.maxRight));
    const clampedDy = Math.max(-bounds.minY, Math.min(dy, MAX_CANVAS_SIZE - bounds.maxBottom));

    shiftGroup(group, clampedDx, clampedDy);

    if (selectedRect && selectedRect.groupIndex === activeGroupIndex) {
      const segment = group.segments[selectedRect.segmentIndex];
      const point = segment && segment.points[selectedRect.pointIndex];
      if (point) {
        updateClickInfo(point.x, point.y, {
          groupIndex: selectedRect.groupIndex,
          segmentIndex: selectedRect.segmentIndex,
          pointIndex: selectedRect.pointIndex,
          point,
          rect: point
        });
      }
    }

    renderGroups(currentGroups);
    setStatus(
      `그룹 ${activeGroupIndex + 1} 이동: Δx=${clampedDx}, Δy=${clampedDy} (요청 5px 단위).`,
      false
    );
  }

  function pushMergeUndoSnapshot() {
    mergeUndoStack.push({
      groups: cloneGroups(currentGroups),
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
    currentGroups = cloneGroups(snapshot.groups);
    selectedRect = snapshot.selectedRect ? { ...snapshot.selectedRect } : null;
    selectedSelections = (snapshot.selectedSelections || []).map(item => ({ ...item }));

    renderGroups(currentGroups);
    setStatus('마지막 Merge를 Ctrl+Z로 되돌렸습니다.', false);
  }

  function pointDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function remapSegmentIdsForMerge(group) {
    const idMap = {};
    group.segments.forEach(segment => {
      const oldId = segment.id;
      const newId = createSegmentId();
      idMap[oldId] = newId;
      segment.id = newId;
    });

    group.connections.forEach(conn => {
      conn.id = createConnectionId();
      conn.from.segmentId = idMap[conn.from.segmentId] || conn.from.segmentId;
      conn.to.segmentId = idMap[conn.to.segmentId] || conn.to.segmentId;
    });

    return idMap;
  }

  function splitGroupByConnections(group) {
    const segmentIdToSegment = new Map();
    const adjacency = new Map();

    group.segments.forEach(segment => {
      segmentIdToSegment.set(segment.id, segment);
      adjacency.set(segment.id, new Set());
    });

    group.connections.forEach(conn => {
      if (!adjacency.has(conn.from.segmentId) || !adjacency.has(conn.to.segmentId)) return;
      adjacency.get(conn.from.segmentId).add(conn.to.segmentId);
      adjacency.get(conn.to.segmentId).add(conn.from.segmentId);
    });

    const visited = new Set();
    const components = [];

    group.segments.forEach(segment => {
      if (visited.has(segment.id)) return;

      const queue = [segment.id];
      visited.add(segment.id);
      const componentSegmentIds = new Set();

      while (queue.length > 0) {
        const current = queue.shift();
        componentSegmentIds.add(current);

        adjacency.get(current).forEach(nextId => {
          if (visited.has(nextId)) return;
          visited.add(nextId);
          queue.push(nextId);
        });
      }

      const componentSegments = group.segments
        .filter(seg => componentSegmentIds.has(seg.id))
        .map(cloneSegment);

      const componentConnections = group.connections
        .filter(conn => componentSegmentIds.has(conn.from.segmentId) && componentSegmentIds.has(conn.to.segmentId))
        .map(cloneConnection);

      components.push({
        id: null,
        segments: componentSegments,
        connections: componentConnections
      });
    });

    return components;
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

    const groupA = currentGroups[idxA];
    const groupB = currentGroups[idxB];
    if (!groupA || !groupB) {
      setStatus('병합할 그룹을 찾지 못했습니다.', true);
      return;
    }

    const segmentA = groupA.segments[selA.segmentIndex];
    const segmentB = groupB.segments[selB.segmentIndex];
    const pointA = segmentA && segmentA.points[selA.pointIndex];
    const pointB = segmentB && segmentB.points[selB.pointIndex];
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

    const mergedGroup = cloneGroup(groupA);
    const shiftedSource = cloneGroup(groupB);
    const sourceIdMap = remapSegmentIdsForMerge(shiftedSource);

    const pointA2 = mergedGroup.segments[selA.segmentIndex].points[selA.pointIndex];
    const pointB2 = shiftedSource.segments[selB.segmentIndex].points[selB.pointIndex];
    const dx = pointA2.x - pointB2.x;
    const dy = pointA2.y - pointB2.y;
    shiftGroup(shiftedSource, dx, dy);

    mergedGroup.segments.push(...shiftedSource.segments.map(cloneSegment));
    mergedGroup.connections.push(...shiftedSource.connections.map(cloneConnection));

    mergedGroup.connections.push({
      id: createConnectionId(),
      from: {
        segmentId: mergedGroup.segments[selA.segmentIndex].id,
        pointIndex: selA.pointIndex
      },
      to: {
        segmentId: sourceIdMap[groupB.segments[selB.segmentIndex].id],
        pointIndex: selB.pointIndex
      },
      distance: Number(selectedDistance.toFixed(4))
    });

    const mainSegmentId = mergedGroup.segments[selA.segmentIndex].id;
    const subOriginalSegmentId = groupB.segments[selB.segmentIndex].id;
    const subMergedSegmentId = sourceIdMap[subOriginalSegmentId] || subOriginalSegmentId;

    const keepIndex = Math.min(idxA, idxB);
    const removeIndex = Math.max(idxA, idxB);

    currentGroups[keepIndex] = mergedGroup;
    currentGroups.splice(removeIndex, 1);

    selectedSelections = [
      {
        groupIndex: keepIndex,
        segmentIndex: selA.segmentIndex,
        pointIndex: selA.pointIndex
      }
    ];
    selectedRect = { ...selectedSelections[0] };

    renderGroups(currentGroups);
    const selectedPoint =
      currentGroups[keepIndex].segments[selectedRect.segmentIndex].points[selectedRect.pointIndex];
    updateClickInfo(selectedPoint.x, selectedPoint.y, {
      groupIndex: selectedRect.groupIndex,
      segmentIndex: selectedRect.segmentIndex,
      pointIndex: selectedRect.pointIndex,
      point: selectedPoint,
      rect: selectedPoint
    });
    setStatus(
      `MERGE 완료: main=${mainSegmentId}, sub=${subOriginalSegmentId} -> ${subMergedSegmentId}, 거리=${selectedDistance.toFixed(2)}`,
      false
    );
  }

  function toggleSelectedPointConnect() {
    const targets = selectedSelections.length > 0
      ? selectedSelections
      : (selectedRect ? [selectedRect] : []);

    if (targets.length === 0) {
      setStatus('먼저 점을 클릭해 선택해주세요.', true);
      return;
    }

    const first = targets[0];
    const firstGroup = currentGroups[first.groupIndex];
    const firstSegment = firstGroup && firstGroup.segments[first.segmentIndex];
    const firstPoint = firstSegment && firstSegment.points[first.pointIndex];
    if (!firstPoint) {
      setStatus('기준 점(첫 번째 선택 점)을 찾을 수 없습니다.', true);
      return;
    }

    const nextValue = !firstPoint.canConnect;

    let toggledCount = 0;
    targets.forEach(sel => {
      const group = currentGroups[sel.groupIndex];
      const segment = group && group.segments[sel.segmentIndex];
      const point = segment && segment.points[sel.pointIndex];
      if (!point) return;

      point.canConnect = nextValue;
      toggledCount += 1;
    });

    if (toggledCount === 0) {
      setStatus('선택 점을 찾을 수 없습니다.', true);
      updateConnectButtonState();
      return;
    }

    renderGroups(currentGroups);

    const primary = targets[0];
    const group = currentGroups[primary.groupIndex];
    const segment = group && group.segments[primary.segmentIndex];
    const point = segment && segment.points[primary.pointIndex];
    if (point) {
      updateClickInfo(point.x, point.y, {
        groupIndex: primary.groupIndex,
        segmentIndex: primary.segmentIndex,
        pointIndex: primary.pointIndex,
        point,
        rect: point
      });
    }

    setStatus(`선택 점 ${toggledCount}개 canConnect=${nextValue} 로 일괄 적용했습니다.`, false);
  }

  function disconnectSelectedPoint() {
    if (!selectedRect) {
      setStatus('먼저 점을 클릭해 선택해주세요.', true);
      return;
    }

    const info = getPointAndSegmentFromSelection(selectedRect);
    if (!info) {
      setStatus('선택 점 정보를 찾을 수 없습니다.', true);
      return;
    }

    const connectionIndex = findConnectionIndexForSelection(selectedRect);
    if (connectionIndex < 0) {
      setStatus('선택 점은 MERGE 연결점이 아닙니다.', true);
      return;
    }

    const sourceGroupIndex = selectedRect.groupIndex;
    const sourceSegmentId = info.segment.id;
    const sourcePointIndex = selectedRect.pointIndex;

    pushMergeUndoSnapshot();
    const [removed] = info.group.connections.splice(connectionIndex, 1);

    const splitGroups = splitGroupByConnections(info.group);
    const keepCount = splitGroups.length;

    if (keepCount === 0) {
      currentGroups.splice(sourceGroupIndex, 1);
      selectedRect = null;
      selectedSelections = [];
      renderGroups(currentGroups);
      setStatus('연결 해제 후 그룹이 비어 삭제되었습니다.', false);
      return;
    }

    const normalizedGroups = splitGroups.map((g, idx) => ({
      id: idx === 0 ? info.group.id : createGroupId(),
      segments: g.segments.map(cloneSegment),
      connections: g.connections.map(cloneConnection)
    }));

    currentGroups.splice(sourceGroupIndex, 1, ...normalizedGroups);

    let nextSelectedRect = null;
    normalizedGroups.forEach((g, compIdx) => {
      if (nextSelectedRect) return;
      const segIdx = g.segments.findIndex(seg => seg.id === sourceSegmentId);
      if (segIdx < 0) return;
      const ptIdx = Math.max(0, Math.min(sourcePointIndex, g.segments[segIdx].points.length - 1));
      nextSelectedRect = {
        groupIndex: sourceGroupIndex + compIdx,
        segmentIndex: segIdx,
        pointIndex: ptIdx
      };
    });

    selectedRect = nextSelectedRect;
    selectedSelections = nextSelectedRect ? [nextSelectedRect] : [];

    renderGroups(currentGroups);
    setStatus(
      `연결 해제 완료: ${removed.from.segmentId}:P${removed.from.pointIndex} -> ${removed.to.segmentId}:P${removed.to.pointIndex} (그룹 분리 ${keepCount}개)`,
      false
    );
  }

  function deleteSelectedGroups() {
    let targetGroupIndices = getSelectedGroupIndices();

    if (targetGroupIndices.length === 0 && selectedRect) {
      targetGroupIndices = [selectedRect.groupIndex];
    }

    if (targetGroupIndices.length === 0) {
      setStatus('삭제할 그룹이 선택되지 않았습니다.', true);
      return;
    }

    pushMergeUndoSnapshot();

    const uniqueSortedDesc = [...new Set(targetGroupIndices)].sort((a, b) => b - a);
    uniqueSortedDesc.forEach(index => {
      if (index >= 0 && index < currentGroups.length) {
        currentGroups.splice(index, 1);
      }
    });

    selectedRect = null;
    selectedSelections = [];

    renderGroups(currentGroups);
    setStatus(`그룹 ${uniqueSortedDesc.length}개를 삭제했습니다. (Ctrl+Z로 복구 가능)`, false);
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

    if (event.key === 'Delete') {
      event.preventDefault();
      deleteSelectedGroups();
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

  function drawBaseCanvas(groups) {
    const allPoints = getAllPoints(groups);
    const canvasSize = calculateCanvasSize(allPoints);
    baseCanvas.width = canvasSize;
    baseCanvas.height = canvasSize;
    if (baseCanvasTitle) {
      baseCanvasTitle.textContent = `원본 ${canvasSize}x${canvasSize}`;
    }

    baseCtx.fillStyle = '#ffffff';
    baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

    groups.forEach((group, groupIndex) => {
      group.segments.forEach((segment, segmentIndex) => {
        if (!visibleSegmentIds.has(segment.id)) return;
        const fill = getSegmentFillColor(groupIndex, segmentIndex);

        segment.points.forEach((point, pointIndex) => {
          const isMergePoint = isPointMergeConnected(group, segment.id, pointIndex);

          if (isMergePoint) {
            baseCtx.fillStyle = 'rgba(255, 138, 0, 0.85)';
          } else if (point.canConnect) {
            baseCtx.fillStyle = 'rgba(34, 197, 94, 0.75)';
          } else {
            baseCtx.fillStyle = fill;
          }
          baseCtx.fillRect(point.x, point.y, point.size, point.size);

          if (isMergePoint) {
            baseCtx.strokeStyle = '#8a3b00';
          } else if (point.canConnect) {
            baseCtx.strokeStyle = '#d4af37';
          } else {
            baseCtx.strokeStyle = '#6b7280';
          }
          baseCtx.lineWidth = 1;
          baseCtx.strokeRect(point.x + 0.5, point.y + 0.5, point.size - 1, point.size - 1);

          if (isMergePoint && point.canConnect) {
            baseCtx.fillStyle = '#22c55e';
            baseCtx.fillRect(
              point.x + Math.max(0, Math.floor(point.size / 2) - 1),
              point.y + Math.max(0, Math.floor(point.size / 2) - 1),
              2,
              2
            );
          }
        });
      });

      if (getSelectedGroupIndices().includes(groupIndex)) {
        const bounds = getGroupBounds(group, false);
        if (bounds.maxRight <= bounds.minX || bounds.maxBottom <= bounds.minY) {
          return;
        }
        const width = Math.max(1, bounds.maxRight - bounds.minX);
        const height = Math.max(1, bounds.maxBottom - bounds.minY);

        baseCtx.strokeStyle = '#ffd60a';
        baseCtx.lineWidth = 2;
        baseCtx.setLineDash([4, 3]);
        baseCtx.strokeRect(bounds.minX - 1.5, bounds.minY - 1.5, width + 3, height + 3);
        baseCtx.setLineDash([]);
      }
    });

    const orderedSelections = selectedSelections.length > 0 ? selectedSelections : selectedRect ? [selectedRect] : [];

    orderedSelections.forEach((sel, index) => {
      const group = groups[sel.groupIndex];
      const segment = group && group.segments[sel.segmentIndex];
      if (!segment || !visibleSegmentIds.has(segment.id)) return;
      const point = segment && segment.points[sel.pointIndex];
      if (!point) return;

      if (selectedSelections.length > 0 && index === 0) {
        baseCtx.strokeStyle = '#ff3b30';
        baseCtx.setLineDash([]);
      } else if (selectedSelections.length > 0 && index === 1) {
        baseCtx.strokeStyle = '#2563eb';
        baseCtx.setLineDash([]);
      } else {
        baseCtx.strokeStyle = '#ff3b30';
        baseCtx.setLineDash([]);
      }
      baseCtx.lineWidth = 1;
      baseCtx.strokeRect(point.x + 0.5, point.y + 0.5, point.size - 1, point.size - 1);
      baseCtx.setLineDash([]);
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

  function normalizePoints(parsed) {
    const source = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.rects)
      ? parsed.rects
      : null;

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
        canConnect: typeof item.canConnect === 'boolean' ? item.canConnect : false
      });
    }

    if (normalized.length > 0 && !source.some(item => Object.prototype.hasOwnProperty.call(item, 'canConnect'))) {
      normalized[0].canConnect = true;
      normalized[normalized.length - 1].canConnect = true;
    }

    return normalized;
  }

  function renderGroups(groups) {
    currentGroups = groups;
    syncVisibleSegmentIds(currentGroups);

    selectedSelections = selectedSelections
      .map(sel => {
        const group = currentGroups[sel.groupIndex];
        if (!group) return null;

        const safeSegmentIndex = Math.max(0, Math.min(sel.segmentIndex, group.segments.length - 1));
        const segment = group.segments[safeSegmentIndex];
        if (!segment || segment.points.length === 0) return null;
        if (!visibleSegmentIds.has(segment.id)) return null;

        const safePointIndex = Math.max(0, Math.min(sel.pointIndex, segment.points.length - 1));
        return {
          groupIndex: sel.groupIndex,
          segmentIndex: safeSegmentIndex,
          pointIndex: safePointIndex
        };
      })
      .filter(Boolean);

    if (selectedRect) {
      const group = currentGroups[selectedRect.groupIndex];
      const segment = group && group.segments[selectedRect.segmentIndex];
      const point = segment && segment.points[selectedRect.pointIndex];
      if (!point || !visibleSegmentIds.has(segment.id)) {
        selectedRect = null;
      }
    }

    updateMergeButtonState();
    updateSelectionInfo();
    updateConnectButtonState();
    updateDisconnectButtonState();
    updatePointNavButtonState();
    renderSegmentVisibilityPanel();
    drawBaseCanvas(currentGroups);
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

      const points = normalizePoints(parsed);
      if (!points) {
        setStatus('JSON 배열 형식이 아닙니다. [{x,y,size,...}] 형태가 필요합니다.', true);
        jsonOutput.value = JSON.stringify(parsed, null, 2);
        return;
      }

      const nextGroups = currentGroups.concat([createGroupFromPoints(points)]);
      renderGroups(nextGroups);
      console.log(`🖼️ 실제 해상도: ${baseCanvas.width}x${baseCanvas.height}`);

      jsonOutput.value = JSON.stringify(parsed, null, 2);
      setStatus(
        `JSON을 불러왔습니다. 그룹 ${currentGroups.length}개, 누적 ${getTotalRectCount(currentGroups)}개 렌더링 완료.`,
        false
      );
    } catch (error) {
      setStatus('클립보드 접근에 실패했습니다. 브라우저 권한을 확인해주세요.', true);
    }
  }

  async function exportCurrentStructure() {
    const payload = {
      version: 1,
      groups: cloneGroups(currentGroups)
    };
    const text = JSON.stringify(payload, null, 2);
    jsonOutput.value = text;

    try {
      await navigator.clipboard.writeText(text);
      setStatus(
        `현재 구조 JSON 내보내기 완료: 그룹 ${currentGroups.length}개, 점 ${getTotalRectCount(currentGroups)}개 (클립보드 복사됨).`,
        false
      );
    } catch (error) {
      setStatus(
        `현재 구조 JSON 내보내기 완료: 그룹 ${currentGroups.length}개, 점 ${getTotalRectCount(currentGroups)}개 (클립보드 복사는 실패).`,
        false
      );
    }
  }

  scaleRange.addEventListener('input', drawZoomCanvas);

  baseCanvas.addEventListener('click', event => {
    const point = getCanvasCoordsFromEvent(event, baseCanvas, 1);
    handleCanvasClick(point.x, point.y, {
      toggleSelection: event.ctrlKey || event.metaKey,
      cycleSelection: event.altKey
    });
  });

  zoomCanvas.addEventListener('click', event => {
    const point = getCanvasCoordsFromEvent(event, zoomCanvas, getCurrentScale());
    handleCanvasClick(point.x, point.y, {
      toggleSelection: event.ctrlKey || event.metaKey,
      cycleSelection: event.altKey
    });
  });

  if (btnMerge) {
    btnMerge.addEventListener('click', mergeSelectedGroups);
  }

  if (btnToggleConnect) {
    btnToggleConnect.addEventListener('click', toggleSelectedPointConnect);
  }

  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', disconnectSelectedPoint);
  }

  if (btnPrevPoint) {
    btnPrevPoint.addEventListener('click', () => navigateSelectedPoint(-1));
  }

  if (btnNextPoint) {
    btnNextPoint.addEventListener('click', () => navigateSelectedPoint(1));
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', exportCurrentStructure);
  }

  if (btnSegmentsShowAll) {
    btnSegmentsShowAll.addEventListener('click', () => {
      collectSegmentsWithMeta(currentGroups).forEach(row => {
        visibleSegmentIds.add(row.segment.id);
      });
      renderGroups(currentGroups);
      setStatus('모든 세그먼트를 표시합니다.', false);
    });
  }

  if (btnSegmentsHideAll) {
    btnSegmentsHideAll.addEventListener('click', () => {
      visibleSegmentIds.clear();
      renderGroups(currentGroups);
      setStatus('모든 세그먼트를 숨겼습니다.', false);
    });
  }

  document.addEventListener('keydown', handleMoveKey);

  btnLoadJson.addEventListener('click', loadJsonFromClipboard);

  renderGroups([]);
})();