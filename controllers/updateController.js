require('dotenv').config();
const
  debug = require('debug')('diary'),
  express = require('express'),
  router = express.Router(),
  multer = require('multer'),
  storage = multer.memoryStorage(),
  upload = multer({ storage }),
  ObjectId = require('mongodb').ObjectId,
  GridFSBucket = require('mongodb').GridFSBucket,
  { Readable } = require('stream');


router.get('/update/:entryid', async (req, res) => {
  let result = (await req.app.db.collection('accounts').aggregate([
    {$match: {authid: req.session.authid}},
    {$unwind: '$entries'},
    {$replaceRoot: {newRoot: '$entries'}},
    {$match: {entryid: req.params.entryid}}
  ]).toArray())[0];
  res.render('update', result)
});

router.post('/update', upload.array('files', 20), async (req, res) => {
  let { entryid } = req.body;
  req.body.filenames = [];

  // Image removals
  let removeFiles = [];
  if ('remove' in req.body) {
    removeFiles = JSON.parse(req.body.remove);
    let remove = removeFiles.map(i => req.body.entryid + '/' + i),
        bucket = new GridFSBucket(req.app.db, { bucketName: 'images' });
    await Promise.all((await bucket.find({filename: {$in : remove}}, {filename: 1}).toArray()).map(async ({_id, filename}) => {
      await bucket.delete(_id);
      debug('deleted image %s', filename)
    }))
  }

  // Rename duplicate images in update
  let remain = (await req.app.db.collection('accounts').aggregate([
        {$match: {authid: req.session.authid}},
        {$unwind: '$entries'},
        {$replaceRoot: {newRoot: '$entries'}},
        {$match: {entryid}},
        {$project: {filenames: 1}}
      ]).toArray())[0].filenames,
      renameFiles = {}, reps;
  remain = remain.filter(x => !removeFiles.includes(x.name));
  if ('rename' in req.body) {
    renameFiles = JSON.parse(req.body.rename);
    for (let i in renameFiles) if (!remain.find(j => j.name == i)) delete renameFiles[i];
    let remainDiminished = remain.filter(x => !Object.keys(renameFiles).includes(x.name));
    reps = remainDiminished.reduce((a, f) => (f.name in a ? a[f.name].push({remain: ''}) : (a[f.name] = [{remain: ''}]), a), {});
    reps = Object.entries(renameFiles).reduce((a, f) => (f[1] in a ? a[f[1]].push({rename: f[0]}) : (a[f[1]] = [{rename: f[0]}]), a), reps)
  } else reps = remain.reduce((a, f) => (f.name in a ? a[f.name].push({remain: ''}) : (a[f.name] = [{remain: ''}]), a), {});
  let addFiles = JSON.parse(req.body.add);
  reps = addFiles.reduce((a, f, i) => (f.name in a ? a[f.name].push({add: i}) : (a[f.name] = [{add: i}]), a), reps);
  for (let a in reps) reps[a].forEach((which, i) => {
    if ('rename' in which && i) renameFiles[which.rename] += '(' + i + ')';
    if ('add' in which && i) addFiles[which.add].name += '(' + i + ')'
  });

  // Image renamings
  if ('rename' in req.body) {
    let rename = Object.entries(renameFiles).map(i => i.map(j => req.body.entryid + '/' + j))
      .reduce((a, x) => Object.assign(a, {[x[0]]: x[1]}), {});
    let bucket = new GridFSBucket(req.app.db, { bucketName: 'images'});
    await Promise.all((await bucket.find({filename: {$in : Object.keys(rename)}}, {filename: 1}).toArray())
      .map(async ({_id, filename}) => {
        await bucket.rename(_id, rename[filename]);
        debug('renamed image %s => %s', filename, rename[filename])
      })
    )
  }

  // Image additions
  let bucket = new GridFSBucket(req.app.db, { bucketName: 'images' });
  await Promise.all(req.files.map(async (file, ix) => {
    let stream = new Readable(),
        imageName = req.body.entryid + '/' + addFiles[ix].name;
    stream.push(file.buffer);
    stream.push(null);
    await new Promise(r => stream.pipe(bucket.openUploadStream(imageName)).on('finish', r));
    debug('saved image %s', imageName)
  }));

  req.body.filenames = remain.map(x => (x.name = x.name in renameFiles ? renameFiles[x.name] : x.name, x))
    .concat(addFiles.map(x => ({name: x.name, ext: x.ext})));
  let {timestamp, title, body, filenames} = req.body;
  timestamp = parseInt(timestamp);
  await req.app.db.collection('accounts').update(
    {authid: req.session.authid},
    {$set: {'entries.$[elem]': {entryid, timestamp, title, body, filenames}, 'about.initial': false}},
    {arrayFilters: [{'elem.entryid': {$eq: entryid}}]}
  );
  res.send(Object.assign((await req.app.db.collection('accounts').aggregate([
    {$match: {authid: req.session.authid}},
    {$unwind: '$entries'},
    {$replaceRoot: {newRoot: '$entries'}},
    {$match: {timestamp: {$lt: timestamp}}},
    {$count: 'index'}
  ]).toArray())[0] || {index: 0}, {ok: 1}))
});

module.exports = router
