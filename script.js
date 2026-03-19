// ========================
// Jigsaw Puzzle - 96 Pieces
// Traditional Interlocking Shapes (Canvas)
// ========================

const imageLoader = document.getElementById('imageLoader');
const startBtn = document.getElementById('startBtn');
const statusDiv = document.getElementById('status');
const puzzleBoard = document.getElementById('puzzleBoard');
const piecesContainer = document.getElementById('piecesContainer');
const winModal = document.getElementById('winModal');
const timeTakenSpan = document.getElementById('timeTaken');
const playAgainBtn = document.getElementById('playAgainBtn');

let sourceImage = new Image();
let COLS, ROWS;
let pieceW, pieceH, pad;
let originalWidth, originalHeight;
let edgeTypes;
let placedCount = 0;
let startTime, timerInterval;
let isPlaying = false;
const TOTAL = 96;

// ========================
// IMAGE LOADING
// ========================
imageLoader.addEventListener('change', function (e) {
    if (!e.target.files?.length) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        sourceImage = new Image();
        sourceImage.onload = () => {
            startBtn.disabled = false;
            statusDiv.textContent = '圖片已載入，準備好開始遊戲！';
            showPreview();
        };
        sourceImage.src = ev.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
});

function calcLayout() {
    if (sourceImage.width >= sourceImage.height) { COLS = 12; ROWS = 8; }
    else { COLS = 8; ROWS = 12; }
    const boardContainer = document.querySelector('.board-container');
    const cw = boardContainer.clientWidth - 40;
    const ch = boardContainer.clientHeight - 40;
    const scale = Math.min(cw / sourceImage.width, ch / sourceImage.height, 1);
    originalWidth = sourceImage.width * scale;
    originalHeight = sourceImage.height * scale;
    pieceW = originalWidth / COLS;
    pieceH = originalHeight / ROWS;
    pad = Math.ceil(Math.max(pieceW, pieceH) * 0.35);
}

function showPreview() {
    calcLayout();
    puzzleBoard.innerHTML = '';
    piecesContainer.innerHTML = '';
    applyBoardStyle();
    for (let i = 0; i < TOTAL; i++) puzzleBoard.appendChild(makeCell(i));
    puzzleBoard.style.backgroundImage = `url(${sourceImage.src})`;
    puzzleBoard.style.backgroundSize = `${originalWidth}px ${originalHeight}px`;
    puzzleBoard.style.opacity = '0.4';
}

function applyBoardStyle() {
    puzzleBoard.style.width = originalWidth + 'px';
    puzzleBoard.style.height = originalHeight + 'px';
    puzzleBoard.style.gridTemplateColumns = `repeat(${COLS}, ${pieceW}px)`;
    puzzleBoard.style.gridTemplateRows = `repeat(${ROWS}, ${pieceH}px)`;
}

function makeCell(i) {
    const cell = document.createElement('div');
    cell.className = 'board-cell';
    cell.dataset.index = i;
    cell.style.width = pieceW + 'px';
    cell.style.height = pieceH + 'px';
    cell.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    cell.addEventListener('dragenter', e => { e.preventDefault(); if (!cell.querySelector('.placed')) cell.classList.add('drag-over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', onDrop);
    return cell;
}

// ========================
// START GAME
// ========================
startBtn.addEventListener('click', startGame);

function startGame() {
    calcLayout();
    isPlaying = true;
    placedCount = 0;
    startBtn.disabled = true;
    statusDiv.textContent = '遊戲進行中...';
    puzzleBoard.innerHTML = '';
    piecesContainer.innerHTML = '';
    puzzleBoard.style.backgroundImage = 'none';
    puzzleBoard.style.opacity = '1';
    applyBoardStyle();
    for (let i = 0; i < TOTAL; i++) puzzleBoard.appendChild(makeCell(i));

    edgeTypes = generateEdgeTypes(COLS, ROWS);

    const pieces = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            pieces.push(makePieceWrapper(c, r, edgeTypes[r][c]));
        }
    }
    // Shuffle
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    pieces.forEach(p => piecesContainer.appendChild(p));

    startTime = Date.now();
    clearInterval(timerInterval);
    timerInterval = setInterval(updateStatus, 1000);
}

function makePieceWrapper(col, row, edges) {
    const idx = row * COLS + col;
    const wrapper = document.createElement('div');
    wrapper.className = 'piece-wrapper';
    wrapper.draggable = true;
    wrapper.dataset.index = idx;
    wrapper.style.width = (pieceW + 2 * pad) + 'px';
    wrapper.style.height = (pieceH + 2 * pad) + 'px';

    const canvas = document.createElement('canvas');
    canvas.width = pieceW + 2 * pad;
    canvas.height = pieceH + 2 * pad;
    drawPiece(canvas, edges, col, row);

    wrapper.appendChild(canvas);
    wrapper.addEventListener('dragstart', onDragStart);
    wrapper.addEventListener('dragend', onDragEnd);
    return wrapper;
}

