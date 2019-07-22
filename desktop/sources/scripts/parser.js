function parser(text) {
	const clipElements = []
	const offsetReg = /(?:^|\s)offset="(.*?)s/
	const durationReg = /(?:^|\s)duration="(.*?)s/
	const laneReg = /(?:^|\s)lane="(.*?)"/

	text.trim()
		.split(/\n/)
		.forEach(line => {
			if (line.match('<asset-clip')) {
				const offset = line.match(offsetReg)
				const duration = line.match(durationReg)
				let lane
				if (line.match(laneReg)) {
					const match = line.match(laneReg)
					lane = parseFloat(match[1])
				} else {
					lane = 0
				}
				clipElements.push([offset[1], duration[1], lane])
			}
		})

	return clipElements
}
