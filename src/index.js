const path = require("path");
const fsExtra = require("fs-extra");
const globby = require("globby");
const SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");
const { optimize } = require("webpack");
const LoaderTargetPlugin = require("webpack/lib/LoaderTargetPlugin");
const FunctionModulePlugin = require("webpack/lib/FunctionModulePlugin");
const NodeSourcePlugin = require("webpack/lib/node/NodeSourcePlugin");
const JsonpTemplatePlugin = require("webpack/lib/web/JsonpTemplatePlugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { ConcatSource } = require("webpack-sources");

const pluginName = "MiniProgramWebpackPlugin";
module.exports = class MiniProgramWebpackPlugin {
	constructor(options = {}) {
		this.options = Object.assign(
			{},
			{
				clear: true,
				extensions: [".js", ".ts"], // script ext
				include: [".wxml", ".wxss", ".json"], // include assets file
				exclude: [], // ignore assets file
				commonsChunkName: "commons",
				vendorChunkName: "vendor",
				runtimeChunkName: "runtime"
			},
			options
		);
	}

	apply(compiler) {
		this.setBasePath(compiler);
		this.enforceTarget(compiler);

		const catchError = handler => async arg => {
			try {
				await handler(arg);
			} catch (err) {
				console.warn(err);
			}
		};

		compiler.hooks.run.tapPromise(
			pluginName,
			catchError(compiler => this.setAppEntries(compiler))
		);

		compiler.hooks.watchRun.tapPromise(
			pluginName,
			catchError(compiler => this.setAppEntries(compiler))
		);

		compiler.hooks.compilation.tap(
			pluginName,
			this.compilationHooks.bind(this)
		);

		compiler.hooks.emit.tapPromise(pluginName, async compilation => {
			try {
				const { clear } = this.options;
				if (clear && !this.firstClean) {
					this.firstClean = true;
					await MiniProgramWebpackPlugin.clearOutPut(compilation);
				}
			} catch (error) {
				console.warn(error);
			}
		});
	}

	compilationHooks(compilation) {
		compilation.chunkTemplate.hooks.renderWithEntry.tap(
			pluginName,
			(modules, chunk) => {
				const children = modules.listMap().children;
				const generatedCode =
					children[Object.keys(children).pop()].generatedCode;
				const requireModule = JSON.parse(
					generatedCode.substring(
						generatedCode.indexOf(",") + 2,
						generatedCode.length - 3
					)
				);
				const source = new ConcatSource(modules);
				requireModule.forEach(module => {
					if (this.chunkMap[module]) {
						const chunkName = chunk.name;
						source.add(
							`;require("${path
								.relative(path.dirname(chunkName), this.chunkMap[module])
								.replace(/\\/g, "/")}")`
						);
					}
				});
				return source;
			}
		);

		compilation.hooks.afterOptimizeChunkIds.tap(pluginName, chunks => {
			this.chunkMap = chunks.reduce((acc, item) => {
				acc[item.id] = item.name;
				return acc;
			}, {});
		});
	}

	setBasePath(compiler) {
		const appEntry = compiler.options.entry.app;
		if (!appEntry) {
			throw new TypeError("Entry invalid.");
		}
		this.basePath = path.resolve(path.dirname(appEntry));
	}

	async enforceTarget(compiler) {
		const { options } = compiler;
		// set jsonp obj motuned obj
		options.output.globalObject = "global";
		options.node = {
			...(options.node || {}),
			global: false
		};

		// set target to web
		options.target = compiler => {
			new JsonpTemplatePlugin(options.output).apply(compiler);
			new FunctionModulePlugin(options.output).apply(compiler);
			new NodeSourcePlugin(options.node).apply(compiler);
			new LoaderTargetPlugin("web").apply(compiler);
		};
	}

	async setAppEntries(compiler) {
		this.npmComponts = new Set();
		this.appEntries = await this.resolveAppEntries();
		await Promise.all([
			this.addScriptEntry(compiler),
			this.copyAssetsFile(compiler)
		]);
		this.applyPlugin(compiler);
	}

	// resolve tabbar page compoments
	async resolveAppEntries() {
		const { tabBar = {}, pages = [], subpackages = [] } = fsExtra.readJSONSync(
			path.resolve(this.basePath, "app.json")
		);

		let tabBarAssets = new Set();
		let components = new Set();
		let subPageRoots = [];
		let independentPageRoots = [];
		this.subpackRoot = [];

		for (const { iconPath, selectedIconPath } of tabBar.list || []) {
			if (iconPath) {
				tabBarAssets.add(iconPath);
			}
			if (selectedIconPath) {
				tabBarAssets.add(selectedIconPath);
			}
		}

		// parse subpage
		for (const subPage of subpackages) {
			subPageRoots.push(subPage.root);
			if (subPage.independent) {
				independentPageRoots.push(subPage.root);
			}
			for (const page of subPage.pages || []) {
				pages.push(path.join(subPage.root, page));
			}
		}

		// add app.[ts/js]
		pages.push("app");

		// resolve page components
		for (const page of pages) {
			await this.getComponents(components, path.resolve(this.basePath, page));
		}

		components = Array.from(components) || [];
		tabBarAssets = Array.from(tabBarAssets) || [];

		const ret = [...pages, ...components];
		Object.defineProperties(ret, {
			pages: {
				get: () => pages
			},
			components: {
				get: () => components
			},
			tabBarAssets: {
				get: () => tabBarAssets
			},
			subPageRoots: {
				get: () => subPageRoots
			},
			independentPageRoots: {
				get: () => independentPageRoots
			}
		});
		return ret;
	}

	// code splite
	applyPlugin(compiler) {
		const {
			runtimeChunkName,
			commonsChunkName,
			vendorChunkName
		} = this.options;
		const subpackRoots = this.appEntries.subPageRoots;
		const independentPageRoots = this.appEntries.independentPageRoots;

		new optimize.RuntimeChunkPlugin({
			name({ name }) {
				const index = independentPageRoots.findIndex(item =>
					name.includes(item)
				);
				if (index !== -1) {
					return path.join(independentPageRoots[index], runtimeChunkName);
				}
				return runtimeChunkName;
			}
		}).apply(compiler);

		new optimize.SplitChunksPlugin({
			hidePathInfo: false,
			chunks: "async",
			minSize: 10000,
			minChunks: 1,
			maxAsyncRequests: Infinity,
			automaticNameDelimiter: "~",
			maxInitialRequests: Infinity,
			name: true,
			cacheGroups: {
				default: false,
				// node_modules
				vendor: {
					chunks: "all",
					test: /[\\/]node_modules[\\/]/,
					name: vendorChunkName,
					minChunks: 0
				},
				// 其他公用代码
				common: {
					chunks: "all",
					test: /[\\/]src[\\/]/,
					minChunks: 2,
					name({ context }) {
						const index = subpackRoots.findIndex(item =>
							context.includes(item)
						);
						if (index !== -1) {
							return path.join(subpackRoots[index], commonsChunkName);
						}
						return commonsChunkName;
					},
					minSize: 0
				}
			}
		}).apply(compiler);
	}

	// add script entry
	async addScriptEntry(compiler) {
		this.appEntries
			.filter(resource => resource !== "app")
			.forEach(resource => {
				if (this.npmComponts.has(resource)) {
					new SingleEntryPlugin(
						this.basePath,
						path.join(process.cwd(), resource),
						resource.replace(/node_modules/, "npm-components")
					).apply(compiler);
				} else {
					const fullPath = this.getFullScriptPath(resource);
					if (fullPath) {
						new SingleEntryPlugin(this.basePath, fullPath, resource).apply(
							compiler
						);
					} else {
						console.warn(`file ${resource} is exists`);
					}
				}
			});
	}

	// copy assets file
	async copyAssetsFile(compiler) {
		const { include, exclude, extensions } = this.options;
		const patterns = this.appEntries
			.map(resource => path.resolve(this.basePath, `${resource}.*`))
			.concat(
				[...this.npmComponts].map(resource =>
					path.join(process.cwd(), `${resource}.*`)
				)
			)
			.concat(include);
		const entries = await globby(patterns, {
			cwd: this.basePath,
			nodir: true,
			realpath: false,
			ignore: [...extensions.map(ext => `**/*${ext}`), ...exclude],
			dot: false
		});
		new CopyWebpackPlugin(
			[
				...entries.map(resource => {
					return {
						from: resource,
						to: resource
							.replace(`${this.basePath.replace(/\\/g, "/")}/`, "")
							.replace(`${process.cwd().replace(/\\/g, "/")}/`, "")
							.replace(/node_modules/, "npm-components")
					};
				}),
				...this.appEntries.tabBarAssets.map(resource => {
					return {
						from: path.resolve(this.basePath.replace(/\\/g, "/"), resource),
						to: resource
					};
				})
			],
			{
				ignore: [
					...extensions.map(ext => `**/*${ext}`),
					...exclude,
					...["sass", "scss", "css", "less", "styl"]
				]
			}
		).apply(compiler);
	}

	// parse components
	async getComponents(components, instance) {
		try {
			const { usingComponents = {} } = fsExtra.readJSONSync(`${instance}.json`);
			const instanceDir = path.parse(instance).dir;
			for (const c of Object.values(usingComponents)) {
				if (c.indexOf("plugin://") === 0) {
					break;
				}
				if (c.indexOf("/npm-components") === 0) {
					const component = c.replace(/\/npm-components/, "node_modules");
					if (!this.npmComponts.has(component)) {
						this.npmComponts.add(component);
						components.add(component);
						this.getComponents(
							components,
							path.resolve(process.cwd(), component)
						);
					}
					break;
				}
				const component = path.resolve(instanceDir, c);
				if (!components.has(component)) {
					components.add(path.relative(this.basePath, component));
					await this.getComponents(components, component);
				}
			}
		} catch (error) {}
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

	static async clearOutPut(compilation) {
		const { path } = compilation.options.output;
		await fsExtra.remove(path);
	}
};
