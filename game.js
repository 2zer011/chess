const BOARD_SIZE = 8;
let MAX_DEPTH = 4; // Dynamic: 2=Easy, 3=Medium, 4=Hard
// Default is Hard (4).

const PIECES = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

// --- PIECE-SQUARE TABLES (PST) ---
// Higher numbers = better position. (Based on standard PSTs, flipped for Black).
// Evaluation is always from White's perspective.
const PST = {
    p: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5, 5, 10, 25, 25, 10, 5, 5],
        [0, 0, 0, 20, 20, 0, 0, 0],
        [5, -5, -10, 0, 0, -10, -5, 5],
        [5, 10, 10, -20, -20, 10, 10, 5],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    n: [
        [-50, -40, -30, -30, -30, -30, -40, -50],
        [-40, -20, 0, 0, 0, 0, -20, -40],
        [-30, 0, 10, 15, 15, 10, 0, -30],
        [-30, 5, 15, 20, 20, 15, 5, -30],
        [-30, 0, 15, 20, 20, 15, 0, -30],
        [-30, 5, 10, 15, 15, 10, 5, -30],
        [-40, -20, 0, 5, 5, 0, -20, -40],
        [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    b: [
        [-20, -10, -10, -10, -10, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 10, 10, 5, 0, -10],
        [-10, 5, 5, 10, 10, 5, 5, -10],
        [-10, 0, 10, 10, 10, 10, 0, -10],
        [-10, 10, 10, 10, 10, 10, 10, -10],
        [-10, 5, 0, 0, 0, 0, 5, -10],
        [-20, -10, -10, -10, -10, -10, -10, -20]
    ],
    r: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [5, 10, 10, 10, 10, 10, 10, 5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [0, 0, 0, 5, 5, 0, 0, 0]
    ],
    q: [
        [-20, -10, -10, -5, -5, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 5, 5, 5, 0, -10],
        [-5, 0, 5, 5, 5, 5, 0, -5],
        [0, 0, 5, 5, 5, 5, 0, -5],
        [-10, 5, 5, 5, 5, 5, 0, -10],
        [-10, 0, 5, 0, 0, 0, 0, -10],
        [-20, -10, -10, -5, -5, -10, -10, -20]
    ],
    k: [
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-20, -30, -30, -40, -40, -30, -30, -20],
        [-10, -20, -20, -20, -20, -20, -20, -10],
        [20, 20, 0, 0, 0, 0, 20, 20],
        [20, 30, 10, 0, 0, 10, 30, 20]
    ]
};

const PIECE_VALUES = {
    p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
};

let board = [];
let turn = 'w';
let selectedSquare = null;
let mode = 'pvc';
let gameOver = false;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');


function initGame() {
    board = []; // 8x8
    for (let r = 0; r < BOARD_SIZE; r++) {
        let row = new Array(8).fill(null);
        board.push(row);
    }

    // Setup logic
    const setupRow = (row, color, pieces) => {
        pieces.forEach((p, c) => board[row][c] = { type: p, color: color, hasMoved: false });
    };
    const backRow = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const pawnRow = Array(8).fill('p');

    setupRow(0, 'b', backRow);
    setupRow(1, 'b', pawnRow);
    setupRow(6, 'w', pawnRow);
    setupRow(7, 'w', backRow);

    turn = 'w';
    selectedSquare = null;
    gameOver = false;
    updateStatus();
    renderBoard();
}

// --- REFACTORED LOGIC FOR LEGAL MOVES ---

function getLegalMoves(bd, r, c) {
    const pseudoMoves = getValidMoves(bd, r, c);
    const piece = bd[r][c];
    if (!piece) return [];

    // Filter moves that leave/put King in Check
    return pseudoMoves.filter(m => {
        // Stimulate move
        const tmpBd = cloneBoard(bd);
        executeMoveOnBoard(tmpBd, { r, c }, m);

        // Find King of current color
        let kPos = null;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const p = tmpBd[i][j];
                if (p && p.type === 'k' && p.color === piece.color) {
                    kPos = { r: i, c: j };
                    break;
                }
            }
        }

        // If King not found (captured? shouldn't happen) or is under attack -> Illegal
        if (!kPos) return false;
        return !isSquareUnderAttack(tmpBd, kPos.r, kPos.c, piece.color === 'w' ? 'b' : 'w');
    });
}

