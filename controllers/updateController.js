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


router.get('/update/:id', async (req, res) => {
  let result = await req.app.db.collection('entries').findOne(ObjectId(req.params.id));
  res.render('update', {data: result})
});

router.post('/update', upload.array('files', 20), async (req, res) => {
  let _id = ObjectId(req.body.id);
  req.body.filenames = [];

  // Image removals
  let removeFiles = [];
  if ('remove' in req.body) {
    removeFiles = JSON.parse(req.body.remove);
    let remove = removeFiles.map(i => req.body.id + '/' + i),
        bucket = new GridFSBucket(req.app.db, { bucketName: 'images'});
    await Promise.all((await bucket.find({filename: {$in : remove}}, {filename: 1}).toArray()).map(async ({_id, filename}) => {
      await bucket.delete(_id);
      debug('deleted image %s', filename)
    }))
  }

  // Rename duplicates in update
  let remain = (await req.app.db.collection('entries').findOne({_id}, {filenames: 1})).filenames,
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
    if ('rename' in which) renameFiles[which.rename] += i ? '(' + i + ')' : ''
    if ('add' in which) addFiles[which.add].name += i ? '(' + i + ')' : ''
  });

  // Image renamings
  if ('rename' in req.body) {
    let rename = Object.entries(renameFiles).map(i => i.map(j => req.body.id + '/' + j))
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
        imageName = req.body.id + '/' + addFiles[ix].name;
    stream.push(file.buffer);
    stream.push(null);
    await new Promise(r => stream.pipe(bucket.openUploadStream(imageName)).on('finish', r));
    debug('saved image %s', imageName)
  }));

  req.body.filenames = remain.map(x => (x.name = x.name in renameFiles ? renameFiles[x.name] : x.name, x))
    .concat(addFiles.map(x => ({name: x.name, ext: x.ext})));
  let {timestamp, title, body, filenames} = req.body;
  timestamp = parseInt(timestamp);
  await req.app.db.collection('entries').update({_id}, {timestamp, title, body, filenames});
  res.send({ok: 1, index: await req.app.db.collection('entries').find({timestamp: {$lt: timestamp}}).count()})
});

module.exports = router
