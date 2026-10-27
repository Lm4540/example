const axios = require('axios');
const cache = require('memory-cache');

class TokenManager {
  constructor() {
    this.CACHE_KEY = 'dgii_bearer_token';
    this.CERT_DATA = 'dgii_cert_data';
  }

  async getToken(force = false) {
    if (!force) {
      const cachedToken = cache.get(this.CACHE_KEY);
      if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token;
      }
    }
    return await this.refreshToken();
  }

  async refreshToken() {
    try {

      const authUrl = process.env.DTE_AMBIENTE === '01' ? process.env.MH_AUTH_URL_PROD : process.env.MH_AUTH_URL_TEST;
      const params = new URLSearchParams();
      params.append('user', process.env.MH_AUTH_USER);
      params.append('pwd', process.env.MH_API_KEY);

      const response = await axios.post(authUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'dte-app-nodejs/1.0'
        }
      });

      if (response.data && response.data.body && response.data.body.token) {
        const token = response.data.body.token;
        // Establecemos una fecha de expiración de 24 horas
        const tokenData = {
          token: token,
          expiresAt: Date.now() + ((24 * 60 * 60 * 1000) - 100000), // 24 horas menos 10 minutos de margen
        };

        // Almacenar en caché con tiempo de expiración
        cache.put(this.CACHE_KEY, tokenData, tokenData.expiresAt - Date.now());
        return token;
      } else {
        console.error('Fallo al obtener token:', response.data);
        return null;
      }

    } catch (error) {
      console.error('Error al renovar token:', error.response?.data || error.message);
      return null;
    }
  }
}

module.exports = new TokenManager();