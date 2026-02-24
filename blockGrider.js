// ----- 귀퉁이 사각형 좌표 함수 -----
/**
 * 원래 사각형의 4개 귀퉁이에 위치한 size2 크기의 사각형 좌표를 리턴합니다.
 * @param {number} x - 원래 사각형의 x 좌표
 * @param {number} y - 원래 사각형의 y 좌표
 * @param {number} size - 원래 사각형의 한 변의 길이
 * @param {number} size2 - 귀퉁이 사각형의 한 변의 길이
 * @returns {Array<{x: number, y: number, w: number, h: number, visibleX: number, visibleY: number, visibleW: number, visibleH: number}>}
 */
function getCornerRects(x, y, size, size2) {
    // 원래 좌표를 계산 (음수 포함, 경계 밖도 허용)
    const corners = [
        { x: x - size2, y: y - size2 }, // 좌상
        { x: x + size,  y: y - size2 }, // 우상
        { x: x - size2, y: y + size  }, // 좌하
        { x: x + size,  y: y + size  }  // 우하
    ];
    
    return corners.map(corner => {
        // 실제로 화면(0~63)에 보이는 영역만 계산
        const visibleStartX = Math.max(0, corner.x);
        const visibleStartY = Math.max(0, corner.y);
        const visibleEndX = Math.min(64, corner.x + size2);
        const visibleEndY = Math.min(64, corner.y + size2);
        const visibleW = Math.max(0, visibleEndX - visibleStartX);
        const visibleH = Math.max(0, visibleEndY - visibleStartY);
        
        return {
            x: corner.x,           // 원래 계산된 좌표 (음수/경계 밖 포함)
            y: corner.y,           // 원래 계산된 좌표 (음수/경계 밖 포함)
            w: size2,              // 원래 크기
            h: size2,              // 원래 크기
            visibleX: visibleStartX,  // 실제 보이는 시작 x좌표
            visibleY: visibleStartY,  // 실제 보이는 시작 y좌표
            visibleW: visibleW,       // 실제 보이는 너비
            visibleH: visibleH        // 실제 보이는 높이
        };
    });
}

/**
 * 두 귀퉁이 인덱스 사이의 관계를 판별하고 사이의 모든 사각형 좌표를 반환합니다.
 * @param {number} x - 원래 사각형의 x
 * @param {number} y - 원래 사각형의 y
 * @param {number} size - 원래 사각형의 크기
 * @param {number} size2 - 귀퉁이 사각형의 크기
 * @param {number} idxStart - 시작 귀퉁이 인덱스 (0~3)
 * @param {number} idxEnd - 끝 귀퉁이 인덱스 (0~3)
 * @returns {Array<{x: number, y: number}> | null} 수평/수직이 아니면 null 리턴
 */
/**
 * 두 귀퉁이 사이를 1px씩 이동하며 겹치는 모든 사각형 좌표를 리턴합니다.
 */
function getPathRectsOverlap(x, y, size, size2, idxStart, idxEnd) {
    const corners = [
        { x: x - size2, y: y - size2 }, // 0: 좌상
        { x: x + size,  y: y - size2 }, // 1: 우상
        { x: x - size2, y: y + size  }, // 2: 좌하
        { x: x + size,  y: y + size  }  // 3: 우하
    ];

    const start = corners[idxStart];
    const end = corners[idxEnd];
    const path = [];

    if (start.y === end.y) {
        // --- 수평 이동 (x축 1px씩) ---
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        for (let curX = minX; curX <= maxX; curX += 1) { // 1px 단위
            path.push({ x: curX, y: start.y });
        }
    } 
    else if (start.x === end.x) {
        // --- 수직 이동 (y축 1px씩) ---
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        for (let curY = minY; curY <= maxY; curY += 1) { // 1px 단위
            path.push({ x: start.x, y: curY });
        }
    } 
    else {
        return null;
    }

    return path;
}

/**
 * 특정 사각형 영역에서 흰색 픽셀(RGB 255,255,255) 개수를 셉니다.
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {number} x - 사각형 시작 x 좌표
 * @param {number} y - 사각형 시작 y 좌표
 * @param {number} size - 사각형 크기
 * @returns {number} 흰색 픽셀 개수
 */
function countWhitePixels(ctx, x, y, size) {
    // 경계 밖을 범위는 0을 반환
    if (x < 0 || y < 0 || x + size > 64 || y + size > 64) {
        // 부분적으로 경계 안에 있는 경우 처리
        const startX = Math.max(0, x);
        const startY = Math.max(0, y);
        const endX = Math.min(64, x + size);
        const endY = Math.min(64, y + size);
        const width = endX - startX;
        const height = endY - startY;
        
        if (width <= 0 || height <= 0) return 0;
        
        const imageData = ctx.getImageData(startX, startY, width, height);
        const data = imageData.data;
        let count = 0;
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === 255 && data[i+1] === 255 && data[i+2] === 255) {
                count++;
            }
        }
        return count;
    }
    
    try {
        const imageData = ctx.getImageData(x, y, size, size);
        const data = imageData.data;
        let count = 0;
        
        // RGBA 형식이므로 4바이트씩 건너뜀
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // 흰색 픽셀 확인
            if (r === 255 && g === 255 && b === 255) {
                count++;
            }
        }
        
        return count;
    } catch (ex) {
        return 0;
    }
}

