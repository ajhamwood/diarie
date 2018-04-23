require('dotenv').config();
const
  debug = require('debug')('diarie'),
  express = require('express'),
  router = express.Router(),
  multer = require('multer'),
  storage = multer.memoryStorage(),
  upload = multer({ storage }),
  { ObjectId, GridFSBucket } = require('mongodb');


router.post('/delete', upload.array(), async (req, res) => {
  let { entryid } = req.body;
  let record = await req.app.db.collection('accounts').aggregate([
        {$match: {authid: req.session.authid}},
        {$unwind: '$entries'},
        {$replaceRoot: {newRoot: '$entries'}},
        {$match: {entryid}},
        {$project: {timestamp: 1, filenames: 1}}
      ]).toArray();
  if (!record.length) return res.send({ok: 0});
  else record = record[0];
  let remove = record.filenames.map(x => req.body.entryid + '/' + x.name),
      timestamp = record.timestamp,
      bucket = new GridFSBucket(req.app.db, { bucketName: 'images', chunkSizeBytes: 65536 });
  await Promise.all((await bucket.find({filename: {$in : remove}}, {filename: 1}).toArray()).map(async ({_id, filename}) => {
    await bucket.delete(_id);
    debug('deleted image %s', filename)
  }));
  await req.app.db.collection('accounts').update({authid: req.session.authid}, {$pull: {entries: {entryid}}});
  res.send(Object.assign((await req.app.db.collection('accounts').aggregate([
    {$match: {authid: req.session.authid}},
    {$unwind: '$entries'},
    {$replaceRoot: {newRoot: '$entries'}},
    {$match: {timestamp: {$lt: timestamp}}},
    {$count: 'index'}
  ]).toArray())[0] || {index: 0}, {ok: 1}))
});

module.exports = router
