// Middleware to ensure user is authenticated
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to access this page.');
  res.redirect('/users/login');
};

// Middleware to ensure user is not authenticated (for login/register pages)
const ensureGuest = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  return next();
};

// Middleware to make user available in all templates
const makeUserAvailable = (req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
};

module.exports = {
  ensureAuthenticated,
  ensureGuest,
  makeUserAvailable
};