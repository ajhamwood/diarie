require('dotenv').config();
const
  debug = require('debug')('diary'),
  express = require('express'),
  router = express.Router(),
  multer = require('multer'),
  storage = multer.memoryStorage(),
  upload = multer({ storage }),
  ObjectId = require('mongodb').ObjectId,
  GridFSBucket = require('mongodb').GridFSBucket;


router.post('/delete', upload.array(), async (req, res) => {
  let record = await req.app.db.collection('entries').findOne(ObjectId(req.body.id), {timestamp: 1, filenames: 1});
  if (!record) return res.send({ok: 0});
  let remove = record.filenames.map(x => req.body.id + '/' + x.name),
      timestamp = record.timestamp,
      bucket = new GridFSBucket(req.app.db, { bucketName: 'images', chunkSizeBytes: 65536 });
  await Promise.all((await bucket.find({filename: {$in : remove}}, {filename: 1}).toArray()).map(async ({_id, filename}) => {
    await bucket.delete(_id);
    debug('deleted image %s', filename)
  }));
  await req.app.db.collection('entries').deleteOne({_id: ObjectId(req.body.id)});
  res.send({ok: 1, index: await req.app.db.collection('entries').find({timestamp: {$lt: timestamp}}).count()})
});

module.exports = router
