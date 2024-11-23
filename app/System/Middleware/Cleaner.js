const Cleaner = {
      clean: (req, res, next,) => {
            if (req.method == 'GET') {
                  return next();
            }

            let keys = Object.keys(req.body);
            keys.forEach(k => {
                  if (typeof req.body[k] == 'string') {
                        req.body[k] = `${req.body[k]}`.replace(/['"*]+/g, '').trim();
                  }
            });

            return next();

      },

};

module.exports = Cleaner;