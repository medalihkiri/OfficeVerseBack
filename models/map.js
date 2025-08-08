const mongoose = require('mongoose');

const buildingSchema = require('./building')
const Schema = mongoose.Schema;

const mapSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  terrainType: {
    type: String,
    enum: ['forest', 'desert', 'mountain', 'grassland','mixed'], // Example terrain types
    required: true
  },
  resources: [{
    type: String // Example of resources present in the map
  }],
  buildings: [{
    type: Schema.Types.ObjectId,
    ref: 'Building'
  }] 
  // Add other properties for the map if needed
});

module.exports = mongoose.model('Map', mapSchema);