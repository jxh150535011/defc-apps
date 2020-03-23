const url = require('url');
const path = require('path');
const util = require('util');
const webpack = require('webpack');
const terser = require('terser');
const utility = require('../common/utility');
const config = require('../config');


class WebpackLibPlugin {
  constructor({entry, done, path}) {
    this.entry = entry;
    this.done = done;
    this.manifestPathName = path;
    this.chunks = {};
  }
  async loadTerserFilesContent(files = []) {
    const loadTerserFiles = async (file) => {
      try {
        if(!file) return `${file} undefined`;
        const content = await utility.readFileAsync(file);
        const result = terser.minify(content, { mangle: { reserved: ['require','define', 'requirejs'] }});
        return result.code;
      } catch(e) {
        console.log(e);
        return `${file} error`;
      }
    }
    const results = await Promise.all(files.map(loadTerserFiles));
    return results.join('\n');
  }
  async loadEntry(entry, resolve = {}) {
    if(!entry) return [];
    let tasks = Object.keys(entry).map(async (name) => {
      let files = entry[name] || [];
      if(typeof files === 'string') {
        files = [files];
      }
      const {modules, errors} = await utility.resolve(files, resolve);
      if(errors && errors.length) {// 发生错误 返回当前内容
        return {
          name,
          content: JSON.stringify(errors)
        }
      }
      else if(!modules || !modules.length) {
        return {
          name,
          content: `${name} empty`
        }
      }
      const alias = modules.reduce((memo,item) => {
        // 对于别名的外部输出 都基于当前 cwd 执行目录 相对路径 不应该暴露绝对路径
        memo[item.name] = config.relativePath(item.main);
        return memo;
      }, {});

      files = modules.map(p => p.main);

      return {
        name,
        alias,
        content: await this.loadTerserFilesContent(files)
      }
    });
    return Promise.all(tasks);
  }

  formatName(str, context) {
    if(!context) return str;
    return str.replace(/\[(.*?)\]/g,function ($0, $1) {
      if(!$1) return '';
      let [name, num = -1] = $1.split(':');
      if(context.hasOwnProperty(name)) {
        return (context[name] && num > -1) ? context[name].substr(0, num) : context[name];
      }
      return $1;
    });
  }
  apply(compiler) {
    const pluginName = 'webpack-lib-plugin';
    const hook = async (compilation, cb) => {
      const stats = compilation.getStats().toJson();
      const webpackConfig = compilation.options || {};
      const {hash, fullhash, assets} = compilation;
      const {output, resolve, entry, plugins = []} = webpackConfig;
      // 新建一个临时额外变量用于保存
      compilation.dlls = compilation.chunks.map(chunk => {
        return {
          files: chunk.files || [],
          modules: entry[chunk.name] || [],
          name: chunk.name,
        }
      });

      const fileName = output.filename || '[name].js';
      // 自定义读取压缩的 entry 内容
      const entrys = await this.loadEntry(this.entry, resolve);

      for(let { name, content, alias } of entrys) {

        // 参见 webpack/lib/TemplatedPathPlugin  replacePathVariables

        // 文件入口生成
        const outputFileName = compilation.getPath(fileName, {chunk:{ name }, hash, fullhash});
        assets[outputFileName] = {
          source: () => content,
          size: () => content.length,
        };
        compilation.dlls.push({
          files:[outputFileName],
          modules: alias ? Object.keys(alias) : [],
          name,
        });
      }
      // DllPlugin 在emit 阶段直接针对outputFileSystem 对manifest.json 进行了输出 ，所以无法通过内容获取
      // 当前lib pulgin 必须在 dllplugin 之后
      // afterEmit 虽然可以在目录位置 获取到 但是鉴于 跟 webpack.run 的回调 同步，因此次序无法保证
      // 综合考虑后，将最后状态 统一保存到 compilation.chunks 后续步骤 在解析 compilation
      cb();
    };
    compiler.hooks.emit.tapAsync(pluginName, hook);
    

    /*
    const doneHook = async (compilation, cb) => {
      cb();
    }
    compiler.hooks.afterEmit.tapAsync(pluginName, doneHook);

    const doneCompile = async (compilation, cb) => {
      cb();
    }
    compiler.hooks.afterCompile.tapAsync(pluginName, doneCompile);
    */
  }
}


