export function parseTime(timeString) {
	const vals = timeString.split('/')
	let secondTiming
	if (vals.length === 1) {
		secondTiming = parseFloat(vals[0])
	} else {
		secondTiming = parseFloat(vals[0]) / parseFloat(vals[1])
	}
	return secondTiming
}

export function parser(sourceText) {
	const offsetReg = /(?:^|\s)offset="(.*?)s/
	const durationReg = /(?:^|\s)duration="(.*?)s/
	const laneReg = /(?:^|\s)lane="(.*?)"/

	const clipElements = []
	sourceText
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
					offset: parseTime(offset[1]),
					duration: parseTime(duration[1]),
					lane: parseInt(lane),
					color: 'dimgrey',
				})
			}
		})

	return clipElements
}

export function parseDiff(sourceFile) {
	const durationReg = /(?:^|\s)duration="(.*?)s/
	const offsetReg = /(?:^|\s)offset="(.*?)s/
	const laneReg = /(?:^|\s)lane="(.*?)"/

	const changes = []
	const blocks = []

	if (sourceFile[1].length > 0) {
		const forCommit = []
		sourceFile[1].forEach(hunk => {
			if (
				Object.prototype.hasOwnProperty.call(hunk, 'added') &&
				Object.prototype.hasOwnProperty.call(hunk, 'removed')
			) {
				forCommit[forCommit.length - 1].push(hunk)
			} else {
				forCommit.push([])
			}
		})

		changes.push(forCommit)

		changes.forEach(commit => {
			commit.forEach(hunk => {
				let allSame = true
				let assetClips = []
				hunk.forEach(lineChange => {
					if (lineChange.value.match('<asset-clip')) {
						assetClips.push([lineChange.value, lineChange.added])
					}
					if (lineChange.added !== hunk[0].added) {
						allSame = false
					}
				})
				if (allSame && assetClips.length > 0) {
					assetClips.forEach(clip => {
						const line = clip[0].match(/^.*\b(asset-clip )\b.*$/gm)
						blocks.push({
							offset: parseTime(line[0].match(offsetReg)[1]),
							duration: parseTime(line[0].match(durationReg)[1]),
							lane: line[0].match(laneReg)
								? parseInt(line[0].match(laneReg)[1])
								: 0,
							color:
								hunk[0].added === true
									? 'forestgreen'
									: 'crimson',
						})
					})
				} else if (!allSame && assetClips.length > 0) {
					let color
					const aOffset = parseTime(
						assetClips[0][0].match(offsetReg)[1],
					)
					const aDuration = parseTime(
						assetClips[0][0].match(durationReg)[1],
					)
					const bOffset = parseTime(
						assetClips[1][0].match(offsetReg)[1],
					)
					const bDuration = parseTime(
						assetClips[1][0].match(durationReg)[1],
					)

					let points = [aOffset + aDuration, bOffset + bDuration]

					if (
						(assetClips[0][1] && points[0] > points[1]) ||
						(assetClips[1][1] && points[1] > points[0])
					) {
						color = 'forestgreen'
					} else {
						color = 'crimson'
					}

					if (points[0] > points[1]) {
						points = [points[1], points[0]]
					}

					const line = assetClips[0][0].match(
						/^.*\b(asset-clip )\b.*$/gm,
					)
					let lane
					if (line[0].match(laneReg)) {
						lane = parseInt(line[0].match(laneReg)[1])
					} else {
						lane = 0
					}

					blocks.push({
						offset: points[0],
						duration: Math.abs(points[0] - points[1]),
						lane,
						color,
					})
				}
			})
		})
	}
	return blocks
}
