'use strict';

require('dotenv').config();
const
  debug = require('debug')('diary'),
  express = require('express'),
  RateLimit = require('express-rate-limit'),
  helmet = require('helmet'),
  compression = require('compression'),
  { MongoClient } = require('mongodb'),
  session = require('express-session'),
  MongoStore = require('connect-mongo')(session),
  bodyParser = require('body-parser'),
  hbs = require('express-hbs'),
  crypto = require('crypto');

class HTTPServer {
  constructor () {
    var retryConn;
    this.app = express();
    this.app.createAuth = () => {
      return crypto.randomBytes(18).reduce((a, x, i) => {
        a[0] = (a[0] << 2) + (x >> 6);
        a[1].push(x & 63);
        if (!(++i % 3)) { a[1].push(a[0]); a[0] = 0 }
        return a
      }, [0, []])[1]
        .map((x, i) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[x] + (i == 11 ? '-' : ''))
        .join('')
    }

    // Connect to database

    return (retryConn = () => MongoClient.connect(process.env.MONGO_SERVER, {autoReconnect: false})
      .then(() => MongoClient.connect(process.env.MONGO_SERVER))
      .then(client => {
        debug('Connected to MongoDB');
        return this.app.db = client.db('diary')
      })
      .catch(err => {
        debug('*err %s', err.name);
        return new Promise(resolve => setTimeout(resolve, 1000)).then(retryConn)
      })
    )().then(db => {

      // Middleware

      this.app.enable('trust proxy');

      var limiter = new RateLimit({
        windowMs: 15*60*1000,
        delayAfter: 100,
        delayMs: 3*1000,
        max: 200,
        message: "Flood limit"
      });

      this.app.use(helmet());
      this.app.use(compression());
      this.app.use(session({
        resave: false,
        saveUninitialized: false,
        secret: process.env.SECRET,
        name: 'sessionId',
        store: new MongoStore({ db }),
        cookie: {
          secure: true/*,
          maxAge: -1>>>1*/
        },
        rolling: true,
        unset: 'destroy',
        proxy: true
      }));

      this.app.use(bodyParser.urlencoded({ extended: true }));
      this.app.use(express.static('public'));

      this.app.engine('hbs', hbs.express4({
        layoutsDir: __dirname + '/views/layouts',
        defaultLayout: __dirname + '/views/layouts/main'
      }));
      hbs.registerHelper('paginate', function (block) {
        let acc = '', {pp, np, count} = block.data.root, pages;
        return [1, np - 2, np - 1, np, np + 1, np + 2, pages = Math.ceil(count / pp)].reduce(
          (a, x, i) => (i != 0 && x <= 1) || (i != 6 && x >= pages) ? a :
          a + block.fn({num: x, start: 1 + (x - 1) * pp, end: Math.min(x * pp, count), pp, cur: x == np}), ""
        )
      });
      hbs.registerHelper('pagelength', function (list, block) {
        return list.split(', ').reduce((a, x) => a + block.fn({val: parseInt(x), active: x == block.data.root.pp}), "")
      });
      hbs.registerHelper('succ', function (val) { return parseInt(val) + 1 });
      this.app.set('view engine', 'hbs');
      this.app.set('views', __dirname + '/views');

      this.app.use(limiter);

      // Routes

      this.app.use(require('./controllers/beforeController.js'));

      this.app.use(require('./controllers/rootController.js'));
      this.app.use(require('./controllers/imagesController.js'));
      this.app.use(require('./controllers/createController.js'));
      this.app.use(require('./controllers/updateController.js'));
      this.app.use(require('./controllers/deleteController.js'));
      this.app.use(require('./controllers/optionsController.js'));

      this.app.use((req, res) => res.redirect('/'))
      return this
    })
  }

  listen (host, port) {
    return new Promise((resolve, reject) => this.server = this.app.listen(port, host, err => {
      if (err) return reject(err);
      resolve(this.server)
    }))
      .then(server => debug('Listening on port %d', server.address().port))
      .catch(err => debug('*err %O', err))
  }
};

module.exports = HTTPServer
