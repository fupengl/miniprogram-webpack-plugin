# miniprogram-webpack-plugin

微信小程序 webpack 插件


###### 为什么要使用 webpack

- 支持通过 `yarn` 或 `npm` 引入和使用 `node_modules` 模块
- 支持丰富且灵活的 `loaders` 和 `plugins`
- 支持 `alias`
- 支持 `sass、less`
- 支持引入npm自定义组件


###### 为什么要使用这个插件

- 微信小程序开发需要有多个入口文件（如 `app.js`, `app.json`, `pages/index/index.js` 等等），使用这个插件只需要引入 `app.js` 即可，其余文件将会被自动引入
- 若多个入口文件（如 `pages/index/index.js` 和 `pages/logs/logs.js`）引入有相同的模块，这个插件能避免重复打包相同模块
- 支持自动复制 `app.json` 上的 `tabbar` 图片`json`文件
- 支持分包加载，自动提取分析`common.js`到分包root目录下


## 使用方法

#### 安装

```bash
npm i -S miniprogram-webpack-plugin
```

#### 配置 webpack

1. 在 `entry` 上引入 `{ app: './src/app.js' }`, 这里的 `./src/app.js` 为微信小程序开发所需的 `app.js`。**注意** `key` 必须为 `app`，`value`为`app.js`文件）

2. 在 `output` 上设置 `filename: '[name].js'。` **注意** 这里 `[name].js` 是因为 `webpack` 将会打包生成多个文件，文件名称将以 `[name]` 规则来输出

3. 添加 `new MiniProgramWebpackPlugin()` 到 `plugins`

**完整的项目开发脚手架，请查看 [quickstart-miniprogram](https://github.com/fupengl/quickstart-miniprogram.git)**


## API

#### MiniProgramWebpackPlugin

###### 用法

webpack.config.babel.js

```js
import MiniProgramWebpackPlugin from 'miniprogram-webpack-plugin';
export default {
  // ...configs,
  plugins: [
    // ...other,
    new MiniProgramWebpackPlugin(options)
  ],
};
```


###### Options

所有 `Options` 均为可选

- `clear` (\<Boolean\>): 在启动 `webpack` 时清空 `output` 目录。默认为 `true`
- `extensions` (\<Array\<String\>\>): 脚本文件后缀名。默认为 `['.js'，'ts']`
- `include` (\<Array\<String\>\>): 静态资源目录。eg:\[" /assets/**/\* "\]
- `exclude` (\<Array\<String\>\>): 排除静态资源目录。eg:\[" /doc/**/\* "\]


## 提示

- 程序的开发方式与 [微信小程序开发文档](https://mp.weixin.qq.com/debug/wxadoc/dev/) 一样，开发者需要在 `src` （源）目录创建 `app.js`、`app.json`、`app.wxss`、`pages/index/index.js` 之类的文件进行开发
- 引入node_modules的包，只需要`usingComponents`中对应组件增加`/npm-components`这个前缀，打包出来会提取`node_modules`中的组定义组件到输出目录`npm-components`文件夹

****

## License

MIT © fupengl
