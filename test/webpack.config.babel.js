
import path from 'path';
import MiniProgramWebpackPlugin, { Targets } from '../src';
import SplitChunksPlugin from 'webpack/lib/optimize/SplitChunksPlugin';

const ext = process.env.TEST_EXT || 'js';

const include = new RegExp('src');

export default {
	entry: {
		app: [`./src/${ext}/utils/bomPolyfill.js`, `./src/${ext}/app.${ext}`],
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist', ext),
	},
	target: Targets.Wechat,
	module: {
		rules: [
			{
				test: /\.(ts|js)$/,
				include,
				loader: 'babel-loader',
				options: {
					presets: ['es2015', 'stage-0'],
					babelrc: false,
				}
			},
			{
				test: /\.(json|wxml|wxs|wxss|png)$/,
				type: 'javascript/auto',
				include,
				loader: 'file-loader',
				options: {
					useRelativePath: true,
					name: '[name].[ext]',
				}
			},
		],
	},
	// optimization: {
	// 	splitChunks: {
	// 		chunks: 'all',
	// 		cacheGroups: {
	// 			// 提取 node_modules 中代码
	// 			vendors: {
	// 				test: /[\\/]node_modules[\\/]/,
	// 				name: 'vendors',
	// 				chunks: 'all'
	// 			},
	// 			commons: {
	// 				// async 设置提取异步代码中的公用代码
	// 				chunks: 'async',
	// 				name: 'commons-async',
	// 				/**
	// 				 * minSize 默认为 30000
	// 				 * 想要使代码拆分真的按照我们的设置来
	// 				 * 需要减小 minSize
	// 				 */
	// 				minSize: 0,
	// 				// 至少为两个 chunks 的公用代码
	// 				minChunks: 2
	// 			}
	// 		}
	// 	},
	// 	/**
	// 	 * 对应原来的 minchunks: Infinity
	// 	 * 提取 webpack 运行时代码
	// 	 * 直接置为 true 或设置 name
	// 	 */
	// 	runtimeChunk: {
	// 		name: 'manifest'
	// 	}
	// },

	plugins: [
		new MiniProgramWebpackPlugin({
			extensions: [`.${ext}`, '.ts'],
		})
	],
	devtool: 'source-map',
	resolve: {
		modules: [`src/${ext}`, 'node_modules'],
		extensions: ['.js', '.ts', '.json'],
	},
};
