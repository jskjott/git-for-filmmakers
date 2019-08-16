module.exports = {
	lintOnSave: false,
	configureWebpack: {
		externals:{
        	fs:    "commonjs fs",
        	path:  "commonjs path",
        	electron: 'electron'
    	},
  	}
}
