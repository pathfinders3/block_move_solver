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
 * 특정 사각형 영역에서 흰색 픽셀(RGB가 임계값 이상) 개수를 셉니다.
 * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
 * @param {number} x - 사각형 시작 x 좌표
 * @param {number} y - 사각형 시작 y 좌표
 * @param {number} size - 사각형 크기
 * @returns {number} 흰색 픽셀 개수
 */
function countWhitePixels(ctx, x, y, size) {
    const thresholdInput = document.getElementById('whiteThreshold');
    const thresholdValue = thresholdInput ? parseInt(thresholdInput.value, 10) : 245;
    const whiteThreshold = Number.isNaN(thresholdValue)
        ? 245
        : Math.min(255, Math.max(0, thresholdValue));

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
            if (data[i] >= whiteThreshold && data[i+1] >= whiteThreshold && data[i+2] >= whiteThreshold) {
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
            if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
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
        
        // 데카르트 좌표계 기준으로 dx, dy로부터 각도(0~359도) 계산
        function calculateCartesianAngle(dx, dy) {
            // 데카르트 좌표계로 변환 (Y축 반전: 캔버스는 Y가 아래로 증가, 데카르트는 위로 증가)
            // atan2는 -180~180 범위를 반환, 0~359로 변환
            let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
            if (angle < 0) angle += 360;
            return Math.round(angle);
        }
        
        // 원형 각도 차이 계산 (기본 함수)
        function getCircularAngleDiff(angle1, angle2, signed = true) {
            let diff = angle1 - angle2;
            if (signed) {
                // 방향 포함 (-180 ~ +180)
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
            } else {
                // 절대값만 (0 ~ 180)
                diff = Math.abs(diff);
                if (diff > 180) diff = 360 - diff;
            }
            return diff;
        }
        
        // 각도 차이와 스타일 정보 계산 (표시용)
        function calculateAngleDiffWithStyle(angle1, angle2) {
            const diff = getCircularAngleDiff(angle1, angle2, true);
            const absDiff = Math.abs(diff);
            const tolerance = parseInt(document.getElementById('angleTolerance').value) || 30;
            
            const bgStyle = absDiff <= tolerance ? 'background-color:#ccaa00;padding:2px 4px;border-radius:3px;' : '';
            const sign = diff >= 0 ? '+' : '';
            const diffText = ` <span style="font-size:0.9em;color:#999;">(${sign}${diff})</span>`;
            
            return { bgStyle, diffText, diff, absDiff };
        }

        // 두 사각형 중심점을 기준으로 각도 계산
        function calculateRectToRectAngle(fromX, fromY, fromSize, toX, toY, toSize) {
            const fromCenterX = fromX + fromSize / 2;
            const fromCenterY = fromY + fromSize / 2;
            const toCenterX = toX + toSize / 2;
            const toCenterY = toY + toSize / 2;
            const dx = toCenterX - fromCenterX;
            const dy = toCenterY - fromCenterY;
            return calculateCartesianAngle(dx, dy);
        }
        
        // 노란색 사각형을 yellowRects 배열에 추가하고 각도 검사 수행
        function addYellowRectWithAngleCheck(x, y, size) {
            // 이전 사각형으로부터의 각도 계산
            let angle = null;
            let angleExceeded = false;
            let angleDiffValue = null;
            let expectedAngle = null;
            
            if (yellowRects.length > 0) {
                const prevRect = yellowRects[yellowRects.length - 1];
                angle = calculateRectToRectAngle(prevRect.x, prevRect.y, prevRect.size, x, y, size);
                
                // 각도 허용오차 검사 (이전 사각형의 각도와 비교)
                if (prevRect.angle !== null && prevRect.angle !== undefined) {
                    const tolerance = parseInt(document.getElementById('angleTolerance').value) || 30;
                    const angleDiff = Math.abs(getCircularAngleDiff(angle, prevRect.angle, false));
                    
                    // 속성 저장용 변수 설정
                    expectedAngle = prevRect.angle;
                    angleDiffValue = angleDiff;
                    angleExceeded = (angleDiff > tolerance);
                    
                    const warningContainer = document.getElementById('angleWarningContainer');
                    if (angleDiff > tolerance) {
                        // 경고 메시지 표시
                        const sign = getCircularAngleDiff(angle, prevRect.angle, true) >= 0 ? '+' : '';
                        const signedDiff = getCircularAngleDiff(angle, prevRect.angle, true);
                        if (warningContainer) {
                            warningContainer.innerHTML = `<div style="background:#ffebcc; border:2px solid #ff8800; border-radius:5px; padding:8px; margin-top:5px; color:#333;">` +
                                `<strong style="color:#cc0000;">⚠️ 각도 허용오차 초과!</strong><br>` +
                                `<span style="margin-left:20px; color:#333;">이전 각도: <strong style="color:#333;">${prevRect.angle}°</strong></span><br>` +
                                `<span style="margin-left:20px; color:#333;">현재 각도: <strong style="color:#333;">${angle}°</strong></span><br>` +
                                `<span style="margin-left:20px; color:#333;">각도 차이: <strong style="color:#cc0000;">${sign}${signedDiff}° (절대값: ${angleDiff}°)</strong></span><br>` +
                                `<span style="margin-left:20px; color:#333;">허용오차: <strong style="color:#333;">±${tolerance}°</strong></span>` +
                                `</div>`;
                        }
                        console.log(`⚠️ 각도 허용오차 초과: ${angleDiff}° > ${tolerance}°`);
                    } else {
                        // 정상 범위 - 경고 제거
                        if (warningContainer) {
                            warningContainer.innerHTML = '';
                        }
                    }
                }
            } else {
                // 첫 번째 사각형 - 경고 제거
                const warningContainer = document.getElementById('angleWarningContainer');
                if (warningContainer) {
                    warningContainer.innerHTML = '';
                }
            }
            
            // yellowRects 배열에 추가
            yellowRects.push({
                x: x,
                y: y,
                size: size,
                angle: angle,
                angleExceeded: angleExceeded,
                angleDiff: angleDiffValue,
                expectedAngle: expectedAngle
            });
            
            console.log(`✅ 노란색 사각형 추가: (${x}, ${y}), 크기: ${size}x${size}, 각도: ${angle !== null ? angle + '°' : 'N/A'}`);
            if (angleExceeded) {
                console.log(`   ⚠️ 각도 허용오차 초과: ${angleDiffValue}° (기대: ${expectedAngle}°)`);
            }
            
            // 방금 추가된 사각형을 현재 선택으로 설정
            currentYellowIndex = yellowRects.length - 1;
            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
        }
        
        // 각도 표시 함수 (미리 계산된 각도 사용)
        function updateTempYellowAngle(preCalculatedAngle = null) {
            if (tempYellowRect && selectedPixel) {
                let angle;
                
                if (preCalculatedAngle !== null) {
                    // 미리 계산된 각도 사용
                    angle = preCalculatedAngle;
                } else {
                    // 실시간 계산 (예: IJKL 키 사용 시)
                    const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
                    angle = calculateRectToRectAngle(
                        selectedPixel.x,
                        selectedPixel.y,
                        rectSize,
                        tempYellowRect.x,
                        tempYellowRect.y,
                        tempYellowRect.size
                    );
                }
                
                const angleDisplay = document.getElementById('tempYellowAngleDisplay');
                if (angleDisplay) {
                    // yellowAngleDisplay의 각도와 비교 (현재 선택된 노란색 사각형의 각도)
                    let bgStyle = '';
                    let diffText = '';
                    
                    if (currentYellowIndex >= 0 && currentYellowIndex < yellowRects.length) {
                        const currentRect = yellowRects[currentYellowIndex];
                        if (currentRect.angle !== null && currentRect.angle !== undefined) {
                            const result = calculateAngleDiffWithStyle(angle, currentRect.angle);
                            bgStyle = result.bgStyle;
                            diffText = result.diffText;
                        }
                    }
                    
                    angleDisplay.innerHTML = `| 각도: <span style="font-weight:bold;color:#cc6600;${bgStyle}">${angle}°</span>${diffText}`;
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
                        // 공통 함수로 노란색 사각형 추가
                        addYellowRectWithAngleCheck(selectedPixel.x, selectedPixel.y, rectSize);
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
                    // 원래 사각형 크기를 임시 사각형의 크기로 변경
                    const rectSizeInput = document.getElementById('rectSize');
                    const currentRectSize = parseInt(rectSizeInput.value) || 4;
                    if (currentRectSize !== tempYellowRect.size) {
                        rectSizeInput.value = tempYellowRect.size;
                        console.log(`   원래 사각형 크기 변경: ${currentRectSize} → ${tempYellowRect.size}`);
                    }
                    
                    // selectedPixel을 임시 사각형 위치로 이동
                    selectedPixel = { x: tempYellowRect.x, y: tempYellowRect.y };

                    // 공통 함수로 노란색 사각형 추가
                    addYellowRectWithAngleCheck(tempYellowRect.x, tempYellowRect.y, tempYellowRect.size);

                    // 경로 재계산 (새로 확정된 각도를 기준으로)
                    if (showCorners) {
                        updateCornerAndPathInfo();
                    }

                    console.log(`   총 ${yellowRects.length}개의 노란색 사각형 저장됨`);
                    
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
                    
                    // 로깅용 귀퉁이 정보 출력
                    cornerRects = getCornerRects(selectedPixel.x, selectedPixel.y, rectSize, cornerSize);
                    console.log(`=== 귀퉁이 사각형 정보 (원래:${rectSize}x${rectSize}, 귀퉁이:${cornerSize}x${cornerSize}) ===`);
                    const pixelCounts = [];
                    cornerRects.forEach((r, idx) => {
                        const labels = ['좌상', '우상', '좌하', '우하'];
                        const pixelCount = r.visibleW * r.visibleH;
                        pixelCounts.push(pixelCount);
                        console.log(`${labels[idx]}: 원래좌표(${r.x},${r.y}) 크기${r.w}x${r.h} | 보이는영역(${r.visibleX},${r.visibleY}) 크기${r.visibleW}x${r.visibleH} | 유효픽셀: ${pixelCount}`);
                    });
                    
                    const baseWhiteCount = countWhitePixels(ctx1, selectedPixel.x, selectedPixel.y, rectSize);
                    console.log(`기준 사각형 (${selectedPixel.x},${selectedPixel.y}) 크기${rectSize}x${rectSize}: 흰색점 ${baseWhiteCount}개`);
                    
                    // 공통 업데이트 함수 호출
                    updateCornerAndPathInfo();
                    
                    // 로깅용 경로 정보 출력
                    console.log(`경로 계산 (원래:${rectSize}x${rectSize}, 귀퉁이:${cornerSize}x${cornerSize}):`);
                    console.log(`  0→1 (상단 수평): [n]${pathRects01_n.length}개 / [n-1]${pathRects01_n1.length}개`);
                    console.log(`  2→3 (하단 수평): [n]${pathRects23_n.length}개 / [n-1]${pathRects23_n1.length}개`);
                    console.log(`  0→2 (좌측 수직): [n]${pathRects02_n.length}개 / [n-1]${pathRects02_n1.length}개`);
                    console.log(`  1→3 (우측 수직): [n]${pathRects13_n.length}개 / [n-1]${pathRects13_n1.length}개`);
                } else {
                    cornerRects = [];
                    pathRects01_n = [];
                    pathRects23_n = [];
                    pathRects02_n = [];
                    pathRects13_n = [];
                    pathRects01_n1 = [];
                    pathRects23_n1 = [];
                    pathRects02_n1 = [];
                    pathRects13_n1 = [];
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
                    updateCornerAndPathInfo();
                } else {
                    cornerRects = [];
                    pathRects01_n = [];
                    pathRects23_n = [];
                    pathRects02_n = [];
                    pathRects13_n = [];
                    pathRects01_n1 = [];
                    pathRects23_n1 = [];
                    pathRects02_n1 = [];
                    pathRects13_n1 = [];
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
        // 4가지 경로를 저장하는 배열들 (n 크기)
        let pathRects01_n = []; // 상단 수평 (0→1) n크기
        let pathRects23_n = []; // 하단 수평 (2→3) n크기
        let pathRects02_n = []; // 좌측 수직 (0→2) n크기
        let pathRects13_n = []; // 우측 수직 (1→3) n크기
        // 4가지 경로를 저장하는 배열들 (n-1 크기)
        let pathRects01_n1 = []; // 상단 수평 (0→1) n-1크기
        let pathRects23_n1 = []; // 하단 수평 (2→3) n-1크기
        let pathRects02_n1 = []; // 좌측 수직 (0→2) n-1크기
        let pathRects13_n1 = []; // 우측 수직 (1→3) n-1크기
        // 경로 버튼 클릭: 임시 노란색 사각형 (F9로 확정 전)
        let tempYellowRect = null; // {x: number, y: number, size: number} | null
        // F9: 확정된 노란색 사각형들을 저장하는 배열
        let yellowRects = []; // {x: number, y: number, size: number}[]
        let currentYellowIndex = -1; // 현재 선택된 노란색 사각형 인덱스 (-1은 선택 안 됨)

        // 유틸리티: 두 사각형이 겹치는지 확인
        function rectsOverlap(rect1X, rect1Y, rect1Size, rect2) {
            return rect1X < rect2.x + rect2.size &&
                   rect1X + rect1Size > rect2.x &&
                   rect1Y < rect2.y + rect2.size &&
                   rect1Y + rect1Size > rect2.y;
        }

        // 경로 후보 사각형의 각도 및 각도차 계산
        function getPathRectAngleInfo(pt, cornerSize, baseX, baseY, expectedAngle) {
            const targetX = pt.x + cornerSize / 2;
            const targetY = pt.y + cornerSize / 2;
            const dx = targetX - baseX;
            const dy = targetY - baseY;
            const angle = calculateCartesianAngle(dx, dy);

            let angleDiff = null;
            if (expectedAngle !== null && expectedAngle !== undefined) {
                angleDiff = Math.abs(getCircularAngleDiff(angle, expectedAngle, false));
            }

            return { angle, angleDiff };
        }

        // 각도/추천 규칙에 따라 버튼 테두리 색상 결정
        function resolvePathButtonBorderColor(pt, cornerSize, angleDiff, tolerance, bestMatch) {
            if (angleDiff === null || angleDiff > tolerance) return '';

            if (
                bestMatch !== null &&
                Math.abs(angleDiff - bestMatch.minDiff) < 0.001 &&
                cornerSize === bestMatch.maxSize
            ) {
                const isContainedInLarger = bestMatch.bestRects.some(largerRect => {
                    if (largerRect.size <= cornerSize) return false;

                    return pt.x >= largerRect.x &&
                           pt.y >= largerRect.y &&
                           pt.x + cornerSize <= largerRect.x + largerRect.size &&
                           pt.y + cornerSize <= largerRect.y + largerRect.size;
                });

                return isContainedInLarger ? '#FF8C00' : '#FF0000';
            }

            return '#FF8C00';
        }

        // 계산된 상태를 기반으로 버튼 HTML 생성
        function renderPathButtonHTML(pt, idx, pathName, angle, whiteCount, isAllWhite, overlapsYellow, borderColor, angleDiff, expectedAngle) {
            let buttonStyle;
            let disabled;

            if (isAllWhite && overlapsYellow) {
                const border = borderColor || '#000000';
                buttonStyle = `background:#FFD700; color:#000; border:3px solid ${border}; cursor:pointer; font-weight:bold;`;
                disabled = '';
            } else if (isAllWhite) {
                const border = borderColor || '#45a049';
                buttonStyle = `background:#4CAF50; color:white; border:3px solid ${border}; cursor:pointer;`;
                disabled = '';
            } else {
                buttonStyle = 'background:#ccc; color:#666; border:1px solid #999; cursor:not-allowed;';
                disabled = ' disabled';
            }

            const angleDiffLabel = (angleDiff !== null) ? ` · Δ${angleDiff}°` : '';
            const angleTooltip = (angleDiff !== null && expectedAngle !== null && expectedAngle !== undefined)
                ? ` title="각도:${angle}°, 기준:${expectedAngle}°, 차이:${angleDiff}°"`
                : '';

            return `<button data-path="${pathName}" data-idx="${idx}" data-x="${pt.x}" data-y="${pt.y}" data-angle="${angle}"
                                style="padding:2px 6px; margin:2px; border-radius:3px; ${buttonStyle}" 
                                ${angleTooltip}${disabled}>${whiteCount}${angleDiffLabel}</button>`;
        }

        // 경로별 흰색점 개수 계산 및 버튼 HTML 생성
        function calculatePathWhiteCounts(rects, pathName, cornerSize, maxPixels, bestMatch = null) {
            // 기대 각도: 항상 마지막으로 확정된 노란색 사각형의 각도
            let expectedAngle = null;
            if (yellowRects.length > 0) {
                expectedAngle = yellowRects[yellowRects.length - 1].angle;
            }

            const tolerance = parseInt(document.getElementById('angleTolerance').value) || 30;
            const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
            const baseX = selectedPixel.x + rectSize / 2;
            const baseY = selectedPixel.y + rectSize / 2;
            
            return rects.map((pt, idx) => {
                const whiteCount = countWhitePixels(ctx1, pt.x, pt.y, cornerSize);
                const isAllWhite = (whiteCount === maxPixels);
                
                // yellowRects와 겹치는지 확인
                const overlapsYellow = yellowRects.some(yellowRect => 
                    rectsOverlap(pt.x, pt.y, cornerSize, yellowRect)
                );

                const { angle, angleDiff } = getPathRectAngleInfo(pt, cornerSize, baseX, baseY, expectedAngle);
                const borderColor = resolvePathButtonBorderColor(pt, cornerSize, angleDiff, tolerance, bestMatch);

                return renderPathButtonHTML(
                    pt,
                    idx,
                    pathName,
                    angle,
                    whiteCount,
                    isAllWhite,
                    overlapsYellow,
                    borderColor,
                    angleDiff,
                    expectedAngle
                );
            });
        }

        // 헬퍼 함수: 사각형의 각도 차이 계산 (공통 로직)
        function calculateRectAngleDiff(pt, size, baseX, baseY, expectedAngle) {
            // 흰색 픽셀 확인
            const maxPixels = size * size;
            const whiteCount = countWhitePixels(ctx1, pt.x, pt.y, size);
            if (whiteCount !== maxPixels) return null;
            
            // 각도 계산
            const targetX = pt.x + size / 2;
            const targetY = pt.y + size / 2;
            const dx = targetX - baseX;
            const dy = targetY - baseY;
            const angle = calculateCartesianAngle(dx, dy);
            
            // 각도 차이 계산
            const diff = Math.abs(getCircularAngleDiff(angle, expectedAngle, false));
            
            return diff;
        }

        // 모든 경로에서 허용오차 내 최소 각도 차이와 최대 크기 찾기
        function findMinAngleDiffAndMaxSize(allPathRectsWithSize) {
            // allPathRectsWithSize: [{ rects, size }, ...]
            // 기대 각도: 항상 마지막으로 확정된 노란색 사각형의 각도
            let expectedAngle = null;
            if (yellowRects.length > 0) {
                expectedAngle = yellowRects[yellowRects.length - 1].angle;
            }
            
            if (expectedAngle === null || expectedAngle === undefined) {
                return null;
            }
            
            const tolerance = parseInt(document.getElementById('angleTolerance').value) || 30;
            const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
            const baseX = selectedPixel.x + rectSize / 2;
            const baseY = selectedPixel.y + rectSize / 2;
            
            let minDiff = null;
            
            // 1단계: 최소 각도 차이 찾기
            allPathRectsWithSize.forEach(({ rects, size }) => {
                if (!rects) return;
                
                rects.forEach(pt => {
                    const diff = calculateRectAngleDiff(pt, size, baseX, baseY, expectedAngle);
                    if (diff === null) return;
                    
                    // 허용오차 내에 있고 최소값이면 업데이트
                    if (diff <= tolerance) {
                        if (minDiff === null || diff < minDiff) {
                            minDiff = diff;
                        }
                    }
                });
            });
            
            if (minDiff === null) return null;
            
            // 2단계: 최소 각도를 가진 모든 후보 수집
            const candidates = [];
            
            allPathRectsWithSize.forEach(({ rects, size }) => {
                if (!rects) return;
                
                rects.forEach(pt => {
                    const diff = calculateRectAngleDiff(pt, size, baseX, baseY, expectedAngle);
                    if (diff === null) return;
                    
                    // 최소 각도 차이와 일치하면 후보에 추가
                    if (Math.abs(diff - minDiff) < 0.001) {
                        candidates.push({ x: pt.x, y: pt.y, size: size });
                    }
                });
            });
            
            // 2.5단계: 포함 관계 확인 - 포함되는 작은 사각형 제외
            const filteredCandidates = candidates.filter(smallRect => {
                // 자신보다 큰 사각형에 완전히 포함되면 제외
                const isContained = candidates.some(largeRect => {
                    if (largeRect.size <= smallRect.size) return false;
                    
                    return smallRect.x >= largeRect.x &&
                           smallRect.y >= largeRect.y &&
                           smallRect.x + smallRect.size <= largeRect.x + largeRect.size &&
                           smallRect.y + smallRect.size <= largeRect.y + largeRect.size;
                });
                
                return !isContained;  // 포함되지 않은 것만 유지
            });
            
            // 3단계: 필터링된 후보들 중 최대 크기 찾기
            let maxSize = null;
            filteredCandidates.forEach(candidate => {
                if (maxSize === null || candidate.size > maxSize) {
                    maxSize = candidate.size;
                }
            });
            
            // 4단계: 최대 크기를 가진 사각형들 수집
            const bestRects = filteredCandidates.filter(candidate => candidate.size === maxSize);
            
            return { minDiff, maxSize, bestRects };
        }
        
        // 경로 버튼 클릭 이벤트 추가
        function addPathButtonClickEvents(pathName, cornerSize) {
            document.querySelectorAll(`button[data-path="${pathName}"]`).forEach(btn => {
                if (!btn.disabled) {
                    btn.onclick = () => {
                        const idx = btn.getAttribute('data-idx');
                        const x = parseInt(btn.getAttribute('data-x'));
                        const y = parseInt(btn.getAttribute('data-y'));
                        const angle = parseInt(btn.getAttribute('data-angle')); // 미리 계산된 각도
                        
                        console.log(`✅ 경로 ${pathName} [${idx}] 클릭: (${x}, ${y}), 크기: ${cornerSize}x${cornerSize}, 각도: ${angle}°`);
                        
                        // 임시 노란색 사각형만 설정 (F9로 확정 전까지는 이동 안 함)
                        tempYellowRect = {
                            x: x,
                            y: y,
                            size: cornerSize
                        };
                        
                        updateTempYellowAngle(angle); // 미리 계산된 각도 전달
                        
                        console.log(`   임시 노란색 사각형 설정됨. F9 키를 눌러 확정하세요.`);
                        scaleCanvas();
                    };
                }
            });
        }

        // 기준 사각형과 귀퉁이 정보 업데이트
        function updateBaseAndCornerInfo(rectSize, cornerSize) {
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
        }
        
        // 모든 경로 데이터 계산 (순수 계산 로직)
        function calculateAllPathsData(rectSize, cornerSize, cornerSize_n1) {
            // 4가지 경로 모두 계산 (n 크기)
            const paths_n = {
                path01: getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 1) || [],
                path23: getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 2, 3) || [],
                path02: getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 0, 2) || [],
                path13: getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize, 1, 3) || []
            };
            
            // 4가지 경로 모두 계산 (n-1 크기)
            const paths_n1 = (cornerSize_n1 > 0) ? {
                path01: getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize_n1, 0, 1) || [],
                path23: getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize_n1, 2, 3) || [],
                path02: getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize_n1, 0, 2) || [],
                path13: getPathRectsOverlap(selectedPixel.x, selectedPixel.y, rectSize, cornerSize_n1, 1, 3) || []
            } : { path01: [], path23: [], path02: [], path13: [] };
            
            const maxPixels_n = cornerSize * cornerSize;
            const maxPixels_n1 = cornerSize_n1 * cornerSize_n1;
            
            // 모든 경로(n과 n-1 크기 모두)에서 최소 각도 차이와 최대 크기 찾기
            const allPathsWithSize = [
                { rects: paths_n.path01, size: cornerSize },
                { rects: paths_n.path23, size: cornerSize },
                { rects: paths_n.path02, size: cornerSize },
                { rects: paths_n.path13, size: cornerSize }
            ];
            
            if (cornerSize_n1 > 0) {
                allPathsWithSize.push(
                    { rects: paths_n1.path01, size: cornerSize_n1 },
                    { rects: paths_n1.path23, size: cornerSize_n1 },
                    { rects: paths_n1.path02, size: cornerSize_n1 },
                    { rects: paths_n1.path13, size: cornerSize_n1 }
                );
            }
            
            const bestMatch = findMinAngleDiffAndMaxSize(allPathsWithSize);
            
            // 경로별 흰색점 개수 계산 (n 크기)
            const whiteCounts_n = {
                path01: calculatePathWhiteCounts(paths_n.path01, 'path01_n', cornerSize, maxPixels_n, bestMatch),
                path23: calculatePathWhiteCounts(paths_n.path23, 'path23_n', cornerSize, maxPixels_n, bestMatch),
                path02: calculatePathWhiteCounts(paths_n.path02, 'path02_n', cornerSize, maxPixels_n, bestMatch),
                path13: calculatePathWhiteCounts(paths_n.path13, 'path13_n', cornerSize, maxPixels_n, bestMatch)
            };
            
            // 경로별 흰색점 개수 계산 (n-1 크기)
            const whiteCounts_n1 = (cornerSize_n1 > 0) ? {
                path01: calculatePathWhiteCounts(paths_n1.path01, 'path01_n1', cornerSize_n1, maxPixels_n1, bestMatch),
                path23: calculatePathWhiteCounts(paths_n1.path23, 'path23_n1', cornerSize_n1, maxPixels_n1, bestMatch),
                path02: calculatePathWhiteCounts(paths_n1.path02, 'path02_n1', cornerSize_n1, maxPixels_n1, bestMatch),
                path13: calculatePathWhiteCounts(paths_n1.path13, 'path13_n1', cornerSize_n1, maxPixels_n1, bestMatch)
            } : { path01: [], path23: [], path02: [], path13: [] };
            
            return { paths_n, paths_n1, whiteCounts_n, whiteCounts_n1 };
        }
        
        // 경로 UI 업데이트 및 이벤트 핸들러 추가
        function updatePathUI(pathsData, cornerSize, cornerSize_n1) {
            const { paths_n, paths_n1, whiteCounts_n, whiteCounts_n1 } = pathsData;
            
            // 전역 변수에 경로 저장 (렌더링에서 사용)
            pathRects01_n = paths_n.path01;
            pathRects23_n = paths_n.path23;
            pathRects02_n = paths_n.path02;
            pathRects13_n = paths_n.path13;
            pathRects01_n1 = paths_n1.path01;
            pathRects23_n1 = paths_n1.path23;
            pathRects02_n1 = paths_n1.path02;
            pathRects13_n1 = paths_n1.path13;
            
            // 경로별 개수 표시 업데이트 (n 크기만 표시)
            if(document.getElementById('pathCount01')) document.getElementById('pathCount01').textContent = paths_n.path01.length;
            if(document.getElementById('pathCount23')) document.getElementById('pathCount23').textContent = paths_n.path23.length;
            if(document.getElementById('pathCount02')) document.getElementById('pathCount02').textContent = paths_n.path02.length;
            if(document.getElementById('pathCount13')) document.getElementById('pathCount13').textContent = paths_n.path13.length;
            
            // 흰색점 개수 버튼 표시 업데이트 (n 크기)
            if(document.getElementById('pathWhite01_n')) document.getElementById('pathWhite01_n').innerHTML = whiteCounts_n.path01.join(' ') || '-';
            if(document.getElementById('pathWhite23_n')) document.getElementById('pathWhite23_n').innerHTML = whiteCounts_n.path23.join(' ') || '-';
            if(document.getElementById('pathWhite02_n')) document.getElementById('pathWhite02_n').innerHTML = whiteCounts_n.path02.join(' ') || '-';
            if(document.getElementById('pathWhite13_n')) document.getElementById('pathWhite13_n').innerHTML = whiteCounts_n.path13.join(' ') || '-';
            
            // 흰색점 개수 버튼 표시 업데이트 (n-1 크기)
            if(document.getElementById('pathWhite01_n1')) document.getElementById('pathWhite01_n1').innerHTML = whiteCounts_n1.path01.join(' ') || '-';
            if(document.getElementById('pathWhite23_n1')) document.getElementById('pathWhite23_n1').innerHTML = whiteCounts_n1.path23.join(' ') || '-';
            if(document.getElementById('pathWhite02_n1')) document.getElementById('pathWhite02_n1').innerHTML = whiteCounts_n1.path02.join(' ') || '-';
            if(document.getElementById('pathWhite13_n1')) document.getElementById('pathWhite13_n1').innerHTML = whiteCounts_n1.path13.join(' ') || '-';
            
            // 버튼 클릭 이벤트 추가 (n 크기)
            addPathButtonClickEvents('path01_n', cornerSize);
            addPathButtonClickEvents('path23_n', cornerSize);
            addPathButtonClickEvents('path02_n', cornerSize);
            addPathButtonClickEvents('path13_n', cornerSize);
            
            // 버튼 클릭 이벤트 추가 (n-1 크기)
            if(cornerSize_n1 > 0) {
                addPathButtonClickEvents('path01_n1', cornerSize_n1);
                addPathButtonClickEvents('path23_n1', cornerSize_n1);
                addPathButtonClickEvents('path02_n1', cornerSize_n1);
                addPathButtonClickEvents('path13_n1', cornerSize_n1);
            }
        }
        
        // 공통 함수: 귀퉁이 및 경로 정보 업데이트 (메인 함수)
        function updateCornerAndPathInfo() {
            if (!selectedPixel) return;
            
            const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
            const cornerSize = parseInt(document.getElementById('cornerSize').value) || 4;
            const cornerSize_n1 = cornerSize - 1;
            
            // 1. 기준 정보 업데이트
            updateBaseAndCornerInfo(rectSize, cornerSize);
            
            // 2. 경로 데이터 계산
            const pathsData = calculateAllPathsData(rectSize, cornerSize, cornerSize_n1);
            
            // 3. UI 업데이트
            updatePathUI(pathsData, cornerSize, cornerSize_n1);
        }

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
        
        // 노란색 사각형 간 각도 표시 (저장된 angle 속성 사용)
        function updateYellowAngleDisplay() {
            const angleDisplay = document.getElementById('yellowAngleDisplay');
            if (!angleDisplay) return;
            
            if (currentYellowIndex <= 0 || yellowRects.length < 2) {
                angleDisplay.innerHTML = '';
                return;
            }
            
            const currRect = yellowRects[currentYellowIndex];
            const angle = currRect.angle;
            
            if (angle !== null && angle !== undefined) {
                // 이전 인덱스의 각도와 비교
                let bgStyle = '';
                let diffText = '';
                
                if (currentYellowIndex > 1) {
                    const prevRect = yellowRects[currentYellowIndex - 1];
                    if (prevRect.angle !== null && prevRect.angle !== undefined) {
                        const result = calculateAngleDiffWithStyle(angle, prevRect.angle);
                        bgStyle = result.bgStyle;
                        diffText = result.diffText;
                    }
                }
                
                angleDisplay.innerHTML = `| 각도: <span style="font-weight:bold;color:#ff6600;${bgStyle}">${angle}°</span>${diffText}`;
            } else {
                angleDisplay.innerHTML = '';
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
            updateYellowAngleDisplay();
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
            updateYellowAngleDisplay();
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
                updateCornerAndPathInfo();
            }
            
            console.log(`✅ 노란색 사각형 [${currentYellowIndex + 1}]번 위치로 이동: (${ox}, ${oy})`);
            scaleCanvas();
        });

        // Del 버튼: 현재 선택된 인덱스 이하 사각형들을 모두 삭제
        document.getElementById('btnDelAfterYellow').addEventListener('click', () => {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                console.log('❌ 삭제할 노란색 사각형이 선택되지 않았습니다.');
                return;
            }

            const deleteStart = currentYellowIndex;
            const deleteCount = yellowRects.length - deleteStart;

            if (deleteCount <= 0) {
                console.log('ℹ️ 선택된 사각형 뒤에 삭제할 항목이 없습니다.');
                return;
            }

            yellowRects.splice(deleteStart, deleteCount);

            // 삭제 후 현재 인덱스가 범위를 벗어나지 않도록 보정
            if (currentYellowIndex >= yellowRects.length) {
                currentYellowIndex = yellowRects.length - 1;
            }

            updateYellowIndexDisplay();
            updateYellowAngleDisplay();

            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }

            console.log(`✅ 노란색 사각형 ${deleteCount}개 삭제됨 (선택 인덱스 이후).`);
            scaleCanvas();
        });

        // Jmp 버튼: 현재 인덱스 이후에서 첫 급격 꺾임 지점으로 이동
        document.getElementById('btnJumpSharpTurn').addEventListener('click', () => {
            if (currentYellowIndex === -1 || yellowRects.length < 3) {
                console.log('❌ 점프할 노란색 사각형이 충분하지 않습니다.');
                return;
            }

            const tolerance = parseInt(document.getElementById('angleTolerance').value) || 30;
            let foundIndex = -1;

            // 현재 선택 다음 인덱스부터 앞으로 탐색
            for (let i = Math.max(1, currentYellowIndex + 1); i < yellowRects.length; i++) {
                const currAngle = yellowRects[i].angle;
                const prevAngle = yellowRects[i - 1].angle;

                if (currAngle === null || currAngle === undefined || prevAngle === null || prevAngle === undefined) {
                    continue;
                }

                const diff = Math.abs(getCircularAngleDiff(currAngle, prevAngle, false));
                if (diff > tolerance) {
                    foundIndex = i;
                    break;
                }
            }

            if (foundIndex === -1) {
                console.log('ℹ️ 현재 인덱스 이후에 급격한 꺾임이 없습니다.');
                return;
            }

            currentYellowIndex = foundIndex;
            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            scaleCanvas();
            console.log(`✅ 급격 꺾임 지점으로 점프: [${foundIndex + 1}] / ${yellowRects.length}`);
        });
        
        // Angle 검사 버튼: 각도별 그룹화
        document.getElementById('btnAngleCheck').addEventListener('click', () => {
            if (yellowRects.length === 0) {
                console.log('❌ 노란색 사각형이 없습니다.');
                return;
            }
            
            const tolerance = parseInt(document.getElementById('angleTolerance').value) || 30;
            console.log(`🔍 Angle 검사 시작... (허용 오차: ±${tolerance}°)`);
            
            // 각도 그룹화 로직
            const groups = [];
            let currentGroup = [];
            let currentGroupAngle = null;
            
            for (let i = 0; i < yellowRects.length; i++) {
                const rect = yellowRects[i];
                const angle = rect.angle;
                
                if (angle === null || angle === undefined) {
                    // 첫 번째 사각형 (각도 없음)
                    if (currentGroup.length > 0) {
                        groups.push([...currentGroup]);
                        currentGroup = [];
                        currentGroupAngle = null;
                    }
                    currentGroup.push(i);
                    continue;
                }
                
                if (currentGroupAngle === null) {
                    // 새 그룹 시작
                    currentGroup.push(i);
                    currentGroupAngle = angle;
                } else {
                    // 현재 그룹의 각도와 비교
                    const diff = Math.abs(getCircularAngleDiff(angle, currentGroupAngle, false));
                    
                    if (diff <= tolerance) {
                        // 비슷한 각도 -> 같은 그룹
                        currentGroup.push(i);
                    } else {
                        // 급격히 꺾임 -> 새 그룹 시작
                        groups.push([...currentGroup]);
                        currentGroup = [i];
                        currentGroupAngle = angle;
                    }
                }
            }
            
            // 마지막 그룹 추가
            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }
            
            console.log(`✅ ${groups.length}개 그룹 발견:`, groups);
            
            // 결과를 HTML에 표시
            const container = document.getElementById('angleGroupsContainer');
            if (container) {
                let html = `<div style="margin-top:8px;"><strong>📊 Angle 그룹 분석 결과 (허용오차: ±${tolerance}°):</strong></div>`;
                
                groups.forEach((group, groupIndex) => {
                    const groupNumber = groupIndex + 1;
                    const indices = group.map(i => i).join(', ');
                    
                    // 그룹의 평균 각도 계산 (첫 번째 제외)
                    let avgAngle = '-';
                    const anglesInGroup = group.map(i => yellowRects[i].angle).filter(a => a !== null && a !== undefined);
                    if (anglesInGroup.length > 0) {
                        const sum = anglesInGroup.reduce((a, b) => a + b, 0);
                        avgAngle = Math.round(sum / anglesInGroup.length) + '°';
                    }
                    
                    html += `<div style="margin:5px 0 5px 20px;">`;
                    html += `<strong style="color:#0066cc;">그룹 ${groupNumber}:</strong> `;
                    html += `<input type="text" value="인덱스 [${indices}] - 평균각도: ${avgAngle}" readonly `;
                    html += `style="width:400px; padding:3px 6px; border:1px solid #ccc; background:#f9f9f9; font-size:0.9em;">`;
                    html += `</div>`;
                });
                
                container.innerHTML = html;
            }
        });
        
        // 경로별 흰색점 개수 토글 함수
        function togglePathWhite() {
            const content = document.getElementById('pathWhiteContent');
            const header = document.getElementById('pathWhiteHeader');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                header.innerHTML = '⭕ 경로별 흰색점 개수: <span style="font-size:0.8em;">[▼]</span>';
            } else {
                content.style.display = 'none';
                header.innerHTML = '⭕ 경로별 흰색점 개수: <span style="font-size:0.8em;">[▶]</span>';
            }
        }
        
        // 초기 디스플레이 설정
        updateYellowIndexDisplay();
        updateYellowAngleDisplay();

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
                updateCornerAndPathInfo();
            } else {
                cornerRects = [];
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
                    const cornerSize_n1 = cornerSize - 1;
                    
                    // 상단 수평 (0→1): 녹색 [n 크기]
                    if (pathRects01_n.length > 0) {
                        ctx2.fillStyle = 'rgba(0, 255, 0, 0.5)';
                        for (const pt of pathRects01_n) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize * scale)/2, pt.y * scale + (cornerSize * scale)/2, Math.max(2, scale/4), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    // 상단 수평 (0→1): 연한 녹색 [n-1 크기]
                    if (pathRects01_n1.length > 0) {
                        ctx2.fillStyle = 'rgba(100, 255, 100, 0.3)';
                        for (const pt of pathRects01_n1) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize_n1 * scale)/2, pt.y * scale + (cornerSize_n1 * scale)/2, Math.max(1.5, scale/5), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    
                    // 하단 수평 (2→3): 청록색 [n 크기]
                    if (pathRects23_n.length > 0) {
                        ctx2.fillStyle = 'rgba(0, 200, 200, 0.5)';
                        for (const pt of pathRects23_n) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize * scale)/2, pt.y * scale + (cornerSize * scale)/2, Math.max(2, scale/4), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    // 하단 수평 (2→3): 연한 청록색 [n-1 크기]
                    if (pathRects23_n1.length > 0) {
                        ctx2.fillStyle = 'rgba(100, 230, 230, 0.3)';
                        for (const pt of pathRects23_n1) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize_n1 * scale)/2, pt.y * scale + (cornerSize_n1 * scale)/2, Math.max(1.5, scale/5), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    
                    // 좌측 수직 (0→2): 주황색 [n 크기]
                    if (pathRects02_n.length > 0) {
                        ctx2.fillStyle = 'rgba(255, 165, 0, 0.5)';
                        for (const pt of pathRects02_n) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize * scale)/2, pt.y * scale + (cornerSize * scale)/2, Math.max(2, scale/4), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    // 좌측 수직 (0→2): 연한 주황색 [n-1 크기]
                    if (pathRects02_n1.length > 0) {
                        ctx2.fillStyle = 'rgba(255, 200, 100, 0.3)';
                        for (const pt of pathRects02_n1) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize_n1 * scale)/2, pt.y * scale + (cornerSize_n1 * scale)/2, Math.max(1.5, scale/5), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    
                    // 우측 수직 (1→3): 보라색 [n 크기]
                    if (pathRects13_n.length > 0) {
                        ctx2.fillStyle = 'rgba(200, 0, 200, 0.5)';
                        for (const pt of pathRects13_n) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize * scale)/2, pt.y * scale + (cornerSize * scale)/2, Math.max(2, scale/4), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                    // 우측 수직 (1→3): 연한 보라색 [n-1 크기]
                    if (pathRects13_n1.length > 0) {
                        ctx2.fillStyle = 'rgba(230, 100, 230, 0.3)';
                        for (const pt of pathRects13_n1) {
                            ctx2.beginPath();
                            ctx2.arc(pt.x * scale + (cornerSize_n1 * scale)/2, pt.y * scale + (cornerSize_n1 * scale)/2, Math.max(1.5, scale/5), 0, Math.PI * 2);
                            ctx2.fill();
                        }
                    }
                }
                ctx2.setLineDash([]);
                
                // F8/F9로 확정된 노란색 사각형들 그리기
                if (yellowRects.length > 0) {
                    for (let i = 0; i < yellowRects.length; i++) {
                        const rect = yellowRects[i];
                        const isSelected = (i === currentYellowIndex);
                        
                        if (isSelected) {
                            // 선택된 사각형: 빨간색 두꺼운 테두리
                            ctx2.fillStyle = 'rgba(255, 100, 100, 0.4)';
                            ctx2.strokeStyle = 'rgba(255, 0, 0, 1.0)';
                            ctx2.lineWidth = Math.max(3, scale/4);
                        } else if (rect.angleExceeded) {
                            // 각도 허용오차 초과: 주황색
                            ctx2.fillStyle = 'rgba(34, 61, 212, 0.4)';
                            ctx2.strokeStyle = 'rgba(189, 116, 8, 0.9)';
                            ctx2.lineWidth = Math.max(1, scale/8);
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