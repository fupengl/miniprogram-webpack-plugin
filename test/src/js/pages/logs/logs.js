
import { formatTime } from '../../utils/util';

Page({
	data: {
		logs: [],
	},
	onLoad() {
		this.setData({
			logs: (wx.getStorageSync('logs') || []).map(function (log) {
				return formatTime(new Date(log));
			}),
		});
	}
});
