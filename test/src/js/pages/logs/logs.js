
// import { formatTime } from '../../utils/util';

Page({
	data: {
		logs: [],
	},
	onLoad() {
		this.setData({
			logs: (wx.getStorageSync('logs') || []).map(function (log) {
				return 1 // formatTime(new Date(log));
			}),
		});
	}
});
