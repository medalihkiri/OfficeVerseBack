const express = require('express');
const router = express.Router();
const Map = require('../models/map');
const Building = require('../models/building');

router.post('/', async (req, res) => {
  try {
    const map = new Map({
      name: req.body.name,
      terrainType: req.body.terrainType,
      resources: req.body.resources
    });
    const savedMap = await map.save();
    res.status(201).json(savedMap);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:mapId/buildings', async (req, res) => {
  try {
    const map = await Map.findById(req.params.mapId);
    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }
    const building = new Building({
      name: req.body.name,
      position: req.body.position,
      level: req.body.level,
      id: req.body.id
    });
    map.buildings.push(building);
    await map.save();
    res.status(201).json(building);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:mapId/buildings', async (req, res) => {
  try {
    const map = await Map.findById(req.params.mapId);
    if (!map) {
      return res.status(404).json({ message: 'Map not found' });
    }
    res.json(map.buildings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const maps = await Map.find();
    res.json(maps);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', getMap, (req, res) => {
  res.json(res.map);
});

router.put('/:id', getMap, async (req, res) => {
  if (req.body.name != null) {
    res.map.name = req.body.name;
  }
  if (req.body.terrainType != null) {
    res.map.terrainType = req.body.terrainType;
  }
  if (req.body.resources != null) {
    res.map.resources = req.body.resources;
  }
  try {
    const updatedMap = await res.map.save();
    res.json(updatedMap);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', getMap, async (req, res) => {
  try {
    await res.map.remove();
    res.json({ message: 'Map deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function getMap(req, res, next) {
  let map;
  try {
    map = await Map.findById(req.params.id);
    if (map == null) {
      return res.status(404).json({ message: 'Map not found' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  res.map = map;
  next();
}

module.exports = router;
