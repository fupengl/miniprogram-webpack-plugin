
// import { flow } from 'lodash';

// const delay = (t = 0) => new Promise((resolve) => setTimeout(resolve, t));
import Product from './product.service';

console.log(Product, '!!!!!!!')
const productService = new Product();
//获取应用实例
const app = getApp(); // eslint-disable-line no-undef

Page({
	data: {
		motto: 'Hello List',
		userInfo: {},
	},
	//事件处理函数
	bindViewTap() {
		wx.navigateTo({
			url: './productDetail',
		});
	},
	onLoad() {

		// await delay();

		// const log = flow(() => {
		// 	console.log('onLoad');
		// });

		// log();
		this.setData({
			productName: productService.getProductName()
		})

		//调用应用实例的方法获取全局数据
		app.getUserInfo((userInfo) => {
			//更新数据
			this.setData({ userInfo });
		});
	},
});
