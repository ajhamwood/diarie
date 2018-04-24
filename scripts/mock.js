#!/usr/bin/env node
'use strict';

require('dotenv').config();
const
  debug = require('debug')('mock'),
  { MongoClient, ObjectId } = require('mongodb'),
  argv = require('yargs')
    .usage('Usage: ./$0\nInserts dummy data into entries table and unsets \'welcome\' flag')
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
}
process.env.MONGO_SERVER = process.env.DYNO ? process.env.MONGO_SERVER_HEROKU : process.env.MONGO_SERVER_DEV;


(async () => {
  for (let j = 0; j < 1000; j++) {
    mockData.push({
      _id: ObjectId(),
      title: faker.lorem.words(),
      body: faker.lorem.paragraphs(),
      timestamp: Date.now() - 8.64e+9 + Math.floor(1.728e+10 * Math.random()),
      filenames: []
    })
  }
  return Promise.resolve()
})().then(() => {
  MongoClient.connect(process.env.MONGO_SERVER)
    .then(client => (conn = client).db('diary'))
    .then(db => Promise.all([
      db.collection('sessions').remove({}),
      db.collection('entries').remove({})
        .then(() => db.collection('entries').createIndex({timestamp: 1}))
        .then(() => db.collection('entries').insertMany(mockData))
        .then(() => debug("Diary entries multiplied")),
      db.collection('images.chunks').remove({})
        .then(() => db.collection('images.files').remove({}))
        .then(() => debug('Images removed')),
      db.collection('options').remove({})
        .then(async () => db.collection('options').insertMany([
          {option: 'timezone', timezone: 'Australia/Brisbane'},
          {option: 'auth', hash: await bcrypt.hash('1', 10)}
        ]))
        .then(() => debug('Options faked')),
      db.collection('welcome').remove({})
        .then(() => db.collection('welcome').insertOne({initial: false}))
        .then(() => debug('Welcome mat packed away'))
    ]))
    .catch(err => debug('*err %O', err)).then(() => conn && conn.close())
})
