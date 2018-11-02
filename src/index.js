const {
	ConcatSource
} = require('webpack-sources');
const path = require('path');
const fsExtra = require('fs-extra');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
const MultiEntryPlugin = require('webpack/lib/MultiEntryPlugin');
const SplitChunksPlugin = require('webpack/lib/optimize/SplitChunksPlugin');

const PLUGIN_NAME = 'MiniProgramWebpackPlugin';

function normalizeOptions(options) {
	const _options = options || {};
	const defaultOptions = {
		basePath: null,
		entryName: 'app',
		assetsChunkName: '__assets_chunk_name__',
		extensions: ['.js'],
		assetExtensions: ['.wxml', '.wxss', '.pug', '.styl', '.scss', 'less'],
		vendorFilename: 'vendors.js'
	};

	const extensions = Array.from(new Set([
		...defaultOptions.extensions,
		...(_options.extensions || [])
	]));
	const assetExtensions = Array.from(new Set([
		...defaultOptions.assetExtensions,
		...(_options.assetExtensions || [])
	]));

	return Object.assign({}, defaultOptions, options, {
		extensions,
		assetExtensions
	});
}

function resolveBasePath(compiler) {
	if (this.options.basePath) {
		return path.resolve(this.options.basePath);
	}

	const appEntry = compiler.options.entry[this.options.entryName];
	if (!appEntry) {
		throw new TypeError('Entry invalid.');
	}
	return path.resolve(path.dirname(appEntry));
}

