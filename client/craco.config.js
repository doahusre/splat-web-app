const { whenDev } = require("@craco/craco");

module.exports = {
  devServer: whenDev(() => ({
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin"
    }
  }))
};
