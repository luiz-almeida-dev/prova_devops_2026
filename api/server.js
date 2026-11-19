const cors = require('cors');
const express = require('express');
const mysql = require('mysql2/promise');

const webOrigin = process.env.WEB_ORIGIN;
const originUrl = new URL(webOrigin);
if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.origin !== webOrigin) {
  throw new Error('WEB_ORIGIN must be a single HTTP(S) origin without a trailing slash.');
}

const database = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
});

const app = express();
app.use((_request, response, next) => {
  response.vary('Origin');
  next();
});
app.use(cors({
  origin: (origin, callback) => callback(null, origin === webOrigin),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

function validateProduct(body) {
  const { name, category, price, quantity } = body ?? {};
  if (typeof name !== 'string' || !name.trim() || [...name.trim()].length > 255) {
    return 'name must contain 1 to 255 characters.';
  }
  if (typeof category !== 'string' || !category.trim() || [...category.trim()].length > 255) {
    return 'category must contain 1 to 255 characters.';
  }
  if (typeof price !== 'number' || !/^\d{1,10}(\.\d{1,2})?$/.test(String(price))) {
    return 'price must be a non-negative number with up to 10 integer digits and 2 decimal places.';
  }
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 4294967295) {
    return 'quantity must be an integer between 0 and 4294967295.';
  }
  return null;
}

app.post('/produto', async (request, response) => {
  const validationError = validateProduct(request.body);
  if (validationError) {
    return response.status(400).json({ error: validationError });
  }

  const { name, category, price, quantity } = request.body;
  const product = { name: name.trim(), category: category.trim(), price, quantity };
  await database.execute(
    'INSERT INTO products (name, category, price, quantity) VALUES (?, ?, ?, ?)',
    [product.name, product.category, String(product.price), product.quantity],
  );
  return response.status(201).json(product);
});

app.get('/produtos', async (_request, response) => {
  const [rows] = await database.query(
    'SELECT name, category, price, quantity FROM products ORDER BY id',
  );
  response.json(rows.map(({ name, category, price, quantity }) => ({
    name, category, price: Number(price), quantity,
  })));
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.' });
});

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error);

  if (error.status >= 400 && error.status < 500) {
    return response.status(error.status).json({ error: 'Invalid request body.' });
  }

  console.error('Request failed:', error.code ?? error.name);
  return response.status(500).json({ error: 'Internal server error.' });
});

app.listen(3000, '0.0.0.0', () => console.log('Products API listening on port 3000.'));
