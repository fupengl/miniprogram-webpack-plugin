import path from 'path';
import MiniProgramWebpackPlugin from '../src';

const ext = process.env.TEST_EXT || 'js';

const include = new RegExp('src');

export default {
	entry: {
		app: `./src/${ext}/app.${ext}`
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist', ext),
		// globalObject: 'global',
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
	// 				minChunks: 2
	// 			},
	// 			//其他公用代码
	// 			commons: {
	// 				chunks: 'all',
	// 				test: /[\\/]src[\\/]/,
	// 				minChunks: 2,
	// 				name: 'commons',
	// 				minSize: 0
	// 			},
	// 			// product: {
	// 			//     chunks: 'all',
	// 			//     test: /[\\/]subpackages[\\/]product[\\/]/,
	// 			//     minChunks: 2,
	// 			//     name:"subpackages/product/test",
	// 			//     minSize:0
	// 			// }
	// 		}
	// 	},
	// 	runtimeChunk: 'single'
	// },
	module: {
		rules: [{
			test: /\.(ts|js)$/,
			include,
			loader: 'babel-loader',
			options: {
				presets: ['@babel/preset-env'],
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
	plugins: [
		new MiniProgramWebpackPlugin({
			basePath: `src/${ext}`
		})
	],
	devtool: 'source-map',
	resolve: {
		modules: [`src/${ext}`, 'node_modules'],
		extensions: ['.js', '.ts', '.json'],
	},
};
