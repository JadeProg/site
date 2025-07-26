const winningCombos = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

let board = Array(9).fill(0);
let aiMoves = JSON.parse(localStorage.getItem("knn_dataset")) || [];
let progressHistory = JSON.parse(localStorage.getItem("knn_progresso")) || [];
let chartInstance = null;
let movesThisGame = 0;
let learningLevel = 0;
let aiMovesThisGame = [];
let isPlayerTurn = true; // <-- CONTROLE DE TURNO ADICIONADO

function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}

function checkThreat(board, player) {
  for (const combo of winningCombos) {
    const values = combo.map((i) => board[i]);
    const empty = combo.filter((i) => board[i] === 0);
    if (values.filter((v) => v === player).length === 2 && empty.length === 1) {
      return empty[0];
    }
  }
  return null;
}

/**
 * LÓGICA DA IA ATUALIZADA
 * Adiciona uma tática de abertura específica contra jogadas no centro.
 */
function getBestMove(board, k = 3) {
  // --- Estratégia "Perfeita" e Adaptativa (quando learningLevel >= 100) ---
  if (learningLevel >= 100) {
    // 1. Vencer: Prioridade máxima e inegociável.
    const winMove = checkThreat(board, -1);
    if (winMove !== null) return winMove;

    // 2. Bloquear: Segunda maior prioridade. Essencial para não perder.
    const blockMove = checkThreat(board, 1);
    if (blockMove !== null) return blockMove;

    // Define constantes para clareza na lógica estratégica
    const corners = [0, 2, 6, 8];
    const sides = [1, 3, 5, 7];
    const movesMade = board.filter(cell => cell !== 0).length;

    // 3. NOVA TÁTICA DE ABERTURA: Responder ao oponente começando no centro.
    // Se for a primeira jogada da IA (total de 1 jogada no tabuleiro) e o oponente pegou o centro,
    // a IA joga em um canto para começar a "encurralar" e controlar o jogo.
    if (movesMade === 1 && board[4] === 1) {
      const availableCorners = corners.filter(i => board[i] === 0);
      return availableCorners[Math.floor(Math.random() * availableCorners.length)];
    }

    // 4. Centro: Se a tática acima não se aplica e o centro está livre, a IA o pega.
    if (board[4] === 0) return 4;

    // 5. TÁTICA DE CONTRA-ATAQUE: Responder a jogadas de canto do oponente.
    // Se o oponente tenta uma armadilha com 2 cantos, a IA reage jogando nos lados.
    const opponentCornersCount = corners.filter(i => board[i] === 1).length;
    if (opponentCornersCount >= 2) {
      const availableSides = sides.filter(i => board[i] === 0);
      if (availableSides.length > 0) {
        return availableSides[Math.floor(Math.random() * availableSides.length)];
      }
    }

    // 6. ESTRATÉGIA PADRÃO: Priorizar os cantos, que são as posições mais fortes.
    const availableCorners = corners.filter(i => board[i] === 0);
    if (availableCorners.length > 0) {
      return availableCorners[Math.floor(Math.random() * availableCorners.length)];
    }

    // 7. ÚLTIMO RECURSO: Jogar nos lados restantes.
    const availableSides = sides.filter(i => board[i] === 0);
    if (availableSides.length > 0) {
      return availableSides[Math.floor(Math.random() * availableSides.length)];
    }
  }

  // --- Lógica de Aprendizado (KNN para < 100%) ---
  // Esta parte continua a mesma.
  if (aiMoves.length >= 5) {
    const block = checkThreat(board, 1);
    if (block !== null) return block;
  }

  if (aiMoves.length < 5) {
    const empty = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i !== -1);
    return empty[Math.floor(Math.random() * empty.length)];
  }

  const distances = aiMoves.map((data, i) => ({
    index: i,
    distance: euclideanDistance(board, data.board),
  })).sort((a, b) => a.distance - b.distance);

  const neighbors = distances.slice(0, k)
    .map((n) => aiMoves[n.index].move)
    .filter((m) => board[m] === 0);

  if (neighbors.length === 0) {
    const empty = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i !== -1);
    return empty[Math.floor(Math.random() * empty.length)];
  }

  const counts = neighbors.reduce((acc, move) => {
    acc[move] = (acc[move] || 0) + 1;
    return acc;
  }, {});

  return parseInt(Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b)));
}


