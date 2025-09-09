// models/Message.js

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', index: true }, 
  senderId: { type: String, index: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true, maxlength: 5000 },
  createdAt: { type: Date, default: Date.now, index: true },
  isPrivate: { type: Boolean, default: false, index: true },
  recipientId: { type: String, default: null, index: true },
}, { versionKey: false });

MessageSchema.index({ room: 1, createdAt: -1 });

// --- MODIFICATION START ---
// Add a compound index for efficient two-way private message lookups.
MessageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
// --- MODIFICATION END ---


module.exports = mongoose.model('Message', MessageSchema);