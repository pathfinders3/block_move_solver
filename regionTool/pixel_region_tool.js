(function(){
  "use strict";

  const MAX_TAR_DIM = 8000; // 안전 상한: 확대 캔버스가 너무 커지는 것을 방지

  const srcCanvas = document.getElementById('srcCanvas');
  const tarCanvas = document.getElementById('tarCanvas');
  const emptyHintSrc = document.getElementById('emptyHintSrc');
  const zoomSelect = document.getElementById('zoomSelect');
  const sizeSelect = document.getElementById('sizeSelect');
  const toleranceInput = document.getElementById('toleranceInput');
  const infoSize = document.getElementById('infoSize');
  const infoSel = document.getElementById('infoSel');
  const infoCount = document.getElementById('infoCount');
  const statusLine = document.getElementById('statusLine');
  const clearRegionsBtn = document.getElementById('clearRegionsBtn');
  const resetAllBtn = document.getElementById('resetAllBtn');
  const statusOverlay = document.getElementById('statusOverlay');
  const statusOverlayContent = document.getElementById('statusOverlayContent');
  const statusCloseBtn = document.getElementById('statusCloseBtn');


  // ---------- controls population ----------

  // populate zoom select 2..16
  for(let z=2; z<=16; z++){
    const opt = document.createElement('option');
    opt.value = z;
    opt.textContent = z + '배';
    if(z===4) opt.selected = true;
    zoomSelect.appendChild(opt);
  }

  // populate square size select 1..18 (side length)
  for(let s=1; s<=18; s++){
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s + ' x ' + s;
    if(s===3) opt.selected = true;
    sizeSelect.appendChild(opt);
  }


  // ---------- pristine source canvas ----------

  const baseCanvas = document.createElement('canvas');
  const baseCtx = baseCanvas.getContext('2d', {
    willReadFrequently: true
  });


  const state = {
    img: null,
    width: 0,
    height: 0,
    zoom: parseInt(zoomSelect.value, 10),
    squareSize: parseInt(sizeSelect.value, 10),
    tolerance: parseInt(toleranceInput.value, 10),
    selection: null,          // {x,y,size}
    yellowRegions: [],        // [{x,y,size}]
    selectedRegionIndex: null,
    candidateSquares: [],     // Shift+F8 후보 목록 [{x,y,size}]
    selectedCandidateIndex: 0,
    candidateMode: null,      // 'expansion' | 'directional'
    candidateDirectionKey: null,
    candidateSizeGroups: [],  // 방향 후보를 size별로 나눈 목록 [{size, positions:[{x,y,size}]}]
    candidateGroupIndex: 0,
    expansionBaseRegionIndex: null,
    minChannelHighlight: null, // {points: [{x,y}], expiresAt}
    minChannelHighlightTimer: null,
    tolerancePassedHighlight: null, // {points: [{x,y}], expiresAt}
    tolerancePassedHighlightTimer: null,
    lowToleranceHighlight: null, // {points: [{x,y}], expiresAt}
    lowToleranceHighlightTimer: null,
    f2Marker: null, // {x, y, expiresAt}
    f2MarkerTimer: null
  };

  let hoverOriginalPixel = null;
  let lastValidOriginalPixel = null;
  let toastTimer = null;


  // ---------- IndexedDB persistence ----------

  function idbOpen(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open('pixelRegionToolDB', 1);

      req.onupgradeneeded = ()=>{
        req.result.createObjectStore('kv');
      };

      req.onsuccess = ()=>{
        resolve(req.result);
      };

      req.onerror = ()=>{
        reject(req.error);
      };
    });
  }


  async function idbSet(key, value){
    const db = await idbOpen();

    return new Promise((resolve, reject)=>{
      const tx = db.transaction('kv', 'readwrite');

      tx.objectStore('kv').put(value, key);

      tx.oncomplete = ()=>{
        resolve();
      };

      tx.onerror = ()=>{
        reject(tx.error);
      };
    });
  }


  async function idbGet(key){
    const db = await idbOpen();

    return new Promise((resolve, reject)=>{
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);

      req.onsuccess = ()=>{
        resolve(req.result);
      };

      req.onerror = ()=>{
        reject(req.error);
      };
    });
  }


  async function idbDelete(key){
    const db = await idbOpen();

    return new Promise((resolve, reject)=>{
      const tx = db.transaction('kv', 'readwrite');

      tx.objectStore('kv').delete(key);

      tx.oncomplete = ()=>{
        resolve();
      };

      tx.onerror = ()=>{
        reject(tx.error);
      };
    });
  }


  async function saveMeta(){
    try{
      await idbSet('meta', {
        zoom: state.zoom,
        squareSize: state.squareSize,
        tolerance: state.tolerance,
        yellowRegions: state.yellowRegions,
        width: state.width,
        height: state.height
      });
    }catch(e){
      /* ignore persistence errors */
    }
  }


  async function restoreOnLoad(){
    try{
      const blob = await idbGet('pastedImage');

      if(blob){
        await loadImageBlob(blob, false);

        const meta = await idbGet('meta');

        if(meta &&
           meta.width === state.width &&
           meta.height === state.height){

          state.zoom = clampZoomForSize(meta.zoom || state.zoom);
          state.squareSize = meta.squareSize || state.squareSize;
          state.tolerance =
            (meta.tolerance === undefined)
              ? state.tolerance
              : meta.tolerance;

          state.yellowRegions =
            Array.isArray(meta.yellowRegions)
              ? meta.yellowRegions
              : [];

          zoomSelect.value = state.zoom;
          sizeSelect.value = state.squareSize;
          toleranceInput.value = state.tolerance;
        }

        state.selection = {
          x: 0,
          y: 0,
          size: state.squareSize
        };

        render();

        setStatus(
          '이전 세션의 이미지를 불러왔습니다.',
          false
        );
      }

    }catch(e){
      /* no saved image, ignore */
    }
  }


  // ---------- image loading ----------

  function clampZoomForSize(z){
    if(!state.width || !state.height) return z;

    let maxZ = z;

    while(
      maxZ > 1 &&
      (
        state.width * maxZ > MAX_TAR_DIM ||
        state.height * maxZ > MAX_TAR_DIM
      )
    ){
      maxZ--;
    }

    return Math.max(1, Math.min(16, maxZ));
  }


  function loadImageBlob(blob, resetRegions){
    return new Promise((resolve, reject)=>{

      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = ()=>{

        state.img = img;
        state.width = img.naturalWidth;
        state.height = img.naturalHeight;


        baseCanvas.width = state.width;
        baseCanvas.height = state.height;

        baseCtx.imageSmoothingEnabled = false;

        baseCtx.clearRect(
          0,
          0,
          state.width,
          state.height
        );

        baseCtx.drawImage(
          img,
          0,
          0
        );


        const safeZoom = clampZoomForSize(state.zoom);

        if(safeZoom !== state.zoom){
          state.zoom = safeZoom;
          zoomSelect.value = safeZoom;

          setStatus(
            '이미지가 커서 확대 배율을 ' +
            safeZoom +
            '배로 제한했습니다.',
            true
          );
        }


        if(resetRegions){
          state.yellowRegions = [];
          state.selectedRegionIndex = null;

          state.selection = {
            x: 0,
            y: 0,
            size: state.squareSize
          };
        }


        emptyHintSrc.style.display = 'none';

        URL.revokeObjectURL(url);

        resolve();
      };

      img.onerror = reject;
      img.src = url;
    });
  }


  // ---------- rendering ----------

  function drawRegionsOn(ctx, scale){

    state.yellowRegions.forEach((r, idx)=>{

      const selected =
        (idx === state.selectedRegionIndex);

      ctx.fillStyle =
        selected
          ? '#ffb84d'
          : '#f4d35e';

      ctx.fillRect(
        r.x * scale,
        r.y * scale,
        r.size * scale,
        r.size * scale
      );


      if(selected){

        ctx.lineWidth =
          Math.max(2, scale / 3);

        ctx.strokeStyle = '#ff6b6b';

        ctx.strokeRect(
          r.x * scale + ctx.lineWidth / 2,
          r.y * scale + ctx.lineWidth / 2,
          r.size * scale - ctx.lineWidth,
          r.size * scale - ctx.lineWidth
        );
      }
    });
  }


  function drawSelectionOn(ctx, scale){

    if(!state.selection) return;

    const s = state.selection;

    const displayX = s.x * scale;
    const displayY = s.y * scale;
    const displaySize = s.size * scale;


    // 선택 영역 자체를 확대 배율에 맞춰 표시한다.
    ctx.fillStyle = 'rgba(94, 230, 200, 0.16)';

    ctx.fillRect(
      displayX,
      displayY,
      displaySize,
      displaySize
    );


    // 테두리를 영역 바깥쪽에 그려 내부 픽셀이 가려지지 않게 한다.
    ctx.fillStyle = '#5ee6c8';

    ctx.fillRect(
      displayX - 1,
      displayY - 1,
      displaySize + 2,
      1
    );

    ctx.fillRect(
      displayX - 1,
      displayY + displaySize,
      displaySize + 2,
      1
    );

    ctx.fillRect(
      displayX - 1,
      displayY - 1,
      1,
      displaySize + 2
    );

    ctx.fillRect(
      displayX + displaySize,
      displayY - 1,
      1,
      displaySize + 2
    );
  }


  function clearMinChannelHighlight(){
    state.minChannelHighlight = null;

    if(state.minChannelHighlightTimer){
      clearTimeout(state.minChannelHighlightTimer);
      state.minChannelHighlightTimer = null;
    }
  }


  function scheduleMinChannelHighlight(points, durationMs){
    const highlightPoints = Array.isArray(points)
      ? points
      : [{ x: points.x, y: points.y }];

    if(state.minChannelHighlightTimer){
      clearTimeout(state.minChannelHighlightTimer);
    }

    state.minChannelHighlight = {
      points: highlightPoints,
      expiresAt: Date.now() + durationMs
    };

    state.minChannelHighlightTimer = setTimeout(()=>{
      state.minChannelHighlight = null;
      state.minChannelHighlightTimer = null;
      render();
    }, durationMs);
  }


  function drawMinChannelHighlightOn(ctx, scale){
    if(!state.minChannelHighlight) return;

    const now = Date.now();

    if(now > state.minChannelHighlight.expiresAt){
      state.minChannelHighlight = null;
      return;
    }

    for(const pixel of state.minChannelHighlight.points || []){
      const px = pixel.x;
      const py = pixel.y;
      const displayX = px * scale;
      const displayY = py * scale;

      ctx.fillStyle = 'rgba(94, 230, 200, 0.32)';
      ctx.fillRect(
        displayX,
        displayY,
        scale,
        scale
      );

      ctx.strokeStyle = '#5ee6c8';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        displayX + 0.5,
        displayY + 0.5,
        Math.max(scale - 1, 1),
        Math.max(scale - 1, 1)
      );
    }
  }


  function clearTolerancePassedHighlight(){
    state.tolerancePassedHighlight = null;

    if(state.tolerancePassedHighlightTimer){
      clearTimeout(state.tolerancePassedHighlightTimer);
      state.tolerancePassedHighlightTimer = null;
    }
  }


  function scheduleTolerancePassedHighlight(points, durationMs){
    const highlightPoints = Array.isArray(points)
      ? points
      : [{ x: points.x, y: points.y }];

    if(state.tolerancePassedHighlightTimer){
      clearTimeout(state.tolerancePassedHighlightTimer);
    }

    state.tolerancePassedHighlight = {
      points: highlightPoints,
      expiresAt: Date.now() + durationMs
    };

    state.tolerancePassedHighlightTimer = setTimeout(()=>{
      state.tolerancePassedHighlight = null;
      state.tolerancePassedHighlightTimer = null;
      render();
    }, durationMs);
  }


  function drawTolerancePassedHighlightOn(ctx, scale){
    if(!state.tolerancePassedHighlight) return;

    const now = Date.now();

    if(now > state.tolerancePassedHighlight.expiresAt){
      state.tolerancePassedHighlight = null;
      return;
    }

    for(const pixel of state.tolerancePassedHighlight.points || []){
      const px = pixel.x;
      const py = pixel.y;
      const displayX = px * scale;
      const displayY = py * scale;

      ctx.fillStyle = 'rgba(255, 123, 182, 0.28)';
      ctx.fillRect(
        displayX,
        displayY,
        scale,
        scale
      );

      ctx.strokeStyle = '#ff7bb6';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        displayX + 0.5,
        displayY + 0.5,
        Math.max(scale - 1, 1),
        Math.max(scale - 1, 1)
      );
    }
  }


  function clearLowToleranceHighlight(){
    state.lowToleranceHighlight = null;

    if(state.lowToleranceHighlightTimer){
      clearTimeout(state.lowToleranceHighlightTimer);
      state.lowToleranceHighlightTimer = null;
    }
  }


  function scheduleLowToleranceHighlight(points, durationMs){
    const highlightPoints = Array.isArray(points)
      ? points
      : [{ x: points.x, y: points.y }];

    if(state.lowToleranceHighlightTimer){
      clearTimeout(state.lowToleranceHighlightTimer);
    }

    state.lowToleranceHighlight = {
      points: highlightPoints,
      expiresAt: Date.now() + durationMs
    };

    state.lowToleranceHighlightTimer = setTimeout(()=>{
      state.lowToleranceHighlight = null;
      state.lowToleranceHighlightTimer = null;
      render();
    }, durationMs);
  }


  function drawLowToleranceHighlightOn(ctx, scale){
    if(!state.lowToleranceHighlight) return;

    const now = Date.now();

    if(now > state.lowToleranceHighlight.expiresAt){
      state.lowToleranceHighlight = null;
      return;
    }

    for(const pixel of state.lowToleranceHighlight.points || []){
      const px = pixel.x;
      const py = pixel.y;
      const displayX = px * scale;
      const displayY = py * scale;

      ctx.fillStyle = 'rgba(99, 67, 44, 0.36)';
      ctx.fillRect(
        displayX,
        displayY,
        scale,
        scale
      );

      ctx.strokeStyle = '#5a3527';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        displayX + 0.5,
        displayY + 0.5,
        Math.max(scale - 1, 1),
        Math.max(scale - 1, 1)
      );
    }
  }


  function scheduleF2Marker(x, y, durationMs){
    if(state.f2MarkerTimer){
      clearTimeout(state.f2MarkerTimer);
    }

    state.f2Marker = {
      x,
      y,
      expiresAt: Date.now() + durationMs
    };

    state.f2MarkerTimer = setTimeout(()=>{
      state.f2Marker = null;
      state.f2MarkerTimer = null;
      render();
    }, durationMs);
  }


  function drawF2MarkerOn(ctx, scale){
    if(!state.f2Marker) return;

    const now = Date.now();

    if(now > state.f2Marker.expiresAt){
      state.f2Marker = null;
      return;
    }

    const x = state.f2Marker.x;
    const y = state.f2Marker.y;
    const displayX = x * scale;
    const displayY = y * scale;

    const markerSize = Math.max(5, scale);

    ctx.strokeStyle = '#ff6100';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      displayX + 0.5,
      displayY + 0.5,
      markerSize - 1,
      markerSize - 1
    );
  }


  function drawCandidateSquaresOn(ctx, scale){

    if(state.candidateSquares.length === 0) return;

    state.candidateSquares.forEach((c, idx)=>{

      const isSelected =
        idx === state.selectedCandidateIndex;

      const displayX = c.x * scale;
      const displayY = c.y * scale;
      const displaySize = c.size * scale;

      ctx.fillStyle =
        isSelected
          ? 'rgba(255, 107, 107, 0.86)'
          : 'rgba(138, 180, 255, 0.16)';

      ctx.fillRect(
        displayX,
        displayY,
        displaySize,
        displaySize
      );

      // 후보 테두리도 영역 바깥쪽에 그려 내부 픽셀을 가리지 않는다.
      ctx.fillStyle =
        isSelected
          ? '#ff6b6b'
          : '#8ab4ff';

      ctx.fillRect(
        displayX - 1,
        displayY - 1,
        displaySize + 2,
        1
      );

      ctx.fillRect(
        displayX - 1,
        displayY + displaySize,
        displaySize + 2,
        1
      );

      ctx.fillRect(
        displayX - 1,
        displayY - 1,
        1,
        displaySize + 2
      );

      ctx.fillRect(
        displayX + displaySize,
        displayY - 1,
        1,
        displaySize + 2
      );
    });
  }


  function render(){

    if(!state.img) return;


    // =====================================================
    // src canvas
    // 원본은 1:1
    // =====================================================

    srcCanvas.width = state.width;
    srcCanvas.height = state.height;

    // Canvas 내부 픽셀뿐 아니라 CSS 표시 크기도 1:1로 고정
    srcCanvas.style.width = state.width + 'px';
    srcCanvas.style.height = state.height + 'px';

    const sctx = srcCanvas.getContext('2d');

    sctx.imageSmoothingEnabled = false;

    sctx.clearRect(
      0,
      0,
      state.width,
      state.height
    );

    sctx.drawImage(
      baseCanvas,
      0,
      0
    );

    drawRegionsOn(sctx, 1);
    drawSelectionOn(sctx, 1);
    drawMinChannelHighlightOn(sctx, 1);
    drawTolerancePassedHighlightOn(sctx, 1);
    drawLowToleranceHighlightOn(sctx, 1);
    drawF2MarkerOn(sctx, 1);
    drawCandidateSquaresOn(sctx, 1);


    // =====================================================
    // tar canvas
    // 원본 픽셀 하나 = zoom × zoom 화면 픽셀
    // =====================================================

    const z = state.zoom;

    const tarWidth = state.width * z;
    const tarHeight = state.height * z;


    // Canvas 내부 해상도
    tarCanvas.width = tarWidth;
    tarCanvas.height = tarHeight;


    // ★ 중요:
    // Canvas의 CSS 표시 크기도 내부 해상도와 동일하게 설정한다.
    //
    // 예:
    // 원본 100x100, zoom=2
    // -> Canvas 내부: 200x200
    // -> 화면 표시:   200x200
    //
    // 따라서 원본 1x1 픽셀은 화면에서 정확히 2x2가 된다.
    tarCanvas.style.width = tarWidth + 'px';
    tarCanvas.style.height = tarHeight + 'px';


    const tctx = tarCanvas.getContext('2d');

    tctx.imageSmoothingEnabled = false;

    tctx.clearRect(
      0,
      0,
      tarWidth,
      tarHeight
    );


    // 원본 이미지를 확대하여 그린다.
    tctx.drawImage(
      baseCanvas,
      0,
      0,
      state.width,
      state.height,
      0,
      0,
      tarWidth,
      tarHeight
    );


    // 노란 영역 역시 zoom 배율로 표시
    drawRegionsOn(tctx, z);

    // 선택 영역 역시 zoom 배율로 표시
    drawSelectionOn(tctx, z);
    drawMinChannelHighlightOn(tctx, z);
    drawTolerancePassedHighlightOn(tctx, z);
    drawLowToleranceHighlightOn(tctx, z);
    drawF2MarkerOn(tctx, z);
    drawCandidateSquaresOn(tctx, z);


    updateInfo();
  }


  function updateInfo(){

    infoSize.textContent =
      state.img
        ? (state.width + ' x ' + state.height)
        : '-';

    infoSel.textContent =
      state.selection
        ? (
            '(' +
            state.selection.x +
            ', ' +
            state.selection.y +
            ') ' +
            state.selection.size +
            'x' +
            state.selection.size
          )
        : '-';

    infoCount.textContent =
      state.yellowRegions.length;
  }


  function setStatus(msg, isWarn, detailText){

    statusLine.textContent = msg;
    statusLine.dataset.fullText = (detailText !== undefined ? detailText : msg) || '';

    statusLine.className =
      'status' +
      (isWarn ? ' warn' : '');
  }


  function showToast(msg, isWarn){
    const container = document.getElementById('toastContainer');

    if(!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast' + (isWarn ? ' warn' : '');
    toast.textContent = msg;

    container.appendChild(toast);

    requestAnimationFrame(()=>{
      toast.classList.add('visible');
    });

    if(toastTimer){
      clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(()=>{
      toast.classList.remove('visible');
      setTimeout(()=>{
        toast.remove();
      }, 220);
    }, 5000);
  }


  function openStatusOverlay(){
    const msg = statusLine.dataset.fullText || statusLine.textContent || '';

    if(!msg.trim()) return;

    statusOverlayContent.textContent = msg.replace(/\s*\|\s*/g, '\n');
    statusOverlay.classList.add('open');
    statusOverlay.setAttribute('aria-hidden', 'false');
  }


  function closeStatusOverlay(){
    statusOverlay.classList.remove('open');
    statusOverlay.setAttribute('aria-hidden', 'true');
  }


  function updateChannelStatsDisplay(text){
    // 하단 보조 메시지 영역 제거로 더 이상 사용하지 않음.
  }


  function getActiveStatsRegion(){
    if(state.selection){
      return {
        x: state.selection.x,
        y: state.selection.y,
        size: state.selection.size
      };
    }

    if(
      state.selectedRegionIndex !== null &&
      state.yellowRegions[state.selectedRegionIndex]
    ){
      return state.yellowRegions[state.selectedRegionIndex];
    }

    return null;
  }


  function getRelationToRecentYellowRegion(region){
    const recent =
      state.yellowRegions.length > 0
        ? state.yellowRegions[state.yellowRegions.length - 1]
        : null;

    if(!recent) return { label: 'unknown', distance: null };

    const aLeft = region.x;
    const aRight = region.x + region.size;
    const aTop = region.y;
    const aBottom = region.y + region.size;

    const bLeft = recent.x;
    const bRight = recent.x + recent.size;
    const bTop = recent.y;
    const bBottom = recent.y + recent.size;

    const overlapsOrTouches =
      aLeft <= bRight &&
      bLeft <= aRight &&
      aTop <= bBottom &&
      bTop <= aBottom;

    const distance = Math.hypot(
      (aLeft + aRight) / 2 - (bLeft + bRight) / 2,
      (aTop + aBottom) / 2 - (bTop + bBottom) / 2
    );

    const label = overlapsOrTouches ? 'near' : 'far';

    return { label, distance };
  }


  function getExpandedSquares(x, y, n){
    return [
      { x: x - 1, y: y - 1 },
      { x: x - 1, y: y },
      { x: x, y: y - 1 },
      { x: x, y: y }
    ];
  }


  function getOriginalPixelInfo(x, y){
    const pixel = baseCtx.getImageData(x, y, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];

    return {
      x,
      y,
      r,
      g,
      b,
      value: Math.min(r, g, b)
    };
  }


  function getExpansionStatusForRegion(region, step = 1){
    const nextSize = region.size + step;
    const baseSquares = getExpandedSquares(region.x, region.y, region.size);
    const results = [];

    const directionLabels = [
      '좌상단',
      '좌하단',
      '우상단',
      '우하단'
    ];

    for(let i = 0; i < baseSquares.length; i++){
      const anchor = baseSquares[i];
      const x = anchor.x;
      const y = anchor.y;
      const withinBounds =
        x >= 0 &&
        y >= 0 &&
        x + nextSize <= state.width &&
        y + nextSize <= state.height;

      let canExpand = false;
      let reason = '범위 밖';
      let failingPixels = [];

      if(withinBounds){
        canExpand = true;

        for(let yy = 0; yy < nextSize; yy++){
          for(let xx = 0; xx < nextSize; xx++){
            const px = x + xx;
            const py = y + yy;
            const info = getOriginalPixelInfo(px, py);

            if(!(info.r >= state.tolerance && info.g >= state.tolerance && info.b >= state.tolerance)){
              canExpand = false;
              reason = '색상 불일치';
              failingPixels.push(info);
            }
          }
        }
      }

      results.push({
        label: directionLabels[i],
        x,
        y,
        size: nextSize,
        canExpand,
        reason,
        failingPixels
      });
    }

    return results;
  }


  function getRegionChannelStats(region){
    if(!region) return null;

    const data =
      baseCtx.getImageData(
        region.x,
        region.y,
        region.size,
        region.size
      ).data;

    let minChannel = 255;
    let maxChannel = 0;
    let minPixels = [];
    let passedTolerancePixels = [];
    let underTolerancePixels = [];

    for(let y = 0; y < region.size; y++){
      for(let x = 0; x < region.size; x++){
        const idx = ((y * region.size + x) * 4);
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const pixelMin = Math.min(r, g, b);
        const pixelMax = Math.max(r, g, b);

        if(pixelMin < minChannel){
          minChannel = pixelMin;
          minPixels = [{ x: region.x + x, y: region.y + y, value: pixelMin, r, g, b }];
        }else if(pixelMin === minChannel){
          minPixels.push({ x: region.x + x, y: region.y + y, value: pixelMin, r, g, b });
        }

        if(r >= state.tolerance && g >= state.tolerance && b >= state.tolerance){
          passedTolerancePixels.push({ x: region.x + x, y: region.y + y, r, g, b, value: Math.min(r, g, b) });
        }

        if(r < state.tolerance || g < state.tolerance || b < state.tolerance){
          underTolerancePixels.push({ x: region.x + x, y: region.y + y, r, g, b, value: Math.min(r, g, b) });
        }

        if(pixelMax > maxChannel) maxChannel = pixelMax;
      }
    }

    const minPixel = minPixels[0] || null;

    return { minChannel, maxChannel, minPixel, minPixels, passedTolerancePixels, underTolerancePixels };
  }


  function clearCandidateSquares(){
    state.candidateSquares = [];
    state.selectedCandidateIndex = 0;
    state.candidateMode = null;
    state.candidateDirectionKey = null;
    state.candidateSizeGroups = [];
    state.candidateGroupIndex = 0;
    state.expansionBaseRegionIndex = null;
  }


  function getRegionCenter(region){
    return {
      x: region.x + region.size / 2,
      y: region.y + region.size / 2
    };
  }


  function formatCartesianAngleSummary(fromRegion, toRegion){
    if(!fromRegion || !toRegion) return '';

    const fromCenter = getRegionCenter(fromRegion);
    const toCenter = getRegionCenter(toRegion);
    const dx = toCenter.x - fromCenter.x;
    const dy = -(toCenter.y - fromCenter.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angleDeg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;

    let arrow = '→';

    if(angleDeg >= 337.5 || angleDeg < 22.5){
      arrow = '→';
    }else if(angleDeg >= 22.5 && angleDeg < 67.5){
      arrow = '↗';
    }else if(angleDeg >= 67.5 && angleDeg < 112.5){
      arrow = '↑';
    }else if(angleDeg >= 112.5 && angleDeg < 157.5){
      arrow = '↖';
    }else if(angleDeg >= 157.5 && angleDeg < 202.5){
      arrow = '←';
    }else if(angleDeg >= 202.5 && angleDeg < 247.5){
      arrow = '↙';
    }else if(angleDeg >= 247.5 && angleDeg < 292.5){
      arrow = '↓';
    }else if(angleDeg >= 292.5 && angleDeg < 337.5){
      arrow = '↘';
    }

    return ' | 기준 각도: ' + angleDeg.toFixed(1) + '° ' + arrow + ' | 거리=' + distance.toFixed(1) + 'px';
  }


  function getDirectionVector(directionKey){
    switch(directionKey){
      case 'Q': return { x: -1, y: -1, label: '위왼쪽' };
      case 'W': return { x: 0, y: -1, label: '위' };
      case 'E': return { x: 1, y: -1, label: '위오른쪽' };
      case 'A': return { x: -1, y: 0, label: '왼쪽' };
      case 'D': return { x: 1, y: 0, label: '오른쪽' };
      case 'Z': return { x: -1, y: 1, label: '아래왼쪽' };
      case 'X': return { x: 0, y: 1, label: '아래' };
      case 'C': return { x: 1, y: 1, label: '아래오른쪽' };
      default: return null;
    }
  }


  function squaresTouchOrCorner(base, candidate){
    const baseX2 = base.x + base.size;
    const baseY2 = base.y + base.size;
    const candidateX2 = candidate.x + candidate.size;
    const candidateY2 = candidate.y + candidate.size;

    const touchX = candidate.x <= baseX2 && candidateX2 >= base.x;
    const touchY = candidate.y <= baseY2 && candidateY2 >= base.y;

    const overlapX = candidate.x < baseX2 && candidateX2 > base.x;
    const overlapY = candidate.y < baseY2 && candidateY2 > base.y;

    return touchX && touchY && !(overlapX && overlapY);
  }


  function squaresOverlap(base, candidate){
    const baseX2 = base.x + base.size;
    const baseY2 = base.y + base.size;
    const candidateX2 = candidate.x + candidate.size;
    const candidateY2 = candidate.y + candidate.size;

    return (
      candidate.x < baseX2 &&
      candidateX2 > base.x &&
      candidate.y < baseY2 &&
      candidateY2 > base.y
    );
  }


  function directionMatchesCandidate(base, candidate, directionKey){
    const baseCenter = getRegionCenter(base);
    const candidateCenter = getRegionCenter(candidate);
    const dx = candidateCenter.x - baseCenter.x;
    const dy = candidateCenter.y - baseCenter.y;

    switch(directionKey){
      case 'Q': return dx < 0 && dy < 0;
      case 'W': return dy < 0;
      case 'E': return dx > 0 && dy < 0;
      case 'A': return dx < 0;
      case 'D': return dx > 0;
      case 'Z': return dx < 0 && dy > 0;
      case 'X': return dy > 0;
      case 'C': return dx > 0 && dy > 0;
      default: return false;
    }
  }


  function directionAlignmentScore(base, candidate, directionKey){
    const dir = getDirectionVector(directionKey);

    if(!dir) return -Infinity;

    const baseCenter = getRegionCenter(base);
    const candidateCenter = getRegionCenter(candidate);
    const vx = candidateCenter.x - baseCenter.x;
    const vy = candidateCenter.y - baseCenter.y;
    const magnitude = Math.hypot(vx, vy);

    if(magnitude === 0) return 1;

    const dirMagnitude = Math.hypot(dir.x, dir.y);

    return (
      (vx * dir.x + vy * dir.y) /
      (magnitude * dirMagnitude)
    );
  }


  function getAttachPositionsForSize(x, y, baseSize, candidateSize, direction){
    const positions = [];

    switch(direction){
      case 'down':
        for(let newX = x - baseSize; newX <= x + baseSize; newX++){
          positions.push({ x: newX, y: y + baseSize });
        }
        break;

      case 'up':
        for(let newX = x - baseSize; newX <= x + baseSize; newX++){
          positions.push({ x: newX, y: y - candidateSize });
        }
        break;

      case 'right':
        for(let newY = y - baseSize; newY <= y + baseSize; newY++){
          positions.push({ x: x + baseSize, y: newY });
        }
        break;

      case 'left':
        for(let newY = y - baseSize; newY <= y + baseSize; newY++){
          positions.push({ x: x - baseSize, y: newY });
        }
        break;

      default:
        throw new Error('알 수 없는 방향: ' + direction);
    }

    return positions.filter((pos)=>
      pos.x >= 0 &&
      pos.y >= 0 &&
      pos.x + candidateSize <= state.width &&
      pos.y + candidateSize <= state.height
    );
  }


  function getAttachPositions(x, y, n, direction){
    return getAttachPositionsForSize(x, y, n, n, direction);
  }


  function isSquareWithinTolerance(x, y, size){
    if(
      x < 0 ||
      y < 0 ||
      x + size > state.width ||
      y + size > state.height
    ){
      return false;
    }

    const image = baseCtx.getImageData(x, y, size, size).data;

    for(let i = 0; i < image.length; i += 4){
      const r = image[i];
      const g = image[i + 1];
      const b = image[i + 2];

      if(
        r < state.tolerance ||
        g < state.tolerance ||
        b < state.tolerance
      ){
        return false;
      }
    }

    return true;
  }


  function getValidAttachPositionsForDirection(baseRegion, directionKey){
    const directionMap = {
      W: 'up',
      X: 'down',
      A: 'left',
      D: 'right'
    };

    const direction = directionMap[directionKey];

    if(!direction){
      return [];
    }

    const minSize = 2;
    const maxSize = Math.max(minSize, baseRegion.size * 2);
    const attempts = [];

    for(let size = maxSize; size >= minSize; size--){
      const positions = getAttachPositionsForSize(
        baseRegion.x,
        baseRegion.y,
        baseRegion.size,
        size,
        direction
      ).filter((pos)=>
        isSquareWithinTolerance(pos.x, pos.y, size)
      );

      attempts.push({
        size,
        positions: positions.map((pos)=>({ ...pos, size }))
      });
    }

    return attempts;
  }


  // ---------- paste handling ----------

  window.addEventListener('paste', async (e)=>{

    const items =
      e.clipboardData &&
      e.clipboardData.items;

    if(!items) return;

    for(const item of items){

      if(
        item.type &&
        item.type.startsWith('image/')
      ){

        const blob = item.getAsFile();

        if(!blob) continue;

        e.preventDefault();

        try{

          await loadImageBlob(blob, true);

          clearCandidateSquares();

          render();

          setStatus(
            '이미지를 붙여넣었습니다.',
            false
          );

          try{

            await idbSet(
              'pastedImage',
              blob
            );

            await saveMeta();

          }catch(err){

            setStatus(
              '이미지를 저장하지 못했습니다 ' +
              '(용량 제한일 수 있음). ' +
              '새로고침 시 사라질 수 있습니다.',
              true
            );
          }

        }catch(err){

          setStatus(
            '이미지를 불러오는 데 실패했습니다.',
            true
          );
        }

        break;
      }
    }
  });


  // ---------- controls ----------

  zoomSelect.addEventListener('change', ()=>{

    let z =
      parseInt(
        zoomSelect.value,
        10
      );

    const safe =
      clampZoomForSize(z);

    if(safe !== z){

      zoomSelect.value = safe;

      setStatus(
        '이미지가 커서 확대 배율을 ' +
        safe +
        '배로 제한했습니다.',
        true
      );
    }

    state.zoom = safe;

    render();

    saveMeta();
  });


  sizeSelect.addEventListener('change', ()=>{

    state.squareSize =
      parseInt(
        sizeSelect.value,
        10
      );

    if(state.selection && state.img){

      state.selection.size =
        state.squareSize;

      state.selection.x =
        Math.min(
          state.selection.x,
          Math.max(
            0,
            state.width -
            state.squareSize
          )
        );

      state.selection.y =
        Math.min(
          state.selection.y,
          Math.max(
            0,
            state.height -
            state.squareSize
          )
        );
    }

      clearCandidateSquares();

    render();

    saveMeta();
  });


  toleranceInput.addEventListener('change', ()=>{

    let v =
      parseInt(
        toleranceInput.value,
        10
      );

    if(isNaN(v)) v = 255;

    v =
      Math.max(
        0,
        Math.min(255, v)
      );

    toleranceInput.value = v;

    state.tolerance = v;

    clearCandidateSquares();

    render();

    saveMeta();
  });


  clearRegionsBtn.addEventListener('click', ()=>{

    state.yellowRegions = [];
    state.selectedRegionIndex = null;
    clearCandidateSquares();

    render();

    saveMeta();

    setStatus(
      '모든 노란 영역을 해제했습니다.',
      false
    );
  });


  resetAllBtn.addEventListener('click', async ()=>{

    if(
      !confirm(
        '저장된 이미지와 모든 노란 영역 데이터를 삭제할까요?'
      )
    ) return;

    state.img = null;
    state.width = 0;
    state.height = 0;
    state.yellowRegions = [];
    state.selection = null;
    state.selectedRegionIndex = null;
    clearCandidateSquares();

    srcCanvas.width = 1;
    srcCanvas.height = 1;

    tarCanvas.width = 1;
    tarCanvas.height = 1;

    // 초기화 후 CSS 크기도 원상복구
    srcCanvas.style.width = '1px';
    srcCanvas.style.height = '1px';

    tarCanvas.style.width = '1px';
    tarCanvas.style.height = '1px';

    emptyHintSrc.style.display = 'block';

    updateInfo();

    try{
      await idbDelete('pastedImage');
    }catch(e){}

    try{
      await idbDelete('meta');
    }catch(e){}

    setStatus(
      '초기화되었습니다.',
      false
    );
  });


  function getOriginalPixelFromCanvasEvent(e){
    if(!state.img) return null;

    const rect =
      tarCanvas.getBoundingClientRect();

    const scaleX =
      tarCanvas.width / rect.width;

    const scaleY =
      tarCanvas.height / rect.height;

    const cx =
      (e.clientX - rect.left) *
      scaleX;

    const cy =
      (e.clientY - rect.top) *
      scaleY;

    const px =
      Math.floor(
        cx / state.zoom
      );

    const py =
      Math.floor(
        cy / state.zoom
      );

    if(
      px < 0 || py < 0 ||
      px >= state.width || py >= state.height
    ){
      return null;
    }

    return { x: px, y: py };
  }


  statusLine.addEventListener('click', (e)=>{
    e.stopPropagation();
    openStatusOverlay();
  });

  statusCloseBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    closeStatusOverlay();
  });

  statusOverlay.addEventListener('click', (e)=>{
    if(e.target === statusOverlay){
      closeStatusOverlay();
    }
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && statusOverlay.classList.contains('open')){
      closeStatusOverlay();
    }
  });

  tarCanvas.addEventListener('mousemove', (e)=>{
    const point = getOriginalPixelFromCanvasEvent(e);
    hoverOriginalPixel = point;
  });

  tarCanvas.addEventListener('mouseleave', ()=>{
    hoverOriginalPixel = null;
  });


  // ---------- click on tarCanvas ----------

  tarCanvas.addEventListener('click', (e)=>{

    if(!state.img) return;

    const pointer = getOriginalPixelFromCanvasEvent(e);

    if(!pointer) return;

    const px = pointer.x;
    const py = pointer.y;


    const idx =
      state.yellowRegions.findIndex(r =>
        px >= r.x &&
        px < r.x + r.size &&
        py >= r.y &&
        py < r.y + r.size
      );


    if(idx >= 0){

      const targetRegion = state.yellowRegions[idx];
      const prevRegion = idx > 0 ? state.yellowRegions[idx - 1] : null;
      const selfAngleText = ' | 자기 자신 기준: 0°';
      const prevAngleText = prevRegion
        ? formatCartesianAngleSummary(targetRegion, prevRegion)
        : ' | 이전 노란 영역 없음';

      state.selectedRegionIndex = idx;
      state.selection = {
        x: targetRegion.x,
        y: targetRegion.y,
        size: targetRegion.size
      };
      clearCandidateSquares();

      setStatus(
        '노란 영역 선택: [' + idx + ']' +
        ' | (' + targetRegion.x + ', ' + targetRegion.y + ') ' +
        targetRegion.size + 'x' + targetRegion.size +
        selfAngleText +
        prevAngleText +
        ' | Delete 키로 삭제가능.',
        false
      );

    }else{

      state.selectedRegionIndex = null;

      const size =
        state.squareSize;

      const x =
        Math.min(
          Math.max(px, 0),
          Math.max(
            0,
            state.width - size
          )
        );

      const y =
        Math.min(
          Math.max(py, 0),
          Math.max(
            0,
            state.height - size
          )
        );

      state.selection = {
        x,
        y,
        size
      };

      clearCandidateSquares();

      setStatus(
        '선택 영역을 이동했습니다.',
        false
      );
    }

    render();
  });


  // ---------- keyboard ----------

  function isTypingTarget(el){

    return el &&
      (
        el.tagName === 'INPUT' ||
        el.tagName === 'SELECT' ||
        el.tagName === 'TEXTAREA'
      );
  }


  function moveSelection(dx, dy){

    if(
      !state.selection ||
      !state.img
    ) return;

    const s =
      state.selection;

    s.x =
      Math.min(
        Math.max(
          s.x + dx,
          0
        ),
        Math.max(
          0,
          state.width - s.size
        )
      );

    s.y =
      Math.min(
        Math.max(
          s.y + dy,
          0
        ),
        Math.max(
          0,
          state.height - s.size
        )
      );

    clearCandidateSquares();

    render();
  }


  function moveF2Marker(dx, dy){
    if(!lastValidOriginalPixel || !state.img) return;

    const nextX = Math.min(
      Math.max(lastValidOriginalPixel.x + dx, 0),
      Math.max(0, state.width - 1)
    );

    const nextY = Math.min(
      Math.max(lastValidOriginalPixel.y + dy, 0),
      Math.max(0, state.height - 1)
    );

    lastValidOriginalPixel = { x: nextX, y: nextY };
    hoverOriginalPixel = { x: nextX, y: nextY };

    const pixel = baseCtx.getImageData(nextX, nextY, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const minValue = Math.min(r, g, b);

    scheduleF2Marker(nextX, nextY, 25000);
    setStatus(
      'F2 마커 이동: 원본 좌표=(' + nextX + ', ' + nextY + ') | RGB=(' + r + ', ' + g + ', ' + b + ') | min=' + minValue,
      false
    );
    render();
  }


  function getExpansionBaseRegion(){

    if(
      state.selectedRegionIndex !== null &&
      state.yellowRegions[state.selectedRegionIndex]
    ){
      return {
        region: state.yellowRegions[state.selectedRegionIndex],
        index: state.selectedRegionIndex
      };
    }

    if(!state.selection) return null;

    const sx = state.selection.x;
    const sy = state.selection.y;

    const idx =
      state.yellowRegions.findIndex((r)=>
        sx >= r.x &&
        sx < r.x + r.size &&
        sy >= r.y &&
        sy < r.y + r.size
      );

    if(idx < 0) return null;

    return {
      region: state.yellowRegions[idx],
      index: idx
    };
  }


  function buildNonWhitePrefix(tolerance){

    const w = state.width;
    const h = state.height;

    const pixels =
      baseCtx.getImageData(0, 0, w, h).data;

    const stride = w + 1;
    const prefix =
      new Uint32Array((w + 1) * (h + 1));

    for(let y = 1; y <= h; y++){

      let rowAcc = 0;

      for(let x = 1; x <= w; x++){

        const p = ((y - 1) * w + (x - 1)) * 4;

        const r = pixels[p];
        const g = pixels[p + 1];
        const b = pixels[p + 2];

        const isNonWhite =
          (r < tolerance ||
           g < tolerance ||
           b < tolerance)
            ? 1
            : 0;

        rowAcc += isNonWhite;

        prefix[y * stride + x] =
          prefix[(y - 1) * stride + x] + rowAcc;
      }
    }

    return { prefix, stride };
  }


  function nonWhiteCount(prefix, stride, x, y, size){

    const x2 = x + size;
    const y2 = y + size;

    return (
      prefix[y2 * stride + x2] -
      prefix[y * stride + x2] -
      prefix[y2 * stride + x] +
      prefix[y * stride + x]
    );
  }


  function findMaxExpansionCandidates(baseRegion){

    const w = state.width;
    const h = state.height;

    const bx = baseRegion.x;
    const by = baseRegion.y;
    const bs = baseRegion.size;

    const { prefix, stride } =
      buildNonWhitePrefix(state.tolerance);

    for(let size = Math.min(w, h); size >= bs; size--){

      const xMin =
        Math.max(0, bx + bs - size);

      const xMax =
        Math.min(bx, w - size);

      const yMin =
        Math.max(0, by + bs - size);

      const yMax =
        Math.min(by, h - size);

      if(xMin > xMax || yMin > yMax){
        console.log('[findMaxExpansionCandidates] skip size', {
          size,
          baseRegion,
          xMin,
          xMax,
          yMin,
          yMax,
          reason: 'range invalid'
        });
        continue;
      }

      const candidates = [];

      for(let y = yMin; y <= yMax; y++){
        for(let x = xMin; x <= xMax; x++){

          const sameAsBase =
            x === bx &&
            y === by &&
            size === bs;

          if(sameAsBase){
            continue;
          }

          if(
            nonWhiteCount(
              prefix,
              stride,
              x,
              y,
              size
            ) === 0
          ){
            candidates.push({ x, y, size });
          }
        }
      }

      console.log('[findMaxExpansionCandidates] size', {
        size,
        xMin,
        xMax,
        yMin,
        yMax,
        candidateCount: candidates.length,
        firstCandidate: candidates[0] || null
      });

      if(candidates.length > 0){
        return candidates;
      }
    }

    console.log('[findMaxExpansionCandidates] no candidate found', {
      baseRegion,
      width: w,
      height: h,
      tolerance: state.tolerance
    });

    return [];
  }


  function findDirectionalCandidates(baseRegion, directionKey){

    const w = state.width;
    const h = state.height;
    const bestCandidates = [];

    const { prefix, stride } =
      buildNonWhitePrefix(state.tolerance);

    const firstSize = baseRegion.size;
    const firstXMin = Math.max(0, baseRegion.x - firstSize);
    const firstXMax = Math.min(w - firstSize, baseRegion.x + firstSize);
    const firstYMin = Math.max(0, baseRegion.y - firstSize);
    const firstYMax = Math.min(h - firstSize, baseRegion.y + firstSize);

    if(firstXMin <= firstXMax && firstYMin <= firstYMax){
      console.log('[findDirectionalCandidates] range', {
        directionKey,
        size: firstSize,
        base: { x: baseRegion.x, y: baseRegion.y, size: baseRegion.size },
        start: { x: firstXMin, y: firstYMin },
        end: { x: firstXMax, y: firstYMax },
        totalChecks: (firstXMax - firstXMin + 1) * (firstYMax - firstYMin + 1)
      });
    }

    const size = baseRegion.size;
    let bestScore = -Infinity;
    bestCandidates.length = 0;

    // top-left 탐색 범위: (base.x-size, base.y-size) ~ (base.x+size, base.y+size)
    // 예) base=(44,43), size=7 -> x:37~51, y:36~50
    const xMin = Math.max(0, baseRegion.x - size);
    const xMax = Math.min(w - size, baseRegion.x + size);
    const yMin = Math.max(0, baseRegion.y - size);
    const yMax = Math.min(h - size, baseRegion.y + size);

    if(xMin > xMax || yMin > yMax){
      console.log('[findDirectionalCandidates] no candidate found', {
        directionKey,
        baseRegion,
        width: w,
        height: h,
        tolerance: state.tolerance,
        reason: 'search range invalid'
      });
      return [];
    }

    for(let y = yMin; y <= yMax; y++){
      for(let x = xMin; x <= xMax; x++){

        const candidate = { x, y, size };
        const isTargetCandidate = x === 46 && y === 50 && size === 7;
        const whiteCount =
          nonWhiteCount(
            prefix,
            stride,
            x,
            y,
            size
          );

        const dirMatch =
          directionMatchesCandidate(baseRegion, candidate, directionKey);

        const score =
          directionAlignmentScore(baseRegion, candidate, directionKey);

        if(isTargetCandidate){
          const pixels = baseCtx.getImageData(candidate.x, candidate.y, candidate.size, candidate.size).data;
          let minChannel = Infinity;
          let minChannelPixel = null;

          for(let i = 0; i < pixels.length; i += 4){
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const channelMin = Math.min(r, g, b);

            if(channelMin < minChannel){
              minChannel = channelMin;
              minChannelPixel = { r, g, b, x: (i / 4) % candidate.size, y: Math.floor((i / 4) / candidate.size) };
            }
          }

          const maxToleranceThatPasses = Number.isFinite(minChannel) ? minChannel : 255;
          const passesAtCurrentTolerance = state.tolerance <= maxToleranceThatPasses;

          console.log('[findDirectionalCandidates] DEBUG target tolerance threshold', {
            candidate,
            currentTolerance: state.tolerance,
            minChannel,
            maxToleranceThatPasses,
            passesAtCurrentTolerance,
            minChannelPixel,
            whiteCount
          });

          console.log('[findDirectionalCandidates] DEBUG direct values', {
            minChannel,
            maxToleranceThatPasses,
            currentTolerance: state.tolerance,
            passesAtCurrentTolerance,
            passRule: 'tolerance must be <= maxToleranceThatPasses to pass'
          });
        }

        if(whiteCount !== 0){
          if(isTargetCandidate){
            console.log('[findDirectionalCandidates] DEBUG target NONO: whiteCount != 0', {
              candidate,
              whiteCount
            });
          }
          continue;
        }
        if(squaresOverlap(baseRegion, candidate)){
          if(isTargetCandidate){
            console.log('[findDirectionalCandidates] DEBUG target NONO: overlap', {
              candidate,
              baseRegion
            });
          }
          continue;
        }
        if(!dirMatch){
          if(isTargetCandidate){
            console.log('[findDirectionalCandidates] DEBUG target NONO: direction mismatch', {
              candidate,
              directionKey,
              dirMatch
            });
          }
          continue;
        }

        if(isTargetCandidate){
          console.log('[findDirectionalCandidates] DEBUG target OKOK', {
            candidate,
            score,
            bestScore
          });
        }

        if(score > bestScore + 1e-12){
          bestScore = score;
          bestCandidates.length = 0;
          bestCandidates.push(candidate);
        }else if(Math.abs(score - bestScore) <= 1e-12){
          bestCandidates.push(candidate);
        }
      }
    }

    if(bestCandidates.length > 0){
      console.log('[findDirectionalCandidates] matched size', {
        directionKey,
        size,
        count: bestCandidates.length,
        candidates: bestCandidates.slice(0, 5)
      });
      return bestCandidates;
    }

    console.log('[findDirectionalCandidates] no candidate found', {
      directionKey,
      baseRegion,
      width: w,
      height: h,
      tolerance: state.tolerance
    });

    return [];
  }


  function formatCandidateStatus(prefixText, index, total, size, x, y, referenceRegion = null){
    const coordText =
      typeof x === 'number' && typeof y === 'number'
        ? ' | 좌표 (' + x + ', ' + y + ')'
        : '';

    let relativeText = '';

    if(referenceRegion && typeof x === 'number' && typeof y === 'number'){
      const refCenter = {
        x: referenceRegion.x + referenceRegion.size / 2,
        y: referenceRegion.y + referenceRegion.size / 2
      };
      const candidateCenter = {
        x: x + size / 2,
        y: y + size / 2
      };
      const dx = candidateCenter.x - refCenter.x;
      const dy = -(candidateCenter.y - refCenter.y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angleDeg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;

      let arrow = '→';

      if(angleDeg >= 337.5 || angleDeg < 22.5){
        arrow = '→';
      }else if(angleDeg >= 22.5 && angleDeg < 67.5){
        arrow = '↗';
      }else if(angleDeg >= 67.5 && angleDeg < 112.5){
        arrow = '↑';
      }else if(angleDeg >= 112.5 && angleDeg < 157.5){
        arrow = '↖';
      }else if(angleDeg >= 157.5 && angleDeg < 202.5){
        arrow = '←';
      }else if(angleDeg >= 202.5 && angleDeg < 247.5){
        arrow = '↙';
      }else if(angleDeg >= 247.5 && angleDeg < 292.5){
        arrow = '↓';
      }else if(angleDeg >= 292.5 && angleDeg < 337.5){
        arrow = '↘';
      }

      relativeText =
        ' | 기준 마지막 노란 영역 거리=' + distance.toFixed(1) + 'px, 각도=' + angleDeg.toFixed(1) + '° ' + arrow;
    }

    return (
      prefixText +
      ' 후보 ' +
      (index + 1) +
      '/' +
      total +
      ' | 크기 ' +
      size +
      'x' +
      size +
      coordText +
      relativeText +
      ' | PgUp/PgDn으로 순환, Enter로 확정'
    );
  }


  function startExpansionCandidates(){

    const baseInfo =
      getExpansionBaseRegion();

    if(!baseInfo){

      clearCandidateSquares();

      setStatus(
        'Shift+F8은 노란 기준 사각형 위에서 실행하세요.',
        true
      );

      render();
      return;
    }

    const candidates =
      findMaxExpansionCandidates(baseInfo.region);

    if(candidates.length === 0){

      clearCandidateSquares();

      setStatus(
        '확장 후보 없음.',
        true
      );

      render();
      return;
    }

    state.candidateSquares = candidates;
    state.selectedCandidateIndex = 0;
    state.candidateMode = 'expansion';
    state.candidateDirectionKey = null;
    state.expansionBaseRegionIndex = baseInfo.index;

    const c = candidates[0];

    setStatus(
      formatCandidateStatus('확장', 0, candidates.length, c.size),
      false
    );

    render();
  }


  function startDirectionalCandidates(directionKey){

    const dir = getDirectionVector(directionKey);

    if(!dir) return;

    const baseInfo = getExpansionBaseRegion();

    if(!baseInfo){
      setStatus('WXAD는 노란 기준 사각형 위에서 실행하세요.', true);
      return;
    }

    if(directionKey === 'W' || directionKey === 'X' || directionKey === 'A' || directionKey === 'D'){
      const attempts = getValidAttachPositionsForDirection(baseInfo.region, directionKey);
      const validEntries = attempts.filter((entry)=>entry.positions.length > 0);

      const label = getDirectionVector(directionKey)?.label || '방향';
      const fullSummary = attempts
        .map((entry)=>{
          const sizeText = entry.size + 'x' + entry.size;
          const positionsText = entry.positions.length > 0
            ? entry.positions.map((pos)=>'(' + pos.x + ', ' + pos.y + ')').join(', ')
            : '없음';
          return sizeText + ' : ' + positionsText;
        })
        .join(',\n');

      if(validEntries.length === 0){
        setStatus(label + ' 후보:\n없음', true, label + ' 후보:\n' + fullSummary);
        render();
        return;
      }

      state.candidateSizeGroups = validEntries.map((entry)=>({
        size: entry.size,
        positions: entry.positions.map((pos)=>({
          x: pos.x,
          y: pos.y,
          size: entry.size
        }))
      }));

      state.candidateGroupIndex = 0;
      state.candidateSquares = state.candidateSizeGroups[0].positions;
      state.selectedCandidateIndex = 0;
      state.candidateMode = 'directional';
      state.candidateDirectionKey = directionKey;
      state.expansionBaseRegionIndex = baseInfo.index;

      const currentGroup = state.candidateSizeGroups[0];
      const c = currentGroup.positions[0];
      const refRegion = state.yellowRegions[state.yellowRegions.length - 1] || null;
      const compactSummary = currentGroup.size + 'x' + currentGroup.size + ' : ' +
        currentGroup.positions.map((pos)=>'(' + pos.x + ', ' + pos.y + ')').join(', ');

      setStatus(
        formatCandidateStatus(label, 0, currentGroup.positions.length, c.size, c.x, c.y, refRegion),
        false,
        label + ' 후보:\n' + fullSummary
      );
      render();
      return;
    }

    const candidates =
      findDirectionalCandidates(baseInfo.region, directionKey);

    console.log('[startDirectionalCandidates]', {
      directionKey,
      base: { x: baseInfo.region.x, y: baseInfo.region.y, size: baseInfo.region.size },
      count: candidates.length,
      firstCandidate: candidates[0] || null,
      sample: candidates.slice(0, 10)
    });

    // UI와 후보 표시 로직은 제거하고, 콘솔 카운트만 남겨서 새 구현을 붙일 수 있게 한다.
  }


  function refreshDirectionalCandidateDisplay(){
    if(
      state.candidateMode !== 'directional' ||
      state.candidateDirectionKey === null ||
      state.candidateSizeGroups.length === 0
    ){
      return;
    }

    const group = state.candidateSizeGroups[state.candidateGroupIndex];
    state.candidateSquares = group.positions;
    state.selectedCandidateIndex = 0;

    const label = getDirectionVector(state.candidateDirectionKey)?.label || '방향';
    const c = group.positions[0];
    const refRegion = state.yellowRegions[state.yellowRegions.length - 1] || null;

    setStatus(
      formatCandidateStatus(label, 0, group.positions.length, c.size, c.x, c.y, refRegion),
      false,
      label + ' 후보:\n' + state.candidateSizeGroups
        .map((entry)=>{
          const sizeText = entry.size + 'x' + entry.size;
          const positionsText = entry.positions.length > 0
            ? entry.positions.map((pos)=>'(' + pos.x + ', ' + pos.y + ')').join(', ')
            : '없음';
          return sizeText + ' : ' + positionsText;
        })
        .join(',\n')
    );

    render();
  }


  function cycleCandidate(step){

    const total =
      state.candidateSquares.length;

    if(total === 0){
      setStatus(
        '순환할 후보가 없습니다. Shift+F8로 먼저 후보를 찾으세요.',
        true
      );
      return;
    }

    state.selectedCandidateIndex =
      (state.selectedCandidateIndex + step + total) % total;

    const idx = state.selectedCandidateIndex;
    const c = state.candidateSquares[idx];
    const refRegion = state.yellowRegions[state.yellowRegions.length - 1] || null;
    const prefixText =
      state.candidateMode === 'directional' && state.candidateDirectionKey
        ? (getDirectionVector(state.candidateDirectionKey)?.label || '방향')
        : '확장';

    setStatus(
      formatCandidateStatus(prefixText, idx, total, c.size, c.x, c.y, refRegion),
      false
    );

    render();
  }


  function acceptSelectedCandidate(){

    if(state.candidateSquares.length === 0){
      return;
    }

    const c =
      state.candidateSquares[
        state.selectedCandidateIndex
      ];

    const baseIdx = state.expansionBaseRegionIndex;

    if(state.candidateMode === 'expansion'){

      let targetIndex = baseIdx;

      if(
        targetIndex === null ||
        !state.yellowRegions[targetIndex]
      ){
        if(state.selection){
          targetIndex = state.yellowRegions.findIndex((r)=>
            state.selection.x >= r.x &&
            state.selection.x < r.x + r.size &&
            state.selection.y >= r.y &&
            state.selection.y < r.y + r.size
          );
        }
      }

      if(
        targetIndex === null ||
        targetIndex < 0 ||
        !state.yellowRegions[targetIndex]
      ){
        clearCandidateSquares();

        setStatus(
          '기준 사각형 정보가 사라져 확정할 수 없습니다. Shift+F8을 다시 실행하세요.',
          true
        );

        render();
        return;
      }

      state.yellowRegions[targetIndex] = {
        x: c.x,
        y: c.y,
        size: c.size
      };

      state.selectedRegionIndex = targetIndex;

      state.selection = {
        x: c.x,
        y: c.y,
        size: c.size
      };

      clearCandidateSquares();

      saveMeta();

      setStatus(
        '후보 사각형으로 기준 노란 영역을 확장 대체했습니다.',
        false
      );

      render();
      return;
    }

    const overlapRegion = state.yellowRegions.find((r)=>
      squaresOverlap(r, {
        x: c.x,
        y: c.y,
        size: c.size
      })
    );

    if(overlapRegion){
      const overlapText =
        '(' + c.x + ', ' + c.y + ') ' + c.size + 'x' + c.size +
        ' | 기존 영역과 겹쳐서 추가 못함';

      showToast(overlapText, true);
      clearCandidateSquares();

      setStatus(
        '기존 영역과 겹쳐서 추가할 수 없습니다.',
        true
      );

      render();
      return;
    }

    state.yellowRegions.push({
      x: c.x,
      y: c.y,
      size: c.size
    });

    state.selectedRegionIndex = state.yellowRegions.length - 1;

    state.selection = {
      x: c.x,
      y: c.y,
      size: c.size
    };

    clearCandidateSquares();

    saveMeta();

    setStatus(
      '후보 사각형을 노란 사각형 배열에 추가했습니다.',
      false
    );

    render();
  }


  function checkAndPaint(){

    if(
      !state.selection ||
      !state.img
    ) return;

    const s =
      state.selection;

    const data =
      baseCtx.getImageData(
        s.x,
        s.y,
        s.size,
        s.size
      ).data;

    const T =
      state.tolerance;

    let allWhite = true;

    for(
      let i = 0;
      i < data.length;
      i += 4
    ){

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if(
        !(r >= T &&
          g >= T &&
          b >= T)
      ){
        allWhite = false;
        break;
      }
    }


    if(allWhite){

      state.yellowRegions.push({
        x: s.x,
        y: s.y,
        size: s.size
      });

      clearCandidateSquares();

      setStatus(
        '흰색 영역을 확인하여 노란색으로 칠했습니다. ' +
        '(톨러런스 ' + T + ')',
        false
      );

      saveMeta();

    }else{

      setStatus(
        '선택 영역이 흰색이 아닙니다. ' +
        '(톨러런스 ' + T + ')',
        true
      );
    }

    render();
  }


  function deleteSelectedRegion(){

    if(
      state.selectedRegionIndex === null
    ) return;

    state.yellowRegions.splice(
      state.selectedRegionIndex,
      1
    );

    state.selectedRegionIndex = null;
    clearCandidateSquares();

    render();

    saveMeta();

    setStatus(
      '노란 영역을 해제했습니다.',
      false
    );
  }


  window.addEventListener('keydown', (e)=>{

    if(
      isTypingTarget(
        document.activeElement
      )
    ) return;

    if(!state.img) return;


    switch(e.key){

      case 'F1':
        {
          e.preventDefault();

          const region = getActiveStatsRegion();

          if(!region){
            setStatus('F1: 현재 선택된 사각형이 없습니다.', true);
            updateChannelStatsDisplay('');
            break;
          }

          const stats = getRegionChannelStats(region);

          if(!stats){
            setStatus('F1: 영역 색 정보를 읽을 수 없습니다.', true);
            updateChannelStatsDisplay('');
            break;
          }

          if(stats.passedTolerancePixels && stats.passedTolerancePixels.length){
            scheduleTolerancePassedHighlight(
              stats.passedTolerancePixels,
              2000
            );
          }

          if(stats.minPixels && stats.minPixels.length){
            scheduleMinChannelHighlight(
              stats.minPixels,
              2000
            );
          }

          if(stats.underTolerancePixels && stats.underTolerancePixels.length){
            scheduleLowToleranceHighlight(
              stats.underTolerancePixels,
              2000
            );
          }

          const regionText =
            '(' + region.x + ', ' + region.y + ') ' +
            region.size + 'x';

          const minPixelText =
            stats.minPixels && stats.minPixels.length
              ? (() => {
                  const preview = stats.minPixels.slice(0, 2).map((p)=>'(' + p.x + ', ' + p.y + ')');
                  const extra = Math.max(0, stats.minPixels.length - preview.length);
                  return preview.join(', ') + (extra > 0 ? ', ... ' + String(stats.minPixels.length).padStart(2, '0') + '개' : '');
                })()
              : '(없음)';

          const lowToleranceText =
            stats.underTolerancePixels && stats.underTolerancePixels.length
              ? stats.underTolerancePixels.length + '개'
              : '0개';

          const relation = getRelationToRecentYellowRegion(region);
          const relationText =
            relation.distance === null
              ? 'relation=unknown'
              : 'relation=' + relation.label + ' dist=' + Math.round(relation.distance);

          const expansionResults = getExpansionStatusForRegion(region, 1);
          const lowerRight = expansionResults.find((item)=>item.label === '우하단') || expansionResults[0];

          const expansionFailureText =
            lowerRight && !lowerRight.canExpand && lowerRight.failingPixels.length > 0
              ? lowerRight.failingPixels
                  .slice(0, 15)
                  .map((p)=>'(' + p.x + ',' + p.y + ') : ' + (p.value >= state.tolerance ? '가능' : '불가') + '(' + p.r + ',' + p.g + ',' + p.b + ' / min=' + p.value + ')')
                  .join(' / ')
              : '없음';

          const expansionText =
            lowerRight
              ? '우하단:' + (lowerRight.canExpand ? '가능' : '불가')
              : '우하단:검사없음';

          const msg =
            'F1: 선택 영역 ' + regionText +
            '\nminChannel=' + stats.minChannel + ', maxChannel=' + stats.maxChannel +
            '\ntolerance 미만 픽셀=' + lowToleranceText +
            '\nrelation=' + relation.label +
            '\n1칸 확장(8x8)=' + expansionText;

          const detailMsg =
            'F1: 선택 영역 ' + regionText +
            '\nminChannel=' + stats.minChannel + ', maxChannel=' + stats.maxChannel +
            '\nmin pixels=' + minPixelText +
            '\ntolerance 미만 픽셀=' + lowToleranceText +
            '\n' + relationText +
            '\n1칸 확장(8x8)=' + expansionText +
            '\n불가 원인=' + expansionFailureText;

          setStatus(msg, false, detailMsg);
          updateChannelStatsDisplay('');
          render();
          break;
        }

      case 'F2':
        {
          e.preventDefault();

          const targetPixel = hoverOriginalPixel || lastValidOriginalPixel;

          if(!targetPixel){
            setStatus('F2: 확대 캔버스 위에 마우스를 올려 두세요.', true);
            break;
          }

          const { x, y } = targetPixel;
          lastValidOriginalPixel = { x, y };
          hoverOriginalPixel = { x, y };

          const pixel = baseCtx.getImageData(x, y, 1, 1).data;
          const r = pixel[0];
          const g = pixel[1];
          const b = pixel[2];
          const minValue = Math.min(r, g, b);

          scheduleF2Marker(x, y, 25000);

          setStatus(
            'F2: 원본 좌표=(' + x + ', ' + y + ') | RGB=(' + r + ', ' + g + ', ' + b + ') | min=' + minValue,
            false
          );
          render();
          break;
        }

      case 'i':
      case 'I':
        if(e.shiftKey){
          moveF2Marker(0, -1);
        }else{
          moveSelection(0, -1);
        }
        e.preventDefault();
        break;

      case 'k':
      case 'K':
        if(e.shiftKey){
          moveF2Marker(0, 1);
        }else{
          moveSelection(0, 1);
        }
        e.preventDefault();
        break;

      case 'j':
      case 'J':
        if(e.shiftKey){
          moveF2Marker(-1, 0);
        }else{
          moveSelection(-1, 0);
        }
        e.preventDefault();
        break;

      case 'l':
      case 'L':
        if(e.shiftKey){
          moveF2Marker(1, 0);
        }else{
          moveSelection(1, 0);
        }
        e.preventDefault();
        break;

      case 'F8':
        if(e.shiftKey){
          startExpansionCandidates();
        }else{
          checkAndPaint();
        }
        e.preventDefault();
        break;

      case 'q':
      case 'Q':
        startDirectionalCandidates('Q');
        e.preventDefault();
        break;

      case 'w':
      case 'W':
        startDirectionalCandidates('W');
        e.preventDefault();
        break;

      case 'e':
      case 'E':
        startDirectionalCandidates('E');
        e.preventDefault();
        break;

      case 'a':
      case 'A':
        startDirectionalCandidates('A');
        e.preventDefault();
        break;

      case 'd':
      case 'D':
        startDirectionalCandidates('D');
        e.preventDefault();
        break;

      case 'z':
      case 'Z':
        startDirectionalCandidates('Z');
        e.preventDefault();
        break;

      case 'x':
      case 'X':
        startDirectionalCandidates('X');
        e.preventDefault();
        break;

      case 'c':
      case 'C':
        startDirectionalCandidates('C');
        e.preventDefault();
        break;

      case 'PageDown':
        cycleCandidate(1);
        e.preventDefault();
        break;

      case 'PageUp':
        cycleCandidate(-1);
        e.preventDefault();
        break;

      case '-':
      case 'Subtract':
      case 'NumpadSubtract':
        if(
          state.candidateMode === 'directional' &&
          state.candidateSizeGroups.length > 1
        ){
          if(state.candidateGroupIndex < state.candidateSizeGroups.length - 1){
            state.candidateGroupIndex = Math.min(
              state.candidateGroupIndex + 1,
              state.candidateSizeGroups.length - 1
            );
            refreshDirectionalCandidateDisplay();
          }else{
            const size = state.candidateSizeGroups[state.candidateGroupIndex]?.size || 0;
            const count = state.candidateSizeGroups[state.candidateGroupIndex]?.positions.length || 0;
            showToast(
              '현재 설정상 max 크기: ' + size + 'x' + size + ' | 후보 수: ' + count + '개\n이 크기(' + size + 'x' + size + ')에는 추천할 사각형이 없습니다.',
              true
            );
          }
        }
        e.preventDefault();
        break;

      case '+':
      case 'Add':
      case 'NumpadAdd':
        if(
          state.candidateMode === 'directional' &&
          state.candidateSizeGroups.length > 1
        ){
          if(state.candidateGroupIndex > 0){
            state.candidateGroupIndex = Math.max(
              state.candidateGroupIndex - 1,
              0
            );
            refreshDirectionalCandidateDisplay();
          }else{
            const size = state.candidateSizeGroups[state.candidateGroupIndex]?.size || 0;
            const count = state.candidateSizeGroups[state.candidateGroupIndex]?.positions.length || 0;
            showToast(
              '현재 설정상 max 크기: ' + size + 'x' + size + ' | 후보 수: ' + count + '개\n이 크기(' + size + 'x' + size + ')에는 더 이상 크게 할 수 없습니다. 이것이 max 크기입니다.',
              true
            );
          }
        }
        e.preventDefault();
        break;

      case 'Enter':
        acceptSelectedCandidate();
        e.preventDefault();
        break;

      case 'Delete':
      case 'Backspace':
        deleteSelectedRegion();
        e.preventDefault();
        break;

      default:
        break;
    }
  });


  // ---------- init ----------

  restoreOnLoad();

})();
