
// --- Biến Toàn Cục & Cấu Hình ---
var board = null
var game = new Chess()
var $status = $('#status')
var $pgn = $('#pgn')

// Timer Variables
var timeWhite = 0;
var timeBlack = 0;
var timerInterval = null;

// Game Settings (Lưu trạng thái cài đặt)
var gameSettings = {
  mode: 'pve', // 'pve' or 'pvp'
  difficulty: 'hard', // 'random', 'medium', 'hard'
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
stockfish.onmessage = function (event) {
  if (event.data && event.data.startsWith('bestmove')) {
    var bestMove = event.data.split(' ')[1];
    game.move({ from: bestMove.substring(0, 2), to: bestMove.substring(2, 4), promotion: bestMove.substring(4, 5) || 'q' });
    board.position(game.fen());
    checkGameOver();
    updateStatus();
  }
};

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
  } else {
    // Stockfish Move
    var depth = (gameSettings.difficulty === 'medium') ? 5 : 15;
    // updateStatus('AI đang nghĩ...'); // Optional: updateStatus overwrites this anyway
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
    // Chỉ cho cầm quân Trắng (hoặc theo lượt nếu muốn nâng cao)
    // Mặc định người chơi là Trắng
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
    // Chặn kéo quân của Bot
    if (piece.search(/^b/) !== -1) return false;
  }
}

function onDrop(source, target) {
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  })

  if (move === null) return 'snapback';

  updateStatus();
  checkGameOver();
  updateTimerDisplay(); // Switch active timer immediately

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