// Canvas 요소 가져오기
        const canvas1 = document.getElementById('canvas1');
        const ctx1 = canvas1.getContext('2d', { willReadFrequently: true });
        const canvas2 = document.getElementById('canvas2');
        const ctx2 = canvas2.getContext('2d', { willReadFrequently: true });
        
        // Range 바 요소
        const scaleRange = document.getElementById('scaleRange');
        const scaleDisplay = document.getElementById('scaleDisplay');
        
        // 스케일 값 배열
        const scaleValues = [2, 4, 8, 16, 32, 64];
        
        // Document 로드 시 임의의 점들 그리기
        document.addEventListener('DOMContentLoaded', () => {
            drawRandomPixels();
        });
        
        // Canvas1에 임의의 점들 그리기
        function drawRandomPixels() {
            // 배경을 흰색으로 설정
            ctx1.fillStyle = 'white';
            ctx1.fillRect(0, 0, 64, 64);
            
            // 임의의 점들 그리기 (약 200-300개의 픽셀)
            const pixelCount = Math.floor(Math.random() * 100) + 200;
            
            for (let i = 0; i < pixelCount; i++) {
                const x = Math.floor(Math.random() * 64);
                const y = Math.floor(Math.random() * 64);
                
                // 랜덤 색상 생성
                const r = Math.floor(Math.random() * 256);
                const g = Math.floor(Math.random() * 256);
                const b = Math.floor(Math.random() * 256);
                
                ctx1.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx1.fillRect(x, y, 1, 1);
            }
        }
        
        // 클립보드에서 이미지 가져오기
        async function loadImageFromClipboard() {
            try {
                const clipboardItems = await navigator.clipboard.read();
                
                for (const clipboardItem of clipboardItems) {
                    for (const type of clipboardItem.types) {
                        if (type.startsWith('image/')) {
                            const blob = await clipboardItem.getType(type);
                            const img = new Image();
                            
                            img.onload = function() {
                                // 배경을 흰색으로 설정
                                ctx1.fillStyle = 'white';
                                ctx1.fillRect(0, 0, 64, 64);
                                
                                // 이미지를 64x64에 맞춰서 그리기 (비율 유지)
                                const scale = Math.min(64 / img.width, 64 / img.height);
                                const scaledWidth = img.width * scale;
                                const scaledHeight = img.height * scale;
                                const offsetX = (64 - scaledWidth) / 2;
                                const offsetY = (64 - scaledHeight) / 2;
                                
                                ctx1.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
                                console.log('클립보드에서 이미지를 가져왔습니다.');
                            };
                            
                            img.src = URL.createObjectURL(blob);
                            return;
                        }
                    }
                }
                
                alert('클립보드에 이미지가 없습니다.');
            } catch (err) {
                console.error('클립보드 읽기 오류:', err);
                alert('클립보드에서 이미지를 가져오는데 실패했습니다. \n\n클립보드 접근 권한을 허용해주세요.');
            }
        }
        
        // 버튼 이벤트 리스너
        document.getElementById('btnLoadClipboard').addEventListener('click', loadImageFromClipboard);
        document.getElementById('btnRandomize').addEventListener('click', drawRandomPixels);
        
        // Range 바 값 변경 시 표시 업데이트
        scaleRange.addEventListener('input', (e) => {
            const index = parseInt(e.target.value);
            const scale = scaleValues[index];
            scaleDisplay.textContent = `${scale}x`;
        });
        
        // 각도 계산 및 표시 함수
        function updateTempYellowAngle() {
            if (tempYellowRect && selectedPixel) {
                const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
                const baseX = selectedPixel.x + rectSize / 2;
                const baseY = selectedPixel.y + rectSize / 2;
                const targetX = tempYellowRect.x + tempYellowRect.size / 2;
                const targetY = tempYellowRect.y + tempYellowRect.size / 2;
                
                const dx = targetX - baseX;
                const dy = targetY - baseY;
                
                // atan2는 -180~180 범위를 반환, 0~359로 변환
                let angle = Math.atan2(dy, dx) * 180 / Math.PI;
                if (angle < 0) angle += 360;
                angle = Math.round(angle);
                
                const angleDisplay = document.getElementById('tempYellowAngleDisplay');
                if (angleDisplay) {
                    angleDisplay.innerHTML = `| 각도: <span style="font-weight:bold;color:#cc6600;">${angle}°</span>`;
                }
                
                // 좌표 표시
                const tempYellowXInput = document.getElementById('tempYellowX');
                const tempYellowYInput = document.getElementById('tempYellowY');
                if (tempYellowXInput) tempYellowXInput.value = tempYellowRect.x;
                if (tempYellowYInput) tempYellowYInput.value = tempYellowRect.y;
                
                return angle;
            }
            return null;
        }
        
        // F2, F4, F8, F9, IJKL 키 이벤트 리스너
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                scaleCanvas();
            }
            if (e.key === 'F8') {
                // 선택된 픽셀과 showCorners가 활성화되어 있고, 기준 사각형이 모두 흰색일 때만
                if (selectedPixel && showCorners) {
                    const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
                    const baseWhiteCount = countWhitePixels(ctx1, selectedPixel.x, selectedPixel.y, rectSize);
                    const baseMaxPixels = rectSize * rectSize;
                    
                    if (baseWhiteCount === baseMaxPixels) {
                        // 모두 흰색이면 녹색 사각형으로 저장
                        greenRects.push({
                            x: selectedPixel.x,
                            y: selectedPixel.y,
                            size: rectSize
                        });
                        console.log(`✅ 녹색 사각형 추가: (${selectedPixel.x}, ${selectedPixel.y}), 크기: ${rectSize}x${rectSize}`);
                        console.log(`   총 ${greenRects.length}개의 녹색 사각형 저장됨`);
                        scaleCanvas(); // 화면 갱신
                    } else {
                        console.log(`❌ 사각형이 모두 흰색이 아닙니다. (흰색: ${baseWhiteCount}/${baseMaxPixels})`);
                    }
                }
                e.preventDefault();
            }
            if (e.key === 'F9') {
                // 임시 노란색 사각형이 있으면 확정하여 배열에 추가
                if (tempYellowRect) {
                    yellowRects.push({
                        x: tempYellowRect.x,
                        y: tempYellowRect.y,
                        size: tempYellowRect.size
                    });
                    console.log(`✅ 노란색 사각형 확정: (${tempYellowRect.x}, ${tempYellowRect.y}), 크기: ${tempYellowRect.size}x${tempYellowRect.size}`);
                    console.log(`   총 ${yellowRects.length}개의 노란색 사각형 저장됨`);
                    
                    // 방금 추가된 사각형을 현재 선택으로 설정
                    currentYellowIndex = yellowRects.length - 1;
                    updateYellowIndexDisplay();
                    
                    tempYellowRect = null; // 임시 사각형 초기화
                    
                    // 각도 표시 제거
                    const angleDisplay = document.getElementById('tempYellowAngleDisplay');
                    if (angleDisplay) angleDisplay.innerHTML = '';
                    
                    // 좌표 표시 초기화
                    const tempYellowXInput = document.getElementById('tempYellowX');
                    const tempYellowYInput = document.getElementById('tempYellowY');
                    if (tempYellowXInput) tempYellowXInput.value = '-';
                    if (tempYellowYInput) tempYellowYInput.value = '-';
                    
                    scaleCanvas(); // 화면 갱신
                } else {
                    console.log(`❌ 확정할 임시 노란색 사각형이 없습니다.`);
                }
                e.preventDefault();
            }
            if (e.key === 'F4') {
                showCorners = !showCorners;
                // F4 on일 때만 귀퉁이 rects 새로 계산
                if(showCorners && selectedPixel) {
                    const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
                    const cornerSize = parseInt(document.getElementById('cornerSize').value) || 4;
                    cornerRects = getCornerRects(selectedPixel.x, selectedPixel.y, rectSize, cornerSize);
                    // 귀퉁이 사각형 정보 출력
                    console.log(`=== 귀퉁이 사각형 정보 (원래:${rectSize}x${rectSize}, 귀퉁이:${cornerSize}x${cornerSize}) ===`);
                    const pixelCounts = [];
                    cornerRects.forEach((r, idx) => {
                        const labels = ['좌상', '우상', '좌하', '우하'];
                        const pixelCount = r.visibleW * r.visibleH;
                        pixelCounts.push(pixelCount);
                        console.log(`${labels[idx]}: 원래좌표(${r.x},${r.y}) 크기${r.w}x${r.h} | 보이는영역(${r.visibleX},${r.visibleY}) 크기${r.visibleW}x${r.visibleH} | 유효픽셀: ${pixelCount}`);
                    });
                    // 귀퉁이 유효 픽셀수 표시 업데이트
                    const cornerPixelsDisplay = document.getElementById('cornerPixelsDisplay');
                    if(cornerPixelsDisplay) {
                        cornerPixelsDisplay.textContent = `[${pixelCounts.join(', ')}]`;
                    }
                    
                    // 기준 사각형의 흰색점 개수 계산 및 표시
                    const baseWhiteCount = countWhitePixels(ctx1, selectedPixel.x, selectedPixel.y, rectSize);
                    const baseRectWhite = document.getElementById('baseRectWhite');
                    if(baseRectWhite) {
                        const baseMaxPixels = rectSize * rectSize;
                        baseRectWhite.textContent = baseWhiteCount;
                        baseRectWhite.style.color = (baseWhiteCount === baseMaxPixels) ? '#006600' : '#cc0000';
                    }
                    console.log(`기준 사각형 (${selectedPixel.x},${selectedPixel.y}) 크기${rectSize}x${rectSize}: 흰색점 ${baseWhiteCount}개`);
                    
                    // 4가지 경로 모두 계산
                    pathRects01 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 1) || [];
                    pathRects23 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 2, 3) || [];
                    pathRects02 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 2) || [];
                    pathRects13 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 1, 3) || [];
                    
                    console.log(`경로 계산 (원래:${rectSize}x${rectSize}, 귀퉁이:${cornerSize}x${cornerSize}):`);
                    console.log(`  0→1 (상단 수평): ${pathRects01.length}개`);
                    console.log(`  2→3 (하단 수평): ${pathRects23.length}개`);
                    console.log(`  0→2 (좌측 수직): ${pathRects02.length}개`);
                    console.log(`  1→3 (우측 수직): ${pathRects13.length}개`);
                    
                    const maxPixels = cornerSize * cornerSize;
                    
                    // 각 경로별 흰색 픽셀 개수 계산 및 버튼 생성
                    const calculateWhiteCounts = (rects, pathName) => {
                        return rects.map((pt, idx) => {
                            const count = countWhitePixels(ctx1, pt.x, pt.y, cornerSize);
                            const isAllWhite = (count === maxPixels);
                            
                            // 버튼 생성
                            const btnStyle = isAllWhite 
                                ? 'background:#e6ffe6; color:#006600; font-weight:bold; border:1px solid #00aa00; cursor:pointer;'
                                : 'background:#f0f0f0; color:#999; border:1px solid #ccc; cursor:not-allowed;';
                            
                            const disabled = isAllWhite ? '' : ' disabled';
                            const btnId = `btn_${pathName}_${idx}`;
                            
                            return `<button id="${btnId}" data-path="${pathName}" data-idx="${idx}" data-x="${pt.x}" data-y="${pt.y}" ${disabled} style="padding:2px 6px; margin:1px; font-size:0.85em; ${btnStyle}">[${idx}] ${count}</button>`;
                        });
                    };
                    
                    const whiteCounts01 = calculateWhiteCounts(pathRects01, 'path01');
                    const whiteCounts23 = calculateWhiteCounts(pathRects23, 'path23');
                    const whiteCounts02 = calculateWhiteCounts(pathRects02, 'path02');
                    const whiteCounts13 = calculateWhiteCounts(pathRects13, 'path13');
                    
                    // 개수 표시 업데이트
                    if(document.getElementById('pathCount01')) document.getElementById('pathCount01').textContent = pathRects01.length;
                    if(document.getElementById('pathCount23')) document.getElementById('pathCount23').textContent = pathRects23.length;
                    if(document.getElementById('pathCount02')) document.getElementById('pathCount02').textContent = pathRects02.length;
                    if(document.getElementById('pathCount13')) document.getElementById('pathCount13').textContent = pathRects13.length;
                    
                    // 흰색점 개수 버튼 표시 업데이트
                    if(document.getElementById('pathWhite01')) document.getElementById('pathWhite01').innerHTML = whiteCounts01.join(' ') || '-';
                    if(document.getElementById('pathWhite23')) document.getElementById('pathWhite23').innerHTML = whiteCounts23.join(' ') || '-';
                    if(document.getElementById('pathWhite02')) document.getElementById('pathWhite02').innerHTML = whiteCounts02.join(' ') || '-';
                    if(document.getElementById('pathWhite13')) document.getElementById('pathWhite13').innerHTML = whiteCounts13.join(' ') || '-';
                    
                    // 버튼 클릭 이벤트 추가
                    const addButtonClickEvents = (pathName) => {
                        document.querySelectorAll(`button[data-path="${pathName}"]`).forEach(btn => {
                            if (!btn.disabled) {
                                btn.onclick = () => {
                                    const idx = btn.getAttribute('data-idx');
                                    const x = parseInt(btn.getAttribute('data-x'));
                                    const y = parseInt(btn.getAttribute('data-y'));
                                    console.log(`✅ 경로 ${pathName} [${idx}] 클릭: (${x}, ${y}), 크기: ${cornerSize}x${cornerSize}`);
                                    // 임시 노란색 사각형으로 설정 (F9로 확정)
                                    tempYellowRect = {
                                        x: x,
                                        y: y,
                                        size: cornerSize
                                    };
                                    
                                    // 각도 계산 및 표시
                                    const angle = updateTempYellowAngle();
                                    if (angle !== null) {
                                        console.log(`   각도: ${angle}° (기준 사각형 중심으로부터)`);
                                    }
                                    
                                    console.log(`   임시 노란색 사각형 설정됨. F9 키를 눌러 확정하세요.`);
                                    scaleCanvas(); // 화면 갱신
                                };
                            }
                        });
                    };
                    
                    addButtonClickEvents('path01');
                    addButtonClickEvents('path23');
                    addButtonClickEvents('path02');
                    addButtonClickEvents('path13');
                } else {
                    cornerRects = [];
                    pathRects01 = [];
                    pathRects23 = [];
                    pathRects02 = [];
                    pathRects13 = [];
                    // 귀퉁이 픽셀수 초기화
                    const cornerPixelsDisplay = document.getElementById('cornerPixelsDisplay');
                    if(cornerPixelsDisplay) cornerPixelsDisplay.textContent = '[—,—,—,—]';
                    // 기준 사각형 흰색점 초기화
                    const baseRectWhite = document.getElementById('baseRectWhite');
                    if(baseRectWhite) baseRectWhite.textContent = '—';
                    // 개수 초기화
                    ['pathCount01', 'pathCount23', 'pathCount02', 'pathCount13'].forEach(id => {
                        if(document.getElementById(id)) document.getElementById(id).textContent = 0;
                    });
                    // 흰색점 초기화
                    ['pathWhite01', 'pathWhite23', 'pathWhite02', 'pathWhite13'].forEach(id => {
                        if(document.getElementById(id)) document.getElementById(id).innerHTML = '-';
                    });
                }
                scaleCanvas();
                e.preventDefault();
            }
            // IJKL 이동키 (선택 블록 이동)
            if (selectedPixel && ['i','j','k','l','I','J','K','L'].includes(e.key)) {
                let {x, y} = selectedPixel;
                if (e.key==='i'||e.key==='I') y = Math.max(0, y-1);
                if (e.key==='k'||e.key==='K') y = Math.min(63, y+1);
                if (e.key==='j'||e.key==='J') x = Math.max(0, x-1);
                if (e.key==='l'||e.key==='L') x = Math.min(63, x+1);
                selectedPixel = {x, y};
                // 색상 구하기 (canvas1 기준)
                let r=0,g=0,b=0, rgbText='';
                try {
                    const pixel = ctx1.getImageData(x, y, 1, 1).data;
                    r = pixel[0]; g = pixel[1]; b = pixel[2];
                    rgbText = ` - RGB(${r},${g},${b})`;
                } catch (ex) { rgbText = '' }
                // 좌표+색상 표시
                const coordDisp = document.getElementById('coordDisplay');
                if(coordDisp) coordDisp.textContent = `${x}, ${y}${rgbText}`;
                // 색 박스 표시
                const colorBox = document.getElementById('colorBox');
                if(colorBox) colorBox.style.background = `rgb(${r},${g},${b})`;
                // 귀퉁이 갱신
                if(showCorners && selectedPixel) {
                    const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
                    const cornerSize = parseInt(document.getElementById('cornerSize').value) || 4;
                    cornerRects = getCornerRects(selectedPixel.x, selectedPixel.y, rectSize, cornerSize);
                    
                    // 귀퉁이 유효 픽셀수 업데이트
                    const pixelCounts = cornerRects.map(r => r.visibleW * r.visibleH);
                    const cornerPixelsDisplay = document.getElementById('cornerPixelsDisplay');
                    if(cornerPixelsDisplay) cornerPixelsDisplay.textContent = `[${pixelCounts.join(', ')}]`;
                    
                    // 기준 사각형의 흰색점 개수 계산 및 표시
                    const baseWhiteCount = countWhitePixels(ctx1, selectedPixel.x, selectedPixel.y, rectSize);
                    const baseRectWhite = document.getElementById('baseRectWhite');
                    if(baseRectWhite) {
                        const baseMaxPixels = rectSize * rectSize;
                        baseRectWhite.textContent = baseWhiteCount;
                        baseRectWhite.style.color = (baseWhiteCount === baseMaxPixels) ? '#006600' : '#cc0000';
                    }
                    
                    // 4가지 경로 모두 계산
                    pathRects01 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 1) || [];
                    pathRects23 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 2, 3) || [];
                    pathRects02 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 2) || [];
                    pathRects13 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 1, 3) || [];
                    
                    const maxPixels = cornerSize * cornerSize;
                    
                    // 각 경로별 흰색 픽셀 개수 계산 및 버튼 생성
                    const calculateWhiteCounts = (rects, pathName) => {
                        return rects.map((pt, idx) => {
                            const count = countWhitePixels(ctx1, pt.x, pt.y, cornerSize);
                            const isAllWhite = (count === maxPixels);
                            
                            // 버튼 생성
                            const btnStyle = isAllWhite 
                                ? 'background:#e6ffe6; color:#006600; font-weight:bold; border:1px solid #00aa00; cursor:pointer;'
                                : 'background:#f0f0f0; color:#999; border:1px solid #ccc; cursor:not-allowed;';
                            
                            const disabled = isAllWhite ? '' : ' disabled';
                            const btnId = `btn_${pathName}_${idx}`;
                            
                            return `<button id="${btnId}" data-path="${pathName}" data-idx="${idx}" data-x="${pt.x}" data-y="${pt.y}" ${disabled} style="padding:2px 6px; margin:1px; font-size:0.85em; ${btnStyle}">[${idx}] ${count}</button>`;
                        });
                    };
                    
                    const whiteCounts01 = calculateWhiteCounts(pathRects01, 'path01');
                    const whiteCounts23 = calculateWhiteCounts(pathRects23, 'path23');
                    const whiteCounts02 = calculateWhiteCounts(pathRects02, 'path02');
                    const whiteCounts13 = calculateWhiteCounts(pathRects13, 'path13');
                    
                    // 개수 표시 업데이트
                    if(document.getElementById('pathCount01')) document.getElementById('pathCount01').textContent = pathRects01.length;
                    if(document.getElementById('pathCount23')) document.getElementById('pathCount23').textContent = pathRects23.length;
                    if(document.getElementById('pathCount02')) document.getElementById('pathCount02').textContent = pathRects02.length;
                    if(document.getElementById('pathCount13')) document.getElementById('pathCount13').textContent = pathRects13.length;
                    
                    // 흰색점 개수 버튼 표시 업데이트
                    if(document.getElementById('pathWhite01')) document.getElementById('pathWhite01').innerHTML = whiteCounts01.join(' ') || '-';
                    if(document.getElementById('pathWhite23')) document.getElementById('pathWhite23').innerHTML = whiteCounts23.join(' ') || '-';
                    if(document.getElementById('pathWhite02')) document.getElementById('pathWhite02').innerHTML = whiteCounts02.join(' ') || '-';
                    if(document.getElementById('pathWhite13')) document.getElementById('pathWhite13').innerHTML = whiteCounts13.join(' ') || '-';
                    
                    // 버튼 클릭 이벤트 추가
                    const addButtonClickEvents = (pathName) => {
                        document.querySelectorAll(`button[data-path="${pathName}"]`).forEach(btn => {
                            if (!btn.disabled) {
                                btn.onclick = () => {
                                    const idx = btn.getAttribute('data-idx');
                                    const x = parseInt(btn.getAttribute('data-x'));
                                    const y = parseInt(btn.getAttribute('data-y'));
                                    console.log(`✅ 경로 ${pathName} [${idx}] 클릭: (${x}, ${y}), 크기: ${cornerSize}x${cornerSize}`);
                                    // 임시 노란색 사각형으로 설정 (F9로 확정)
                                    tempYellowRect = {
                                        x: x,
                                        y: y,
                                        size: cornerSize
                                    };
                                    
                                    // 각도 계산 및 표시
                                    const angle = updateTempYellowAngle();
                                    if (angle !== null) {
                                        console.log(`   각도: ${angle}° (기준 사각형 중심으로부터)`);
                                    }
                                    
                                    console.log(`   임시 노란색 사각형 설정됨. F9 키를 눌러 확정하세요.`);
                                    scaleCanvas(); // 화면 갱신
                                };
                            }
                        });
                    };
                    
                    addButtonClickEvents('path01');
                    addButtonClickEvents('path23');
                    addButtonClickEvents('path02');
                    addButtonClickEvents('path13');
                } else {
                    cornerRects = [];
                    pathRects01 = [];
                    pathRects23 = [];
                    pathRects02 = [];
                    pathRects13 = [];
                    // 귀퉁이 픽셀수 초기화
                    const cornerPixelsDisplay = document.getElementById('cornerPixelsDisplay');
                    if(cornerPixelsDisplay) cornerPixelsDisplay.textContent = '[—,—,—,—]';
                    // 기준 사각형 흰색점 초기화
                    const baseRectWhite = document.getElementById('baseRectWhite');
                    if(baseRectWhite) baseRectWhite.textContent = '—';
                    // 개수 초기화
                    ['pathCount01', 'pathCount23', 'pathCount02', 'pathCount13'].forEach(id => {
                        if(document.getElementById(id)) document.getElementById(id).textContent = 0;
                    });
                    // 흰색점 초기화
                    ['pathWhite01', 'pathWhite23', 'pathWhite02', 'pathWhite13'].forEach(id => {
                        if(document.getElementById(id)) document.getElementById(id).innerHTML = '-';
                    });
                }
                scaleCanvas();
                e.preventDefault();
            }
        });
        
        // Canvas1을 Canvas2에 확대하여 복사
        function scaleCanvas() {
            const index = parseInt(scaleRange.value);
            const scale = scaleValues[index];
            
            // Canvas2 크기 조정
            canvas2.width = 64 * scale;
            canvas2.height = 64 * scale;
            
            // Canvas1의 이미지 데이터 가져오기
            const imageData = ctx1.getImageData(0, 0, 64, 64);
            const data = imageData.data;
            
            // Canvas2에 픽셀별로 확대하여 그리기 (Sharp 복사)
            for (let y = 0; y < 64; y++) {
                for (let x = 0; x < 64; x++) {
                    // 원본 픽셀의 인덱스
                    const index = (y * 64 + x) * 4;
                    
                    // RGBA 값 가져오기
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    const a = data[index + 3];
                    
                    // 확대된 위치에 픽셀 그리기
                    ctx2.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                    ctx2.fillRect(x * scale, y * scale, scale, scale);
                }
            }

        }
        
        // 초기 스케일 표시 설정
        scaleDisplay.textContent = `${scaleValues[2]}x`;

        // 캔버스2 클릭시 원래 좌표 표시 및 사각형 그리기
        let selectedPixel = null;
        // F4: 귀퉁이 점선 모드 토글용 변수
        let showCorners = false;
        let cornerRects = [];
        // 4가지 경로를 저장하는 배열들
        let pathRects01 = []; // 상단 수평 (0→1)
        let pathRects23 = []; // 하단 수평 (2→3)
        let pathRects02 = []; // 좌측 수직 (0→2)
        let pathRects13 = []; // 우측 수직 (1→3)
        // F8: 녹색으로 칠한 사각형들을 저장하는 배열
        let greenRects = []; // {x: number, y: number, size: number}[]
        // 경로 버튼 클릭: 임시 노란색 사각형 (F9로 확정 전)
        let tempYellowRect = null; // {x: number, y: number, size: number} | null
        // F9: 확정된 노란색 사각형들을 저장하는 배열
        let yellowRects = []; // {x: number, y: number, size: number}[]
        let currentYellowIndex = -1; // 현재 선택된 노란색 사각형 인덱스 (-1은 선택 안 됨)

        // 노란색 사각형 탐색 기능
        function updateYellowIndexDisplay() {
            const display = document.getElementById('yellowIndexDisplay');
            if (yellowRects.length === 0) {
                display.value = '-';
                currentYellowIndex = -1;
            } else {
                display.value = `${currentYellowIndex + 1}/${yellowRects.length}`;
            }
        }
        
        document.getElementById('btnPrevYellow').addEventListener('click', () => {
            if (yellowRects.length === 0) return;
            if (currentYellowIndex === -1) {
                currentYellowIndex = yellowRects.length - 1; // 마지막으로 이동
            } else {
                currentYellowIndex = (currentYellowIndex - 1 + yellowRects.length) % yellowRects.length;
            }
            updateYellowIndexDisplay();
            scaleCanvas();
        });
        
        document.getElementById('btnNextYellow').addEventListener('click', () => {
            if (yellowRects.length === 0) return;
            if (currentYellowIndex === -1) {
                currentYellowIndex = 0; // 처음으로 이동
            } else {
                currentYellowIndex = (currentYellowIndex + 1) % yellowRects.length;
            }
            updateYellowIndexDisplay();
            scaleCanvas();
        });
        
        // Go 버튼: 현재 선택된 노란색 사각형 위치로 이동
        document.getElementById('btnGoToYellow').addEventListener('click', () => {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                console.log('❌ 이동할 노란색 사각형이 선택되지 않았습니다.');
                return;
            }
            
            const yellowRect = yellowRects[currentYellowIndex];
            const ox = yellowRect.x;
            const oy = yellowRect.y;
            
            selectedPixel = { x: ox, y: oy };
            
            // 색상 구하기 (canvas1 기준)
            let rgbText = '';
            let r=0,g=0,b=0;
            try {
                const pixel = ctx1.getImageData(ox, oy, 1, 1).data;
                r = pixel[0]; g = pixel[1]; b = pixel[2];
                rgbText = ` - RGB(${r},${g},${b})`;
            } catch (ex) { rgbText = '' }
            
            // 좌표+색상 표시
            const coordDisp = document.getElementById('coordDisplay');
            if(coordDisp) coordDisp.textContent = `${ox}, ${oy}${rgbText}`;
            
            // 색 박스 표시
            const colorBox = document.getElementById('colorBox');
            if(colorBox) colorBox.style.background = `rgb(${r},${g},${b})`;
            
            // 귀퉁이 정보 업데이트
            if(showCorners && selectedPixel) {
                const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
                const cornerSize = parseInt(document.getElementById('cornerSize').value) || 4;
                cornerRects = getCornerRects(selectedPixel.x, selectedPixel.y, rectSize, cornerSize);
                
                // 귀퉁이 유효 픽셀수 업데이트
                const pixelCounts = cornerRects.map(r => r.visibleW * r.visibleH);
                const cornerPixelsDisplay = document.getElementById('cornerPixelsDisplay');
                if(cornerPixelsDisplay) cornerPixelsDisplay.textContent = `[${pixelCounts.join(', ')}]`;
                
                // 기준 사각형의 흰색점 개수 계산 및 표시
                const baseWhiteCount = countWhitePixels(ctx1, selectedPixel.x, selectedPixel.y, rectSize);
                const baseRectWhite = document.getElementById('baseRectWhite');
                if(baseRectWhite) {
                    const baseMaxPixels = rectSize * rectSize;
                    baseRectWhite.textContent = baseWhiteCount;
                    baseRectWhite.style.color = (baseWhiteCount === baseMaxPixels) ? '#006600' : '#cc0000';
                }
                
                // 4가지 경로 모두 계산
                pathRects01 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 1) || [];
                pathRects23 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 2, 3) || [];
                pathRects02 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 2) || [];
                pathRects13 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 1, 3) || [];
                
                // 경로별 개수 갱신
                const pathCount01El = document.getElementById('pathCount01');
                const pathCount23El = document.getElementById('pathCount23');
                const pathCount02El = document.getElementById('pathCount02');
                const pathCount13El = document.getElementById('pathCount13');
                if(pathCount01El) pathCount01El.textContent = pathRects01.length;
                if(pathCount23El) pathCount23El.textContent = pathRects23.length;
                if(pathCount02El) pathCount02El.textContent = pathRects02.length;
                if(pathCount13El) pathCount13El.textContent = pathRects13.length;
                
                // 경로별 흰색점 개수 계산
                const calculateWhiteCounts = (rects) => {
                    return rects.map(rect => countWhitePixels(ctx1, rect.x, rect.y, cornerSize));
                };
                
                const whiteCounts01 = calculateWhiteCounts(pathRects01);
                const whiteCounts23 = calculateWhiteCounts(pathRects23);
                const whiteCounts02 = calculateWhiteCounts(pathRects02);
                const whiteCounts13 = calculateWhiteCounts(pathRects13);
                
                // 버튼 생성 함수
                const createButtons = (counts, rects, pathName) => {
                    return counts.map((count, idx) => {
                        const rect = rects[idx];
                        const maxPixels = cornerSize * cornerSize;
                        const isAllWhite = (count === maxPixels);
                        const buttonStyle = isAllWhite 
                            ? 'background:#4CAF50; color:white; border:1px solid #45a049; cursor:pointer;'
                            : 'background:#ccc; color:#666; border:1px solid #999; cursor:not-allowed;';
                        return `<button data-path="${pathName}" data-idx="${idx}" data-x="${rect.x}" data-y="${rect.y}" 
                                        style="padding:2px 6px; margin:2px; border-radius:3px; ${buttonStyle}" 
                                        ${isAllWhite ? '' : 'disabled'}>${count}</button>`;
                    }).join('');
                };
                
                if(document.getElementById('pathWhite01')) document.getElementById('pathWhite01').innerHTML = createButtons(whiteCounts01, pathRects01, 'path01');
                if(document.getElementById('pathWhite23')) document.getElementById('pathWhite23').innerHTML = createButtons(whiteCounts23, pathRects23, 'path23');
                if(document.getElementById('pathWhite02')) document.getElementById('pathWhite02').innerHTML = createButtons(whiteCounts02, pathRects02, 'path02');
                if(document.getElementById('pathWhite13')) document.getElementById('pathWhite13').innerHTML = createButtons(whiteCounts13, pathRects13, 'path13');
                
                // 버튼 클릭 이벤트 추가
                const addButtonClickEvents = (pathName) => {
                    document.querySelectorAll(`button[data-path="${pathName}"]`).forEach(btn => {
                        if (!btn.disabled) {
                            btn.onclick = () => {
                                const idx = btn.getAttribute('data-idx');
                                const x = parseInt(btn.getAttribute('data-x'));
                                const y = parseInt(btn.getAttribute('data-y'));
                                console.log(`✅ 경로 ${pathName} [${idx}] 클릭: (${x}, ${y}), 크기: ${cornerSize}x${cornerSize}`);
                                tempYellowRect = {
                                    x: x,
                                    y: y,
                                    size: cornerSize
                                };
                                
                                const angle = updateTempYellowAngle();
                                if (angle !== null) {
                                    console.log(`   각도: ${angle}° (기준 사각형 중심으로부터)`);
                                }
                                
                                console.log(`   임시 노란색 사각형 설정됨. F9 키를 눌러 확정하세요.`);
                                scaleCanvas();
                            };
                        }
                    });
                };
                
                addButtonClickEvents('path01');
                addButtonClickEvents('path23');
                addButtonClickEvents('path02');
                addButtonClickEvents('path13');
            }
            
            console.log(`✅ 노란색 사각형 [${currentYellowIndex + 1}]번 위치로 이동: (${ox}, ${oy})`);
            scaleCanvas();
        });
        
        // 초기 디스플레이 설정
        updateYellowIndexDisplay();

        canvas2.addEventListener('click', function(e) {
            const index = parseInt(scaleRange.value);
            const scale = scaleValues[index];
            const rect = canvas2.getBoundingClientRect();
            // 확대된 화면에서 클릭한 좌표 계산
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            // 원래 좌표 계산
            const ox = Math.floor(cx / scale);
            const oy = Math.floor(cy / scale);
            selectedPixel = { x: ox, y: oy };
            // 색상 구하기 (canvas1 기준)
            let rgbText = '';
            let r=0,g=0,b=0;
            try {
                const pixel = ctx1.getImageData(ox, oy, 1, 1).data;
                r = pixel[0]; g = pixel[1]; b = pixel[2];
                rgbText = ` - RGB(${r},${g},${b})`;
            } catch (ex) { rgbText = '' }
            // 좌표+색상 표시
            const coordDisp = document.getElementById('coordDisplay');
            if(coordDisp) coordDisp.textContent = `${ox}, ${oy}${rgbText}`;
            // 색 박스 표시
            const colorBox = document.getElementById('colorBox');
            if(colorBox) colorBox.style.background = `rgb(${r},${g},${b})`;
            // 귀퉁이 반영
            if(showCorners && selectedPixel) {
                const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
                const cornerSize = parseInt(document.getElementById('cornerSize').value) || 4;
                cornerRects = getCornerRects(selectedPixel.x, selectedPixel.y, rectSize, cornerSize);
                
                // 귀퉁이 유효 픽셀수 업데이트
                const pixelCounts = cornerRects.map(r => r.visibleW * r.visibleH);
                const cornerPixelsDisplay = document.getElementById('cornerPixelsDisplay');
                if(cornerPixelsDisplay) cornerPixelsDisplay.textContent = `[${pixelCounts.join(', ')}]`;
                
                // 기준 사각형의 흰색점 개수 계산 및 표시
                const baseWhiteCount = countWhitePixels(ctx1, selectedPixel.x, selectedPixel.y, rectSize);
                const baseRectWhite = document.getElementById('baseRectWhite');
                if(baseRectWhite) {
                    const baseMaxPixels = rectSize * rectSize;
                    baseRectWhite.textContent = baseWhiteCount;
                    baseRectWhite.style.color = (baseWhiteCount === baseMaxPixels) ? '#006600' : '#cc0000';
                }
                
                // 4가지 경로 모두 계산
                pathRects01 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 1) || [];
                pathRects23 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 2, 3) || [];
                pathRects02 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 2) || [];
                pathRects13 = getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 1, 3) || [];
                
                const maxPixels = cornerSize * cornerSize;
                
                // 각 경로별 흰색 픽셀 개수 계산 및 버튼 생성
                const calculateWhiteCounts = (rects, pathName) => {
                    return rects.map((pt, idx) => {
                        const count = countWhitePixels(ctx1, pt.x, pt.y, cornerSize);
                        const isAllWhite = (count === maxPixels);
                        
                        // 버튼 생성
                        const btnStyle = isAllWhite 
                            ? 'background:#e6ffe6; color:#006600; font-weight:bold; border:1px solid #00aa00; cursor:pointer;'
                            : 'background:#f0f0f0; color:#999; border:1px solid #ccc; cursor:not-allowed;';
                        
                        const disabled = isAllWhite ? '' : ' disabled';
                        const btnId = `btn_${pathName}_${idx}`;
                        
                        return `<button id="${btnId}" data-path="${pathName}" data-idx="${idx}" data-x="${pt.x}" data-y="${pt.y}" ${disabled} style="padding:2px 6px; margin:1px; font-size:0.85em; ${btnStyle}">[${idx}] ${count}</button>`;
                    });
                };
                
                const whiteCounts01 = calculateWhiteCounts(pathRects01, 'path01');
                const whiteCounts23 = calculateWhiteCounts(pathRects23, 'path23');
                const whiteCounts02 = calculateWhiteCounts(pathRects02, 'path02');
                const whiteCounts13 = calculateWhiteCounts(pathRects13, 'path13');
                
                // 개수 표시 업데이트
                if(document.getElementById('pathCount01')) document.getElementById('pathCount01').textContent = pathRects01.length;
                if(document.getElementById('pathCount23')) document.getElementById('pathCount23').textContent = pathRects23.length;
                if(document.getElementById('pathCount02')) document.getElementById('pathCount02').textContent = pathRects02.length;
                if(document.getElementById('pathCount13')) document.getElementById('pathCount13').textContent = pathRects13.length;
                
                // 흰색점 개수 버튼 표시 업데이트
                if(document.getElementById('pathWhite01')) document.getElementById('pathWhite01').innerHTML = whiteCounts01.join(' ') || '-';
                if(document.getElementById('pathWhite23')) document.getElementById('pathWhite23').innerHTML = whiteCounts23.join(' ') || '-';
                if(document.getElementById('pathWhite02')) document.getElementById('pathWhite02').innerHTML = whiteCounts02.join(' ') || '-';
                if(document.getElementById('pathWhite13')) document.getElementById('pathWhite13').innerHTML = whiteCounts13.join(' ') || '-';
                
                // 버튼 클릭 이벤트 추가
                const addButtonClickEvents = (pathName) => {
                    document.querySelectorAll(`button[data-path="${pathName}"]`).forEach(btn => {
                        if (!btn.disabled) {
                            btn.onclick = () => {
                                const idx = btn.getAttribute('data-idx');
                                const x = parseInt(btn.getAttribute('data-x'));
                                const y = parseInt(btn.getAttribute('data-y'));
                                console.log(`✅ 경로 ${pathName} [${idx}] 클릭: (${x}, ${y}), 크기: ${cornerSize}x${cornerSize}`);
                                // 임시 노란색 사각형으로 설정 (F9로 확정)
                                tempYellowRect = {
                                    x: x,
                                    y: y,
                                    size: cornerSize
                                };
                                
                                // 각도 계산 및 표시
                                const angle = updateTempYellowAngle();
                                if (angle !== null) {
                                    console.log(`   각도: ${angle}° (기준 사각형 중심으로부터)`);
                                }
                                
                                console.log(`   임시 노란색 사각형 설정됨. F9 키를 눌러 확정하세요.`);
                                scaleCanvas(); // 화면 갱신
                            };
                        }
                    });
                };
                
                addButtonClickEvents('path01');
                addButtonClickEvents('path23');
                addButtonClickEvents('path02');
                addButtonClickEvents('path13');
            } else {
                cornerRects = [];
                pathRects01 = [];
                pathRects23 = [];
                pathRects02 = [];
                pathRects13 = [];
                // 귀퉁이 픽셀수 초기화
                const cornerPixelsDisplay = document.getElementById('cornerPixelsDisplay');
                if(cornerPixelsDisplay) cornerPixelsDisplay.textContent = '[—,—,—,—]';
                // 기준 사각형 흰색점 초기화
                const baseRectWhite = document.getElementById('baseRectWhite');
                if(baseRectWhite) baseRectWhite.textContent = '—';
                // 개수 초기화
                ['pathCount01', 'pathCount23', 'pathCount02', 'pathCount13'].forEach(id => {
                    if(document.getElementById(id)) document.getElementById(id).textContent = 0;
                });
                // 흰색점 초기화
                ['pathWhite01', 'pathWhite23', 'pathWhite02', 'pathWhite13'].forEach(id => {
                    if(document.getElementById(id)) document.getElementById(id).innerHTML = '-';
                });
            }
            // 캔버스2 다시 그림 (사각형 오버레이 위해)
            scaleCanvas();
        });

        // scaleCanvas에 사각형 그리기 보강
        const origScaleCanvas = scaleCanvas;
        scaleCanvas = function() {
            origScaleCanvas(); // 원래 내용 실행
            const index = parseInt(scaleRange.value);
            const scale = scaleValues[index];
            if (selectedPixel) {
                const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
                ctx2.save();
                // 메인 사각형: 빨강/검정 점선
                ctx2.strokeStyle = 'red';
                ctx2.lineWidth = Math.max(1, scale/8);
                ctx2.setLineDash([4, 4]);
                ctx2.lineDashOffset = 0;
                ctx2.strokeRect(selectedPixel.x * scale+0.5, selectedPixel.y * scale+0.5, rectSize * scale-1, rectSize * scale-1);
                ctx2.strokeStyle = 'black';
                ctx2.setLineDash([4, 4]);
                ctx2.lineDashOffset = 4;
                ctx2.strokeRect(selectedPixel.x * scale+0.5, selectedPixel.y * scale+0.5, rectSize * scale-1, rectSize * scale-1);

                // 귀퉁이 사각형 (원래 계산된 위치에 표시, 음수 좌표 포함)
                if (showCorners && cornerRects.length > 0) {
                    for (const r of cornerRects) {
                        // 원래 좌표(r.x, r.y)와 원래 크기(r.w, r.h)로 그림
                        // 캔버스가 자동으로 보이는 영역만 렌더링
                        ctx2.strokeStyle = 'blue';
                        ctx2.setLineDash([2, 2]);
                        ctx2.lineDashOffset = 0;
                        ctx2.strokeRect(r.x * scale+0.5, r.y * scale+0.5, r.w * scale-1, r.h * scale-1);
                        ctx2.strokeStyle = 'black';
                        ctx2.setLineDash([2, 2]);
                        ctx2.lineDashOffset = 2;
                        ctx2.strokeRect(r.x * scale+0.5, r.y * scale+0.5, r.w * scale-1, r.h * scale-1);
                    }
                    ctx2.setLineDash([]);
                }
                // 경로 점들 표시 (4가지 경로를 각각 다른 색으로)
                if (showCorners) {
                    const cornerSize = parseInt(document.getElementById('cornerSize').value) || 4;
                    
                    // 상단 수평 (0→1): 녹색
                    if (pathRects01.length > 0) {
                        ctx2.fillStyle = 'rgba(0, 255, 0, 0.5)';
                        for (const pt of pathRects01) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize * scale)/2, pt.y * scale + (cornerSize * scale)/2, Math.max(2, scale/4), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    
                    // 하단 수평 (2→3): 청록색
                    if (pathRects23.length > 0) {
                        ctx2.fillStyle = 'rgba(0, 200, 200, 0.5)';
                        for (const pt of pathRects23) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize * scale)/2, pt.y * scale + (cornerSize * scale)/2, Math.max(2, scale/4), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    
                    // 좌측 수직 (0→2): 주황색
                    if (pathRects02.length > 0) {
                        ctx2.fillStyle = 'rgba(255, 165, 0, 0.5)';
                        for (const pt of pathRects02) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize * scale)/2, pt.y * scale + (cornerSize * scale)/2, Math.max(2, scale/4), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    
                    // 우측 수직 (1→3): 보라색
                    if (pathRects13.length > 0) {
                        ctx2.fillStyle = 'rgba(200, 0, 200, 0.5)';
                        for (const pt of pathRects13) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize * scale)/2, pt.y * scale + (cornerSize * scale)/2, Math.max(2, scale/4), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                }
                ctx2.setLineDash([]);
                
                // F8로 저장된 녹색 사각형들 그리기
                if (greenRects.length > 0) {
                    ctx2.fillStyle = 'rgba(0, 255, 0, 0.3)'; // 반투명 녹색
                    ctx2.strokeStyle = 'rgba(0, 200, 0, 0.8)';
                    ctx2.lineWidth = Math.max(1, scale/8);
                    ctx2.setLineDash([]);
                    
                    for (const rect of greenRects) {
                        ctx2.fillRect(rect.x * scale, rect.y * scale, rect.size * scale, rect.size * scale);
                        ctx2.strokeRect(rect.x * scale+0.5, rect.y * scale+0.5, rect.size * scale-1, rect.size * scale-1);
                    }
                }
                
                // F9로 확정된 노란색 사각형들 그리기
                if (yellowRects.length > 0) {
                    for (let i = 0; i < yellowRects.length; i++) {
                        const rect = yellowRects[i];
                        const isSelected = (i === currentYellowIndex);
                        
                        if (isSelected) {
                            // 선택된 사각형: 빨간색 두꺼운 테두리
                            ctx2.fillStyle = 'rgba(255, 100, 100, 0.4)';
                            ctx2.strokeStyle = 'rgba(255, 0, 0, 1.0)';
                            ctx2.lineWidth = Math.max(3, scale/4);
                        } else {
                            // 일반 노란색 사각형
                            ctx2.fillStyle = 'rgba(255, 255, 0, 0.3)';
                            ctx2.strokeStyle = 'rgba(200, 200, 0, 0.8)';
                            ctx2.lineWidth = Math.max(1, scale/8);
                        }
                        
                        ctx2.setLineDash([]);
                        ctx2.fillRect(rect.x * scale, rect.y * scale, rect.size * scale, rect.size * scale);
                        ctx2.strokeRect(rect.x * scale+0.5, rect.y * scale+0.5, rect.size * scale-1, rect.size * scale-1);
                    }
                }
                
                // 임시 노란색 사각형 그리기 (F9로 확정 전, 점선 테두리)
                if (tempYellowRect) {
                    ctx2.fillStyle = 'rgba(255, 200, 0, 0.4)'; // 조금 더 진한 노란색
                    ctx2.strokeStyle = 'rgba(255, 150, 0, 1.0)';
                    ctx2.lineWidth = Math.max(2, scale/6);
                    ctx2.setLineDash([5, 5]); // 점선
                    
                    ctx2.fillRect(tempYellowRect.x * scale, tempYellowRect.y * scale, tempYellowRect.size * scale, tempYellowRect.size * scale);
                    ctx2.strokeRect(tempYellowRect.x * scale+0.5, tempYellowRect.y * scale+0.5, tempYellowRect.size * scale-1, tempYellowRect.size * scale-1);
                    ctx2.setLineDash([]); // 점선 해제
                }
                
                ctx2.restore();
            }
        }