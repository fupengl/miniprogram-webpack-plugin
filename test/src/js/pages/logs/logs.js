
import { formatTime } from '../../utils/util';

Page({
	data: {
		logs: [],
	},
	onLoad() {
		console.log(formatTime(new Date()))

		this.setData({
			logs: (wx.getStorageSync('logs') || []).map(function (log) {
				return 1 // formatTime(new Date(log));
			}),
		});
	}
});
