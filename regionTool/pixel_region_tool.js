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


  // ---------- controls population ----------

  // populate zoom select 2..16
  for(let z=2; z<=16; z++){
    const opt = document.createElement('option');
    opt.value = z;
    opt.textContent = z + '배';
    if(z===4) opt.selected = true;
    zoomSelect.appendChild(opt);
  }

  // populate square size select 1..8 (side length)
  for(let s=1; s<=8; s++){
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
    selectedRegionIndex: null
  };


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


  function setStatus(msg, isWarn){

    statusLine.textContent = msg;

    statusLine.className =
      'status' +
      (isWarn ? ' warn' : '');
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

    saveMeta();
  });


  clearRegionsBtn.addEventListener('click', ()=>{

    state.yellowRegions = [];
    state.selectedRegionIndex = null;

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


  // ---------- click on tarCanvas ----------

  tarCanvas.addEventListener('click', (e)=>{

    if(!state.img) return;

    const rect =
      tarCanvas.getBoundingClientRect();

    // CSS 크기와 Canvas 내부 크기가 다를 경우에도
    // 정확하게 내부 좌표로 환산한다.
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


    const idx =
      state.yellowRegions.findIndex(r =>
        px >= r.x &&
        px < r.x + r.size &&
        py >= r.y &&
        py < r.y + r.size
      );


    if(idx >= 0){

      state.selectedRegionIndex = idx;

      setStatus(
        '노란 영역을 선택했습니다. ' +
        'Delete 키로 해제할 수 있습니다.',
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

      case 'i':
      case 'I':
        moveSelection(0, -1);
        e.preventDefault();
        break;

      case 'k':
      case 'K':
        moveSelection(0, 1);
        e.preventDefault();
        break;

      case 'j':
      case 'J':
        moveSelection(-1, 0);
        e.preventDefault();
        break;

      case 'l':
      case 'L':
        moveSelection(1, 0);
        e.preventDefault();
        break;

      case 'F8':
        checkAndPaint();
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
