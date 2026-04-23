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
    const canvasWidth = currentCanvasWidth;
    const canvasHeight = currentCanvasHeight;
    // 원래 좌표를 계산 (음수 포함, 경계 밖도 허용)
    const corners = [
        { x: x - size2, y: y - size2 }, // 좌상
        { x: x + size,  y: y - size2 }, // 우상
        { x: x - size2, y: y + size  }, // 좌하
        { x: x + size,  y: y + size  }  // 우하
    ];
    
    return corners.map(corner => {
        // 실제로 화면(0~canvasWidth-1/0~canvasHeight-1)에 보이는 영역만 계산
        const visibleStartX = Math.max(0, corner.x);
        const visibleStartY = Math.max(0, corner.y);
        const visibleEndX = Math.min(canvasWidth, corner.x + size2);
        const visibleEndY = Math.min(canvasHeight, corner.y + size2);
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
    const canvasWidth = currentCanvasWidth;
    const canvasHeight = currentCanvasHeight;
    const thresholdInput = document.getElementById('whiteThreshold');
    const thresholdValue = thresholdInput ? parseInt(thresholdInput.value, 10) : 245;
    const whiteThreshold = Number.isNaN(thresholdValue)
        ? 245
        : Math.min(255, Math.max(0, thresholdValue));

    // 경계 밖을 범위는 0을 반환
    if (x < 0 || y < 0 || x + size > canvasWidth || y + size > canvasHeight) {
        // 부분적으로 경계 안에 있는 경우 처리
        const startX = Math.max(0, x);
        const startY = Math.max(0, y);
        const endX = Math.min(canvasWidth, x + size);
        const endY = Math.min(canvasHeight, y + size);
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
    const canvasSizeSelect = document.getElementById('canvasSizeSelect');
    const canvas1SizeLabel = document.getElementById('canvas1SizeLabel');
        const canvas1ClipboardImageInfo = document.getElementById('canvas1ClipboardImageInfo');
    const CANVAS_SIZE_STORAGE_KEY = 'blockGrider.canvasSize';
    const RECT_SIZE_STORAGE_KEY = 'blockGrider.rectSize';
    const CORNER_SIZE_STORAGE_KEY = 'blockGrider.cornerSize';
    const WHITE_THRESHOLD_STORAGE_KEY = 'blockGrider.whiteThreshold';
    const ALLOWED_CANVAS_SIZES = ['64x64', '128x128', '256x256', '64x128'];
    let currentCanvasWidth = 64;
    let currentCanvasHeight = 64;
        
        // Range 바 요소
        const scaleRange = document.getElementById('scaleRange');
        const scaleDisplay = document.getElementById('scaleDisplay');
        const btnZoomSelectedOut = document.getElementById('btnZoomSelectedOut');
        const btnZoomSelectedIn = document.getElementById('btnZoomSelectedIn');
        const polylineSelect = document.getElementById('polylineSelect');
        const btnInsertBeforePolylineStart = document.getElementById('btnInsertBeforePolylineStart');
        const polylineCountDisplay = document.getElementById('polylineCountDisplay');
        const polylineRangeDisplay = document.getElementById('polylineRangeDisplay');
        
        // 스케일 값 배열
        const scaleValues = [2, 4, 8, 16, 32, 64];

        function clamp(value, min, max) {
            return Math.min(max, Math.max(min, value));
        }

        function isAllowedCanvasSize(size) {
            return ALLOWED_CANVAS_SIZES.includes(size);
        }

        function parseCanvasSize(value) {
            if (typeof value !== 'string') return null;
            const parts = value.split('x').map(v => parseInt(v, 10));
            if (parts.length !== 2 || parts.some(v => !Number.isFinite(v) || v <= 0)) {
                return null;
            }
            return { width: parts[0], height: parts[1] };
        }

        function formatCanvasSize(width, height) {
            return `${width}x${height}`;
        }

        function getStoredCanvasSize() {
            try {
                const storedValue = localStorage.getItem(CANVAS_SIZE_STORAGE_KEY);
                if (!storedValue) return null;
                const parsed = parseCanvasSize(storedValue);
                if (!parsed) return null;
                const id = formatCanvasSize(parsed.width, parsed.height);
                return ALLOWED_CANVAS_SIZES.includes(id) ? parsed : null;
            } catch (ex) {
                return null;
            }
        }

        function saveCanvasSize(width, height) {
            try {
                localStorage.setItem(CANVAS_SIZE_STORAGE_KEY, formatCanvasSize(width, height));
            } catch (ex) {
                // localStorage를 사용할 수 없는 환경에서는 저장을 건너뜀
            }
        }

        function parseAndClampInputValue(input, fallbackValue) {
            if (!input) return fallbackValue;

            const parsed = parseInt(input.value, 10);
            const fallback = Number.isFinite(fallbackValue) ? fallbackValue : 0;
            const safeValue = Number.isNaN(parsed) ? fallback : parsed;
            const min = parseInt(input.min, 10);
            const max = parseInt(input.max, 10);
            const hasMin = !Number.isNaN(min);
            const hasMax = !Number.isNaN(max);

            if (hasMin && hasMax) {
                return clamp(safeValue, min, max);
            }
            if (hasMin) {
                return Math.max(min, safeValue);
            }
            if (hasMax) {
                return Math.min(max, safeValue);
            }
            return safeValue;
        }

        function restoreNumericInputFromStorage(inputId, storageKey, fallbackValue) {
            const input = document.getElementById(inputId);
            if (!input) return;

            let restored = fallbackValue;
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored !== null) {
                    input.value = stored;
                }
                restored = parseAndClampInputValue(input, fallbackValue);
            } catch (ex) {
                restored = parseAndClampInputValue(input, fallbackValue);
            }

            input.value = String(restored);
        }

        function persistNumericInputToStorage(inputId, storageKey, fallbackValue) {
            const input = document.getElementById(inputId);
            if (!input) return;

            const persist = () => {
                const value = parseAndClampInputValue(input, fallbackValue);
                input.value = String(value);
                try {
                    localStorage.setItem(storageKey, String(value));
                } catch (ex) {
                    // localStorage를 사용할 수 없는 환경에서는 저장을 건너뜀
                }
            };

            input.addEventListener('change', persist);
            input.addEventListener('input', persist);
        }

        function updateCanvasSizeLabel() {
            if (canvas1SizeLabel) {
                canvas1SizeLabel.textContent = `${currentCanvasWidth}x${currentCanvasHeight}`;
            }
        }

        function clampRectsToCanvas() {
            const maxXCoord = currentCanvasWidth - 1;
            const maxYCoord = currentCanvasHeight - 1;

            if (selectedPixel) {
                selectedPixel = {
                    x: clamp(selectedPixel.x, 0, maxXCoord),
                    y: clamp(selectedPixel.y, 0, maxYCoord)
                };
            }

            if (tempYellowRect) {
                const maxX = currentCanvasWidth - tempYellowRect.size;
                const maxY = currentCanvasHeight - tempYellowRect.size;
                tempYellowRect.x = clamp(tempYellowRect.x, 0, Math.max(0, maxX));
                tempYellowRect.y = clamp(tempYellowRect.y, 0, Math.max(0, maxY));
            }

            yellowRects = yellowRects.filter(rect => {
                return rect.x >= 0 && rect.y >= 0 &&
                    rect.x + rect.size <= currentCanvasWidth &&
                    rect.y + rect.size <= currentCanvasHeight;
            });

            if (yellowRects.length === 0) {
                currentYellowIndex = -1;
            } else if (currentYellowIndex >= yellowRects.length) {
                currentYellowIndex = yellowRects.length - 1;
            }
        }

        function applyCanvasSize(width, height) {
            const sizeId = formatCanvasSize(width, height);
            if (!ALLOWED_CANVAS_SIZES.includes(sizeId)) return;

            const prevWidth = canvas1.width;
            const prevHeight = canvas1.height;
            const backupCanvas = document.createElement('canvas');
            backupCanvas.width = prevWidth;
            backupCanvas.height = prevHeight;
            const backupCtx = backupCanvas.getContext('2d');
            backupCtx.drawImage(canvas1, 0, 0);

            currentCanvasWidth = width;
            currentCanvasHeight = height;
            canvas1.width = width;
            canvas1.height = height;

            ctx1.fillStyle = 'white';
            ctx1.fillRect(0, 0, width, height);

            const fitScale = Math.min(width / prevWidth, height / prevHeight);
            const drawW = prevWidth * fitScale;
            const drawH = prevHeight * fitScale;
            const offsetX = (width - drawW) / 2;
            const offsetY = (height - drawH) / 2;
            ctx1.drawImage(backupCanvas, offsetX, offsetY, drawW, drawH);

            if (canvasSizeSelect.value !== sizeId) {
                canvasSizeSelect.value = sizeId;
            }
            saveCanvasSize(width, height);
            updateCanvasSizeLabel();
            clampRectsToCanvas();
            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }
            scaleCanvas();
        }

        canvasSizeSelect.addEventListener('change', (e) => {
            const selected = e.target.value;
            if (!ALLOWED_CANVAS_SIZES.includes(selected)) return;
            const parsed = parseCanvasSize(selected);
            if (!parsed) return;
            applyCanvasSize(parsed.width, parsed.height);
        });

        function setAutoSelectOnClick(inputId) {
            const input = document.getElementById(inputId);
            if (!input) return;
            input.addEventListener('click', () => input.select());
            input.addEventListener('focus', () => input.select());
        }

        setAutoSelectOnClick('rectSize');
        setAutoSelectOnClick('cornerSize');

        restoreNumericInputFromStorage('rectSize', RECT_SIZE_STORAGE_KEY, 4);
        restoreNumericInputFromStorage('cornerSize', CORNER_SIZE_STORAGE_KEY, 4);
        restoreNumericInputFromStorage('whiteThreshold', WHITE_THRESHOLD_STORAGE_KEY, 245);
        persistNumericInputToStorage('rectSize', RECT_SIZE_STORAGE_KEY, 4);
        persistNumericInputToStorage('cornerSize', CORNER_SIZE_STORAGE_KEY, 4);
        persistNumericInputToStorage('whiteThreshold', WHITE_THRESHOLD_STORAGE_KEY, 245);

        // 저장된 캔버스 크기가 있으면 초기값으로 복원
        const restoredCanvasSize = getStoredCanvasSize();
        if (restoredCanvasSize !== null) {
            currentCanvasWidth = restoredCanvasSize.width;
            currentCanvasHeight = restoredCanvasSize.height;
            const restoredId = formatCanvasSize(restoredCanvasSize.width, restoredCanvasSize.height);
            canvasSizeSelect.value = restoredId;
            canvas1.width = restoredCanvasSize.width;
            canvas1.height = restoredCanvasSize.height;
        } else {
            // 초기값 설정
            const initialId = parseCanvasSize(canvasSizeSelect.value) || { width: 64, height: 64 };
            currentCanvasWidth = initialId.width;
            currentCanvasHeight = initialId.height;
            canvas1.width = initialId.width;
            canvas1.height = initialId.height;
        }
        
        // Document 로드 시 임의의 점들 그리기
        document.addEventListener('DOMContentLoaded', () => {
            updateCanvasSizeLabel();
            drawRandomPixels();
        });
        
        // Canvas1에 임의의 점들 그리기
        function drawRandomPixels() {
            const canvasWidth = currentCanvasWidth;
            const canvasHeight = currentCanvasHeight;
            // 배경을 흰색으로 설정
            ctx1.fillStyle = 'white';
            ctx1.fillRect(0, 0, canvasWidth, canvasHeight);
            
            // 임의의 점들 그리기 (약 200-300개의 픽셀)
            const baseCount = Math.floor(Math.random() * 100) + 200;
            const densityScale = (canvasWidth * canvasHeight) / (64 * 64);
            const pixelCount = Math.floor(baseCount * densityScale);
            
            for (let i = 0; i < pixelCount; i++) {
                const x = Math.floor(Math.random() * canvasWidth);
                const y = Math.floor(Math.random() * canvasHeight);
                
                // 랜덤 색상 생성
                const r = Math.floor(Math.random() * 256);
                const g = Math.floor(Math.random() * 256);
                const b = Math.floor(Math.random() * 256);
                
                ctx1.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx1.fillRect(x, y, 1, 1);
            }

            // Canvas2 확대 뷰를 즉시 갱신
            scaleCanvas();
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
                                const canvasWidth = currentCanvasWidth;
                                const canvasHeight = currentCanvasHeight;
                                // 배경을 흰색으로 설정
                                ctx1.fillStyle = 'white';
                                ctx1.fillRect(0, 0, canvasWidth, canvasHeight);
                                
                                // 빈 여백이 생기지 않도록 cover 배율을 구한 뒤, 5% 단위로 올림해 중앙 크롭
                                const coverScale = Math.max(canvasWidth / img.width, canvasHeight / img.height);
                                const scalePercentInt = Math.ceil((coverScale * 100) / 5) * 5;
                                const scale = scalePercentInt / 100;
                                const scaledWidth = img.width * scale;
                                const scaledHeight = img.height * scale;
                                const offsetX = (canvasWidth - scaledWidth) / 2;
                                const offsetY = (canvasHeight - scaledHeight) / 2;
                                const croppedOriginalWidth = Math.max(1, Math.min(img.width, canvasWidth / scale));
                                const croppedOriginalHeight = Math.max(1, Math.min(img.height, canvasHeight / scale));
                                
                                // 빈 영역을 검은색으로 채움
                                ctx1.fillStyle = 'black';
                                ctx1.fillRect(0, 0, canvasWidth, canvasHeight);
                                
                                // 캔버스 바깥으로 넘어간 영역은 자동으로 잘려 중앙 기준 크롭됨
                                ctx1.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
                                showCanvas1ClipboardScaleMessage(
                                    `Canvas1 반영 배율: ${scalePercentInt}% (${img.width}x${img.height} → ${Math.round(scaledWidth)}x${Math.round(scaledHeight)})`
                                );
                                if (canvas1ClipboardImageInfo) {
                                    canvas1ClipboardImageInfo.textContent = `원본: ${img.width}x${img.height} | 잘라낸 영역(원본 기준): ${Math.round(croppedOriginalWidth)}x${Math.round(croppedOriginalHeight)} | Canvas1 결과: ${canvasWidth}x${canvasHeight}`;
                                }
                                console.log('클립보드에서 이미지를 가져왔습니다.');
                                scaleCanvas();
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
        const btnViewRecommendedPoint = document.getElementById('btnViewRecommendedPoint');
        const btnCenterSelected = document.getElementById('btnCenterSelected');
        if (btnViewRecommendedPoint) {
            btnViewRecommendedPoint.addEventListener('click', () => {
                viewNextAutoF10PointOnCanvas2();
            });
        }
        if (btnZoomSelectedOut) {
            btnZoomSelectedOut.addEventListener('click', () => {
                zoomCanvas2AroundSelected(-1);
            });
        }
        if (btnZoomSelectedIn) {
            btnZoomSelectedIn.addEventListener('click', () => {
                zoomCanvas2AroundSelected(1);
            });
        }
        if (btnCenterSelected) {
            btnCenterSelected.addEventListener('click', () => {
                if (!selectedPixel) {
                    showRoleActionErrorMessage('먼저 Canvas2에서 기준 점을 선택하세요.');
                    return;
                }
                centerCanvas2OnPoint(selectedPixel);
            });
        }
        
        // Range 바 값 변경 시 표시 업데이트 및 Canvas2 즉시 확대 갱신
        scaleRange.addEventListener('input', (e) => {
            const index = parseInt(e.target.value);
            const scale = scaleValues[index];
            scaleDisplay.textContent = `${scale}x`;
            scaleCanvas();
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
        
        function normalizeRole(role) {
            if (role === 'start' || role === 'middle' || role === 'end') return role;
            return 'middle';
        }

        function isValidPolylineId(polylineId) {
            return typeof polylineId === 'string' && polylineId.trim().length > 0;
        }

        function createPolylineId() {
            const nextId = `PL${polylineIdSeq}`;
            polylineIdSeq += 1;
            return nextId;
        }

        function syncPolylineIdSeqFromRects(rects) {
            let maxSeq = 0;
            for (let i = 0; i < rects.length; i++) {
                const polylineId = rects[i] && rects[i].polylineId;
                if (!isValidPolylineId(polylineId)) continue;

                const match = /^PL(\d+)$/.exec(polylineId);
                if (!match) continue;

                const seq = parseInt(match[1], 10);
                if (Number.isFinite(seq) && seq > maxSeq) {
                    maxSeq = seq;
                }
            }

            polylineIdSeq = Math.max(1, maxSeq + 1);
        }

        function ensureActivePolylineId() {
            if (!isValidPolylineId(activePolylineId)) {
                activePolylineId = createPolylineId();
            }
            return activePolylineId;
        }

        function getNextPointOrder(polylineId) {
            let count = 0;
            for (let i = 0; i < yellowRects.length; i++) {
                if (yellowRects[i].polylineId === polylineId) {
                    count += 1;
                }
            }
            return count + 1;
        }

        function parseAddRectOptions(roleOrOptions = 'middle', polylineIdArg = null) {
            let role = 'middle';
            let polylineId = null;

            if (typeof roleOrOptions === 'string') {
                role = normalizeRole(roleOrOptions);
            } else if (roleOrOptions && typeof roleOrOptions === 'object') {
                role = normalizeRole(roleOrOptions.role);
                if (isValidPolylineId(roleOrOptions.polylineId)) {
                    polylineId = roleOrOptions.polylineId;
                }
            }

            if (isValidPolylineId(polylineIdArg)) {
                polylineId = polylineIdArg;
            }

            return { role, polylineId };
        }

        // 노란색 사각형을 yellowRects 배열에 추가하고 각도 검사 수행
        // role 기본값은 middle이며, F8에서 start를 전달할 수 있음
        function addYellowRectWithAngleCheck(x, y, size, roleOrOptions = 'middle', polylineIdArg = null) {
            const options = parseAddRectOptions(roleOrOptions, polylineIdArg);
            const role = options.role;
            const assignedPolylineId = options.polylineId || ensureActivePolylineId();
            const pointOrder = getNextPointOrder(assignedPolylineId);
            const isPolylineFirstPoint = (pointOrder === 1);
            // 이전 사각형으로부터의 각도 계산
            let angle = null;
            let angleExceeded = false;
            let angleDiffValue = null;
            let expectedAngle = null;
            const overlappingIndices = [];
            const mergeState = yellowRects.some(existingRect =>
                classifyRectOverlap(x, y, size, existingRect) === 'full'
            );

            if (mergeState) {
                yellowRects.forEach((existingRect, index) => {
                    if (classifyRectOverlap(x, y, size, existingRect) === 'full') {
                        overlappingIndices.push(index);
                    }
                });
            }
            
            // 새 폴리라인의 첫 점(start)은 이전 폴리라인과 각도 비교를 하지 않는다.
            if (yellowRects.length > 0 && !isPolylineFirstPoint) {
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
                expectedAngle: expectedAngle,
                mergeState: mergeState,
                role: role,
                polylineId: assignedPolylineId,
                pointOrder: pointOrder
            });

            activePolylineId = assignedPolylineId;

            if (mergeState && overlappingIndices.length > 0) {
                overlappingIndices.forEach(index => {
                    yellowRects[index].mergeState = true;
                });
            }
            
            console.log(`✅ 노란색 사각형 추가: (${x}, ${y}), 크기: ${size}x${size}, 각도: ${angle !== null ? angle + '°' : 'N/A'}`);
            if (angleExceeded) {
                console.log(`   ⚠️ 각도 허용오차 초과: ${angleDiffValue}° (기대: ${expectedAngle}°)`);
            }
            
            // 방금 추가된 사각형을 현재 선택으로 설정
            currentYellowIndex = yellowRects.length - 1;
            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            refreshPolylineRangeControl();
        }

        // 최근 middle 사각형을 end로 변경
        function markLatestMiddleRectAsEnd() {
            if (yellowRects.length === 0) {
                console.log('❌ end로 지정할 노란색 사각형이 없습니다.');
                return false;
            }

            let latestMiddleIndex = -1;
            for (let i = yellowRects.length - 1; i >= 0; i--) {
                const role = normalizeRole(yellowRects[i].role);
                if (role === 'middle') {
                    latestMiddleIndex = i;
                    break;
                }
            }

            if (latestMiddleIndex === -1) {
                console.log('❌ end로 변경할 middle 사각형이 없습니다.');
                return false;
            }

            yellowRects[latestMiddleIndex].role = 'end';
            if (yellowRects[latestMiddleIndex].polylineId === activePolylineId) {
                activePolylineId = null;
            }
            console.log(`✅ 최근 middle 사각형(index: ${latestMiddleIndex})을 end로 지정했습니다.`);

            const startIndex = findLatestStartIndexForEnd(latestMiddleIndex);
            if (startIndex !== -1) {
                highlightPolylineRange(startIndex, latestMiddleIndex, 3000);
                console.log(`   🔦 start(${startIndex}) ~ end(${latestMiddleIndex}) 구간을 3초간 강조합니다.`);
            } else {
                console.log('ℹ️ end 이전에 start가 없어 구간 하이라이트는 생략합니다.');
            }

            // role 변경(F11) 직후 Range Bar/표시값 즉시 갱신
            refreshPolylineRangeControl();

            return true;
        }

        // F8로 새 start를 찍기 직전, 기존 마지막 점을 end로 자동 지정
        function autoCloseLatestPointAsEndBeforeStart() {
            if (yellowRects.length === 0) {
                return false;
            }

            const latestIndex = yellowRects.length - 1;
            const latestRole = normalizeRole(yellowRects[latestIndex].role);
            if (latestRole === 'end') {
                return false;
            }

            yellowRects[latestIndex].role = 'end';
            if (yellowRects[latestIndex].polylineId === activePolylineId) {
                activePolylineId = null;
            }

            const startIndex = findLatestStartIndexForEnd(latestIndex);
            if (startIndex !== -1) {
                highlightPolylineRange(startIndex, latestIndex, 3000);
                showRoleActionMessage('end', latestIndex, startIndex);
                console.log(`✅ 새 start 생성 전, 최근 점 [${latestIndex + 1}]을 end로 자동 지정했습니다. (start: ${startIndex + 1})`);
            } else {
                console.log(`ℹ️ 새 start 생성 전, 최근 점 [${latestIndex + 1}]을 end로 자동 지정했습니다.`);
            }

            refreshPolylineRangeControl();
            return true;
        }

        function setYellowRoleByIndex(index, role) {
            if (index < 0 || index >= yellowRects.length) {
                console.log('❌ role을 지정할 유효한 노란색 인덱스가 없습니다.');
                showRoleActionErrorMessage('유효한 노란색 인덱스가 없습니다.');
                return false;
            }

            const normalizedRole = normalizeRole(role);
            const targetRect = yellowRects[index];

            if (normalizedRole === 'end') {
                const startIndex = findLatestStartIndexForEnd(index);

                targetRect.role = 'end';
                if (targetRect.polylineId === activePolylineId) {
                    activePolylineId = null;
                }
                currentYellowIndex = index;
                updateYellowIndexDisplay();
                updateYellowAngleDisplay();
                if (startIndex !== -1) {
                    highlightPolylineRange(startIndex, index, 3000);
                    showRoleActionMessage('end', index, startIndex);
                    console.log(`✅ 인덱스 [${index + 1}]를 end로 지정했습니다. (start: ${startIndex + 1})`);
                } else {
                    showRoleActionMessage('end', index, null);
                    console.log(`✅ 인덱스 [${index + 1}]를 end로 지정했습니다.`);
                }
            } else {
                targetRect.role = normalizedRole;
                if (normalizedRole === 'start' && !isValidPolylineId(targetRect.polylineId)) {
                    targetRect.polylineId = createPolylineId();
                    targetRect.pointOrder = 1;
                }
                currentYellowIndex = index;
                updateYellowIndexDisplay();
                updateYellowAngleDisplay();
                showRoleActionMessage('start', index);
                console.log(`✅ 인덱스 [${index + 1}]를 ${normalizedRole}로 지정했습니다.`);
            }

            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }

            refreshPolylineRangeControl();
            scaleCanvas();
            return true;
        }

        function setCurrentYellowAsStart() {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                console.log('❌ start로 지정할 노란색 사각형이 선택되지 않았습니다.');
                showRoleActionErrorMessage('start로 지정할 노란색 사각형이 선택되지 않았습니다.');
                return false;
            }
            return setYellowRoleByIndex(currentYellowIndex, 'start');
        }

        function setCurrentYellowAsEnd() {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                console.log('❌ end로 지정할 노란색 사각형이 선택되지 않았습니다.');
                showRoleActionErrorMessage('end로 지정할 노란색 사각형이 선택되지 않았습니다.');
                return false;
            }
            return setYellowRoleByIndex(currentYellowIndex, 'end');
        }

        function findLatestStartIndexForEnd(endIndex) {
            const containing = findPolylineRangeContainingIndex(endIndex);
            if (containing && Number.isFinite(containing.startIndex)) {
                return containing.startIndex;
            }

            for (let i = endIndex; i >= 0; i--) {
                const role = normalizeRole(yellowRects[i].role);
                if (role === 'start') {
                    return i;
                }
            }
            return -1;
        }

        function highlightPolylineRange(startIndex, endIndex, durationMs = 3000) {
            if (startIndex < 0 || endIndex < startIndex) return;

            polylineHighlightRange = { startIndex, endIndex };
            if (polylineHighlightTimer !== null) {
                clearTimeout(polylineHighlightTimer);
            }

            scaleCanvas();

            polylineHighlightTimer = setTimeout(() => {
                polylineHighlightRange = null;
                polylineHighlightTimer = null;
                scaleCanvas();
            }, durationMs);
        }

        function findLatestStartIndexBefore(endIndex) {
            const containing = findPolylineRangeContainingIndex(endIndex);
            if (containing && Number.isFinite(containing.startIndex)) {
                return containing.startIndex;
            }

            for (let i = endIndex - 1; i >= 0; i--) {
                if (normalizeRole(yellowRects[i].role) === 'start') {
                    return i;
                }
            }
            return -1;
        }

        function getPolylineTerminalInfo(index) {
            if (index < 0 || index >= yellowRects.length) {
                return {
                    isStart: false,
                    isEnd: false,
                    label: 'MIDDLE'
                };
            }

            const containing = findPolylineRangeContainingIndex(index);
            if (containing) {
                const isStart = containing.startIndex === index;
                const isEnd = containing.endIndex === index;
                let label = 'MIDDLE';
                if (isStart && isEnd) {
                    label = 'START|END';
                } else if (isStart) {
                    label = 'START';
                } else if (isEnd) {
                    label = 'END';
                }

                return { isStart, isEnd, label };
            }

            const role = normalizeRole(yellowRects[index].role);
            return {
                isStart: role === 'start',
                isEnd: role === 'end',
                label: role === 'start' ? 'START' : (role === 'end' ? 'END' : 'MIDDLE')
            };
        }

        function highlightStartPointForGo(endIndex, durationMs = 2000) {
            if (endIndex < 0 || endIndex >= yellowRects.length) return false;

            const startIndex = findLatestStartIndexBefore(endIndex);
            if (startIndex === -1) return false;

            goStartHighlightIndex = startIndex;
            if (goStartHighlightTimer !== null) {
                clearTimeout(goStartHighlightTimer);
            }

            scaleCanvas();

            goStartHighlightTimer = setTimeout(() => {
                goStartHighlightIndex = -1;
                goStartHighlightTimer = null;
                scaleCanvas();
            }, durationMs);

            return true;
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
                const tempYellowCoordInput = document.getElementById('tempYellowCoord');
                if (tempYellowCoordInput) tempYellowCoordInput.value = `${tempYellowRect.x},${tempYellowRect.y}`;
                
                return angle;
            }
            return null;
        }

        let roleActionDisplayTimer = null;
        let goMetaDisplayTimer = null;
        let canvas1StatusMessageTimer = null;
        let lastClickedYellowPoint = null;
        let lastClickedMatchedIndices = [];
        let lastMergeTabCycleKey = '';

        function areSamePoint(pointA, pointB) {
            return pointA && pointB && pointA.x === pointB.x && pointA.y === pointB.y;
        }

        function arraysAreEqual(a, b) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }

        function cycleToMergedYellowRect(reverse = false) {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                showRoleActionErrorMessage('TAB 전환할 MERGE 점이 없습니다.');
                return false;
            }

            const baseRect = yellowRects[currentYellowIndex];
            if (!baseRect) {
                showRoleActionErrorMessage('현재 선택 점을 찾을 수 없습니다.');
                return false;
            }

            const mergedIndices = yellowRects
                .map((rect, index) => ({ rect, index }))
                .filter(item => classifyRectOverlap(baseRect.x, baseRect.y, baseRect.size, item.rect) === 'full')
                .map(item => item.index)
                .sort((a, b) => a - b);

            if (mergedIndices.length <= 1) {
                showRoleActionErrorMessage('TAB 전환 대상 MERGE 점이 없습니다.');
                return false;
            }

            const cycleKey = mergedIndices.join(',');
            let currentPos = mergedIndices.indexOf(currentYellowIndex);
            if (currentPos === -1) currentPos = 0;

            // 순환 군집이 바뀌면 현재 위치 기준으로 한 칸 이동부터 시작
            if (lastMergeTabCycleKey !== cycleKey) {
                lastMergeTabCycleKey = cycleKey;
            }

            const nextPos = reverse
                ? (currentPos - 1 + mergedIndices.length) % mergedIndices.length
                : (currentPos + 1) % mergedIndices.length;
            const targetIndex = mergedIndices[nextPos];

            goToYellowRect(targetIndex);
            const containingRange = findPolylineRangeContainingIndex(targetIndex);
            if (containingRange) {
                highlightPolylineRange(containingRange.startIndex, containingRange.endIndex, 4000);
            }
            showRoleActionInfoMessage(`MERGE TAB 전환: [${targetIndex + 1}/${yellowRects.length}]`);
            return true;
        }

        function showTempMessage({ elementId, text, className = '', previousTimerId = null, onClear = null }) {
            const display = document.getElementById(elementId);
            if (!display) return previousTimerId;

            display.textContent = text;
            display.className = `status-message ${className}`.trim();
            if (elementId === 'goMetaDisplay') {
                display.style.visibility = 'visible';
            }

            if (previousTimerId !== null) {
                clearTimeout(previousTimerId);
            }

            const timerId = setTimeout(() => {
                if (typeof onClear === 'function') {
                    onClear(display);
                } else {
                    display.textContent = '';
                    display.className = '';
                    if (elementId === 'goMetaDisplay') {
                        display.style.visibility = 'hidden';
                    }
                }

                if (elementId === 'roleActionDisplay') {
                    roleActionDisplayTimer = null;
                } else if (elementId === 'goMetaDisplay') {
                    goMetaDisplayTimer = null;
                }
            }, 4000);

            return timerId;
        }

        function showMergeStateMessage(triggerKey, rect) {
            if (!rect) return;

            const isMerged = !!rect.mergeState;
            const mergeLabel = isMerged ? 'TRUE' : 'FALSE';
            const badge = isMerged ? 'MERGED' : 'NOT MERGED';

            canvas1StatusMessageTimer = showTempMessage({
                elementId: 'canvas1StatusMessage',
                text: `[${triggerKey}] ${badge} | mergeState: ${mergeLabel} | size: ${rect.size}x${rect.size}`,
                className: isMerged ? 'status-merged' : 'status-unmerged',
                previousTimerId: canvas1StatusMessageTimer,
                onClear: (display) => {
                    display.textContent = '';
                    display.className = '';
                    canvas1StatusMessageTimer = null;
                }
            });
        }

        function showRoleActionMessage(role, index, startIndex = null) {
            const isEnd = (role === 'end' && startIndex !== null);
            const text = isEnd ? `✅ End 지정: [${index + 1}] (Start: [${startIndex + 1}])` : `✅ Start 지정: [${index + 1}]`;
            const styleOverrides = isEnd
                ? { color: '#fff4d6', background: '#c46a1a', border: '1px solid #a85b16' }
                : { color: '#0d2d16', background: '#7ee4a0', border: '1px solid #55b678' };

            roleActionDisplayTimer = showTempMessage({
                elementId: 'roleActionDisplay',
                text,
                className: isEnd ? 'status-role-end' : 'status-role-start',
                previousTimerId: roleActionDisplayTimer
            });
        }

        function showRoleActionInfoMessage(message) {
            roleActionDisplayTimer = showTempMessage({
                elementId: 'roleActionDisplay',
                text: `✅ ${message}`,
                className: 'status-role-start',
                previousTimerId: roleActionDisplayTimer
            });
        }

        function showHistoryActionMessage(actionLabel, sourceLabel = '') {
            const safeAction = actionLabel === 'REDO' ? 'REDO' : 'UNDO';
            const className = safeAction === 'REDO' ? 'status-role-end' : 'status-role-start';
            const compactSource = String(sourceLabel || '')
                .split('·')
                .map(part => part.trim())
                .filter(Boolean)
                .pop() || '';
            const text = compactSource ? `[${safeAction}] ${compactSource}` : `[${safeAction}]`;

            roleActionDisplayTimer = showTempMessage({
                elementId: 'roleActionDisplay',
                text,
                className,
                previousTimerId: roleActionDisplayTimer
            });
        }

        function showRoleActionErrorMessage(message) {
            roleActionDisplayTimer = showTempMessage({
                elementId: 'roleActionDisplay',
                text: `❌ ${message}`,
                className: 'status-role-error',
                previousTimerId: roleActionDisplayTimer
            });
        }

        function showCanvas1AutoF9Message(message) {
            canvas1StatusMessageTimer = showTempMessage({
                elementId: 'canvas1StatusMessage',
                text: `❌ ${message}`,
                className: 'status-role-error',
                previousTimerId: canvas1StatusMessageTimer,
                onClear: (display) => {
                    display.textContent = '';
                    display.className = '';
                    canvas1StatusMessageTimer = null;
                }
            });
        }

        function showCanvas1AutoF9InfoMessage(message) {
            canvas1StatusMessageTimer = showTempMessage({
                elementId: 'canvas1StatusMessage',
                text: `${message}🔠`,
                className: 'status-role-start',
                previousTimerId: canvas1StatusMessageTimer,
                onClear: (display) => {
                    display.textContent = '';
                    display.className = '';
                    canvas1StatusMessageTimer = null;
                }
            });
        }

        function showCanvas1ClipboardScaleMessage(message) {
            canvas1StatusMessageTimer = showTempMessage({
                elementId: 'canvas1StatusMessage',
                text: `📋 ${message}`,
                className: 'status-clipboard-scale',
                previousTimerId: canvas1StatusMessageTimer,
                onClear: (display) => {
                    display.textContent = '';
                    display.className = '';
                    canvas1StatusMessageTimer = null;
                }
            });
        }

        function showGoMetaMessage(rect, index) {
            if (!rect) return;

            const mergeLabel = rect.mergeState ? '✙MERGED' : 'NOT MERGED';
            const terminal = getPolylineTerminalInfo(index);
            const polylineLabel = isValidPolylineId(rect.polylineId)
                ? `${rect.polylineId}:${Number.isFinite(rect.pointOrder) ? rect.pointOrder : '-'}`
                : 'NONE';

            goMetaDisplayTimer = showTempMessage({
                elementId: 'goMetaDisplay',
                text: `[Go ${index + 1}/${yellowRects.length}] ${mergeLabel} | ${terminal.label} | ${rect.size}x${rect.size} | P:${polylineLabel}`,
                className: 'status-go',
                previousTimerId: goMetaDisplayTimer
            });
        }

        function isAllWhiteRect(x, y, size) {
            const whiteCount = countWhitePixels(ctx1, x, y, size);
            const maxPixels = size * size;
            return {
                ok: whiteCount === maxPixels,
                whiteCount,
                maxPixels
            };
        }

        function isExactSameRect(x, y, size, rect) {
            return rect && rect.x === x && rect.y === y && rect.size === size;
        }

        function hasNonExactOverlapWithExistingRect(x, y, size) {
            return yellowRects.some(rect => {
                const overlapType = classifyRectOverlap(x, y, size, rect);
                if (overlapType === 'none') return false;
                return !isExactSameRect(x, y, size, rect);
            });
        }

        // 임시 노란색 사각형을 확정(F9 동작)하는 공통 함수
        function confirmTempYellowRect(triggerKey = 'F9') {
            if (!tempYellowRect) {
                console.log(`❌ 확정할 임시 노란색 사각형이 없습니다.`);
                return false;
            }

            if (hasNonExactOverlapWithExistingRect(tempYellowRect.x, tempYellowRect.y, tempYellowRect.size)) {
                const shouldAdd = window.confirm('일부만 겹칩니다. 추가하시겠습니까?');
                if (!shouldAdd) {
                    console.log(`ℹ️ [${triggerKey}] 일부 겹침 사각형 추가를 취소했습니다.`);
                    return false;
                }
            }

            const normalizedTarget = normalizeRectToFullOverlapTarget(tempYellowRect.x, tempYellowRect.y, tempYellowRect.size);
            if (normalizedTarget.snapped) {
                tempYellowRect = {
                    x: normalizedTarget.x,
                    y: normalizedTarget.y,
                    size: normalizedTarget.size
                };
                console.log(
                    `   [${triggerKey}] full-overlap 정규화 적용: ` +
                    `기존 점 #${normalizedTarget.targetIndex + 1} (${tempYellowRect.x},${tempYellowRect.y}, size=${tempYellowRect.size})`
                );
            }

            const whiteCheck = isAllWhiteRect(tempYellowRect.x, tempYellowRect.y, tempYellowRect.size);
            if (!whiteCheck.ok) {
                const message = `[${triggerKey}] 흰색 사각형만 추가 가능 (${whiteCheck.whiteCount}/${whiteCheck.maxPixels})`;
                showRoleActionErrorMessage(message);
                console.log(
                    `❌ [${triggerKey}] 흰색 사각형만 추가할 수 있습니다. ` +
                    `(흰색: ${whiteCheck.whiteCount}/${whiteCheck.maxPixels}, 좌표: ${tempYellowRect.x},${tempYellowRect.y}, 크기: ${tempYellowRect.size})`
                );
                return false;
            }

            // 확정 추가도 Ctrl/Cmd+Z로 되돌릴 수 있도록 스냅샷 저장
            pushDeleteUndoState(triggerKey);

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
            const confirmedRect = yellowRects[yellowRects.length - 1];
            showMergeStateMessage(triggerKey, confirmedRect);
            if (normalizedTarget.snapped) {
                showRoleActionInfoMessage(`MERGE 정규화 저장: ${confirmedRect.size}x${confirmedRect.size}로 저장됨`);
            }

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
            const tempYellowCoordInput = document.getElementById('tempYellowCoord');
            if (tempYellowCoordInput) tempYellowCoordInput.value = '-';

            scaleCanvas(); // 화면 갱신
            return true;
        }

        let autoF9ErrorFlashTimer = null;

        function flashAutoF9ButtonError() {
            const autoF9Button = document.getElementById('btnAutoF9');
            if (!autoF9Button) return;

            if (!autoF9Button.dataset.baseStyle) {
                autoF9Button.dataset.baseStyle = autoF9Button.getAttribute('style') || '';
            }
            if (!autoF9Button.dataset.baseText) {
                autoF9Button.dataset.baseText = autoF9Button.textContent || '자동 F9';
            }

            const fixedWidth = Math.ceil(autoF9Button.getBoundingClientRect().width);
            autoF9Button.textContent = 'NO RECT';

            autoF9Button.setAttribute(
                'style',
                `${autoF9Button.dataset.baseStyle}; width:${fixedWidth}px; background:#d9534f; border:3px solid #ffdc00; box-shadow: 0 0 4px 2px rgba(255,220,0,0.8); color:white; font-weight:bold;`
            );

            if (autoF9ErrorFlashTimer !== null) {
                clearTimeout(autoF9ErrorFlashTimer);
            }

            autoF9ErrorFlashTimer = setTimeout(() => {
                autoF9Button.textContent = autoF9Button.dataset.baseText || '자동 F9';
                autoF9Button.setAttribute('style', autoF9Button.dataset.baseStyle || '');
                autoF9ErrorFlashTimer = null;
            }, 2000);
        }

        // 자동 F10 실패 시: 각도 차이가 가장 작은 후보 1개를 기본 선택
        function selectClosestAnglePathButton(buttons) {
            if (!Array.isArray(buttons) || buttons.length === 0) return null;

            const uniqueButtonMap = new Map();
            buttons.forEach(btn => {
                const x = btn.getAttribute('data-x') || '';
                const y = btn.getAttribute('data-y') || '';
                const size = btn.getAttribute('data-size') || '';
                const key = `${x},${y},${size}`;
                if (!uniqueButtonMap.has(key)) {
                    uniqueButtonMap.set(key, btn);
                }
            });
            const uniqueButtons = Array.from(uniqueButtonMap.values());
            if (uniqueButtons.length === 0) return null;

            let expectedAngle = null;
            if (yellowRects.length > 0) {
                const lastAngle = yellowRects[yellowRects.length - 1].angle;
                if (Number.isFinite(lastAngle)) {
                    expectedAngle = lastAngle;
                }
            }

            const getBorderMeta = (btn) => {
                const styleText = (btn.getAttribute('style') || '').toLowerCase();
                if (styleText.includes('#ff0000')) return { name: '빨강', color: '#FF0000' };
                if (styleText.includes('#ff8c00')) return { name: '주황', color: '#FF8C00' };
                if (styleText.includes('#a39908')) return { name: '황토', color: '#A39908' };
                if (styleText.includes('#1867dd')) return { name: '파랑', color: '#1867DD' };
                return { name: '기본', color: '-' };
            };

            const getPriority = (btn) => {
                const styleText = (btn.getAttribute('style') || '').toLowerCase();
                if (styleText.includes('#ff0000')) return 0;
                if (styleText.includes('#ff8c00')) return 1;
                if (styleText.includes('#a39908')) return 2;
                if (styleText.includes('#1867dd')) return 3;
                return 4;
            };

            const scored = uniqueButtons
                .map((btn, index) => {
                    const x = parseInt(btn.getAttribute('data-x'), 10);
                    const y = parseInt(btn.getAttribute('data-y'), 10);
                    const size = parseInt(btn.getAttribute('data-size'), 10);
                    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size)) return null;

                    let angle = parseFloat(btn.getAttribute('data-angle'));
                    if (!Number.isFinite(angle) && selectedPixel) {
                        const rectSize = parseInt(document.getElementById('rectSize').value, 10) || 4;
                        const baseX = selectedPixel.x + rectSize / 2;
                        const baseY = selectedPixel.y + rectSize / 2;
                        const targetX = x + size / 2;
                        const targetY = y + size / 2;
                        angle = calculateCartesianAngle(targetX - baseX, targetY - baseY);
                    }

                    const angleDiff = (expectedAngle !== null && Number.isFinite(angle))
                        ? Math.abs(getCircularAngleDiff(angle, expectedAngle, false))
                        : null;

                    return {
                        btn,
                        x,
                        y,
                        size,
                        angle,
                        expectedAngle,
                        angleDiff,
                        border: getBorderMeta(btn),
                        priority: getPriority(btn),
                        index
                    };
                })
                .filter(Boolean);

            if (scored.length === 0) return null;

            // 기대 각도가 있으면 각도 차이 우선, 동률은 테두리 우선순위로 선택
            if (expectedAngle !== null) {
                const withAngle = scored.filter(item => item.angleDiff !== null);
                if (withAngle.length > 0) {
                    withAngle.sort((a, b) => {
                        if (a.angleDiff !== b.angleDiff) return a.angleDiff - b.angleDiff;
                        if (a.priority !== b.priority) return a.priority - b.priority;
                        return a.index - b.index;
                    });
                    return withAngle[0];
                }
            }

            scored.sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                return a.index - b.index;
            });
            return scored[0];
        }

        function getRecommendedRectOverlapWarning(x, y, size) {
            const fullOverlapIndices = [];
            const partialOverlapIndices = [];

            yellowRects.forEach((rect, index) => {
                const overlapType = classifyRectOverlap(x, y, size, rect);
                if (overlapType === 'full') {
                    fullOverlapIndices.push(index + 1);
                } else if (overlapType === 'partial') {
                    partialOverlapIndices.push(index + 1);
                }
            });

            const warningParts = [];
            if (fullOverlapIndices.length > 0) {
                warningParts.push(`FULL 겹침 [${fullOverlapIndices.join(',')}]`);
            }
            if (partialOverlapIndices.length > 0) {
                warningParts.push(`일부 겹침(PARTIAL) [${partialOverlapIndices.join(',')}]`);
            }

            return warningParts.length > 0
                ? `⛔⛔⤭ 기존 점과 ${warningParts.join(' / ')}`
                : '';
        }

        function getAutoF10PreviewTarget() {
            if (tempYellowRect) {
                const rectSize = parseInt(document.getElementById('rectSize').value, 10) || 4;
                const tempAngle = selectedPixel
                    ? calculateRectToRectAngle(
                        selectedPixel.x,
                        selectedPixel.y,
                        rectSize,
                        tempYellowRect.x,
                        tempYellowRect.y,
                        tempYellowRect.size
                    )
                    : null;

                return {
                    ok: true,
                    source: 'temp',
                    x: tempYellowRect.x,
                    y: tempYellowRect.y,
                    size: tempYellowRect.size,
                    angle: Number.isFinite(tempAngle) ? tempAngle : null,
                    borderText: '임시 선택',
                    failReason: ''
                };
            }

            const pathWhiteContent = document.getElementById('pathWhiteContent');
            if (!pathWhiteContent) {
                return {
                    ok: false,
                    failReason: '경로별 흰색점 영역을 찾을 수 없습니다.'
                };
            }

            const allButtons = Array.from(pathWhiteContent.querySelectorAll('button')).filter(btn => !btn.disabled);
            if (allButtons.length === 0) {
                return {
                    ok: false,
                    failReason: '선택 가능한 경로 후보가 없습니다.'
                };
            }

            const uniqueByRect = (buttons) => {
                const uniqueButtonMap = new Map();
                buttons.forEach(btn => {
                    const x = btn.getAttribute('data-x') || '';
                    const y = btn.getAttribute('data-y') || '';
                    const size = btn.getAttribute('data-size') || '';
                    const key = `${x},${y},${size}`;
                    if (!uniqueButtonMap.has(key)) {
                        uniqueButtonMap.set(key, btn);
                    }
                });
                return uniqueButtonMap;
            };

            const redButtons = allButtons.filter(btn => {
                const styleText = (btn.getAttribute('style') || '').toLowerCase();
                return styleText.includes('#ff0000');
            });
            const orangeButtons = allButtons.filter(btn => {
                const styleText = (btn.getAttribute('style') || '').toLowerCase();
                return styleText.includes('#ff8c00');
            });

            const uniqueRedButtonMap = uniqueByRect(redButtons);
            const uniqueOrangeButtonMap = uniqueByRect(orangeButtons);

            const parseButtonTarget = (btn, source, borderText, failReason = '') => {
                const x = parseInt(btn.getAttribute('data-x'), 10);
                const y = parseInt(btn.getAttribute('data-y'), 10);
                const size = parseInt(btn.getAttribute('data-size'), 10);
                let angle = parseFloat(btn.getAttribute('data-angle'));
                if (!Number.isFinite(angle) && selectedPixel) {
                    const rectSize = parseInt(document.getElementById('rectSize').value, 10) || 4;
                    const baseX = selectedPixel.x + rectSize / 2;
                    const baseY = selectedPixel.y + rectSize / 2;
                    const targetX = x + size / 2;
                    const targetY = y + size / 2;
                    angle = calculateCartesianAngle(targetX - baseX, targetY - baseY);
                }
                return {
                    ok: Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(size),
                    source,
                    x,
                    y,
                    size,
                    angle: Number.isFinite(angle) ? angle : null,
                    borderText,
                    failReason
                };
            };

            if (uniqueRedButtonMap.size === 1) {
                return parseButtonTarget(Array.from(uniqueRedButtonMap.values())[0], 'red', '빨강(#FF0000)');
            }

            if (uniqueRedButtonMap.size === 0 && uniqueOrangeButtonMap.size === 1) {
                return parseButtonTarget(Array.from(uniqueOrangeButtonMap.values())[0], 'orange', '주황(#FF8C00)');
            }

            const reason =
                uniqueRedButtonMap.size > 0
                    ? `빨간 테두리 후보(중복제거) 수가 1개가 아님 (현재 ${uniqueRedButtonMap.size}개 / 중복포함 ${redButtons.length}개)`
                    : `빨간 테두리 후보 0개이며 주황 테두리 후보(중복제거)도 1개가 아님 (현재 ${uniqueOrangeButtonMap.size}개 / 중복포함 ${orangeButtons.length}개)`;

            const fallbackTarget = selectClosestAnglePathButton(allButtons);
            if (fallbackTarget && fallbackTarget.btn) {
                return {
                    ok: true,
                    source: 'fallback',
                    x: fallbackTarget.x,
                    y: fallbackTarget.y,
                    size: fallbackTarget.size,
                    angle: Number.isFinite(fallbackTarget.angle) ? fallbackTarget.angle : null,
                    borderText: `${fallbackTarget.border.name}(${fallbackTarget.border.color})`,
                    failReason: reason,
                    angleDiff: Number.isFinite(fallbackTarget.angleDiff) ? fallbackTarget.angleDiff : null
                };
            }

            return {
                ok: false,
                failReason: `자동 F9 조건 불만족: ${reason}`
            };
        }

        function viewNextAutoF10PointOnCanvas2() {
            const preview = getAutoF10PreviewTarget();
            if (!preview.ok) {
                showCanvas1AutoF9Message(`추천 점 View 실패: ${preview.failReason}`);
                return false;
            }

            const size = Number.isFinite(preview.size) ? preview.size : 1;
            const maxX = Math.max(0, currentCanvasWidth - size);
            const maxY = Math.max(0, currentCanvasHeight - size);
            const x = clamp(preview.x, 0, maxX);
            const y = clamp(preview.y, 0, maxY);

            tempYellowClickVariant = (tempYellowClickVariant + 1) % 2;
            tempYellowRect = {
                x,
                y,
                size,
                clickVariant: tempYellowClickVariant
            };

            if (Number.isFinite(preview.angle)) {
                updateTempYellowAngle(preview.angle);
            } else {
                updateTempYellowAngle();
            }

            const overlapWarning = getRecommendedRectOverlapWarning(x, y, size);
            const angleText = Number.isFinite(preview.angle) ? `${Math.round(preview.angle)}°` : '-';
            const directionText = Number.isFinite(preview.angle)
                ? getDirectionArrowLabel(classifyDirectionFromAngle(preview.angle))
                : '-';
            const sourceText =
                preview.source === 'temp'
                    ? '현재 임시점 확정 예정'
                    : (preview.source === 'fallback' ? 'fallback 추천 예정' : '자동 추천 예정');
            const angleDiffText = Number.isFinite(preview.angleDiff) ? `, Δ${preview.angleDiff}°` : '';
            const detail =
                `F10 예정 점 View: (${x},${y}), ${size}x${size}, 각도 ${angleText}, 방향 ${directionText}${angleDiffText}, ` +
                `테두리 ${preview.borderText}, ${sourceText}`;

            showCanvas1AutoF9InfoMessage(overlapWarning ? `${overlapWarning} | ${detail}` : detail);
            scaleCanvas();
            return true;
        }

        // 자동 F9 한 스텝: 빨간 테두리 1개 우선, 없으면 주황 테두리 1개를 대체 선택
        function runAutoF9Step() {
            // 사용자가 QWE/ASD/ZXC(또는 버튼 클릭)로 이미 1개 임시 점을 선택한 경우,
            // F10은 해당 점을 우선 자동 확정한다.
            if (tempYellowRect) {
                const confirmedCurrentTemp = confirmTempYellowRect('F10');
                if (confirmedCurrentTemp) {
                    console.log('✅ 자동 F10: 기존 임시 선택 점을 우선 확정했습니다.');
                    return true;
                }
                // 임시 점 확정 실패 시 기존 자동 선택 로직으로 계속 진행
            }

            const pathWhiteContent = document.getElementById('pathWhiteContent');
            if (!pathWhiteContent) {
                console.log('❌ 경로별 흰색점 영역을 찾을 수 없습니다.');
                flashAutoF9ButtonError();
                return false;
            }

            const allButtons = Array.from(pathWhiteContent.querySelectorAll('button')).filter(btn => !btn.disabled);
            const uniqueByRect = (buttons) => {
                const uniqueButtonMap = new Map();
                buttons.forEach(btn => {
                    const x = btn.getAttribute('data-x') || '';
                    const y = btn.getAttribute('data-y') || '';
                    const size = btn.getAttribute('data-size') || '';
                    const key = `${x},${y},${size}`;
                    if (!uniqueButtonMap.has(key)) {
                        uniqueButtonMap.set(key, btn);
                    }
                });
                return uniqueButtonMap;
            };

            const redButtons = allButtons.filter(btn => {
                const styleText = (btn.getAttribute('style') || '').toLowerCase();
                return styleText.includes('#ff0000');
            });
            const orangeButtons = allButtons.filter(btn => {
                const styleText = (btn.getAttribute('style') || '').toLowerCase();
                return styleText.includes('#ff8c00');
            });

            const uniqueRedButtonMap = uniqueByRect(redButtons);
            const uniqueOrangeButtonMap = uniqueByRect(orangeButtons);

            let targetButton = null;
            let selectedBorderLabel = '';

            if (uniqueRedButtonMap.size === 1) {
                targetButton = Array.from(uniqueRedButtonMap.values())[0];
                selectedBorderLabel = '빨간';
            } else if (uniqueRedButtonMap.size === 0 && uniqueOrangeButtonMap.size === 1) {
                targetButton = Array.from(uniqueOrangeButtonMap.values())[0];
                selectedBorderLabel = '주황';
            }

            if (!targetButton) {
                const reason =
                    uniqueRedButtonMap.size > 0
                        ? `빨간 테두리 후보(중복제거) 수가 1개가 아님 (현재 ${uniqueRedButtonMap.size}개 / 중복포함 ${redButtons.length}개)`
                        : `빨간 테두리 후보 0개이며 주황 테두리 후보(중복제거)도 1개가 아님 (현재 ${uniqueOrangeButtonMap.size}개 / 중복포함 ${orangeButtons.length}개)`;
                const autoF9FailMessage = `자동 F9 조건 불만족: ${reason}`;

                const fallbackTarget = selectClosestAnglePathButton(allButtons);
                if (fallbackTarget && fallbackTarget.btn) {
                    fallbackTarget.btn.click();

                    const fallbackX = fallbackTarget.x;
                    const fallbackY = fallbackTarget.y;
                    const fallbackSize = fallbackTarget.size;
                    const fallbackAngleText = Number.isFinite(fallbackTarget.angle)
                        ? `${Math.round(fallbackTarget.angle)}°`
                        : '-';
                    const fallbackAngleDiffText = Number.isFinite(fallbackTarget.angleDiff)
                        ? `Δ${fallbackTarget.angleDiff}°`
                        : 'Δ-';
                    const fallbackDirection = Number.isFinite(fallbackTarget.angle)
                        ? getDirectionArrowLabel(classifyDirectionFromAngle(fallbackTarget.angle))
                        : '-';
                    const fallbackBorderText = `${fallbackTarget.border.name}(${fallbackTarget.border.color})`;
                    const overlapWarning = getRecommendedRectOverlapWarning(fallbackX, fallbackY, fallbackSize);
                    const fallbackDetailMessage =
                        `F10 추천 점 자동선택: (${fallbackX},${fallbackY}), ${fallbackSize}x${fallbackSize}, ` +
                        `각도 ${fallbackAngleText}, 방향 ${fallbackDirection}, ${fallbackAngleDiffText}, 테두리 ${fallbackBorderText}`;

                    showCanvas1AutoF9Message(`${autoF9FailMessage} → 각도 유사 후보 1개를 기본 선택함`);
                    showCanvas1AutoF9InfoMessage(
                        overlapWarning ? `${overlapWarning} | ${fallbackDetailMessage}` : fallbackDetailMessage
                    );
                    console.log(
                        `⚠️ ${autoF9FailMessage} | ` +
                        `기본 선택 적용: (${fallbackX},${fallbackY}), 크기 ${fallbackSize}x${fallbackSize}, ` +
                        `각도 ${fallbackAngleText}, 방향 ${fallbackDirection}, ${fallbackAngleDiffText}, 테두리 ${fallbackBorderText}` +
                        (overlapWarning ? `, ${overlapWarning}` : '')
                    );
                    return false;
                }

                showCanvas1AutoF9Message(autoF9FailMessage);
                console.log(`❌ ${autoF9FailMessage}`);
                flashAutoF9ButtonError();
                return false;
            }

            const targetX = parseInt(targetButton.getAttribute('data-x'), 10);
            const targetY = parseInt(targetButton.getAttribute('data-y'), 10);
            const targetSize = parseInt(targetButton.getAttribute('data-size'), 10);
            if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(targetSize)) {
                console.log('❌ 자동 F9 후보의 좌표/크기 데이터가 올바르지 않습니다.');
                flashAutoF9ButtonError();
                return false;
            }

            const whiteCheck = isAllWhiteRect(targetX, targetY, targetSize);
            if (!whiteCheck.ok) {
                showRoleActionErrorMessage(`자동 F9 실패: 흰색 사각형 아님 (${whiteCheck.whiteCount}/${whiteCheck.maxPixels})`);
                console.log(
                    `❌ 자동 F9 후보가 흰색 사각형이 아닙니다. ` +
                    `(흰색: ${whiteCheck.whiteCount}/${whiteCheck.maxPixels}, 좌표: ${targetX},${targetY}, 크기: ${targetSize})`
                );
                flashAutoF9ButtonError();
                return false;
            }

            // 1) 우선순위(빨강>주황)에 따라 선택된 버튼 클릭으로 임시 노란색 지정
            targetButton.click();

            // 2) F9 동작으로 확정
            const confirmed = confirmTempYellowRect('F10');
            if (confirmed) {
                console.log(`✅ 자동 F9 한 스텝 완료 (${selectedBorderLabel} 후보 1개 선택 + 확정).`);
            }
            return confirmed;
        }
        
        function deleteYellowRectsFromCurrentToEnd(triggerLabel = 'Del 버튼') {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                console.log('❌ 삭제할 노란색 사각형이 선택되지 않았습니다.');
                return false;
            }

            const deleteStart = currentYellowIndex;
            const deleteCount = yellowRects.length - deleteStart;

            if (deleteCount <= 0) {
                console.log('ℹ️ 선택된 사각형 뒤에 삭제할 항목이 없습니다.');
                return false;
            }

            pushDeleteUndoState(triggerLabel);

            yellowRects.splice(deleteStart, deleteCount);

            // 삭제 후 현재 인덱스가 범위를 벗어나지 않도록 보정
            if (currentYellowIndex >= yellowRects.length) {
                currentYellowIndex = yellowRects.length - 1;
            }

            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            if (yellowRects.length === 0) {
                activePolylineId = null;
            } else {
                const lastRect = yellowRects[yellowRects.length - 1];
                activePolylineId = normalizeRole(lastRect.role) === 'end' ? null : (lastRect.polylineId || null);
            }
            refreshPolylineRangeControl();

            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }

            console.log(`✅ [${triggerLabel}] 노란색 사각형 ${deleteCount}개 삭제됨 (선택 인덱스 이후).`);
            scaleCanvas();
            return true;
        }

        function deleteYellowRectsFromStartToCurrent(triggerLabel = 'Shift+Del 버튼') {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                console.log('❌ 삭제할 노란색 사각형이 선택되지 않았습니다.');
                return false;
            }

            const range = resolveStartToCurrentRange(currentYellowIndex);
            if (!range) {
                console.log('❌ 현재 점이 속한 폴리라인의 시작점을 찾을 수 없습니다.');
                return false;
            }

            const deleteStart = range.startIndex;
            const deleteCount = range.endIndex - range.startIndex + 1;

            if (deleteCount <= 0) {
                console.log('ℹ️ 선택된 사각형 앞에 삭제할 항목이 없습니다.');
                return false;
            }

            pushDeleteUndoState(triggerLabel);

            yellowRects.splice(deleteStart, deleteCount);

            // 폴리라인 시작~현재 삭제 후에는 남은 동일 위치(shift된 인덱스)를 선택한다.
            if (yellowRects.length === 0) {
                currentYellowIndex = -1;
            } else {
                currentYellowIndex = Math.min(deleteStart, yellowRects.length - 1);
            }

            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            if (yellowRects.length === 0) {
                activePolylineId = null;
            } else {
                const lastRect = yellowRects[yellowRects.length - 1];
                activePolylineId = normalizeRole(lastRect.role) === 'end' ? null : (lastRect.polylineId || null);
            }
            refreshPolylineRangeControl();

            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }

            console.log(`✅ [${triggerLabel}] 노란색 사각형 ${deleteCount}개 삭제됨 (현재 폴리라인 시작점부터 선택 인덱스까지).`);
            scaleCanvas();
            return true;
        }

        const deleteUndoStack = [];
        const deleteRedoStack = [];
        const MAX_DELETE_UNDO_STACK = 50;

        function cloneYellowRectsState(rects) {
            return rects.map(rect => ({ ...rect }));
        }

        function captureDeleteEditState(triggerLabel = '') {
            const rectSizeInput = document.getElementById('rectSize');
            const rectSizeValue = rectSizeInput ? (parseInt(rectSizeInput.value, 10) || null) : null;

            return {
                triggerLabel,
                yellowRects: cloneYellowRectsState(yellowRects),
                currentYellowIndex,
                selectedPixel: selectedPixel ? { ...selectedPixel } : null,
                rectSizeValue
            };
        }

        function restoreDeleteEditState(state) {
            yellowRects = cloneYellowRectsState(state.yellowRects || []);
            currentYellowIndex = Number.isInteger(state.currentYellowIndex) ? state.currentYellowIndex : -1;
            selectedPixel = state.selectedPixel ? { ...state.selectedPixel } : selectedPixel;

            const rectSizeInput = document.getElementById('rectSize');
            if (rectSizeInput && Number.isFinite(state.rectSizeValue)) {
                rectSizeInput.value = String(state.rectSizeValue);
            }

            if (yellowRects.length === 0) {
                activePolylineId = null;
            } else {
                const lastRect = yellowRects[yellowRects.length - 1];
                activePolylineId = normalizeRole(lastRect.role) === 'end' ? null : (lastRect.polylineId || null);
            }

            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            refreshPolylineRangeControl();

            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }

            scaleCanvas();
        }

        function pushDeleteUndoState(triggerLabel = 'Del') {
            deleteUndoStack.push(captureDeleteEditState(triggerLabel));

            if (deleteUndoStack.length > MAX_DELETE_UNDO_STACK) {
                deleteUndoStack.shift();
            }

            // 새로운 편집이 발생하면 redo 체인은 끊는다.
            deleteRedoStack.length = 0;
        }

        function undoLastDelete(triggerLabel = 'Ctrl+Z') {
            if (deleteUndoStack.length === 0) {
                console.log(`ℹ️ [${triggerLabel}] 되돌릴 삭제 이력이 없습니다.`);
                return false;
            }

            deleteRedoStack.push(captureDeleteEditState('redo-base'));
            if (deleteRedoStack.length > MAX_DELETE_UNDO_STACK) {
                deleteRedoStack.shift();
            }

            const prev = deleteUndoStack.pop();
            restoreDeleteEditState(prev);
            console.log(`↩️ [${triggerLabel}] 작업 되돌리기 완료 (${prev.triggerLabel}).`);
            showHistoryActionMessage('UNDO', `${triggerLabel} · ${prev.triggerLabel}`);
            return true;
        }

        function redoLastDelete(triggerLabel = 'Ctrl+Y') {
            if (deleteRedoStack.length === 0) {
                console.log(`ℹ️ [${triggerLabel}] 다시 실행할 이력이 없습니다.`);
                return false;
            }

            deleteUndoStack.push(captureDeleteEditState('undo-base'));
            if (deleteUndoStack.length > MAX_DELETE_UNDO_STACK) {
                deleteUndoStack.shift();
            }

            const next = deleteRedoStack.pop();
            restoreDeleteEditState(next);
            console.log(`↪️ [${triggerLabel}] 작업 다시 실행 완료 (${next.triggerLabel || 'redo'}).`);
            showHistoryActionMessage('REDO', `${triggerLabel} · ${next.triggerLabel || 'redo'}`);
            return true;
        }

        function showRectPixelStats(message) {
            roleActionDisplayTimer = showTempMessage({
                elementId: 'roleActionDisplay',
                text: message,
                className: 'status-go',
                previousTimerId: roleActionDisplayTimer
            });
        }

        function computeSelectedRectPixelStats() {
            if (!selectedPixel) {
                showRectPixelStats('❌ 마우스로 선택된 위치가 없습니다.');
                return;
            }

            const rectSize = parseInt(document.getElementById('rectSize').value, 10) || 4;
            const rect = {
                x: selectedPixel.x,
                y: selectedPixel.y,
                size: rectSize
            };

            const x0 = Math.max(0, rect.x);
            const y0 = Math.max(0, rect.y);
            const x1 = Math.min(currentCanvasWidth, rect.x + rect.size);
            const y1 = Math.min(currentCanvasHeight, rect.y + rect.size);
            const width = x1 - x0;
            const height = y1 - y0;

            if (width <= 0 || height <= 0) {
                showRectPixelStats('❌ 선택된 사각형이 캔버스 밖입니다.');
                return;
            }

            try {
                const imageData = ctx1.getImageData(x0, y0, width, height);
                const data = imageData.data;
                let minVal = 255;
                let maxVal = 0;
                let sum = 0;
                let count = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const value = Math.round((r + g + b) / 3);

                    minVal = Math.min(minVal, value);
                    maxVal = Math.max(maxVal, value);
                    sum += value;
                    count += 1;
                }

                const avgVal = count > 0 ? (sum / count) : 0;
                showRectPixelStats(`F1: 선택 사각형 픽셀값 min ${minVal}, max ${maxVal}, avg ${avgVal.toFixed(1)}`);
            } catch (err) {
                console.error('픽셀값 계산 오류:', err);
                showRectPixelStats('❌ 픽셀값 계산 중 오류가 발생했습니다.');
            }
        }

        function adjustCornerSize(delta) {
            const cornerSizeInput = document.getElementById('cornerSize');
            if (!cornerSizeInput) return;

            const minValue = Number.isFinite(parseInt(cornerSizeInput.min, 10)) ? parseInt(cornerSizeInput.min, 10) : 1;
            const maxValue = Number.isFinite(parseInt(cornerSizeInput.max, 10)) ? parseInt(cornerSizeInput.max, 10) : 32;
            const currentValue = parseInt(cornerSizeInput.value, 10) || minValue;
            let nextValue = currentValue + delta;

            if (nextValue < minValue) nextValue = minValue;
            if (nextValue > maxValue) nextValue = maxValue;

            if (nextValue === currentValue) return;

            cornerSizeInput.value = String(nextValue);
            console.log(`🎚️ 귀퉁이 크기 조정: ${currentValue} → ${nextValue}`);

            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }

            scaleCanvas();
        }

        function clearCornerPathPreview() {
            cornerRects = [];
            pathRects01_n = [];
            pathRects23_n = [];
            pathRects02_n = [];
            pathRects13_n = [];
            pathRects01_n1 = [];
            pathRects23_n1 = [];
            pathRects02_n1 = [];
            pathRects13_n1 = [];
            recommendedPathRects = [];
            secondaryPathRects = [];
            tertiaryPathRects = [];
            fallbackPathRects = [];

            const cornerPixelsDisplay = document.getElementById('cornerPixelsDisplay');
            if (cornerPixelsDisplay) cornerPixelsDisplay.textContent = '[—,—,—,—]';

            const baseRectWhite = document.getElementById('baseRectWhite');
            if (baseRectWhite) baseRectWhite.textContent = '—';

            ['pathCount01', 'pathCount23', 'pathCount02', 'pathCount13'].forEach(id => {
                if (document.getElementById(id)) document.getElementById(id).textContent = 0;
            });

            ['pathWhite01', 'pathWhite23', 'pathWhite02', 'pathWhite13'].forEach(id => {
                if (document.getElementById(id)) document.getElementById(id).innerHTML = '-';
            });

            resetPriorityBorderCountsDisplay();
        }

        function classifyDirectionFromAngle(angle) {
            const normalized = ((angle % 360) + 360) % 360;

            if (normalized >= 337.5 || normalized < 22.5) return 'right';
            if (normalized >= 22.5 && normalized < 67.5) return 'upRight';
            if (normalized >= 67.5 && normalized < 112.5) return 'up';
            if (normalized >= 112.5 && normalized < 157.5) return 'upLeft';
            if (normalized >= 157.5 && normalized < 202.5) return 'left';
            if (normalized >= 202.5 && normalized < 247.5) return 'downLeft';
            if (normalized >= 247.5 && normalized < 292.5) return 'down';
            return 'downRight';
        }

        function getDirectionArrowLabel(direction) {
            const map = {
                right: '→ 우',
                upRight: '↗ 우상',
                up: '↑ 상',
                upLeft: '↖ 좌상',
                left: '← 좌',
                downLeft: '↙ 좌하',
                down: '↓ 하',
                downRight: '↘ 우하'
            };
            return map[direction] || '-';
        }

        function triggerPathButtonByNumpadKey(rawKey) {
            const key = (rawKey || '').toUpperCase();
            const keyToDirection = {
                Q: 'upLeft',
                W: 'up',
                E: 'upRight',
                A: 'left',
                S: 'center',
                D: 'right',
                Z: 'downLeft',
                X: 'down',
                C: 'downRight'
            };

            const requestedDirection = keyToDirection[key];
            if (!requestedDirection) return false;

            const pathWhiteContent = document.getElementById('pathWhiteContent');
            if (!pathWhiteContent) return false;

            const allButtons = Array.from(pathWhiteContent.querySelectorAll('button[data-path]')).filter(btn => !btn.disabled);
            if (allButtons.length === 0) return false;

            const withPriority = allButtons
                .map(btn => {
                    const styleText = (btn.getAttribute('style') || '').toLowerCase();
                    const isRed = styleText.includes('#ff0000');
                    const isOrange = styleText.includes('#ff8c00');
                    const isThird = styleText.includes('#a39908');
                    const isBlue = styleText.includes('#1867dd');

                    const x = parseInt(btn.getAttribute('data-x'), 10);
                    const y = parseInt(btn.getAttribute('data-y'), 10);
                    const size = parseInt(btn.getAttribute('data-size'), 10);
                    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size)) return null;

                    let angle = parseFloat(btn.getAttribute('data-angle'));
                    if (!Number.isFinite(angle) && selectedPixel) {
                        const rectSize = parseInt(document.getElementById('rectSize').value, 10) || 4;
                        const baseX = selectedPixel.x + rectSize / 2;
                        const baseY = selectedPixel.y + rectSize / 2;
                        const targetX = x + size / 2;
                        const targetY = y + size / 2;
                        angle = calculateCartesianAngle(targetX - baseX, targetY - baseY);
                    }
                    if (!Number.isFinite(angle)) return null;

                    return {
                        btn,
                        key: `${x},${y},${size}`,
                        isRed,
                        isOrange,
                        isThird,
                        isBlue,
                        direction: classifyDirectionFromAngle(angle)
                    };
                })
                .filter(Boolean);

            const filteredByDirection = requestedDirection === 'center'
                ? withPriority
                : withPriority.filter(item => item.direction === requestedDirection);

            const uniqueByRect = (items) => {
                const unique = new Map();
                items.forEach(item => {
                    if (!unique.has(item.key)) {
                        unique.set(item.key, item);
                    }
                });
                return Array.from(unique.values());
            };

            const redCandidates = uniqueByRect(filteredByDirection.filter(item => item.isRed));
            const orangeCandidates = uniqueByRect(filteredByDirection.filter(item => !item.isRed && item.isOrange));
            const thirdCandidates = uniqueByRect(filteredByDirection.filter(item => !item.isRed && !item.isOrange && item.isThird));
            const blueCandidates = uniqueByRect(filteredByDirection.filter(item => !item.isRed && !item.isOrange && !item.isThird && item.isBlue));
            const fallbackCandidates = uniqueByRect(filteredByDirection.filter(item => !item.isRed && !item.isOrange && !item.isThird && !item.isBlue));

            const target =
                redCandidates[0] ||
                orangeCandidates[0] ||
                thirdCandidates[0] ||
                blueCandidates[0] ||
                fallbackCandidates[0];
            if (!target) return false;

            target.btn.click();
            return true;
        }

        // F2, F4, F8, F9, F10, F11, DEL, IJKL 키 이벤트 리스너
        document.addEventListener('keydown', (e) => {
            const activeElement = document.activeElement;
            const isTypingTarget = !!(
                activeElement &&
                (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.tagName === 'SELECT' ||
                    activeElement.isContentEditable
                )
            );

            const isUndoCommand =
                (e.key === 'z' || e.key === 'Z') &&
                (e.ctrlKey || e.metaKey) &&
                !e.shiftKey &&
                !e.altKey;

            const isRedoCommand =
                !e.altKey && (
                    ((e.key === 'y' || e.key === 'Y') && e.ctrlKey && !e.metaKey && !e.shiftKey) ||
                    ((e.key === 'z' || e.key === 'Z') && e.metaKey && !e.ctrlKey && e.shiftKey)
                );

            if (isUndoCommand && !isTypingTarget) {
                const undone = undoLastDelete(e.metaKey ? 'Cmd+Z' : 'Ctrl+Z');
                if (undone) {
                    e.preventDefault();
                }
            }

            if (isRedoCommand && !isTypingTarget) {
                const redone = redoLastDelete((e.metaKey && e.shiftKey) ? 'Cmd+Shift+Z' : 'Ctrl+Y');
                if (redone) {
                    e.preventDefault();
                }
            }

            if (!isTypingTarget && e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const switched = cycleToMergedYellowRect(e.shiftKey);
                e.preventDefault();
                if (!switched) {
                    if (currentYellowIndex >= 0 && currentYellowIndex < yellowRects.length) {
                        const containingRange = findPolylineRangeContainingIndex(currentYellowIndex);
                        if (containingRange) {
                            highlightPolylineRange(containingRange.startIndex, containingRange.endIndex, 3000);
                        }
                    }
                    showRoleActionErrorMessage('TAB 전환 대상이 없어 기본 TAB 이동을 막았습니다.');
                }
            }

            if (!isTypingTarget && e.key === 'F1') {
                computeSelectedRectPixelStats();
                e.preventDefault();
            }

            if (e.key === 'Delete' && !isTypingTarget) {
                const deleted = e.shiftKey
                    ? deleteYellowRectsFromStartToCurrent('SHIFT+DEL 키')
                    : deleteYellowRectsFromCurrentToEnd('DEL 키');
                if (deleted) {
                    e.preventDefault();
                }
            }

            if (!isTypingTarget && (e.key === '[' || e.key === '{')) {
                adjustCornerSize(-1);
                e.preventDefault();
            }

            if (!isTypingTarget && (e.key === ']' || e.key === '}')) {
                adjustCornerSize(1);
                e.preventDefault();
            }

            const noModifier = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
            if (!isTypingTarget && noModifier && triggerPathButtonByNumpadKey(e.key)) {
                e.preventDefault();
            }

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
                        const normalizedTarget = normalizeRectToFullOverlapTarget(selectedPixel.x, selectedPixel.y, rectSize);
                        const finalX = normalizedTarget.x;
                        const finalY = normalizedTarget.y;
                        const finalSize = normalizedTarget.size;

                        if (normalizedTarget.snapped) {
                            selectedPixel = { x: finalX, y: finalY };
                            const rectSizeInput = document.getElementById('rectSize');
                            if (rectSizeInput && parseInt(rectSizeInput.value, 10) !== finalSize) {
                                rectSizeInput.value = String(finalSize);
                            }

                            console.log(
                                `   [F8] full-overlap 정규화 적용: 기존 점 #${normalizedTarget.targetIndex + 1} ` +
                                `(${finalX},${finalY}, size=${finalSize})`
                            );
                        }

                        // 새 start를 찍기 전에 기존 마지막 점을 end로 자동 확정
                        autoCloseLatestPointAsEndBeforeStart();

                        // F8으로 찍는 점은 start role로 저장
                        const nextPolylineId = createPolylineId();
                        activePolylineId = nextPolylineId;
                        addYellowRectWithAngleCheck(finalX, finalY, finalSize, {
                            role: 'start',
                            polylineId: nextPolylineId
                        });
                        showMergeStateMessage('F8', yellowRects[yellowRects.length - 1]);
                        if (normalizedTarget.snapped) {
                            showRoleActionInfoMessage(`F8 MERGE start 저장: ${finalSize}x${finalSize}`);
                        }

                        if (showCorners && selectedPixel) {
                            updateCornerAndPathInfo();
                        }

                        scaleCanvas(); // 화면 갱신
                    } else {
                        showRoleActionErrorMessage(`사각형이 모두 흰색이 아닙니다. (${baseWhiteCount}/${baseMaxPixels})`);
                        console.log(`❌ 사각형이 모두 흰색이 아닙니다. (흰색: ${baseWhiteCount}/${baseMaxPixels})`);
                    }
                }
                e.preventDefault();
            }
            if (e.key === 'F9') {
                confirmTempYellowRect('F9');
                e.preventDefault();
            }
            if (e.key === 'F10') {
                runAutoF9Step();
                e.preventDefault();
            }
            if (e.key === 'F11') {
                markLatestMiddleRectAsEnd();
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
                    clearCornerPathPreview();
                }
                scaleCanvas();
                e.preventDefault();
            }
            // IJKL 이동키 (선택 블록 이동)
            if (selectedPixel && ['i','j','k','l','I','J','K','L'].includes(e.key)) {
                let {x, y} = selectedPixel;
                const maxX = currentCanvasWidth - 1;
                const maxY = currentCanvasHeight - 1;
                if (e.key==='i'||e.key==='I') y = Math.max(0, y-1);
                if (e.key==='k'||e.key==='K') y = Math.min(maxY, y+1);
                if (e.key==='j'||e.key==='J') x = Math.max(0, x-1);
                if (e.key==='l'||e.key==='L') x = Math.min(maxX, x+1);
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
                    clearCornerPathPreview();
                }
                scaleCanvas();
                e.preventDefault();
            }
        });
        
        // Canvas1을 Canvas2에 확대하여 복사
        function scaleCanvas() {
            const canvasWidth = currentCanvasWidth;
            const canvasHeight = currentCanvasHeight;
            const index = parseInt(scaleRange.value);
            const scale = scaleValues[index];
            
            // Canvas2 크기 조정
            canvas2.width = canvasWidth * scale;
            canvas2.height = canvasHeight * scale;
            
            // Canvas1의 이미지 데이터 가져오기
            const imageData = ctx1.getImageData(0, 0, canvasWidth, canvasHeight);
            const data = imageData.data;
            
            // Canvas2에 픽셀별로 확대하여 그리기 (Sharp 복사)
            for (let y = 0; y < canvasHeight; y++) {
                for (let x = 0; x < canvasWidth; x++) {
                    // 원본 픽셀의 인덱스
                    const index = (y * canvasWidth + x) * 4;
                    
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

        function centerCanvas2OnPoint(point) {
            if (!point) return;

            const wrapper = document.querySelector('.canvas2-wrapper');
            if (!wrapper) return;

            const index = parseInt(scaleRange.value, 10);
            const scale = scaleValues[index];
            const targetX = (point.x + 0.5) * scale;
            const targetY = (point.y + 0.5) * scale;
            const left = Math.max(0, targetX - wrapper.clientWidth / 2);
            const top = Math.max(0, targetY - wrapper.clientHeight / 2);

            wrapper.scrollTo({ left, top, behavior: 'auto' });
        }

        function zoomCanvas2AroundSelected(step) {
            if (!selectedPixel) {
                showRoleActionErrorMessage('먼저 Canvas2에서 기준 점을 선택하세요.');
                return;
            }

            const currentIndex = parseInt(scaleRange.value, 10);
            const nextIndex = clamp(currentIndex + step, 0, scaleValues.length - 1);

            if (nextIndex === currentIndex) {
                centerCanvas2OnPoint(selectedPixel);
                return;
            }

            scaleRange.value = String(nextIndex);
            scaleDisplay.textContent = `${scaleValues[nextIndex]}x`;
            scaleCanvas();
            centerCanvas2OnPoint(selectedPixel);
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
        let recommendedPathRects = []; // 빨간 테두리(최우선 추천)와 동일한 위치 목록
        let secondaryPathRects = []; // 주황색 테두리와 동일한 위치 목록
        let tertiaryPathRects = []; // 연노랑 테두리와 동일한 위치 목록
        let fallbackPathRects = []; // 분류색이 없는 이동 가능 위치(파란색 표시)
        // 경로 버튼 클릭: 임시 노란색 사각형 (F9로 확정 전)
        let tempYellowRect = null; // {x: number, y: number, size: number} | null
        let tempYellowClickVariant = 0; // 경로 버튼 재클릭 시 임시 사각형 테두리색 교대 표시용
        // F9: 확정된 노란색 사각형들을 저장하는 배열
        let yellowRects = []; // {x: number, y: number, size: number, role?: 'start'|'middle'|'end'}[]
        let polylineIdSeq = 1;
        let activePolylineId = null;
        let currentYellowIndex = -1; // 현재 선택된 노란색 사각형 인덱스 (-1은 선택 안 됨)
        let polylineHighlightRange = null; // 3초 하이라이트용 {startIndex:number, endIndex:number} | null
        let polylineHighlightTimer = null;
        let goStartHighlightIndex = -1; // Go에서 END 선택 시 대응 START 단일 하이라이트 인덱스
        let goStartHighlightTimer = null;

        // 유틸리티: 두 사각형이 겹치는지 확인
        function rectsOverlap(rect1X, rect1Y, rect1Size, rect2) {
            return rect1X < rect2.x + rect2.size &&
                   rect1X + rect1Size > rect2.x &&
                   rect1Y < rect2.y + rect2.size &&
                   rect1Y + rect1Size > rect2.y;
        }

        // 유틸리티: 겹침 상태 분류 (none | full | partial)
        function classifyRectOverlap(rect1X, rect1Y, rect1Size, rect2) {
            if (!rectsOverlap(rect1X, rect1Y, rect1Size, rect2)) {
                return 'none';
            }

            const rect1Right = rect1X + rect1Size;
            const rect1Bottom = rect1Y + rect1Size;
            const rect2Right = rect2.x + rect2.size;
            const rect2Bottom = rect2.y + rect2.size;

            const rect1InsideRect2 =
                rect1X >= rect2.x &&
                rect1Y >= rect2.y &&
                rect1Right <= rect2Right &&
                rect1Bottom <= rect2Bottom;

            const rect2InsideRect1 =
                rect2.x >= rect1X &&
                rect2.y >= rect1Y &&
                rect2Right <= rect1Right &&
                rect2Bottom <= rect1Bottom;

            return (rect1InsideRect2 || rect2InsideRect1) ? 'full' : 'partial';
        }

        // 기존 노란 사각형과 full 겹침이면 가장 큰 기존 사각형으로 좌표/크기를 정규화
        function normalizeRectToFullOverlapTarget(x, y, size) {
            const fullOverlapCandidates = yellowRects
                .map((rect, index) => ({ rect, index }))
                .filter(item => classifyRectOverlap(x, y, size, item.rect) === 'full');

            if (fullOverlapCandidates.length === 0) {
                return { x, y, size, snapped: false, targetIndex: -1 };
            }

            fullOverlapCandidates.sort((a, b) => {
                if (b.rect.size !== a.rect.size) return b.rect.size - a.rect.size;
                return a.index - b.index;
            });

            const target = fullOverlapCandidates[0];
            return {
                x: target.rect.x,
                y: target.rect.y,
                size: target.rect.size,
                snapped: true,
                targetIndex: target.index
            };
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
            if (angleDiff === null) return '';
            const primaryCornerSize = parseInt(document.getElementById('cornerSize').value, 10) || 4;

            if (
                bestMatch !== null &&
                angleDiff <= tolerance &&
                Math.abs(angleDiff - bestMatch.minDiff) < 0.001 &&
                cornerSize === bestMatch.maxSize &&
                cornerSize === primaryCornerSize
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

            // 허용오차 이내의 차선 후보는 오렌지
            if (angleDiff <= tolerance) {
                return '#FF8C00';
            }

            // 더 넓은 범위는 추가 색상으로 구분
            if (angleDiff <= 90) {
                return '#a39908';
            }

            if (angleDiff <= 135) {
                return '#1867dd';
            }

            return '';
        }

        // 계산된 상태를 기반으로 버튼 HTML 생성
        function renderPathButtonHTML(pt, idx, pathName, cornerSize, angle, whiteCount, isAllWhite, overlapState, isPrimaryCornerSize, borderColor, angleDiff, expectedAngle) {
            let buttonStyle;
            let disabled;
            let forcedTooltip = '';

            if (isAllWhite && overlapState === 'partial') {
                buttonStyle = 'background:repeating-linear-gradient(-45deg,#f8d7da,#f8d7da 6px,#f2b7bd 6px,#f2b7bd 12px); color:#8b0000; border:3px solid #cc0000; box-shadow:0 0 0 2px #ffe3e6 inset; cursor:not-allowed; font-weight:bold;';
                disabled = ' disabled';
                forcedTooltip = '부분 겹침은 선택할 수 없습니다.';
            } else if (isAllWhite && overlapState === 'full') {
                const border = borderColor || '#000000';
                const fullOverlapBg = isPrimaryCornerSize
                    ? 'repeating-linear-gradient(90deg, #7e6502 0, #7e6502 6px, #a57e1c 6px, #a57e1c 12px)'
                    : 'repeating-linear-gradient(90deg, #FFD700 0, #FFD700 6px, #FFE680 6px, #FFE680 12px)';
                const textColor = isPrimaryCornerSize ? '#ffffff' : '#000000';
                buttonStyle = `background:${fullOverlapBg}; color:${textColor}; border:3px solid ${border}; cursor:pointer; font-weight:bold;`;
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
            const defaultLabel = `${whiteCount}${angleDiffLabel}`;
            const buttonLabel = (isAllWhite && overlapState === 'partial')
                ? `X ${defaultLabel}`
                : defaultLabel;
            const angleTooltipText = (angleDiff !== null && expectedAngle !== null && expectedAngle !== undefined)
                ? `각도:${angle}°, 기준:${expectedAngle}°, 차이:${angleDiff}°`
                : '';
            const titleText = [forcedTooltip, angleTooltipText].filter(Boolean).join(' | ');
            const titleAttribute = titleText ? ` title="${titleText}"` : '';

            return `<button data-path="${pathName}" data-idx="${idx}" data-x="${pt.x}" data-y="${pt.y}" data-size="${cornerSize}" data-angle="${angle}"
                                style="padding:2px 6px; margin:2px; border-radius:3px; ${buttonStyle}" 
                                ${titleAttribute}${disabled}>${buttonLabel}</button>`;
        }

        // 경로별 흰색점 개수 계산 및 버튼 HTML 생성
        function calculatePathWhiteCounts(rects, pathName, cornerSize, maxPixels, bestMatch = null) {
            // 기대 각도: 항상 마지막으로 확정된 노란색 사각형의 각도
            let expectedAngle = null;
            if (yellowRects.length > 0) {
                expectedAngle = yellowRects[yellowRects.length - 1].angle;
            }

            const tolerance = parseInt(document.getElementById('angleTolerance').value) || 30;
            const primaryCornerSize = parseInt(document.getElementById('cornerSize').value, 10) || 4;
            const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
            const baseX = selectedPixel.x + rectSize / 2;
            const baseY = selectedPixel.y + rectSize / 2;
            
            return rects.map((pt, idx) => {
                const whiteCount = countWhitePixels(ctx1, pt.x, pt.y, cornerSize);
                const isAllWhite = (whiteCount === maxPixels);
                
                // yellowRects와의 겹침 상태 확인 (부분 겹침은 선택 불가)
                let overlapState = 'none';
                yellowRects.forEach(yellowRect => {
                    const overlapType = classifyRectOverlap(pt.x, pt.y, cornerSize, yellowRect);
                    if (overlapType === 'partial') {
                        overlapState = 'partial';
                        return;
                    }
                    if (overlapType === 'full' && overlapState === 'none') {
                        overlapState = 'full';
                    }
                });

                const { angle, angleDiff } = getPathRectAngleInfo(pt, cornerSize, baseX, baseY, expectedAngle);
                const isPrimaryCornerSize = (cornerSize === primaryCornerSize);
                const borderColor = resolvePathButtonBorderColor(pt, cornerSize, angleDiff, tolerance, bestMatch);

                return renderPathButtonHTML(
                    pt,
                    idx,
                    pathName,
                    cornerSize,
                    angle,
                    whiteCount,
                    isAllWhite,
                    overlapState,
                    isPrimaryCornerSize,
                    borderColor,
                    angleDiff,
                    expectedAngle
                );
            });
        }

        function setBorderCountDisplay(elementId, uniqueCount, totalCount) {
            const counter = document.getElementById(elementId);
            if (!counter) return;
            counter.textContent = `${uniqueCount}/${totalCount}개`;
        }

        function resetPriorityBorderCountsDisplay() {
            setBorderCountDisplay('redBorderCount', '-', '-');
            setBorderCountDisplay('orangeBorderCount', '-', '-');
            setBorderCountDisplay('thirdBorderCount', '-', '-');
        }

        function updatePriorityBorderCountsFromDOM() {
            const pathWhiteContent = document.getElementById('pathWhiteContent');
            if (!pathWhiteContent) return;

            const buttons = pathWhiteContent.querySelectorAll('button');
            const colorTargets = [
                { elementId: 'redBorderCount', colorHex: '#FF0000' },
                { elementId: 'orangeBorderCount', colorHex: '#FF8C00' },
                { elementId: 'thirdBorderCount', colorHex: '#a39908' }
            ];

            const bucket = {};
            colorTargets.forEach(target => {
                bucket[target.colorHex.toLowerCase()] = { total: 0, unique: new Set() };
            });

            buttons.forEach(btn => {
                const styleText = btn.getAttribute('style') || '';
                const lowerStyle = styleText.toLowerCase();
                const x = btn.getAttribute('data-x') || '';
                const y = btn.getAttribute('data-y') || '';
                const size = btn.getAttribute('data-size') || '';
                const rectKey = `${x},${y},${size}`;

                colorTargets.forEach(target => {
                    const key = target.colorHex.toLowerCase();
                    if (!lowerStyle.includes(key)) return;
                    bucket[key].total += 1;
                    bucket[key].unique.add(rectKey);
                });
            });

            colorTargets.forEach(target => {
                const key = target.colorHex.toLowerCase();
                setBorderCountDisplay(target.elementId, bucket[key].unique.size, bucket[key].total);
            });
        }

        function syncCanvasPathPointsFromButtons() {
            const pathWhiteContent = document.getElementById('pathWhiteContent');
            if (!pathWhiteContent) {
                recommendedPathRects = [];
                secondaryPathRects = [];
                tertiaryPathRects = [];
                fallbackPathRects = [];
                return;
            }

            const pathMap = {
                path01_n: [],
                path23_n: [],
                path02_n: [],
                path13_n: [],
                path01_n1: [],
                path23_n1: [],
                path02_n1: [],
                path13_n1: []
            };

            const redSet = new Set();
            const redRects = [];
            const orangeSet = new Set();
            const orangeRects = [];
            const yellowSet = new Set();
            const yellowRectsLocal = [];
            const blueSet = new Set();
            const blueRects = [];
            const buttons = Array.from(pathWhiteContent.querySelectorAll('button[data-path]'));

            buttons.forEach(btn => {
                if (btn.disabled) return;

                const pathName = btn.getAttribute('data-path') || '';
                if (!Object.prototype.hasOwnProperty.call(pathMap, pathName)) return;

                const x = parseInt(btn.getAttribute('data-x'), 10);
                const y = parseInt(btn.getAttribute('data-y'), 10);
                const size = parseInt(btn.getAttribute('data-size'), 10);
                if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size)) return;

                const rect = { x, y, size };
                pathMap[pathName].push(rect);

                const styleText = (btn.getAttribute('style') || '').toLowerCase();
                const key = `${x},${y},${size}`;
                if (styleText.includes('#ff0000')) {
                    if (!redSet.has(key)) {
                        redSet.add(key);
                        redRects.push(rect);
                    }
                } else if (styleText.includes('#ff8c00')) {
                    if (!orangeSet.has(key)) {
                        orangeSet.add(key);
                        orangeRects.push(rect);
                    }
                } else if (styleText.includes('#a39908')) {
                    if (!yellowSet.has(key)) {
                        yellowSet.add(key);
                        yellowRectsLocal.push(rect);
                    }
                } else {
                    if (!blueSet.has(key)) {
                        blueSet.add(key);
                        blueRects.push(rect);
                    }
                }
            });

            pathRects01_n = pathMap.path01_n;
            pathRects23_n = pathMap.path23_n;
            pathRects02_n = pathMap.path02_n;
            pathRects13_n = pathMap.path13_n;
            pathRects01_n1 = pathMap.path01_n1;
            pathRects23_n1 = pathMap.path23_n1;
            pathRects02_n1 = pathMap.path02_n1;
            pathRects13_n1 = pathMap.path13_n1;
            recommendedPathRects = redRects;
            secondaryPathRects = orangeRects;
            tertiaryPathRects = yellowRectsLocal;
            fallbackPathRects = blueRects;
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
        function findMinAngleDiffAndMaxSize(allPathRectsWithSize, targetSize = null) {
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
                if (targetSize !== null && size !== targetSize) return;
                
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
                if (targetSize !== null && size !== targetSize) return;
                
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
                        const x = parseInt(btn.getAttribute('data-x'), 10);
                        const y = parseInt(btn.getAttribute('data-y'), 10);
                        const sizeFromButton = parseInt(btn.getAttribute('data-size'), 10);
                        const angle = parseInt(btn.getAttribute('data-angle'), 10); // 미리 계산된 각도
                        const candidateSize = Number.isFinite(sizeFromButton) ? sizeFromButton : cornerSize;
                        const normalizedTarget = normalizeRectToFullOverlapTarget(x, y, candidateSize);
                        const finalRect = {
                            x: normalizedTarget.x,
                            y: normalizedTarget.y,
                            size: normalizedTarget.size
                        };
                        
                        console.log(
                            `✅ 경로 ${pathName} [${idx}] 클릭: (${x}, ${y}), 크기: ${candidateSize}x${candidateSize}, 각도: ${angle}°` +
                            (normalizedTarget.snapped
                                ? ` → full-overlap 정규화: (${finalRect.x}, ${finalRect.y}), 크기: ${finalRect.size}x${finalRect.size}`
                                : '')
                        );
                        
                        // 임시 노란색 사각형만 설정 (F9로 확정 전까지는 이동 안 함)
                        tempYellowClickVariant = (tempYellowClickVariant + 1) % 2;
                        tempYellowRect = {
                            ...finalRect,
                            clickVariant: tempYellowClickVariant
                        };
                        
                        if (normalizedTarget.snapped) {
                            updateTempYellowAngle();
                        } else {
                            updateTempYellowAngle(angle); // 미리 계산된 각도 전달
                        }
                        
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
            
            // 빨강 기준용 best는 n 크기 후보에서만 계산
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
            
            const bestMatch = findMinAngleDiffAndMaxSize(allPathsWithSize, cornerSize);
            
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

            updatePriorityBorderCountsFromDOM();
            
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

            // 캔버스 점은 버튼 기준으로 동기화: 활성 버튼만 표시 + 빨간 추천점 수집
            syncCanvasPathPointsFromButtons();

            if(document.getElementById('pathCount01')) document.getElementById('pathCount01').textContent = pathRects01_n.length;
            if(document.getElementById('pathCount23')) document.getElementById('pathCount23').textContent = pathRects23_n.length;
            if(document.getElementById('pathCount02')) document.getElementById('pathCount02').textContent = pathRects02_n.length;
            if(document.getElementById('pathCount13')) document.getElementById('pathCount13').textContent = pathRects13_n.length;
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
                const terminal = getPolylineTerminalInfo(currentYellowIndex);
                display.value = `${currentYellowIndex + 1}/${yellowRects.length} (${terminal.label})`;
            }

            refreshPolylineRangeControl();
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
        
        document.getElementById('btnPrevYellow').addEventListener('click', (e) => {
            if (yellowRects.length === 0) return;

            const step = e.shiftKey ? 5 : 1;
            if (currentYellowIndex === -1) {
                currentYellowIndex = yellowRects.length - 1;
            } else {
                currentYellowIndex = (currentYellowIndex - step + yellowRects.length) % yellowRects.length;
            }

            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            scaleCanvas();
        });
        
        document.getElementById('btnNextYellow').addEventListener('click', (e) => {
            if (yellowRects.length === 0) return;

            const step = e.shiftKey ? 5 : 1;
            if (currentYellowIndex === -1) {
                currentYellowIndex = 0;
            } else {
                currentYellowIndex = (currentYellowIndex + step) % yellowRects.length;
            }

            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            scaleCanvas();
        });

        document.getElementById('btnHighlightToStart').addEventListener('click', () => {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                console.log('❌ 하이라이트할 현재 노란색 사각형이 선택되지 않았습니다.');
                return;
            }

            const range = resolveStartToCurrentRange(currentYellowIndex);
            if (!range) {
                console.log('❌ 현재 점 이전에 연결 가능한 start가 없습니다.');
                return;
            }

            highlightPolylineRange(range.startIndex, range.endIndex, 4000);
            console.log(`🔦 현재 [${currentYellowIndex + 1}]에서 시작점 [${range.startIndex + 1}]까지 4초 하이라이트.`);
        });

        document.getElementById('btnHighlightToEnd').addEventListener('click', () => {
            if (currentYellowIndex === -1 || yellowRects.length === 0) {
                console.log('❌ 하이라이트할 현재 노란색 사각형이 선택되지 않았습니다.');
                return;
            }

            const range = resolveCurrentToEndRange(currentYellowIndex);
            if (!range) {
                console.log('❌ 현재 점 이후에 연결 가능한 end가 없습니다.');
                return;
            }

            highlightPolylineRange(range.startIndex, range.endIndex, 4000);
            console.log(`🔦 현재 [${currentYellowIndex + 1}]에서 끝점 [${range.endIndex + 1}]까지 4초 하이라이트.`);
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
            
            // Go 버튼을 눌러 이동하는 경우 해당 yellowRect의 크기로 rectSize를 동기화
            const rectSizeInput = document.getElementById('rectSize');
            if (rectSizeInput) {
                rectSizeInput.value = String(yellowRect.size);
            }

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

            const containing = findPolylineRangeContainingIndex(currentYellowIndex);
            const isPolylineEnd = !!(containing && containing.endIndex === currentYellowIndex);
            const shouldHighlightStart = isPolylineEnd || normalizeRole(yellowRect.role) === 'end';

            if (shouldHighlightStart) {
                const highlighted = highlightStartPointForGo(currentYellowIndex, 2000);
                if (highlighted) {
                    console.log(`🔦 END에 대응하는 START [${goStartHighlightIndex + 1}]를 2초간 강조합니다.`);
                } else {
                    showRoleActionErrorMessage('이 END 이전에 대응 START가 없습니다.');
                    console.log('ℹ️ END 이전에 대응 START가 없어 START 하이라이트를 생략합니다.');
                }
            }

            const matchedIndices = findYellowRectIndicesByPoint(ox, oy);
            if (matchedIndices.length > 1) {
                showGoMetaForMatchedIndices(matchedIndices);
            } else {
                showGoMetaMessage(yellowRect, currentYellowIndex);
            }
            
            console.log(`✅ 노란색 사각형 [${currentYellowIndex + 1}]번 위치로 이동: (${ox}, ${oy})`);
            scaleCanvas();
        });

        document.getElementById('btnSetStartByIndex').addEventListener('click', () => {
            setCurrentYellowAsStart();
        });

        document.getElementById('btnSetEndByIndex').addEventListener('click', () => {
            setCurrentYellowAsEnd();
        });

        // Del 버튼: 현재 선택된 인덱스 이하 사각형들을 모두 삭제
        document.getElementById('btnDelAfterYellow').addEventListener('click', () => {
            deleteYellowRectsFromCurrentToEnd('Del 버튼');
        });

        // Jmp 버튼: 현재 인덱스 이후에서 첫 급격 꺾임 지점으로 이동
        document.getElementById('btnJumpSharpTurn').addEventListener('click', () => {
            const jumpStatusDisplay = document.getElementById('jumpStatusDisplay');

            if (currentYellowIndex === -1 || yellowRects.length < 3) {
                console.log('❌ 점프할 노란색 사각형이 충분하지 않습니다.');
                if (jumpStatusDisplay) {
                    jumpStatusDisplay.textContent = '🟠';
                    jumpStatusDisplay.title = '점프할 노란색 사각형이 충분하지 않습니다.';
                }
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
                if (jumpStatusDisplay) {
                    jumpStatusDisplay.textContent = '🟠';
                    jumpStatusDisplay.title = '현재 인덱스 이후에 급격한 꺾임이 없습니다.';
                }
                return;
            }

            currentYellowIndex = foundIndex;
            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            scaleCanvas();
            if (jumpStatusDisplay) {
                jumpStatusDisplay.textContent = '🟢';
                jumpStatusDisplay.title = `급격 꺾임 인덱스로 이동: ${foundIndex + 1}/${yellowRects.length}`;
            }
            console.log(`✅ 급격 꺾임 지점으로 점프: [${foundIndex + 1}] / ${yellowRects.length}`);
        });
        
        // Angle 그룹 계산
        function buildAngleGroups(rects, tolerance) {
            const groups = [];
            let currentGroup = [];
            let currentGroupAngle = null;

            for (let i = 0; i < rects.length; i++) {
                const angle = rects[i].angle;

                if (angle === null || angle === undefined) {
                    if (currentGroup.length > 0) {
                        groups.push([...currentGroup]);
                        currentGroup = [];
                        currentGroupAngle = null;
                    }
                    currentGroup.push(i);
                    continue;
                }

                if (currentGroupAngle === null) {
                    currentGroup.push(i);
                    currentGroupAngle = angle;
                } else {
                    const diff = Math.abs(getCircularAngleDiff(angle, currentGroupAngle, false));
                    if (diff <= tolerance) {
                        currentGroup.push(i);
                    } else {
                        groups.push([...currentGroup]);
                        currentGroup = [i];
                        currentGroupAngle = angle;
                    }
                }
            }

            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }

            return groups;
        }

        // 그룹 평균 각도 계산
        function getGroupAverageAngle(group, rects) {
            const angles = group.map(i => rects[i].angle).filter(a => a !== null && a !== undefined);
            if (angles.length === 0) return '-';

            const sum = angles.reduce((a, b) => a + b, 0);
            return Math.round(sum / angles.length) + '°';
        }

        // Angle 그룹 HTML 생성
        function buildAngleGroupsHTML(groups, rects, tolerance) {
            let html = `<div style="margin-top:8px;"><strong>📊 Angle 그룹 분석 결과 (허용오차: ±${tolerance}°):</strong></div>`;

            groups.forEach((group, groupIndex) => {
                const groupNumber = groupIndex + 1;
                const indices = group.map(i => i).join(', ');
                const avgAngle = getGroupAverageAngle(group, rects);

                html += `<div style="margin:5px 0 5px 20px;">`;
                html += `<strong style="color:#0066cc;">그룹 ${groupNumber}:</strong> `;
                html += `<input type="text" value="인덱스 [${indices}] - 평균각도: ${avgAngle}" readonly `;
                html += `style="width:400px; padding:3px 6px; border:1px solid #ccc; background:#f9f9f9; font-size:0.9em;">`;
                html += `</div>`;
            });

            return html;
        }

        // Angle 그룹 결과 표시
        function renderAngleGroups(html) {
            const container = document.getElementById('angleGroupsContainer');
            if (container) {
                container.innerHTML = html;
            }
        }

        // role(start~end) 기준으로 폴리라인 메타데이터 생성
        function buildPolylineMetadataByRole(rects) {
            const polylines = [];
            let startIndex = null;
            let polylineCounter = 1;

            for (let i = 0; i < rects.length; i++) {
                const role = normalizeRole(rects[i].role);

                if (role === 'start') {
                    // 새 start가 나오면 이전 열린 구간은 폐기하고 최신 start를 기준으로 함
                    startIndex = i;
                    continue;
                }

                if (role === 'end' && startIndex !== null && i >= startIndex) {
                    const pointIndices = [];
                    for (let idx = startIndex; idx <= i; idx++) {
                        pointIndices.push(idx);
                    }

                    polylines.push({
                        polylineId: `PL${polylineCounter}`,
                        startIndex: startIndex,
                        endIndex: i,
                        pointCount: pointIndices.length,
                        pointIndices: pointIndices
                    });

                    polylineCounter += 1;
                    startIndex = null;
                }
            }

            return polylines;
        }

        function buildPolylineMetadata(rects) {
            if (!Array.isArray(rects) || rects.length === 0) return [];

            const hasPolylineId = rects.some(rect => isValidPolylineId(rect.polylineId));
            if (!hasPolylineId) {
                return buildPolylineMetadataByRole(rects);
            }

            const byId = new Map();
            for (let i = 0; i < rects.length; i++) {
                const rect = rects[i] || {};
                if (!isValidPolylineId(rect.polylineId)) continue;

                const id = rect.polylineId;
                if (!byId.has(id)) {
                    byId.set(id, {
                        polylineId: id,
                        startIndex: i,
                        endIndex: i,
                        pointIndices: [i]
                    });
                    continue;
                }

                const item = byId.get(id);
                item.pointIndices.push(i);
                if (i < item.startIndex) item.startIndex = i;
                if (i > item.endIndex) item.endIndex = i;
            }

            return Array.from(byId.values())
                .sort((a, b) => a.startIndex - b.startIndex)
                .map(item => ({
                    polylineId: item.polylineId,
                    startIndex: item.startIndex,
                    endIndex: item.endIndex,
                    pointCount: item.pointIndices.length,
                    pointIndices: item.pointIndices.slice()
                }));
        }

        function getCurrentPolylinesFromYellowRects() {
            const polylineAwareRects = yellowRects.map(rect => ({
                role: normalizeRole(rect.role),
                polylineId: rect.polylineId
            }));
            return buildPolylineMetadata(polylineAwareRects);
        }

        function updatePolylineRangeDisplay(polylines) {
            if (!polylineRangeDisplay) return;

            if (!polylines || polylines.length === 0 || !polylineSelect) {
                polylineRangeDisplay.textContent = '-';
                return;
            }

            const selectedValue = parseInt(polylineSelect.value, 10);
            const selectedIndex = Number.isNaN(selectedValue) ? 0 : selectedValue;
            if (selectedIndex < 1 || selectedIndex > polylines.length) {
                polylineRangeDisplay.textContent = '-';
                return;
            }

            const selected = polylines[selectedIndex - 1];
            polylineRangeDisplay.textContent = `${selected.polylineId} (${selected.startIndex}~${selected.endIndex})`;
        }

        function updatePolylineCountDisplay(polylines) {
            if (!polylineCountDisplay) return;

            if (!polylines || polylines.length === 0) {
                polylineCountDisplay.textContent = '-';
                return;
            }

            polylineCountDisplay.textContent = `(${polylines.length})`;
        }

        function refreshPolylineRangeControl() {
            if (!polylineSelect) return;

            const polylines = getCurrentPolylinesFromYellowRects();
            const previousValue = parseInt(polylineSelect.value, 10);

            polylineSelect.innerHTML = '';

            const emptyOption = document.createElement('option');
            emptyOption.value = '0';
            emptyOption.textContent = '-';
            polylineSelect.appendChild(emptyOption);

            polylines.forEach((polyline, idx) => {
                const option = document.createElement('option');
                option.value = String(idx + 1);
                option.textContent = `${polyline.polylineId} (${polyline.startIndex}~${polyline.endIndex})`;
                polylineSelect.appendChild(option);
            });

            if (polylines.length === 0) {
                polylineSelect.value = '0';
                polylineSelect.disabled = true;
                updatePolylineCountDisplay(polylines);
                updatePolylineRangeDisplay(polylines);
                return;
            }

            polylineSelect.disabled = false;

            let nextValue = Number.isNaN(previousValue) ? 0 : previousValue;
            if (nextValue < 0) nextValue = 0;
            if (nextValue > polylines.length) nextValue = polylines.length;
            polylineSelect.value = String(nextValue);

            updatePolylineCountDisplay(polylines);
            updatePolylineRangeDisplay(polylines);
        }

        function getSelectedPolylineRangeFromControl() {
            if (!polylineSelect) return null;

            const polylines = getCurrentPolylinesFromYellowRects();
            if (polylines.length === 0) return null;

            const selectedValue = parseInt(polylineSelect.value, 10);
            const selectedIndex = Number.isNaN(selectedValue) ? 0 : selectedValue;
            if (selectedIndex < 1 || selectedIndex > polylines.length) return null;

            return polylines[selectedIndex - 1];
        }

        function recomputePointOrderForPolyline(polylineId) {
            if (!isValidPolylineId(polylineId)) return;

            let order = 1;
            for (let i = 0; i < yellowRects.length; i++) {
                const rect = yellowRects[i];
                if (rect.polylineId === polylineId) {
                    rect.pointOrder = order;
                    order += 1;
                }
            }
        }

        function recomputeMergeStateForAllYellowRects() {
            for (let i = 0; i < yellowRects.length; i++) {
                const base = yellowRects[i];
                const merged = yellowRects.some((other, j) => {
                    if (i === j) return false;
                    return classifyRectOverlap(base.x, base.y, base.size, other) === 'full';
                });
                base.mergeState = merged;
            }
        }

        function findSourcePolylineIdAtSelectedPoint(targetPolylineId) {
            if (!selectedPixel) return null;

            // 현재 선택 인덱스가 유효하면 우선 사용
            if (currentYellowIndex >= 0 && currentYellowIndex < yellowRects.length) {
                const currentRect = yellowRects[currentYellowIndex];
                const containsSelectedPoint =
                    selectedPixel.x >= currentRect.x &&
                    selectedPixel.x < currentRect.x + currentRect.size &&
                    selectedPixel.y >= currentRect.y &&
                    selectedPixel.y < currentRect.y + currentRect.size;

                if (containsSelectedPoint && isValidPolylineId(currentRect.polylineId) && currentRect.polylineId !== targetPolylineId) {
                    return currentRect.polylineId;
                }
            }

            const matchedIndices = findYellowRectIndicesByPoint(selectedPixel.x, selectedPixel.y);
            for (let i = 0; i < matchedIndices.length; i++) {
                const idx = matchedIndices[i];
                const rect = yellowRects[idx];
                if (rect && isValidPolylineId(rect.polylineId) && rect.polylineId !== targetPolylineId) {
                    return rect.polylineId;
                }
            }

            return null;
        }

        function deletePolylineById(polylineId) {
            if (!isValidPolylineId(polylineId)) return false;

            const beforeCount = yellowRects.length;
            yellowRects = yellowRects.filter(rect => rect.polylineId !== polylineId);
            const removedCount = beforeCount - yellowRects.length;
            if (removedCount <= 0) return false;

            if (yellowRects.length === 0) {
                currentYellowIndex = -1;
                activePolylineId = null;
            } else {
                currentYellowIndex = clamp(currentYellowIndex, 0, yellowRects.length - 1);
                const lastRect = yellowRects[yellowRects.length - 1];
                activePolylineId = normalizeRole(lastRect.role) === 'end' ? null : (lastRect.polylineId || null);
            }

            recomputeMergeStateForAllYellowRects();
            refreshPolylineRangeControl();
            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }
            scaleCanvas();

            return true;
        }

        function countPointsByPolylineId(polylineId) {
            if (!isValidPolylineId(polylineId)) return 0;

            let count = 0;
            for (let i = 0; i < yellowRects.length; i++) {
                if (yellowRects[i].polylineId === polylineId) {
                    count += 1;
                }
            }
            return count;
        }

        function insertPointBeforeSelectedPolylineStart() {
            if (!selectedPixel) {
                showRoleActionErrorMessage('먼저 Canvas2에서 추가할 점을 선택하세요.');
                return false;
            }

            const selectedPolyline = getSelectedPolylineRangeFromControl();
            if (!selectedPolyline) {
                showRoleActionErrorMessage('먼저 Poly Line을 선택하세요.');
                return false;
            }

            const targetPolylineId = selectedPolyline.polylineId;
            const startIndex = selectedPolyline.startIndex;
            if (!Number.isFinite(startIndex) || startIndex < 0 || startIndex >= yellowRects.length) {
                showRoleActionErrorMessage('선택한 Poly Line의 시작점을 찾을 수 없습니다.');
                return false;
            }

            const sourcePolylineId = findSourcePolylineIdAtSelectedPoint(targetPolylineId);
            if (sourcePolylineId) {
                const sourcePointCount = countPointsByPolylineId(sourcePolylineId);
                const shouldDeleteSource = window.confirm(
                    `선택한 점은 기존 폴리라인 ${sourcePolylineId}에 속해 있습니다.\n` +
                    `삭제 시 ${sourcePointCount}개의 점이 함께 삭제됩니다.\n` +
                    `이 폴리라인을 삭제할까요?`
                );

                // 삭제를 거부하면 추가 동작을 취소하여 점이 원래 폴리라인(A)에 남도록 한다.
                if (!shouldDeleteSource) {
                    showRoleActionInfoMessage(`${sourcePolylineId} 유지: 점 추가를 취소했습니다.`);
                    return false;
                }
            }

            pushDeleteUndoState('Start앞+1');

            const sizeInput = document.getElementById('rectSize');
            const rectSize = sizeInput ? (parseInt(sizeInput.value, 10) || 4) : 4;
            const insertX = clamp(selectedPixel.x, 0, currentCanvasWidth - 1);
            const insertY = clamp(selectedPixel.y, 0, currentCanvasHeight - 1);

            const prevStartRect = yellowRects[startIndex];
            if (prevStartRect && prevStartRect.polylineId === targetPolylineId) {
                prevStartRect.role = 'middle';
            }

            yellowRects.splice(startIndex, 0, {
                x: insertX,
                y: insertY,
                size: Math.max(1, rectSize),
                angle: null,
                angleExceeded: false,
                angleDiff: null,
                expectedAngle: null,
                mergeState: false,
                role: 'start',
                polylineId: targetPolylineId,
                pointOrder: 1
            });

            recomputePointOrderForPolyline(targetPolylineId);
            recomputeMergeStateForAllYellowRects();

            activePolylineId = targetPolylineId;
            currentYellowIndex = startIndex;

            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }
            refreshPolylineRangeControl();
            scaleCanvas();

            let removedSource = false;
            if (sourcePolylineId) {
                removedSource = deletePolylineById(sourcePolylineId);
            }

            if (removedSource) {
                showRoleActionInfoMessage(`${targetPolylineId} start 앞 점 추가 + ${sourcePolylineId} 삭제 완료`);
            } else {
                showRoleActionInfoMessage(`${targetPolylineId} start 앞에 점 1개를 추가했습니다.`);
            }
            return true;
        }

        function findPolylineRangeContainingIndex(index) {
            const polylines = getCurrentPolylinesFromYellowRects();
            for (let i = 0; i < polylines.length; i++) {
                const range = polylines[i];
                if (Array.isArray(range.pointIndices) && range.pointIndices.includes(index)) {
                    return range;
                }
            }
            return null;
        }

        function resolveStartToCurrentRange(currentIndex) {
            const containing = findPolylineRangeContainingIndex(currentIndex);
            if (containing) {
                return {
                    startIndex: containing.startIndex,
                    endIndex: currentIndex
                };
            }

            const startIndex = findLatestStartIndexForEnd(currentIndex);
            if (startIndex === -1) return null;
            return { startIndex, endIndex: currentIndex };
        }

        function resolveCurrentToEndRange(currentIndex) {
            const containing = findPolylineRangeContainingIndex(currentIndex);
            if (containing) {
                return {
                    startIndex: currentIndex,
                    endIndex: containing.endIndex
                };
            }

            for (let i = currentIndex; i < yellowRects.length; i++) {
                if (normalizeRole(yellowRects[i].role) === 'end') {
                    return { startIndex: currentIndex, endIndex: i };
                }
            }

            return null;
        }

        if (polylineSelect) {
            const handlePolylineRangeSelection = () => {
                const polylines = getCurrentPolylinesFromYellowRects();
                const selected = getSelectedPolylineRangeFromControl();
                if (selected) {
                    highlightPolylineRange(selected.startIndex, selected.endIndex, 3000);
                }
                updatePolylineRangeDisplay(polylines);
                scaleCanvas();
            };

            polylineSelect.addEventListener('change', handlePolylineRangeSelection);
        }

        if (btnInsertBeforePolylineStart) {
            btnInsertBeforePolylineStart.addEventListener('click', () => {
                insertPointBeforeSelectedPolylineStart();
            });
        }

        // Angle 검사 버튼: 각도별 그룹화
        document.getElementById('btnAngleCheck').addEventListener('click', () => {
            if (yellowRects.length === 0) {
                console.log('❌ 노란색 사각형이 없습니다.');
                return;
            }

            const tolerance = parseInt(document.getElementById('angleTolerance').value) || 30;
            console.log(`🔍 Angle 검사 시작... (허용 오차: ±${tolerance}°)`);

            const groups = buildAngleGroups(yellowRects, tolerance);
            console.log(`✅ ${groups.length}개 그룹 발견:`, groups);

            const html = buildAngleGroupsHTML(groups, yellowRects, tolerance);
            renderAngleGroups(html);
        });

        // Copy Rects 버튼: 노란색 사각형 정보를 JSON으로 클립보드에 복사
        document.getElementById('btnCopyRects').addEventListener('click', async () => {
            if (yellowRects.length === 0) {
                console.log('❌ 복사할 노란색 사각형이 없습니다.');
                return;
            }

            const mergeStates = yellowRects.map((rect, rectIndex) =>
                yellowRects.some((otherRect, otherIndex) => {
                    if (rectIndex === otherIndex) return false;
                    return classifyRectOverlap(rect.x, rect.y, rect.size, otherRect) === 'full';
                })
            );

            const exportPointOrderMap = new Map();
            const rectsForCopy = yellowRects.map((rect, idx) => {
                const polylineId = isValidPolylineId(rect.polylineId) ? rect.polylineId : null;
                let pointOrder = null;

                if (polylineId) {
                    const nextOrder = (exportPointOrderMap.get(polylineId) || 0) + 1;
                    exportPointOrderMap.set(polylineId, nextOrder);
                    pointOrder = nextOrder;
                }

                return {
                    x: rect.x,
                    y: rect.y,
                    size: rect.size,
                    angle: rect.angle,
                    sharpTurn: !!rect.angleExceeded,
                    mergeState: !!mergeStates[idx],
                    role: normalizeRole(rect.role),
                    polylineId,
                    pointOrder
                };
            });

            const polylinesForCopy = buildPolylineMetadata(rectsForCopy);

            const exportPayload = {
                rects: rectsForCopy,
                polylines: polylinesForCopy
            };

            const jsonText = JSON.stringify(exportPayload, null, 2);

            try {
                await navigator.clipboard.writeText(jsonText);
                console.log(`✅ Copy Rects 완료: 사각형 ${rectsForCopy.length}개, 폴리라인 ${polylinesForCopy.length}개가 클립보드에 복사되었습니다.`);
            } catch (err) {
                console.error('❌ 클립보드 복사 실패:', err);
            }
        });

        // Paste Rects 버튼: 클립보드 JSON을 읽어 노란색 사각형 목록을 복원
        document.getElementById('btnPasteRects').addEventListener('click', async () => {
            let jsonText = '';

            try {
                jsonText = await navigator.clipboard.readText();
            } catch (err) {
                console.error('❌ 클립보드 텍스트 읽기 실패:', err);
                return;
            }

            if (!jsonText || jsonText.trim().length === 0) {
                console.log('❌ 클립보드가 비어 있습니다.');
                return;
            }

            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (err) {
                console.error('❌ JSON 파싱 실패: 올바른 JSON 텍스트가 아닙니다.', err);
                return;
            }

            const sourceRects = Array.isArray(parsed)
                ? parsed
                : (parsed && Array.isArray(parsed.rects) ? parsed.rects : null);

            if (!Array.isArray(sourceRects)) {
                console.log('❌ JSON 형식이 올바르지 않습니다. 배열 또는 { rects: [...] } 형식이 필요합니다.');
                return;
            }

            const normalizedRects = [];
            const pointOrderByPolyline = new Map();

            for (let i = 0; i < sourceRects.length; i++) {
                const raw = sourceRects[i] || {};
                const x = Number(raw.x);
                const y = Number(raw.y);
                const size = Number(raw.size);

                if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(size) || size <= 0) {
                    console.log(`❌ ${i + 1}번째 rect 형식 오류: x/y/size는 유효한 숫자이고 size는 1 이상이어야 합니다.`);
                    return;
                }

                const polylineId = isValidPolylineId(raw.polylineId) ? raw.polylineId : null;
                let pointOrder = null;
                if (polylineId) {
                    const nextOrder = (pointOrderByPolyline.get(polylineId) || 0) + 1;
                    pointOrderByPolyline.set(polylineId, nextOrder);
                    pointOrder = nextOrder;
                }

                const angle = Number(raw.angle);
                const expectedAngle = Number(raw.expectedAngle);
                const angleDiff = Number(raw.angleDiff);

                normalizedRects.push({
                    x: Math.trunc(x),
                    y: Math.trunc(y),
                    size: Math.max(1, Math.trunc(size)),
                    angle: Number.isFinite(angle) ? angle : null,
                    angleExceeded: !!(raw.angleExceeded || raw.sharpTurn),
                    angleDiff: Number.isFinite(angleDiff) ? angleDiff : null,
                    expectedAngle: Number.isFinite(expectedAngle) ? expectedAngle : null,
                    mergeState: !!raw.mergeState,
                    role: normalizeRole(raw.role),
                    polylineId,
                    pointOrder
                });
            }

            const recalculatedMergeStates = normalizedRects.map((rect, rectIndex) =>
                normalizedRects.some((otherRect, otherIndex) => {
                    if (rectIndex === otherIndex) return false;
                    return classifyRectOverlap(rect.x, rect.y, rect.size, otherRect) === 'full';
                })
            );

            for (let i = 0; i < normalizedRects.length; i++) {
                normalizedRects[i].mergeState = normalizedRects[i].mergeState || recalculatedMergeStates[i];
            }

            yellowRects = normalizedRects;
            currentYellowIndex = yellowRects.length > 0 ? (yellowRects.length - 1) : -1;
            polylineHighlightRange = null;
            goStartHighlightIndex = -1;

            if (yellowRects.length === 0) {
                selectedPixel = null;
                activePolylineId = null;
            } else {
                const lastRect = yellowRects[yellowRects.length - 1];
                selectedPixel = { x: lastRect.x, y: lastRect.y };
                const rectSizeInput = document.getElementById('rectSize');
                if (rectSizeInput) {
                    rectSizeInput.value = String(lastRect.size);
                }
                activePolylineId = normalizeRole(lastRect.role) === 'end' ? null : (lastRect.polylineId || null);
            }

            syncPolylineIdSeqFromRects(yellowRects);
            updateYellowIndexDisplay();
            updateYellowAngleDisplay();
            refreshPolylineRangeControl();

            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }

            scaleCanvas();
            console.log(`✅ Paste Rects 완료: 사각형 ${yellowRects.length}개를 클립보드 JSON에서 불러왔습니다.`);
        });

        // 자동 F9 버튼: 빨간 후보 1개일 때 선택+확정을 한 번에 수행
        document.getElementById('btnAutoF9').addEventListener('click', () => {
            runAutoF9Step();
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

            // 클릭된 위치에 해당하는 yellowRect 찾기 및 Go 동작
            const matchedIndices = findYellowRectIndicesByPoint(ox, oy);
            const clickMode = document.getElementById('yellowClickMode')?.value || 'closest';

            if (matchedIndices.length > 0) {
                showGoMetaForMatchedIndices(matchedIndices);

                let targetIndex = matchedIndices[0];
                if (
                    areSamePoint(lastClickedYellowPoint, { x: ox, y: oy }) &&
                    arraysAreEqual(lastClickedMatchedIndices, matchedIndices) &&
                    matchedIndices.length > 1
                ) {
                    const currentPos = matchedIndices.indexOf(currentYellowIndex);
                    if (currentPos !== -1) {
                        targetIndex = matchedIndices[(currentPos + 1) % matchedIndices.length];
                    }
                }

                lastClickedYellowPoint = { x: ox, y: oy };
                lastClickedMatchedIndices = matchedIndices.slice();
                goToYellowRect(targetIndex, { preserveGoMeta: true });
            } else {
                lastClickedYellowPoint = null;
                lastClickedMatchedIndices = [];

                const targetYellowIndex = findYellowRectIndexByPoint(ox, oy);
                if (targetYellowIndex !== -1) {
                    goToYellowRect(targetYellowIndex);
                } else if (clickMode === 'inside') {
                    goMetaDisplayTimer = showTempMessage({
                        elementId: 'goMetaDisplay',
                        text: '[Go] 포함된 노란 점이 없습니다.',
                        className: 'status-go',
                        previousTimerId: goMetaDisplayTimer
                    });
                }
            }

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
                clearCornerPathPreview();
            }
            // 캔버스2 다시 그림 (사각형 오버레이 위해)
            scaleCanvas();
        });

        function findClosestYellowRectIndex(x, y) {
            if (yellowRects.length === 0) return -1;
            let closestIndex = -1;
            let bestDistSq = Number.POSITIVE_INFINITY;
            for (let i = 0; i < yellowRects.length; i++) {
                const rect = yellowRects[i];
                const cx = rect.x + rect.size / 2;
                const cy = rect.y + rect.size / 2;
                const dx = x - cx;
                const dy = y - cy;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestDistSq) {
                    bestDistSq = d2;
                    closestIndex = i;
                }
            }
            return closestIndex;
        }

        function findYellowRectIndicesByPoint(x, y) {
            return yellowRects
                .map((rect, i) => ({ rect, i }))
                .filter(({ rect }) =>
                    x >= rect.x && x < rect.x + rect.size && y >= rect.y && y < rect.y + rect.size
                )
                .map(({ i }) => i);
        }

        function showGoMetaForMatchedIndices(matchedIndices) {
            if (!matchedIndices || matchedIndices.length === 0) return false;

            const matchedRects = matchedIndices.map(i => yellowRects[i]);
            const summary = matchedRects.map((rect, idx) => {
                const mergeLabel = rect.mergeState ? '✙MERGED' : 'NOT MERGED';
                const terminal = getPolylineTerminalInfo(matchedIndices[idx]);
                const polylineLabel = isValidPolylineId(rect.polylineId)
                    ? `${rect.polylineId}:${Number.isFinite(rect.pointOrder) ? rect.pointOrder : '-'}`
                    : 'NONE';
                return `[${matchedIndices[idx] + 1}/${yellowRects.length}] ${mergeLabel} | ${terminal.label} | ${rect.size}x${rect.size} | P:${polylineLabel}`;
            }).join('  ┋  ');

            canvas1StatusMessageTimer = showTempMessage({
                elementId: 'canvas1StatusMessage',
                text: `점 ${matchedIndices.length}개: ${summary}`,
                className: 'status-go',
                previousTimerId: canvas1StatusMessageTimer,
                onClear: (display) => {
                    display.textContent = '';
                    display.className = '';
                    canvas1StatusMessageTimer = null;
                }
            });

            return true;
        }

        function findYellowRectIndexByPoint(x, y) {
            const insideIndices = findYellowRectIndicesByPoint(x, y);
            const insideIndex = insideIndices.length > 0 ? insideIndices[0] : -1;
            const modeInput = document.getElementById('yellowClickMode');
            const mode = modeInput ? modeInput.value : 'closest';

            if (mode === 'inside') {
                return insideIndex;
            }

            if (mode === 'preferInside') {
                return insideIndex !== -1 ? insideIndex : findClosestYellowRectIndex(x, y);
            }

            // 기본은 가장 가까운 점
            return findClosestYellowRectIndex(x, y);
        }

        function goToYellowRect(index, options = {}) {
            if (index < 0 || index >= yellowRects.length) {
                console.log('ℹ️ 클릭 위치에 해당하는 노란 점이 없습니다.');
                return;
            }
            const preserveGoMeta = !!options.preserveGoMeta;
            currentYellowIndex = index;
            updateYellowIndexDisplay();
            updateYellowAngleDisplay();

            const yellowRect = yellowRects[index];
            selectedPixel = { x: yellowRect.x, y: yellowRect.y };

            // rectSize 동기화
            const rectSizeInput = document.getElementById('rectSize');
            if (rectSizeInput) rectSizeInput.value = String(yellowRect.size);

            // info 표시
            const coordDisp = document.getElementById('coordDisplay');
            if (coordDisp) coordDisp.textContent = `${yellowRect.x}, ${yellowRect.y}`;
            if (!preserveGoMeta) {
                showGoMetaMessage(yellowRect, index);
            }

            if (showCorners && selectedPixel) {
                updateCornerAndPathInfo();
            }

            // END면 시작점 강조
            const containing = findPolylineRangeContainingIndex(index);
            const isPolylineEnd = !!(containing && containing.endIndex === index);
            const shouldHighlightStart = isPolylineEnd || normalizeRole(yellowRect.role) === 'end';

            if (shouldHighlightStart) {
                const highlighted = highlightStartPointForGo(index, 2000);
                if (!highlighted) {
                    showRoleActionErrorMessage('이 END 이전에 대응 START가 없습니다.');
                }
            }

            scaleCanvas();
        }

        // scaleCanvas에 사각형 그리기 보강
        const origScaleCanvas = scaleCanvas;
        scaleCanvas = function() {
            origScaleCanvas(); // 원래 내용 실행
            const index = parseInt(scaleRange.value);
            const scale = scaleValues[index];
            ctx2.save();
            if (selectedPixel) {
                const rectSize = parseInt(document.getElementById('rectSize').value) || 4;
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
                    const drawCategoryDots = (rects, fillStyle, strokeStyle, radiusFactor = 3.6) => {
                        if (!rects || rects.length === 0) return;

                        ctx2.fillStyle = fillStyle;
                        ctx2.strokeStyle = strokeStyle;
                        ctx2.lineWidth = Math.max(1, scale / 9);

                        for (const pt of rects) {
                            const cx = pt.x * scale + (pt.size * scale) / 2;
                            const cy = pt.y * scale + (pt.size * scale) / 2;
                            const radius = Math.max(1.8, scale / radiusFactor);

                            ctx2.beginPath();
                            ctx2.arc(cx, cy, radius, 0, Math.PI * 2);
                            ctx2.fill();
                            ctx2.stroke();
                        }
                    };

                    // 우선순위 낮은 색부터 그리고, 높은 우선순위를 마지막에 그려 겹침 시 강조
                    drawCategoryDots(fallbackPathRects, 'rgba(30, 130, 255, 0.78)', 'rgba(220, 240, 255, 0.92)', 4.6); // 파랑
                    drawCategoryDots(tertiaryPathRects, 'rgba(231, 214, 70, 0.82)', 'rgba(255, 243, 176, 0.96)', 4.2); // 연노랑
                    drawCategoryDots(secondaryPathRects, 'rgba(255, 140, 0, 0.86)', 'rgba(255, 228, 180, 0.96)', 3.9); // 주황
                    drawCategoryDots(recommendedPathRects, 'rgba(255, 0, 0, 0.94)', 'rgba(255, 255, 255, 0.96)', 3.2); // 빨강
                }
            }
            ctx2.setLineDash([]);

            // F8/F9로 확정된 노란색 사각형들 그리기
                if (yellowRects.length > 0) {
                    for (let i = 0; i < yellowRects.length; i++) {
                        const rect = yellowRects[i];
                        const isSelected = (i === currentYellowIndex);
                        const isGoStartHighlighted = (i === goStartHighlightIndex);
                        const isPolylineHighlighted = !!(
                            polylineHighlightRange &&
                            i >= polylineHighlightRange.startIndex &&
                            i <= polylineHighlightRange.endIndex
                        );
                        
                        if (isGoStartHighlighted) {
                            // Go에서 END 선택 시 대응 START 단일 강조
                            ctx2.fillStyle = 'rgba(120, 255, 120, 0.45)';
                            ctx2.strokeStyle = 'rgba(0, 170, 0, 0.98)';
                            ctx2.lineWidth = Math.max(3, scale / 4);
                        } else if (isPolylineHighlighted) {
                            // F11 직후 start~end 구간 하이라이트
                            ctx2.fillStyle = 'rgba(11, 38, 46, 0.35)';
                            ctx2.strokeStyle = 'rgba(0, 140, 220, 0.95)';
                            ctx2.lineWidth = Math.max(2, scale / 5);
                        } else if (isSelected) {
                            // 선택된 사각형: 빨간색 두꺼운 테두리
                            ctx2.fillStyle = 'rgba(255, 100, 100, 0.4)';
                            ctx2.strokeStyle = 'rgba(255, 0, 0, 1.0)';
                            ctx2.lineWidth = Math.max(3, scale/4);
                        } else if (rect.angleExceeded) {
                            // 각도 허용오차 초과: 주황색
                            ctx2.fillStyle = 'rgba(34, 61, 212, 0.4)';
                            ctx2.strokeStyle = 'rgba(189, 116, 8, 0.9)';
                            ctx2.lineWidth = Math.max(1, scale/8);
                        } else if (rect.mergeState) {
                            // MERGE 상태: 노란색과 구분되는 청록색
                            ctx2.fillStyle = 'rgba(0, 200, 170, 0.35)';
                            ctx2.strokeStyle = 'rgba(0, 130, 110, 0.95)';
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

                        const terminal = getPolylineTerminalInfo(i);
                        if (terminal.isStart || terminal.isEnd) {
                            // START는 검정, END는 회색, 둘 다이면 START를 우선 표시
                            ctx2.strokeStyle = terminal.isStart ? 'rgb(20, 22, 158)' : 'rgb(60, 58, 68)';
                            ctx2.lineWidth = Math.max(2, scale / 5);
                            ctx2.strokeRect(rect.x * scale+0.5, rect.y * scale+0.5, rect.size * scale-1, rect.size * scale-1);
                        }
                    }
                }
                
                // 임시 노란색 사각형 그리기 (F9로 확정 전, 점선 테두리)
                if (tempYellowRect) {
                    const isVariantA = (tempYellowRect.clickVariant || 0) % 2 === 0;
                    ctx2.fillStyle = isVariantA ? 'rgba(255, 200, 0, 0.4)' : 'rgba(255, 170, 40, 0.42)';
                    ctx2.strokeStyle = isVariantA ? 'rgba(255, 150, 0, 1.0)' : 'rgba(255, 70, 0, 1.0)';
                    ctx2.lineWidth = Math.max(2, scale/6);
                    ctx2.setLineDash([5, 5]); // 점선
                    
                    ctx2.fillRect(tempYellowRect.x * scale, tempYellowRect.y * scale, tempYellowRect.size * scale, tempYellowRect.size * scale);
                    ctx2.strokeRect(tempYellowRect.x * scale+0.5, tempYellowRect.y * scale+0.5, tempYellowRect.size * scale-1, tempYellowRect.size * scale-1);
                    ctx2.setLineDash([]); // 점선 해제
                }

            ctx2.restore();
        }