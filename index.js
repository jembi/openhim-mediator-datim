'use strict';

// load modules
const request = require('request');
const fs = require('fs');
const express = require('express');
const app = express();

// Config
var config; // this will vary depending on whats set in openhim-core
const apiConf = require('./config/config');
const mediatorConfig = require('./config/mediator');

const utils = require('openhim-mediator-utils');

const key = fs.readFileSync('tls/key.pem');
const cert = fs.readFileSync('tls/cert.pem');
const ca = fs.readFileSync('tls/ca.pem');

function setupAndStartApp() {
  app.post('/', (req, res) => {
    let options = {
      url: `${config.dhisScheme}://${config.dhisUsername}:${config.dhisPassword}@${config.dhisHost}:${config.dhisPort}/${config.dhisBasePath}/${config.dhisAdxPath}?async=${config.dhisAsync}`,
      key: key,
      cert: cert,
      ca: ca
    };
    console.log(options.url);
    req.pipe(request.post(options, (err, upstreamRes, upstreamBody) => {

      if (err) {
        console.log(err.stack);
        return;
      }

      if (config.dhisAsync) {
        if (upstreamRes.statusCode === 200) {
          startPolling();
        }
      } else {
        forwardResponse(upstreamBody);
      }

      var urn = mediatorConfig.urn;
      var status = 'Successful';
      var response = {
        status: upstreamRes.statusCode,
        headers: upstreamRes.headers,
        body: upstreamBody,
        timestamp: new Date().getTime()
      };

      // construct returnObject to be returned
      var returnObject = {
        'x-mediator-urn': urn,
        'status': status,
        'response': response,
        'orchestrations': [],
        'properties': {}
      };

      // set content type header so that OpenHIM knows how to handle the response
      res.set('Content-Type', 'application/json+openhim');
      res.send(returnObject);

    }));
  });

  // setup express server
  let server = app.listen(3000, function () {
    let host = server.address().address;
    let port = server.address().port;
    console.log(`DATIM mediator listening on http://${host}:${port}`);
  });
}

function forwardResponse(task) {
  let options = {
    url: `${config.receiverScheme}://${config.receiverHost}:${config.receiverPort}/${config.receiverPath}`,
    key: key,
    cert: cert,
    ca: ca,
    body: task,
    json: true
  };
  request.post(options, (err) => {
    if (err) {
      console.log(err.stack);
    }
    console.log('Message received by receiver');
  });
}

function startPolling() {
  // setup task polling
  var statusInterval = setInterval(() => getImportStatus((err, body) => {
    if (err) {
      console.log(err.stack);
    }
    console.log(`Received task status: ${JSON.stringify(body)}`);
    if (body[0].completed) {
      console.log('Completed, stopping interval');
      clearInterval(statusInterval);
      forwardResponse(body[0]);
    }
  }), config.pollingInterval);
}

function getImportStatus(callback) {
  if (!callback) { callback = () => {}; }

  let options = {
    url: `${config.dhisScheme}://${config.dhisHost}:${config. dhisPort}/${config.dhisBasePath}/${config.dhisTaskPath}`,
    key: key,
    cert: cert,
    ca: ca
  };
  request.get(options, (err, res, body) => {
    if (err) {
      return callback(err);
    }
    try {
      body = JSON.parse(body);
      callback(null, body);
    } catch (err) {
      callback(err);
    }
  });
}

// start-up procedure
if (apiConf.register) {
  utils.registerMediator(apiConf.api, mediatorConfig, (err) => {
    if (err) {
      console.log('Failed to register this mediator, check your config');
      console.log(err.stack);
      process.exit(1);
    }
    apiConf.api.urn = mediatorConfig.urn;
    utils.fetchConfig(apiConf.api, (err, newConfig) => {
      console.log('Received initial config:');
      console.log(JSON.stringify(newConfig));
      config = newConfig;
      if (err) {
        console.log('Failed to fetch initial config');
        console.log(err.stack);
        process.exit(1);
      } else {
        console.log('Successfully registered mediator!');
        setupAndStartApp();
        let configEmitter = utils.activateHeartbeat(apiConf.api);
        configEmitter.on('config', (newConfig) => {
          console.log('Received updated config:');
          console.log(JSON.stringify(newConfig));
          config = newConfig;
        });
      }
    });
  });
} else {
  // default to config from mediator registration
  config = mediatorConfig.config;
  setupAndStartApp();
}