function isSquareUnderAttack(bd, r, c, attackerColor) {
    // Check for attacks from all directions/types
    // 1. Pawn attacks
    const dir = attackerColor === 'w' ? 1 : -1; // Attack comes from direction based on color
    // Rephrase: If white pawns attack (r,c), they must be at (r+1, c+/-1)
    // Wait, let's reverse: check if (r,c) is attacked by `attackerColor`.
    // If attacker is White, pawns are at valid positions relative to (r,c).
    // Actually simpler: iterate all enemy pieces and see if they can move to (r,c).
    // BUT that's slow. Better is reverse check.

    // Iterate all squares for attackers?
    // Optimization: Check lines for R/B/Q, check L-shapes for N, check adj for K.

    // Check Knights
    const nMoves = [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2]];
    for (let m of nMoves) {
        const tr = r + m[0], tc = c + m[1];
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const p = bd[tr][tc];
            if (p && p.color === attackerColor && p.type === 'n') return true;
        }
    }

    // Check Pawns
    // If Attacker is White (bottom), they attack Up-Right and Up-Left.
    // So looking from target square, we check Down-Right and Down-Left.
    const pDir = attackerColor === 'w' ? 1 : -1;
    const pAttacks = [[pDir, -1], [pDir, 1]];
    for (let m of pAttacks) {
        const tr = r + m[0], tc = c + m[1];
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const p = bd[tr][tc];
            if (p && p.color === attackerColor && p.type === 'p') return true;
        }
    }

    // Check King
    const kMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (let m of kMoves) {
        const tr = r + m[0], tc = c + m[1];
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const p = bd[tr][tc];
            if (p && p.color === attackerColor && p.type === 'k') return true;
        }
    }

    // Check Sliding (Rook/Queen)
    const rDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let d of rDirs) {
        let tr = r + d[0], tc = c + d[1];
        while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const p = bd[tr][tc];
            if (p) {
                if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) return true;
                break; // Blocked
            }
            tr += d[0]; tc += d[1];
        }
    }

    // Check Sliding (Bishop/Queen)
    const bDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let d of bDirs) {
        let tr = r + d[0], tc = c + d[1];
        while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const p = bd[tr][tc];
            if (p) {
                if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) return true;
                break;
            }
            tr += d[0]; tc += d[1];
        }
    }

    return false;
}

// --- OVERRIDES ---

// Override onSquareClick to use getLegalMoves
function onSquareClick(r, c) {
    if (gameOver) return;
    if (mode === 'pvc' && turn === 'b') return;

    const p = board[r][c];
    if (p && p.color === turn) {
        selectedSquare = { r, c };
        renderBoard();
        return;
    }

    if (selectedSquare) {
        // USE LEGAL MOVES HERE
        const moves = getLegalMoves(board, selectedSquare.r, selectedSquare.c);
        const valid = moves.find(m => m.r === r && m.c === c);
        if (valid) {
            executeMoveMain(selectedSquare, { r, c });
        } else {
            if (!p) selectedSquare = null;
            renderBoard();
        }
    }
}

// Override render for legal move hints
function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const sq = document.createElement('div');
            const isWhiteSq = (r + c) % 2 === 0;
            sq.className = `square ${isWhiteSq ? 'white' : 'black'}`;
            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) sq.classList.add('selected');

            // Highlight Legal Moves
            if (selectedSquare) {
                const moves = getLegalMoves(board, selectedSquare.r, selectedSquare.c);
                if (moves.find(m => m.r === r && m.c === c)) {
                    const hint = document.createElement('div');
                    hint.className = board[r][c] ? 'capture-hint' : 'move-hint';
                    sq.appendChild(hint);
                }
            }

            const piece = board[r][c];
            if (piece) {
                const span = document.createElement('span');
                span.className = 'piece';
                span.textContent = PIECES[piece.color][piece.type];
                span.style.color = piece.color === 'w' ? 'white' : 'black';
                if (piece.color === 'w') span.style.textShadow = '0 0 2px black';
                sq.appendChild(span);
            }

            sq.onclick = () => onSquareClick(r, c);
            boardEl.appendChild(sq);
        }
    }
}

