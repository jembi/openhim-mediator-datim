[![Build Status](https://travis-ci.org/jembi/openhim-mediator-datim.svg?branch=master)](https://travis-ci.org/jembi/openhim-mediator-datim)

**Repo Owner:** Vlad Shioshvili [@vshioshvili](https://github.com/vshioshvili)


# DATIM node polling mediator

This mediator is responsible for forwarding ADX requests from DATIM node to DATIM global to be imported. It then polls global for an import status and once the import is completed, it forwards the final response to the ADX adapter where the results are displayed to the user.

## Dev guide

To run the mediator execute the following:

```
$ npm install
$ npm start
```

There is a test server that acts as DHIS2 which you can also run for local testing: `$ node test/test-dhis-server.js`

Then you can test the mediator by running the following from the `test/` directory: `$ curl -d @adx.xml http://localhost:3000`.

There are also some basic automated test that you can run with `npm test`.
