const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const Room = require('../models/Room');
const User = require('../models/user');
const authenticate = require('../middleware/auth'); // Your existing auth middleware
const Message = require('../models/Message');

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // Added for optional authentication

// Create a new room (Strictly for authenticated users)
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, isPrivate, password, maxPlayers, type = 'casual' } = req.body;

    // ... (rest of the create logic is unchanged)
    if (!['casual', 'work', 'conference'].includes(type)) {
      return res.status(400).json({ success: false, error: "Invalid room type." });
    }

    const maxLimits = { casual: 10, work: 50, conference: 200 };
    const finalMaxPlayers = Math.min(maxPlayers || maxLimits[type], maxLimits[type]);

    const roomData = { name, createdBy: req.user.userId, isPrivate, maxPlayers: finalMaxPlayers, type };

    if (isPrivate && password) {
      roomData.passwordHash = bcrypt.hashSync(password, 10);
    }

    const room = new Room(roomData);
    await room.save();

    // Automatically add the creator to the allowed rooms list.
    await User.findByIdAndUpdate(req.user.userId, {
      $addToSet: { createdRooms: room._id, allowedRooms: room._id }
    });

    res.status(201).json({ success: true, room });
  } catch (err) {
    if (err.code === 11000) {
        return res.status(409).json({ success: false, error: 'A room with this name already exists.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get recent messages for a room (latest-first, paginated)
router.get('/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const before = req.query.before ? new Date(req.query.before) : null;

    // CORRECTED: This query now explicitly filters for non-private messages.
    const query = {
      room: roomId,
      isPrivate: { $ne: true }
    };
    if (before) query.createdAt = { $lt: before };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })   // latest first (matches your UI “newest at top”)
      .limit(limit)
      .lean();

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Post a message (idempotent via messageId)
router.post('/:roomId/messages', authenticate, async (req, res) => {
  try {
    const { roomId: roomIdString } = req.params;
    const { messageId, senderId, senderName, text, createdAt, recipientId, isPrivate } = req.body;
    
     // Validate the roomId to ensure it's a valid ObjectId format.
    if (!mongoose.Types.ObjectId.isValid(roomIdString)) {
        return res.status(400).json({ success: false, error: 'Invalid Room ID format.' });
    }
    
    //const roomId = mongoose.Types.ObjectId(roomIdString); // Convert string to ObjectId
    //let senderId = null;
    if (!messageId || !senderId || !senderName || !text) {
      return res.status(400).json({ success: false, error: 'messageId, senderId, senderName and text are required' });
    }

    //if (req.user && req.user.userId) senderId = req.user.userId;
    //const senderId  req.user.userId;
    const doc = await Message.findOneAndUpdate(
      { messageId },
      {
        $setOnInsert: {
          messageId,
          room: mongoose.Types.ObjectId(roomIdString),
          senderId,
          senderName,
          text,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          isPrivate: !!isPrivate,
          recipientId: recipientId || null
        }
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, message: doc });
  } catch (err) {
    //res.status(500).json({ success: false, error: err.message });
    console.error(`[ERROR] Failed to save message:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Join a room - now accessible by guests
router.post('/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    // If a user is logged in (i.e., provides a valid token), add the room to their allowed list.
    // Guests will skip this block and join without any user-specific action.
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'a');
        if (decoded && decoded.userId) {
          await User.findByIdAndUpdate(decoded.userId, {
            $addToSet: { allowedRooms: room._id }
          });
        }
      } catch (err) {
        // Token is invalid or expired, so we treat the user as a guest.
        console.log("Join attempt with invalid token:", err.message);
      }
    }
    
    res.status(200).json({ success: true, room, message: 'Successfully joined room.' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ... (The rest of the file, /user, /find, /leave, etc., remains unchanged)
// Get all rooms a user has created OR is allowed in
router.get('/user', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
        .populate('allowedRooms')
        .populate('createdRooms');

    if (!user) return res.status(404).json({ error: "User not found" });

    const roomMap = new Map();
    user.createdRooms.forEach(room => roomMap.set(room._id.toString(), room));
    user.allowedRooms.forEach(room => roomMap.set(room._id.toString(), room));
    
    const rooms = Array.from(roomMap.values());

    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Fetch private conversation between two users
router.get('/private/:userA/:userB', async (req, res) => {
  try {
    const { userA, userB } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const before = req.query.before ? new Date(req.query.before) : null;

    const query = {
      isPrivate: true,
      $or: [
         { $and: [{ senderId: userA }, { recipientId: userB }] },
        { $and: [{ senderId: userB }, { recipientId: userA }] }
      ]
    };
    if (before) query.createdAt = { $lt: before };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, messages });
  } catch (err) {
    console.error(`[ERROR] Failed to load private messages between ${req.params.userA} and ${req.params.userB}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Find a room by name (Publicly accessible)
router.get('/find/:name', async (req, res) => {
  try {
    const name = req.params.name.trim();
    const room = await Room.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all rooms, including private ones
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json({ success: true, rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave a room
router.post('/:roomId/leave', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const room = await Room.findById(req.params.roomId);

    if (!room) return res.status(404).json({ error: "Room not found" });

    await User.findByIdAndUpdate(userId, {
      $pull: { allowedRooms: room._id }
    });

    res.json({ success: true, message: "Left room successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;