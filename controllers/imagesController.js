const
  express = require('express'),
  router = express.Router(),
  { ObjectId, GridFSBucket } = require('mongodb');


router.get('/images/:entryid/:img', async (req, res) => {
  let bucket = new GridFSBucket(req.app.db, { bucketName: 'images' }),
      { entryid, img } = req.params,
      result = await bucket.find({filename: entryid + '/' + img}).toArray();
  if (result.length != 1) return res.status(404).end('error');
  let data = await new Promise(r => {
    let acc = Buffer.from(''),
    stream = bucket.openDownloadStream(result[0]._id);
    stream.on('data', data => acc = Buffer.concat([acc, data]));
    stream.on('end', () => r(acc))
  }), { filenames } = (await req.app.db.collection('accounts').aggregate([
    {$match: {authid: req.session.authid}},
    {$unwind: '$entries'},
    {$replaceRoot: {newRoot: '$entries'}},
    {$match: {entryid}},
    {$project: {filenames: 1}}
  ]).toArray())[0];
  res.type(filenames.find(x => x.name == img).ext);
  res.send(data)
});

module.exports = router
