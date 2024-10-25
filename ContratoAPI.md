Contrato API
Autenticación (Usuarios)
Registrar usuario

    Endpoint: /register
    Método: POST
    Descripción: Registra un nuevo usuario en el sistema.
    Parámetros:
        username (string, obligatorio): Nombre de usuario.
        password (string, obligatorio): Contraseña del usuario.
    Respuesta:
        201 Created: Usuario registrado exitosamente.
        400 Bad Request: Usuario ya registrado.
    Formato de ejemplo (Solicitud):

    json

    {
      "username": "usuario123",
      "password": "contrasena_segura"
    }

Iniciar sesión

    Endpoint: /login
    Método: POST
    Descripción: Autentica al usuario y genera un token JWT.
    Parámetros:
        username (string, obligatorio)
        password (string, obligatorio)
    Respuesta:
        200 OK: Token JWT generado exitosamente.
        400 Bad Request: Usuario no encontrado o contraseña incorrecta.
    Formato de ejemplo (Solicitud):

    json

{
  "username": "usuario123",
  "password": "contrasena_segura"
}

Formato de ejemplo (Respuesta):

json

    {
      "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }

Gestión de Productos
Obtener todos los productos

    Endpoint: /productos
    Método: GET
    Autenticación: JWT (token en el encabezado Authorization: Bearer <token>)
    Descripción: Obtiene la lista de todos los productos en la base de datos.
    Respuesta:
        200 OK: Devuelve la lista de productos.
    Formato de ejemplo (Respuesta):

    json

    [
      {
        "id": 1,
        "nombre": "Producto A",
        "descripcion": "Descripción del Producto A",
        "precio": 100
      },
      {
        "id": 2,
        "nombre": "Producto B",
        "descripcion": "Descripción del Producto B",
        "precio": 150
      }
    ]

Crear un producto

    Endpoint: /productos
    Método: POST
    Autenticación: JWT (token en el encabezado Authorization: Bearer <token>)
    Descripción: Crea un nuevo producto y lo agrega a la base de datos. Se envía un mensaje a RabbitMQ para agregar el producto al inventario.
    Parámetros:
        nombre (string, obligatorio): Nombre del producto.
        descripcion (string, opcional): Descripción del producto.
        precio (number, obligatorio): Precio del producto.
    Respuesta:
        201 Created: Producto creado exitosamente y mensaje enviado a RabbitMQ.
        400 Bad Request: Falta el nombre o precio del producto.
    Formato de ejemplo (Solicitud):

    json

{
  "nombre": "Producto C",
  "descripcion": "Descripción del Producto C",
  "precio": 200
}

Formato de ejemplo (Respuesta):

json

    {
      "id": 3,
      "nombre": "Producto C",
      "descripcion": "Descripción del Producto C",
      "precio": 200
    }

Actualizar un producto

    Endpoint: /productos/:id
    Método: PUT
    Autenticación: JWT (token en el encabezado Authorization: Bearer <token>)
    Descripción: Actualiza los detalles de un producto existente.
    Parámetros:
        id (integer, obligatorio): ID del producto.
        nombre (string, obligatorio): Nombre del producto.
        descripcion (string, opcional): Descripción del producto.
        precio (number, obligatorio): Precio del producto.
    Respuesta:
        200 OK: Producto actualizado exitosamente.
        404 Not Found: Producto no encontrado.
    Formato de ejemplo (Solicitud):

    json

    {
      "nombre": "Producto Actualizado",
      "descripcion": "Descripción actualizada",
      "precio": 250
    }

Gestión de Inventario
Obtener cantidad de un producto en inventario

    Endpoint: /inventario/:id
    Método: GET
    Autenticación: JWT (token en el encabezado Authorization: Bearer <token>)
    Descripción: Consulta la cantidad disponible de un producto en el inventario.
    Parámetros:
        id (integer, obligatorio): ID del producto.
    Respuesta:
        200 OK: Cantidad del producto en inventario.
        404 Not Found: Producto no encontrado.
    Formato de ejemplo (Respuesta):

    json

    {
      "cantidad": 50
    }

Actualizar cantidad de productos en inventario

    Endpoint: /inventario/:id
    Método: PUT
    Autenticación: JWT (token en el encabezado Authorization: Bearer <token>)
    Descripción: Actualiza la cantidad de productos disponibles en el inventario.
    Parámetros:
        id (integer, obligatorio): ID del producto.
        cantidad (number, obligatorio): Nueva cantidad del producto en inventario.
    Respuesta:
        200 OK: Cantidad de producto actualizada.
        404 Not Found: Producto no encontrado.
    Formato de ejemplo (Solicitud):

    json

{
  "cantidad": 100
}