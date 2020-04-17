const path = require('path');
const url = require('url');
const webpack = require('webpack');
const utility = require('../../common/utility');
const {BuildStateEnum, BuildTypeEnum} = require('../enum');

module.exports = {
  modulesToEntry(modules = []) {
    return modules.reduce((memo, item, index) => {
      let name = item.name;
      if(!name) return memo;
      memo[name] = (memo[name] || []).concat(item.files);
      return memo;
    }, {});
  },
  setDevServerMiddleware(webpackConfig, middlewares = []){
    let devServer = webpackConfig.devServer;
    if(!devServer || !middlewares) return;
  
    if(!(middlewares instanceof Array)) {
      middlewares = [ middlewares ];
    }
    let before = devServer.before;
    // req: http.IncomingMessage, res: http.ServerResponse, next: NextFunction
    devServer.before = function(app) {
      for(let middleware of middlewares) {
        app.use(middleware);
      }
      return before && before(app);
    }
  },
  composeDllPackAsset(dllPackAssets = []) {
    const manifests = dllPackAssets.reduce((memo, dllPackAsset) => {
      return memo.concat(dllPackAsset.manifests || []);
    }, []);
  
    const files = dllPackAssets.reduce((memo, dllPackAsset) => {
      return memo.concat(dllPackAsset.files || []);
    }, []);

    return {
      manifests,
      files
    }
  },
  async webpackBuild(webpackConfig, fn = () => {}) {
    fn(BuildStateEnum.START);
    try {
      const compiler = webpack(webpackConfig);
      return new Promise((resolve, reject) => {
        compiler.run((error, handler) => {
          if(error) {
            fn(BuildStateEnum.ERROR, error);
            return resolve(false);
          }
          const compilation = handler.compilation || {};
          if(compilation.errors && compilation.errors.length) {
            fn(BuildStateEnum.ERROR, compilation.errors);
            return resolve(false);
          }
          fn(BuildStateEnum.DONE);
          resolve(compilation);
        });
      });
    } catch(e) {
      fn(BuildStateEnum.ERROR, e);
      return false;
    }
  },
  getPackAssetFiles(dllPackAssets = [], scopes = [], callback) {
    // 从 dllPackAssets 筛选出关联的 scopes 并且转换为 可以引入的资源地址
    return dllPackAssets.reduce((memo, dllPack) => {
      const scope = scopes.find(p => p.name === dllPack.name);
      if(!scope) return memo;
      let files = memo[scope.name];
      memo[scope.name] = (files || []).concat((dllPack.files || []).map(file => {
        return callback(scope, file);
      }));
      return memo;
    }, {});
  },
  async loadScopeFileContentAsync(scope, pathname) {
    const { output } = scope;
    if(!pathname ||  /^[\/.\\]$/.test(pathname)) {
      return {
        status: 404,
      };
    }
    let file = output;
    if(pathname[0] === '/' || pathname[0] === '\\') {
      file = path.join(file, '.' + pathname);
    } else {
      file = path.join(file, '.' + pathname);
    }
    if(!await utility.existsAsync(file)) {
      return {
        status: 404
      }
    }
    return {
      status: 200,
      content: await utility.readFileAsync(file)
    };
  },
  async loadEntryFile(compilation, entrys) {

    const webpackConfig = compilation.options || {};
    const {hash, fullhash, assets} = compilation;
    const {output, resolve, entry, plugins = []} = webpackConfig;

    const fileSystem = compilation.inputFileSystem;
    const readFileAsync = utility.bindPromise(fileSystem, fileSystem.readFile);
    const statAsync = utility.bindPromise(fileSystem, fileSystem.stat);

    const chunks = (compilation.chunks || []).filter(chunk => entrys.indexOf(chunk.name) > -1);
    if(!chunks.length) return [];

    return Promise.all(chunks.map(async (chunk) => {
      const targetPath = compilation.getPath(path.join(output.path, output.filename), {
        hash,
        chunk
      });
      const exists = await statAsync(targetPath).catch(e => null);
      let content = null;
      if(exists) {
        content = await readFileAsync(targetPath)
      }
      return {
        name: chunk.name,
        id: path.basename(targetPath, '.js'),
        target: targetPath,
        content
      }
    }));
  },
  /**
   * @param {*} webpackConfig 
   * @param {*} loaderOption 
   */
  upadateWebpackLoaderOption: (webpackConfig, loaderOption) => {
    let {rules = []} = webpackConfig.module || {};

    const findLoaderOption = (loaderPath) => {
      if(!loaderPath || typeof loaderPath !== 'string') return;
      const option = loaderOption[loaderPath];
      if(option) return option;
      const loaderOptionName = Object.keys(loaderOption).find(name => name && loaderPath.indexOf(name) > -1);
      return loaderOptionName && loaderOption[loaderOptionName];
    }

    const updateOptions = (loader) => {
      if(loader instanceof Array) {
        return loader.map(updateOptions);
      }
      if(loader && (loader.oneOf || loader.use)) {
        if(loader.oneOf) {
          loader.oneOf = updateOptions(loader.oneOf);
        }
        if(loader.use) {
          loader.use = updateOptions(loader.use);
        }
        return loader;
      }
      const useLoader = typeof loader === 'string' ? { loader } : loader;
      if(!useLoader) return loader;
      const option = findLoaderOption(useLoader.loader);
      return {
        loader: useLoader.loader,
        options: utility.merge(useLoader.options, option)
      }
    }
    webpackConfig.module.rules = updateOptions(rules);
  },
  getBuildName(entry = {}) {
    let names = [];
    if (entry instanceof Array) {
      names = entry;
    } else {
      names = Object.keys(entry);
    }
    names = [...new Set(names)];
    if (names.length > 2) {
      return names.slice(0, 2).join('、') + '等'
    }
    return names.join('、');
  }
}