module.exports = class MiniProgramWebpackPlugin {
	constructor(options) {
		this.options = normalizeOptions(options);
		console.log('options', options);
		this.appEntries = [];
		this.pagesEntries = [];
		this.subpPagesEntries = [];
	}

	apply(compiler) {
		// get pages subpackages tabbarIcons add add entry
		compiler.hooks.run.tapPromise(PLUGIN_NAME, this.setAppEntries.bind(this));
		compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, this.setAppEntries.bind(this));

		// dealing with entries
		compiler.hooks.thisCompilation.tap(PLUGIN_NAME, async compilation => {
			await this.addEntries(compiler);
			this.writeJsons(compiler);
			this.applyPlugins(compiler);
			this.decorateChunks(compilation);
		});

	}

	async setAppEntries(compiler) {
		// setBasePath
		this.basePath = resolveBasePath.call(this, compiler);
		this.appEntries = await this.resolveAppEntries();
	}

	async addEntries(compiler) {
		for (const name of this.appEntries) {
			for (const ext of this.options.extensions) {
				const fullPath = path.resolve(this.basePath, name + ext);
				if (fsExtra.existsSync(fullPath)) {
					// add scripts entry
					new SingleEntryPlugin(`${this.basePath}/`, `./${name + ext}`, name).apply(compiler);
				}
			}
			// add wxml style files
			new MultiEntryPlugin(
				this.basePath,
				this.options.assetExtensions
					.map(ext => path.resolve(this.basePath, name + ext))
					.filter(f => fsExtra.existsSync(f)),
				this.options.assetsChunkName
			).apply(compiler);
		}

		const tabBarAssets = this.appEntries.tabBarAssets;
		if (tabBarAssets && tabBarAssets.length) {
			new MultiEntryPlugin(
				this.basePath,
				tabBarAssets.map(i => path.resolve(this.basePath, i)),
				this.options.assetsChunkName
			).apply(compiler);
		}
	}

	moduleOnlyUsedBySubPackage(module, root) {

		if (!/\.js$/.test(module.resource) || module.isEntryModule()) return false;

		let usedFiles = module._usedModules;

		if (!usedFiles) return false;

		let reg = new RegExp(root);

		return !Array.from(usedFiles).some(moduleName => !reg.test(moduleName));
	}

	// write json file to page or components dir
	writeJsons(compiler) {
		compiler.hooks.emit.tapAsync(PLUGIN_NAME, (compilation, callback) => {
			const cache = compilation.cache || {};
			const cacheKeys = Object.keys(cache);
			for (const name of this.appEntries) {
				const file = path.resolve(this.basePath, name + '.json');
				const cacheKey = cacheKeys.filter(function (key) {
					return cache[key].resource === file;
				});
				const cacheAsset = cache[cacheKey];
				if (cacheAsset && !cacheAsset.built) {
					return;
				}
				const data = fsExtra.readJsonSync(file);

				if (name === 'app' && data.tabBar && data.tabBar.list && data.tabBar.list.length && this.appEntries.tabBarAssets) {
					const tabBarAssetFullPaths = this.appEntries.tabBarAssets
						.map(ii => path.resolve(this.basePath, ii));
					const tabBarAssets = [];

					compilation.modules
						.filter(i => tabBarAssetFullPaths.indexOf(i.userRequest) > -1)
						.forEach(i => {
							tabBarAssets.push({
								key: path.relative(this.basePath, i.userRequest),
								value: Object.keys(i.buildInfo.assets)[0]
							});
						});
					data.tabBar.list = data.tabBar.list.map(i => {
						for (const a of tabBarAssets) {
							if (i.iconPath) {
								i.iconPath = i.iconPath.replace(a.key, a.value);
							}
							if (i.selectedIconPath) {
								i.selectedIconPath = i.selectedIconPath.replace(a.key, a.value);
							}
						}
						return i;
					});
				}

				const content = JSON.stringify(data);
				const size = content.length;
				compilation.assets[name + '.json'] = {
					size() {
						return size;
					},
					source() {
						return content;
					}
				};
			}
			callback();
		});
	}

	applyPlugins(compiler) {
		const cacheGroups = {
			//node_modules
			vendor: {
				chunks: 'all',
				test: /[\\/]node_modules[\\/]/,
				name: this.options.vendorFilename,
				minChunks: 2
			},
			//其他公用代码
			common: {
				chunks: 'all',
				test: /[\\/]src[\\/]/,
				minChunks: 2,
				name: this.options.vendorFilename,
				minSize: 0
			},
		};
		//
		// for (const {
		// 	root
		// } of this.subPackages) {
		// 	let name = root.replace('/', '');
		//
		// 	cacheGroups[`${name}Commons`] = {
		// 		name: `${root}/${this.options.vendorFilename}`,
		// 		chunks: 'initial',
		// 		minSize: 0,
		// 		minChunks: 1,
		// 		test: module => this.moduleOnlyUsedBySubPackage(module, root),
		// 		priority: 3
		// 	};
		// }

		new SplitChunksPlugin({
			cacheGroups
		}).apply(compiler);
	}

	decorateChunks(compilation) {
		const windowRegExp = new RegExp('window', 'g');
		compilation.chunkTemplate.hooks.render.tap(PLUGIN_NAME, (source) => {
			return new ConcatSource(source.source().replace(windowRegExp, 'wx'));
		});

		compilation.mainTemplate.hooks.render.tap(PLUGIN_NAME, (source, chunk) => {
			// return source
			if (chunk.name !== this.options.entryChunkName) {
				const relativePath = path.relative(path.dirname(path.resolve(this.basePath, chunk.name)), path.resolve(this.basePath, this.options.vendorFilename));
				const posixPath = relativePath.replace(/\\/g, '/');
				const injectContent = `;require("./${posixPath}");`;
				source.add(injectContent);
			}
			return new ConcatSource(source.source().replace(windowRegExp, 'wx'));
		});
	}

	// get app.json
	async resolveAppEntries() {
		const { tabBar, pages = [], subPackages = [] } = fsExtra.readJSONSync(path.resolve(this.basePath, 'app.json'));

		this.pagesEntries = pages;

		let tabBarAssets = new Set();
		if (tabBar && tabBar.list) {
			tabBar.list.forEach(i => {
				if (i.selectedIconPath) {
					tabBarAssets.add(i.selectedIconPath);
				}
				if (i.iconPath) {
					tabBarAssets.add(i.iconPath);
				}
			});
			tabBarAssets = Array.from(tabBarAssets);
		}

		if (subPackages && subPackages.length) {
			for (const subpage of subPackages) {
				for (const page of subpage.pages) {
					this.subpPagesEntries.push(path.join(subpage.root, page));
				}
			}
		}

		let pageComponents = new Set();
		for (const page of pages) {
			await this.getComponents(pageComponents, path.resolve(this.basePath, page));
		}
		pageComponents = Array.from(pageComponents);

		const ret = ['app', ...pages, ...(pageComponents || [])];

		Object.defineProperties(ret, {
			pages: {
				get: () => [...this.pagesEntries, ...this.subpPagesEntries]
			},
			components: {
				get: () => pageComponents
			},
			tabBarAssets: {
				get: () => tabBarAssets
			}
		});
		return ret;
	}

	// get page.json usingComponents path
	async getComponents(components, instance) {
		const {
			usingComponents = {}
		} = fsExtra.readJSONSync(`${instance}.json`);
		const componentBase = path.parse(instance).dir;
		for (const c of Object.values(usingComponents)) {
			const component = path.resolve(componentBase, c);
			if (!components.has(component)) {
				components.add(path.relative(this.basePath, component));
				await this.getComponents(components, component);
			}
		}
	}

};
