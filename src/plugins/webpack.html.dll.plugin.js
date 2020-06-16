const url = require('url');

class WebpackHtmlDllPlugin {
  constructor({files}) {
    this.files = files;
  }
  apply(compiler) {
    const pluginName = 'webpack-html-dll-plugin';
    const hook = (compilation) => {
      if (!compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration) return;
      // console.log(Object.keys(compilation.hooks));
      compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration.tapAsync(pluginName, (data, cb) => {
        const { publicPath, js = []} = data.assets;
        data.assets.js = [
          ...(this.files || []).map(file => url.resolve(publicPath, file)),
          ...js
        ]
        cb(null, data)
      })
    };
    compiler.hooks.compilation.tap(pluginName, hook);
  }
}

module.exports = WebpackHtmlDllPlugin;