const AplicationAccess = require('../Models/AplicationAccess');
const jwt = require('jsonwebtoken');

const ApiAuth = {

      applicationLogin: async (req, res, next) => {
            const { identification, secret } = req.body;
            try {
                  const app = await AplicationAccess.findOne({
                        where: {
                              identification: identification,
                              secret: secret,
                        },
                        attributes: ['permissions', 'appName', 'createdBy'],
                        raw: true,
                  });
                  if (!app) {
                        return res.status(401).json({ message: 'Credenciales incorrectas' });
                  }
                  const payload = { lascatalogUpdate: null };
                  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
                  res.json({ token });
            } catch (error) {
                  console.error(error);
                  res.status(500).json({ message: 'Error interno del servidor' });
            }
      },



      authenticateToken: async (req, res, next) => {
            const authHeader = req.headers['authorization'];

            const token = authHeader && authHeader.split(' ')[1];
            if (token == null) {
                  return res.status(401).json({ message: 'Token no Proporcionado' });
            }
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                  if (err) {
                        return res.status(403).json({ message: 'No se ha podido autenticar, verifique que el token este correcto' });
                  }
                  req.aplication = decoded;
                  console.log('Autorizacion encontrada')
                  next();
            });
      }


}
module.exports = ApiAuth;