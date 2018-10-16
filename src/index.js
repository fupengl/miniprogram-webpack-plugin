import { existsSync, readFile, readJson, remove, stat } from 'fs-extra';
import { dirname, join, parse, relative, resolve } from 'path';
import { LoaderTargetPlugin, optimize } from 'webpack';
import { ConcatSource, ReplaceSource } from 'webpack-sources';
import globby from 'globby';
import { defaults, uniq, values } from 'lodash';

import MultiEntryPlugin from 'webpack/lib/MultiEntryPlugin';
import SingleEntryPlugin from 'webpack/lib/SingleEntryPlugin';
import FunctionModulePlugin from 'webpack/lib/FunctionModulePlugin';
import NodeSourcePlugin from 'webpack/lib/node/NodeSourcePlugin';
import JsonpTemplatePlugin from 'webpack/lib/web/JsonpTemplatePlugin';
import SplitChunksPlugin from 'webpack/lib/optimize/SplitChunksPlugin';
import RuntimeChunkPlugin from 'webpack/lib/optimize/RuntimeChunkPlugin';

const deprecated = function deprecated(obj, key, adapter, explain) {
	if (deprecated.warned.has(key)) {
		return;
	}
	const val = obj[key];
	if (typeof val === 'undefined') {
		return;
	}
	deprecated.warned.add(key);
	adapter(val);
	console.warn('[miniprogram-webpack-plugin]', explain);
};
deprecated.warned = new Set();

const stripExt = path => {
	const { dir, name } = parse(path);
	return join(dir, name);
};

const miniProgramTarget = compiler => {
	const { options } = compiler;
	new JsonpTemplatePlugin(options.output).apply(compiler);
	new FunctionModulePlugin(options.output).apply(compiler);
	new NodeSourcePlugin(options.node).apply(compiler);
	new LoaderTargetPlugin('web').apply(compiler);
};

export const Targets = {
	Wechat(compiler) {
		return miniProgramTarget(compiler);
	},
	Alipay(compiler) {
		return miniProgramTarget(compiler);
	}
};

export default class MiniProgramWebpackPlugin {
	constructor(options = {}) {
		this.options = defaults(options || {}, {
			clear: true,
			include: [],
			exclude: [],
			dot: false, // Include `.dot` files
			extensions: ['.js'],
			commonModuleName: 'common',
			enforceTarget: true,
			assetsChunkName: '__assets_chunk__'
		});
		this.options.extensions = uniq([...this.options.extensions, '.js']);
		this.options.include = [].concat(this.options.include);
		this.options.exclude = [].concat(this.options.exclude);
	}

	apply(compiler) {
		const { clear } = this.options;
		let isFirst = true;

		this.enforceTarget(compiler);

		compiler.hooks.run.tapAsync('MiniProgramWebpackPlugin', this.try(async compiler => {
			await this.run(compiler);
		}));

		compiler.hooks.watchRun.tapAsync('MiniProgramWebpackPlugin', this.try(async compiler => {
			await this.run(compiler.compiler);
		}));

		compiler.hooks.emit.tapAsync('MiniProgramWebpackPlugin', this.try(async compilation => {
			if (clear && isFirst) {
				isFirst = false;
				await this.clear(compilation);
			}
			await this.toEmitTabBarIcons(compilation);
		}));

		compiler.hooks.afterEmit.tapAsync('MiniProgramWebpackPlugin', this.try(async compilation => {
			await this.toAddTabBarIconsDependencies(compilation);
		}));

	}

	try = handler => async (arg, callback) => {
		try {
			await handler(arg);
			callback && callback();
		} catch (err) {
			callback && callback(err);
		}
	};

	enforceTarget(compiler) {
		const { enforceTarget } = this.options;
		const { options } = compiler;

		if (enforceTarget) {
			const { target } = options;
			if (target !== Targets.Wechat && target !== Targets.Alipay) {
				options.target = Targets.Wechat;
			}
			if (!options.node || options.node.global) {
				options.node = options.node || {};
				options.node.global = false;
			}
		}
	}

	getBase(compiler) {
		const { base, extensions } = this.options;
		if (base) {
			return resolve(base);
		}

		const { options: compilerOptions } = compiler;
		const { context, entry } = compilerOptions;

		const getEntryFromCompiler = () => {
			if (typeof entry === 'string') {
				return entry;
			}

			const extRegExpStr = extensions
				.map(ext => ext.replace(/\./, '\\.'))
				.map(ext => `(${ext})`)
				.join('|');

			const appJSRegExp = new RegExp(`\\bapp(${extRegExpStr})?$`);
			const findAppJS = arr => arr.find(path => appJSRegExp.test(path));

			if (Array.isArray(entry)) {
				return findAppJS(entry);
			}
			if (typeof entry === 'object') {
				for (const key in entry) {
					if (!entry.hasOwnProperty(key)) {
						continue;
					}

					const val = entry[key];
					if (typeof val === 'string') {
						return val;
					}
					if (Array.isArray(val)) {
						return findAppJS(val);
					}
				}
			}
		};

		const entryFromCompiler = getEntryFromCompiler();

		if (entryFromCompiler) {
			return dirname(entryFromCompiler);
		}

		return context;
	}

