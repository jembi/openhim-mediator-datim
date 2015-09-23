'use strict';

const request = require('request');
const fs = require('fs');
const config = require('../config/config');
config.register = false;
config.pollingInterval = 10;
const testSer = require('./test-servers');

let receiverCalled = false;
testSer.startUpstreamServer();
testSer.startRecServer(() => {
  receiverCalled = true;
});

// run main app
require('../index');

let options = {
  url: 'http://localhost:3000',
  body: fs.readFileSync('test/adx.xml'),
  headers: {
    'Content-Type': 'application/xml'
  }
};

request.post(options, (err, response) => {
  if (err) {
    console.log(err.stack);
    process.exit(1);
  }

  if (response.statusCode !== 200) {
    process.exit(1);
  }

  setTimeout(() => {
    if (receiverCalled) {
      console.log('SUCCESS!');
      process.exit(0);
    } else {
      console.log('Receiver not called');
      process.exit(1);
    }
  }, 100);
});
