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

export async function readBranchFile({ dir, fs }) {
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

	const commitInfo = await git.log({ fs: fs, dir: dir })
	log.push(...commitInfo)

	console.log(commitInfo)
	interface Commit {}

	const commitObjects = await Promise.all(
		commitInfo.map((commit: object) =>
			git.readObject({ fs, dir, oid: commit.tree }),
		),
	)
	const fileContents = await Promise.all(
		commitObjects.map(commit =>
			git.readObject({ fs, dir, oid: commit.object.entries[0].oid }),
		),
	)

	fileContents.forEach(file => commitFiles.push(file.object.toString('utf8')))

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

export function diff({ dir, filepath }) {
	let branchFile
	const fname = dir + '/' + filepath
	return fs
		.readFile(fname)
		.then(function(newFile: string) {
			return Promise.all([newFile, readBranchFile({ fs, dir })])
		})
		.then((data) => {
			branchFile = data[1].log
			const files = data[1].commits.reverse()
			const diffArray = files.map((file, i) => {
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
