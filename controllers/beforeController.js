require('dotenv').config();
const
  debug = require('debug')('diary'),
  express = require('express'),
  router = express.Router(),
  session = require('express-session');

router.use(async (req, res, next) => {
  if (req.headers['x-forwarded-proto'] != 'https') return res.redirect('https://' + req.hostname + req.originalUrl);
  debug(req.method + ' ' + req.url);
  if (req.session.login !== 'ok') {
    if (await req.app.db.collection('options').findOne({option: 'auth'})) {
      if (req.session.login === 'provisional') await req.session.regenerate(() => {});
      if (req.url != '/') return res.redirect('/')
    } else {
      req.session.login = 'provisional';
      if (req.url != '/' && req.url != '/options' && req.url != '/issue-qr') return res.redirect('/')
    }
  } else if (req.session.hash != (await req.app.db.collection('options').findOne({option: 'auth'})).hash) {
    await req.session.regenerate(() => {});
    return res.redirect('/')
  }
  next()
});

module.exports = router
