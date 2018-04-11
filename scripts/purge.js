#!/usr/bin/env node
'use strict';

require('dotenv').config();
const
  debug = require('debug')('purge'),
  MongoClient = require('mongodb').MongoClient,
  argv = require('yargs')
    .usage('Usage: ./$0\nRemoves all diary entries and resets the \'welcome\' flag.')
    .help('h')
    .alias('h', 'help')
    .argv;
var conn, entries;
process.env.MONGO_SERVER = process.env.DYNO ? process.env.MONGO_SERVER_HEROKU : process.env.MONGO_SERVER_DEV;


MongoClient.connect(process.env.MONGO_SERVER)
  .then(client => (conn = client).db('diary'))
  .then(db => (entries = JSON.parse(process.env.MESSAGES), db)).then(db => Promise.all([
    db.collection('sessions').remove({}),
    db.collection('entries').remove({})
      .then(() => db.collection('entries').createIndex({timestamp: 1}))
      .then(() => db.collection('entries').insertOne(entries.find(x => x.message == 1).value))
      .then(() => debug('Diary entries reset')),
    db.collection('images.chunks').remove({})
      .then(() => db.collection('images.files').remove({}))
      .then(() => debug('Images removed')),
    db.collection('options').remove({})
      .then(() => db.collection('options').save({option: 'timezone', timezone: 'Australia/Brisbane'}))
      .then(() => debug('Options reset')),
    db.collection('welcome').remove({})
      .then(() => db.collection('welcome').insertOne({initial: true}))
      .then(() => db.collection('welcome').bulkWrite(entries.map(x => ({insertOne: {'document': x}}))))
      .then(() => debug('Welcome mat rolled out'))
  ]))
  .catch(err => debug('*err %O', err)).then(() => conn && conn.close())
