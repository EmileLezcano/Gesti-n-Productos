const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const amqp = require('amqplib');
const CircuitBreaker = require('opossum');

// Configurar el servidor y PostgreSQL
const app = express();
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'productos_db',
    password: '123',
    port: 5432,
});

// Middleware para leer JSON
app.use(express.json());

// ------------ TOKEN---------------------

// Clave secreta para JWT
const SECRET_KEY = 'kerberos';

// Ruta para registrar usuarios
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    // Verificar si el usuairo ya existe
    const userExists = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Usuario ya registrado' });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar nuevo usuario en la base de datos
    await pool.query('INSERT INTO usuarios (username, password) VALUES ($1, $2)', [username, hashedPassword]);
    res.status(201).json({ message: 'Usuario registrado correctamente' });
    
});

// Ruta de login : Esta ruta autentica a los usuarios registrados y genera un token JWT que se les enviará.
app.post('/login', async(req, res) =>{
    const {username, password} = req.body;

    // Verificar si el usuario existe
    const user = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    if (user.rows.length === 0) {
        return res.status(400).json({ message: 'Usuario no encontrado' });
    }

    // Comprobar contrasena
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

// -------------COMUNICACIO ASINCRONA---------------------------
// Función para enviar mensaje a RabbitMQ
async function sendToQueue(productId) {
  try {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    const queue = 'producto_queue';

    // Crear la cola si no existe
    await channel.assertQueue(queue, { durable: false });

    // Enviar el mensaje (ID del producto)
    const message = { productId };
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
    console.log('Mensaje enviado:', message);

    // Cerrar conexión
    setTimeout(() => {
      connection.close();
    }, 500);
  } catch (error) {
    console.error('Error enviando mensaje a RabbitMQ:', error);
  }

}

// ----------------CIRCUITO BREAKER---------------------------
const breakerOptions = {
  timeout: 5000, // tiempo máximo antes de un fallo
  errorThresholdPercentage: 50, // umbral de fallos para abrir el circuito
  resetTimeout: 10000 // tiempo antes de intentar "curar" el circuito
};

// Crear el circuito con la función que envía mensajes a RabbitMQ
const breaker = new CircuitBreaker(sendToQueue, breakerOptions);


// Manejar eventos del Circuit Breaker  
breaker.on('open', () => console.log('Circuito abierto, detener envíos'));
breaker.on('halfOpen', () => console.log('Circuito en estado de prueba'));
breaker.on('close', () => console.log('Circuito cerrado, todo está bien'));


// -------------- RUTAS CON AUTORIZACION----------------------
// Consulta de productos
app.get('/productos', authenticateToken, async(req, res) => {
    const result = await pool.query('SELECT * FROM productos');
    res.json(result.rows);

});

// Crear un nuevo producto
app.post('/productos', authenticateToken, async (req, res) => {
    const { nombre, descripcion, precio } = req.body;
  
    if (!nombre || !precio) {
      return res.status(400).json({ error: 'El nombre y el precio son obligatorios' });
    }
  
    try {
      const result = await pool.query(
        'INSERT INTO productos (nombre, descripcion, precio) VALUES ($1, $2, $3) RETURNING *',
        [nombre, descripcion, precio]
      );

      const newProduct = result.rows[0];

      // Enviar mensaje a RabbitMQ usando el Circuit Breaker
      breaker.fire(newProduct.id)
      .then(() => {
          res.status(201).json(newProduct);
      })
      .catch((err) => {
          console.error('Error al enviar mensaje:', err);
          res.status(500).send('Error al enviar mensaje a RabbitMQ');
      });

      //  // Enviar mensaje con el ID del nuevo producto a RabbitMQ
      // await sendToQueue(newProduct.id);

      // res.status(201).json(newProduct);
      
    } catch (err) {
      console.error(err);
      res.status(500).send('Error al crear el producto');
    }
  });

// Actualizar un producto
app.put('/productos/:id',  authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, precio } = req.body;
  
    if (!nombre || !precio) {
      return res.status(400).json({ error: 'El nombre y el precio son obligatorios' });
    }
  
    try {
      const result = await pool.query(
        'UPDATE productos SET nombre = $1, descripcion = $2, precio = $3 WHERE id = $4 RETURNING *',
        [nombre, descripcion, precio, id]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error al actualizar producto');
    }
});


// app.get('/usuarios', async(req, res) => {
//     const result = await pool.query('SELECT * FROM usuarios');
//     res.json(result.rows);

// });

// // Ruta protegida
// app.get('/dashboard', authenticateToken, (req, res) => {
//     res.send('Accediste al dashboard protegido');
// });



// Inicia el servidor
app.listen(3000, () =>{
    console.log('Servidor en el puerto 3000');
});
