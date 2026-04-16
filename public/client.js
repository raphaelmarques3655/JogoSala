const socket = io();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;
let currentTagger = null; // Polícia
let gameStarted = false;
let myNickname = "Jogador";
let keys = {};

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const MAP_WIDTH = 3400;
const MAP_HEIGHT = 2400;

const obstacles = [
  {x: 250, y: 180, w: 200, h: 320},
  {x: 750, y: 120, w: 170, h: 380},
  {x: 1350, y: 250, w: 220, h: 280},
  {x: 2150, y: 150, w: 190, h: 340},
  {x: 2800, y: 300, w: 180, h: 260},
  {x: 500, y: 850, w: 150, h: 170},
  {x: 1100, y: 1050, w: 140, h: 160},
  {x: 1850, y: 950, w: 160, h: 180},
  {x: 2550, y: 1200, w: 145, h: 155},
  {x: 380, y: 1450, w: 240, h: 200}
];

function startGame() {
  myNickname = document.getElementById('nicknameInput').value.trim() || "Jogador";
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  gameStarted = true;
  socket.emit('setNickname', myNickname);
}

socket.on('connect', () => { myId = socket.id; });

socket.on('currentState', (data) => {
  players = data.players || {};
  currentTagger = data.currentTagger;
});

socket.on('newPlayer', (id, player) => { players[id] = player; });
socket.on('playerMoved', (id, player) => { 
  if (players[id]) players[id] = player; 
});
socket.on('playerDisconnected', (id) => { delete players[id]; });

socket.on('newTagger', (id) => {
  currentTagger = id;
  const roleEl = document.getElementById('role');
  roleEl.textContent = (id === myId) ? "POLÍCIA 👮" : "LADRÃO";
  roleEl.style.color = (id === myId) ? "#00ccff" : "#ffaa00";
});

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function update() {
  if (!gameStarted || !players[myId]) return;

  const p = players[myId];
  
  // Velocidade diminuída (como você pediu)
  const speed = (currentTagger === myId) ? 5.2 : 4.8;   // Polícia um pouco mais rápida

  if (keys['w'] || keys['arrowup']) p.y -= speed;
  if (keys['s'] || keys['arrowdown']) p.y += speed;
  if (keys['a'] || keys['arrowleft']) p.x -= speed;
  if (keys['d'] || keys['arrowright']) p.x += speed;

  // Colisão com prédios
  let canMoveX = true, canMoveY = true;
  const newX = p.x + (keys['a'] || keys['arrowleft'] ? -speed : keys['d'] || keys['arrowright'] ? speed : 0);
  const newY = p.y + (keys['w'] || keys['arrowup'] ? -speed : keys['s'] || keys['arrowdown'] ? speed : 0);

  if (isColliding(newX, p.y)) canMoveX = false;
  if (isColliding(p.x, newY)) canMoveY = false;

  if (canMoveX) p.x = Math.max(60, Math.min(MAP_WIDTH - 60, newX));
  if (canMoveY) p.y = Math.max(60, Math.min(MAP_HEIGHT - 60, newY));

  socket.emit('playerMovement', { x: p.x, y: p.y });
}

function isColliding(x, y) {
  for (let obs of obstacles) {
    if (x + 18 > obs.x && x - 18 < obs.x + obs.w &&
        y + 25 > obs.y && y - 25 < obs.y + obs.h) {
      return true;
    }
  }
  return false;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!players[myId]) return;

  const me = players[myId];
  const offsetX = me.x - canvas.width / 2;
  const offsetY = me.y - canvas.height / 2;

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Ruas
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 80;
  ctx.beginPath();
  ctx.moveTo(0 - offsetX, 1150 - offsetY);
  ctx.lineTo(MAP_WIDTH - offsetX, 1150 - offsetY);
  ctx.stroke();

  // Prédios
  obstacles.forEach(obs => {
    const sx = obs.x - offsetX;
    const sy = obs.y - offsetY;
    ctx.fillStyle = obs.color || '#2c3e50';
    ctx.fillRect(sx, sy, obs.w, obs.h);
  });

  // Jogadores
  Object.keys(players).forEach(id => {
    const p = players[id];
    const sx = p.x - offsetX;
    const sy = p.y - offsetY;

    const isPolice = (id === currentTagger);

    if (isPolice) {
      ctx.fillStyle = '#003366';
      ctx.fillRect(sx - 14, sy - 15, 28, 46);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 14, sy - 10, 28, 15);
    } else {
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(sx - 13, sy - 13, 26, 42);
    }

    ctx.fillStyle = '#ffddaa';
    ctx.beginPath();
    ctx.arc(sx, sy - 30, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isPolice ? '#00eeff' : 'white';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.nickname, sx, sy - 60);
  });
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();