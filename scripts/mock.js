#!/usr/bin/env node
'use strict';

require('dotenv').config();
const
  debug = require('debug')('mock'),
  { MongoClient, ObjectId } = require('mongodb'),
  argv = require('yargs')
    .usage('Usage: ./$0\nInserts dummy data into entries table and unsets \'welcome\' flag')
    .option('m', { alias: 'mode', describe: 'Site mode. (Demo*/Full)', default: 'demo' })
    .help('h')
    .alias('h', 'help')
    .argv,
  bcrypt = require('bcrypt'),
  fs = require('fs'),
  faker = require('faker'),
  crypto = require('crypto');
var conn, db, mockData = [];
function createAuth () {
  return crypto.randomBytes(9).reduce((a, x, i) => {
    a[0] = (a[0] << 2) + (x >> 6);
    a[1].push(x & 63);
    if (!(++i % 3)) { a[1].push(a[0]); a[0] = 0 }
    return a
  }, [0, []])[1]
    .map((x, i) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[x])
    .join('')
};
process.env.MONGO_SERVER = process.env.DYNO ? process.env.MONGO_SERVER_HEROKU : process.env.MONGO_SERVER_DEV;


(async () => {
  for (let i = 0, a, b; i < 5; i++) {
    let entries = [];
    for (let j = 0; j < 1000; j++) {
      entries.push({
        entryid: ObjectId().toString(),
        timestamp: Date.now() - 1800000 + Math.floor(3600000 * Math.random()),
        title: faker.lorem.words(),
        body: faker.lorem.paragraphs(),
        filenames: []
      })
    }
    mockData.push(Object.assign({
      _id: ObjectId(),
      authid: a = createAuth(),
      hash: await bcrypt.hash(b = createAuth(), 10),
      entries,
      about: {
        timezone: 'Australia/Brisbane',
        initial: false
      }
    }, argv.mode.toLowerCase() == 'demo' ?
      {createdAt: new Date(entries.reduce((a, x) => Math.min(a, x.timestamp), Infinity) - 10000)}:
      {}));
    debug('* user %d: %s', i, a + '-' + b)
  }
  return Promise.resolve()
})().then(() => {
  MongoClient.connect(process.env.MONGO_SERVER)
  .then(client => (conn = client).db('diary'))
  .then(result => (db = result).dropDatabase())
  .then(() => Promise.all([
    db.createCollection('sessions').then(() => debug('Sessions dropped')),
    db.createCollection('accounts')
    .then(() => db.collection('accounts').createIndex({'createdAt': 1}))
    .then(() => db.collection('accounts').createIndex({'authid': 1, 'entries.timestamp': 1}))
    .then(() => db.collection('accounts').insertMany(mockData))
    .then(() => debug('Accounts and entries multiplied')),
    db.createCollection('images.chunks')
    .then(() => db.createCollection('images.files'))
    .then(() => db.collection('images.files').createIndex({filename: 1}))
    .then(() => debug('Images removed')),
    db.createCollection('welcome')
    .then(() => db.collection('welcome').bulkWrite(JSON.parse(process.env.MESSAGES).map(x => ({insertOne: {'document': x}}))))
    .then(() => debug('Welcome mat packed away'))
  ]))
  .catch(err => debug('*err %O', err)).then(() => conn && conn.close())
})
