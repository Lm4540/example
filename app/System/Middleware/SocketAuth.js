const sequelize = require("../../DataBase/DataBase");
const { QueryTypes } = require('sequelize');


module.exports = {
      Auth: async (session) => {
            if (session.userSession != undefined && session.userSession !== null) {
                  let tmp = await sequelize.query(`SELECT * FROM system_sessions WHERE session_id = "${session.id}"`, {
                        type: QueryTypes.SELECT,
                  });
                  return tmp !== null && tmp.length > 0;
            }
            return false;
      },

};