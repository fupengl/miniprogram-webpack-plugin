
import { formatTime } from '../../utils/util';
import Product from './product.service';

console.log(Product, '!!!!!!!')
const productService = new Product();

Page({
	data: {
		logs: [],
		testImage: require('./images/test.png')
	},
	onLoad() {
		this.setData({
			logs: (wx.getStorageSync('logs') || []).map(function (log) {
				return formatTime(new Date(log));
			}),
			productName: productService.getProductName()
		});
	}
});
