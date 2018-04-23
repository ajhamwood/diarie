require('dotenv').config();
const
  debug = require('debug')('diarie'),
  express = require('express'),
  router = express.Router(),
  session = require('express-session'),
  { GridFSBucket } = require('mongodb');

router.use(async (req, res, next) => {
  debug('%O', req.app.mode)
  if (req.headers['x-forwarded-proto'] != 'https') return res.redirect('https://' + req.hostname + req.originalUrl);
  debug(req.method + ' ' + req.url);
  let auth, cutoff;
  if (!('authid' in req.session)) {
    if (req.url != '/' && req.url != '/create-account') return res.redirect('/')
  } else if ((auth = await req.app.db.collection('accounts').findOne({authid: req.session.authid}, {hash: 1})) && req.session.hash != auth.hash) {
    await req.session.regenerate(() => {});
    req.session.crumb = true;
    return res.redirect('/')
  }　else if (req.app.mode == 'demo') {
    if (!(req.app.cullTime >= (cutoff = Date.now()))) {
      let accountsEntriesFilenames = await req.app.db.collection('accounts').aggregate([
            {$match: {createdAt: {$lt: new Date(cutoff - req.app.ttl * 1000)}}},
            {$unwind: '$entries'},
            {$replaceRoot: {newRoot: '$entries'}},
            {$unwind: '$filenames'},
            {$project: {entryid: 1, name: '$filenames.name'}}
          ]).toArray(),
          bucket = new GridFSBucket(req.app.db, { bucketName: 'images'});
      await Promise.all(accountsEntriesFilenames.map(async image => {
        bucket.delete((await req.app.db.collection('images.files').findOne({filename: image.entryid + '/' + image.name}))._id);
        debug('deleted image %s', image.name)
      }));
      await req.app.db.collection('accounts')
        .find({createdAt: {$lt: new Date(cutoff - req.app.ttl * 1000)}}, {authid: 1}).toArray().then(x => x.map(account => {
          req.app.db.collection('accounts').removeOne({_id: account._id});
          debug('deleted account %s', account.authid)
        }));
      let last = (await req.app.db.collection('accounts').find({}, {createdAt: 1}).sort({createdAt: 1}).limit(1).toArray())[0];
      if (last) req.app.cullTime = new Date(last.createdAt) + req.app.ttl * 1000
      if (!(await req.app.db.collection('accounts').findOne({authid: req.session.authid}, {_id: 1}))) {
        delete req.session.authid;
        delete req.session.hash;
        req.session.crumb = true;
        return res.redirect('/')
      }
    }
  }
  next()
});

module.exports = router
