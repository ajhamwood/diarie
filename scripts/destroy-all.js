#!/usr/bin/env node
'use strict';

require('dotenv').config();
const
  debug = require('debug')('destroy-all'),
  { MongoClient } = require('mongodb'),
  argv = require('yargs')
    .usage('Usage: ./$0\nRemoves all accounts and data and resets the \'welcome\' flag.')
    .help('h')
    .alias('h', 'help')
    .argv,
  inquirer = require('inquirer');
var conn, db;
process.env.MONGO_SERVER = process.env.DYNO ? process.env.MONGO_SERVER_HEROKU : process.env.MONGO_SERVER_DEV;


inquirer.prompt({type: 'confirm', name: 'confirm', message: 'This program irreversibly destroys all data stored by Diary. Continue?'}).then(answer => {
  if (answer.confirm) {
    MongoClient.connect(process.env.MONGO_SERVER)
    .then(client => (conn = client).db('diarie'))
    .then(result => (db = result).dropDatabase())
    .then(() => Promise.all([
      db.createCollection('sessions').then(() => debug('Sessions dropped')),
      db.createCollection('accounts')
      .then(() => db.collection('accounts').createIndex({'createdAt': 1}))
      .then(() => db.collection('accounts').createIndex({'authid': 1, 'entries.timestamp': 1}))
      .then(() => debug('Accounts dropped')),
      db.createCollection('images.chunks')
      .then(() => db.createCollection('images.files'))
      .then(() => db.collection('images.files').createIndex({filename: 1}))
      .then(() => debug('Images removed')),
      db.createCollection('welcome')
      .then(() => db.collection('welcome').bulkWrite(JSON.parse(process.env.MESSAGES).map(x => ({insertOne: {'document': x}}))))
      .then(() => debug('Welcome mat rolled out'))
    ]))
    .catch(err => debug('*err %O', err)).then(() => conn && conn.close())
  } else debug('Did nothing')
})
