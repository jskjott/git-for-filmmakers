const JsDiff = require('diff')
const fs = require('fs').promises
const git = require('isomorphic-git')

// readBranchFile & diff inspired by https://github.com/isomorphic-git/isomorphic-git/issues/193

async function readBranchFile({ dir, fs }) {
	const commitFiles = []

	const repoContent = await fs.readdir(dir)
	const xmlFileName = repoContent.filter(file => {
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

	const commits = await Promise.all(
		commitInfo.map(commit => git.readObject({ fs, dir, oid: commit.tree })),
	)
	const fileContents = await Promise.all(
		commits.map(commit =>
			git.readObject({ fs, dir, oid: commit.object.entries[0].oid }),
		),
	)

	fileContents.forEach(file => commitFiles.push(file.object.toString('utf8')))

	const data = {
		commits: commitFiles,
		log,
	}
	return data
}

function diff({ dir, filepath }) {
	let branchFile
	let fname = dir + '/' + filepath
	return fs
		.readFile(fname)
		.then(function(newFile) {
			return Promise.all([newFile, readBranchFile({ fs, dir })])
		})
		.then(data => {
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
