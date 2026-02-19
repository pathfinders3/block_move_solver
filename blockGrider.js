// ----- 귀퉁이 사각형 좌표 함수 -----
/**
 * 원래 사각형의 4개 귀퉁이에 위치한 size2 크기의 사각형 좌표를 리턴합니다.
 * @param {number} x - 원래 사각형의 x 좌표
 * @param {number} y - 원래 사각형의 y 좌표
 * @param {number} size - 원래 사각형의 한 변의 길이
 * @param {number} size2 - 귀퉁이 사각형의 한 변의 길이
 * @returns {Array<{x: number, y: number, w: number, h: number}>}
 */
function getCornerRects(x, y, size, size2) {
    // 각 귀퉁이가 캔버스(0~63) 밖이면 잘라서 조정
    const clamp = v => Math.max(0, Math.min(63, v));
    return [
        { x: clamp(x - size2), y: clamp(y - size2), w: Math.min(size2, 64 - clamp(x - size2)), h: Math.min(size2, 64 - clamp(y - size2)) }, // 좌상
        { x: clamp(x + size),  y: clamp(y - size2), w: Math.min(size2, 64 - clamp(x + size)), h: Math.min(size2, 64 - clamp(y - size2)) }, // 우상
        { x: clamp(x - size2), y: clamp(y + size),  w: Math.min(size2, 64 - clamp(x - size2)), h: Math.min(size2, 64 - clamp(y + size)) },  // 좌하
        { x: clamp(x + size),  y: clamp(y + size),  w: Math.min(size2, 64 - clamp(x + size)), h: Math.min(size2, 64 - clamp(y + size)) }    // 우하
    ];
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
        
        // Range 바 값 변경 시 표시 업데이트
        scaleRange.addEventListener('input', (e) => {
            const index = parseInt(e.target.value);
            const scale = scaleValues[index];
            scaleDisplay.textContent = `${scale}x`;
        });
        
        // F2, F4, IJKL 키 이벤트 리스너
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                scaleCanvas();
            }
            if (e.key === 'F4') {
                showCorners = !showCorners;
                // F4 on일 때만 귀퉁이 rects 새로 계산
                if(showCorners && selectedPixel) {
                    cornerRects = getCornerRects(selectedPixel.x, selectedPixel.y, 4, 4);
                } else {
                    cornerRects = [];
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
                    cornerRects = getCornerRects(selectedPixel.x, selectedPixel.y, 4, 4);
                } else {
                    cornerRects = [];
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
            
            console.log(`Canvas1을 ${scale}배로 확대하여 Canvas2에 복사했습니다.`);
        }
        
        // 초기 스케일 표시 설정
        scaleDisplay.textContent = `${scaleValues[2]}x`;

        // 캔버스2 클릭시 원래 좌표 표시 및 사각형 그리기
        let selectedPixel = null;
        // F4: 귀퉁이 점선 모드 토글용 변수
        let showCorners = false;
        let cornerRects = [];

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
                cornerRects = getCornerRects(selectedPixel.x, selectedPixel.y, 4, 4);
            } else {
                cornerRects = [];
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
                ctx2.save();
                // 메인 사각형: 빨강/검정 점선
                ctx2.strokeStyle = 'red';
                ctx2.lineWidth = Math.max(1, scale/8);
                ctx2.setLineDash([4, 4]);
                ctx2.lineDashOffset = 0;
                ctx2.strokeRect(selectedPixel.x * scale+0.5, selectedPixel.y * scale+0.5, scale-1, scale-1);
                ctx2.strokeStyle = 'black';
                ctx2.setLineDash([4, 4]);
                ctx2.lineDashOffset = 4;
                ctx2.strokeRect(selectedPixel.x * scale+0.5, selectedPixel.y * scale+0.5, scale-1, scale-1);

                // 귀퉁이 사각형
                if (showCorners && cornerRects.length > 0) {
                    for (const r of cornerRects) {
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
                ctx2.setLineDash([]);
                ctx2.restore();
            }
        }