const httpStatus = require('http-status');
const crypto = require('crypto');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const moment = require('moment-timezone');
const { jwtExpirationInterval } = require('../../config/vars');
const APIError = require('../utils/APIError');
const transporter = require('../../config/transporter');

/**
* Returns a formated object with tokens
* @private
*/
function generateTokenResponse(user, accessToken) {
  const tokenType = 'Bearer';
  const refreshToken = RefreshToken.generate(user).token;
  const expiresIn = moment().add(jwtExpirationInterval, 'minutes');
  return {
    tokenType, accessToken, refreshToken, expiresIn,
  };
}

/**
 * Returns jwt token if registration was successful
 * @public
 */
exports.register = async (req, res, next) => {
  try {
    const user = await (new User(req.body)).save();
    const userTransformed = user.transform();
    const token = generateTokenResponse(user, user.token());
    res.status(httpStatus.CREATED);
    return res.json({ token, user: userTransformed });
  } catch (error) {
    return next(User.checkDuplicateEmail(error));
  }
};

/**
 * Returns jwt token if valid username and password is provided
 * @public
 */
exports.login = async (req, res, next) => {
  try {
    const { user, accessToken } = await User.findAndGenerateToken(req.body);
    const token = generateTokenResponse(user, accessToken);
    const userTransformed = user.transform();
    return res.json({ token, user: userTransformed });
  } catch (error) {
    return next(error);
  }
};

/**
 * Returns a new jwt when given a valid refresh token
 * @public
 */
exports.refresh = async (req, res, next) => {
  try {
    const { email, refreshToken } = req.body;
    const refreshObject = await RefreshToken.findOneAndRemove({
      userEmail: email,
      token: refreshToken,
    });
    const { user, accessToken } = await User.findAndGenerateToken({email, refreshObject});
    const response = generateTokenResponse(user, accessToken);
    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

/**
 * Send reset password mail
 * @public
 */
exports.resetPassword = async (req, res, next) => {
  const user = await User.findUser({email: req.body.email});

  if (!user) {
    let err = new APIError({
      message: 'User does not exist',
      status: httpStatus.BAD_REQUEST,
    });
    return next(err);
  }

  let token = crypto.randomBytes(20).toString('hex'),
    data = {
      to: user.email,
      from: 'TomApp <petrica.horlescu13@gmail.com>',
      template: 'reset-password',
      subject: 'Reset password',
      context: {
        url: `${req.get('origin')}/set-password?token=${token}`,
        name: user.firstName
      }
    };

  user.reset_password_token = token;

  await transporter.sendMail(data);
  await user.save();

  res.send({success: true});
};

/**
 * Set new password
 * @public
 */
exports.setPassword = async (req, res, next) => {
  const user = await User.findUser({ reset_password_token: req.body.token });
  if (!user) {
    let err = new APIError({
      message: 'Invalid token or already used!',
      status: httpStatus.BAD_REQUEST,
    });
    return next(err);
  }

  await user.update({
    $set: {
      password: req.body.password
    },
    $unset: {
      reset_password_token: 1
    }
  });

  res.send({success: true});
};
