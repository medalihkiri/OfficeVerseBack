const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const Room = require('../models/Room');
const User = require('../models/user');
const authenticate = require('../middleware/auth'); // Your existing auth middleware
const Message = require('../models/Message');

const mongoose = require('mongoose');

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

    const query = { room: roomId,
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
    const { roomId } = req.params;
    const { messageId, senderId, senderName, text, createdAt, recipientId, isPrivate } = req.body;
    
     // Validate the roomId to ensure it's a valid ObjectId format.
    if (!mongoose.Types.ObjectId.isValid(roomIdString)) {
        return res.status(400).json({ success: false, error: 'Invalid Room ID format.' });
    }
    
    //const roomId = mongoose.Types.ObjectId(roomIdString); // Convert string to ObjectId
    //let senderId = null;
    if (!messageId || !senderId || !senderName || !text) {
      return res.status(400).json({ success: false, error: 'messageId, senderName and text are required' });
    }

    if (req.user && req.user.userId) senderId = req.user.userId;
    //const senderId  req.user.userId;
    const doc = await Message.findOneAndUpdate(
      { messageId },
      {
        $setOnInsert: {
          messageId,
          room: roomId,
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

// Join a room with intelligent password handling
router.post('/:roomId/join', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    const { roomId } = req.params;
    const { userId } = req.user;

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    // --- NEW LOGIC ---
    // If the room is private, we need to authorize the user.
    if (room.isPrivate) {
      const user = await User.findById(userId);
      // Check if user is already in the allowed list for this room.
      const isAlreadyAllowed = user.allowedRooms.map(id => id.toString()).includes(roomId);

      // If they are already allowed, skip the password check entirely.
      if (isAlreadyAllowed) {
        console.log(`User ${userId} already has access to room ${roomId}. Bypassing password check.`);
      } 
      // If they are not yet allowed, they MUST provide the correct password.
      else {
        if (!password) {
          return res.status(401).json({ success: false, error: 'Password required' });
        }
        const isMatch = await bcrypt.compare(password, room.passwordHash);
        if (!isMatch) {
          return res.status(401).json({ success: false, error: 'Invalid password' });
        }
      }
    }

    // If we've reached this point, the user is authorized (either by password or pre-existing permission).
    // Add the room to their personal list to ensure it's there for future re-joins.
    await User.findByIdAndUpdate(userId, {
        $addToSet: { allowedRooms: room._id } 
    });

    res.status(200).json({ success: true, room, message: 'Successfully joined room.' });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ... (The rest of the file, /user, /find, /, /leave, remains unchanged)
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

// Get all public rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({ isPrivate: false });
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