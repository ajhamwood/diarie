require('dotenv').config();
const
  debug = require('debug')('diary'),
  express = require('express'),
  router = express.Router(),
  RateLimit = require('express-rate-limit'),
  session = require('express-session'),
  multer = require('multer'),
  storage = multer.memoryStorage(),
  upload = multer({ storage }),
  { GridFSBucket } = require('mongodb'),
  bcrypt = require('bcrypt'), saltRounds = 10;
var limiter = new RateLimit({
  windowMs: 60*60*1000,
  delayAfter: 1,
  delayMs: 3*1000,
  max: 5,
  message: 'New ID flood limit'
});


router.get('/options', async (req, res) => {
  let { about } = await req.app.db.collection('accounts').findOne({authid: req.session.authid}, {about: 1});
  res.render('options', about)
});

router.post('/options', async (req, res) => {
  let { timezone } = req.body;
  await req.app.db.collection('accounts').findOneAndUpdate({authid: req.session.authid}, {$set: {'about.timezone': timezone}});
  res.redirect('/')
});

router.post('/purge', async (req, res) => {
  let account = await req.app.db.collection('accounts').findOne({authid: req.session.authid}, {entries: 0}),
      r = req.body.auth.split('-');
  if (r[1] && 'auth' in req.body && await bcrypt.compare(r[1], account.hash)) {
    let entriesFilenames = await req.app.db.collection('accounts').aggregate([
          {$match: {authid: req.session.authid}},
          {$unwind: '$entries'},
          {$replaceRoot: {newRoot: '$entries'}},
          {$unwind: '$filenames'},
          {$project: {entryid: 1, name: '$filenames.name'}}
        ]).toArray(),
        bucket = new GridFSBucket(req.app.db, { bucketName: 'images'});
    await Promise.all(entriesFilenames.map(async image =>
      bucket.delete((await req.app.db.collection('images.files').findOne({filename: image.entryid + '/' + image.name}))._id)
    ));
    await req.app.db.collection('accounts').update({authid: req.session.authid}, {$set: {entries: [], 'about.initial': true}});
  }
  res.redirect('/')
});

router.post('/issue-qr', upload.array(), limiter, async (req, res) => {
  let auth = req.app.createAuth(), r = auth.split('-'),
      hash = await bcrypt.hash(r[1], saltRounds);
  await req.app.db.collection('accounts').update({authid: req.session.authid}, {$set: {authid: r[0], hash}});
  req.session.authid = r[0];
  req.session.hash = hash;
  res.send({ok: 1, auth})
});

router.get('/help', (req, res) => res.render('help'));

module.exports = router
