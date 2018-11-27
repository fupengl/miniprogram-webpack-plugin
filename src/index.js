const path = require('path')
const fsExtra = require('fs-extra');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin')
const SplitChunksPlugin = require('webpack/lib/optimize/SplitChunksPlugin')
const RuntimeChunkPlugin = require("webpack/lib/optimize/RuntimeChunkPlugin");

const pluginName = "MiniProgramWebpackPlugin"
module.exports = class MiniProgramWebpackPlugin {

	constructor(options = {}) {
		this.options = Object.assign({}, {
			clear: true,
			extensions: ['.js', '.ts'],
		}, options)
	}

	apply(compiler) {
		let firstInit = true

		compiler.hooks.run.tapPromise(pluginName, this.setAppEntries.bind(this))
		compiler.hooks.watchRun.tapPromise(pluginName, this.setAppEntries.bind(this))

		compiler.hooks.emit.tapPromise(pluginName, async compilation => {
			const { clear } = this.options
			if (clear && firstInit) {
				firstInit = false
				await this.clearOutPut(compilation)
			}
		})

		compiler.hooks.done.tap(pluginName, stats => {
			console.log('build success');
		});
	}

	async setAppEntries(compiler) {
		const appEntry = compiler.options.entry.app;
		if (!appEntry) {
			throw new TypeError('Entry invalid.');
		}
		this.basePath = path.resolve(path.dirname(appEntry))
		this.appEntries = await this.resolveAppEntries();
		this.appEntries
			.filter(resource => resource !== 'app')
			.forEach(resource => {
				const fullPath = this.getFullScriptPath(resource);
				this.addScriptEntry(compiler, fullPath, resource);
			});
		this.applySpliteChunk(compiler)
	}

	async applySpliteChunk(compiler) {
		new SplitChunksPlugin({
			cacheGroups: {
				default: false,
				//node_modules
				vendor: {
					chunks: 'all',
					test: /[\\/]node_modules[\\/]/,
					name: 'vendors',
					minChunks: 1
				},
				//其他公用代码
				common: {
					chunks: 'all',
					test: /[\\/]src[\\/]/,
					minChunks: 1,
					name: 'commons',
					minSize: 0
				}
			}
		}).apply(compiler)

		new RuntimeChunkPlugin({ name: "runtime" }).apply(compiler)
	}

	// resolve tabbar page compoments
	async resolveAppEntries() {
		const { tabBar, pages = [], subPackages = [] } = fsExtra.readJSONSync(path.resolve(this.basePath, 'app.json'));

		let tabBarAssets = new Set();
		let components = new Set();

		// parse subpage
		for (const subPage of subPackages) {
			for (const page of (subPage.pages || [])) {
				pages.push(path.join(subPage.root, page))
			}
		}

		// resolve page components
		for (const page of pages) {
			await this.getComponents(components, path.resolve(this.basePath, page));
		}

		components = Array.from(components) || []
		tabBarAssets = Array.from(tabBarAssets) || []

		const ret = ['app', ...pages, ...components];
		Object.defineProperties(ret, {
			pages: {
				get: () => pages
			},
			components: {
				get: () => components
			},
			tabBarAssets: {
				get: () => tabBarAssets
			}
		});
		return ret;
	}

	// add entry
	addScriptEntry(compiler, entry, name) {
		compiler.hooks.make.tap(pluginName, compilation => {
			const dep = SingleEntryPlugin.createDependency(entry, name);
			compilation.addEntry(this.base, dep, name, () => { });
		})
	}

	// parse components
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

	// script full path
	getFullScriptPath(script) {
		const {
			basePath,
			options: { extensions }
		} = this;
		for (const ext of extensions) {
			const fullPath = path.resolve(basePath, script + ext);
			if (fsExtra.existsSync(fullPath)) {
				return fullPath;
			}
		}
	}

	async clearOutPut(compilation) {
		const { path } = compilation.options.output;
		return await fsExtra.remove(path);
	}
}
