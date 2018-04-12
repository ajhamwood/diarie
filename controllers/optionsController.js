require('dotenv').config();
const
  debug = require('debug')('diary'),
  express = require('express'),
  router = express.Router(),
  session = require('express-session'),
  multer = require('multer'),
  storage = multer.memoryStorage(),
  upload = multer({ storage }),
  bcrypt = require('bcrypt'), saltRounds = 10,
  childProcess = require('child_process');


router.get('/options', async (req, res) => {
  let options = await req.app.db.collection('options').findOne({option: 'timezone'});
  Object.assign(options, await req.app.db.collection('welcome').findOne({initial: {$exists: 1}}));
  res.render('options', options)
});

router.post('/options', async (req, res) => {
  let { timezone } = req.body.option;
  await req.app.db.collection('options').update({option: {timezone}}, req.body);
  res.redirect('/')
});

router.post('/purge', async (req, res) => {
  let auth = await req.app.db.collection('options').findOne({option: 'auth'});
  new Promise(async (resolve, reject) => {
    if (auth && 'auth' in req.body && await bcrypt.compare(req.body.auth, auth.hash)) {
      let purge = childProcess.fork('scripts/purge.js');
      purge.on('error', err => reject(debug('error %O', err)));
      purge.on('exit', code => code === 0 ? resolve() : reject(debug('exit code %d', code)))
    } else resolve()
  }).then(req.session.destroy)
    .then(() => res.redirect('/'))
    .catch(() => res.redirect('back'))
});

router.post('/issue-qr', upload.array(), async (req, res) => {
  let auth = req.body.auth,
      hash = await bcrypt.hash(auth, saltRounds);
  await req.app.db.collection('options').update({option: 'auth'}, {option: 'auth', hash}, {upsert: 1});
  req.session.hash = this.hash = hash;
  req.session.login = 'ok';
  res.send({ok: 1, auth})
});

router.get('/help', (req, res) => res.render('help'));

module.exports = router
