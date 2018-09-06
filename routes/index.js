const fs = require('fs');
const path = require('path');
const makeDir = require('make-dir');
const rimraf = require('rimraf');
const formidable = require('formidable');
const JSZip = require('jszip');
const compressImages = require('compress-images');
const pool = require('../mysql/db.js');
const { getUseragent, getIpAddress, formatBytes } = require('../util');
const route = require('express').Router();

route.get('/', (req, res) => {
	console.log('req.clientIp:', req.clientIp);
	res.sendFile(path.join(__dirname, '../', 'views/index.html'));
});

route.get('/history', (req, res) => {
	res.redirect('/history/1');
});

route.get('/history/:page', (req, res) => {
	const pageSize = 10;
	const pageListSize = 5;
	let history = {};
	
	pool.getConnection((err, connection) => {
		if (err) {
			connection.release();
			return res.status(401).send(`db 에러 ${err}`);
		}
		
		// 테이블 조회
		connection.query('SELECT count(*) as totalCount from completed', (err, results) => {
			if (err) return res.status(401).send(`db 에러 ${err}`);
			const totalCount = results[0].totalCount;
			const totalPage = Math.ceil(totalCount/pageSize);
			const page = (req.params.page > totalPage || req.params.page <= 0) ? 1 : parseInt(req.params.page);
			const num = (page-1) * pageSize;
			const currentPage = page;
			const startPage = 1; //(page / pageListSize) * pageListSize;
			const endPage = totalPage; //((startPage + pageListSize) > totalPage) ? totalPage : (startPage + pageListSize);
			const prevPage = ((currentPage - 1) <= 0) ? false : (currentPage - 1);
			const nextPage = ((currentPage + 1) > totalPage) ? false : (currentPage + 1);
			const sql = 'SELECT id,ip,browser,created_key,compressibility,zip_url,before_filesize,after_filesize,DATE_FORMAT(created, "%Y/%m/%d %T") created FROM completed ORDER BY id DESC LIMIT ?, ?';
			const params = [num, pageSize];
			
			connection.query(sql, params, (err, results) => {
				connection.release();
				if (err) return res.status(401).send(`db 에러 ${err}`);
				history.page = {
					totalCount,
					totalPage,
					startPage,
					endPage,
					currentPage,
					prevPage,
					nextPage
				};
				history.list = results;
				return res.render('history', history);
			});
		});
	});
});

route.post('/api/upload', (req, res) => {
	const ip = getIpAddress(req);
	const ua = getUseragent(req);
	const createdKey = new Date().valueOf();
	let compressFiles = [];
	let resultFiles = {
		beforeSizeFormatBytes: null,
		afterSizeFormatBytes: null,
		beforeSize: null,
		afterSize: null,
		compressibility: null,
		createdKey: createdKey,
		fileList: []
	}

	const folder = makeDir.sync(`uploads/${createdKey}_images/compress`);
	console.log(`## created folder: ${folder}`);

	const form = new formidable.IncomingForm();
	form.multiples = true;
	form.uploadDir = path.join(__dirname, '../', `uploads/${createdKey}_images`);
	form.parse(req);

	form.on('error', err => { console.log(err); });
	form.on('progress', (bytesReceived, bytesExpected) => {
		let percentComplete = (bytesReceived / bytesExpected) * 100;
		console.log(`${ip}, ${ua}, loading: ${percentComplete.toFixed(2)}`);
	});
	form.on('end', (fields, files) => {
		formEnd(form.openedFiles)
		.then(imageCompress)
		.then(getFilesize)
		.then(zipFileAdd)
		.then(result => {
			console.log('=================== 결과 json ===================');
			console.log(resultFiles);
			const sql = 'INSERT INTO completed (ip, browser, created_key, compressibility, zip_url, before_filesize, after_filesize, created) VALUES(?, ?, ?, ?, ?, ?, ?, NOW())';
			const params = [ip, ua, resultFiles.createdKey, resultFiles.compressibility, 'uploads/' + createdKey + '_images.zip', resultFiles.beforeSizeFormatBytes, resultFiles.afterSizeFormatBytes];
			pool.getConnection((err, connection) => {
				if (err) {
					connection.release();
					return res.status(401).send(`db 에러 ${err}`);
				}
				
				connection.query(sql, params, (err, results) => {
					connection.release();
					if (err) return res.status(401).send(`db 에러 ${err}`);
					return res.json(resultFiles);
				});
			});
			
		});
	});

	function formEnd(openedFiles) {
		// 파일 업로드완료 이후
		return new Promise((resolve, reject) => {
			const totalLength = openedFiles.length;
			let count = 0;
			let totalSize = 0;
			openedFiles.map(file => {
				totalSize += file.size;
			});
			console.log('총 업로드 파일갯수: ', totalLength);
			console.log('압축전 파일사이즈: ', totalSize);
			console.log('압축전 파일사이즈 변환: ', formatBytes(totalSize));
			resultFiles.beforeSize = totalSize;
			resultFiles.beforeSizeFormatBytes = formatBytes(totalSize);
			for (let i=0; i < totalLength; i++) {
				let openedFile = openedFiles[i]; 
				let tempPath = openedFile.path;
				let fileName = `${createdKey}-${openedFile.name}`;
				((tempPath, fileName) => {
					fs.rename(tempPath, path.join(form.uploadDir, fileName), err => {
						if (err) throw err;
						count++;
						compressFiles.push(`uploads/${createdKey}_images/${fileName}`);
						resultFiles.fileList.push({
							fileName: fileName,
							path: `/uploads/${createdKey}_images/`
						});
						if (count === totalLength) {
							console.log('## formEnd completed');
							resolve(compressFiles);
						}
					});
				})(tempPath, fileName);
			}
		});
	}
	
	function imageCompress(files) {
		// 이미지 압축 모듈 적용
		return new Promise(async (resolve, reject) => {
			const inputPath = `uploads/${createdKey}_images/*.{jpg,JPG,jpeg,JPEG,png,svg,gif}`;
			const outputPath = `uploads/${createdKey}_images/compress/`;
			let count = 0;
			compressImages(
				inputPath, 
				outputPath, 
				{ compress_force: false, statistic: true, autoupdate: false }, false,
				{ jpg: { engine: 'mozjpeg', command: ['-quality', '90'] }},
				{ png: { engine: 'pngquant', command: ['--quality=90-100'] }},
				{ svg: { engine: 'svgo', command: '--multipass' }},
				{ gif: { engine: 'gifsicle', command: ['--colors', '225'] }},
				err => {
					if (err === null) {
						count++;
						if (count > files.length) {
							console.log('## imageCompress completed');
							resolve(resultFiles.fileList);
						}
					}
				}
			);
		});
	}
	
	function getFilesize(files) {
		// 압축된 이미지 파일사이즈 가져오기
		return new Promise((resolve, reject) => {
			console.log(files);
			let compressedFileSize = [];
			let totalCompressedFileSize = 0;
			for (let i=0; i < files.length; i++) {
				let fileName = files[i].fileName;
				((fileName) => {
					let stats = fs.statSync(`uploads/${createdKey}_images/compress/${fileName}`);
					let fileSizeInBytes = stats.size;
					totalCompressedFileSize += fileSizeInBytes;
					compressedFileSize.push(fileSizeInBytes);
					console.log('압축된 파일사이즈: ', fileSizeInBytes);
				})(fileName);
			}
			console.log(compressedFileSize);
			console.log('압축이후 파일사이즈 변환: ', formatBytes(totalCompressedFileSize));
			resultFiles.afterSize = totalCompressedFileSize;
			resultFiles.afterSizeFormatBytes = formatBytes(totalCompressedFileSize);
			resultFiles.compressibility = (((resultFiles.beforeSize - resultFiles.afterSize) / resultFiles.beforeSize) * 100).toFixed(2) + ' %';
			console.log('## getFilesize completed');
			resolve();
		});
	}
	
	function zipFileAdd() {
		// 파일 압축하기
		return new Promise((resolve, reject) => {
			const zip = new JSZip();
			for (let i=0; i < resultFiles.fileList.length; i++) {
				let item = resultFiles.fileList[i];
				zip.file(item.fileName, fs.readFileSync(`uploads/${createdKey}_images/compress/${item.fileName}`), { base64: true });
			}
			zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
			.pipe(fs.createWriteStream(`uploads/${createdKey}_images.zip`))
			.on('finish', () => {
				console.log('## zipFileAdd completed');
				resolve();
			});
		});
	}
});

