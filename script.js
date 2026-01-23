
// --- Biến Toàn Cục & Cấu Hình ---
var board = null
var game = new Chess()
var $status = $('#status')
var $pgn = $('#pgn')

// State
var promotionParams = null; // {source, target}
var currentEval = 0; // Current stockfish eval (centipawn)
var prevEval = 0; // State before last move
var isFirstMove = true; // To skip classification on first move

// Timer Variables
var timeWhite = 0;
var timeBlack = 0;
var timerInterval = null;

// Game Settings (Lưu trạng thái cài đặt)
var gameSettings = {
  mode: 'pve', // 'pve' or 'pvp'
  difficulty: 'hard', // 'random', 'medium', 'hard', 'max'
  timeControl: 10, // minutes
  isGameActive: false
};

// Stockfish
var stockfishBlob = new Blob(["importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js');"], { type: 'application/javascript' });
var stockfish = new Worker(window.URL.createObjectURL(stockfishBlob));

// --- Menu & Setup System ---
$(document).ready(function () {
  // Mặc định hiện modal
  $('#setupModal').css('display', 'flex');

  // Xử lý chọn Mode (PvP / PvE)
  $('.btn-option').click(function () {
    $('.btn-option').removeClass('active');
    $(this).addClass('active');

    var selectedMode = $(this).data('value');
    if (selectedMode === 'pvp') {
      $('#difficultyGroup').slideUp();
    } else {
      $('#difficultyGroup').slideDown();
    }
  });

  // Nút Bắt Đầu
  $('#startGameBtn').click(function () {
    startGame();
    $('#setupModal').fadeOut();
  });

  // Nút Cài Đặt Ván Mới (Mở lại Modal)
  $('#newGameBtn').click(function () {
    // Pause game process
    gameSettings.isGameActive = false;
    clearInterval(timerInterval);
    $('#setupModal').fadeIn();
  });
});

function startGame() {
  // Đọc settings từ UI
  gameSettings.mode = $('#modeGroup .active').data('value');
  gameSettings.difficulty = $('#difficultySelect').val();
  gameSettings.timeControl = parseInt($('#timeSelect').val());

  // Reset Game Board
  game.reset();
  board.start();

  // Reset States
  currentEval = 0;
  prevEval = 0;
  isFirstMove = true;
  updateWinRate(0);

  // Reset Timer
  if (gameSettings.timeControl > 0) {
    timeWhite = gameSettings.timeControl * 60;
    timeBlack = gameSettings.timeControl * 60;
    $('.timer').show();
    updateTimerDisplay();
  } else {
    // Ẩn đồng hồ nếu chọn "Không giới hạn"
    $('.timer').hide();
  }

  gameSettings.isGameActive = true;
  updateStatus();
  updateGameParamsDisplay();
  startTimer();

  // Reset Stockfish
  stockfish.postMessage('ucinewgame');
}

function updateGameParamsDisplay() {
  var text = "";
  if (gameSettings.mode === 'pvp') {
    text = "Chế độ: 2 Người chơi";
  } else {
    var diffText = "Dễ";
    if (gameSettings.difficulty === 'medium') diffText = "Trung Bình";
    if (gameSettings.difficulty === 'hard') diffText = "Khó";
    if (gameSettings.difficulty === 'max') diffText = "Siêu Khó (Max)";
    text = "Máy: " + diffText;
  }

  if (gameSettings.timeControl > 0) {
    text += " | " + gameSettings.timeControl + " phút";
  } else {
    text += " | Vô hạn";
  }

  $('#gameParams').text(text);
}

