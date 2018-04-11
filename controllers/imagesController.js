const
  express = require('express'),
  router = express.Router(),
  ObjectId = require('mongodb').ObjectId,
  GridFSBucket = require('mongodb').GridFSBucket;


router.get('/images/:id/:img', async (req, res) => {
  let bucket = new GridFSBucket(req.app.db, { bucketName: 'images' }),
  result = await bucket.find({filename: req.params.id + '/' + req.params.img}, {_id: 1}).toArray();
  if (result.length != 1) return res.status(404).end('error');
  let data = await new Promise(r => {
    let acc = Buffer.from(''),
    stream = bucket.openDownloadStream(result[0]._id);
    stream.on('data', data => acc = Buffer.concat([acc, data]));
    stream.on('end', () => r(acc))
  }), { filenames } = await req.app.db.collection('entries').findOne(ObjectId(req.params.id));
  res.type(filenames.find(x => x.name == req.params.img).ext);
  res.send(data)
});

module.exports = router