const syntaxCompilationDllManifestMetas = async (compilation) => {
  const webpackConfig = compilation.options || {};
  const {hash, fullhash, assets} = compilation;
  const {output, resolve, entry, plugins = []} = webpackConfig;
  const dllPlugin = plugins.find(p => p instanceof webpack.DllPlugin);
  if(!dllPlugin) return [];
  // const fileSystem = compilation.compiler.outputFileSystem;
  const fileSystem = compilation.inputFileSystem;
  // const existsAsync = util.promisify(fileSystem.exists);
  const statAsync = utility.bindPromise(fileSystem, fileSystem.stat);
  // const readFileAsync = util.promisify(fileSystem.readFile);
  return Promise.all(compilation.chunks.map(async (chunk) => {
    const targetPath = compilation.getPath(dllPlugin.options.path, {
      hash,
      chunk
    });
    return {
      file: targetPath,
      name: chunk.name,
      isExists: await statAsync(targetPath).catch(e => null)
    }
  }));
}
/**
 * 解析编译内容 针对 chunk 部分处理 WebpackLibPlugin 额外内容会补充到chunk里
 * @param {*} compilation 
 */
const syntaxCompilation = async (compilation) => {
  // const manifestName = this.manifestPathName || '[name].manifest.json';
  // 包含dll 的变更入口
  const manifestMetas = await syntaxCompilationDllManifestMetas(compilation);
  return (compilation.dlls || []).map(chunk => {
    if(chunk.name === 'empty') return;
    const manifestMeta = manifestMetas.find(p => p.name === chunk.name);
    const manifest = manifestMeta && manifestMeta.isExists && manifestMeta.file;
    chunk.manifest = manifest;
    return chunk;
  }).filter(p => !!p);
}

WebpackLibPlugin.syntaxCompilation = syntaxCompilation;


module.exports = WebpackLibPlugin;


/**
 * const replacePathVariables = (path, data, assetInfo) => {
	const chunk = data.chunk;
	const chunkId = chunk && chunk.id;
	const chunkName = chunk && (chunk.name || chunk.id);
	const chunkHash = chunk && (chunk.renderedHash || chunk.hash);
	const chunkHashWithLength = chunk && chunk.hashWithLength;
	const contentHashType = data.contentHashType;
	const contentHash =
		(chunk && chunk.contentHash && chunk.contentHash[contentHashType]) ||
		data.contentHash;
	const contentHashWithLength =
		(chunk &&
			chunk.contentHashWithLength &&
			chunk.contentHashWithLength[contentHashType]) ||
		data.contentHashWithLength;
	const module = data.module;
	const moduleId = module && module.id;
	const moduleHash = module && (module.renderedHash || module.hash);
	const moduleHashWithLength = module && module.hashWithLength;

	if (typeof path === "function") {
		path = path(data);
	}

	if (
		data.noChunkHash &&
		(REGEXP_CHUNKHASH_FOR_TEST.test(path) ||
			REGEXP_CONTENTHASH_FOR_TEST.test(path))
	) {
		throw new Error(
			`Cannot use [chunkhash] or [contenthash] for chunk in '${path}' (use [hash] instead)`
		);
	}

	return (
		path
			.replace(
				REGEXP_HASH,
				withHashLength(getReplacer(data.hash), data.hashWithLength, assetInfo)
			)
			.replace(
				REGEXP_CHUNKHASH,
				withHashLength(getReplacer(chunkHash), chunkHashWithLength, assetInfo)
			)
			.replace(
				REGEXP_CONTENTHASH,
				withHashLength(
					getReplacer(contentHash),
					contentHashWithLength,
					assetInfo
				)
			)
			.replace(
				REGEXP_MODULEHASH,
				withHashLength(getReplacer(moduleHash), moduleHashWithLength, assetInfo)
			)
			.replace(REGEXP_ID, getReplacer(chunkId))
			.replace(REGEXP_MODULEID, getReplacer(moduleId))
			.replace(REGEXP_NAME, getReplacer(chunkName))
			.replace(REGEXP_FILE, getReplacer(data.filename))
			.replace(REGEXP_FILEBASE, getReplacer(data.basename))
			// query is optional, it's OK if it's in a path but there's nothing to replace it with
			.replace(REGEXP_QUERY, getReplacer(data.query, true))
			// only available in sourceMappingURLComment
			.replace(REGEXP_URL, getReplacer(data.url))
			.replace(/\[\\(\\*[\w:]+\\*)\\\]/gi, "[$1]")
	);
};
 * 
 */