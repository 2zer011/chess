
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
var lastMoveTarget = null; // Track the last move target square for badge positioning
var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 800;

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
  prevEval = 0;
  isFirstMove = true;
  lastMoveTarget = null;
  moveCount = 0;
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

    var finalEvalForActiveSide = searchEval; // This is usually CP for side to move (Black)
    var currentEvalWhite = (game.turn() === 'w') ? finalEvalForActiveSide : -finalEvalForActiveSide;

    // Trigger Classification
    if (!isFirstMove) {
      // Classify the side that JUST moved (Opponent of current turn)
      var movedColor = (game.turn() === 'w' ? 'b' : 'w');
      classifyMove(currentEvalWhite, prevEval, movedColor, lastMoveTarget);
    }

    // Set PrevEval for NEXT turn
    prevEval = currentEvalWhite;
    isFirstMove = false;

    // Execute Bot Move if PvE
    if (gameSettings.mode === 'pve' && game.turn() !== 'w') { // Assuming Bot is Black
      var botMoveTo = bestMove.substring(2, 4);
      lastMoveTarget = botMoveTo; // Track bot move for badge too

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
      var absScore = isWhiteTurn ? score : -score; // Absolute White

      var displayScore = (absScore / 100).toFixed(2);
      evalText = (absScore > 0 ? "+" : "") + displayScore;

      // Update Win Rate
      updateWinRate(absScore);
    }

    if (evalText) $('#evaluation').text("Đánh giá: " + evalText);
  }
};

var moveCount = 0; // Track move count for Book detection

function determineMoveQuality(delta, prevEval) {
  // Opening Book Check (First 10 moves & good move)
  if (moveCount <= 10 && delta > -30) return 'book';

  // Missed Win: If we had big advantage (>200) and now lost it (delta < -200)
  // Or if 'bestmove' eval was mate/high positive, but current eval is 0 or negative.
  // Delta covers this: e.g. Prev +500, Current 0 -> Delta -500 -> Blunder/Miss.
  // Let's distinguish Miss from Blunder for huge swings.
  if (prevEval > 300 && delta < -300) return 'miss';

  if (delta > 200) return 'brilliant'; // Gained massive advantage
  if (delta > 50) return 'great';
  if (delta > -25) return 'best';
  if (delta > -75) return 'good';
  if (delta > -150) return 'inaccuracy';
  if (delta > -300) return 'mistake';
  return 'blunder';
}

function classifyMove(currentEvalWhite, prevEvalWhite, movedColor, targetSquare) {
  // Increment move count (approx, since this runs every move)
  if (movedColor === 'w') moveCount++;

  var delta = (movedColor === 'w') ? (currentEvalWhite - prevEvalWhite) : (prevEvalWhite - currentEvalWhite);

  var type = determineMoveQuality(delta, (movedColor === 'w' ? prevEvalWhite : -prevEvalWhite));

  var textMap = {
    'brilliant': 'THIÊN TÀI 🧠',
    'great': 'TUYỆT VỜI 🔥',
    'best': 'TỐT NHẤT ⭐',
    'good': 'TỐT ✅',
    'book': 'SÁCH GIÁO KHOA 📖',
    'inaccuracy': 'HƠI NON 😅',
    'mistake': 'SAI LẦM 🐔',
    'miss': 'BỎ LỠ ❌',
    'blunder': 'NGU HẾT PHẦN THIÊN HẠ 💀'
  };

  // Show badge for all identified types
  if (textMap[type]) {
    showMoveBadge(type, textMap[type], targetSquare);
  }
}

function updateWinRate(cp) {
  var chance = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  $('#winRateWhite').css('height', chance + '%');
}

function showMoveBadge(type, text, square) {
  var badge = $('#moveBadge');
  if (!square) return;

  // Calculate position logic for 8x8 grid
  var files = 'abcdefgh';
  var ranks = '87654321'; // From Top to Bottom

  var fileChar = square.charAt(0);
  var rankChar = square.charAt(1);

  var fileIdx = files.indexOf(fileChar);
  var rankIdx = ranks.indexOf(rankChar);

  var orientation = board.orientation();
  var leftPer, topPer;

  // 12.5% per square. Center is +6.25%
  if (orientation === 'white') {
    leftPer = (fileIdx * 12.5) + 6.25;
    topPer = (rankIdx * 12.5) + 6.25;
  } else {
    leftPer = ((7 - fileIdx) * 12.5) + 6.25;
    topPer = ((7 - rankIdx) * 12.5) + 6.25;
  }

  badge.css({
    'left': leftPer + '%',
    'top': topPer + '%'
  });

  var icon = "";
  var className = "move-badge badge-" + type;

  switch (type) {
    case 'brilliant': icon = "!!"; break;
    case 'great': icon = "!"; break;
    case 'best': icon = "★"; break;
    case 'good': icon = "✔"; break;
    case 'book': icon = "📖"; break;
    case 'inaccuracy': icon = "?"; break;
    case 'mistake': icon = "?"; break;
    case 'miss': icon = "∅"; break;
    case 'blunder': icon = "??"; break;
  }

  badge.find('.badge-icon').text(icon);
  // badge.find('.badge-text').text(text); // Hidden in CSS

  // Show insult in Status/Evaluation Box instead
  $('#evaluation').html(text + '<br><span style="font-size:0.8em; color:#aaa"></span>');

  badge.removeClass('hidden').attr('class', className + ' show');

  // Trigger Reflow for animation
  void badge[0].offsetWidth;

  setTimeout(function () {
    badge.removeClass('show').addClass('hidden');
  }, 2500);
}


