#!/usr/bin/env node
'use strict';

require('dotenv').config();
const
  debug = require('debug')('mock'),
  MongoClient = require('mongodb').MongoClient,
  ObjectID = require('mongodb').ObjectID,
  argv = require('yargs')
    .usage('Usage: ./$0\nInserts dummy data into entries table and unsets \'welcome\' flag')
    .help('h')
    .alias('h', 'help')
    .argv,
  bcrypt = require('bcrypt'),
  fs = require('fs'),
  EJSON = require('mongodb-extended-json');
var conn;
process.env.MONGO_SERVER = process.env.DYNO ? process.env.MONGO_SERVER_HEROKU : process.env.MONGO_SERVER_DEV;

MongoClient.connect(process.env.MONGO_SERVER)
  .then(client => (conn = client).db('diary'))
  .then(db => Promise.all([
    db.collection('sessions').remove({}),
    db.collection('entries').remove({})
      .then(() => db.collection('entries').createIndex({timestamp: 1}))
      .then(() => db.collection('entries').insertMany(EJSON.parse(fs.readFileSync('mock-data/MOCK_DATA.json', 'utf8'))))
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
