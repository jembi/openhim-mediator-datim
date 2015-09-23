'use strict';

const http = require('http');

const taskRes = [
  {
    'uid': 'hpiaeMy7wFX',
    'level': 'INFO',
    'category': 'DATAVALUE_IMPORT',
    'time': '2015-09-02T07:43:14.595+0000',
    'message': 'Import done',
    'completed': true
  }
];

let numTaskReqs = 0;

let server = http.createServer((req, res) => {
  console.log(`Recieved a request to ${req.url}`);
  console.log(`  with headers: ${JSON.stringify(req.headers)}`);
  console.log(`  with body...`);
  req.on('data', (chunk) => {
    console.log(chunk.toString());
  });

  req.on('end', () => {
    if (req.url.includes('dataValueSets')) {
      res.writeHead(200, { 'Content-Type': 'application/xml'});
      res.end();
    } else if (req.url.includes('tasks')) {
      numTaskReqs++;
      res.writeHead(200, { 'Content-Type': 'application/xml'});
      if (numTaskReqs % 3 === 0) {
        taskRes[0].completed = true;
      } else {
        taskRes[0].completed = false;
      }
      res.end(JSON.stringify(taskRes));
    }
  });
});

server.listen(8081, () => console.log('listening on 8081...'));
