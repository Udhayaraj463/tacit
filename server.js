const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'sync-db.json');

// Allow the React Native app to communicate with this server and upload large images
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Memory state
let sharedMochiState = {
  venues: null,
  wallpapers: {},
  cards: null,
  updatedAt: 0,
};

// Load saved data on startup
if (fs.existsSync(DB_FILE)) {
  try {
    sharedMochiState = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.warn('Could not read sync-db.json, starting fresh.');
  }
}

app.get('/', (req, res) => {
  res.send('Tacit / Mochi Sync Backend is running.');
});

// GET: Send current state to any device that opens the app
app.get('/api/sync', (req, res) => {
  res.json(sharedMochiState);
});

// POST: Receive new images/situations from a device and save them
app.post('/api/sync', (req, res) => {
  try {
    const { venues, wallpapers, cards } = req.body || {};

    if (Array.isArray(venues) && venues.length > 0) {
      sharedMochiState.venues = venues;
    }
    if (wallpapers && typeof wallpapers === 'object') {
      sharedMochiState.wallpapers = { ...sharedMochiState.wallpapers, ...wallpapers };
    }
    if (Array.isArray(cards) && cards.length > 0) {
      sharedMochiState.cards = cards;
    }
    sharedMochiState.updatedAt = Date.now();

    // Save to disk so data isn't lost
    fs.writeFileSync(DB_FILE, JSON.stringify(sharedMochiState, null, 2), 'utf8');

    res.json({ ok: true, state: sharedMochiState });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ ok: false, error: 'Failed to save sync state' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Tacit Backend Server running on port ${PORT}`);
});