function updateProgress() {
  learningLevel = Math.min(100, Math.round((aiMoves.length / 20) * 100));

  const movesOfLastGame = aiMoves.slice(-movesThisGame);
  const knnMovesCount = movesOfLastGame.filter((j) => j.viaKNN).length;

  if (movesThisGame > 0) {
    progressHistory.push({
      learningLevel: learningLevel,
      moves: movesThisGame,
      knnMovesCount: knnMovesCount,
      aiMoves: [...aiMovesThisGame],
    });
  }

  localStorage.setItem("knn_dataset", JSON.stringify(aiMoves));
  localStorage.setItem("knn_progresso", JSON.stringify(progressHistory));

  const bar = document.getElementById('intelligenceBar');
  bar.style.width = learningLevel + '%';
  bar.textContent = learningLevel + '%';

  const feedback = document.getElementById('message');
  if (learningLevel < 30) {
    feedback.textContent = "Vovó é leiga.";
  } else if (learningLevel < 50) {
    feedback.textContent = "Vovó está começando a entender seus padrões...";
  } else if (learningLevel < 75) {
    feedback.textContent = "Ela já consegue antecipar seus movimentos.";
  } else if (learningLevel < 100) {
    feedback.textContent = "Quase uma profissional!";
  } else {
    feedback.textContent = "Duvido você ganhar...";
  }
}

// =========================================================
// FUNÇÃO makeMove TOTALMENTE ATUALIZADA
// =========================================================
function makeMove(index) {
  // Se não for a vez do jogador ou a casa já estiver ocupada, não faz nada.
  if (!isPlayerTurn || board[index] !== 0) return;

  isPlayerTurn = false; // Trava o tabuleiro para o jogador
  board[index] = 1;
  renderBoard();
  hideEndElements();
  scrollToBoard();

  if (checkWin(1)) {
    endGame('Você venceu!');
    return; // Encerra a função aqui se o jogador vencer
  }
  if (board.every((v) => v !== 0)) {
    endGame('Empate!');
    return; // Encerra a função aqui se der empate
  }

  setTimeout(() => {
    const wasViaKnn = aiMoves.length >= 5;
    const move = getBestMove(board);
    board[move] = -1;
    aiMoves.push({ board: [...board], move, viaKNN: wasViaKnn });
    aiMovesThisGame.push(move);
    movesThisGame++;
    updateProgress();
    renderBoard();

    if (checkWin(-1)) return endGame('Vovó venceu!');
    if (board.every((v) => v !== 0)) return endGame('Empate!');
    
    // Se o jogo continuar, devolve a vez para o jogador
    isPlayerTurn = true;
  }, 500);
}

function checkWin(player) {
  return winningCombos.some((combo) => combo.every((i) => board[i] === player));
}

