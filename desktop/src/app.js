const { app, BrowserWindow } = require('electron')

let win = null
let url

//if (process.env.NODE_ENV === 'DEV') {
//url = 'http://localhost:8089/'
//} else {
//url = '/dist/index.html'
//}

url = 'http://localhost:3000/'

app.on('ready', () => {
	win = new BrowserWindow({
		width: 1200,
		height: 600,
		minWidth: 380,
		minHeight: 380,
		backgroundColor: 'white',
		frame: process.platform !== 'darwin',
		skipTaskbar: process.platform === 'darwin',
		autoHideMenuBar: process.platform === 'darwin',
		webPreferences: {
			nodeIntegration: true,
		},
	})

	win.webContents.openDevTools()
	win.loadURL(url)
	win.on('closed', function() {
		win = null
	})

	win.once('ready-to-show', () => {
		win.show()
	})
})

app.on('window-all-closed', function() {
	{
		app.quit()
	}
})
