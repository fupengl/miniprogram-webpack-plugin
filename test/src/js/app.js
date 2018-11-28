
import { formatTime } from 'utils/util';

App({
	onLaunch() {

		flow(() => console.log('typeof formatTime', typeof formatTime))();

		//调用API从本地缓存中获取数据
		var logs = wx.getStorageSync('logs') || [];
		logs.unshift(Date.now());
		wx.setStorageSync('logs', logs);
	}
});
