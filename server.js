const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const players = {};
let currentTagger = null;

io.on('connection', (socket) => {
  console.log('✅ Jogador conectado:', socket.id);

  players[socket.id] = {
    x: 500 + Math.random() * 600,
    y: 500 + Math.random() * 400,
    size: 22,
    nickname: "Jogador",
    color: "#4488ff"
  };

  // === PRIMEIRO JOGADOR VIRA PEGADOR ===
  if (!currentTagger) {
    currentTagger = socket.id;
    players[socket.id].color = "#ff2222";
    console.log("👑 Primeiro pegador definido:", socket.id);
  }

  // Envia estado completo para o novo jogador
  socket.emit('currentState', { 
    players: players, 
    currentTagger: currentTagger 
  });

  // Avisa os outros sobre o novo jogador
  socket.broadcast.emit('newPlayer', socket.id, players[socket.id]);

  socket.on('setNickname', (name) => {
    if (players[socket.id]) {
      players[socket.id].nickname = name;
      io.emit('playerMoved', socket.id, players[socket.id]); // força atualização visual
    }
  });

  socket.on('playerMovement', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;

      // Verifica colisão se for o pegador
      if (socket.id === currentTagger) {
        checkCollisions(socket.id);
      }

      io.emit('playerMoved', socket.id, players[socket.id]);
    }
  });

  socket.on('disconnect', () => {
    const wasTagger = currentTagger === socket.id;
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);

    // Se o pegador saiu, escolhe outro
    if (wasTagger && Object.keys(players).length > 0) {
      const ids = Object.keys(players);
      currentTagger = ids[Math.floor(Math.random() * ids.length)];
      players[currentTagger].color = "#ff2222";
      io.emit('newTagger', currentTagger);
      console.log("Novo pegador (desconexão):", currentTagger);
    }
  });
});

// Verifica se o pegador tocou alguém
function checkCollisions(taggerId) {
  const tagger = players[taggerId];
  if (!tagger) return;

  Object.keys(players).forEach(id => {
    if (id === taggerId) return;

    const other = players[id];
    const dist = Math.hypot(tagger.x - other.x, tagger.y - other.y);

    if (dist < 38) {   // distância para pegar
      // Troca o pegador
      tagger.color = "#4488ff";
      currentTagger = id;
      other.color = "#ff2222";

      io.emit('newTagger', currentTagger);
      console.log(`🔄 Pegador trocado! Novo: ${id}`);
    }
  });
}

server.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Servidor rodando → http://localhost:3000');
  console.log('O primeiro jogador que entrar será o Pegador!');
});