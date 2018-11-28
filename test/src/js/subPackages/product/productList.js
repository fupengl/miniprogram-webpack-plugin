import Product from './product.service';

console.log(Product, '!!!!!!!');
const productService = new Product();

require('./images/test.png')

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
		this.setData({
			productName: productService.getProductName()
		});
	},
});
