const express = require('express');
const OAuth = require('oauth').OAuth;
const router = express.Router();
const authenticate = require('../middleware/auth');
const User = require('../models/user');

const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_SECRET = process.env.TRELLO_SECRET;
const CALLBACK_URL = 'https://officeverseback.onrender.com/api/users/trello/callback';


const oa = new OAuth(
  'https://trello.com/1/OAuthGetRequestToken',
  'https://trello.com/1/OAuthGetAccessToken',
  TRELLO_KEY,
  TRELLO_SECRET,
  '1.0',
  CALLBACK_URL,
  'HMAC-SHA1'
);

// Start OAuth flow
router.get('/trello/start', authenticate, (req, res) => {
  oa.getOAuthRequestToken((error, token, tokenSecret) => {
    if (error) return res.status(500).json({ error });

    req.session.oauth = { token, tokenSecret, userId: req.user.userId };

    const authorizeUrl = `https://trello.com/1/OAuthAuthorizeToken?oauth_token=${token}&name=GatherApp&expiration=never&scope=read,write`;
    res.json({ url: authorizeUrl });
  });
});

// Callback URL
router.get('/trello/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const { token, tokenSecret, userId } = req.session.oauth;

  oa.getOAuthAccessToken(token, tokenSecret, oauth_verifier, async (err, accessToken, accessSecret) => {
    if (err) return res.status(500).json({ err });

    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.trelloToken = accessToken;
      user.trelloTokenSecret = accessSecret;
      await user.save();

      res.send(`<script>window.close();</script>`); // close popup from Unity
    } catch (e) {
      res.status(500).json({ e });
    }
  });
});

module.exports = router;
