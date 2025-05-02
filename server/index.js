// Basic Express + Socket.IO setup for a public chatroom
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',  // adjust for production use
        methods: ['GET', 'POST']
    }
});

app.use(cors());

// Configure multer for uploads folder
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Static serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add support for private messaging by nickname

// Add nickname to socketId map
const nicknameMap = new Map();

let rooms = {
    'Lobby': { users: {} }
};

// Utility: broadcast user list for a room
function broadcastUsers(room) {
    const roomUsers = Object.values(rooms[room]?.users || {});
    io.to(room).emit('users', roomUsers);
}
// Utility: broadcast room names
function broadcastRooms() {
    io.emit('rooms', Object.keys(rooms));
}

io.on('connection', (socket) => {
    // Assign random nickname
    let nickname = `Guest${Math.floor(Math.random() * 10000)}`;
    let currentRoom = 'Lobby';

    // Add to Lobby on connect
    rooms['Lobby'].users[socket.id] = nickname;
    socket.join('Lobby');
    socket.emit('nickname', nickname);
    socket.emit('joined-room', 'Lobby');
    broadcastUsers('Lobby');
    broadcastRooms();

    socket.on('create-room', (room) => {
        if (!rooms[room]) {
            rooms[room] = { users: {} };
            broadcastRooms();
        }
    });

    socket.on('join-room', (room) => {
        if (!rooms[room]) return;

        // Leave previous room
        socket.leave(currentRoom);
        if (rooms[currentRoom]) {
            delete rooms[currentRoom].users[socket.id];
            broadcastUsers(currentRoom);
        }

        // Join new room
        currentRoom = room;
        rooms[room].users[socket.id] = nickname;
        socket.join(room);
        socket.emit('joined-room', room);
        broadcastUsers(room);
    });

socket.on('message', (msg) => {
    const messageObject = { user: nickname, text: msg, timestamp: new Date().toISOString() };
    io.to(currentRoom).emit('message', messageObject);
});

    socket.on('set-nickname', (name) => {
        nickname = name;
        if (rooms[currentRoom]) rooms[currentRoom].users[socket.id] = name;
        broadcastUsers(currentRoom);
    });

    socket.on('disconnect', () => {
        if (rooms[currentRoom]) {
            delete rooms[currentRoom].users[socket.id];
            broadcastUsers(currentRoom);
        }
    });
});

app.get('/', (req, res) => {
    res.send('ChatYa server running.');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
