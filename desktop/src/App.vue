<template>
	<div id="app">
		<div id="header"></div>
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

import { parser, parseDiff } from './scripts/parser'
import { diff } from './scripts/git'
import Scale from './scripts/helperfunctions'
import Timeline from './components/Timeline'
import TreeGraph from './components/TreeGraph'

interface State {}

export default Vue.extend({
	name: 'app',
	components: {
		TreeGraph,
		Timeline,
	},
	data() {
		return {
			state: null,
			orderedCommits: null,
			scale: null,
		}
	},
	methods: {
		parse: (data: string) => {
			return parser(data)
		},
	},
	async created() {
		const state = {}
		const [sourcefiles, commitLogs] = await diff({
			dir: '../example_repo',
			filepath: 'example.fcpxml',
			branch: 'master',
		})
		commitLogs.forEach((log, i) => {
			const timelineElements = this.parse(sourcefiles[i][0])
			timelineElements.push(...parseDiff(sourcefiles[i]))
			const laneNumber =
				Math.max(...timelineElements.map(ele => ele.lane)) + 1

			state[log.oid || log.message] = {
				sourceFile: sourcefiles[i],
				logInfo: log,
				timelineElements,
				laneNumber,
			}
		})

		const commits = Object.values(state)
		commits.sort((a, b) => {
			return a.logInfo.author.timestamp - b.logInfo.author.timestamp
		})

		this.state = state
		this.orderedCommits = commits
	},
	watch: {
		state: function() {
			this.scale = new Scale(this.state)
		},
	},
})
</script>

<style>
* {
	margin: 0;
	background-color: #1a161a;
}

*::-webkit-scrollbar {
	/* WebKit */
	width: 0;
	height: 0;
}

body {
}

h1,
h2,
p {
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
	background-color: #1f191f;
}

#timeline {
	display: block;
}
</style>
