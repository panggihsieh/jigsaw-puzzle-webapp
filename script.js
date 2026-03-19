const imageLoader = document.getElementById('imageLoader');
const startBtn = document.getElementById('startBtn');
const statusDiv = document.getElementById('status');
const puzzleBoard = document.getElementById('puzzleBoard');
const piecesContainer = document.getElementById('piecesContainer');
const winModal = document.getElementById('winModal');
const timeTakenSpan = document.getElementById('timeTaken');
const playAgainBtn = document.getElementById('playAgainBtn');

let sourceImage = new Image();
let originalWidth, originalHeight;
let pieceWidth, pieceHeight;
let columns, rows;
let startTime, timerInterval;
let placedPiecesCount = 0;
const TOTAL_PIECES = 96;
let isPlaying = false;

// Handle image upload
imageLoader.addEventListener('change', function(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        sourceImage.onload = () => {
            startBtn.disabled = false;
            statusDiv.textContent = "圖片已載入，準備好開始遊戲！";
            setupBoardPreview();
        };
        sourceImage.src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
});

function setupBoardPreview() {
    puzzleBoard.innerHTML = '';
    piecesContainer.innerHTML = '';
    
    // Calculate aspect ratio to determine rows and columns
    // We want exactly 96 pieces. Possible combinations:
    // 12 x 8 (landscape), 8 x 12 (portrait), 16 x 6, etc.
    const aspectRatio = sourceImage.width / sourceImage.height;
    
    // To ensure exact 96 pieces, let's rigidly use 12x8 or 8x12
    if (sourceImage.width > sourceImage.height) {
        columns = 12;
        rows = 8;
    } else {
        columns = 8;
        rows = 12;
    }

    // Determine scale to fit into board container exactly
    const boardContainer = document.querySelector('.board-container');
    const containerWidth = boardContainer.clientWidth - 40;
    const containerHeight = boardContainer.clientHeight - 40;
    
    // Prevent zero division / NaN
    if (containerWidth <= 0 || containerHeight <= 0) return;
    
    const scale = Math.min(
        containerWidth / sourceImage.width,
        containerHeight / sourceImage.height,
        1 // Don't scale up past 1x if it's smaller
    );
    
    originalWidth = sourceImage.width * scale;
    originalHeight = sourceImage.height * scale;
    
    pieceWidth = originalWidth / columns;
    pieceHeight = originalHeight / rows;
    
    puzzleBoard.style.width = `${originalWidth}px`;
    puzzleBoard.style.height = `${originalHeight}px`;
    puzzleBoard.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    puzzleBoard.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    
    // Create empty cells
    for (let i = 0; i < TOTAL_PIECES; i++) {
        const cell = document.createElement('div');
        cell.classList.add('board-cell');
        cell.dataset.index = i;
        
        // Setup Drag & Drop events for cells
        cell.addEventListener('dragover', dragOver);
        cell.addEventListener('dragenter', dragEnter);
        cell.addEventListener('dragleave', dragLeave);
        cell.addEventListener('drop', drop);
        
        puzzleBoard.appendChild(cell);
    }
    
    // Show preview
    puzzleBoard.style.backgroundImage = `url(${sourceImage.src})`;
    puzzleBoard.style.backgroundSize = `${originalWidth}px ${originalHeight}px`;
    puzzleBoard.style.opacity = '0.5';
}

startBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', () => {
    winModal.classList.remove('active');
    statusDiv.textContent = "請上傳一張圖片以開始";
    startBtn.disabled = true;
    puzzleBoard.innerHTML = '';
    piecesContainer.innerHTML = '';
    puzzleBoard.style.backgroundImage = 'none';
    imageLoader.value = '';
    isPlaying = false;
});

function startGame() {
    if (!sourceImage.src) return;
    isPlaying = true;
    startBtn.disabled = true;
    statusDiv.textContent = "遊戲進行中...";
    puzzleBoard.style.backgroundImage = 'none';
    puzzleBoard.style.opacity = '1';
    
    placedPiecesCount = 0;
    piecesContainer.innerHTML = '';
    
    const pieces = [];
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
            const index = row * columns + col;
            
            const piece = document.createElement('div');
            piece.classList.add('puzzle-piece');
            piece.draggable = true;
            piece.dataset.index = index;
            
            piece.style.width = `${pieceWidth}px`;
            piece.style.height = `${pieceHeight}px`;
            
            // Set background
            piece.style.backgroundImage = `url(${sourceImage.src})`;
            piece.style.backgroundSize = `${originalWidth}px ${originalHeight}px`;
            piece.style.backgroundPosition = `-${col * pieceWidth}px -${row * pieceHeight}px`;
            
            // Drag events
            piece.addEventListener('dragstart', dragStart);
            piece.addEventListener('dragend', dragEnd);
            
            pieces.push(piece);
        }
    }
    
    // Shuffle pieces
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    
    pieces.forEach(p => piecesContainer.appendChild(p));
    
    // Start timer
    startTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (!isPlaying) return;
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    statusDiv.textContent = `已用時間: ${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')} | 進度: ${placedPiecesCount} / 96`;
}

// Drag & Drop Functions
let draggedPiece = null;

function dragStart(e) {
    if (!isPlaying) return;
    draggedPiece = this;
    setTimeout(() => this.style.opacity = '0.5', 0);
    
    // For mobile or robust styling
    e.dataTransfer.setData('text/plain', this.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
}

function dragEnd(e) {
    this.style.opacity = '1';
    draggedPiece = null;
}

function dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function dragEnter(e) {
    e.preventDefault();
    if (this.childElementCount === 0) {
        this.classList.add('drag-over');
    }
}

function dragLeave(e) {
    this.classList.remove('drag-over');
}

function drop(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');
    
    if (!draggedPiece) return false;
    
    // Only allow dropping if cell is empty
    if (this.childElementCount === 0) {
        const targetIndex = this.dataset.index;
        const pieceIndex = draggedPiece.dataset.index;
        
        // Match condition
        if (targetIndex === pieceIndex) {
            this.appendChild(draggedPiece);
            draggedPiece.draggable = false;
            draggedPiece.style.cursor = 'default';
            draggedPiece.classList.add('placed');
            placedPiecesCount++;
            
            // Update progress early
            updateTimer();
            
            if (placedPiecesCount === TOTAL_PIECES) {
                gameWon();
            }
        } else {
            // Visual feedback for wrong attempt (shake)
            draggedPiece.style.transform = 'translate(-3px, 3px)';
            setTimeout(() => {
                if (draggedPiece) draggedPiece.style.transform = 'translate(3px, -3px)';
            }, 50);
            setTimeout(() => {
                if (draggedPiece) draggedPiece.style.transform = 'translate(-3px, -3px)';
            }, 100);
            setTimeout(() => {
                if (draggedPiece) draggedPiece.style.transform = 'none';
            }, 150);
        }
    }
    return false;
}

function gameWon() {
    isPlaying = false;
    clearInterval(timerInterval);
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    timeTakenSpan.textContent = seconds;
    
    setTimeout(() => {
        winModal.classList.add('active');
    }, 500);
}

// Handle window resize to adjust board preview if not started
window.addEventListener('resize', () => {
    if (sourceImage.src && !isPlaying && puzzleBoard.innerHTML !== '') {
        setupBoardPreview();
    }
});
