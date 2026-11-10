/**
 * app.json holds the configuration. This file only lets a build override how the web app is
 * produced: SKANU_WEB_OUTPUT=single makes a static single-page site (no server routes), which
 * can be hosted anywhere but cannot import from links or use the AI features.
 */
module.exports = ({ config }) => {
  const output = process.env.SKANU_WEB_OUTPUT;
  if (output) config.web = { ...config.web, output };
  return config;
};
