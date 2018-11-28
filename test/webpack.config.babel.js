
const path = require('path');
const MiniProgramWebpackPlugin = require('../src');

const ext = process.env.TEST_EXT || 'js';

const include = new RegExp('src');

module.exports = {
	entry: {
		app: `./src/${ext}/app.${ext}`,
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist', ext)
	},
	// optimization: {
	// 	splitChunks: {
	// 		cacheGroups: {
	// 			default: false,
	// 			//node_modules
	// 			vendor: {
	// 				chunks: 'all',
	// 				test: /[\\/]node_modules[\\/]/,
	// 				name: 'vendors',
	// 				minChunks: 1
	// 			},
	// 			//其他公用代码
	// 			common: {
	// 				chunks: 'all',
	// 				test: /[\\/]src[\\/]/,
	// 				minChunks: 1,
	// 				name: 'commons',
	// 				minSize: 0
	// 			}
	// 		}
	// 	}
	// },
	module: {
		rules: [
			{
				test: /\.(ts|js)$/,
				include,
				loader: 'babel-loader',
				options: {
					presets: ['@babel/preset-env'],
					babelrc: false,
				}
			},
			{
				test: /\.(woff|woff2|eot|ttf|svg|png|gif|jpeg|jpg)\??.*$/,
				loader: 'url-loader',
				include,
				query: {
					limit: 50000
				}
			},
		],
	},
	plugins: [
		new MiniProgramWebpackPlugin({
			extensions: [`.${ext}`, '.js'],
		}),
	],
	devtool: 'source-map',
	resolve: {
		modules: [`src/${ext}`, 'node_modules'],
		extensions: ['.js', '.ts', '.json'],
	},
};
