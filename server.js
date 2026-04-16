require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.log('Erro MongoDB:', err));

// Schema do Usuário
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  winsAsPolice: { type: Number, default: 0 },
  winsAsThief: { type: Number, default: 0 },
  totalGames: { type: Number, default: 0 }
});

const User = mongoose.model('User', userSchema);

// Rotas de Autenticação
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ username, password: hashedPassword });
    await user.save();

    res.json({ success: true, message: "Conta criada com sucesso!" });
  } catch (err) {
    res.json({ success: false, message: "Usuário já existe" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.json({ success: false, message: "Usuário ou senha incorretos" });
    }

    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.json({ success: true, token, username });
  } catch (err) {
    res.json({ success: false, message: "Erro no login" });
  }
});

// Servir as páginas
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/lobby.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lobby.html')));
app.get('/game.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));

const players = {};
let currentTagger = null;

// Socket.io - Jogo
io.on('connection', (socket) => {
  console.log('Jogador conectado:', socket.id);

  socket.on('joinGame', (username) => {
    players[socket.id] = {
      username: username,
      x: 600 + Math.random() * 1000,
      y: 600 + Math.random() * 500
    };

    if (!currentTagger) currentTagger = socket.id;

    socket.emit('currentState', { players, currentTagger });
    socket.broadcast.emit('newPlayer', socket.id, players[socket.id]);
  });

  socket.on('playerMovement', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;

      if (socket.id === currentTagger) {
        checkTagCollision(socket.id);
      }

      io.emit('playerMoved', socket.id, players[socket.id]);
    }
  });

  socket.on('disconnect', () => {
    if (currentTagger === socket.id && Object.keys(players).length > 1) {
      const ids = Object.keys(players).filter(id => id !== socket.id);
      currentTagger = ids[Math.floor(Math.random() * ids.length)];
      io.emit('newTagger', currentTagger);
    }
    delete players[socket.id];
  });
});

function checkTagCollision(taggerId) {
  const tagger = players[taggerId];
  Object.keys(players).forEach(id => {
    if (id === taggerId) return;
    const dist = Math.hypot(tagger.x - players[id].x, tagger.y - players[id].y);
    if (dist < 45) {
      currentTagger = id;
      io.emit('newTagger', currentTagger);
    }
  });
}

server.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Servidor rodando em http://localhost:3000`);
});