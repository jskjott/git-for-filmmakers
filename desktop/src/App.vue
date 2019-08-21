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
const fss = require('fs')

import { diff, Commit } from './scripts/git'
import Timeline from './components/Timeline.vue'
import TreeGraph from './components/TreeGraph.vue'
import Menu from './components/Menu.vue'

declare global {
	interface Window {
		require: any
	}
}
const { dialog } = window.require('electron').remote

const parseTime = (timeString: string) => {
	let secondTiming

	if (timeString.match('/')) {
		const vals = timeString.split('/')

		if (vals.length === 1) {
			secondTiming = parseFloat(vals[0])
		} else {
			secondTiming = parseFloat(vals[0]) / parseFloat(vals[1])
		}
	} else {
		secondTiming = parseFloat(timeString)
	}

	return secondTiming
}

function roundTo2(num: number) {
	return +num.toFixed(2)
}

export interface TimelineElement {
	offset: number
	duration: number
	lane: number
	start: number
	color: string
	id?: string
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
					d.offset >= this.lane0Transform
						? d.offset - this.lane0Transform
						: d.offset),
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
				this.$forceUpdate()
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
	mounted() {},
	methods: {
		initRepo: async function(repoPath: { dir: string; file: string }) {
			const state: { [oid: string]: State } = {}
			const [sourcefiles, commitLogs] = await diff({
				dir: repoPath.dir,
				path: repoPath.file,
			})
			commitLogs.forEach((log: Commit, i: number) => {
				const { blocks: timelineElements, laneNumber } = this.parseDiff(
					sourcefiles[i],
				)

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
				const [filePath] = selectedRepo.filePaths
				const path = filePath.split('/')
				const dir = path.slice(0, -1).join('/')
				const file = path.pop()
				if (file !== undefined) {
					this.currentRepo = { dir, file }

					fss.watchFile(filePath, () => {
						this.currentRepo = { dir, file }
					})
				}
			}
		},
		parseDiff: (sourceFile: [string, Hunk[]]) => {
			const durationReg = /(?:^|\s)duration="(.*?)"/
			const offsetReg = /(?:^|\s)offset="(.*?)"/
			const laneReg = /(?:^|\s)lane="(.*?)"/
			const startReg = /(?:^|\s)start="(.*?)"/
			const idReg = /(?:^|\s)ref="(.*?)"/

			const laneArrays: TimelineElement[][] = []

			if (sourceFile[1].length === 0) {
				sourceFile[0]
					.trim()
					.split(/\n/)
					.forEach(line => {
						if (line.match('<asset-clip')) {
							const offset = line.match(offsetReg)
							const duration = line.match(durationReg)

							let id: string

							if (line.match(idReg) !== null) {
								id = line.match(idReg)![1]
							} else {
								id = ''
							}

							let lane
							if (line.match(laneReg)) {
								const match = line.match(laneReg)
								lane = parseFloat(match![1])
							} else {
								lane = 0
							}

							if (!laneArrays[lane]) {
								laneArrays.push(
									...Array.apply(
										null,
										Array(lane + 1 - laneArrays.length),
									).map(function() {
										return []
									}),
								)
							}

							let start

							if (line.match(startReg)) {
								start = parseTime(line!.match(startReg)![1])
							} else {
								start = 0
							}

							laneArrays[lane].push({
								offset: parseTime(offset![1]),
								duration: parseTime(duration![1]),
								lane,
								start,
								color: 'forestgreen',
								id,
							})
						}
					})
			}
			if (sourceFile[1].length > 0) {
				sourceFile[1].forEach((hunk: Hunk) => {
					const lines = hunk.value.split('\n')

					lines.forEach(line => {
						if (line.match('<asset-clip')) {
							let lane
							let start
							let duration: number
							let offset: number
							const color = hunk.added
								? 'forestgreen'
								: hunk.removed
								? 'crimson'
								: 'silver'

							if (line.match(laneReg)) {
								lane = parseInt(line!.match(laneReg)![1])
							} else {
								lane = 0
							}

							if (line.match(durationReg)) {
								duration = parseTime(
									line!.match(durationReg)![1],
								)
							} else {
								duration = 0
							}

							if (line.match(offsetReg)) {
								offset = parseTime(line!.match(offsetReg)![1])
							} else {
								offset = 0
							}

							if (line.match(startReg)) {
								start = parseTime(line!.match(startReg)![1])
							} else {
								start = 0
							}

							if (!laneArrays[lane]) {
								laneArrays.push(
									...Array.apply(
										null,
										Array(lane + 1 - laneArrays.length),
									).map(function() {
										return []
									}),
								)
							}

							laneArrays[lane].push({
								lane,
								color,
								duration,
								offset,
								start,
							})
						}
					})
				})

				laneArrays.forEach(lane => {
					lane.sort((a, b) => {
						const aOffset =
							a.offset > 3500 ? a.offset - 3600 : a.offset
						const bOffset =
							b.offset > 3500 ? b.offset - 3600 : b.offset

						return aOffset - bOffset
					})
				})

				laneArrays.forEach(lane => {
					lane.map((clip, i) => {
						let moreElements = true
						const offset =
							clip.offset > 3500
								? clip.offset - 3600
								: clip.offset
						if (i + 1 === lane.length) {
							moreElements = false
						}

						if (moreElements) {
							const offsets =
								roundTo2(clip.offset) ===
								roundTo2(lane[i + 1].offset)
							const ids = clip.id === lane[i + 1].id
							const starts = clip.start === lane[i + 1].start
							const durations =
								clip.duration === lane[i + 1].duration

							const overlappingElements = lane.filter(ele => {
								const eleOffset =
									ele.offset > 3500
										? ele.offset - 3600
										: ele.offset

								if (
									offset < eleOffset + ele.duration / 2 &&
									eleOffset + ele.duration / 2 <
										offset + clip.duration &&
									ele.color !== 'crimson'
								) {
									return true
								} else {
									return false
								}
							})

							overlappingElements.forEach((overlap, index) => {
								const eleOffset =
									overlap.offset > 3500
										? overlap.offset - 3600
										: overlap.offset

								const offsets = eleOffset - offset
								const starts = overlap.start - clip.start

								if (
									(offsets - starts < 0.5 &&
										offsets - starts > 0) ||
									(starts - offsets < 0.5 &&
										starts - offsets > 0)
								) {
									overlap.color = 'silver'
									clip.color = 'crimson'
								}

								if (index + 1 < overlappingElements.length) {
									const nextOffset =
										overlappingElements[index + 1].offset >
										3500
											? overlappingElements[index + 1]
													.offset - 3600
											: overlappingElements[index + 1]
													.offset
									if (
										nextOffset -
											(eleOffset + overlap.duration) >
										0.5
									) {
										lane.push({
											color: 'crimson',
											//lane: overlap.lane,
											offset:
												eleOffset -
												3.6 +
												overlap.duration,
											duration:
												nextOffset -
												(eleOffset + overlap.duration),
											start: 0,
										})
									}
								}
							})

							if (ids && starts && durations && offsets) {
								clip.color = 'silver'
								lane.splice(i + 1, 1)
							} else if (clip.color === 'silver') {
								null
							} else if (
								roundTo2(clip.start + clip.duration) -
									roundTo2(
										lane[i + 1].start +
											lane[i + 1].duration,
									) <
									0.5 ||
								roundTo2(
									lane[i + 1].start + lane[i + 1].duration,
								) -
									roundTo2(clip.start + clip.duration) <
									0.5
							) {
								const clipTiming =
									clip.offset - clip.start + clip.duration
								const nextClipTiming =
									lane[i + 1].offset -
									lane[i + 1].start +
									clip.duration

								if (
									(clipTiming - nextClipTiming >= 0 &&
										clipTiming - nextClipTiming < 0.5) ||
									(nextClipTiming - clipTiming >= 0 &&
										nextClipTiming - clipTiming < 0.5)
								) {
									lane[i + 1].color = 'silver'
									clip.duration =
										clip.duration - lane[i + 1].duration
								}
							}

							if (overlappingElements.length > 1) {
								lane.splice(i, 1)
							}
						}
					})
				})
			}

			laneArrays.forEach(lane => {
				lane.map((clip, i) => {
					let moreElements = true

					if (i + 1 === lane.length) {
						moreElements = false
					}

					if (moreElements) {
						const offset =
							clip.offset > 3500
								? clip.offset - 3600
								: clip.offset
						const nextOffset =
							lane[i + 1].offset > 3500
								? lane[i + 1].offset - 3603.6
								: lane[i + 1].offset

						if (
							(clip.duration === lane[i + 1].duration &&
								offset - nextOffset < 0.5 &&
								offset - nextOffset > 0) ||
							(nextOffset - offset < 0.5 &&
								nextOffset - offset > 0)
						) {
							clip.color = 'silver'
							lane.splice(i + 1, 1)
						}
					}
				})
			})

			const laneNumber: number = laneArrays.length

			const blocks: TimelineElement[] = laneArrays.flatMap(
				(lane: TimelineElement[]) => lane,
			)

			return { blocks, laneNumber }
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
	background-color: #1d1d1d;
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