function scrollToButton() {
  const playButton = document.getElementById('resetBtn');
  if (playButton) {
    setTimeout(() => {
      playButton.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 100);
  }
}

function scrollToBoard() {
  const boardElement = document.getElementById('board');
  if (boardElement) {
    boardElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}

function endGame(message) {
  document.getElementById('message').textContent = message;
  document.querySelectorAll('.cell').forEach((cell) => (cell.onclick = null));
  document.getElementById('resetBtn').style.display = 'inline-block';
  document.getElementById('resetLearningBtn').style.display = 'inline-block';
  document.getElementById('toggleChart').style.display = 'block';

  const statsText = document.getElementById('statsText');
  if (statsText) {
    statsText.style.display = 'block';
  }

  renderChart();
  movesThisGame = 0;

  const aiMascot = document.getElementById('velhinha');
  if (message.includes("Você venceu!")) {
    aiMascot.src = "img/velhinhaperde.png";
  } else if (message.includes("Vovó venceu!")) {
    aiMascot.src = "img/velhinhaganha.png";
  } else {
    aiMascot.src = "img/velhinha.png";
  }

  scrollToButton();
}

// =========================================================
// FUNÇÃO resetGame ATUALIZADA
// =========================================================
function resetGame() {
  board = Array(9).fill(0);
  movesThisGame = 0;
  aiMovesThisGame = [];
  isPlayerTurn = true; // Garante que o jogador pode começar

  document.getElementById('message').textContent = "Faça sua jogada.";
  document.getElementById('velhinha').src = "img/velhinha.png";
  document.getElementById('chartContainer').classList.remove('show');
  document.getElementById('toggleChart').style.display = 'none';
  document.getElementById('resetBtn').style.display = 'none';

  const statsText = document.getElementById('statsText');
  if (statsText) {
    statsText.style.display = 'none';
  }

  renderBoard();
  scrollToBoard();
}

function resetLearning() {
  localStorage.removeItem("knn_dataset");
  localStorage.removeItem("knn_progresso");
  aiMoves = [];
  progressHistory = [];
  learningLevel = 0;
  updateProgress();
  renderChart();
  resetGame();

  document.getElementById('message').textContent = "Memória da Vovó reiniciada. Uma nova aluna!";
}

function toggleChartVisibility() {
  const chart = document.getElementById('chartContainer');
  const arrow = document.getElementById('arrowIcon');
  const isOpen = chart.classList.contains('show');

  if (isOpen) {
    chart.classList.remove('show');
    arrow.classList.remove('rotated');
    arrow.textContent = '▼';
  } else {
    chart.classList.add('show');
    arrow.classList.add('rotated');
    arrow.textContent = '▲';
    setTimeout(() => {
      chart.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }
}

function hideEndElements() {
  document.getElementById('resetBtn').style.display = 'none';
  document.getElementById('toggleChart').style.display = 'none';
  document.getElementById('chartContainer').classList.remove('show');
}

function renderChart() {
  const ctx = document.getElementById('chartIA').getContext('2d');
  if (chartInstance !== null) {
    chartInstance.destroy();
  }

  const chartLabels = progressHistory.map((_, i) => `Partida ${i + 1}`);
  const learningData = progressHistory.map((entry) => entry.learningLevel);
  const datasetSizeData = progressHistory.map((_, i) => Math.min(i + 1, aiMoves.length));
  const knnMovesData = progressHistory.map((entry) => entry.knnMovesCount || 0);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: 'Evolução da IA (%)',
          data: learningData,
          borderColor: '#00da91ff',
          backgroundColor: 'rgba(127, 255, 212, 0.2)',
          tension: 0.2,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Tamanho do dataset KNN',
          data: datasetSizeData,
          borderColor: '#ffa07a',
          backgroundColor: 'rgba(255, 160, 122, 0.2)',
          tension: 0.3,
          fill: false,
          yAxisID: 'y2'
        },
        {
          label: 'Jogadas feitas via KNN',
          data: knnMovesData,
          borderColor: '#87cefa',
          backgroundColor: 'rgba(135, 206, 250, 0.2)',
          tension: 0.3,
          fill: false,
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const gameEntry = progressHistory[context.dataIndex];
              if (context.dataset.label === 'Evolução da IA (%)') {
                return `Aprendizado: ${gameEntry.learningLevel}% | Jogadas conhecidas: ${gameEntry.moves}`;
              } else if (context.dataset.label === 'Jogadas feitas via KNN') {
                return `Jogadas via KNN: ${gameEntry.knnMovesCount || 0}`;
              } else {
                const moves = gameEntry.aiMoves ? gameEntry.aiMoves.join(', ') : '-';
                return `Casas jogadas pela IA: ${moves}`;
              }
            }
          }
        },
        legend: { labels: { color: '#000' } }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: 'Aprendizado (%)' },
          ticks: { color: '#049c69ff' }
        },
        y2: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Jogadas' },
          ticks: { color: '#ff7f4cff' }
        },
        x: {
          ticks: { display: false },
          grid: { display: false },
          title: { display: false }
        }
      }
    }
  });

  if (!document.getElementById('explicacaoKNN')) {
    const explanation = document.createElement('p');
    explanation.id = 'explicacaoKNN';
    explanation.style.textAlign = 'center';
    explanation.style.color = '#000';
    explanation.style.marginTop = '10px';
    explanation.textContent = 'A IA usa KNN para prever seus próximos movimentos. Quanto mais partidas ela joga, mais dados ela tem para melhorar suas decisões.';
    document.getElementById('chartContainer').appendChild(explanation);
  }
}

function renderBoard() {
  const container = document.getElementById('board');
  container.innerHTML = '';
  board.forEach((v, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.textContent = v === 1 ? 'X' : v === -1 ? 'O' : '';
    cell.onclick = () => makeMove(i);
    container.appendChild(cell);
  });
}

window.onload = () => {
  renderBoard();
  updateProgress();
  hideEndElements();
  document.getElementById('message').textContent = "Que tal uma partida?";
};