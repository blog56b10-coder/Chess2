const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const games = {};

function makeGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('create_game', ({ customBoard }) => {
    const gameId = makeGameId();
    games[gameId] = {
      players: [socket.id],
      turn: 'w',
      status: 'waiting',
      whiteBoard: customBoard || null,
      blackBoard: null,
    };
    socket.join(gameId);
    socket.gameId = gameId;
    socket.color = 'w';
    socket.emit('game_created', { gameId, color: 'w' });
    console.log('Game created:', gameId);
  });

  socket.on('join_game', ({ gameId, customBoard }) => {
    const game = games[gameId];
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    if (game.players.length >= 2) {
      socket.emit('error', 'Game is full');
      return;
    }

    game.players.push(socket.id);
    game.status = 'playing';
    game.blackBoard = customBoard || null;

    socket.join(gameId);
    socket.gameId = gameId;
    socket.color = 'b';
    socket.emit('game_joined', { gameId, color: 'b' });

    // Send both custom boards to both players
    io.to(gameId).emit('game_start', {
      turn: 'w',
      whiteBoard: game.whiteBoard,
      blackBoard: game.blackBoard,
    });

    console.log('Game joined:', gameId);
  });

  socket.on('move', (moveData) => {
    const gameId = socket.gameId;
    const game = games[gameId];
    if (!game) return;
    if (game.turn !== socket.color) return;
    game.turn = game.turn === 'w' ? 'b' : 'w';
    socket.to(gameId).emit('opponent_move', moveData);
    io.to(gameId).emit('turn_change', { turn: game.turn });
  });

  socket.on('disconnect', () => {
    const gameId = socket.gameId;
    if (gameId && games[gameId]) {
      io.to(gameId).emit('opponent_disconnected');
      delete games[gameId];
    }
    console.log('Player disconnected:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
