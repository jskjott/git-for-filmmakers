<template>
	<div id="app">
		<div id="header">
			<Menu @selectRepo="selectRepo" v-bind="{ currentRepo }"></Menu>
		</div>
		<div id="visualisation">
			<div id="graph">
				<TreeGraph v-bind="{ state }"> </TreeGraph>
			</div>
			<div id="timeline">
				<div v-for="commit in orderedCommits">
					<Timeline v-bind="{ commit, scale }"> </Timeline>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue'
import * as d3 from 'd3'
const { dialog } = window.require('electron').remote

import { diff, Commit } from './scripts/git'
import Timeline from './components/Timeline.vue'
import TreeGraph from './components/TreeGraph.vue'
import Menu from './components/Menu.vue'

const parseTime = (timeString: string) => {
	const vals = timeString.split('/')
	let secondTiming
	if (vals.length === 1) {
		secondTiming = parseFloat(vals[0])
	} else {
		secondTiming = parseFloat(vals[0]) / parseFloat(vals[1])
	}
	return secondTiming
}

export interface TimelineElement {
	offset: number
	duration: number
	lane: number
	color: string
}

class Scale {
	min: number
	max: number
	lane0Transform: number
	offsetScale: (arg0: number) => number

	constructor(state: { [oid: string]: State }) {
		const flattenedData: TimelineElement[] = Object.values(state).flatMap(
			commit => commit.timelineElements,
		)

		const lane0 = flattenedData.filter(d => d!.lane === 0)
		this.lane0Transform = lane0.reduce(
			(min, val) => (val.offset < min ? val.offset : min),
			99999,
		)

		flattenedData.map(
			d =>
				(d.offset =
					d.lane === 0 ? d.offset - this.lane0Transform : d.offset),
		)

		this.min = flattenedData.reduce(
			(min, val) => (val.lane < min ? val.lane : min),
			99999,
		)
		this.max = 0

		flattenedData.forEach(block => {
			if (block.offset + block.duration > this.max) {
				this.max = block.offset + block.duration
			}
		})

		const offsetMax = flattenedData.reduce(
			(max, val) => (val.offset > max ? val.offset : max),
			0,
		)
		const offsetMin = lane0.reduce(
			(min, val) => (val.offset < min ? val.offset : min),
			99999,
		)

		const extent: [number, number] = [offsetMin, offsetMax]

		extent[1] = this.max
		extent.forEach((ele: number, i: number) => (extent[i] = ele - this.min))

		this.offsetScale = d3
			.scaleLinear()
			.domain(extent)
			.range([0, 750])
	}
}

export interface State {
	sourceFile: string
	logInfo: Commit
	timelineElements: TimelineElement[]
	laneNumber: number
}

interface Hunk {
	count: number
	value: string
	added?: boolean | undefined
	removed?: boolean | undefined
}

interface SelectedRepo {
	cancelled: boolean | undefined
	filePaths: string[]
}

let currentRepo: { dir: string; file: string }
let state: { [oid: string]: State }
let scale: Scale
let orderedCommits: State[]

