var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var common = require('./handler/common.js');
// var redis = require('./handler/redis.js');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var sampleRouter = require('./routes/sample');

var app = express();

// set cors
app.use(cors({
  origin: true,
  methods:['GET','POST','DELETE','PUT'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// set logger
logger.token('date', (req, res, tz) => {
  var p = new Date().toString().replace(/[A-Z]{3}\+/,'+').split(/ /);
  return( p[3]+'/'+p[1]+'/'+p[2]+' '+p[4]+' '+p[5] );
})
app.use(logger(
  (common.serverMode) == 'live' ? ':remote-addr - [:date[Asia/Seoul]] ":method :url" :status :res[content-length]' : 'dev'
));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(redis.session);
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/sample', sampleRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


var startAsyncInit = require('./object/init.js');
// module.exports = app;
module.exports = startAsyncInit(app).then((result) => {
  console.log("[ROR] Initial value setup");
  return app;
});