// Updated Game Over handling in execution
function checkGameOver() {
    const opponentMoves = getAllLegalMoves(board, turn);

    // Is King in Check?
    let kPos = null;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = board[i][j];
            if (p && p.type === 'k' && p.color === turn) { kPos = { r: i, c: j }; break; }
        }
    }
    const inCheck = kPos && isSquareUnderAttack(board, kPos.r, kPos.c, turn === 'w' ? 'b' : 'w');

    if (opponentMoves.length === 0) {
        gameOver = true;
        renderBoard(); // Render final state
        if (inCheck) {
            const winner = turn === 'w' ? 'Black' : 'White';
            statusEl.textContent = `CHIẾU BÍ! ${winner === 'White' ? 'Trắng' : 'Đen'} Thắng!`;
            setTimeout(() => showGameOver(winner, "Bằng chiếu bí (Checkmate)"), 500);
        } else {
            statusEl.textContent = "HÒA CỜ (Stalemate)!";
            setTimeout(() => showGameOver('Draw', "Hòa cờ (Stalemate) - Hết nước đi"), 500);
        }
        return true;
    }
    return false;
}

// Restore updateStatus function
function updateStatus() {
    if (!gameOver) {
        statusEl.textContent = `Lượt: ${turn === 'w' ? "Trắng" : "Đen"}`;
    }
}

// Modify executeMoveMain to use checkGameOver
function executeMoveMain(from, to) {
    executeMoveOnBoard(board, from, to);
    selectedSquare = null;

    turn = turn === 'w' ? 'b' : 'w';
    updateStatus();
    renderBoard();

    if (checkGameOver()) return;

    if (mode === 'pvc' && turn === 'b' && !gameOver) {
        setTimeout(() => {
            const bestMove = getBestMove(board, 'b', 4);
            if (bestMove) {
                executeMoveMain(bestMove.from, bestMove.to);
            } else {
                // Fallback if AI has no moves but checkGameOver missed it (shouldn't happen)
                console.error("AI Stuck");
            }
        }, 100);
    }
}

function executeMoveOnBoard(bd, from, to) {
    const piece = bd[from.r][from.c];
    bd[to.r][to.c] = piece;
    bd[from.r][from.c] = null;

    // Pawn Promote
    if (piece.type === 'p' && (to.r === 0 || to.r === 7)) piece.type = 'q';
    piece.hasMoved = true;
}

// --- AI ENGINE ---

function evaluateBoard(bd) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = bd[r][c];
            if (!p) continue;

            let val = PIECE_VALUES[p.type];
            // PST
            let pstVal = 0;
            if (p.color === 'w') {
                pstVal = PST[p.type][r][c];
            } else {
                // Mirror for black
                pstVal = PST[p.type][7 - r][c];
            }

            if (p.color === 'w') score += (val + pstVal);
            else score -= (val + pstVal);
        }
    }
    return score;
}

// OVERRIDE getBestMove to correct logic
function getBestMove(bd, color, depth) {
    let bestMove = null;
    // Minimize (Black)
    let bestValue = 99999;
    let alpha = -99999;
    let beta = 99999;

    const moves = getAllLegalMoves(bd, color);

    moves.sort((a, b) => {
        const pA = bd[a.to.r][a.to.c] ? 10 : 0;
        const pB = bd[b.to.r][b.to.c] ? 10 : 0;
        return pB - pA;
    });

    for (let m of moves) {
        const newBd = cloneBoard(bd);
        executeMoveOnBoard(newBd, m.from, m.to);
        const val = minimax(newBd, depth - 1, alpha, beta, true); // Next White

        if (val < bestValue) {
            bestValue = val;
            bestMove = m;
        }
        beta = Math.min(beta, bestValue);
    }
    return bestMove;
}

