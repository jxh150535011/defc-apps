# @alicloud/defc-apps 用于构建分离式应用
## 测试验证阶段，外部伙伴请勿使用

##  single-spa 业界知名微前端架构解决方案
 - 内置加载器 SystemJs ,用于对前端脚本的资源加载管理
 - 丰富的包装器，可对不同子应用进行包装
 - 定制入口页面，根据路由加载不同的子应用
 - 有较丰富的插件、支持多种构建
 - icestark 基本与single-spa 类似


## @alicloud/defc-apps 与 single-spa 解决方案对比
- 加载器使用amd 规范，RequireJs
- 保留目前一致化的前端工程开发体验，对代码无侵入
- 以模块为粒度，更细的粒度控制
- 基于webpack 开发，配置规范有参考

> @alicloud/defc-apps 希望解决是单体应用中具备加载远程模块的能力，不局限于本地环境
> single-spa、icestark 通过粘合不同应用达到单体应用体验


## @alicloud/defc-apps 使用说明
- 所有的@alicloud/defc-apps 子应用模块 默认通过"网关"应用拉起，"网关"应用是所有应用的主入口，可用于自定义路由规则
- 指定一个默认配置，通常这个默认配置可配置在“网关”应用下

```javascript
// 不同应用通过一致化的配置保证协作正常
module.exports = {
  output: path.join(__dirname, './dist'),
  libs: [ // 公共模块
    'react',
  ],
  registry: { // 注册到网关
    '@scope': `http://abc.com/abc`
  },
  process: { // 具体子应用本身可单独进行配置
    '@scope': {
      libs: [ ], // 子应用本身公共模块
      routes: [ // 当前应用注册入口
        ['/pages/index', path.join(__dirname, './pages/index.jsx')],
        ['/pages/about', path.join(__dirname, './pages/about.jsx')]
      ],
    }
  },
  chain(webpackConfig, buildType) {
		// setup.BuildTypeEnum MODULE WEBAPP DLL
		// 针对webpackConfig 回调，用于扩展更多的构建能力
  },
}
```
- 模块如何使用

```javascript
// 尽量保持原有的模块加载体验方式 只是所有的模块加载均为异步 类似于 () => import('xx')
import scope from '@scope';
import IndexComponentAsync from '@scope/pages/index';
const AboutComponentAsync = scope.request('/pages/about');

```

- 对于模块加载、包构建方面做了一部分效率优化，例如dll 公共模块分组构建、子应用模块开发模式按需编译、客户端加载防重复加载优化、子应用路由映射等