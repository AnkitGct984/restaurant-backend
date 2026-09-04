const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('name email role isActive');
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 Socket connected: ${user.name} (${user.role}) - ${socket.id}`);

    // Join role-based rooms
    socket.join(user._id.toString());     // Personal room
    socket.join(user.role);               // Role room: 'admin', 'chef', 'waiter', 'customer'

    // Admin joins all rooms
    if (user.role === 'admin') {
      socket.join('kitchen');
      socket.join('waiter');
    }

    // Emit welcome
    socket.emit('connected', {
      message: `Welcome ${user.name}!`,
      userId: user._id,
      role: user.role
    });

    // ── Order Events ─────────────────────────────────────

    // Customer joins their order room for live tracking
    socket.on('order:track', (orderId) => {
      socket.join(`order:${orderId}`);
      console.log(`📦 ${user.name} tracking order: ${orderId}`);
    });

    socket.on('order:untrack', (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    // ── Table Events ─────────────────────────────────────

    // Waiter marks table
    socket.on('table:update', (data) => {
      io.to('admin').emit('table:updated', data);
    });

    // ── Kitchen Events ────────────────────────────────────

    // Chef requests current queue refresh
    socket.on('kitchen:requestQueue', () => {
      socket.emit('kitchen:requestRefresh');
    });

    // ── Notification Events ───────────────────────────────

    socket.on('notification:read', (notifId) => {
      socket.emit('notification:readAck', { notifId });
    });

    // ── Ping/Pong ─────────────────────────────────────────

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // ── Disconnect ────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${user.name} - Reason: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${user.name}:`, error.message);
    });
  });

  console.log('🔌 Socket.IO initialized');
  return io;
};

// Helper: emit to specific user
const emitToUser = (userId, event, data) => {
  if (io) io.to(userId.toString()).emit(event, data);
};

// Helper: emit to role
const emitToRole = (role, event, data) => {
  if (io) io.to(role).emit(event, data);
};

// Helper: broadcast
const broadcast = (event, data) => {
  if (io) io.emit(event, data);
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

module.exports = { initSocket, getIO, emitToUser, emitToRole, broadcast };