route.post('/api/create', (req, res) => {
	// 테이블 생성
	/*
		@ DB 필요한 컬럼
		id,
		접속한 ip주소,
		접속한 브라우저,
		생성된 폴더 타임값,
		압축률,
		압축 zip파일 이미지 경로,
		압축전 파일사이즈,
		압축후 파일사이즈
	*/
	const sql = `CREATE TABLE completed (
		id int(10) NOT NULL AUTO_INCREMENT,
		ip varchar(20) NOT NULL,
		browser varchar(20) NOT NULL,
		created_key varchar(30) NOT NULL,
		compressibility varchar(10) NOT NULL,
		zip_url varchar(100) NOT NULL,
		before_filesize varchar(30) NOT NULL,
		after_filesize varchar(30) NOT NULL,
		created datetime NOT NULL,
		PRIMARY KEY (id)
	)`;
	pool.getConnection((err, connection) => {
		if (err) {
			connection.release();
			return res.status(401).send(`db 에러 ${err}`);
		}
		connection.query(sql, (err, results) => {
			connection.release();
			if (err) return res.status(401).send(`db 에러 ${err}`);
			return res.send('db completed 생성');
		});
	});
});

route.post('/api/reset', (req, res) => {
	rimraf(path.join(__dirname, '../', 'uploads'), () => {
		const dropSql = `DROP TABLE completed`;
		pool.getConnection((err, connection) => {
			if (err) {
				connection.release();
				return res.status(401).send(`db 에러 ${err}`);
			}

			connection.query(dropSql, (err, results) => {
				if (err) return res.status(401).send(`db 에러 ${err}`);
				
				const createSql = `CREATE TABLE completed (
					id int(10) NOT NULL AUTO_INCREMENT,
					ip varchar(20) NOT NULL,
					browser varchar(20) NOT NULL,
					created_key varchar(30) NOT NULL,
					compressibility varchar(10) NOT NULL,
					zip_url varchar(100) NOT NULL,
					before_filesize varchar(30) NOT NULL,
					after_filesize varchar(30) NOT NULL,
					created datetime NOT NULL,
					PRIMARY KEY (id)
				)`;
				connection.query(createSql, (err, results) => {
					connection.release();
					if (err) return res.status(401).send(`db 에러 ${err}`);
					return res.send('업로드된 이미지 폴더 삭제, db completed 삭제 생성');
				});
			});
		});
	});
});

module.exports = route;
