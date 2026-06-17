const express = require('express');
const bodyParser = require('body-parser');

function createWeb(config, context, deps) {
  const app = express();
  app.use(bodyParser.json());

  deps.routes.setup(app);

  return app;
}

module.exports = createWeb;
