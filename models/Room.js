const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPrivate: { type: Boolean, default: false },
  passwordHash: { type: String },
  maxPlayers: { type: Number, default: 20 },
  currentPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },

  // ✅ Room type
  type: {
    type: String,
    enum: ['casual', 'work', 'conference'],
    default: 'casual',
    required: true
  }
});

// ✅ Create model
const Room = mongoose.model('Room', RoomSchema);

// ✅ Export it correctly
module.exports = Room;
