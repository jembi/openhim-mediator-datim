'use strict';

// load modules
const request = require('request');
const express = require('express');
const app = express();

// get config objects
const config = require('./config/config');
const apiConf = config.api;
const dhisConf = config.dhis;
const mediatorConfig = require('./config/mediator');

// include register script
const register = require('./register');

function setupAndStartApp() {
  app.post('/', (req, res) => {
    let url = `${dhisConf.scheme}://${dhisConf.host}:${dhisConf.port}/${dhisConf.basePath}/${dhisConf.adxPath}?async=${dhisConf.async}`;
    console.log(url);
    req.pipe(request.post(url, (err, upstreamRes, upstreamBody) => {

      if (err) {
        console.log(err.stack);
        return;
      }

      if (dhisConf.async && upstreamRes.statusCode === 200) {
        startPolling();
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

function startPolling() {
  // setup task polling
  var statusInterval = setInterval(() => getImportStatus((err, body) => {
    if (err) {
      console.log(err.stack);
    }
    console.log(`Recieved task status: ${JSON.stringify(body)}`);
    if (body[0].completed) {
      console.log('Completed, stopping interval');
      clearInterval(statusInterval);
      // TODO forward to adapter
    }
  }), config.pollingInterval);
}

function getImportStatus(callback) {
  if (!callback) { callback = () => {}; }
  let url = `${dhisConf.scheme}://${dhisConf.host}:${dhisConf.port}/${dhisConf.basePath}/${dhisConf.taskPath}`;
  request.get(url, (err, res, body) => {
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

if (config.register) {
  register.registerMediator(apiConf, mediatorConfig, (err) => {
    if (err) {
      console.log('Failed to register this mediator, check your config');
      console.log(err.stack);
      process.exit(1);
    } else {
      console.log('Successfully registered mediator!');
      setupAndStartApp();
    }
  });
} else {
  setupAndStartApp();
}

// export app for use in grunt-express module
module.exports = app;
