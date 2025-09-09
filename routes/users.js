const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user');
const authenticate = require('../middleware/auth');

// Health check
router.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Get all users (for admin/dev purposes)
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('-passwordHash');
        if (!users) return res.status(500).json({ success: false, message: 'No users found' });
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Sign out (client-side responsibility).
// Note: This endpoint doesn't invalidate the JWT, which is standard.
// The token will naturally expire. The client is responsible for deleting it.
router.post('/signout', authenticate, (req, res) => {
    res.status(200).json({ success: true, message: 'Signed out successfully. Please delete your token on client side.' });
});

// Register
router.post('/register', async (req, res) => {
    try {
        const hashedPassword = bcrypt.hashSync(req.body.password, 10);
        let user = new User({
            username: req.body.username,
            email: req.body.email,
            passwordHash: hashedPassword,
            coins: 0,
        });

        user = await user.save();

        res.status(201).send({
            success: true,
            message: 'User created successfully',
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                coins: user.coins,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


router.get('/trello/status', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Respond with a boolean indicating if the token exists
        res.json({ hasTrelloToken: !!user.trelloToken });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user || !bcrypt.compareSync(req.body.password, user.passwordHash)) {
            return res.status(400).send('Invalid email or password');
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username },
            //process.env.JWT_SECRET || 'a',
            { expiresIn: '1d' }
        );

        res.status(200).send({
            success: true,
            message: 'Logged in successfully',
            token: token,
            userId: user._id.toString(),
            username: user.username,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Authenticated User Info
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .populate('createdRooms', 'name')
            .populate('allowedRooms', 'name')
            .populate('currentRoom', 'name');

        if (!user) return res.status(404).send('User not found');

        res.status(200).json({
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            coins: user.coins,
            createdRooms: user.createdRooms,
            allowedRooms: user.allowedRooms,
            currentRoom: user.currentRoom,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// [REMOVED] The '/rooms' endpoint was removed to avoid duplication.
// The corrected and more comprehensive logic is now in `roomRoutes.js` at the `/rooms/user` endpoint.

// Get Coins
router.get('/coins/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).send('User not found');

        res.status(200).send({ success: true, coins: user.coins });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update Coins (🔒 secure with auth if needed)
router.post('/coins/:username', authenticate, async (req, res) => {
    const { coinsChange } = req.body;

    if (coinsChange === undefined || typeof coinsChange !== 'number') {
        return res.status(400).json({ success: false, error: 'coinsChange (number) is required' });
    }

    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        user.coins += coinsChange;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'User coins updated successfully',
            coins: user.coins,
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Internal server error', details: err.message });
    }
});

module.exports = router;