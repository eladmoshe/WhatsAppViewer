const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    const response = await fetch(url);
    const text = await response.text();
    res.send(text);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Error fetching data');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
