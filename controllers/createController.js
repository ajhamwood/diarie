require('dotenv').config();
const
  debug = require('debug')('diary'),
  express = require('express'),
  router = express.Router(),
  multer = require('multer'),
  storage = multer.memoryStorage(),
  upload = multer({ storage }),
  { ObjectId, GridFSBucket } = require('mongodb'),
  { Readable } = require('stream');


router.get('/create', (req, res) => res.render('create', {entryid: ObjectId()}));

router.post('/create', upload.array('files', 20), async (req, res) => {
  let bucket = new GridFSBucket(req.app.db, { bucketName: 'images' }),
      reps = (req.body.add = JSON.parse(req.body.add))
        .reduce((a, f, i) => (f.name in a ? a[f.name].push(i) : (a[f.name] = [i]), a), {});
  req.body.filenames = [];
  for (let a in reps) reps[a].forEach((ix, i) => {
    req.body.filenames[ix] = {name: req.body.add[ix].name + (i ? '(' + i + ')' : ''), ext: req.body.add[ix].ext}
  });
  await Promise.all(req.files.map(async (file, ix) => {
    let stream = new Readable(),
        imagename = req.body.entryid + '/' + req.body.filenames[ix].name
    stream.push(file.buffer);
    stream.push(null);
    await new Promise(r => stream.pipe(bucket.openUploadStream(imagename)).on('finish', r))
    debug("saved image %s", imagename)
  }));

  let {entryid, timestamp, title, body, filenames} = req.body;
  timestamp = parseInt(timestamp);
  await req.app.db.collection('accounts').update({authid: req.session.authid}, {$push: {entries: {entryid, timestamp, title, body, filenames}}, $set: {'about.initial': false}});
  res.send(Object.assign((await req.app.db.collection('accounts').aggregate([
    {$match: {authid: req.session.authid}},
    {$unwind: '$entries'},
    {$replaceRoot: {newRoot: '$entries'}},
    {$match: {timestamp: {$lt: timestamp}}},
    {$count: 'index'}
  ]).toArray())[0] || {index: 0}, {ok: 1}))
});

module.exports = router
