function parseFCPTimeSeconds(timeString) {
	const vals = timeString.split('/')
	let secondTiming
	if (vals.length === 1) {
		secondTiming = parseFloat(vals[0])
	} else {
		secondTiming = parseFloat(vals[0]) / parseFloat(vals[1])
	}
	return secondTiming
}

function parser(diffArray) {
	const offsetReg = /(?:^|\s)offset="(.*?)s/
	const durationReg = /(?:^|\s)duration="(.*?)s/
	const laneReg = /(?:^|\s)lane="(.*?)"/

	const timelineData = []

	diffArray.forEach(commitState => {
		const clipElements = []

		commitState[0]
			.trim()
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
					clipElements.push({
						offset: parseFCPTimeSeconds(offset[1]),
						duration: parseFCPTimeSeconds(duration[1]),
						lane: parseInt(lane),
					})
				}
			})

		timelineData.push(clipElements)
	})

	return timelineData
}
