class WebpackTestPlugin {
  apply(compiler) {
    const hook = async (compilation, cb) => {
      const stats = compilation.getStats().toJson();
      /**
       * console.log(stats.chunks[0].origins);
       * [ { moduleId: './webapp/index.js',request: './pages/demo',]
       */
      // console.log(stats.assets);
      cb();
    };
    compiler.hooks.emit.tapAsync('webpack-test-plugin', hook);
  }
}

module.exports = WebpackTestPlugin;