	async getTabBarIcons(tabBar) {
		const tabBarIcons = new Set();
		const tabBarList = tabBar.list || [];
		for (const tabBarItem of tabBarList) {
			if (tabBarItem.iconPath) {
				tabBarIcons.add(tabBarItem.iconPath);
			}
			if (tabBarItem.selectedIconPath) {
				tabBarIcons.add(tabBarItem.selectedIconPath);
			}
		}

		this.tabBarIcons = tabBarIcons;
	}

	async toEmitTabBarIcons(compilation) {
		const emitIcons = [];
		this.tabBarIcons.forEach(iconPath => {
			const iconSrc = resolve(this.base, iconPath);
			const toEmitIcon = async () => {
				const iconStat = await stat(iconSrc);
				const iconSource = await readFile(iconSrc);
				compilation.assets[iconPath] = {
					size: () => iconStat.size,
					source: () => iconSource
				};
			};
			emitIcons.push(toEmitIcon());
		});
		await Promise.all(emitIcons);
	}

	toAddTabBarIconsDependencies(compilation) {
		const { fileDependencies } = compilation;
		this.tabBarIcons.forEach(iconPath => {
			if (!~fileDependencies.has(iconPath)) {
				fileDependencies.add(iconPath);
			}
		});
	}

	async getEntryResource() {
		const { base } = this;
		const appJSONFile = resolve(base, 'app.json');
		const { pages = [], tabBar = {}, subPackages = [] } = await readJson(
			appJSONFile
		);

		this.getTabBarIcons(tabBar);

		const components = new Set();
		for (const page of pages) {
			await this.getComponents(components, resolve(base, page));
		}

		await Promise.all(components);

		const entryResources = [
			'app',
			...pages,
			...components
		];

		const entrySubPackages = [];
		for (const subPackage of subPackages) {
			const { root, pages = [] } = subPackage;
			const components = new Set();
			for (const page of pages) {
				await this.getComponents(components, resolve(base, join(root, page)));
			}
			await Promise.all(components);

			entrySubPackages.push([
				...pages.map(page => join(root, page)),
				...components
			]);
		}

		await Promise.all(entrySubPackages);

		return { entryResources, entrySubPackages };
	}

	async getComponents(components, instance) {
		const { usingComponents = {} } =
		(await readJson(`${instance}.json`).catch(
			err => err && err.code !== 'ENOENT' && console.error(err)
		)) || {};
		const componentBase = parse(instance).dir;
		for (const relativeComponent of values(usingComponents)) {
			if (relativeComponent.indexOf('plugin://') === 0) {
				continue;
			}
			const component = resolve(componentBase, relativeComponent);
			if (!components.has(component)) {
				components.add(relative(this.base, component));
				await this.getComponents(components, component);
			}
		}
	}

	getFullScriptPath(path) {
		const {
			base,
			options: { extensions }
		} = this;
		for (const ext of extensions) {
			const fullPath = resolve(base, path + ext);
			if (existsSync(fullPath)) {
				return fullPath;
			}
		}
	}

	async clear(compilation) {
		const { path } = compilation.options.output;
		await remove(path);
	}

	addEntries(compiler, entries, chunkName) {
		new MultiEntryPlugin(this.base, entries, chunkName).apply(compiler);
	}

	async compileAssets(compiler) {
		const {
			options: { include, exclude, dot, assetsChunkName, extensions },
			entryResources,
			entrySubPackages
		} = this;

		compiler.hooks.compilation.tap('MiniProgramWebpackPlugin', compilation => {
			compilation.hooks.beforeChunkAssets.tap('MiniProgramWebpackPlugin', () => {
				const assetsChunkIndex = compilation.chunks.findIndex(
					({ name }) => name === assetsChunkName
				);
				if (assetsChunkIndex > -1) {
					compilation.chunks.splice(assetsChunkIndex, 1);
				}
			});
		});

		const patterns = [].concat(entryResources, ...entrySubPackages)
			.map(resource => `${resource}.*`)
			.concat(include);

		const entries = await globby(patterns, {
			cwd: this.base,
			nodir: true,
			realpath: true,
			ignore: [...extensions.map(ext => `**/*${ext}`), ...exclude],
			dot
		});

		this.addEntries(compiler, entries, assetsChunkName);
	}

