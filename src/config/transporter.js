const nodemailer = require('nodemailer');
const config = require('./vars');
const handlebars = require('express-handlebars');
const hbs = require('nodemailer-express-handlebars');
const path = require('path');

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  auth: {
    user: config.mailUser,
    pass: config.mailPass
  }
});

transporter.use('compile', hbs({
  viewEngine: handlebars.create(),
  viewPath: path.resolve(__dirname, '../templates'),
  extName: '.handlebars'
}));

module.exports = transporter;
