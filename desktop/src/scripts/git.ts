const JsDiff = require('diff')
const fs = require('fs').promises
const git = require('isomorphic-git')
const xmldom = require('xmldom')
const c14n = require('xml-c14n')

let canonicaliser = new c14n()
canonicaliser = canonicaliser.createCanonicaliser(
	'http://www.w3.org/2001/10/xml-exc-c14n#',
)

//export async function canonicalise(xmlData: string) {
	//const document = new xmldoc.XmlDocument(xmlData)
	//return await canonicaliser.canonicalise(document.documentElement)
//}

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
			//canonicalise(commit)
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
	filepath: string
}

export function diff({ dir, filepath }: DiffInput) {
	let branchFile
	const fname = dir + '/' + filepath
	return fs
		.readFile(fname)
		.then(function(newFile: string) {
			return Promise.all([newFile, readBranchFile({ fs, dir })])
		})
		.then((data: any) => {
			branchFile = data[1].log
			const files = data[1].commits.reverse()
			const diffArray = files.map((file:string, i:number) => {
				if (i === 0) {
					return [file, []]
				} else {
					const diff = JsDiff.diffLines(files[i - 1], file)
					return [file, diff]
				}
			})

			return [diffArray, branchFile]
		})
}