// --- Timer Logic ---
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  if (gameSettings.timeControl <= 0) return; // No timer

  timerInterval = setInterval(function () {
    if (!gameSettings.isGameActive) return;

    if (game.turn() === 'w') {
      timeWhite--;
      if (timeWhite <= 0) handleTimeout('white');
    } else {
      timeBlack--;
      if (timeBlack <= 0) handleTimeout('black');
    }
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  $('#time1').text(formatTime(timeWhite)).removeClass('active');
  $('#time2').text(formatTime(timeBlack)).removeClass('active');

  if (gameSettings.timeControl > 0 && gameSettings.isGameActive) {
    if (game.turn() === 'w') $('#time1').addClass('active');
    else $('#time2').addClass('active');

    // Low time warning (< 30s)
    if (timeWhite < 30) $('#time1').addClass('low-time');
    else $('#time1').removeClass('low-time');

    if (timeBlack < 30) $('#time2').addClass('low-time');
    else $('#time2').removeClass('low-time');
  }
}

function formatTime(seconds) {
  if (seconds < 0) return "00:00";
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
}

function handleTimeout(color) {
  gameSettings.isGameActive = false;
  clearInterval(timerInterval);
  var loser = (color === 'white') ? "Trắng" : "Đen";
  var winner = (color === 'white') ? "Đen" : "Trắng";
  $status.text("Hết giờ! " + loser + " thua. " + winner + " thắng.");
  alert("Hết giờ! " + winner + " thắng!");
}

// --- AI Logic (Stockfish & Random) ---
// Variable to store temporary eval during search
var searchEval = 0;

stockfish.onmessage = function (event) {
  // 1. Parsing BestMove (End of search)
  if (event.data && event.data.startsWith('bestmove')) {
    var bestMove = event.data.split(' ')[1];

    // Determine classification before making the move (Wait, this bestmove is for the BOT's turn usually)
    // Or if we were analyzing the user's move. 
    // If it's PVE, we just analyzed the position AFTER user moved? 
    // Logic: User Moves -> onDrop -> makeAIMove (which calls stockfish).
    // So Stockfish is analyzing the position AFTER User Moved.
    // The evaluation "searchEval" found during this search represents the value of the board FOR THE USER's opponent (Bot).

    // Let's refine:
    // User (White) moves.
    // Board is now Black to move.
    // Stockfish analyzes position.
    // SearchEval is Score for Black.

    // We want to classify White's move.
    // We compare:
    // PrevEval (White's perspective, before move)
    // CurrentEval (White's perspective, after move)

    // SearchEval (Score for Black). 
    // CurrentEval (White) = -SearchEval.

    var finalEvalForActiveSide = searchEval; // This is usually CP for side to move (Black)
    var currentEvalWhite = (game.turn() === 'w') ? finalEvalForActiveSide : -finalEvalForActiveSide;

    // Trigger Classification
    if (!isFirstMove) {
      classifyMove(currentEvalWhite, prevEval, (game.turn() === 'w' ? 'b' : 'w')); // Classify the side that JUST moved
    }

    // Set PrevEval for NEXT turn
    prevEval = currentEvalWhite;
    isFirstMove = false;

    // Execute Bot Move
    if (gameSettings.mode === 'pve' && game.turn() !== 'w') { // Assuming Bot is Black
      game.move({ from: bestMove.substring(0, 2), to: bestMove.substring(2, 4), promotion: bestMove.substring(4, 5) || 'q' });
      board.position(game.fen());
      checkGameOver();
      updateStatus();
    }
  }

  // 2. Parsing Evaluation (During search)
  if (event.data && event.data.includes('score')) {
    var scoreMatch = event.data.match(/score cp (-?\d+)/);
    var mateMatch = event.data.match(/score mate (-?\d+)/);

    var evalText = "";
    if (mateMatch) {
      var mateIn = parseInt(mateMatch[1]);
      evalText = "Mate in " + Math.abs(mateIn);
      searchEval = (mateIn > 0 ? 2000 : -2000); // 2000 cp cap for mate
    } else if (scoreMatch) {
      var score = parseInt(scoreMatch[1]);
      searchEval = score;

      // Display Logic
      var isWhiteTurn = game.turn() === 'w';
      // Score is for Side to Move.
      var absScore = isWhiteTurn ? score : -score; // Absolute White

      var displayScore = (absScore / 100).toFixed(2);
      evalText = (absScore > 0 ? "+" : "") + displayScore;

      // Update Win Rate
      updateWinRate(absScore);
    }

    if (evalText) $('#evaluation').text("Đánh giá: " + evalText);
  }
};

function determineMoveQuality(delta) {
  // Delta = (CurrentEval - PrevEval) from perspective of the player who moved.
  // If Delta is negative, they lost advantage.

  if (delta > 200) return 'brilliant'; // Gained massive advantage (blunder by opponent?) or tactical find
  if (delta > 50) return 'great';
  if (delta > -20) return 'best'; // Maintained or slight diff
  if (delta > -50) return 'good';
  if (delta > -100) return 'inaccuracy';
  if (delta > -300) return 'mistake';
  return 'blunder';
}

function classifyMove(currentEvalWhite, prevEvalWhite, movedColor) {
  // We want Delta from perspective of MOVED player.
  // If White Moved: Delta = CurrentWhite - PrevWhite
  // If Black Moved: Delta = CurrentBlack - PrevBlack
  //               = (-CurrentWhite) - (-PrevWhite)
  //               = PrevWhite - CurrentWhite

  var delta = (movedColor === 'w') ? (currentEvalWhite - prevEvalWhite) : (prevEvalWhite - currentEvalWhite);

  var type = determineMoveQuality(delta);

  var textMap = {
    'brilliant': 'THIÊN TÀI 🧠',
    'great': 'TUYỆT VỜI 🔥',
    'best': 'CHUẨN CMN RỒI ⭐',
    'good': 'TẠM ĐƯỢC ✅',
    'inaccuracy': 'HƠI NON 😅',
    'mistake': 'NGU VÃI 🐔',
    'blunder': 'XÓA GAME ĐI 🗑️' // Aggressive insults as requested
  };

  // Only show badge for significant events
  if (['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder'].includes(type)) {
    showMoveBadge(type, textMap[type]);
  }
}

function updateWinRate(cp) {
  // Formula: Win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
  var chance = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  $('#winRateWhite').css('height', chance + '%');
}

function showMoveBadge(type, text) {
  var badge = $('#moveBadge');
  var icon = "";
  var className = "move-badge badge-" + type;

  switch (type) {
    case 'brilliant': icon = "!!"; break;
    case 'great': icon = "!"; break;
    case 'best': icon = "★"; break;
    case 'good': icon = "✔"; break;
    case 'inaccuracy': icon = "?"; break;
    case 'mistake': icon = "?"; break;
    case 'blunder': icon = "??"; break;
  }

  badge.find('.badge-icon').text(icon);
  badge.find('.badge-text').text(text);
  badge.removeClass('hidden').attr('class', className + ' show'); // Reset class then add show

  // Reset animation
  void badge[0].offsetWidth;

  // Hide after 2s
  setTimeout(function () {
    badge.removeClass('show').addClass('hidden');
  }, 2500);
}


function makeAIMove() {
  if (!gameSettings.isGameActive) return;

  if (gameSettings.difficulty === 'random') {
    // Random Move
    var possibleMoves = game.moves();
    if (possibleMoves.length === 0) return;
    var randomIdx = Math.floor(Math.random() * possibleMoves.length);
    game.move(possibleMoves[randomIdx]);
    board.position(game.fen());
    checkGameOver();
    updateStatus();

    // Reset Eval to 0 for random (or unknown)
    prevEval = 0;
  } else {
    // Stockfish Move
    var depth = 15;
    if (gameSettings.difficulty === 'medium') depth = 5;
    if (gameSettings.difficulty === 'max') depth = 20; // Depth 20 is very strong for browser JS

    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth ' + depth);
  }
}

// --- Chess Logic ---
function onDragStart(source, piece, position, orientation) {
  if (!gameSettings.isGameActive) return false;
  if (game.game_over()) return false;

  // Logic PvP
  if (gameSettings.mode === 'pvp') {
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
  }
  // Logic PvE
  else {
    // Chỉ cho cầm quân Trắng
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
    if (piece.search(/^b/) !== -1) return false;
  }
}

function onDrop(source, target) {
  // Check for Promotion (Pawn to last rank)
  var piece = game.get(source);
  if (piece && piece.type === 'p' &&
    ((piece.color === 'w' && target.charAt(1) === '8') ||
      (piece.color === 'b' && target.charAt(1) === '1'))) {

    // Save move params and open modal
    promotionParams = { source: source, target: target };
    $('#promotionModal').css('display', 'flex');

    // Snapback to avoid invalid board state while choosing
    return 'snapback';
  }

  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // Default to queen if not caught above (fallback)
  })

  if (move === null) return 'snapback';

  updateStatus();
  checkGameOver();
  updateTimerDisplay(); // Switch active timer immediately

  // Trigger Analysis to update Win Rate & Classification for THIS move
  // Even if PVE and Bot is thinking, we want to know if User's move was good.
  // We send 'go depth 10' quickly? 
  // Existing Logic: `makeAIMove` calls stockfish. 
  // If PvE, Bot will think. The analysis during Bot's think time will serve as classification for User's move?
  // YES. Because Bot analyzes the position resulting from User's move.
  // The 'score' received is the score of that new position.

  if (gameSettings.mode === 'pvp') {
    // If PvP, we need to trigger analysis manually because no bot is "thinking"
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 15');
  }

  // Nếu là PvE và game chưa kết thúc -> Bot đi
  if (gameSettings.mode === 'pve' && !game.game_over() && gameSettings.isGameActive) {
    // Delay chút cho tự nhiên
    window.setTimeout(makeAIMove, 250);
  }
}

