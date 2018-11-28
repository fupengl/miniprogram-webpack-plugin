
import { formatTime } from '../../utils/util';

Page({
	data: {
		motto: 'Hello World',
		userInfo: {},
	},
	onLoad() {
		console.log(formatTime(new Date()))
	},
	bindViewTap() {
		wx.navigateTo({
			url: '../../subPackages/logs/logs',
		});
	},
	goToSubList() {
		wx.navigateTo({
			url: '../../subPackages/product/productList',
		});
	},
	onLoad() {
	},
});
