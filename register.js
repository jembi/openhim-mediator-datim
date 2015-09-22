'use strict';

const request = require('request');
const crypto = require('crypto');

exports.registerMediator = (apiConfig, mediatorConfig, callback) => {
  console.log(`Attempting to create/update mediator...`);

  // used to bypass self signed certificates
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  // define login credentails for authorization
  const username = apiConfig.username;
  const password = apiConfig.password;
  const apiURL = apiConfig.apiURL;

  // authenticate the username
  request.get(`${apiURL}/authenticate/${username}`, (err, resp, body) => {
    body = JSON.parse(body);

    if (err){
      callback(err);
    }

    // if user isnt found
    if (resp.statusCode !== 200) {
      callback(new Error(`User ${username} not found when authenticating with core API`));
    }

    // create passhash
    let shasum = crypto.createHash('sha512');
    shasum.update(body.salt + password);
    let passhash = shasum.digest('hex');

    // create token
    shasum = crypto.createHash('sha512');
    shasum.update(passhash + body.salt + body.ts);
    let token = shasum.digest('hex');

    // define request headers with auth credentails
    let options = {
      url: `${apiURL}/mediators`,
      json: true,
      headers: {
        'auth-username': username,
        'auth-ts': body.ts,
        'auth-salt': body.salt,
        'auth-token': token
      },
      body: mediatorConfig
    };

    // POST mediator to API for creation/update
    request.post(options, (err, resp) => {
      if (err){
        callback(err);
      }

      // check the response status from the API server
      if (resp.statusCode === 201) {
        // successfully created/updated
        callback();
      } else {
        callback(new Error(`Recieved a non-201 response code, the response body was: ${resp.body}`));
      }
    });
  });
};