const vue = Vue.extend({
	name: 'app',
	components: {
		TreeGraph,
		Timeline,
		Menu,
	},
	data() {
		return {
			currentRepo,
			state,
			orderedCommits,
			scale,
		}
	},
	watch: {
		currentRepo: {
			handler: function() {
				this.initRepo(this.currentRepo)
			},
			deep: true,
		},
		state: {
			handler: function() {
				this.scale = new Scale(this.state)
			},
			deep: true,
		},
	},
	methods: {
		initRepo: async function({ dir, file }: { dir: string; file: string }) {
			const state: { [oid: string]: State } = {}
			const [sourcefiles, commitLogs] = await diff({
				dir: '../example_repo',
				filepath: 'example.fcpxml',
			})
			commitLogs.forEach((log: Commit, i: number) => {
				const timelineElements = this.parseText(sourcefiles[i][0])
				timelineElements.push(...this.parseDiff(sourcefiles[i]))
				const laneNumber =
					Math.max(
						...timelineElements.map(
							(ele: TimelineElement) => ele.lane,
						),
					) + 1

				state[log.oid || log.message] = {
					sourceFile: sourcefiles[i],
					logInfo: log,
					timelineElements,
					laneNumber,
				}
			})

			const commits: State[] = Object.values(state)
			commits.sort((a, b) => {
				return a.logInfo.author.timestamp - b.logInfo.author.timestamp
			})

			this.state = state
			this.orderedCommits = commits
		},
		selectRepo: async function() {
			const options = {
				properties: ['openFile'],
				filters: [{ name: 'XML Project File', extensions: ['fcpxml'] }],
			}

			const selectedRepo: SelectedRepo = await dialog
				.showOpenDialog(options)
				.then((result: SelectedRepo) => result)
			if (!selectedRepo.cancelled) {
				const elements = selectedRepo.filePaths[0].split('/')
				const dir = elements.slice(0, -1).join('/')
				const file = elements.pop()
				if (file !== undefined) {
					this.currentRepo = { dir, file }
				}
			}
		},
		parseText: (sourceText: string) => {
			const offsetReg = /(?:^|\s)offset="(.*?)s/
			const durationReg = /(?:^|\s)duration="(.*?)s/
			const laneReg = /(?:^|\s)lane="(.*?)"/

			const clipElements: TimelineElement[] = []
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
							lane = parseFloat(match![1])
						} else {
							lane = 0
						}
						clipElements.push({
							offset: parseTime(offset![1]),
							duration: parseTime(duration![1]),
							lane,
							color: '#717171',
						})
					}
				})

			return clipElements
		},
		parseDiff: (sourceFile: [string, Hunk[]]) => {
			const durationReg = /(?:^|\s)duration="(.*?)s/
			const offsetReg = /(?:^|\s)offset="(.*?)s/
			const laneReg = /(?:^|\s)lane="(.*?)"/

			const changes = []
			const blocks: TimelineElement[] = []
			if (sourceFile[1].length > 0) {
				const forCommit: Hunk[][] = []
				sourceFile[1].forEach((hunk: Hunk) => {
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
						let assetClips: [string, boolean][] = []
						hunk.forEach((line: Hunk) => {
							if (line.added === undefined) {
								line.added = false
							}
							if (
								line.value.match('<asset-clip') &&
								typeof line.added === 'boolean'
							) {
								assetClips.push([line.value, line!.added])
							}
							if (line.added !== hunk[0].added) {
								allSame = false
							}
						})
						if (allSame && assetClips.length > 0) {
							assetClips.forEach(clip => {
								const line = clip[0].match(
									/^.*\b(asset-clip )\b.*$/gm,
								)
								if (line) {
									const offset = line![0].match(offsetReg)
										? parseTime(
												line![0].match(offsetReg)![1],
										  )
										: 0
									const duration = line![0].match(durationReg)
										? parseTime(
												line![0].match(durationReg)![1],
										  )
										: 0
									const lane = line![0].match(laneReg)
										? parseInt(line![0].match(laneReg)![1])
										: 0
									const color =
										hunk![0].added === true
											? 'forestgreen'
											: 'crimson'

									blocks.push({
										offset,
										duration,
										lane,
										color,
									})
								}
							})
						} else if (!allSame && assetClips.length > 1) {
							let color
							const aOffset = parseTime(
								assetClips![0][0].match(offsetReg)![1],
							)
							const aDuration = parseTime(
								assetClips![0][0].match(durationReg)![1],
							)
							const bOffset = parseTime(
								assetClips![1][0].match(offsetReg)![1],
							)
							const bDuration = parseTime(
								assetClips![1][0].match(durationReg)![1],
							)

							let points = [
								aOffset + aDuration,
								bOffset + bDuration,
							]

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

							const line =
								assetClips![0][0].match(
									/^.*\b(asset-clip )\b.*$/gm,
								) || ''

							let lane
							if (line[0].match(laneReg)) {
								lane = parseInt(line![0].match(laneReg)![1])
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
		},
	},
})

export default vue
</script>

<style>
@font-face {
	font-family: 'titillium_webbold';
	src: url('assets/titilliumweb-bold-webfont.woff2') format('woff2'),
		url('assets/titilliumweb-bold-webfont.woff') format('woff');
	font-weight: normal;
	font-style: normal;
}

@font-face {
	font-family: 'open_sansregular';
	src: url('assets/opensans-regular-webfont.woff2') format('woff2'),
		url('assets/opensans-regular-webfont.woff') format('woff');
	font-weight: normal;
	font-style: normal;
}

h3,
h2,
h1 {
	font-family: 'titillium_webbold';
	margin-bottom: 1rem;
}

* {
	margin: 0;
	background-color: #1a161a;
	font-family: 'open_sansregular';
}

*::-webkit-scrollbar {
	/* WebKit */
	width: 0;
	height: 0;
}

body {
}

p {
	font-family: 'open_sansregular';
	margin-bottom: 1rem;
}

a {
	color: inherit;
}

svg {
	display: block;
}

#header {
	height: 100px;
	width: auto;
}

#visualisation {
	display: grid;
	grid-template-columns: 400px 800px;
	grid-template-areas: 'graph timeline';
	line-height: 1.6;
}

#graph {
	border-right: solid 5px;
	background-color: #1d1d1d;
}

#timeline {
	display: block;
}
</style>
