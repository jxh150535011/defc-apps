const path = require('path');
const url = require('url');
const { ConcatSource } = require("webpack-sources");
const utility = require('../common/utility');

/**
 * 只针对所有入口js 进行依赖注入
 */
const injectDeps = (compilation, assets, chunk, deps) => {
  let depFiles = deps[chunk.name] || [];

  const {hash} = compilation;
  const webpackConfig = compilation.options || {};
  const {output} = webpackConfig;

  const libraryName = compilation.getPath(output.library, {
    hash,
    chunk
  });

  const fileName = chunk.files[0];
  const asset = assets[fileName];
  if(!asset) return;
  // const source = asset.source();

  const strDeps = depFiles.map(file => `'${file}'`).join(',');

  compilation.updateAsset(
    fileName,
    old => new ConcatSource(
      `define([${strDeps}],function(){\n`,
      old,
      '\n',
      `return ${libraryName};`,
      '})'
    )
  );

  /*
  let content = [
    `
define([${strDeps}],function(){
  ${source}
  return ${libraryName};
})
`
  ].join('\n');
  assets[fileName] = {
    source: () => content,
    size: () => content.length,
  };
  */
}

class WebpackScopeModulePlugin {
  constructor({deps = {}}) {
    this.deps = deps;
  }
  apply(compiler) {
    const pluginName = 'webpack-scope-module-plugin';
    const hook = (compilation, cb) => {
      // const stats = compilation.getStats().toJson();
      // const webpackConfig = compilation.options || {};
      const {assets} = compilation;

      const chunks = compilation.chunks || [];
      for(let i = 0, len = chunks.length; i < len; i++ ) {
        if(chunks[i].name) { // 存在name值 意味着属于入口，对于所有入口js 注入依赖
          injectDeps(compilation, assets, chunks[i], this.deps);
        }
      }

      // 直接拷贝 不存放到 assets 中
      /*
      for(let i = 0,len = this.copyOptions.length; i < len ;i++) {
        let copyOption = this.copyOptions[i];
        let files = await utility.loadFilesAsync(copyOption.from, {
          match:copyOption.test
        });
        
        for(let j = 0, count = files.length; j < count; j++ ){
          let file = files[j];
          let relative = path.relative(copyOption.from, file);
          let out = path.join(copyOption.to, relative);
          await utility.copyFileAsync(file, out);
        }
      }
      */
      // cb();
    };

    

    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      compilation.hooks.optimizeChunkAssets.tap(pluginName, (chunks) => {
        const {assets} = compilation;

        for(let i = 0, len = chunks.length; i < len; i++ ) {
          if(chunks[i].name) { // 存在name值 意味着属于入口，对于所有入口js 注入依赖
            injectDeps(compilation, assets, chunks[i], this.deps);
          }
        }
      })
    });
  }
}

module.exports = WebpackScopeModulePlugin;