// Recursive minimax update
function minimax(bd, depth, alpha, beta, isMax) {
    if (depth === 0) return evaluateBoard(bd);

    const moves = getAllLegalMoves(bd, isMax ? 'w' : 'b');

    // End Game Detection in Minimax
    if (moves.length === 0) {
        // Find King to check Checkmate vs Stalemate
        let kPos = null;
        const turnColor = isMax ? 'w' : 'b';
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const p = bd[i][j];
                if (p && p.type === 'k' && p.color === turnColor) { kPos = { r: i, c: j }; break; }
            }
        }
        const inCheck = kPos && isSquareUnderAttack(bd, kPos.r, kPos.c, isMax ? 'b' : 'w');

        if (inCheck) return isMax ? -99999 : 99999; // Checkmate (Bad for current turn player)
        return 0; // Stalemate
    }

    if (isMax) { // White
        let maxEval = -99999;
        for (let m of moves) {
            const newBd = cloneBoard(bd);
            executeMoveOnBoard(newBd, m.from, m.to);
            const evaluation = minimax(newBd, depth - 1, alpha, beta, false);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else { // Black
        let minEval = 99999;
        for (let m of moves) {
            const newBd = cloneBoard(bd);
            executeMoveOnBoard(newBd, m.from, m.to);
            const evaluation = minimax(newBd, depth - 1, alpha, beta, true);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function cloneBoard(bd) {
    return bd.map(row => row.map(p => p ? { ...p } : null));
}

function getAllLegalMoves(bd, color) {
    let moves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = bd[r][c];
            if (p && p.color === color) {
                const ms = getLegalMoves(bd, r, c);
                ms.forEach(to => moves.push({ from: { r, c }, to }));
            }
        }
    }
    return moves;
}

function getValidMoves(bd, r, c) {
    const piece = bd[r][c];
    if (!piece) return [];

    let moves = [];
    const color = piece.color;
    const opponent = color === 'w' ? 'b' : 'w';

    const addIfValid = (nr, nc) => {
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const target = bd[nr][nc];
            if (!target) {
                moves.push({ r: nr, c: nc });
                return true;
            } else if (target.color === opponent) {
                moves.push({ r: nr, c: nc });
                return false;
            } else return false;
        }
        return false;
    };

    if (piece.type === 'p') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;
        if (bd[r + dir] && !bd[r + dir][c]) {
            moves.push({ r: r + dir, c: c });
            if (r === startRow && !bd[r + dir * 2][c]) {
                moves.push({ r: r + dir * 2, c: c });
            }
        }
        [[r + dir, c - 1], [r + dir, c + 1]].forEach(([nr, nc]) => {
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = bd[nr][nc];
                if (target && target.color === opponent) moves.push({ r: nr, c: nc });
            }
        });
    }
    else if (piece.type === 'n') {
        [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2]].forEach(([dr, dc]) => addIfValid(r + dr, c + dc));
    }
    else if (piece.type === 'k') {
        [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => addIfValid(r + dr, c + dc));
    }
    else {
        const dirs = [];
        if (piece.type === 'r' || piece.type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        if (piece.type === 'b' || piece.type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        dirs.forEach(([dr, dc]) => {
            let nr = r + dr, nc = c + dc;
            while (addIfValid(nr, nc)) { nr += dr; nc += dc; }
        });
    }
    return moves;
}

// Helper: Keep getValidMoves for Pseudo-Legal logic (already in code below, untouched)

// --- UI LOGIC ---

const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const modal = document.getElementById('game-over-modal');
const winnerText = document.getElementById('winner-text');
const reasonText = document.getElementById('reason-text');
const btnPvC = document.getElementById('btn-pvc');
const btnPvP = document.getElementById('btn-pvp');
const backBtn = document.getElementById('back-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const menuBtn = document.getElementById('menu-btn');

function showScreen(screen) {
    mainMenu.classList.add('hidden');
    gameScreen.classList.add('hidden');
    screen.classList.remove('hidden');
}

function startGame(selectedMode) {
    mode = selectedMode;
    showScreen(gameScreen);
    initGame();
}

function showGameOver(winner, reason) {
    modal.classList.remove('hidden');
    winnerText.textContent = winner === 'White' ? "TRẮNG THẮNG!" : (winner === 'Black' ? "ĐEN THẮNG!" : "HÒA!");
    winnerText.style.color = winner === 'White' ? '#fff' : (winner === 'Black' ? '#aaa' : '#ffd700');
    reasonText.textContent = reason;
}

btnPvC.onclick = () => startGame('pvc');
btnPvP.onclick = () => startGame('pvp');

backBtn.onclick = () => {
    gameOver = true; // Stop game loop
    showScreen(mainMenu);
};

playAgainBtn.onclick = () => {
    modal.classList.add('hidden');
    initGame();
};

// --- SOUND SYSTEM ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playTone(freq, duration, type = 'sine') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playSound(event) {
    switch (event) {
        case 'move': playTone(300, 0.1); break;
        case 'capture': playTone(150, 0.1, 'square'); break;
        case 'check': playTone(600, 0.2, 'sawtooth'); break;
        case 'end': playTone(800, 0.5); setTimeout(() => playTone(600, 0.5), 400); break;
    }
}

// --- ONLINE MODULE ---
let peer = null;
let conn = null;
let myColor = 'w'; // 'w' (Host) or 'b' (Joiner)
let isHost = false; // Track if this player created the room

const onlineMenu = document.getElementById('online-menu');
const onlineStatus = document.getElementById('online-status');
const btnOnline = document.getElementById('btn-online');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomIdInput = document.getElementById('room-id-input');
const myRoomIdEl = document.getElementById('my-room-id');
const roomInfo = document.getElementById('room-info');
const backOnlineBtn = document.getElementById('back-online-btn');

btnOnline.onclick = () => {
    showScreen(onlineMenu);
    initOnline();
};

backOnlineBtn.onclick = () => {
    if (peer) peer.destroy();
    peer = null;
    showScreen(mainMenu);
};

function initOnline() {
    onlineStatus.textContent = "Đang khởi tạo Peer...";
    // Use default public PeerServer
    peer = new Peer();

    peer.on('open', (id) => {
        onlineStatus.textContent = "Sẵn sàng kết nối!";
        onlineStatus.style.color = "#a3be8c";
    });

    peer.on('connection', (c) => {
        // Host received connection
        conn = c;
        setupConnection();
        alert("Người chơi khác đã tham gia!");
        startGameOnline('w');
    });

    peer.on('error', (err) => {
        onlineStatus.textContent = "Lỗi: " + err.type;
        onlineStatus.style.color = "#bf616a";
    });
}

createRoomBtn.onclick = () => {
    if (!peer || peer.disconnected) return alert("Chưa kết nối máy chủ Peer!");
    roomInfo.classList.remove('hidden');
    myRoomIdEl.textContent = peer.id;
    onlineStatus.textContent = "Đang chờ người chơi khác...";
    isHost = true; // Mark this player as host
};

joinRoomBtn.onclick = () => {
    const id = roomIdInput.value.trim();
    if (!id) return alert("Vui lòng nhập ID phòng!");
    if (!peer || peer.disconnected) return alert("Chưa kết nối máy chủ Peer!");

    conn = peer.connect(id);
    isHost = false; // Mark this player as joiner
    setupConnection();
};

function setupConnection() {
    conn.on('open', () => {
        onlineStatus.textContent = "Đã kết nối!";
        if (conn.metadata && conn.metadata.type === 'game_start') {
            // Handled externally if needed
        // If joiner (not host), start game as Black after connection opens
        if (!isHost) {
            startGameOnline('b');
        }
    });

    conn.on('data', (data) => {
        handleNetworkData(data);
    });   startGameOnline('b');
    }
}

function startGameOnline(color) {
    myColor = color;
    mode = 'p2p';
    showScreen(gameScreen);
    initGame();
    // Rotate board if Black
    if (myColor === 'b') {
        boardEl.style.transform = 'rotate(180deg)';
        // Squares are rotated in CSS individually? No, need to rotate pieces back?
        // Let's rely on CSS class
        document.querySelectorAll('.piece').forEach(p => p.style.transform = 'rotate(180deg)');
    } else {
        boardEl.style.transform = 'none';
    }
}

function handleNetworkData(data) {
    if (data.type === 'move') {
        executeMoveOnBoard(board, data.from, data.to);
        playSound('move');
        turn = turn === 'w' ? 'b' : 'w';
        updateStatus();
        renderBoard();
        checkGameOver();
    }
}

// Modify executeMoveMain to support P2P
function executeMoveMain(from, to) {
    if (mode === 'p2p' && turn !== myColor) return; // Not my turn

    // Capture sound check
    const isCapture = board[to.r][to.c] !== null;

    executeMoveOnBoard(board, from, to);
    selectedSquare = null;

    // Sound
    if (isCapture) playSound('capture');
    else playSound('move');

    turn = turn === 'w' ? 'b' : 'w';
    updateStatus();
    renderBoard();

    // Send Move if P2P
    if (mode === 'p2p' && conn && conn.open) {
        conn.send({ type: 'move', from, to });
    }

    const isOver = checkGameOver();
    if (isOver) playSound('end');

    // AI Logic (Only if PvC)
    if (mode === 'pvc' && turn === 'b' && !gameOver) {
        setTimeout(() => {
            const bestMove = getBestMove(board, 'b', MAX_DEPTH);
            if (bestMove) {
                executeMoveMain(bestMove.from, bestMove.to);
            }
        }, 100);
    }
}

menuBtn.onclick = () => {
    modal.classList.add('hidden');
    showScreen(mainMenu);
};

// --- TIMER & SIDE SELECTION ---
let timerInterval = null;
let timeLimit = 0; // Minutes. 0 = unlimited.
let timers = { w: 0, b: 0 };
let userSide = 'w'; // 'w', 'b', or 'random'

const sideSel = document.getElementById('side-sel');
const timeSel = document.getElementById('time-sel');
const timerTopEl = document.getElementById('timer-top');
const timerBotEl = document.getElementById('timer-bot');

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (timeLimit === 0) {
        timerTopEl.textContent = "--:--";
        timerBotEl.textContent = "--:--";
        return;
    }

    timers.w = timeLimit * 60;
    timers.b = timeLimit * 60;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (gameOver) { clearInterval(timerInterval); return; }

        timers[turn]--;
        updateTimerDisplay();

        if (timers[turn] <= 0) {
            clearInterval(timerInterval);
            gameOver = true;
            statusEl.textContent = "Hết giờ!";
            showGameOver(turn === 'w' ? 'Black' : 'White', "Hết thời gian (Timeout)");
        }
    }, 1000);
}

