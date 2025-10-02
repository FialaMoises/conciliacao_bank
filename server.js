const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Armazenar clientes conectados
let connectedClients = 0;

// Quando frontend conecta via WebSocket
io.on('connection', (socket) => {
    connectedClients++;
    console.log(`📱 Frontend conectado! Total: ${connectedClients}`);

    socket.on('disconnect', () => {
        connectedClients--;
        console.log(`📱 Frontend desconectado. Total: ${connectedClients}`);
    });
});

// Endpoint para receber updates do backend Python
app.post('/api/progress-update', (req, res) => {
    const progressData = req.body;

    console.log(`📊 Update recebido: ${progressData.current}/${progressData.total} - ${progressData.category} - R$ ${progressData.value}`);

    // Propagar para todos os frontends conectados
    io.emit('progress-update', progressData);

    res.json({ success: true, clients_notified: connectedClients });
});

// Endpoint para reset/início de nova conciliação
app.post('/api/reset', (req, res) => {
    console.log('🔄 Reset solicitado');
    io.emit('reset');
    res.json({ success: true });
});

// Endpoint de status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        connected_clients: connectedClients,
        timestamp: new Date().toISOString()
    });
});

// Servir index.html na raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Frontend Server rodando na porta ${PORT}`);
    console.log(`📡 WebSocket pronto para receber updates do backend`);
    console.log(`🔗 Backend deve enviar POSTs para: http://localhost:${PORT}/api/progress-update`);
});
