const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const buildingSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  position: {
    type: [Number], // Vector 2 [x, y]
    required: true
  },
  level: {
    type: Number,
    required: true,
    default: 1
  },
  id: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Building', buildingSchema);