function updateTimerDisplay() {
    // Top is opponent, Bot is self.
    // If PvC: Bot is 'b' if user 'w'.
    // If P2P: Top is opponent color.

    let topColor = 'b';
    let botColor = 'w';

    if (mode === 'pvc') {
        // If user is Black, top is White (AI)
        if (userSide === 'b') { topColor = 'w'; botColor = 'b'; }
    } else if (mode === 'p2p') {
        // If I am Black, top is White
        if (myColor === 'b') { topColor = 'w'; botColor = 'b'; }
    }

    timerTopEl.textContent = formatTime(timers[topColor]);
    if (timers[topColor] < 30) timerTopEl.style.color = "#bf616a";
    else timerTopEl.style.color = "#aaa";

    timerBotEl.textContent = formatTime(timers[botColor]);
    if (timers[botColor] < 30) timerBotEl.style.color = "#bf616a";
    else timerBotEl.style.color = "#aaa";
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

// Update initGame to handle sides and timer
const _originalInit = initGame;
initGame = function () {
    _originalInit();

    if (mode === 'pvc') {
        const sideVal = sideSel.value;
        if (sideVal === 'random') userSide = Math.random() < 0.5 ? 'w' : 'b';
        else userSide = sideVal;

        if (userSide === 'b') {
            // Rotate board for user
            boardEl.style.transform = 'rotate(180deg)';
            document.querySelectorAll('.piece').forEach(p => p.style.transform = 'rotate(180deg)');
            // AI makes first move
            setTimeout(() => {
                const bestMove = getBestMove(board, 'w', MAX_DEPTH);
                if (bestMove) executeMoveMain(bestMove.from, bestMove.to);
            }, 500);
        } else {
            boardEl.style.transform = 'none';
        }
    }

    timeLimit = parseInt(timeSel.value);
    startTimer();
}

// --- PIECE SKINS (SVG) ---
const PIECE_SVGS = {
    w: {
        k: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
        q: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
        r: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
        b: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
        n: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
        p: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg"
    },
    b: {
        k: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
        q: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
        r: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
        b: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
        n: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
        p: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg"
    }
};

let pieceTheme = 'alpha'; // 'unicode' or 'alpha'
const pieceSel = document.getElementById('piece-sel');

// Update Render Board for SVGs
// Re-assigning _originalRender was messy, let's redefine renderBoard cleanly
renderBoard = function () {
    boardEl.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const sq = document.createElement('div');
            const isWhiteSq = (r + c) % 2 === 0;
            sq.className = `square ${isWhiteSq ? 'white' : 'black'}`;
            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) sq.classList.add('selected');

            // Highlight Legal Moves
            if (selectedSquare) {
                const moves = getLegalMoves(board, selectedSquare.r, selectedSquare.c);
                if (moves.find(m => m.r === r && m.c === c)) {
                    const hint = document.createElement('div');
                    hint.className = board[r][c] ? 'capture-hint' : 'move-hint';
                    sq.appendChild(hint);
                }
            }

            const piece = board[r][c];
            if (piece) {
                if (pieceTheme === 'alpha') {
                    const img = document.createElement('img');
                    img.src = PIECE_SVGS[piece.color][piece.type];
                    img.className = 'piece piece-img';
                    // Rotate if P2P Black
                    if (mode === 'p2p' && myColor === 'b') img.style.transform = 'rotate(180deg)';
                    else if (mode === 'pvc' && userSide === 'b') img.style.transform = 'rotate(180deg)'; // Fix PVC Rotation too

                    sq.appendChild(img);
                } else {
                    const span = document.createElement('span');
                    span.className = 'piece';
                    span.textContent = PIECES[piece.color][piece.type];
                    span.style.color = piece.color === 'w' ? 'white' : 'black';
                    if (piece.color === 'w') span.style.textShadow = '0 0 2px black';

                    if (mode === 'p2p' && myColor === 'b') span.style.transform = 'rotate(180deg)';
                    else if (mode === 'pvc' && userSide === 'b') span.style.transform = 'rotate(180deg)';

                    sq.appendChild(span);
                }
            }

            sq.onclick = () => onSquareClick(r, c);
            boardEl.appendChild(sq);
        }
    }
};


// --- SETTINGS UI ---
const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const difficultySel = document.getElementById('difficulty-sel');
const themeSel = document.getElementById('theme-sel');

btnSettings.onclick = () => {
    mainMenu.classList.add('hidden');
    settingsModal.classList.remove('hidden');
};

const _originalCloseSettings = closeSettingsBtn.onclick;
closeSettingsBtn.onclick = () => {
    settingsModal.classList.add('hidden');
    mainMenu.classList.remove('hidden');

    // Apply Settings
    MAX_DEPTH = parseInt(difficultySel.value);
    applyTheme(themeSel.value);
    pieceTheme = pieceSel.value;
    // Side and Time are read on initGame
};

function applyTheme(theme) {
    document.body.className = `theme-${theme}`;
}

// Init
applyTheme('green'); // Default
showScreen(mainMenu);
