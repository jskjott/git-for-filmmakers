const { app, BrowserWindow } = require('electron')
let win = null

app.on('ready', () => {
	win = new BrowserWindow({
		width: 1200,
		height: 600,
		minWidth: 380,
		minHeight: 380,
		backgroundColor: 'white',
		webPreferences: {
			nodeIntegration: true,
		},
	})

	win.webContents.openDevTools()
	win.loadFile('sources/index.html')
	win.on('closed', function() {
		win = null
	})
})

app.on('window-all-closed', function() {
	{
		app.quit()
	}
})
