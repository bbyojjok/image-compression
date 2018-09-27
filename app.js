const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const route = require('./routes');
const app = express();
const port = 889;

app.locals.pretty = true;
app.set('views', './views');
app.set('view engine', 'pug');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(compression());
app.use(helmet());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/', route);

app.listen(port, () => {
	console.log(`Connected, ${port} port !`);
});
