'use strict';

// load modules
const request = require('request');
const express = require('express');
const app = express();

// get config objects
const config = require('./config/config');
const apiConfig = config.api;
const mediatorConfig = require('./config/mediator');

// include register script
const register = require('./register');
register.registerMediator(apiConfig, mediatorConfig, (err) => {
  if (err) {
    console.log('Failed to register this mediator, check your config');
    console.log(err.stack);
    process.exit(1);
  } else {
    console.log('Successfully registered mediator!');
  }

  app.post('/', (req, res) => {

    req.pipe(request.post(config.upstreamEndpoint, (err, upstreamRes, upstreamBody) => {

      if (err) {
        console.log(err.stack);
        return;
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

  var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log(`DATIM mediator listening on http://${host}:${port}`);
  });
});

// export app for use in grunt-express module
module.exports = app;
