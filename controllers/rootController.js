require('dotenv').config();
const
  debug = require('debug')('diarie'),
  express = require('express'),
  router = express.Router(),
  RateLimit = require('express-rate-limit'),
  session = require('express-session'),
  multer = require('multer'),
  storage = multer.memoryStorage(),
  upload = multer({ storage }),
  bcrypt = require('bcrypt'), saltRounds = 10,
  showdown = require('showdown'),
  xss = require('xss'),
  querystring = require('querystring');
var limiter = new RateLimit({
  windowMs: 60*60*1000,
  delayAfter: 1,
  delayMs: 3*1000,
  max: 5,
  message: 'New account flood limit'
});

showdown.extension('xssfilter', () => [{type: 'output', filter: xss}]);
showdown.extension('fixFragLinks', () => [
  {type: 'lang', regex: /(\[[^\]]*\]\()([^)]*)(\))/g, replace: (_, $1, $2) => $1 + $2.replace(/ /g, '%20') + ')'},
  {type: 'lang', regex: /^(#{1,6}) *(.*)$/gm, replace: '$1¯ˇ$2ˇ¯'},
  {type: 'output', regex: /¯ˇ(((?!ˇ¯).)*)ˇ¯/gm, replace: '<span id="$1">$1</span>'}
]);
const converter = new showdown.Converter({emoji: true, underline: true, tables: true, extensions: ['xssFilter', 'fixFragLinks']});

router.get('/', async (req, res) => {
  let account = await req.app.db.collection('accounts').findOne({authid: req.session.authid}, {entries: 0});
  if ('hash' in req.session) {
    let { numPage, perPage } = req.query, np = Number(numPage), pp = Number(perPage),
        maybeCount = (await req.app.db.collection('accounts').aggregate([
          {$match: {authid: req.session.authid}},
          {$unwind: '$entries'},
          {$count: 'count'}
        ]).toArray())[0],
        count = maybeCount ? maybeCount.count : 0, maxP = Math.ceil(count / pp), query = {};
    numPage || (np = 1); perPage || (pp = 10);
    if (np < 1) np = 1; if (np > maxP) np = maxP;
    if (pp < 1) pp = 5; if (pp > 250) pp = 100;
    if (numPage && np != 1) query.numPage = np;
    if (perPage && pp != 10) query.perPage = pp;
    if (!Object.keys(req.query).every(x => ~['numPage', 'perPage'].indexOf(x)) ||
      (numPage != query.numPage) || (perPage != query.perPage))
      return res.redirect(req.baseUrl + '?' + querystring.stringify(query));

    let entryList = (await req.app.db.collection('accounts').aggregate([
          {$match: {authid: req.session.authid}},
          {$unwind: '$entries'},
          {$replaceRoot: {newRoot: '$entries'}},
          {$sort: {timestamp: 1}},
          {$skip: (pp * (np - 1))},
          {$limit: pp}
        ]).toArray()).map(x => Object.assign(x, { body: converter.makeHtml(x.body) })),
        noEntries = !entryList.length, initial = account.about.initial, welcome;
    if (initial) welcome = converter.makeHtml((await req.app.db.collection('welcome').findOne({message: {$eq: 1}})).value.body);
    res.render('home', { pp, np, count, welcome, initial, noEntries, entryList, timezone: account.about.timezone })
  } else res.render('scan', Object.assign({ demo: req.app.mode == 'demo' }, req.session.crumb ? {} :
    { message: (await req.app.db.collection('welcome').findOne({message: 0})).value }))
});

router.post('/', upload.array(), async (req, res) => {
  let { auth } = req.body, r = auth.split('-'),
      maybeHash = await req.app.db.collection('accounts').findOne({authid: r[0]}, {hash: 1});
  if (maybeHash && r[1] && await bcrypt.compare(r[1], maybeHash.hash)) {
    req.session.authid = r[0];
    req.session.hash = hash;
    req.session.crumb = true;
    res.send({ok: 1});
    await req.app.db.collection('accounts').findOneAndUpdate({authid: r[0]}, {$set: {'about.initial': false}})
  } else res.send({ok: 0})
});

router.get('/logout', async (req, res) => {
  delete req.session.authid;
  delete req.session.hash;
  res.redirect('/')
});

router.post('/create-account', upload.array(), limiter, async (req, res) => {
  let auth = req.app.createAuth(), r = auth.split('-'),
      hash = await bcrypt.hash(r[1], saltRounds),
      { timezone } = req.body;
  await req.app.db.collection('accounts').insert(
    Object.assign({authid: r[0], hash, entries: [], about: {timezone, initial: true}}, req.app.mode == 'demo' ? {createdAt: new Date()} : {})
  );
  req.session.authid = r[0];
  req.session.hash = hash;
  req.session.crumb = true;
  res.send({ok: 1, auth})
});

module.exports = router
