
import path from 'path';
import MiniProgramWebpackPlugin, { Targets } from '../src';

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
	optimization: {
		splitChunks: {
			cacheGroups: {
				subPackagesproduct: {
					name: 'subPackages/product/common',
					test(chunks) {
						return chunks.context.includes('/subPackages/product/') || chunks.context.includes('/node_modules/');
					},
					chunks: 'all'
				},
				subPackagesproduct1: {
					name: 'subPackages/product1/common',
					test(chunks) {
						return chunks.context.includes('/subPackages/product1/') || chunks.context.includes('/node_modules/');
					},
					chunks: 'all'
				},
				// common:	{
				// 	name: 'common',
				// 	test(chunks) {
				// 		return chunks.context.includes('/pages/') || chunks.context.includes('/node_modules/') || chunks.context.includes('/components/');
				// 	},
			}},
	},
	plugins: [
		new MiniProgramWebpackPlugin({
			extensions: [`.${ext}`, '.ts'],
		}),
	],
	devtool: 'source-map',
	resolve: {
		modules: [`src/${ext}`, 'node_modules'],
		extensions: ['.js', '.ts', '.json'],
	},
};
