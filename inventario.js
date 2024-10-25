const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const amqp = require('amqplib');

// Configurar el servidor y PostgreSQL
const app = express();
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'inventario_db',
    password: '123',
    port: 5432,
});

// Middleware para leer JSON
app.use(express.json());

// ------------ TOKEN---------------------

// Clave secreta para JWT
const SECRET_KEY = 'tokito';

// Ruta para registrar usuarios
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await pool.query('SELECT * FROM usuarios_inve WHERE username = $1', [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Usuario ya registrado' });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar nuevo usuario en la base de datos
    await pool.query('INSERT INTO usuarios_inve (username, password) VALUES ($1, $2)', [username, hashedPassword]);
    res.status(201).json({ message: 'Usuario registrado correctamente' });
    
});

// Ruta de login : Esta ruta autentica a los usuarios registrados y genera un token JWT que se les enviará.
app.post('/login', async(req, res) =>{
  const {username, password} = req.body;

  // Verificar si el usuario existe
  const user = await pool.query('SELECT * FROM usuarios_inve WHERE username = $1', [username]);
  if (user.rows.length === 0) {
      return res.status(400).json({ message: 'Usuario no encontrado' });
  }

  // Comprobar contraseña
  const validPassword = await bcrypt.compare(password, user.rows[0].password);
  if (!validPassword) {
      return res.status(400).json({ message: 'Contraseña incorrecta' });
  }

  // Generar el token JWT 
  const token = jwt.sign({ userId: user.rows[0].id }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// Middleware para verificar JWT
function authenticateToken(req, res, next){
  const token = req.header('Authorization').replace('Bearer ', '');

  if (!token) {
      return res.status(401).json({ message: 'Acceso denegado' });
  }
  
  try {
      const verified = jwt.verify(token, SECRET_KEY);
      req.user = verified;
      next();
  } catch (err) {
      res.status(400).json({ message: 'Token no válido' });
  }
}

// ------------------  COMUNICACIÓN ASÍNCRONA ----------------------
// Función para consumir mensajes de RabbitMQ
async function consumeQueue() {
  try {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    const queue = 'producto_queue';

    // Crear la cola si no existe
    await channel.assertQueue(queue, { durable: false });

    // Consumir mensajes de la cola
    channel.consume(queue, async (msg) => {
      if (msg !== null) {
        const message = JSON.parse(msg.content.toString());
        console.log('Mensaje recibido:', message);

        // Crear un nuevo registro en inventario con cantidad 0
        const productId = message.productId;
        await pool.query(
          'INSERT INTO inventario (producto_id, cantidad) VALUES ($1, $2)',
          [productId, 0]
        );
        console.log(`Producto ${productId} agregado al inventario con cantidad 0`);

        // Confirmar que el mensaje fue procesado
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Error consumiendo mensajes de RabbitMQ:', error);
  }
}

// Iniciar el consumo de mensajes cuando se levanta el servidor
consumeQueue();

// -------------- RUTAS CON AUTORIZACION----------------------

// Obtener la cantidad de productos disponibles en el inventario
app.get('/inventario/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT cantidad FROM inventario WHERE producto_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener la cantidad del producto');
  }
});

// Actualizar la cantidad de productos disponibles en el inventario
app.put('/inventario/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.body;

  if (!cantidad) {
    return res.status(400).json({ error: 'La cantidad es obligatoria' });
  }

  try {
    const result = await pool.query(
      'UPDATE inventario SET cantidad = $1 WHERE producto_id = $2 RETURNING *',
      [cantidad, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al actualizar la cantidad del producto');
  }
});


// app.get('/usuarios', async(req, res) => {
//     const result = await pool.query('SELECT * FROM usuarios_inve');
//     res.json(result.rows);

// });

// Inicia el servidor
app.listen(3001, () =>{
  console.log('Servidor en el puerto 3001');
});
