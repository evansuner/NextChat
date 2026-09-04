const { transform } = require("@svgr/core");
const jsx = require("@svgr/plugin-jsx");
const svgo = require("@svgr/plugin-svgo");

module.exports = function svgrLoader(source) {
  const callback = this.async();

  transform(source.toString(), {
    filename: this.resourcePath,
    plugins: [svgo, jsx],
  }).then(
    (code) => callback(null, code),
    (error) => callback(error),
  );
};
