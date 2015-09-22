'use strict';

const http = require('http');

let server = http.createServer((req, res) => {
  console.log(`Recieved a request to ${req.url}`);
  console.log(`  with headers: ${JSON.stringify(req.headers)}`);
  console.log(`  with body...`);
  req.on('data', (chunk) => {
    console.log(chunk.toString());
  });

  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/xml'});
    res.end();
  });
});

server.listen(8081, () => console.log('listening on 8081...'));
