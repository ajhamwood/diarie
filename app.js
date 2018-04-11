#!/usr/bin/env node
'use strict';

const HTTPServer = require('./httpserver.js');

async function diary (host, port) {
  host = process.env.HOST || host || '0.0.0.0';
  port = process.env.PORT || port || 8000;
  process.env.MONGO_SERVER = process.env.DYNO ? process.env.MONGO_SERVER_HEROKU : process.env.MONGO_SERVER_DEV;

  const httpserver = await new HTTPServer();
  return httpserver.listen(host, port)
}

const
  argv = require('yargs')
    .usage('Usage: ./$0 [options]')
    .alias('a', 'host')
    .describe('a', 'Host address. (localhost by default)')
    .alias('p', 'port')
    .describe('p', 'HTTP port. (8000 by default)')
    .help('h')
    .alias('h', 'help')
    .argv;

diary(argv.host, argv.port)