function makeAIMove() {
  if (!gameSettings.isGameActive) return;

  if (gameSettings.difficulty === 'random') {
    var possibleMoves = game.moves();
    if (possibleMoves.length === 0) return;
    var randomIdx = Math.floor(Math.random() * possibleMoves.length);
    game.move(possibleMoves[randomIdx]);
    board.position(game.fen());
    checkGameOver();
    updateStatus();
    prevEval = 0;
  } else {
    // Stockfish Move
    var cmd = 'go depth 15';

    if (isMobile) {
      // Fast but Decent: Depth 12 or 1s time
      cmd = 'go depth 12'; // Depth 12 is very fast on modern phones (~200ms)
    } else {
      if (gameSettings.difficulty === 'max') cmd = 'go depth 18'; // Still strong but faster than 20
      else if (gameSettings.difficulty === 'medium') cmd = 'go depth 6';
    }

    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage(cmd);
  }
}

// --- Chess Logic ---
function onDragStart(source, piece, position, orientation) {
  if (!gameSettings.isGameActive) return false;
  if (game.game_over()) return false;

  if (gameSettings.mode === 'pvp') {
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
  }
  else {
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
    if (piece.search(/^b/) !== -1) return false;
  }
}

function onDrop(source, target) {
  var piece = game.get(source);
  if (piece && piece.type === 'p' &&
    ((piece.color === 'w' && target.charAt(1) === '8') ||
      (piece.color === 'b' && target.charAt(1) === '1'))) {

    promotionParams = { source: source, target: target };
    $('#promotionModal').css('display', 'flex');
    return 'snapback';
  }

  var move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  })

  if (move === null) return 'snapback';

  lastMoveTarget = target; // Save for badge

  updateStatus();
  checkGameOver();
  updateTimerDisplay();

  // Trigger Analysis to update Win Rate & Classification for THIS move
  // Optimize Speed: Use movetime 500ms for quick classification

  if (gameSettings.mode === 'pvp') {
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go movetime 500'); // 0.5s for PvP analysis
  }

  // Nếu là PvE
  if (gameSettings.mode === 'pve' && !game.game_over() && gameSettings.isGameActive) {
    // We rely on the Bot's search to give us the eval for the User's move.
    // Bot will search DEEP. But we can pick up the 'info' lines early?
    // Or we can just run a quick analysis BEFORE the bot starts deep thinking?
    // No, stockfish is single threaded.

    // If we want FAST badges, we might need to rely on the Bot's first few 'info' outputs.
    // Or, we force a quick search first, THEN bot thinks?
    // No, Bot needs Depth 20 for strength.

    // Compromise: for Mobile/Fast, we use lower depth overall.
    // Or we accept the badge appears when Bot finishes thinking.
    // User said "danh gia qua cham" (too slow).

    // Let's use 'movetime' for Bot too on Mobile?
    // Or, update Badge continuously as 'info' comes in?
    // YES. In stockfish.onmessage, we update WinRate. We can also update Badge if confidence is high?
    // No, Badge determines "Move Quality" which relies on comparing (Prev vs Current).
    // We can only judge AFTER we have a stable Current.

    // Optimization:
    // If on Mobile, Limit Bot Time.

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

updateStatus();

$('#flipBtn').on('click', board.flip);

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

    lastMoveTarget = promotionParams.target;

    $('#promotionModal').css('display', 'none');
    promotionParams = null;

    if (gameSettings.mode === 'pve' && !game.game_over() && gameSettings.isGameActive) {
      window.setTimeout(makeAIMove, 250);
    }
    else if (gameSettings.mode === 'pvp') {
      var pvpDepth = isMobile ? 12 : 15;
      stockfish.postMessage('position fen ' + game.fen());
      stockfish.postMessage('go depth ' + pvpDepth);
    }
  }
}
window.selectPromotion = selectPromotion;
