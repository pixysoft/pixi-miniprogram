const fs = require('fs')
const path = require('path')
const StringReplacePlugin = require("string-replace-webpack-plugin");

function resolvePixiModule() {
  const code = fs.readFileSync(path.resolve('./src/pixi.js'), 'utf8')
  return code
}

module.exports = {
  entry: {
    'pixi.miniprogram': path.join(__dirname, '../src/index'),
    // 插件线：独立分包产物，不进默认主包
    'plugins/spine.player': path.join(__dirname, '../src/plugins/SpinePlayer.js'),
  },
  target: 'web',
  output: {
    path: path.join(__dirname, '../dist'),
    // path: path.join(__dirname, '../example/libs'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          presets: [
            "@babel/preset-env",
          ],
          plugins: ["@babel/plugin-proposal-class-properties"]
        }
      },
      { 
        test: /\index.js$/,
        loader: StringReplacePlugin.replace({
          replacements: [
            {
              pattern: /__INJECT_PIXI__/ig,
              replacement: () => {
                return resolvePixiModule()
              }
            }
          ]
        })
      }
    ]
  },
  plugins: [
      new StringReplacePlugin()
  ],
  optimization:{
    minimize: true,
  }
}
