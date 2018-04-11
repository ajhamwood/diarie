require('dotenv').config();
const
  debug = require('debug')('diary'),
  express = require('express'),
  router = express.Router(),
  session = require('express-session'),
  multer = require('multer'),
  storage = multer.memoryStorage(),
  upload = multer({ storage }),
  bcrypt = require('bcrypt'),
  showdown = require('showdown'),
  xss = require('xss');

showdown.extension('xssfilter', () => [{type: 'output', filter: xss}]);
showdown.extension('fixFragLinks', () => [
  {type: 'lang', regex: /(\[[^\]]*\]\()([^)]*)(\))/g, replace: (_, $1, $2) => $1 + $2.replace(/ /g, '%20') + ')'},
  {type: 'lang', regex: /^(#{1,6}) *(.*)$/gm, replace: '$1¯ˇ$2ˇ¯'},
  {type: 'output', regex: /¯ˇ(((?!ˇ¯).)*)ˇ¯/gm, replace: '<span id="$1">$1</span>'}
]);
const converter = new showdown.Converter({emoji: true, underline: true, tables: true, extensions: ['xssFilter', 'fixFragLinks']});


router.get('/', async (req, res) => {
  let { initial } = await req.app.db.collection('welcome').findOne({initial: {$exists: 1}});
  if (req.session.auth) {
    let pp = parseInt(req.query.perPage),
        np = parseInt(req.query.numPage);
    if (!pp || pp < 0) pp = 10;
    if (!np || np < 0) np = 1;
    let options = await req.app.db.collection('options').findOne({timezone: {$exists: 1}}),
        count = await req.app.db.collection('entries').count(),
        entryList = (await req.app.db.collection('entries')
        .find().sort({timestamp: 1}).limit(pp).skip(pp * (np - 1)).toArray())
        .map(x => ({
          body: converter.makeHtml(x.body),
          id: x._id, title: x.title, timestamp: x.timestamp
        })), welcome;
    if (initial) welcome = converter.makeHtml((await req.app.db.collection('welcome').findOne({message: {$eq: 1}})).value.body);
    res.render('home', { pp, np, count, welcome, initial, noEntries: !entryList.length, entryList, timezone: options.timezone })
  } else res.render( 'scan', initial ?
    { message: (await req.app.db.collection('welcome').findOne({message: 0})).value }
    : {} )
});

router.post('/', upload.array(), async (req, res) => {
  let auth = await req.app.db.collection('options').findOne({option: 'auth'});
  if (auth && 'auth' in req.body && await bcrypt.compare(req.body.auth, auth.hash)) {
    req.session.auth = 'ok';
    req.session.hash = auth.hash;
    res.send({ok: 1});
    await req.app.db.collection('welcome').findOneAndUpdate({initial: {$exists: 1}}, {initial: false})
  } else res.send({ok: 0})
});

router.get('/logout', async (req, res) => {
  await req.session.destroy();
  res.redirect('/')
});

module.exports = router
