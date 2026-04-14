const socket = io();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;
let currentTagger = null;
let gameStarted = false;
let myNickname = "Jogador";
let keys = {};

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const MAP_WIDTH = 3000;
const MAP_HEIGHT = 2000;

const hideSpots = [
  {x: 400, y: 300, w: 280, h: 200, type: 'grass'},
  {x: 1200, y: 600, w: 250, h: 180, type: 'grass'},
  {x: 2100, y: 400, w: 300, h: 220, type: 'grass'},
  {x: 800, y: 1300, w: 220, h: 190, type: 'grass'},
  {x: 600, y: 800, w: 140, h: 120, type: 'house'},
  {x: 1600, y: 1100, w: 160, h: 130, type: 'house'},
  {x: 2400, y: 800, w: 150, h: 140, type: 'house'},
  {x: 1900, y: 300, w: 130, h: 110, type: 'house'}
];

function startGame() {
  myNickname = document.getElementById('nicknameInput').value.trim() || "Jogador";
  
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  
  gameStarted = true;
  
  // Envia o nome assim que clicar em Jogar
  socket.emit('setNickname', myNickname);
}

socket.on('connect', () => {
  myId = socket.id;
});

socket.on('currentState', (data) => {
  players = data.players || {};
  currentTagger = data.currentTagger;
});

socket.on('newPlayer', (id, player) => {
  players[id] = player;
});

socket.on('playerMoved', (id, player) => {
  if (players[id]) players[id] = player;
});

socket.on('playerDisconnected', (id) => {
  delete players[id];
});

socket.on('newTagger', (id) => {
  currentTagger = id;
  const roleEl = document.getElementById('role');
  roleEl.textContent = (id === myId) ? "PEGADOR!" : "Fugitivo";
  roleEl.style.color = (id === myId) ? "#ff4444" : "#44ff88";
});

// Teclado WASD
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function update() {
  if (!gameStarted || !players[myId]) return;

  const p = players[myId];
  const speed = (currentTagger === myId) ? 7.2 : 6.3;

  if (keys['w'] || keys['arrowup']) p.y -= speed;
  if (keys['s'] || keys['arrowdown']) p.y += speed;
  if (keys['a'] || keys['arrowleft']) p.x -= speed;
  if (keys['d'] || keys['arrowright']) p.x += speed;

  p.x = Math.max(40, Math.min(3000 - 40, p.x));
  p.y = Math.max(40, Math.min(2000 - 40, p.y));

  socket.emit('playerMovement', { x: p.x, y: p.y });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!players[myId]) return;

  const me = players[myId];
  const offsetX = me.x - canvas.width / 2;
  const offsetY = me.y - canvas.height / 2;

  // Chão
  ctx.fillStyle = '#1a3a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grama
  ctx.fillStyle = '#0f2a1f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Esconderijos
  hideSpots.forEach(spot => {
    const sx = spot.x - offsetX;
    const sy = spot.y - offsetY;

    if (spot.type === 'grass') {
      ctx.fillStyle = '#1e5a3a';
      ctx.fillRect(sx, sy, spot.w, spot.h);
    } else {
      ctx.fillStyle = '#554433';
      ctx.fillRect(sx, sy, spot.w, spot.h);
      ctx.fillStyle = '#aa6644';
      ctx.fillRect(sx + 15, sy + 8, spot.w - 30, 45);
    }
  });

  // Desenhar jogadores
  Object.keys(players).forEach(id => {
    const p = players[id];
    const sx = p.x - offsetX;
    const sy = p.y - offsetY;

    const isTagger = (id === currentTagger);
    const isHiding = isInsideHideSpot(p);

    let alpha = (isHiding && !isTagger) ? 0.35 : 1.0;
    ctx.globalAlpha = alpha;

    // Corpo
    ctx.fillStyle = isTagger ? '#ff2222' : '#4488ff';
    ctx.fillRect(sx - 12, sy - 8, 24, 36);

    // Cabeça
    ctx.fillStyle = '#ffddaa';
    ctx.beginPath();
    ctx.arc(sx, sy - 26, 13, 0, Math.PI * 2);
    ctx.fill();

    // Olhos
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(sx - 5, sy - 28, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 5, sy - 28, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;

    // === NOME CORRIGIDO ===
    ctx.fillStyle = isTagger ? '#ffff00' : 'white';
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.nickname || '???', sx, sy - 52);
  });
}

function isInsideHideSpot(player) {
  for (let spot of hideSpots) {
    if (player.x > spot.x && player.x < spot.x + spot.w &&
        player.y > spot.y && player.y < spot.y + spot.h) {
      return true;
    }
  }
  return false;
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();