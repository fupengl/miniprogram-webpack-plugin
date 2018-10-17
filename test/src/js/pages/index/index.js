
import { flow } from 'lodash';
import { formatTime } from '../../utils/util';

//获取应用实例
const app = getApp(); // eslint-disable-line no-undef

Page({
	data: {
		motto: 'Hello World',
		userInfo: {},
	},
	//事件处理函数
	bindViewTap() {
		wx.navigateTo({
			url: '../logs/logs',
		});
	},
	goToSubList() {
		wx.navigateTo({
			url: '/subPackages/product/productList',
		});
	},
	onLoad() {

		const log = flow(() => {
			console.log(formatTime(new Date()));
		});

		log();

		//调用应用实例的方法获取全局数据
		app.getUserInfo((userInfo) => {
			//更新数据
			this.setData({ userInfo });
		});
	},
});
