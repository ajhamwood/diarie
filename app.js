#!/usr/bin/env node
'use strict';

const HTTPServer = require('./httpserver.js');

async function diary (host, port, mode, ttl) {
  host = process.env.HOST || host;
  port = process.env.PORT || port;
  process.env.MONGO_SERVER = process.env.DYNO ? process.env.MONGO_SERVER_HEROKU : process.env.MONGO_SERVER_DEV;

  const httpserver = await new HTTPServer(mode, ttl);
  return httpserver.listen(host, port)
}

const
  argv = require('yargs')
    .usage('Usage: ./$0 [options]\nRuns Diary application server.')
    .option('a', { alias: 'host', descripbe: 'Host address. (0.0.0.0)', default: '0.0.0.0' })
    .option('p', { alias: 'port', describe: 'HTTP port. (8000)', default: 8000 })
    .option('m', { alias: 'mode', describe: 'Site mode. (Demo*/Full)', default: 'demo' })
    .help('h')
    .alias('h', 'help')
    .argv;

if (argv.mode.toLowerCase() == 'full' && 'ttl' in argv) console.log('Option ttl is only meaningful in demo mode. Ignoring.')
diary(argv.host, argv.port, argv.mode.toLowerCase(), argv.ttl || 3600)
