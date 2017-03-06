'use strict';

const http = require('http');

const taskRes = [
  {
    'uid': 'hpiaeMy7wFX',
    'level': 'INFO',
    'category': 'DATAVALUE_IMPORT',
    'time': '2015-09-02T07:43:14.595+0000',
    'message': 'Processing',
    'completed': false
  },
  {
    'uid': 'hpiaeMy7wFF',
    'level': 'INFO',
    'category': 'DATAVALUE_IMPORT',
    'time': '2015-09-02T07:45:18.700+0000',
    'message': 'Processing',
    'completed': false
  }
];

let numTaskReqs = 0;
const noop = () => {};

exports.startUpstreamServer = (reqCallback) => {
  if (!reqCallback) { reqCallback = noop; }

  // upstream server
  let upstreamServer = http.createServer((req, res) => {
    console.log(`Received a request to ${req.url}`);
    console.log(`  with headers: ${JSON.stringify(req.headers)}`);
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      if (body) {
        console.log(`  with body: ${body}`);
      }
      if (req.url.includes('dataValueSets') || req.url.includes('taskSummaries')) {
        res.writeHead(200, { 'Content-Type': 'application/xml'});
        res.end('Some Body');
        reqCallback(req, body);
      } else if (req.url.includes('tasks')) {
        numTaskReqs++;
        res.writeHead(200, { 'Content-Type': 'application/xml'});
        if (numTaskReqs % 3 === 0) {
          taskRes[0].completed = true;
          taskRes[0].message = 'ADX data import done';
        }
        res.end(JSON.stringify(taskRes));
        reqCallback(req, body);
      }
    });
  });

  upstreamServer.listen(8081, () => console.log('listening on 8081...'));
};

exports.startRecServer = (reqCallback) => {
  if (!reqCallback) { reqCallback = noop; }

  // receiver server
  let recServer = http.createServer((req, res) => {
    console.log(`Received a request to ${req.url}`);
    console.log(`  with headers: ${JSON.stringify(req.headers)}`);
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      console.log(`  with body: ${body}`);
      res.writeHead(200, { 'Content-Type': 'application/xml'});
      res.end();
      reqCallback(req, body);
    });
  });

  recServer.listen(8082, () => console.log('listening on 8082...'));
};

if (!module.parent) {
  exports.startUpstreamServer();
  exports.startRecServer();
}