	applyCommonsChunk(compiler) {
		const { options: { commonModuleName }, entryResources, entrySubPackages } = this;
		const entryScripts = entryResources.map(::this.getFullScriptPath).filter(v => v);

		const cacheGroups = {};
		entrySubPackages.forEach(item => {
			if (item.length) {
				const temp = item[0].split('/');
				const subpackageName = temp.slice(0, temp.length - 1).join('/');
				const subScripts = item.map(::this.getFullScriptPath).filter(v => v);

				cacheGroups[subpackageName.replace(/\//g, '')] = {
					name: stripExt(`${subpackageName}/${commonModuleName}`),
					chunks: 'initial',
					minSize: 0,
					enforce: true,
					test({ context }) {
						return context && subScripts.some(item => item.includes(context));
					}
				};
			}
		});

		console.log(entryScripts);

		new SplitChunksPlugin({
			chunks: 'async',
			minSize: 0,
			minChunks: 1,
			enforce: true,
			name: true,
			cacheGroups: Object.assign({}, cacheGroups, {
				default: false,
				[commonModuleName]: {
					name: stripExt(commonModuleName),
					priority: 10,
					enforce: true,
					test({ context }) {
						return context && entryScripts.some(item => item.includes(context));
					},
				},
				vendor: {
					chunks: 'all',
					test: /node_modules\//,
					name: stripExt('vendors'),
					priority: 10,
					enforce: true
				},
			})
		}).apply(compiler);

		// new RuntimeChunkPlugin().apply(compiler);

	}

	addScriptEntry(compiler, entry, name) {
		compiler.hooks.make.tapAsync('MiniProgramWebpackPlugin', (compilation, callback) => {
			const dep = SingleEntryPlugin.createDependency(entry, name);
			compilation.addEntry(this.base, dep, name, callback);
		});
	}

	compileScripts(compiler) {
		const { entryResources, entrySubPackages } = this;
		[].concat(entryResources, ...entrySubPackages)
			.filter(resource => resource !== 'app')
			.forEach(resource => {
				const fullPath = this.getFullScriptPath(resource);
				this.addScriptEntry(compiler, fullPath, resource);
			});
		this.applyCommonsChunk(compiler);
	}

	toModifyTemplate(compilation) {
		const { commonModuleName } = this.options;
		const { target } = compilation.options;
		const commonChunkName = stripExt(commonModuleName);
		const globalVar = target.name === 'Alipay' ? 'my' : 'wx';

		const replaceSelf = (source) => {
			const concatSource = new ConcatSource();
			if (source.indexOf(`self["webpackJsonp"]`) > -1) {
				source = source.replace(/self\["webpackJsonp"\]/g, `${globalVar}["webpackJsonp"]`);
			}
			concatSource.add(source);
			return concatSource;
		};

		// inject chunk entries
		compilation.chunkTemplate.hooks.render.tap('MiniProgramWebpackPlugin', (core, chunk) => {
			let concatSource = new ConcatSource(core);
			let source = core.source();
			concatSource = replaceSelf(source);
			return concatSource;
		});

		compilation.mainTemplate.hooks.render.tap('MiniProgramWebpackPlugin', (core, chunk) => {
			let concatSource = new ConcatSource(core);
			let source = core.source();
			concatSource = replaceSelf(source);
			if (this.entryResources.indexOf(chunk.name) >= 0) {
				const relativePath = relative(dirname(chunk.name), `./vendors`);
				const posixPath = relativePath.replace(/\\/g, '/');

				// eslint-disable-next-line max-len
				const injectContent = `;require("./${posixPath}");`;

				if (source.indexOf(injectContent) < 0) {
					concatSource.add(injectContent);
				}
			}
			return concatSource;
		});

		// replace `window` to `global` in common chunk
		compilation.mainTemplate.hooks.bootstrap.tap('MiniProgramWebpackPlugin', (source, chunk) => {
			const windowRegExp = new RegExp('self', 'g');
			if (chunk.name === commonChunkName) {
				return source.replace(windowRegExp, globalVar);
			}
			return source;
		});

		// override `require.ensure()`
		compilation.mainTemplate.hooks.requireEnsure.tap('MiniProgramWebpackPlugin', () => 'throw new Error("Not chunk loading available");');
	}

	async run(compiler) {
		this.base = this.getBase(compiler);
		const { entryResources, entrySubPackages } = await this.getEntryResource();
		this.entryResources = entryResources;
		this.entrySubPackages = entrySubPackages;
		compiler.hooks.compilation.tap('MiniProgramWebpackPlugin', ::this.toModifyTemplate);
		this.compileScripts(compiler);
		await this.compileAssets(compiler);
	}
}
