import { formatTime } from '../../utils/util';

Page({
	data: {
		logs: [],
	},
	onLoad() {
		console.log(formatTime(new Date()));

		this.setData({
			logs: (wx.getStorageSync('logs') || []).map(function (log) {
				return formatTime(new Date(log));
			}),
		});
	}
});
