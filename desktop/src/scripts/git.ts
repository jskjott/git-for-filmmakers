const JsDiff = require('diff')
const fs = require('fs').promises
const fss = require('fs')
const git = require('isomorphic-git')
const path = require('path');

const DOMParser = require('xmldom').DOMParser
const XMLSerializer = require('xmldom').XMLSerializer

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

function sortTags(xml: string){
	const lines = xml.split('\n')

	const sortedLines = lines.map(line => line.split(' ').sort().join(' '))

	return (sortedLines.join('\n'))
}

// readBranchFile & diff inspired by https://github.com/isomorphic-git/isomorphic-git/issues/193

interface RB {
	dir: string
	fs: any
}

export interface Commit {
	author: {
		email: string
		name: string
		timestamp: number
		timezoneOffset: number
	}
	committer: {
		email: string
		name: string
		timestamp: number
		timezoneOffset: number
	}
	message: string
	oid: string
	parent: string[]
	tree: string
}

export async function checkCurrent({ dir, fs }: RB) {

	const repoContent = await fs.readdir(dir)
	const xmlFileName = repoContent.filter((file: string) => {
		return file.match('.fcpxml')
	})

	const file = await fs.readFile(
		`${dir}/${xmlFileName}`,
		'utf8',
	)

	const processedFile = process([file])
	
	return(processedFile)
}

export async function readBranchFile({ dir, fs }: RB) {
	const commitFiles = []

	const repoContent = await fs.readdir(dir)
	const xmlFileName = repoContent.filter((file: string) => {
		return file.match('.fcpxml')
	})

	const currentFileContent = await fs.readFile(
		`${dir}/${xmlFileName}`,
		'utf8',
	)

	commitFiles.push(currentFileContent)

	const log = [
		{
			message: 'current',
			author: {
				timestamp: Date.now(),
			},
		},
	]

	const commitInfo: Commit[] = await git.log({ fs, dir })
	log.push(...commitInfo)

	interface Entry {
		mode: number
		path: number
		oid: number
		type: number
	}

	interface File {
		format: string
		object: {
			entries: Entry[]
		}
		oid: string
		source: string
		type: string
	}

	const commitObjects: File[] = await Promise.all(
		commitInfo.map(commit =>
			git.readObject({ fs, dir, oid: commit.tree }),
		),
	)

	const fileContents: File[] = await Promise.all(
		commitObjects.map((commit) =>
			git.readObject({ fs, dir, oid: commit.object.entries[0].oid }),
		),
	)

	fileContents.forEach((file) => commitFiles.push(file.object.toString()))

	const commits = await Promise.all(
		commitFiles.map(commit => {
			const transformed = sortTags(commit)
			return commit
		}),
	)

	const data = {
		commits,
		log,
	}
	return data
}

interface DiffInput{
	dir: string
	path: string
}

export function diff({ dir, path }: DiffInput) {
	let branchFile
	const fname = dir + '/' + path
	return fs
		.readFile(fname)
		.then(function(newFile: string) {
			return Promise.all([newFile, readBranchFile({ fs, dir })])
		})
		.then((data: any) => {
			branchFile = data[1].log
			const files = data[1].commits.reverse()

			const processed = process(files)

			const diffArray = processed.map((file:string, i:number) => {
				if (i === 0) {
					return [file, []]
				} else {
					const diff = JsDiff.diffLines(processed[i - 1], file)
					return [file, diff]
				}
			})
			return [diffArray, branchFile]
		})
}

function process(files: string[]){

	let processedFile: string[] = []

	files.map(file => {
		const assets = []

		const doc = new DOMParser().parseFromString(file)
		const assetClips = doc.getElementsByTagName('asset-clip')
		const gaps = doc.getElementsByTagName('gap')

		let gapTransforms: {lineNumber: number, gapOffset: string}[] = []

		for (var i = 0; gaps.length > i; i++) {
			const gapOffset = gaps.item(i).attributes.getNamedItem('offset').value
			const lineNumber = gaps.item(i).lineNumber

			const gap = {
				lineNumber,
				gapOffset
			}
			gapTransforms.push(gap)
		}

		for (var i = 0; assetClips.length > i; i++) {

			const clip = assetClips.item(i)

			const lineNumber = clip.lineNumber

			let gapTransform: number = 0

			gapTransforms.forEach((ele, i) => {

				const nextExists = i+1 < gapTransforms.length

				if (ele.lineNumber < lineNumber) {
					 if (nextExists && lineNumber < gapTransforms[i+1].lineNumber || !nextExists ){
					 	gapTransform = parseTime(ele.gapOffset) - 3600
					 }
				}
			})

			const nodeOffset = clip.attributes.getNamedItem('offset').value

			const offset = doc.createAttribute("offset")
			
			if (clip.attributes.getNamedItem('lane') && clip.parentNode.tagName !== 'asset-clip') {
				offset.value = (parseTime(nodeOffset) + gapTransform).toString()
				assetClips.item(i).attributes.setNamedItem(offset)
			}
			
			assets.push(assetClips.item(i))
			
		}

		assets.map(clip => {
			if (clip.hasChildNodes()) {
			 	while (clip.hasChildNodes()) {
			 		clip.removeChild(clip.firstChild)
			 	}
			 }

			return (new XMLSerializer().serializeToString(assetClips.item(i)))
		})

		processedFile.push(assets.join('\n'))
	})

	return(processedFile)
}
