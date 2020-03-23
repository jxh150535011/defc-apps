// import 如果 属于 dll-reference 或 externals 不回在触发loader 加载器
/**
webpack 默认内置的插件

new JavascriptModulesPlugin().apply(compiler);
new JsonModulesPlugin().apply(compiler);
new WebAssemblyModulesPlugin({
    mangleImports: options.optimization.mangleWasmImports
}).apply(compiler);

new EntryOptionPlugin().apply(compiler);
compiler.hooks.entryOption.call(options.context, options.entry);
new CompatibilityPlugin().apply(compiler);

new ImportPlugin(options.module).apply(compiler);
new SystemPlugin(options.module).apply(compiler);
 */

module.exports = function (content, map, meta) {
  /*
  "name": "@ali-whale/button",
  "version": "0.6.30",
  "description": "基本按钮",
  */
  try {
    const {
      name,
      version,
      description
    } = JSON.parse(content);

    return JSON.stringify({
      name,
      version,
      description
    })
  } catch(e) {
    console.log(content, e);
    return '{}';
  }

};