function onSnapEnd() {
  board.position(game.fen())
}

function checkGameOver() {
  if (game.game_over()) {
    gameSettings.isGameActive = false;
    clearInterval(timerInterval);
  }
}

function updateStatus() {
  var status = ''
  var moveColor = 'Trắng'
  if (game.turn() === 'b') {
    moveColor = 'Đen'
  }

  if (game.in_checkmate()) {
    status = 'Hết cờ! ' + moveColor + ' bị chiếu tướng.'
  }
  else if (game.in_draw()) {
    status = 'Hòa!'
  }
  else {
    status = moveColor + ' đi'
    if (game.in_check()) {
      status += ', ' + moveColor + ' đang bị chiếu!'
    }
  }

  // Show "AI thinking" status if needed
  if (gameSettings.mode === 'pve' && game.turn() === 'b' && gameSettings.isGameActive) {
    status += " (Máy đang nghĩ...)";
  }

  $status.html(status)
  $pgn.html(game.pgn())
}

function pieceTheme(piece) {
  return 'https://chessboardjs.com/img/chesspieces/wikipedia/' + piece + '.png'
}

var config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
  pieceTheme: pieceTheme
}
board = Chessboard('myBoard', config)

// Initial Status Update
updateStatus();

$('#flipBtn').on('click', board.flip);

// Function specifically for Promotion Selection
function selectPromotion(pieceType) {
  if (!promotionParams) return;

  var move = game.move({
    from: promotionParams.source,
    to: promotionParams.target,
    promotion: pieceType
  });

  if (move) {
    board.position(game.fen());
    checkGameOver();
    updateStatus();
    updateTimerDisplay();

    // Hide Modal
    $('#promotionModal').css('display', 'none');
    promotionParams = null; // Reset

    // Trigger AI if needed
    if (gameSettings.mode === 'pve' && !game.game_over() && gameSettings.isGameActive) {
      window.setTimeout(makeAIMove, 250);
    }
    // If PvP, manual analyze
    else if (gameSettings.mode === 'pvp') {
      stockfish.postMessage('position fen ' + game.fen());
      stockfish.postMessage('go depth 15');
    }
  }
}
window.selectPromotion = selectPromotion;