// ========================
// EDGE TYPE GENERATION
// ========================
function generateEdgeTypes(cols, rows) {
    // hJoin[r][c]: +1 = bottom of row r has tab, row r+1 top has blank
    const hJoin = Array.from({ length: rows - 1 }, () =>
        Array.from({ length: cols }, () => Math.random() > 0.5 ? 1 : -1)
    );
    // vJoin[r][c]: +1 = right of col c has tab, col c+1 left has blank
    const vJoin = Array.from({ length: rows }, () =>
        Array.from({ length: cols - 1 }, () => Math.random() > 0.5 ? 1 : -1)
    );
    return Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => ({
            top:    r === 0        ? 0 : -hJoin[r - 1][c],
            bottom: r === rows - 1 ? 0 :  hJoin[r][c],
            left:   c === 0        ? 0 : -vJoin[r][c - 1],
            right:  c === cols - 1 ? 0 :  vJoin[r][c]
        }))
    );
}

// ========================
// DRAW PUZZLE PIECE (Canvas + bezier)
// ========================
function drawEdge(ctx, x1, y1, x2, y2, type) {
    if (type === 0) { ctx.lineTo(x2, y2); return; }
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    // Outside normal for a CW path: (dy/len, -dx/len)
    const nx = dy / len, ny = -dx / len;
    const amp = len * 0.28 * type; // protrusion amount

    const p1x = x1 + dx * 0.35, p1y = y1 + dy * 0.35;
    const p2x = x1 + dx * 0.65, p2y = y1 + dy * 0.65;
    const pmx = x1 + dx * 0.5 + nx * amp;
    const pmy = y1 + dy * 0.5 + ny * amp;

    ctx.lineTo(p1x, p1y);
    ctx.bezierCurveTo(
        p1x + nx * amp * 0.5, p1y + ny * amp * 0.5,
        pmx - dx * 0.15, pmy,
        pmx, pmy
    );
    ctx.bezierCurveTo(
        pmx + dx * 0.15, pmy,
        p2x + nx * amp * 0.5, p2y + ny * amp * 0.5,
        p2x, p2y
    );
    ctx.lineTo(x2, y2);
}

function buildPiecePath(ctx, edges) {
    const x = pad, y = pad, w = pieceW, h = pieceH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawEdge(ctx, x, y, x + w, y, edges.top);       // top (L→R)
    drawEdge(ctx, x + w, y, x + w, y + h, edges.right);   // right (T→B)
    drawEdge(ctx, x + w, y + h, x, y + h, edges.bottom);  // bottom (R→L)
    drawEdge(ctx, x, y + h, x, y, edges.left);       // left (B→T)
    ctx.closePath();
}

function drawPiece(canvas, edges, col, row) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    buildPiecePath(ctx, edges);
    ctx.save();
    ctx.clip();
    // Draw image portion for this cell
    ctx.drawImage(sourceImage, pad - col * pieceW, pad - row * pieceH, originalWidth, originalHeight);
    // Slight inner shadow
    const grad = ctx.createRadialGradient(pad + pieceW / 2, pad + pieceH / 2, 0, pad + pieceW / 2, pad + pieceH / 2, Math.max(pieceW, pieceH));
    grad.addColorStop(0.7, 'rgba(0,0,0,0)');
    grad.addColorStop(1.0, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Stroke border
    buildPiecePath(ctx, edges);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

// ========================
// DRAG & DROP
// ========================
let draggedEl = null;

function onDragStart(e) {
    draggedEl = this;
    e.dataTransfer.setData('text/plain', this.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (draggedEl) draggedEl.style.opacity = '0.45'; }, 0);
}

function onDragEnd() {
    if (this) this.style.opacity = '1';
    draggedEl = null;
}

function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.classList.remove('drag-over');
    if (!draggedEl) return;

    const targetIdx = this.dataset.index;
    const pieceIdx = draggedEl.dataset.index;

    if (targetIdx === pieceIdx) {
        // Correct!
        draggedEl.style.opacity = '1';
        draggedEl.draggable = false;
        draggedEl.classList.add('placed');
        draggedEl.style.position = 'absolute';
        draggedEl.style.left = (-pad) + 'px';
        draggedEl.style.top = (-pad) + 'px';
        draggedEl.style.pointerEvents = 'none';
        draggedEl.style.zIndex = '2';
        this.appendChild(draggedEl);
        placedCount++;
        updateStatus();
        if (placedCount === TOTAL) gameWon();
    } else {
        // Wrong - shake
        const el = draggedEl;
        el.style.transition = 'transform 0.08s';
        el.style.transform = 'rotate(-5deg) scale(1.05)';
        setTimeout(() => { el.style.transform = 'rotate(5deg) scale(1.05)'; }, 80);
        setTimeout(() => { el.style.transform = 'none'; el.style.transition = ''; }, 160);
    }
}

// ========================
// STATUS & WIN
// ========================
function updateStatus() {
    if (!isPlaying) return;
    const secs = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    statusDiv.textContent = `⏱ ${m}:${s}  |  已放置: ${placedCount} / ${TOTAL}`;
}

function gameWon() {
    isPlaying = false;
    clearInterval(timerInterval);
    const secs = Math.floor((Date.now() - startTime) / 1000);
    timeTakenSpan.textContent = secs;
    setTimeout(() => winModal.classList.add('active'), 500);
}

playAgainBtn.addEventListener('click', () => {
    winModal.classList.remove('active');
    statusDiv.textContent = '請上傳一張圖片以開始';
    startBtn.disabled = true;
    puzzleBoard.innerHTML = '';
    piecesContainer.innerHTML = '';
    puzzleBoard.style.backgroundImage = 'none';
    imageLoader.value = '';
    isPlaying = false;
});

window.addEventListener('resize', () => {
    if (sourceImage.src && !isPlaying && puzzleBoard.children.length > 0) showPreview();
});
