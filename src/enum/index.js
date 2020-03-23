const BuildTypeEnum = {
  DEFAULT: 0,
  DLL: 1, // dll 类型
  LIB: 2, // 纯静态资源输出
  ENTRY: 3, // 默认入口形式
  WEBAPP: 4, // 站点打包应用形式
  MODULE:5, // 依赖模块形式
  REGISTRY_MODULE:6, // 注册入口 依赖模块形式
}

const BuildStateEnum = {
  DEFAULT: 0,
  CACHE:1,
  START:2,
  DONE:3,
  ERROR:4,
}

const PackTypeEnum = {
  DEFAULT: 0,
  GATEWAY:1,
  SCOPE:2,// 正在进行入口形式打包 (scope)
}

module.exports = {
  /**
   * 打包类型
   */
  BuildTypeEnum,
  BuildStateEnum,
  PackTypeEnum
}