'use strict';

// load modules
const express = require('express');
const fs = require('fs');
const request = require('request');
const url = require('url');
const winston = require('winston');

const app = express();
winston.clear();
winston.add(winston.transports.Console, { timestamp: true, colorize: true });

// Config
var config; // this will vary depending on whats set in openhim-core
const apiConf = require('./config/config');
const mediatorConfig = require('./config/mediator');

const utils = require('openhim-mediator-utils');

const key = fs.readFileSync('tls/key.pem');
const cert = fs.readFileSync('tls/cert.pem');
let ca = null;
try {
  ca = fs.readFileSync('tls/ca.pem');
  winston.info('ca.pem file found, only trusting CAs from that file');
} catch (err) {
  winston.info('No ca.pem file found, using built in CAs');
}

function setupAndStartApp() {
  app.post('*', (req, res) => {
    winston.info('Recieved a new request for processing...');
    let query = url.parse(req.url, true).query;
    let adxAdapterID = null;
    if (query.adxAdapterID) {
      adxAdapterID = query.adxAdapterID;
      delete query.adxAdapterID;
    }
    if (config.upstreamAsync === true) {
      query.async = true;
    }
    let options = {
      url: config.upstreamURL,
      key: key,
      cert: cert,
      ca: ca,
      qs: query
    };
    winston.info('Piping the request to an upstream server', options.url);
    req.pipe(request.post(options, (err, upstreamRes, upstreamBody) => {

      if (err) {
        winston.error('Couldn\'t pipe request to upstream server', err);
        res.status(500).send(err);
        return;
      }

      if (config.upstreamAsync) {
        if (upstreamRes.statusCode === 200 || upstreamRes.statusCode === 202) {
          startPolling(adxAdapterID);
        } else {
          winston.error('Unknown status code recieved: ' + upstreamRes.statusCode);
        }
      } else {
        forwardResponse(upstreamRes.statusCode, upstreamBody, adxAdapterID);
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
    winston.info(`DATIM mediator listening on http://${host}:${port}`);
    winston.info('Mediator started with config:', config);
  });
}

function forwardResponse(statusCode, body, adxAdapterID) {
  winston.info('Forwarding response to receiver...');
  let options = {
    url: config.receiverURL + '/' + adxAdapterID,
    key: key,
    cert: cert,
    ca: ca,
    body: { code: statusCode, message: body },
    json: true
  };
  request.put(options, (err, res) => {
    if (err) {
      return winston.error('Unable to forward response to receiver', err);
    }
    winston.info('Response forwarded to receiver', res.statusCode);
  });
}

function fetchTaskSummaries(callback) {
  winston.info('Fetching task summaries');
  if (!callback) { callback = () => {}; }

  let options = {
    url: config.upstreamTaskSummariesURL,
    key: key,
    cert: cert,
    ca: ca,
    json: true
  };
  request.get(options, (err, res, body) => {
    if (err) {
      return callback(err);
    }
    try {
      callback(null, body);
    } catch (err) {
      callback(err);
    }
  });
}

function startPolling(adxAdapterID) {
  winston.info(`Started polling for task status at an interval of ${config.pollingInterval}ms...`);
  let errCount = 0;
  // setup task polling
  var statusInterval = setInterval(() => {
    getImportStatus((err, body) => {
      if (err) {
        winston.error('Unable to get import status', err);
        errCount++;
        if (errCount > config.maxStatusReqErrors) {
          clearInterval(statusInterval);
          forwardResponse(500, err, adxAdapterID);
        }
        return;
      }
      winston.info(`Received task status: ${JSON.stringify(body)}`);
      if (body[0].completed) {
        winston.info('Completed; stop polling');
        clearInterval(statusInterval);
        fetchTaskSummaries((err, summary) => {
          forwardResponse(200, { lastTaskStatus: body[0], importSummary: summary }, adxAdapterID);
        });
      }
    });
  }, config.pollingInterval);
}

function getImportStatus(callback) {
  if (!callback) { callback = () => {}; }

  let options = {
    url: config.upstreamTaskURL,
    key: key,
    cert: cert,
    ca: ca,
    json: true
  };
  request.get(options, (err, res, body) => {
    if (err) {
      return callback(err);
    }
    try {
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
      winston.error('Failed to register this mediator, check your config');
      winston.error(err);
      process.exit(1);
    }
    apiConf.api.urn = mediatorConfig.urn;
    utils.fetchConfig(apiConf.api, (err, newConfig) => {
      winston.info('Received initial config:');
      winston.info(JSON.stringify(newConfig));
      config = newConfig;
      if (err) {
        winston.error('Failed to fetch initial config');
        winston.error(err);
        process.exit(1);
      } else {
        winston.info('Successfully registered mediator!');
        setupAndStartApp();
        let configEmitter = utils.activateHeartbeat(apiConf.api);
        configEmitter.on('config', (newConfig) => {
          winston.info('Received updated config:');
          winston.info(JSON.stringify(newConfig));
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
