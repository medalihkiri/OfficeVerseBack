const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    email:    { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    coins: { type: Number, default: 0 },

    trelloToken: { type: String },
    trelloTokenSecret: { type: String },

    createdRooms: [{ type: Schema.Types.ObjectId, ref: 'Room' }],
    allowedRooms: [{ type: Schema.Types.ObjectId, ref: 'Room' }],
    currentRoom:  { type: Schema.Types.ObjectId, ref: 'Room', default: null },
});

module.exports = mongoose.model('User', userSchema);
