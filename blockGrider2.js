(function () {
  const btnLoadJson = document.getElementById('btnLoadJson');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnMerge = document.getElementById('btnMerge');
  const btnSplitSegment = document.getElementById('btnSplitSegment');
  const btnInsertStartFromPoint = document.getElementById('btnInsertStartFromPoint');
  const btnSplitByContact = document.getElementById('btnSplitByContact');
  const btnReverseIndices = document.getElementById('btnReverseIndices');
  const btnCheckAdjRange = document.getElementById('btnCheckAdjRange');
  const btnSplitAdjRange = document.getElementById('btnSplitAdjRange');
  const btnCheckAdjForward = document.getElementById('btnCheckAdjForward');
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
  const ADJ_RANGE_HIGHLIGHT_MS = 4000;
  const FORWARD_ADJ_ADDITIONAL_HIGHLIGHT_MS = 3000;
  const ADJ_FIRST_FAIL_HIGHLIGHT_MS = 3000;
  const TAB_SEGMENT_HIGHLIGHT_MS = 1000;
  const SEGMENT_HUE_PALETTE = [210, 30, 135, 280, 350, 55, 175, 305, 15, 195];
  const HIGHLIGHT_KEY_ADJ_RANGE = 'adjRange';
  const HIGHLIGHT_KEY_FORWARD_ADDITIONAL = 'forwardAdditional';
  const HIGHLIGHT_KEY_ADJ_FIRST_FAIL = 'adjFirstFail';
  const HIGHLIGHT_KEY_TAB_SEGMENT = 'tabSegment';

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
  let lastTabCycleKey = '';
  let lastTabCycleIndex = -1;
  const pointRangeHighlights = {
    [HIGHLIGHT_KEY_ADJ_RANGE]: { range: null, timer: null },
    [HIGHLIGHT_KEY_FORWARD_ADDITIONAL]: { range: null, timer: null },
    [HIGHLIGHT_KEY_ADJ_FIRST_FAIL]: { range: null, timer: null },
    [HIGHLIGHT_KEY_TAB_SEGMENT]: { range: null, timer: null }
  };

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

  function setStatusHtml(messageHtml, isError) {
    status.innerHTML = messageHtml;
    status.classList.toggle('error', !!isError);
  }

  function clonePoint(point) {
    return {
      x: point.x,
      y: point.y,
      size: point.size,
      canConnect: !!point.canConnect,
      mergeState: !!point.mergeState
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
    const paletteIndex = (groupIndex * 5 + segmentIndex) % SEGMENT_HUE_PALETTE.length;
    return SEGMENT_HUE_PALETTE[paletteIndex];
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

  function getSplitSelectionContext() {
    if (selectedSelections.length !== 2) return null;

    const a = selectedSelections[0];
    const b = selectedSelections[1];
    if (a.groupIndex !== b.groupIndex) return null;
    if (a.segmentIndex !== b.segmentIndex) return null;
    if (a.pointIndex === b.pointIndex) return null;

    const group = currentGroups[a.groupIndex];
    const segment = group && group.segments[a.segmentIndex];
    if (!group || !segment || !Array.isArray(segment.points) || segment.points.length < 2) return null;

    const startIndex = Math.min(a.pointIndex, b.pointIndex);
    const endIndex = Math.max(a.pointIndex, b.pointIndex);
    if (startIndex < 0 || endIndex >= segment.points.length) return null;

    return {
      groupIndex: a.groupIndex,
      segmentIndex: a.segmentIndex,
      startIndex,
      endIndex
    };
  }

  function updateSplitButtonState() {
    if (!btnSplitSegment) return;
    btnSplitSegment.disabled = !getSplitSelectionContext();
  }

  function getInsertStartMergeContext() {
    if (selectedSelections.length !== 2) return null;

    const first = selectedSelections[0];
    const second = selectedSelections[1];
    const firstIsStart = first.pointIndex === 0;
    const secondIsStart = second.pointIndex === 0;

    if (firstIsStart === secondIsStart) return null;

    const startSel = firstIsStart ? first : second; // B: L2의 시작점(인덱스 0)
    const sourceSel = firstIsStart ? second : first; // A: L1의 점

    if (startSel.groupIndex === sourceSel.groupIndex && startSel.segmentIndex === sourceSel.segmentIndex) {
      return null;
    }

    const startGroup = currentGroups[startSel.groupIndex];
    const sourceGroup = currentGroups[sourceSel.groupIndex];
    const startSegment = startGroup && startGroup.segments[startSel.segmentIndex];
    const sourceSegment = sourceGroup && sourceGroup.segments[sourceSel.segmentIndex];
    const startPoint = startSegment && startSegment.points[startSel.pointIndex];
    const sourcePoint = sourceSegment && sourceSegment.points[sourceSel.pointIndex];

    if (!startGroup || !sourceGroup || !startSegment || !sourceSegment || !startPoint || !sourcePoint) {
      return null;
    }

    return {
      startSel: { ...startSel },
      sourceSel: { ...sourceSel }
    };
  }

  function updateInsertStartButtonState() {
    if (!btnInsertStartFromPoint) return;
    btnInsertStartFromPoint.disabled = !getInsertStartMergeContext();
  }

  function getSplitByContactContext() {
    if (selectedSelections.length !== 2) return null;

    // 선택 순서를 유지: 첫 번째 선택이 P1, 두 번째 선택이 P2
    const p1 = selectedSelections[0];
    const p2 = selectedSelections[1];
    if (p1.groupIndex !== p2.groupIndex || p1.segmentIndex !== p2.segmentIndex) return null;
    if (p1.pointIndex === p2.pointIndex) return null;

    const group = currentGroups[p1.groupIndex];
    const segment = group && group.segments[p1.segmentIndex];
    if (!group || !segment || !Array.isArray(segment.points)) return null;
    if (p2.pointIndex < 0 || p2.pointIndex >= segment.points.length) return null;

    return {
      groupIndex: p1.groupIndex,
      segmentIndex: p1.segmentIndex,
      p1Index: p1.pointIndex,
      p2Index: p2.pointIndex
    };
  }

  function updateSplitByContactButtonState() {
    if (!btnSplitByContact) return;
    btnSplitByContact.disabled = !getSplitByContactContext();
  }

  function updateReverseIndicesButtonState() {
    if (!btnReverseIndices) return;
    btnReverseIndices.disabled = !getSplitSelectionContext();
  }

  function updateCheckAdjRangeButtonState() {
    if (!btnCheckAdjRange) return;
    btnCheckAdjRange.disabled = !getSplitSelectionContext();
  }

  function updateSplitAdjRangeButtonState() {
    if (!btnSplitAdjRange) return;
    btnSplitAdjRange.disabled = !getSplitSelectionContext();
  }

  function getForwardAdjStartContext() {
    if (!selectedRect) return null;
    if (selectedSelections.length > 1) return null;

    const info = getPointAndSegmentFromSelection(selectedRect);
    if (!info) return null;

    const startIndex = selectedRect.pointIndex;
    const endIndex = info.segment.points.length - 1;
    if (startIndex < 0 || startIndex >= endIndex) return null;

    return {
      groupIndex: selectedRect.groupIndex,
      segmentIndex: selectedRect.segmentIndex,
      startIndex,
      endIndex
    };
  }

  function updateCheckAdjForwardButtonState() {
    if (!btnCheckAdjForward) return;
    btnCheckAdjForward.disabled = !getForwardAdjStartContext();
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

  function getConnectedSelectionsForSelection(selection) {
    const info = getPointAndSegmentFromSelection(selection);
    if (!info) return [];

    const segmentIdToIndex = new Map();
    info.group.segments.forEach((segment, index) => {
      segmentIdToIndex.set(segment.id, index);
    });

    const unique = new Set();
    const results = [];

    info.group.connections.forEach(conn => {
      let peer = null;

      if (conn.from.segmentId === info.segment.id && conn.from.pointIndex === selection.pointIndex) {
        peer = conn.to;
      } else if (conn.to.segmentId === info.segment.id && conn.to.pointIndex === selection.pointIndex) {
        peer = conn.from;
      }

      if (!peer) return;

      const peerSegmentIndex = segmentIdToIndex.get(peer.segmentId);
      if (!Number.isInteger(peerSegmentIndex)) return;

      const peerSegment = info.group.segments[peerSegmentIndex];
      if (!peerSegment || !peerSegment.points[peer.pointIndex]) return;

      const key = `${peerSegmentIndex}-${peer.pointIndex}`;
      if (unique.has(key)) return;
      unique.add(key);

      results.push({
        groupIndex: selection.groupIndex,
        segmentIndex: peerSegmentIndex,
        pointIndex: peer.pointIndex
      });
    });

    return results;
  }

  function findSelectionIndexExact(selection) {
    return selectedSelections.findIndex(item =>
      item.groupIndex === selection.groupIndex &&
      item.segmentIndex === selection.segmentIndex &&
      item.pointIndex === selection.pointIndex
    );
  }

  function cycleToConnectedMergePoint(reverse) {
    if (!selectedRect) {
      setStatus('Tab 전환할 폴리라인이 없습니다. 먼저 점을 선택해주세요.', true);
      return false;
    }

    const prevSelected = { ...selectedRect };

    const peers = getConnectedSelectionsForSelection(selectedRect);
    if (peers.length === 0) {
      setStatus('Tab 전환할 폴리라인이 없습니다. 선택 점에 MERGE 연결 상대가 없습니다.', true);
      return false;
    }

    const cycleKey = `${selectedRect.groupIndex}-${selectedRect.segmentIndex}-${selectedRect.pointIndex}|${peers
      .map(item => `${item.groupIndex}-${item.segmentIndex}-${item.pointIndex}`)
      .join('|')}`;

    if (lastTabCycleKey === cycleKey) {
      if (reverse) {
        lastTabCycleIndex = (lastTabCycleIndex - 1 + peers.length) % peers.length;
      } else {
        lastTabCycleIndex = (lastTabCycleIndex + 1) % peers.length;
      }
    } else {
      lastTabCycleKey = cycleKey;
      lastTabCycleIndex = reverse ? peers.length - 1 : 0;
    }

    const next = peers[lastTabCycleIndex];
    selectedRect = { ...next };

    const selectedIndex = findSelectionIndexExact(prevSelected);
    if (selectedIndex >= 0) {
      selectedSelections[selectedIndex] = { ...next };
    } else if (selectedSelections.length === 0) {
      selectedSelections = [{ ...next }];
    }

    const group = currentGroups[next.groupIndex];
    const segment = group && group.segments[next.segmentIndex];
    const point = segment && segment.points[next.pointIndex];
    if (!point) return false;

    updateClickInfo(point.x, point.y, {
      groupIndex: next.groupIndex,
      segmentIndex: next.segmentIndex,
      pointIndex: next.pointIndex,
      point,
      rect: point
    });

    startTabSegmentHighlight(next);
    setStatus('Tab으로 MERGE 연결 상대 점으로 전환했습니다.', false);
    return true;
  }

  function updatePointNavButtonState() {
    if (!btnPrevPoint || !btnNextPoint) return;

    const info = getPointAndSegmentFromSelection(selectedRect);
    if (!info) {
      btnPrevPoint.disabled = true;
      btnNextPoint.disabled = true;
      btnPrevPoint.textContent = '⇐ (없음)';
      btnNextPoint.textContent = '⇒ (없음)';
      return;
    }

    const currentPoint = info.point;
    const points = info.segment.points;
    const pointIndex = selectedRect.pointIndex;
    const maxIndex = points.length - 1;
    btnPrevPoint.disabled = pointIndex <= 0;
    btnNextPoint.disabled = pointIndex >= maxIndex;

    if (pointIndex > 0) {
      const prevPoint = points[pointIndex - 1];
      const prevAdjLabel = areRectsAdjacent(currentPoint, prevPoint) ? '인접' : '비인접';
      btnPrevPoint.textContent = `⇐ (${prevAdjLabel})`;
    } else {
      btnPrevPoint.textContent = '⇐ (없음)';
    }

    if (pointIndex < maxIndex) {
      const nextPoint = points[pointIndex + 1];
      const nextAdjLabel = areRectsAdjacent(currentPoint, nextPoint) ? '인접' : '비인접';
      btnNextPoint.textContent = `⇒ (${nextAdjLabel})`;
    } else {
      btnNextPoint.textContent = '⇒ (없음)';
    }
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

    const uniqueGroupCount = new Set(selectedSelections.map(item => item.groupIndex)).size;
    const isSameSegmentTwoPoints =
      selectedSelections.length === 2 &&
      selectedSelections[0].groupIndex === selectedSelections[1].groupIndex &&
      selectedSelections[0].segmentIndex === selectedSelections[1].segmentIndex;
    const sameSegmentNotice = isSameSegmentTwoPoints
      ? '<span class="highlight-note">같은 선(세그먼트) 2점 선택</span>'
      : '';

    selectionInfo.innerHTML = `선택된 그룹: <span class="info-badge">${uniqueGroupCount}개</span>, ${sameSegmentNotice} ${labels}`;
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
    const isMergeStatePoint = !!(point && point.mergeState);

    const candidateIndex = cycleMeta && Number.isInteger(cycleMeta.index) ? cycleMeta.index + 1 : null;
    const candidateTotal = cycleMeta && Number.isInteger(cycleMeta.total) ? cycleMeta.total : null;
    const candidateBadge =
      candidateTotal && candidateTotal > 1
        ? `<span class="info-badge badge-sub">후보 ${candidateIndex}/${candidateTotal}</span>`
        : '';
    const mergeBadge = (isMergeConnectedPoint || isMergeStatePoint)
      ? '<span class="info-badge badge-main">MERGE 연결점☩</span>'
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
      updateSplitButtonState();
      updateInsertStartButtonState();
      updateSplitByContactButtonState();
      updateReverseIndicesButtonState();
      updateCheckAdjRangeButtonState();
      updateCheckAdjForwardButtonState();
      updateSelectionInfo();
      updateConnectButtonState();
      updateDisconnectButtonState();
      updatePointNavButtonState();
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
      const existingIndex = findSelectionIndexExact(selection);
      if (existingIndex >= 0) {
        selectedSelections.splice(existingIndex, 1);
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
    updateSplitButtonState();
    updateInsertStartButtonState();
    updateSplitByContactButtonState();
    updateReverseIndicesButtonState();
    updateCheckAdjRangeButtonState();
    updateCheckAdjForwardButtonState();
    updateSelectionInfo();
    updateConnectButtonState();
    updateDisconnectButtonState();
    updatePointNavButtonState();
    updateClickInfo(x, y, hit, { index: lastCycleIndex, total: Math.max(1, hits.length) });
    drawBaseCanvas(currentGroups);
    drawZoomCanvas();
  }

  function navigateSelectedPoint(step) {
    if (!selectedRect) {
      setStatus('먼저 점을 클릭해 선택해주세요.', true);
      return;
    }

    const prevSelected = { ...selectedRect };

    const info = getPointAndSegmentFromSelection(selectedRect);
    if (!info) {
      setStatus('선택 점 정보를 찾을 수 없습니다.', true);
      return;
    }

    const prevPoint = info.point;

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

    const selectionIdx = findSelectionIndexExact(prevSelected);
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

    const adjacentLabel = areRectsAdjacent(prevPoint, point) ? '인접' : '비인접';
    setStatus(`점 이동: P${prevSelected.pointIndex} -> P${nextPointIndex} (${adjacentLabel})`, false);

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
    setStatus('마지막 작업을 Ctrl+Z로 되돌렸습니다.', false);
  }

  function pointDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function areRectsAdjacent(a, b) {
    if (!a || !b) return false;

    const ax1 = Number(a.x);
    const ay1 = Number(a.y);
    const ax2 = ax1 + Number(a.size);
    const ay2 = ay1 + Number(a.size);

    const bx1 = Number(b.x);
    const by1 = Number(b.y);
    const bx2 = bx1 + Number(b.size);
    const by2 = by1 + Number(b.size);

    if (![ax1, ay1, ax2, ay2, bx1, by1, bx2, by2].every(Number.isFinite)) return false;

    const horizontalGap = Math.max(0, Math.max(ax1, bx1) - Math.min(ax2, bx2));
    const verticalGap = Math.max(0, Math.max(ay1, by1) - Math.min(ay2, by2));

    // 겹치거나 변/꼭짓점이 닿아 있으면 인접으로 간주
    return horizontalGap === 0 && verticalGap === 0;
  }

  function isPointInNamedHighlightRange(highlightKey, group, segment, pointIndex) {
    const state = pointRangeHighlights[highlightKey];
    const range = state && state.range;
    if (!range) return false;
    if (!group || !segment) return false;
    if (group.id !== range.groupId) return false;
    if (segment.id !== range.segmentId) return false;
    return pointIndex >= range.startIndex && pointIndex <= range.endIndex;
  }

  function startNamedPointRangeHighlight(highlightKey, context, durationMs) {
    const state = pointRangeHighlights[highlightKey];
    if (!state || !context) return;
    const group = currentGroups[context.groupIndex];
    const segment = group && group.segments[context.segmentIndex];
    if (!group || !segment) return;

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }

    const startIndex = Number.isInteger(context.startIndex) ? context.startIndex : 0;
    const endIndex = Number.isInteger(context.endIndex) ? context.endIndex : -1;

    if (startIndex > endIndex) {
      state.range = null;
      renderGroups(currentGroups);
      return;
    }

    state.range = {
      groupId: group.id,
      segmentId: segment.id,
      startIndex,
      endIndex
    };

    renderGroups(currentGroups);

    state.timer = setTimeout(() => {
      state.timer = null;
      state.range = null;
      renderGroups(currentGroups);
    }, durationMs);
  }

  function startAdjacencyRangeHighlight(context) {
    startNamedPointRangeHighlight(HIGHLIGHT_KEY_ADJ_RANGE, context, ADJ_RANGE_HIGHLIGHT_MS);
  }

  function startForwardAdjAdditionalHighlight(context) {
    startNamedPointRangeHighlight(
      HIGHLIGHT_KEY_FORWARD_ADDITIONAL,
      context,
      FORWARD_ADJ_ADDITIONAL_HIGHLIGHT_MS
    );
  }

  function startAdjacencyFirstFailHighlight(context) {
    startNamedPointRangeHighlight(
      HIGHLIGHT_KEY_ADJ_FIRST_FAIL,
      context,
      ADJ_FIRST_FAIL_HIGHLIGHT_MS
    );
  }

  function startTabSegmentHighlight(selection) {
    if (!selection) return;
    const group = currentGroups[selection.groupIndex];
    const segment = group && group.segments[selection.segmentIndex];
    if (!segment || !Array.isArray(segment.points) || segment.points.length === 0) return;

    startNamedPointRangeHighlight(
      HIGHLIGHT_KEY_TAB_SEGMENT,
      {
        groupIndex: selection.groupIndex,
        segmentIndex: selection.segmentIndex,
        startIndex: 0,
        endIndex: segment.points.length - 1
      },
      TAB_SEGMENT_HIGHLIGHT_MS
    );
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
    const mergeBaseSize = Math.max(Number(pointA2.size), Number(pointB2.size));
    const hasSizeMismatch = Number(pointA2.size) !== Number(pointB2.size);
    pointA2.size = mergeBaseSize;
    pointB2.size = mergeBaseSize;

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
      `MERGE 완료: main=${mainSegmentId}, sub=${subOriginalSegmentId} -> ${subMergedSegmentId}, 거리=${selectedDistance.toFixed(2)}, 기준 길이=${mergeBaseSize}${hasSizeMismatch ? ' (크기 자동 일치 적용)' : ' (이미 동일 크기)'}`,
      false
    );
  }

  function splitSelectedSegmentRange() {
    const splitContext = getSplitSelectionContext();
    if (!splitContext) {
      setStatus('분할 실패: 같은 선(세그먼트)에서 서로 다른 두 점을 선택해주세요.', true);
      return;
    }

    const group = currentGroups[splitContext.groupIndex];
    const segment = group && group.segments[splitContext.segmentIndex];
    if (!group || !segment) {
      setStatus('분할 실패: 선택된 세그먼트를 찾지 못했습니다.', true);
      return;
    }

    const originalPoints = segment.points;
    const originalLen = originalPoints.length;
    const startIndex = splitContext.startIndex;
    const endIndex = splitContext.endIndex;

    if (startIndex === 0 && endIndex === originalLen - 1) {
      setStatus('분할 실패: 선 전체가 선택되었습니다. 내부 구간을 선택해주세요.', true);
      return;
    }

    const keptPoints = originalPoints
      .slice(0, startIndex)
      .concat(originalPoints.slice(endIndex + 1))
      .map(clonePoint);
    const extractedPoints = originalPoints.slice(startIndex, endIndex + 1).map(clonePoint);

    if (keptPoints.length < 2 || extractedPoints.length < 2) {
      setStatus('분할 실패: 분할 결과 중 하나의 세그먼트 점 수가 너무 적습니다.', true);
      return;
    }

    function classifyEndpoint(endpoint) {
      if (!endpoint || endpoint.segmentId !== segment.id) return 'external';

      const rawIndex = Number(endpoint.pointIndex);
      if (!Number.isFinite(rawIndex)) return 'external';
      const index = Math.max(0, Math.min(originalLen - 1, Math.round(rawIndex)));
      return index >= startIndex && index <= endIndex ? 'new' : 'old';
    }

    const hasUnsupportedCrossConnection = (group.connections || []).some(conn => {
      const fromClass = classifyEndpoint(conn.from);
      const toClass = classifyEndpoint(conn.to);

      if (fromClass !== 'new' && toClass !== 'new') return false;
      if (fromClass !== 'new' || toClass !== 'new') return true;

      // Both endpoints are in extracted range; if either side references another segment,
      // splitting into a separate group would create cross-group links.
      return conn.from.segmentId !== segment.id || conn.to.segmentId !== segment.id;
    });

    if (hasUnsupportedCrossConnection) {
      setStatus('분할 실패: 선택 구간에 연결된 MERGE가 있어 독립 그룹 분할이 불가합니다. 먼저 연결 해제를 진행해주세요.', true);
      return;
    }

    pushMergeUndoSnapshot();

    const originalSegmentId = segment.id;
    const newSegment = {
      id: createSegmentId(),
      points: extractedPoints
    };

    function mapOldIndexToKeptIndex(oldIndex) {
      if (oldIndex < startIndex) return oldIndex;
      return oldIndex - (endIndex - startIndex + 1);
    }

    function mapEndpoint(endpoint) {
      const mapped = { ...endpoint };
      if (!mapped || mapped.segmentId !== originalSegmentId) {
        return { endpoint: mapped, bucket: 'external' };
      }

      const rawIndex = Number(mapped.pointIndex);
      const oldIndex = Number.isFinite(rawIndex)
        ? Math.max(0, Math.min(originalLen - 1, Math.round(rawIndex)))
        : 0;

      if (oldIndex >= startIndex && oldIndex <= endIndex) {
        mapped.segmentId = newSegment.id;
        mapped.pointIndex = oldIndex - startIndex;
        return { endpoint: mapped, bucket: 'new' };
      }

      mapped.segmentId = originalSegmentId;
      mapped.pointIndex = mapOldIndexToKeptIndex(oldIndex);
      return { endpoint: mapped, bucket: 'old' };
    }

    const keptConnections = [];
    const newConnections = [];

    (group.connections || []).forEach(conn => {
      const mappedFrom = mapEndpoint(conn.from);
      const mappedTo = mapEndpoint(conn.to);
      const mappedConn = {
        ...cloneConnection(conn),
        from: mappedFrom.endpoint,
        to: mappedTo.endpoint
      };

      if (mappedFrom.bucket === 'new' && mappedTo.bucket === 'new') {
        newConnections.push(mappedConn);
      } else {
        keptConnections.push(mappedConn);
      }
    });

    segment.points = keptPoints;
    group.connections = keptConnections;

    const newGroup = {
      id: createGroupId(),
      segments: [newSegment],
      connections: newConnections
    };

    const newGroupIndex = splitContext.groupIndex + 1;
    currentGroups.splice(newGroupIndex, 0, newGroup);

    selectedSelections = selectedSelections.map(sel => ({
      groupIndex: newGroupIndex,
      segmentIndex: 0,
      pointIndex: Math.max(0, Math.min(newSegment.points.length - 1, sel.pointIndex - startIndex))
    }));
    selectedRect = selectedSelections.length > 0 ? { ...selectedSelections[0] } : null;

    renderGroups(currentGroups);

    const selectedPoint = selectedRect
      ? currentGroups[selectedRect.groupIndex].segments[selectedRect.segmentIndex].points[selectedRect.pointIndex]
      : null;
    if (selectedPoint) {
      updateClickInfo(selectedPoint.x, selectedPoint.y, {
        groupIndex: selectedRect.groupIndex,
        segmentIndex: selectedRect.segmentIndex,
        pointIndex: selectedRect.pointIndex,
        point: selectedPoint,
        rect: selectedPoint
      });
    }

    setStatus(
      `선 분할 완료: 기존 그룹 G${splitContext.groupIndex + 1} ${keptPoints.length}점 유지, 신규 그룹 G${newGroupIndex + 1} ${extractedPoints.length}점 생성`,
      false
    );
  }

  function insertStartPointFromOtherPolyline() {
    const context = getInsertStartMergeContext();
    if (!context) {
      setStatus('실패: 점 2개를 선택하고, 그중 하나는 대상 선의 시작점(P0)이어야 합니다.', true);
      return;
    }

    pushMergeUndoSnapshot();

    const startSel = context.startSel;
    const sourceSel = context.sourceSel;

    let mergedGroupIndex = startSel.groupIndex;
    let sourceSelectionInMerged = { ...sourceSel };

    if (startSel.groupIndex !== sourceSel.groupIndex) {
      const targetGroup = cloneGroup(currentGroups[startSel.groupIndex]);
      const sourceGroup = cloneGroup(currentGroups[sourceSel.groupIndex]);
      const sourceIdMap = remapSegmentIdsForMerge(sourceGroup);
      const sourceSegmentId = currentGroups[sourceSel.groupIndex].segments[sourceSel.segmentIndex].id;
      const mappedSourceSegmentId = sourceIdMap[sourceSegmentId] || sourceSegmentId;

      targetGroup.segments.push(...sourceGroup.segments.map(cloneSegment));
      targetGroup.connections.push(...sourceGroup.connections.map(cloneConnection));

      const keepIndex = startSel.groupIndex;
      const removeIndex = sourceSel.groupIndex;
      currentGroups[keepIndex] = targetGroup;
      currentGroups.splice(removeIndex, 1);

      mergedGroupIndex = keepIndex;
      if (removeIndex < keepIndex) {
        mergedGroupIndex -= 1;
      }

      const mappedSegmentIndex = targetGroup.segments.findIndex(seg => seg.id === mappedSourceSegmentId);
      if (mappedSegmentIndex < 0) {
        setStatus('실패: 소스 세그먼트 매핑에 실패했습니다.', true);
        return;
      }

      sourceSelectionInMerged = {
        groupIndex: mergedGroupIndex,
        segmentIndex: mappedSegmentIndex,
        pointIndex: sourceSel.pointIndex
      };
    }

    const mergedGroup = currentGroups[mergedGroupIndex];
    if (!mergedGroup) {
      setStatus('실패: 병합된 그룹을 찾지 못했습니다.', true);
      return;
    }

    const targetSegment = mergedGroup.segments[startSel.segmentIndex];
    const sourceSegment = mergedGroup.segments[sourceSelectionInMerged.segmentIndex];
    const sourcePoint = sourceSegment && sourceSegment.points[sourceSelectionInMerged.pointIndex];
    if (!targetSegment || !sourceSegment || !sourcePoint) {
      setStatus('실패: 대상/소스 점을 찾지 못했습니다.', true);
      return;
    }

    const newStartPoint = clonePoint(sourcePoint);
    newStartPoint.canConnect = true;
    sourcePoint.canConnect = true;

    targetSegment.points.unshift(newStartPoint);

    // 대상 세그먼트의 기존 연결점 인덱스는 +1 이동
    (mergedGroup.connections || []).forEach(conn => {
      if (conn.from.segmentId === targetSegment.id) {
        conn.from.pointIndex += 1;
      }
      if (conn.to.segmentId === targetSegment.id) {
        conn.to.pointIndex += 1;
      }
    });

    const prevStartPoint = targetSegment.points[1];
    const mergeDistance = prevStartPoint ? pointDistance(sourcePoint, prevStartPoint) : 0;
    mergedGroup.connections.push({
      id: createConnectionId(),
      from: {
        segmentId: sourceSegment.id,
        pointIndex: sourceSelectionInMerged.pointIndex
      },
      to: {
        segmentId: targetSegment.id,
        pointIndex: 0
      },
      distance: Number(mergeDistance.toFixed(4))
    });

    const startSelection = {
      groupIndex: mergedGroupIndex,
      segmentIndex: startSel.segmentIndex,
      pointIndex: 0
    };
    const nextSelection = {
      groupIndex: mergedGroupIndex,
      segmentIndex: startSel.segmentIndex,
      pointIndex: 1
    };

    selectedSelections = [startSelection, nextSelection];
    selectedRect = { ...startSelection };

    renderGroups(currentGroups);

    const activePoint = currentGroups[startSelection.groupIndex].segments[startSelection.segmentIndex].points[startSelection.pointIndex];
    if (activePoint) {
      updateClickInfo(activePoint.x, activePoint.y, {
        groupIndex: startSelection.groupIndex,
        segmentIndex: startSelection.segmentIndex,
        pointIndex: startSelection.pointIndex,
        point: activePoint,
        rect: activePoint
      });
    }

    setStatus(
      `시작점 삽입 완료: 대상 선 시작점이 A로 교체되고 기존 시작점 B는 P1이 되었습니다. (점 +1, A와 시작점 MERGE 연결 생성)`,
      false
    );
  }

  function splitPolylineByContactPoint() {
    const context = getSplitByContactContext();
    if (!context) {
      setStatus('분할 실패: 같은 폴리라인에서 점 2개(P1, P2)를 선택해주세요.', true);
      return;
    }

    const group = currentGroups[context.groupIndex];
    const segment = group && group.segments[context.segmentIndex];
    if (!group || !segment || !Array.isArray(segment.points)) {
      setStatus('분할 실패: 대상 세그먼트를 찾지 못했습니다.', true);
      return;
    }

    const points = segment.points;
    const originalLen = points.length;
    const p1Index = context.p1Index;
    const p2Index = context.p2Index;

    if (p1Index < 0 || p1Index >= originalLen || p2Index < 0 || p2Index >= originalLen) {
      setStatus('분할 실패: P1/P2 인덱스가 유효하지 않습니다.', true);
      return;
    }

    // P2에서 시작해서 연속 인접 구간을 끝까지 탐색한다.
    let chainEnd = p2Index;
    for (let i = p2Index + 1; i < originalLen; i++) {
      if (areRectsAdjacent(points[i - 1], points[i])) {
        chainEnd = i;
      } else {
        break;
      }
    }

    if (p1Index >= p2Index && p1Index <= chainEnd) {
      setStatus('분할 실패: P1은 P2부터 분리되는 연속 구간 바깥 점이어야 합니다.', true);
      return;
    }

    const movedStart = p2Index;
    const movedEnd = chainEnd;

    const keptPoints = points
      .slice(0, movedStart)
      .concat(points.slice(movedEnd + 1))
      .map(clonePoint);
    const movedPoints = points.slice(movedStart, movedEnd + 1).map(clonePoint);

    if (keptPoints.length < 2) {
      setStatus('분할 실패: 원본 폴리라인이 2점 미만이 되어 분할할 수 없습니다.', true);
      return;
    }

    const p3 = clonePoint(points[p1Index]);
    p3.canConnect = true;
    const newPolylinePoints = [p3, ...movedPoints];

    const originalSegmentId = segment.id;
    const keptSpan = movedEnd - movedStart + 1;

    function mapOldToKept(oldIndex) {
      if (oldIndex < movedStart) return oldIndex;
      return oldIndex - keptSpan;
    }

    function classifyEndpoint(endpoint) {
      if (!endpoint || endpoint.segmentId !== originalSegmentId) return { bucket: 'external' };

      const raw = Number(endpoint.pointIndex);
      if (!Number.isFinite(raw)) return { bucket: 'external' };
      const idx = Math.max(0, Math.min(originalLen - 1, Math.round(raw)));

      if (idx >= movedStart && idx <= movedEnd) {
        return { bucket: 'moved', idx };
      }
      return { bucket: 'kept', idx };
    }

    const keptConnections = [];
    const movedConnections = [];
    const newSegmentId = createSegmentId();

    for (const conn of group.connections || []) {
      const fromInfo = classifyEndpoint(conn.from);
      const toInfo = classifyEndpoint(conn.to);

      const hasMoved = fromInfo.bucket === 'moved' || toInfo.bucket === 'moved';
      if (!hasMoved) {
        const mapped = cloneConnection(conn);
        if (fromInfo.bucket === 'kept') {
          mapped.from.pointIndex = mapOldToKept(fromInfo.idx);
        }
        if (toInfo.bucket === 'kept') {
          mapped.to.pointIndex = mapOldToKept(toInfo.idx);
        }
        keptConnections.push(mapped);
        continue;
      }

      // moved 구간과 외부/kept가 연결된 경우, 그룹 분리 시 교차 연결이 되어 지원하지 않는다.
      if (fromInfo.bucket !== 'moved' || toInfo.bucket !== 'moved') {
        setStatus('분할 실패: P2 이후 분리 구간에 MERGE 연결이 있어 먼저 연결 해제가 필요합니다.', true);
        return;
      }

      // 둘 다 moved면 새 폴리라인 내부 연결로 옮긴다.
      const mapped = cloneConnection(conn);
      mapped.from.segmentId = newSegmentId;
      mapped.to.segmentId = newSegmentId;
      mapped.from.pointIndex = 1 + (fromInfo.idx - movedStart);
      mapped.to.pointIndex = 1 + (toInfo.idx - movedStart);
      movedConnections.push(mapped);
    }

    pushMergeUndoSnapshot();

    // 원본 L1 업데이트
    segment.points = keptPoints;
    group.connections = keptConnections;
    const keptP1Index = mapOldToKept(p1Index);
    if (segment.points[keptP1Index]) {
      segment.points[keptP1Index].canConnect = true;
    }

    // 새 L2 생성
    const newGroup = {
      id: createGroupId(),
      segments: [{ id: newSegmentId, points: newPolylinePoints }],
      connections: movedConnections
    };
    const newGroupIndex = context.groupIndex + 1;
    currentGroups.splice(newGroupIndex, 0, newGroup);

    selectedSelections = [
      { groupIndex: newGroupIndex, segmentIndex: 0, pointIndex: 0 },
      { groupIndex: newGroupIndex, segmentIndex: 0, pointIndex: 1 }
    ];
    selectedRect = { ...selectedSelections[0] };

    renderGroups(currentGroups);

    const active = currentGroups[selectedRect.groupIndex].segments[selectedRect.segmentIndex].points[selectedRect.pointIndex];
    if (active) {
      updateClickInfo(active.x, active.y, {
        groupIndex: selectedRect.groupIndex,
        segmentIndex: selectedRect.segmentIndex,
        pointIndex: selectedRect.pointIndex,
        point: active,
        rect: active
      });
    }

    setStatus(`접점 기준 분할 완료: L2 생성(P0=P3, P1=P${movedStart}) + P${movedStart + 1}..P${movedEnd} 연속 인접 구간 분리`, false);
  }

  function checkAdjacencyInSelectedRange() {
    const splitContext = getSplitSelectionContext();
    if (!splitContext) {
      setStatus('검사 실패: 같은 선(세그먼트)에서 서로 다른 두 점 A,B를 선택해주세요.', true);
      return;
    }

    const group = currentGroups[splitContext.groupIndex];
    const segment = group && group.segments[splitContext.segmentIndex];
    if (!group || !segment || !Array.isArray(segment.points)) {
      setStatus('검사 실패: 선택된 세그먼트를 찾지 못했습니다.', true);
      return;
    }

    const startIndex = splitContext.startIndex;
    const endIndex = splitContext.endIndex;
    let allAdjacent = true;
    let firstFail = null;

    for (let i = startIndex; i < endIndex; i++) {
      const a = segment.points[i];
      const b = segment.points[i + 1];
      if (!areRectsAdjacent(a, b)) {
        allAdjacent = false;
        firstFail = { from: i, to: i + 1 };
        break;
      }
    }

    const edgeCount = endIndex - startIndex;
    if (allAdjacent) {
      startAdjacencyRangeHighlight(splitContext);
      setStatus(
        `A~B 인접 검사: 인접 (G${splitContext.groupIndex + 1}, S${splitContext.segmentIndex + 1}, P${startIndex}~P${endIndex}, ${edgeCount}구간 모두 인접, 테두리 4초 하이라이트)`,
        false
      );
    } else {
      startAdjacencyFirstFailHighlight({
        groupIndex: splitContext.groupIndex,
        segmentIndex: splitContext.segmentIndex,
        startIndex: firstFail.from,
        endIndex: firstFail.to
      });
      const fromOrder = firstFail.from - startIndex;
      const toOrder = firstFail.to - startIndex;
      setStatus(
        `A~B 인접 검사: 비인접 (첫 비인접 구간 P${firstFail.from}(${fromOrder}번)->P${firstFail.to}(${toOrder}번), A 기준 0번 시작)`,
        true
      );
    }
  }

  function splitAdjacentSelectedRange() {
    const splitContext = getSplitSelectionContext();
    if (!splitContext) {
      setStatus('분할 실패: 같은 선(세그먼트)에서 서로 다른 두 점 A,B를 선택해주세요.', true);
      return;
    }

    const group = currentGroups[splitContext.groupIndex];
    const segment = group && group.segments[splitContext.segmentIndex];
    if (!group || !segment || !Array.isArray(segment.points)) {
      setStatus('분할 실패: 선택된 세그먼트를 찾지 못했습니다.', true);
      return;
    }

    const startIndex = splitContext.startIndex;
    const endIndex = splitContext.endIndex;
    let firstFail = null;

    for (let i = startIndex; i < endIndex; i++) {
      const a = segment.points[i];
      const b = segment.points[i + 1];
      if (!areRectsAdjacent(a, b)) {
        firstFail = { from: i, to: i + 1 };
        break;
      }
    }

    if (firstFail) {
      startAdjacencyFirstFailHighlight({
        groupIndex: splitContext.groupIndex,
        segmentIndex: splitContext.segmentIndex,
        startIndex: firstFail.from,
        endIndex: firstFail.to
      });

      const fromOrder = firstFail.from - startIndex;
      const toOrder = firstFail.to - startIndex;
      setStatus(
        `분할 실패: A~B 구간에 비인접 구간이 있습니다. (첫 비인접 P${firstFail.from}(${fromOrder}번)->P${firstFail.to}(${toOrder}번), A 기준 0번 시작)`,
        true
      );
      return;
    }

    const beforeGroupCount = currentGroups.length;
    splitSelectedSegmentRange();

    if (currentGroups.length === beforeGroupCount + 1) {
      const createdGroupIndex = splitContext.groupIndex + 1;
      const createdGroup = currentGroups[createdGroupIndex];
      const createdSegment = createdGroup && createdGroup.segments && createdGroup.segments[0];
      const createdCount = createdSegment && Array.isArray(createdSegment.points) ? createdSegment.points.length : (endIndex - startIndex + 1);
      setStatus(
        `A~B 인접 분할 완료: G${splitContext.groupIndex + 1}의 P${startIndex}~P${endIndex}를 신규 그룹 G${createdGroupIndex + 1} (${createdCount}점)으로 분리했습니다.`,
        false
      );
    }
  }

  function reverseIndicesInSelectedRange() {
    const splitContext = getSplitSelectionContext();
    if (!splitContext) {
      setStatus('반전 실패: 같은 선(세그먼트)에서 서로 다른 두 점 A,B를 선택해주세요.', true);
      return;
    }

    const group = currentGroups[splitContext.groupIndex];
    const segment = group && group.segments[splitContext.segmentIndex];
    if (!group || !segment || !Array.isArray(segment.points)) {
      setStatus('반전 실패: 선택된 세그먼트를 찾지 못했습니다.', true);
      return;
    }

    const startIndex = splitContext.startIndex;
    const endIndex = splitContext.endIndex;
    if (startIndex < 0 || endIndex >= segment.points.length || startIndex >= endIndex) {
      setStatus('반전 실패: 유효한 A~B 구간이 아닙니다.', true);
      return;
    }

    pushMergeUndoSnapshot();

    const points = segment.points;
    let left = startIndex;
    let right = endIndex;
    while (left < right) {
      const temp = points[left];
      points[left] = points[right];
      points[right] = temp;
      left += 1;
      right -= 1;
    }

    const remapIndex = idx => {
      if (idx < startIndex || idx > endIndex) return idx;
      return startIndex + endIndex - idx;
    };

    selectedSelections = selectedSelections.map(sel => {
      if (sel.groupIndex !== splitContext.groupIndex || sel.segmentIndex !== splitContext.segmentIndex) {
        return { ...sel };
      }
      return {
        groupIndex: sel.groupIndex,
        segmentIndex: sel.segmentIndex,
        pointIndex: remapIndex(sel.pointIndex)
      };
    });

    // 반전 후에는 인덱스가 작은 점을 새 시작점(빨강), 큰 점을 새 끝점(파랑)으로 고정한다.
    const targetSelections = selectedSelections.filter(sel =>
      sel.groupIndex === splitContext.groupIndex && sel.segmentIndex === splitContext.segmentIndex
    );
    if (targetSelections.length === 2) {
      targetSelections.sort((a, b) => a.pointIndex - b.pointIndex);
      selectedSelections = [targetSelections[0], targetSelections[1]];
    }

    if (selectedRect &&
      selectedRect.groupIndex === splitContext.groupIndex &&
      selectedRect.segmentIndex === splitContext.segmentIndex) {
      selectedRect = {
        groupIndex: selectedRect.groupIndex,
        segmentIndex: selectedRect.segmentIndex,
        pointIndex: remapIndex(selectedRect.pointIndex)
      };
    }

    renderGroups(currentGroups);

    const active = selectedRect
      ? currentGroups[selectedRect.groupIndex].segments[selectedRect.segmentIndex].points[selectedRect.pointIndex]
      : null;
    if (active) {
      updateClickInfo(active.x, active.y, {
        groupIndex: selectedRect.groupIndex,
        segmentIndex: selectedRect.segmentIndex,
        pointIndex: selectedRect.pointIndex,
        point: active,
        rect: active
      });
    }

    setStatus(
      `Indices 반전 완료: G${splitContext.groupIndex + 1}, S${splitContext.segmentIndex + 1}, P${startIndex}~P${endIndex} (새 시작점=빨강, 새 끝점=파랑)`,
      false
    );
  }

  function checkAdjacencyForwardFromSelectedPoint() {
    const context = getForwardAdjStartContext();
    if (!context) {
      setStatus('검사 실패: 시작점 1개를 선택하고(같은 선), 마지막 점이 아니어야 합니다.', true);
      return;
    }

    const group = currentGroups[context.groupIndex];
    const segment = group && group.segments[context.segmentIndex];
    if (!group || !segment || !Array.isArray(segment.points)) {
      setStatus('검사 실패: 선택된 세그먼트를 찾지 못했습니다.', true);
      return;
    }

    const startIndex = context.startIndex;
    const lastIndex = context.endIndex;

    let stopIndex = lastIndex;
    let firstNonAdjacentEdge = null;

    for (let i = startIndex; i < lastIndex; i++) {
      const a = segment.points[i];
      const b = segment.points[i + 1];

      if (!areRectsAdjacent(a, b)) {
        stopIndex = i + 1;
        firstNonAdjacentEdge = { from: i, to: i + 1 };
        break;
      }
    }

    const startSelection = {
      groupIndex: context.groupIndex,
      segmentIndex: context.segmentIndex,
      pointIndex: startIndex
    };
    const endSelection = {
      groupIndex: context.groupIndex,
      segmentIndex: context.segmentIndex,
      pointIndex: stopIndex
    };

    selectedSelections = [startSelection, endSelection];
    selectedRect = { ...endSelection };

    const additionalSelectedCount = Math.max(0, stopIndex - startIndex);
    const adjacentFoundCount = firstNonAdjacentEdge
      ? Math.max(0, firstNonAdjacentEdge.from - startIndex)
      : Math.max(0, lastIndex - startIndex);
    const adjacentFoundLabel = adjacentFoundCount === 0 ? '0점(❌)' : `${adjacentFoundCount}점`;

    renderGroups(currentGroups);

    const point = currentGroups[selectedRect.groupIndex].segments[selectedRect.segmentIndex].points[selectedRect.pointIndex];
    updateClickInfo(point.x, point.y, {
      groupIndex: selectedRect.groupIndex,
      segmentIndex: selectedRect.segmentIndex,
      pointIndex: selectedRect.pointIndex,
      point,
      rect: point
    });

    // '추가 선택 N점'은 시작점 다음 점부터 자동 선택된 끝점까지의 범위다.
    startForwardAdjAdditionalHighlight({
      groupIndex: context.groupIndex,
      segmentIndex: context.segmentIndex,
      startIndex: startIndex + 1,
      endIndex: stopIndex
    });

    const highlightedSummary = `<span class="status-inline-highlight">인접 발견 ${adjacentFoundLabel}, 총 추가선택 ${additionalSelectedCount}점.</span>`;

    if (firstNonAdjacentEdge) {
      setStatusHtml(
        `증가 인접 검사: P${startIndex}부터 검사 중 비인접 구간 P${firstNonAdjacentEdge.from}->P${firstNonAdjacentEdge.to} 발견. 끝점 P${stopIndex} 자동 선택 완료. ${highlightedSummary}`,
        false
      );
    } else {
      setStatusHtml(
        `증가 인접 검사: P${startIndex}부터 마지막 P${lastIndex}까지 모두 인접. 끝점 P${stopIndex} 자동 선택 완료. ${highlightedSummary}`,
        false
      );
    }
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

    if (event.key === 'Tab') {
      event.preventDefault();
      const switched = cycleToConnectedMergePoint(event.shiftKey);
      if (!switched) {
        setStatusHtml('<span class="status-inline-highlight">TAB 전환 대상이 없어 기본 TAB 이동을 막았습니다.</span>', true);
      }
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
          const isMergeConnectedPoint = isPointMergeConnected(group, segment.id, pointIndex);
          const isMergePoint = isMergeConnectedPoint || !!point.mergeState;

          if (isMergePoint && point.canConnect) {
            baseCtx.fillStyle = '#92afc7';
          } else if (isMergePoint) {
            baseCtx.fillStyle = 'rgba(255, 138, 0, 0.85)';
          } else if (point.canConnect) {
            baseCtx.fillStyle = 'rgba(34, 197, 94, 0.75)';
          } else {
            baseCtx.fillStyle = fill;
          }
          baseCtx.fillRect(point.x, point.y, point.size, point.size);

          if (isMergePoint) {
            baseCtx.strokeStyle = '#4c1d95';
          } else if (point.canConnect) {
            baseCtx.strokeStyle = '#d4af37';
          } else {
            baseCtx.strokeStyle = '#6b7280';
          }

          if (isPointInNamedHighlightRange(HIGHLIGHT_KEY_ADJ_RANGE, group, segment, pointIndex)) {
            baseCtx.strokeStyle = '#ff8c00';
          }

          if (isPointInNamedHighlightRange(HIGHLIGHT_KEY_FORWARD_ADDITIONAL, group, segment, pointIndex)) {
            baseCtx.strokeStyle = '#237881';
          }

          if (isPointInNamedHighlightRange(HIGHLIGHT_KEY_ADJ_FIRST_FAIL, group, segment, pointIndex)) {
            baseCtx.strokeStyle = '#062949';
          }

          if (isPointInNamedHighlightRange(HIGHLIGHT_KEY_TAB_SEGMENT, group, segment, pointIndex)) {
            baseCtx.strokeStyle = '#397255';
          }

          baseCtx.lineWidth = 1;
          baseCtx.strokeRect(point.x + 0.5, point.y + 0.5, point.size - 1, point.size - 1);

          if (isMergePoint && point.canConnect && point.size >= 3) {
            baseCtx.fillStyle = '#a5468d';
            baseCtx.fillRect(point.x + 1, point.y + 1, point.size - 2, point.size - 2);
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
    source.forEach((item, sourceIndex) => {
      if (!item || typeof item !== 'object') return;

      const x = Number(item.x);
      const y = Number(item.y);
      const size = Number(item.size);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size)) return;
      if (size <= 0) return;

      normalized.push({
        x: Math.round(x),
        y: Math.round(y),
        size: Math.round(size),
        canConnect: typeof item.canConnect === 'boolean' ? item.canConnect : false,
        mergeState: typeof item.mergeState === 'boolean' ? item.mergeState : false,
        sourceIndex,
        pointOrder: Number.isFinite(Number(item.pointOrder)) ? Number(item.pointOrder) : null,
        polylineId: typeof item.polylineId === 'string' ? item.polylineId : null
      });
    });

    return {
      points: normalized,
      source,
      hasCanConnectField: source.some(item => item && Object.prototype.hasOwnProperty.call(item, 'canConnect'))
    };
  }

  function createGroupFromImportedPayload(parsed, normalizedResult) {
    const points = normalizedResult && Array.isArray(normalizedResult.points) ? normalizedResult.points : [];
    const polylines = parsed && Array.isArray(parsed.polylines) ? parsed.polylines : null;

    if (!polylines || polylines.length === 0) {
      const fallbackPoints = points.map(point => ({ ...point }));
      if (fallbackPoints.length > 0 && !normalizedResult.hasCanConnectField) {
        fallbackPoints[0].canConnect = true;
        fallbackPoints[fallbackPoints.length - 1].canConnect = true;
      }
      return createGroupFromPoints(fallbackPoints);
    }

    const pointBySourceIndex = new Map();
    points.forEach(point => {
      pointBySourceIndex.set(point.sourceIndex, point);
    });

    const assignedSourceIndices = new Set();
    const segments = [];

    polylines.forEach(polyline => {
      let indices = [];
      if (Array.isArray(polyline.pointIndices)) {
        indices = polyline.pointIndices
          .map(value => Number(value))
          .filter(Number.isFinite)
          .map(value => Math.trunc(value));
      } else {
        const startIndex = Number(polyline && polyline.startIndex);
        const endIndex = Number(polyline && polyline.endIndex);
        if (Number.isFinite(startIndex) && Number.isFinite(endIndex)) {
          const start = Math.trunc(startIndex);
          const end = Math.trunc(endIndex);
          const step = start <= end ? 1 : -1;
          for (let idx = start; step > 0 ? idx <= end : idx >= end; idx += step) {
            indices.push(idx);
          }
        }
      }

      if (indices.length === 0) return;

      const seen = new Set();
      const segmentPoints = [];
      indices.forEach(idx => {
        if (seen.has(idx)) return;
        seen.add(idx);

        const point = pointBySourceIndex.get(idx);
        if (!point) return;

        assignedSourceIndices.add(idx);
        segmentPoints.push({ ...point });
      });

      if (segmentPoints.length === 0) return;

      if (!normalizedResult.hasCanConnectField) {
        segmentPoints[0].canConnect = true;
        segmentPoints[segmentPoints.length - 1].canConnect = true;
      }

      segments.push({
        id: createSegmentId(),
        points: segmentPoints.map(clonePoint)
      });
    });

    const unassignedPoints = points
      .filter(point => !assignedSourceIndices.has(point.sourceIndex))
      .sort((a, b) => a.sourceIndex - b.sourceIndex)
      .map(point => ({ ...point }));

    if (unassignedPoints.length > 0) {
      if (!normalizedResult.hasCanConnectField) {
        unassignedPoints[0].canConnect = true;
        unassignedPoints[unassignedPoints.length - 1].canConnect = true;
      }
      segments.push({
        id: createSegmentId(),
        points: unassignedPoints.map(clonePoint)
      });
    }

    if (segments.length === 0) {
      const fallbackPoints = points.map(point => ({ ...point }));
      if (fallbackPoints.length > 0 && !normalizedResult.hasCanConnectField) {
        fallbackPoints[0].canConnect = true;
        fallbackPoints[fallbackPoints.length - 1].canConnect = true;
      }
      return createGroupFromPoints(fallbackPoints);
    }

    return {
      id: createGroupId(),
      segments,
      connections: []
    };
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
    updateSplitButtonState();
    updateInsertStartButtonState();
    updateSplitByContactButtonState();
    updateReverseIndicesButtonState();
    updateCheckAdjRangeButtonState();
    updateSplitAdjRangeButtonState();
    updateCheckAdjForwardButtonState();
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

      const normalizedResult = normalizePoints(parsed);
      if (!normalizedResult) {
        setStatus('JSON 배열 형식이 아닙니다. [{x,y,size,...}] 형태가 필요합니다.', true);
        jsonOutput.value = JSON.stringify(parsed, null, 2);
        return;
      }

      const importedGroup = createGroupFromImportedPayload(parsed, normalizedResult);
      const nextGroups = currentGroups.concat([importedGroup]);
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

    const transferKey = `bg2-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const targetUrl = `blockGrider3.html?transferKey=${encodeURIComponent(transferKey)}`;
    let opened = false;

    try {
      localStorage.setItem(transferKey, text);
    } catch (error) {
      // Ignore storage errors and continue with best-effort open/post.
    }

    try {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = targetUrl;
      form.target = '_blank';
      form.style.display = 'none';

      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'payload';
      hidden.value = text;
      form.appendChild(hidden);

      document.body.appendChild(form);
      form.submit();
      form.remove();
      opened = true;
    } catch (error) {
      opened = false;
    }

    if (!opened) {
      const win = window.open(targetUrl, '_blank', 'noopener');
      opened = !!win;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus(
        `현재 구조 JSON 내보내기 완료: 그룹 ${currentGroups.length}개, 점 ${getTotalRectCount(currentGroups)}개 (클립보드 복사됨, blockGrider3 열기 ${opened ? '성공' : '실패'}).`,
        false
      );
    } catch (error) {
      setStatus(
        `현재 구조 JSON 내보내기 완료: 그룹 ${currentGroups.length}개, 점 ${getTotalRectCount(currentGroups)}개 (클립보드 복사는 실패, blockGrider3 열기 ${opened ? '성공' : '실패'}).`,
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

  if (btnSplitSegment) {
    btnSplitSegment.addEventListener('click', splitSelectedSegmentRange);
  }

  if (btnInsertStartFromPoint) {
    btnInsertStartFromPoint.addEventListener('click', insertStartPointFromOtherPolyline);
  }

  if (btnSplitByContact) {
    btnSplitByContact.addEventListener('click', splitPolylineByContactPoint);
  }

  if (btnReverseIndices) {
    btnReverseIndices.addEventListener('click', reverseIndicesInSelectedRange);
  }

  if (btnCheckAdjRange) {
    btnCheckAdjRange.addEventListener('click', checkAdjacencyInSelectedRange);
  }

  if (btnSplitAdjRange) {
    btnSplitAdjRange.addEventListener('click', splitAdjacentSelectedRange);
  }

  if (btnCheckAdjForward) {
    btnCheckAdjForward.addEventListener('click', checkAdjacencyForwardFromSelectedPoint);
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