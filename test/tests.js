'use strict';

const request = require('request');
const fs = require('fs');
const config = require('../config/config');
config.register = false;
require('./test-dhis-server');
require('../index');

let options = {
  url: 'http://localhost:3000',
  body: fs.readFileSync('test/adx.xml'),
  headers: {
    'Content-Type': 'application/xml'
  }
};

request.post(options, (err, response, body) => {
  if (err) {
    console.log(err.stack);
    process.exit(1);
  }

  if (response.statusCode !== 200) {
    process.exit(1);
  }

  console.log('SUCCESS!');
  process.exit(0);
});
